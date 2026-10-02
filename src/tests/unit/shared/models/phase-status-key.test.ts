// Phase status slots. The feature services wrote hard-coded slot numbers that
// drifted when Hazard was inserted at 1 and the attack tree moved before the
// risks: the DFD status landed in the Hazard slot, Assets in DFD, Risk in
// Threats — and every threat update replaced the whole map with `[]`.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PHASES, PHASE_STATUS_KEY } from "shared";
import type { PhaseStatusMap } from "shared";
import { PhaseId } from "app/models/phase-types";
import { assetService } from "features/assets/services/asset-service";
import { riskService } from "features/risks/services/risk-service";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import { createDefaultRiskData } from "features/risks/models/risk-assessment-types";
import {
  threatPhaseStatus,
  withThreatPhaseStatus,
} from "features/threats/services/threat-phase-status";

const MAP: PhaseStatusMap = {
  0: "complete", 1: "complete", 2: "complete", 3: "complete", 4: "complete",
  5: "complete", 6: "complete", 7: "complete", 8: "complete", 9: "complete",
};

describe("PHASE_STATUS_KEY", () => {
  it("equals PhaseId and the PHASES ids", () => {
    expect(PHASE_STATUS_KEY).toEqual({
      general: PhaseId.General,
      hazard: PhaseId.Hazard,
      dfd: PhaseId.DFD,
      assets: PhaseId.Assets,
      threats: PhaseId.Threats,
      attackTree: PhaseId.AttackTree,
      risk: PhaseId.Risk,
      documentation: PhaseId.Documentation,
      audit: PhaseId.Audit,
      integration: PhaseId.Integration,
    });
    const byLabel = Object.fromEntries(PHASES.map((p) => [p.label, p.id]));
    expect(byLabel.DFD).toBe(PHASE_STATUS_KEY.dfd);
    expect(byLabel.Assets).toBe(PHASE_STATUS_KEY.assets);
    expect(byLabel.Risk).toBe(PHASE_STATUS_KEY.risk);
  });
});

describe("feature services write their own slot only", () => {
  it("assets → slot 3 (was 2 = DFD)", () => {
    const r = assetService.saveAssets({ phaseStatus: MAP } as never, createDefaultAssetData());
    expect(r.phaseStatus[PHASE_STATUS_KEY.dfd]).toBe("complete");
    expect(r.phaseStatus[PHASE_STATUS_KEY.assets]).not.toBe("complete");
  });

  it("risks → slot 6 (was 4 = Threats)", () => {
    const r = riskService.saveRiskData({ phaseStatus: MAP } as never, createDefaultRiskData());
    expect(r.phaseStatus[PHASE_STATUS_KEY.threats]).toBe("complete");
    expect(r.phaseStatus[PHASE_STATUS_KEY.risk]).toBe("not-started");
  });

  it("threats → slot 4, the rest of the map stays (was `[]`)", () => {
    const next = withThreatPhaseStatus(MAP, null);
    expect(Array.isArray(next)).toBe(false);
    expect(next).toEqual({ ...MAP, 4: "not-started" });
  });

  it("no feature source writes a numeric phase slot", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f)) {
          const s = readFileSync(p, "utf-8");
          if (/\.\.\.\s*\w+(\?)?\.phaseStatus,\s*\n?\s*\d+\s*:/.test(s) || /phaseStatus:\s*\[\]/.test(s)) {
            offenders.push(p);
          }
        }
      }
    };
    walk("src/features");
    expect(offenders).toEqual([]);
  });
});

describe("threatPhaseStatus", () => {
  const data = (relevance: string[]) =>
    ({
      perElementTables: [{ threats: relevance.map((r) => ({ relevance: r })) }],
      perInteractionTables: [],
    }) as never;
  it("none → not-started, unrated → in-progress, all rated → complete", () => {
    expect(threatPhaseStatus(data([]))).toBe("not-started");
    expect(threatPhaseStatus(data(["relevant", "unrated"]))).toBe("in-progress");
    expect(threatPhaseStatus(data(["relevant", "not_relevant"]))).toBe("complete");
  });
});
