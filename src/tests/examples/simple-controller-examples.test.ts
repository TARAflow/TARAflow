// src/tests/examples/simple-controller-examples.test.ts
//
// Checks what every Simple Controller example promises (README "Expected"),
// through the real services. With WRITE_EXAMPLES=<dir> it also writes the
// example projects and their README into <dir> — e.g. the requirements folder
// of TARAflow_Examples:
//
//   WRITE_EXAMPLES=../TARAflow_Examples/simple-controller npx vitest run src/tests/examples

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { dfdValidator } from "features/dfd/services/dfd-validator";
import { goalFindings, goalState } from "features/assets/services/asset-goal-state";
import { assetIdsNeedingReview, collectAssetFindings } from "features/assets/services/asset-validator";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";
import type { Asset, AssetData } from "features/assets/models/asset-types";
import { mapDFDAssetsToAssetFeature } from "app/utils/dfd-to-asset-mapper";
import { getAssetsMissingInDFD } from "features/assets/services/asset-sync-service";
import { applyAssetCriteriaToFactorRatings } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { CIANAAA_LEVEL_KEY_PREFIX } from "features/assets/models/asset-security-goals-types";
import {
  SCALE,
  buildExamples,
  goalOf,
  loadBase,
  type Example,
  type ProjectJson,
} from "./simple-controller-examples";

const examples = buildExamples();
const ex = (n: string) => examples.find((e) => e.file.startsWith(n))!;
const assetsOf = (e: Example): Asset[] => e.project.assets.assets;
const asset = (e: Example, id: string) => assetsOf(e).find((a) => a.displayId === id)!;
const state = (e: Example, id: string, t: Parameters<typeof goalOf>[1]) => {
  const a = asset(e, id);
  return goalState(a, goalOf(a, t), SCALE);
};
const findings = (e: Example) =>
  collectAssetFindings(e.project.assets as AssetData);

