// src/tests/examples/simple-controller-examples.ts
//
// The "Simple Controller" example projects for TARAflow_Examples. Every
// example starts from ONE base model (fixtures/examples/simple-controller.base
// .tara.json — drawn in the app) and changes one aspect. Assets, goals and
// configuration are built through the REAL services (asset factory, deriver,
// goal-state actions, impact calculator), so an example can never show
// something the app would not produce.
//
// simple-controller-examples.test.ts checks what each example promises and
// writes the files when WRITE_EXAMPLES=<dir> is set.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Asset, AssetConfiguration, AssetData } from "features/assets/models/asset-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { SecurityGoalType } from "features/assets/models/asset-security-goals-types";
import { createEmptyAsset } from "features/assets/services/asset-factory";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import { recalculateAllImpacts } from "features/assets/services/asset-impact-calculator";
import {
  adjustGoal,
  excludeGoal,
  setGoalImpact,
} from "features/assets/services/asset-goal-state";

const HERE = dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProjectJson = any;

export function loadBase(): ProjectJson {
  return JSON.parse(
    readFileSync(join(HERE, "../fixtures/examples/simple-controller.base.tara.json"), "utf-8"),
  );
}

export const SCALE = "4-level" as const;

/** Asset criteria of every example: the defaults plus safety (heating controller). */
export const ASSET_CONFIGURATION: AssetConfiguration = {
  ...DEFAULT_ASSET_CONFIGURATION,
  impactCriteria: [...DEFAULT_ASSET_CONFIGURATION.impactCriteria, { id: "safety", weight: 0.2 }],
};

// ── DFD lookup ──────────────────────────────────────────────────────────────
function el(base: ProjectJson, displayId: string) {
  const all = [...base.dfd.elements, ...base.dfd.connections];
  const e = all.find((x: { displayId: string }) => x.displayId === displayId);
  if (!e) throw new Error(`base model has no ${displayId}`);
  const type = base.dfd.connections.includes(e) ? "DataFlow" : e.type;
  return { elementId: e.id, displayId, elementName: e.name, elementType: type };
}

type Ratings = Partial<Record<string, number | null | "na">>;

function asset(
  base: ProjectJson,
  displayId: string,
  name: string,
  group: "data" | "process",
  ratings: Ratings,
  links: [string, string][], // [element displayId, relationType]
): Asset {
  const a = createEmptyAsset(displayId, ASSET_CONFIGURATION, group, displayId);
  const impactRatings: ImpactRating[] = a.impactRatings.map((r) => ({
    criterionId: r.criterionId,
    value: (ratings[r.criterionId] ?? null) as ImpactRating["value"],
  }));
  const built: Asset = {
    ...a,
    name,
    impactRatings,
    linkedDFDElements: links.map(([id, relationType]) => ({ ...el(base, id), relationType })) as never,
    syncedWithDFD: true,
    created: "2026-10-02T00:00:00.000Z",
    lastModified: "2026-10-02T00:00:00.000Z",
  };
  return derive(built);
}

export const derive = (a: Asset): Asset => ({
  ...a,
  securityGoals: deriveSecurityGoalSuggestions(a, a.securityGoals, SCALE),
});

export const goalOf = (a: Asset, t: SecurityGoalType) => a.securityGoals.find((g) => g.type === t)!;
const setGoal = (a: Asset, g: Asset["securityGoals"][number]): Asset => ({
  ...a,
  securityGoals: a.securityGoals.map((x) => (x.type === g.type ? g : x)),
});

