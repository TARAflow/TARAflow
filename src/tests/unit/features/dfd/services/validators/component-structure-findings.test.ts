// src/tests/unit/features/dfd/services/validators/component-structure-findings.test.ts
//
// Manual test 2026-11-17: "Interface SDC1:IF-2 is not crossed by any data
// flow" and "SDC1:DS-2 unconnected" in the machine — structure findings on
// an imported component's own elements, which the machine cannot edit. The
// machine leaves them out; its own elements, the multiprocess and the
// external entities keep theirs.

import { describe, expect, it } from "vitest";
import type { DFDElement } from "features/dfd/models/dfd-types";
import { dfdValidator } from "features/dfd/services/dfd-validator";
import { DefaultDFDGraphBuilder } from "features/dfd/services/dfd-graph-builder";
import { withoutComponentStructureFindings } from "features/dfd/services/validators/component-structure-findings";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";

const el = (id: string, type: string, displayId: string, x: number, name = displayId): DFDElement =>
  ({ id, type, displayId, name, position: { x, y: 0 }, size: { width: 40, height: 40 }, properties: {}, description: "d" }) as unknown as DFDElement;

const CMP_IF = "cmpaaaaaaaaaaaa";
const CMP_DS = "cmpbbbbbbbbbbbb";
const CMP_MP = "cmpcccccccccccc";
const elements = [
  el("if-m", "Interface", "IF-1", 0),
  el(CMP_IF, "Interface", "SDC1:IF-2", 100),
  el("ds-m", "DataStore", "DS-1", 200),
  el(CMP_DS, "DataStore", "SDC1:DS-2", 300),
  el(CMP_MP, "Multiprocess", "MP-1", 400),
];

const keysOf = (findings: { key: string; displayId?: string }[], key: string) =>
  findings.filter((f) => f.key === key).map((f) => f.displayId);

describe("structure findings on a component's elements", () => {
  it("through the validator: the machine's own interface / data store keep theirs, the component's are left out", () => {
    const graph = new DefaultDFDGraphBuilder().build({ elements, connections: [], assets: [] });
    const stats = { totalElements: elements.length, externalEntities: 0, processes: 0, multiprocesses: 1, dataStores: 2, dataFlows: 0, trustBoundaries: 0, chipBoundaries: 0, physicalBoundaries: 0, interfaces: 2, sensors: 0, actuators: 0, assets: 0 } as never;
    const r = dfdValidator.validate(elements, [], [], stats, graph);
    expect(keysOf(r.warnings, ValidationMessages.INTERFACE_UNUSED)).toEqual(["IF-1"]);
    expect(keysOf(r.warnings, ValidationMessages.UNCONNECTED_ELEMENT)).toEqual(expect.arrayContaining(["DS-1", "MP-1"]));
    expect(keysOf(r.warnings, ValidationMessages.UNCONNECTED_ELEMENT)).not.toContain("SDC1:DS-2");
  });

  it("only the structure keys, and not for the multiprocess or an external entity", () => {
    const findings = [
      { key: ValidationMessages.ELEMENT_DEFAULT_NAME, elementId: CMP_DS, displayId: "SDC1:DS-2" },
      { key: ValidationMessages.ELEMENT_DEFAULT_NAME, elementId: CMP_MP, displayId: "MP-1" },
      { key: "tabs.dfd.validation.element.missingProperty", elementId: CMP_DS, displayId: "SDC1:DS-2" },
    ];
    expect(withoutComponentStructureFindings(findings, elements).map((f) => f.displayId)).toEqual(["MP-1", "SDC1:DS-2"]);
  });
});
