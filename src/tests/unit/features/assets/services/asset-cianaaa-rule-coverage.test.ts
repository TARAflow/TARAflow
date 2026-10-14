// tests/unit/features/assets/services/asset-cianaaa-rule-coverage.test.ts
//
// Coverage guard for the CIANAAA derivation rules.
//
// The bugs this guards against: relation types that exist in the model but have
// no BASE_RULES entry (function:*, physical:*, service:*, …) silently produced
// no suggested goals, and keys that can never be built (data:destroys,
// infrastructure:accesses:local / :remote) silently never matched. Both are
// invisible in the UI — the asset just shows fewer suggestions.
//
// Source of the reachable set: the relation-type label maps (one entry per
// member of each *AssetRelationType union) and the qualifier label maps, both
// typed Record<Union, string> — a new union member breaks the build there and
// this test here.

import { describe, it, expect } from "vitest";
import {
  BASE_RULES,
  computeSuggestedGoalTypes,
} from "features/assets/services/asset-cianaaa-deriver";
import {
  DATA_RELATION_LABEL_KEYS,
  FUNCTION_RELATION_LABEL_KEYS,
  PROCESS_RELATION_LABEL_KEYS,
  SYSTEM_RELATION_LABEL_KEYS,
  INFRA_RELATION_LABEL_KEYS,
  PHYSICAL_RELATION_LABEL_KEYS,
  SERVICE_RELATION_LABEL_KEYS,
  HUMAN_RELATION_LABEL_KEYS,
  ENVIRONMENT_RELATION_LABEL_KEYS,
  SYSTEM_USES_QUALIFIER_LABEL_KEYS,
  SERVICE_USES_QUALIFIER_LABEL_KEYS,
  INFRA_ACCESSES_QUALIFIER_LABEL_KEYS,
  PHYSICAL_CONTACT_QUALIFIER_LABEL_KEYS,
} from "features/dfd/models/asset-constants";
import type { Asset } from "features/assets/models/asset-types";

const RELATIONS: Record<string, string[]> = {
  data: Object.keys(DATA_RELATION_LABEL_KEYS),
  function: Object.keys(FUNCTION_RELATION_LABEL_KEYS),
  process: Object.keys(PROCESS_RELATION_LABEL_KEYS),
  system: Object.keys(SYSTEM_RELATION_LABEL_KEYS),
  infrastructure: Object.keys(INFRA_RELATION_LABEL_KEYS),
  physical: Object.keys(PHYSICAL_RELATION_LABEL_KEYS),
  service: Object.keys(SERVICE_RELATION_LABEL_KEYS),
  human: Object.keys(HUMAN_RELATION_LABEL_KEYS),
  environment: Object.keys(ENVIRONMENT_RELATION_LABEL_KEYS),
};

/** group:relation → qualifiers (the UI requires one for these, B15). */
const QUALIFIERS: Record<string, string[]> = {
  "system:uses": Object.keys(SYSTEM_USES_QUALIFIER_LABEL_KEYS),
  "service:uses": Object.keys(SERVICE_USES_QUALIFIER_LABEL_KEYS),
  "infrastructure:accesses": Object.keys(INFRA_ACCESSES_QUALIFIER_LABEL_KEYS),
  "physical:accesses": Object.keys(PHYSICAL_CONTACT_QUALIFIER_LABEL_KEYS),
};

function reachableKeys(): string[] {
  const keys: string[] = [];
  for (const [group, relations] of Object.entries(RELATIONS)) {
    for (const relation of relations) {
      const base = `${group}:${relation}`;
      const qualifiers = QUALIFIERS[base];
      if (qualifiers) keys.push(...qualifiers.map((q) => `${base}:${q}`));
      else keys.push(base);
    }
  }
  return keys;
}

/** Rules that deliberately suggest nothing — protection targets. */
const NO_SUGGESTION_BY_DESIGN = [
  "human:is_an",
  "human:endangers",
  "physical:accesses:indirect",
  "environment:is_an",
  "environment:endangers",
  "environment:contaminates",
  "environment:monitors",
];

/**
 * Non-empty rules whose every flag is filtered by CIANAAA_APPLICABLE.
 * affects_safety is deprecated (replaced by endangers) and kept for old models.
 */