/** The three assets every example shares, before any analyst decision. */
export function baseAssets(base: ProjectJson): Asset[] {
  return [
    asset(
      base,
      "DA-001",
      "Setpoint and configuration",
      "data",
      { financial_damage: 2, operational: 3, regulatory_compliance: 1, recoverability: 2, affected_users: 1, safety: 3 },
      [
        ["DF-1", "transports"],
        ["DF-2", "transports"],
        ["DF-3", "transports"],
        ["DS-1", "stores"],
      ],
    ),
    asset(
      base,
      "DA-002",
      "Firmware image",
      "data",
      { financial_damage: 3, operational: 4, regulatory_compliance: 2, recoverability: 3, affected_users: 2, safety: 4 },
      [["DF-4", "transports"]],
    ),
    asset(
      base,
      "PR-001",
      "Heating control",
      "process",
      { financial_damage: 2, operational: 4, regulatory_compliance: 2, recoverability: 2, affected_users: 2, safety: 4 },
      [["P-1", "is_an"]],
    ),
  ];
}

// ── project assembly ────────────────────────────────────────────────────────
function project(base: ProjectJson, slug: string, title: string, description: string, assets: Asset[]): ProjectJson {
  const p = JSON.parse(JSON.stringify(base));
  p.id = `example-simple-controller-${slug}`;
  p.info.name = `TARAflow Example – ${title}`;
  p.info.description = description;
  const data: AssetData = recalculateAllImpacts({
    configuration: ASSET_CONFIGURATION,
    assets,
    lastModified: "2026-10-02T00:00:00.000Z",
  });
  p.assets = { ...data, lastModified: "2026-10-02T00:00:00.000Z" };
  p.threats = null;
  p.risks = null;
  return p;
}

export interface Example {
  file: string;
  title: string;
  /** Requirement ids from src/tests/requirements/README.md. */
  requirements: string[];
  shows: string;
  steps: string[];
  project: ProjectJson;
}

const byId = (assets: Asset[], id: string) => assets.find((a) => a.displayId === id)!;
const replace = (assets: Asset[], a: Asset) => assets.map((x) => (x.id === a.id ? a : x));

