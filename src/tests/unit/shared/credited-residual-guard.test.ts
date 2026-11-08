// ==================== CREDITED RESIDUAL — SOURCE GUARD ====================
// Multi-project TARA I7 (4), phase 3d-2a (review 2026-11-08): a residual risk
// is not credited while a component measure it relies on does not hold. Every
// reader that EVALUATES or SHOWS a residual risk must go through
// creditedResidual (shared/services/credited-residual.ts) — in the Risk tab
// via useCreditedOf, in the report via docResidualView at transform time.
//
// This test walks src/ and fails when a file reads the stored after-values
// (calculatedRiskAfterMitigation, mitigatedFactorRatings, isoRisk.residual)
// without being on the allow list below. Reads off a credited value
// (credited.x, creditedOf(risk).x) do not count. Modelled on the
// prepare-for-disk single-writer guard.
//
// Adding a file to ALLOW needs a reason that fits one of its categories: it
// means the STORED value (editing, recalculating, diffing, serialising,
// checking completeness), or it reads data that is credited already.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function findSrcRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "src");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate src/ from " + process.cwd());
}

const SRC = findSrcRoot();

/** Repo-relative (to src/) path → why it may read the stored after-values. */
const ALLOW: Record<string, string> = {
  // ── The definition itself ────────────────────────────────────────────────
  "shared/services/credited-residual.ts": "defines the credited view",

  // ── Editing the after-values (the risk dialog edits what is STORED) ─────
  "features/risks/components/risk-dialog/local-risk-state.ts": "editor state of the stored values",
  "features/risks/components/risk-dialog/use-risk-dialog-actions.ts": "writes the stored values",
  "features/risks/components/risk-dialog/use-risk-dialog-derived.ts": "live values while editing",
  "features/risks/components/risk-dialog/use-risk-dialog-model.ts": "live ISO values while editing",
  "features/risks/components/risk-dialog/factor-rows.tsx": "rating inputs of the stored values",
  "features/risks/components/risk-dialog/iso-notes.ts": "notes next to the rating inputs",
  "features/risks/components/risk-dialog/risk-after-tab.tsx":
    "the After tab edits the stored ratings; the UncreditedBanner above them says when they do not count",

  // ── Recalculation, stamps, migration (the stored values themselves) ──────
  "features/risks/models/risk-assessment-types.ts": "type, defaults and migration",
  "features/risks/services/risk-service.ts": "recalculates the stored values",
  "features/risks/services/risk-sync-service.ts": "recalculates the stored values",
  "features/risks/services/impact-weight-source.ts": "recalculates the stored values",
  "app/utils/commit-iso-risk-values.ts": "commits the stored ISO values",
  "app/utils/commit-calc-stamps.ts": "calculation stamps over the stored values",
  "app/services/versions/fix-tree-likelihood-scale.ts": "file migration",

  // ── Audit diff (what changed in the file) ────────────────────────────────
  "features/audit/services/diff-service.ts": "diffs the stored values",

  // ── Findings: COMPLETENESS ONLY ──────────────────────────────────────────
  // risk-findings / concept-findings may only check that an after-rating
  // EXISTS (rated or not). A check on the VALUE (too high, above the
  // acceptance threshold, …) must go through creditedResidual.
  "features/risks/services/risk-findings.ts": "completeness only (is an after-rating present)",
  "features/risks/services/concept-findings.ts": "completeness only (is a residual rated)",

  // ── Ticket text: the target value, plus the note ─────────────────────────
  "features/risks/services/ticket-text.ts":
    "the stored target value the measure is meant to achieve, with 'Residual risk currently not credited' when it does not count",

  // ── Data that is credited already ────────────────────────────────────────
  "features/risks/models/iso-scenarios.ts": "default residualOf for report data (credited at transform); the Risk tab passes the credited one",
  "features/risks/components/risk-table-view.tsx": "IsoScenario.residual — rolled up from credited values",
  "features/documentation/utils/iso-scenario-text.ts": "IsoScenario.residual of report data (credited at transform)",
  "features/documentation/utils/iso-risk-label.ts": "report data — credited at transform (app/services/doc-residual.ts)",
  "features/documentation/utils/generators/base-generator.ts": "report data — credited at transform (app/services/doc-residual.ts)",
  "features/documentation/utils/generators/pdfmake-converter.ts": "report data — credited at transform (app/services/doc-residual.ts)",
};

/** Readers that show a residual and must use the credited view. */
const CREDITED_READERS: Record<string, RegExp> = {
  "features/risks/components/risk-matrix.tsx": /useCreditedOf\(/,
  "features/risks/components/iso-risk-matrix.tsx": /useCreditedOf\(/,
  "features/risks/components/shared/risk-columns.tsx": /useCreditedOf\(/,
  "features/risks/components/risk-table-view.tsx": /useCreditedOf\(/,
  "features/risks/components/risk-dialog/risk-dialog-sidebar.tsx": /useCreditedOf\(/,
  "features/risks/components/risk-dialog/risk-after-tab.tsx": /<UncreditedBanner\b/,
  "app/services/doc-transform.ts": /docResidualView\(/,
  "app/services/doc-residual.ts": /withCreditedResidual\(/,
};

const STORED = /\.(calculatedRiskAfterMitigation|mitigatedFactorRatings)\b|\.residual\b/g;
// Reads off a credited value, and i18n keys ("tabs.risks.residual.…").
const NEUTRAL = /(creditedOf\([^()]*(\([^()]*\))?[^()]*\)|\bcredited)\.\w+|tabs\.\w+\.residual\b/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");
const readsStored = (f: string) => (fs.readFileSync(f, "utf8").replace(NEUTRAL, "").match(STORED) ?? []).length > 0;
const FILES = walk(SRC);

describe("credited residual — source guard (I7 (4))", () => {
  it("only allow-listed files read the stored after-values", () => {
    const offenders = FILES.filter(readsStored).map(rel).filter((f) => !(f in ALLOW));
    expect(offenders, "read the residual through creditedResidual, or add the file to ALLOW with a reason").toEqual([]);
  });

  it("has no stale allow-list entries", () => {
    const stale = Object.keys(ALLOW).filter((f) => {
      const full = path.join(SRC, f);
      return !fs.existsSync(full) || !readsStored(full);
    });
    expect(stale).toEqual([]);
  });

  it("readers that show a residual use the credited view", () => {
    const missing = Object.entries(CREDITED_READERS)
      .filter(([f, use]) => !use.test(fs.readFileSync(path.join(SRC, f), "utf8")))
      .map(([f]) => f);
    expect(missing).toEqual([]);
  });
});
