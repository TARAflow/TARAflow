// Leveled-DFD Phase 4b (leveled-dfd-multi-diagram-design.md §6.4, D2, D10):
// `refines` and `abstract` on flows — validity, balancing, exclusion.
import { describe, it, expect } from "vitest";
import {
  buildAnalysisView,
  buildDfdGraph,
  effectiveModelOf,
} from "features/dfd/services/build-dfd-graph";
import type {
  DFDConnection,
  DFDPage,
  ValidationFinding,
} from "features/dfd/models/dfd-types";

const shape = (type: string, id: string, y: number, label = id) =>
  `<object label="${label}" type="${type}" id="${id}">` +
  `<mxCell style="ellipse;" vertex="1" parent="1">` +
  `<mxGeometry x="100" y="${y}" width="80" height="80" as="geometry"/></mxCell></object>`;
const flow = (id: string, from: string, to: string, label = id) =>
  `<object label="${label}" type="DataFlow" id="${id}">` +
  `<mxCell style="endArrow=classic;" edge="1" parent="1" source="${from}" target="${to}">` +
  `<mxGeometry relative="1" as="geometry"/></mxCell></object>`;
const page = (id: string, name: string, cells: string) =>
  `<diagram id="${id}" name="${name}"><mxGraphModel><root>` +
  `<mxCell id="0"/><mxCell id="1" parent="0"/>${cells}` +
  `</root></mxGraphModel></diagram>`;

// Top:  EE e  --f1-->  MP m
// m:    copy of e, processes p and q; f1 drawn e -> p (copy);
//       f2 e -> q (new channel), f3 q -> e (wrong direction)
const xml =
  `<mxfile>` +
  page(
    "top",
    "Top",
    shape("ExternalEntity", "e", 10) +
      shape("Multiprocess", "m", 200) +
      flow("f1", "e", "m"),
  ) +
  page(
    "pm",
    "m",
    shape("ExternalEntity", "pm_e", 10, "e") +
      shape("Process", "p", 100) +
      shape("Process", "q", 200) +
      flow("pm_f1", "pm_e", "p", "f1") +
      flow("f2", "pm_e", "q") +
      flow("f3", "q", "pm_e"),
  ) +
  `</mxfile>`;
const pages: DFDPage[] = [
  { pageId: "top", name: "Top", order: 0 },
  {
    pageId: "pm",
    name: "m",
    order: 0,
    decomposes: "m",
    links: [
      { cellId: "pm_e", tfId: "e", role: "ref" },
      { cellId: "pm_f1", tfId: "f1", role: "ref" },
    ],
  },
];

/** Flow records carrying the given properties (the rest is parsed). */
const withProps = (props: Record<string, Record<string, unknown>>) =>
  Object.entries(props).map(
    ([id, properties]) => ({ id, properties }) as unknown as DFDConnection,
  );

const source = (props: Record<string, Record<string, unknown>> = {}) => ({
  xml,
  pages,
  elements: [],
  connections: withProps(props),
  assets: [],
});
const flowOf = (props: Record<string, Record<string, unknown>>, id: string) =>
  effectiveModelOf(source(props)).model.flows.find((f) => f.tfId === id)!;
const findings = (props: Record<string, Record<string, unknown>> = {}) => {
  const f = buildAnalysisView(source(props)).leveledFindings!;
  const codes = (l: ValidationFinding[]) =>
    l.map(
      (x) => `${x.key.replace("dfdValidation.leveled.", "")}:${x.elementId}`,
    );
  return {
    errors: codes(f.errors),
    warnings: codes(f.warnings),
    infos: codes(f.infos),
  };
};

