// Loading repairs threat and risk text stored as an unresolved i18n key
// (0.20 patch 30) — the DataTrack case of persisted-threat-text-fix.md:
// threat IF1-D-1 and its risk R-IF1-D-1 showed "general.D-009.threat".
import { beforeAll, describe, expect, it } from "vitest";
import { initI18nNode } from "../../../../../taraflow-reporter/cli/i18n-node";
import { parseAndRepair } from "app/services/migration-service";
import { repairStoredThreatTexts } from "app/services/repair-threat-texts";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { getLocalizedElementThreat } from "features/threats/services/threat-catalog-service";

beforeAll(async () => {
  await initI18nNode("en");
});

const project = (threatText: string, riskText: string) => ({
  id: "P",
  schemaVersion: CURRENT_SCHEMA_VERSION,
  info: { name: "DataTrack", description: "", tags: { domain: [], platform: [], custom: [], regulation: [] }, team: [] },
  currentPhase: 0,
  phaseStatus: {},
  settings: {},
  hazards: null,
  dfd: null,
  assets: null,
  threats: {
    perElementTables: [
      {
        trustBoundaryId: null,
        trustBoundaryName: "TB",
        threats: [{ id: "t-if1-d", displayId: "IF1-D-1", strideCategory: "D", threatDescription: threatText, attackDescription: "Own attack", causeDescription: "", relevance: "relevant" }],
      },
    ],
    perInteractionTables: [],
  },
  risks: { risks: [{ id: "R-IF1-D-1", threatId: "t-if1-d", threatDescription: riskText, attackDescription: "Own attack" }] },
  attackTrees: null,
  documentation: null,
  audit: null,
  integration: null,
});

describe("repair of stored threat / risk text on load", () => {
  it("the threat and its risk get the D-009 text", () => {
    const loaded = parseAndRepair(project("general.D-009.threat", "general.D-009.threat")) as never as {
      threats: { perElementTables: { threats: { threatDescription: string; attackDescription: string }[] }[] };
      risks: { risks: { threatDescription: string; attackDescription: string }[] };
    };
    const expected = getLocalizedElementThreat("D-009", "interface");
    expect(loaded.threats.perElementTables[0].threats[0].threatDescription).toBe(expected);
    expect(loaded.risks.risks[0].threatDescription).toBe(expected);
    expect(loaded.risks.risks[0].attackDescription).toBe("Own attack");
  });

  it("a clean project: the same object (no file change, no snapshot change)", () => {
    const clean = project("Own threat", "Own threat");
    expect(repairStoredThreatTexts(clean)).toBe(clean);
  });
});

describe("no stored fixture holds unresolved threat text (guard, persisted-threat-text-fix.md §3.6)", () => {
  it("every threat and risk text of the project fixtures is real text", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { isUnresolvedThreatText } = await import("features/threats/services/threat-text-repair");
    const dir = join(__dirname, "../../../fixtures");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tara.json"));
    const found: string[] = [];
    for (const file of files) {
      const p = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      const threats = [...(p.threats?.perElementTables ?? []), ...(p.threats?.perInteractionTables ?? [])].flatMap((t: { threats?: unknown[] }) => t.threats ?? []);
      for (const item of [...threats, ...(p.risks?.risks ?? [])] as Record<string, string>[]) {
        for (const f of ["threatDescription", "attackDescription", "causeDescription"]) {
          if (isUnresolvedThreatText(item[f])) found.push(`${file}: ${item.displayId ?? item.id} ${f}`);
        }
      }
    }
    expect(files.length).toBeGreaterThan(3);
    expect(found).toEqual([]);
  });
});