const FULLY_FILTERED_LEGACY = ["human:affects_safety"];

function assetFor(key: string): Asset {
  const [group, relationType, qualifier] = key.split(":");
  return {
    id: "A-1",
    name: key,
    assetGroup: group,
    properties: {},
    impactRatings: [],
    linkedDFDElements: [
      { elementId: "E-1", elementName: "Element", relationType, qualifier },
    ],
  } as unknown as Asset;
}

describe("CIANAAA rule coverage", () => {
  it("every group × relation × qualifier has a rule", () => {
    const missing = reachableKeys().filter((k) => !(k in BASE_RULES));
    expect(missing).toEqual([]);
  });

  it("every rule can be built from a stored relation", () => {
    const reachable = new Set(reachableKeys());
    const dead = Object.keys(BASE_RULES).filter((k) => !reachable.has(k));
    expect(dead).toEqual([]);
  });

  it("empty rules are exactly the protection targets listed by design", () => {
    const empty = Object.entries(BASE_RULES)
      .filter(([, goals]) => goals.length === 0)
      .map(([k]) => k);
    expect(empty.sort()).toEqual([...NO_SUGGESTION_BY_DESIGN].sort());
  });

  it("every non-empty rule suggests at least one applicable goal", () => {
    const silent = Object.entries(BASE_RULES)
      .filter(([, goals]) => goals.length > 0)
      .map(([k]) => k)
      .filter((k) => computeSuggestedGoalTypes(assetFor(k)).size === 0);
    expect(silent.sort()).toEqual([...FULLY_FILTERED_LEGACY].sort());
  });
});

describe("rules added for v0.13.2", () => {
  const suggested = (key: string, props: Record<string, unknown> = {}) => {
    const a = assetFor(key);
    a.properties = props as Asset["properties"];
    return computeSuggestedGoalTypes(a);
  };

  it.each([
    ["data:is_an", ["I", "A"]],
    ["system:monitors", ["I"]],
    ["system:uses:authentication", ["AuthN", "I", "A"]],
    ["system:uses:authorization", ["AuthZ", "I", "A"]],
    ["system:uses:storage", ["I", "A", "AuthZ"]],
    ["system:uses:computation", ["I", "A"]],
    ["system:uses:messaging", ["I", "C", "AuthN"]],
    ["system:uses:configuration", ["I", "AuthZ"]],
    ["system:uses:monitoring", ["I"]],
    ["system:uses:networking", ["AuthN", "I", "A"]],
    ["infrastructure:accesses:on-site", ["AuthZ"]],
    ["physical:is_an", ["I", "A"]],
    ["physical:accesses:direct", ["I", "A"]],
    ["physical:accesses:remote", ["I", "A"]],
    ["physical:damages", ["A", "I"]],
    ["physical:secures", ["A", "I"]],
    ["physical:monitors", ["I"]],
    ["service:is_an", ["I", "A"]],
    ["service:uses:api", ["AuthN", "AuthZ", "I"]],
    ["service:uses:sdk", ["I", "AuthZ"]],
    ["service:uses:webhook", ["AuthN", "I", "N"]],
    ["service:uses:managed", ["A"]],
    ["service:configures", ["I", "AuthZ", "N"]],
    ["service:monitors", ["I", "N"]],
    ["service:depends_on", ["A"]],
  ])("%s → %j (after applicability filter)", (key, expected) => {
    expect(suggested(key as string)).toEqual(new Set(expected as string[]));
  });

  it("data:is_an adds C* for secure storage", () => {
    expect(suggested("data:is_an", { isSecureStorage: true })).toEqual(
      new Set(["I", "A", "C"]),
    );
  });

  it.each([
    "system:monitors",
    "system:uses:authentication",
    "system:uses:authorization",
    "system:uses:messaging",
    "system:uses:monitoring",
    "service:uses:api",
    "service:monitors",
  ])("%s adds Acc** for personal data", (key) => {
    expect(suggested(key, { isPersonalData: true }).has("Acc")).toBe(true);
  });

  it("infrastructure on-site access is derived (was keyed as 'local' and never matched)", () => {
    expect(suggested("infrastructure:accesses:on-site").size).toBeGreaterThan(0);
  });
});