describe("refines (§6.4)", () => {
  it("without refines, f2 and f3 cross m's border unbalanced", () => {
    expect(findings().warnings.sort()).toEqual([
      "BAL_MISSING_PARENT_FLOW:f2",
      "BAL_MISSING_PARENT_FLOW:f3",
    ]);
  });

  it("a compatible refinement is valid and balances the parent", () => {
    expect(flowOf({ f2: { refines: "f1" } }, "f2").refines).toEqual({
      target: "f1",
      valid: true,
    });
    expect(findings({ f2: { refines: "f1" } }).warnings).toEqual([
      "BAL_MISSING_PARENT_FLOW:f3",
    ]);
  });

  it("both flows keep their threats (different channels)", () => {
    const graph = buildDfdGraph(source({ f2: { refines: "f1" } }));
    expect([...graph.connectionsById.keys()].sort()).toEqual([
      "f1",
      "f2",
      "f3",
    ]);
  });

  it("wrong direction is incompatible and does not balance", () => {
    const result = findings({ f3: { refines: "f1" } });
    expect(result.warnings.sort()).toEqual([
      "BAL_MISSING_PARENT_FLOW:f2",
      "BAL_MISSING_PARENT_FLOW:f3",
      "BAL_REFINES_INCOMPATIBLE:f3",
    ]);
    expect(flowOf({ f3: { refines: "f1" } }, "f3").refines).toEqual({
      target: "f1",
      valid: false,
    });
  });

  it("a missing target is an error and does not balance", () => {
    const result = findings({ f2: { refines: "nope" } });
    expect(result.errors).toEqual(["BAL_REFINES_TARGET_MISSING:f2"]);
    expect(result.warnings).toContain("BAL_MISSING_PARENT_FLOW:f2");
  });

  it("a cycle is an error for every flow on it", () => {
    const result = findings({
      f2: { refines: "f3" },
      f3: { refines: "f2" },
    });
    expect(result.errors.sort()).toEqual([
      "BAL_REFINES_CYCLE:f2",
      "BAL_REFINES_CYCLE:f3",
    ]);
    expect(findings({ f2: { refines: "f2" } }).errors).toEqual([
      "BAL_REFINES_CYCLE:f2",
    ]);
  });
});

describe("abstract (§6.4)", () => {
  it("with a valid refinement the abstract flow is excluded, the refinement stays", () => {
    const props = { f1: { abstract: true }, f2: { refines: "f1" } };
    expect(flowOf(props, "f1")).toMatchObject({
      state: "excluded",
      excludedReason: "abstract",
    });
    expect(
      [...buildDfdGraph(source(props)).connectionsById.keys()].sort(),
    ).toEqual(["f2", "f3"]);
    expect(findings(props).warnings).not.toContain(
      "BAL_ABSTRACT_WITHOUT_REFINEMENT:f1",
    );
  });

  it("without a valid refinement it keeps its threats and warns (D10)", () => {
    const cases: Record<string, Record<string, unknown>>[] = [
      { f1: { abstract: true } },
      { f1: { abstract: true }, f3: { refines: "f1" } }, // incompatible
    ];
    for (const props of cases) {
      expect(flowOf(props, "f1").state).not.toBe("excluded");
      expect(findings(props).warnings).toContain(
        "BAL_ABSTRACT_WITHOUT_REFINEMENT:f1",
      );
      expect([
        ...buildDfdGraph(source(props)).connectionsById.keys(),
      ]).toContain("f1");
    }
  });
});

describe("refinementCandidatesOf", () => {
  it("lists the flows of a leveled DFD in natural id order", async () => {
    const { refinementCandidatesOf } =
      await import("features/dfd/utils/refinement-candidates");
    const connections = [
      { id: "a", displayId: "DF-10", name: "x" },
      { id: "b", displayId: "DF-2", name: "y" },
      { id: "c", displayId: "DF-1.2", name: "z" },
    ] as unknown as DFDConnection[];
    expect(
      refinementCandidatesOf({ xml, connections })!.map((c) => c.label),
    ).toEqual(["DF-1.2 z", "DF-2 y", "DF-10 x"]);
    const single = `<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>`;
    expect(
      refinementCandidatesOf({ xml: single, connections }),
    ).toBeUndefined();
    expect(refinementCandidatesOf(null)).toBeUndefined();
  });
});