/** Per-element threat categories the generator produces for the example. */
function generatedThreats(p: ProjectJson): Record<string, string[]> {
  const graph = resolveDfdGraph(p.dfd);
  const data = {
    threats: null,
    dfdGraph: graph,
    assetDataRef: buildAssetDataReference(p.assets.assets, {}, SCALE),
  } as unknown as ThreatProjectData;
  const config = { activeMethod: "per-element", forceClassicMode: false } as unknown as ThreatConfiguration;
  const byElement: Record<string, Set<string>> = {};
  const idToDisplay = new Map(
    [...p.dfd.elements, ...p.dfd.connections].map((x: { id: string; displayId: string }) => [x.id, x.displayId]),
  );
  for (const t of elementThreatGenerator.generateThreatsForProject(data, config).flatMap((x) => x.threats)) {
    const id = idToDisplay.get(t.linkedElement?.elementId) ?? t.linkedElement?.elementId ?? "?";
    (byElement[id] ??= new Set()).add(t.strideCategory);
  }
  const order = "STRIDE";
  return Object.fromEntries(
    Object.entries(byElement)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, [...v].sort((a, b) => order.indexOf(a) - order.indexOf(b))]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
describe("base model", () => {
  it("the DFD validates without property warnings (as reported in the app)", () => {
    const base = loadBase();
    const graph = resolveDfdGraph(base.dfd)!;
    const result = dfdValidator.validate(
      base.dfd.elements,
      base.dfd.connections,
      [],
      base.dfd.stats,
      graph as never,
    );
    const keys = result.warnings.map((w) => `${w.key} ${JSON.stringify(w.params ?? {})}`);
    expect(keys.filter((k) => k.includes("missingProperty"))).toEqual([]);
    expect(keys.filter((k) => /protocol|accessModel/i.test(k))).toEqual([]);
  });
});

describe("every example: assets are placed in the DFD", () => {
  // The asset tab warns "N asset(s) not placed in DFD" for assets the diagram
  // does not know (reported on the first generated version).
  const check = (p: ProjectJson) => {
    const dfdAssets = mapDFDAssetsToAssetFeature(p.dfd.assets, p.dfd.elements, p.dfd.connections);
    return {
      missing: getAssetsMissingInDFD(p.assets as AssetData, dfdAssets).map((a) => a.displayId),
      links: Object.fromEntries(dfdAssets.map((a) => [a.displayId ?? a.id, (a.linkedElements ?? []).map((l) => l.displayId).sort()])),
    };
  };

  for (const e of examples) {
    it(e.file, () => {
      const { missing, links } = check(e.project);
      expect(missing).toEqual([]);
      for (const a of assetsOf(e)) {
        expect(links[a.displayId ?? a.id], a.displayId).toEqual(a.linkedDFDElements.map((l) => l.displayId).sort());
      }
    });
  }

  it("control: the first generated version (links only in the asset store) is reported", () => {
    const p = JSON.parse(JSON.stringify(ex("01").project));
    for (const item of [...p.dfd.elements, ...p.dfd.connections]) delete item.assetRelations;
    p.dfd.assets = [];
    for (const a of p.assets.assets) a.source = "manual";
    expect(check(p).missing).toEqual(["DA-001", "DA-002", "PR-001"]);
  });
});

describe("01 goals derived", () => {
  const e = ex("01");
  it("goals come from the relations; nothing is decided", () => {
    for (const a of assetsOf(e)) {
      for (const g of a.securityGoals) expect(g.source === "manual").toBe(false);
    }
    expect(state(e, "DA-001", "I").source).toBe("suggested");
    expect(state(e, "PR-001", "A").source).toBe("suggested");
  });

  it("threat generation keeps only the categories of active goals", () => {
    const t = generatedThreats(e.project);
    expect(t["DF-4"]).toBeDefined();
    // DA-002 (firmware) asks for I, C, AuthN → T, I, S possible on DF-4; never D without an A goal
    expect(t["DF-4"]).not.toContain("D");
  });
});

describe("02 goals decided", () => {
  const e = ex("02");
  it("I adjusted, AuthZ added, C excluded — all with rationale, no finding", () => {
    expect(state(e, "DA-001", "I").source).toBe("manual");
    expect(state(e, "DA-001", "AuthZ").suggestion.suggested).toBe(false);
    expect(state(e, "DA-001", "C").visibility).toBe("excluded");
    const a = asset(e, "DA-001");
    for (const t of ["I", "AuthZ", "C"] as const) {
      expect(goalFindings(goalState(a, goalOf(a, t), SCALE), goalOf(a, t)).filter((f) => f.severity !== "info")).toEqual([]);
    }
  });
});

describe("03 goals need review", () => {
  const e = ex("03");
  it("exactly DA-001, DA-002 and DA-003 need review", () => {
    expect([...assetIdsNeedingReview(findings(e))].sort()).toEqual(["DA-001", "DA-002", "DA-003"]);
  });
  it("DA-001 A: basis changed; DA-002 C: rationale missing; DA-003: assessment missing", () => {
    expect(state(e, "DA-001", "A").stale).toBe("level-raised");
    const da2 = asset(e, "DA-002");
    expect(goalFindings(goalState(da2, goalOf(da2, "C"), SCALE), goalOf(da2, "C")).map((f) => f.code)).toContain(
      "GOAL_RATIONALE_MISSING",
    );
    expect(state(e, "DA-003", "I").assessment).toBe("missing");
  });
});

describe("04 impact per goal", () => {
  const e = ex("04");
  it("DA-001 I uses safety 1 (asset 3); DA-002 C conflicts with the asset value", () => {
    expect(state(e, "DA-001", "I").impactOverrides).toContain("safety");
    expect(state(e, "DA-002", "C").exceedsAsset).toEqual(["financial_damage"]);
    expect(findings(e).some((f) => f.assetId === "DA-002" && f.severity === "error")).toBe(true);
  });

  it("a tampering risk on DF-1 takes safety 1 from the goal, not 3 from the asset", () => {
    const ref = buildAssetDataReference(e.project.assets.assets, {}, SCALE);
    const da1 = ref.assets.filter((a) => a.displayId === "DA-001");
    const factors = applyAssetCriteriaToFactorRatings(
      [{ factorId: "safety", value: 0, weight: 1 }],
      da1,
      ref,
      { ...DEFAULT_CONFIGURATION, useAssetImpact: true },
      "T",
    );
    expect(factors.find((f) => f.factorId === "safety")!.value).toBe(1);
    // control: without the per-goal impact (example 01) the asset value applies
    const ref01 = buildAssetDataReference(ex("01").project.assets.assets, {}, SCALE);
    const plain = applyAssetCriteriaToFactorRatings(
      [{ factorId: "safety", value: 0, weight: 1 }],
      ref01.assets.filter((a) => a.displayId === "DA-001"),
      ref01,
      { ...DEFAULT_CONFIGURATION, useAssetImpact: true },
      "T",
    );
    expect(plain.find((f) => f.factorId === "safety")!.value).toBe(3);
  });
});

// ── writing ─────────────────────────────────────────────────────────────────
function levelName(l: string | null) {
  if (l === null) return "? (assessment required)";
  return l.replace(`${CIANAAA_LEVEL_KEY_PREFIX}.`, "").replace(/^\w/, (c) => c.toUpperCase());
}

function expectedSection(e: Example): string {
  const lines = ["**Expected** (checked by `simple-controller-examples.test.ts`):", ""];
  lines.push("| Asset | Goals (level · source) |", "|---|---|");
  for (const a of assetsOf(e)) {
    const goals = a.securityGoals
      .map((g) => ({ g, s: goalState(a, g, SCALE) }))
      .filter(({ g, s }) => g.level !== "none" || s.visibility === "excluded")
      .map(({ g, s }) =>
        s.visibility === "excluded"
          ? `${g.type} excluded`
          : `${g.type} ${levelName(s.displayLevel)} · ${s.source === "manual" ? "manual" : "suggested"}${s.stale ? " · review" : ""}`,
      );
    lines.push(`| ${a.displayId} ${a.name} | ${goals.join(", ") || "–"} |`);
  }
  const t = generatedThreats(e.project);
  lines.push("", "Threats → Generate (per element) creates these STRIDE categories:", "");
  lines.push("| Element | Categories |", "|---|---|");
  for (const [k, v] of Object.entries(t)) lines.push(`| ${k} | ${v.join(", ")} |`);
  const review = [...assetIdsNeedingReview(findings(e))].sort();
  lines.push("", `Needs review: ${review.length ? review.join(", ") : "none"}.`);
  return lines.join("\n");
}

function readme(all: Example[]): string {
  const parts = [
    "# Simple Controller examples",
    "",
    "One small model — an operator, a controller with an update service, a configuration store, a USB service port and the device enclosure — and one example per aspect of TARAflow. Every example starts from `00-base.tara.json` and changes one thing.",
    "",
    "The files are generated from the TARAflow repository (`src/tests/examples`) through the real services; the values under **Expected** are checked by a test. Regenerate after a change:",
    "",
    "```",
    "WRITE_EXAMPLES=<this folder> npx vitest run src/tests/examples",
    "```",
    "",
    "Requirement ids refer to `src/tests/requirements/README.md` in the TARAflow repository.",
    "",
    "## Base model",
    "",
    "| Element | Name | Notes |",
    "|---|---|---|",
    "| EE-1 | Operator | outside both boundaries |",
    "| IF-1 | USB (service port) | on the enclosure edge, EL1 |",
    "| P-1 | Controller | daemon, runs as service |",
    "| P-2 | Update Service | daemon, runs as root |",
    "| DS-1 | Config Store | flash, no encryption, no integrity protection |",
    "| DF-1 | push setpoint [cmd] | EE-1 → P-1 via IF-1, UART over USB |",
    "| DF-2 / DF-3 | write config / read config | P-1 ↔ DS-1 |",
    "| DF-4 | push firmware [cmd] | P-2 → P-1, file |",
    "",
    "Assets (from example 01 on): DA-001 Setpoint and configuration (transports DF-1..3, stores DS-1), DA-002 Firmware image (transports DF-4), PR-001 Heating control (is P-1). Impact criteria: the defaults plus safety.",
    "",
  ];
  for (const e of all) {
    parts.push(
      `## ${e.title}`,
      "",
      `File: \`${e.file}\` · Requirements: ${e.requirements.join(", ")}`,
      "",
      e.shows,
      "",
      "**Steps**",
      "",
      ...e.steps.map((s, i) => `${i + 1}. ${s}`),
      "",
      expectedSection(e),
      "",
    );
  }
  return parts.join("\n");
}

describe("write examples", () => {
  it.runIf(!!process.env.WRITE_EXAMPLES)("writes the projects and the README", () => {
    const dir = process.env.WRITE_EXAMPLES!;
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "00-base.tara.json"), JSON.stringify(loadBase(), null, 2));
    for (const e of examples) writeFileSync(join(dir, e.file), JSON.stringify(e.project, null, 2));
    writeFileSync(join(dir, "README.md"), readme(examples));
  });
});
