// Unresolved i18n keys as stored threat text (0.20 patch 30,
// persisted-threat-text-fix.md): the resolvers never return a key or
// "__MISSING__" any more; loading resolves such stored text again from the
// template's CURRENT domain.
import { beforeAll, describe, expect, it } from "vitest";
import { initI18nNode } from "../../../../../../taraflow-reporter/cli/i18n-node";
import {
  getLocalizedElementThreat,
  getLocalizedInteractionThreat,
} from "features/threats/services/threat-catalog-service";
import {
  isUnresolvedThreatText,
  pendingTranslationText,
  repairThreatDataTexts,
  repairThreatTexts,
} from "features/threats/services/threat-text-repair";
import type { Threat, ThreatData, ThreatTable } from "features/threats/models/threat-types";

beforeAll(async () => {
  await initI18nNode("en");
});

const PLACE = { sourceName: "A", targetName: "B", dataFlowName: "DF-1", trustBoundaryName: "TB" };

describe("resolvers — never a key", () => {
  it("a known template: its text", () => {
    const text = getLocalizedElementThreat("D-009", "interface");
    expect(text.length).toBeGreaterThan(10);
    expect(isUnresolvedThreatText(text)).toBe(false);
  });

  it("a missing template: the detectable placeholder, not the key or __MISSING__", () => {
    expect(getLocalizedElementThreat("Z-999", "interface")).toBe(pendingTranslationText("Z-999", "threat"));
    expect(getLocalizedElementThreat("Z-999")).toBe("[Z-999] (threat text pending translation)");
    expect(getLocalizedInteractionThreat("Z-999", PLACE, "embedded")).toBe(pendingTranslationText("Z-999", "threat"));
  });
});

describe("isUnresolvedThreatText", () => {
  it("keys, the marker and the placeholder — not real text", () => {
    for (const s of ["general.D-009.threat", "interface.S-001.attack", "__MISSING__", "[D-009] (cause text pending translation)"]) {
      expect(isUnresolvedThreatText(s), s).toBe(true);
    }
    for (const s of ["", undefined, "An attacker floods the interface.", "see general.D-009 for details"]) {
      expect(isUnresolvedThreatText(s), String(s)).toBe(false);
    }
  });
});

const elementThreat = (extra: Partial<Threat>): Threat =>
  ({ id: "t1", templateId: undefined, threatDescription: "Own text", attackDescription: "Own attack", causeDescription: "", ...extra }) as unknown as Threat;

describe("repairThreatTexts", () => {
  it("the D-009 case: a stored general.* key healed from the template's current domain (interface)", () => {
    const fixed = repairThreatTexts(elementThreat({ threatDescription: "general.D-009.threat" }), "per-element");
    expect(fixed.threatDescription).toBe(getLocalizedElementThreat("D-009", "interface"));
    // the analyst's own text next to it stays
    expect(fixed.attackDescription).toBe("Own attack");
  });

  it("the templateId wins over the id in the key; __MISSING__ heals with it", () => {
    const fixed = repairThreatTexts(elementThreat({ templateId: "D-009", threatDescription: "__MISSING__" }), "per-element");
    expect(fixed.threatDescription).toBe(getLocalizedElementThreat("D-009", "interface"));
  });

  it("interaction: the placeholders come back from the flow and the table", () => {
    const threat = {
      ...elementThreat({ threatDescription: "general.S-001.threat" }),
      dataFlow: { sourceName: "Sensor", targetName: "Controller", dataFlowId: "DF-4" },
    } as unknown as Threat;
    const fixed = repairThreatTexts(threat, "per-interaction", { trustBoundaryName: "Cabinet" } as ThreatTable);
    expect(isUnresolvedThreatText(fixed.threatDescription)).toBe(false);
  });

  it("still missing: the placeholder (detectable for the next load); clean threats: the same object", () => {
    const fixed = repairThreatTexts(elementThreat({ threatDescription: "general.Z-999.threat" }), "per-element");
    expect(fixed.threatDescription).toBe("[Z-999] (threat text pending translation)");
    const clean = elementThreat({});
    expect(repairThreatTexts(clean, "per-element")).toBe(clean);
    // idempotent: the placeholder repaired again stays the placeholder
    expect(repairThreatTexts(fixed, "per-element")).toBe(fixed);
  });

  it("repairThreatDataTexts: the same object without anything to repair", () => {
    const data = { perElementTables: [{ threats: [elementThreat({})] }], perInteractionTables: [] } as unknown as ThreatData;
    expect(repairThreatDataTexts(data)).toBe(data);
    const broken = { perElementTables: [{ threats: [elementThreat({ threatDescription: "general.D-009.threat" })] }], perInteractionTables: [] } as unknown as ThreatData;
    expect(isUnresolvedThreatText(repairThreatDataTexts(broken).perElementTables[0].threats[0].threatDescription)).toBe(false);
  });
});