export function buildExamples(base: ProjectJson = loadBase()): Example[] {
  const out: Example[] = [];

  // 01 ─ derived goals, no decision
  {
    const assets = baseAssets(base);
    out.push({
      file: "01-goals-derived.tara.json",
      title: "01 Goals derived",
      requirements: ["SG-01", "SG-07"],
      shows:
        "Security goals derived from the DFD relations and the asset impact — no analyst decision yet. Threat generation creates only the STRIDE categories of active goals; elements without an asset (P-2, IF-1, ENC) keep the full technically possible set.",
      steps: [
        "Assets: the goal column shows blue-outlined chips (suggested) with the level, e.g. \"I · High\".",
        "Open DA-001 → tab Security goals: every card says Suggested and explains the level (relation + driving criterion).",
        "Threats → Generate: a data flow gets only the categories its asset goals ask for (technically possible ∩ active goal).",
      ],
      project: project(
        base,
        "01",
        "Simple Controller – 01 Goals derived",
        "Goals derived from DFD relations and asset impact; no analyst decisions. Generate threats to see the goal filter.",
        assets,
      ),
    });
  }

  // 02 ─ analyst decisions: adjusted, added, excluded
  {
    let assets = baseAssets(base);
    let da1 = byId(assets, "DA-001");
    da1 = setGoal(da1, adjustGoal(da1, goalOf(da1, "I"), "medium", "Setpoints are range-checked by the controller; a manipulated value cannot leave the safe band.", SCALE));
    da1 = setGoal(da1, adjustGoal(da1, goalOf(da1, "AuthZ"), "medium", "Only service technicians may change the configuration.", SCALE));
    da1 = setGoal(da1, excludeGoal(da1, goalOf(da1, "C"), "Setpoints and configuration contain no secrets.", SCALE));
    assets = replace(assets, da1);
    out.push({
      file: "02-goals-decided.tara.json",
      title: "02 Goals decided",
      requirements: ["SG-02", "SG-04", "SG-09"],
      shows:
        "Three analyst decisions on DA-001: integrity adjusted, authorisation added, confidentiality excluded — each with a rationale. An exclusion is a decision and stays visible.",
      steps: [
        "Assets: DA-001 shows I and AuthZ as blue filled chips with the pen icon, C greyed out and struck through.",
        "Hover C: the tooltip carries the rationale.",
        "Report → Assets: the security-goal table lists I (Adjusted), AuthZ (Added) and C (Excluded) with their rationales.",
      ],
      project: project(base, "02", "Simple Controller – 02 Goals decided",
        "Analyst decisions on DA-001: I adjusted, AuthZ added, C excluded — each with a rationale.", assets),
    });
  }

  // 03 ─ what needs review
  {
    let assets = baseAssets(base);
    // a decision whose basis changed later: C adjusted down, then the impact rose
    let da1 = byId(assets, "DA-001");
    da1 = setGoal(da1, adjustGoal(da1, goalOf(da1, "A"), "low", "A short outage is tolerated by the heating inertia.", SCALE));
    da1 = derive({
      ...da1,
      impactRatings: da1.impactRatings.map((r) => (r.criterionId === "operational" ? { ...r, value: 4 } : r)),
    });
    // a deviation without rationale
    let da2 = byId(assets, "DA-002");
    da2 = setGoal(da2, adjustGoal(da2, goalOf(da2, "C"), "low", "", SCALE));
    // a new asset nobody has assessed yet
    const da3 = asset(base, "DA-003", "Calibration data", "data", {}, [["DF-2", "transports"]]);
    assets = [...replace(replace(assets, da1), da2), da3];
    out.push({
      file: "03-goals-need-review.tara.json",
      title: "03 Goals need review",
      requirements: ["SG-03", "SG-05", "SG-11"],
      shows:
        "Three typical review cases: a decision whose basis changed (DA-001 A), a deviation without rationale (DA-002 C), and an asset without impact assessment (DA-003).",
      steps: [
        "Assets: the bar offers \"Needs review only (3)\"; switch it on — exactly DA-001, DA-002 and DA-003 remain.",
        "DA-003 shows \"I · ?\" instead of a level: the minimum level is never shown as Low.",
        "Open DA-001 → Security goals: the A card says Review — the suggested level rose after the decision.",
        "The findings panel below the table lists the same cases.",
      ],
      project: project(base, "03", "Simple Controller – 03 Goals need review",
        "Review cases: changed basis of a decision, missing rationale, unassessed asset.", assets),
    });
  }

  // 04 ─ impact per goal, conflict
  {
    let assets = baseAssets(base);
    let da1 = byId(assets, "DA-001");
    da1 = setGoal(da1, {
      ...setGoalImpact(goalOf(da1, "I"), "safety", 1),
      rationale: "A manipulated setpoint is clamped by the hardware thermostat — no injury possible.",
    });
    let da2 = byId(assets, "DA-002");
    da2 = setGoal(da2, {
      ...setGoalImpact(goalOf(da2, "C"), "financial_damage", 4),
      rationale: "Leaked firmware enables product piracy.",
    });
    assets = replace(replace(assets, da1), da2);
    out.push({
      file: "04-goal-impact.tara.json",
      title: "04 Impact per goal",
      requirements: ["SG-06", "SG-08"],
      shows:
        "Impact per security goal: DA-001 lowers safety for the integrity goal (with rationale); DA-002 raises financial damage for confidentiality above the asset value — a conflict, reported as an error, the value is not changed.",
      steps: [
        "Open DA-001 → Security goals → I: Safety Impact shows 1 (adjusted) next to the asset value 3.",
        "Open DA-002 → Security goals → C: the card shows \"Impact above asset value\"; the findings panel reports the conflict.",
        "Threats → Generate, Risks → Sync: a tampering risk on DF-1 takes its safety impact from the goal (1), not from the asset (3).",
      ],
      project: project(base, "04", "Simple Controller – 04 Impact per goal",
        "Per-goal impact: lowered for DA-001 I, raised above the asset value for DA-002 C (conflict).", assets),
    });
  }

  return out;
}
