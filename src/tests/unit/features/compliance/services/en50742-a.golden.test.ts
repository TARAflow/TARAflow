// EN 50742 A golden check (model coverage plan §8.1, CM-12) on an own
// example — the SmokeDetector fixture with the tag "EN 50742 A", never
// customer data. The test sets the EN data itself (WoO, system definition,
// one risk on the WLAN interface IF-7, EL3): a mandated control done meets
// its clause rows, an open one is a gap that the planned run closes; an
// unset WoO or an unrated risk leaves the rows unknown, never met.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { buildEn50742View } from "app/utils/build-en50742-view";
import { activeStandards, EDITION_EN50742_A } from "features/compliance";
import type { Project } from "app/models/project-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const base: Any = parseAndRepair(JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")))!;
const threats: Any[] = base.threats.perElementTables.flatMap((t: Any) => t.threats);
const onWlan = (stride: string) => threats.find((t) => t.linkedElement?.elementId === "IF-3" && t.strideCategory === stride)!;
const firmware = base.assets.assets.find((a: Any) => a.name === "controller firmware");

/** A risk on the WLAN interface (EL3) linked to the firmware safety asset. */
function wlanRisk(stride: string, srsl: string | null, mitigations: { id: string; status: string }[] = []): Any {
  const threat = onWlan(stride);
  return {
    ...base.risks.risks[0],
    id: `R-${threat.id}`,
    threatId: threat.id,
    threatDisplayId: threat.id,
    strideCategory: stride,
    linkedAssetIds: [firmware.id],
    factorRatings: [{ factorId: "exposure_level", value: 4, weight: 1, source: "derived" }],
    calculatedSrsl: srsl,
    selectedMitigations: mitigations,
    treatment: "reduce",
    moscowPriority: "must",
    wontJustification: "",
  };
}

function project(risks: Any[], extra: Partial<Any> = {}): Project {
  return {
    ...base,
    info: { ...base.info, tags: { ...base.info.tags, regulation: ["EN 50742 A"] }, windowOfOpportunity: "limited" },
    itemDefinition: { sections: { boundary: { text: "Smoke detector with WLAN" }, environment: { text: "Office building" } }, functions: [], assumptions: [] },
    risks: { ...base.risks, risks },
    ...extra,
  };
}

function evaluate(p: Project) {
  const standard = activeStandards(p.info.tags).find((s) => s.id === "en-50742-a")!;
  expect(standard).toBeTruthy();
  return prepareProjectCompliance(p)!.evaluate(standard.edition);
}

const row = (rows: Any[], label: string) => rows.find((r: Any) => r.label === label)!;
const AUTH = "EN-7.4.3.2.1/356–360";
const INTEGRITY = "EN-7.4.3.4.1/380–386";

describe("EN 50742 A on the SmokeDetector (own example)", () => {
  it("the view: the WLAN risk with SRSL 2, exposed, Interface × S mandates authentication", () => {
    const view = buildEn50742View(project([wlanRisk("S", "SRSL2")]));
    expect(view.risks).toHaveLength(1);
    expect(view.risks[0]).toMatchObject({ anchorId: "IF-3", srsl: 2, exposed: true, mandated: ["7.4.3.2.1"], safetyFunctionIds: [firmware.id] });
    expect(view.safetyFunctions.map((s) => s.name)).toContain("controller firmware");
    expect(view.interfaces.exposed).toContain("IF-3");
  });

  it("mandated control done → the clause row is met; the header shows SRSL 2 for the firmware", () => {
    const { achieved } = evaluate(project([wlanRisk("S", "SRSL2", [{ id: "en50742-7.4.3.2.1", status: "verified" }])]));
    expect(row(achieved.rows, AUTH)).toMatchObject({ status: "met", source: "model" });
    expect(achieved.srsl?.safetyFunctions.find((s) => s.id === firmware.id)?.srsl).toBe(2);
    expect(achieved.srsl?.windowOfOpportunity).toBe("limited");
  });

  it("chosen but open → gap now, met in the planned run", () => {
    const { achieved, planned } = evaluate(project([wlanRisk("S", "SRSL2", [{ id: "en50742-7.4.3.2.1", status: "open" }])]));
    expect(row(achieved.rows, AUTH)).toMatchObject({ status: "gap", risks: [`R-${onWlan("S").id}`] });
    expect(row(planned.rows, AUTH).status).toBe("met");
  });

  it("Interface × T: one integrity control meets the integrity rows; 7.4.3.5.1 applies at SRSL 2", () => {
    const { achieved } = evaluate(project([wlanRisk("T", "SRSL2", [{ id: "en50742-7.4.3.4.2", status: "implemented" }])]));
    expect(row(achieved.rows, INTEGRITY).status).toBe("met");
    expect(row(achieved.rows, "EN-7.4.3.1/347–349").status).toBe("met");
    expect(row(achieved.rows, "EN-7.4.3.5.1/438–441").status).not.toBe("n/a");
  });

  it("an unrated risk leaves the rows unknown — never met", () => {
    const { achieved } = evaluate(project([wlanRisk("S", null)]));
    for (const label of [AUTH, "EN-7.4.3.5.1/438–441", "EN-4.3/229"]) {
      expect(row(achieved.rows, label).status, label).toBe("unknown");
    }
    // The other safety functions of the fixture have no risk at all — a clear gap.
    const complete = row(achieved.rows, "EN-7.4.2/334");
    expect(complete.status).toBe("gap");
    expect(complete.reasoning).toContain("smoke meas data");
  });

  it("WoO unset → the security context row is unknown, never met", () => {
    const p = project([wlanRisk("S", "SRSL2")]);
    const { achieved } = evaluate({ ...p, info: { ...p.info, windowOfOpportunity: undefined } } as Project);
    expect(row(achieved.rows, "EN-4.3/220").status).toBe("unknown");
    const set = evaluate(p).achieved;
    expect(row(set.rows, "EN-4.3/220").status).toBe("met");
  });

  it("the fixture's other exposed interfaces have no SRSL risk → 7.1 is a gap naming them", () => {
    const r = row(evaluate(project([wlanRisk("S", "SRSL2")])).achieved.rows, "EN-7.1/260");
    expect(r.status).toBe("gap");
    expect(r.failing).not.toContain("IF-3");
    expect(r.failing.length).toBeGreaterThan(0);
  });
});
