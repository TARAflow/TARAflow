// To-do list per element up to the SL-T (iec-62443-4-2-cra-coverage.md IEC-8,
// D-29), on the Pump Station example (SL-T 2 in every FR).
import { describe, it, expect } from "vitest";
import { buildTodoList, EDITION_PRAA_2026, evaluateMatrix, type Edition } from "features/compliance";
import { parseAndRepair } from "app/services/migration-service";
import { complianceTypeOf, evaluateProjectCompliance } from "app/services/compliance-report";
import { buildPumpStationProject } from "../../../../examples/pump-station-example";

const project = parseAndRepair(buildPumpStationProject())!;
const { achieved, planned } = evaluateProjectCompliance(project)!;
const todo = buildTodoList(EDITION_PRAA_2026, achieved, planned, project.compliance!.families!["iec-62443-4-2"]!.target!, complianceTypeOf(project));
const itemsOf = (id: string) => todo.elements.find((e) => e.elementId === id)?.items ?? [];

describe("buildTodoList", () => {
  it("lists the elements that fail a row up to the SL-T, with the properties the rule reads on their type", () => {
    const fieldbus = itemsOf("df-10").find((i) => i.label === "CR 1.2")!;
    expect(fieldbus.kind).toBe("not-met");
    expect(fieldbus.properties).toEqual(["endpoint authentication"]);
    expect(fieldbus.plannedClosed).toBe(false);
  });

  it("marks what the planned mitigations close", () => {
    const engineering = itemsOf("df-7").find((i) => i.label === "CR 4.1")!;
    expect(engineering.plannedClosed).toBe(true);
  });

  it("rows above the SL-T are not listed; open statements are listed apart", () => {
    const labels = todo.elements.flatMap((e) => e.items.map((i) => i.label));
    expect(labels).not.toContain("CR 1.1 RE(2)"); // SL-C 3
    expect(todo.statements.map((s) => s.label)).toEqual(["CR 7.8"]);
  });

  it("the element with most items first", () => {
    const counts = todo.elements.map((e) => e.items.length);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("no target → nothing to do", () => {
    expect(buildTodoList(EDITION_PRAA_2026, achieved, planned, {})).toEqual({ elements: [], component: [], statements: [], risks: [], project: [] });
  });

  it("a row one element meets (any) is a component item, not one per element", () => {
    const edition: Edition = {
      ...EDITION_PRAA_2026,
      rows: [{ label: "CR 3.10", group: "SI", minSl: 1, requirementIds: ["cr-3.10"], supportingMeasuresAllowed: false }],
    };
    const input = {
      edition,
      view: { elements: [{ id: "p1", type: "Process" }, { id: "p2", type: "Process" }], flows: [] },
      scope: new Set(["p1", "p2"]),
    };
    const list = buildTodoList(edition, evaluateMatrix({ ...input, run: "achieved" }), evaluateMatrix({ ...input, run: "planned" }), { SI: 1 });
    expect(list.elements).toEqual([]);
    expect(list.component).toEqual([
      { label: "CR 3.10", group: "SI", properties: ["update mechanism"], elementTypes: ["Process", "Multiprocess"], plannedClosed: false },
    ]);
  });

  it("a black-box multiprocess standing in gets the item 'inside' (D-30) — naming the inside fields that answer it (D-30c)", () => {
    const edition: Edition = {
      ...EDITION_PRAA_2026,
      rows: [{ label: "CR 3.5", group: "SI", minSl: 1, requirementIds: ["cr-3.5"], supportingMeasuresAllowed: false }],
    };
    const input = {
      edition,
      view: { elements: [{ id: "ecu", type: "Multiprocess" }], flows: [], blackBoxes: new Set(["ecu"]) },
      scope: new Set(["ecu"]),
    };
    const list = buildTodoList(
      edition,
      evaluateMatrix({ ...input, run: "achieved" }),
      evaluateMatrix({ ...input, run: "planned" }),
      { SI: 1 },
      () => "Multiprocess",
    );
    expect(list.elements).toEqual([{ elementId: "ecu", items: [{ label: "CR 3.5", group: "SI", kind: "inside", properties: ["inner input validation"], plannedClosed: false }] }]);
  });
});
