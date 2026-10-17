// Leveled DFDs number hierarchically ("P-1.3" = third process in MP-1,
// leveled-dfd-multi-diagram-design.md §8). Every place that reads an
// element number accepts the dotted form; classic ids keep working.
import { describe, it, expect } from "vitest";
import { isInterfaceThreat } from "features/risks/utils/risk-formatting";
import { groupElementRisks } from "features/risks/services/per-element/element-risk-grouping";
import { signatureOf } from "features/dfd/services/leveled/signatures";
import { DFDAutoNumbering } from "features/dfd/services/dfd-auto-numbering";
import {
  generateThreatIdForInterface,
  generateThreatIdPerElement,
} from "features/threats/models/per-element-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { ThreatReference } from "shared";

describe("hierarchical display ids", () => {
  it("threat ids carry the dotted number", () => {
    expect(generateThreatIdPerElement("P-1.3", "S", 1)).toBe("P1.3-S-1");
    expect(generateThreatIdForInterface("SB", "IF-2.1", "T", 1)).toBe(
      "SB-IF2.1-T-1",
    );
  });

  it("interface threats are recognised with dotted numbers", () => {
    expect(isInterfaceThreat("SB-IF2.1-T-1")).toBe(true);
    expect(isInterfaceThreat("SB-IF2-T-1")).toBe(true);
    expect(isInterfaceThreat("P1.3-S-1")).toBe(false);
  });

  it("risks group under the full element number, not its head", () => {
    const threats = [
      {
        id: "t1",
        trustBoundaryId: "TB-1",
        trustBoundaryName: "CB",
        elementName: "Parent",
      },
      {
        id: "t2",
        trustBoundaryId: "TB-1",
        trustBoundaryName: "CB",
        elementName: "Child",
      },
    ] as unknown as ThreatReference[];
    const risks = [
      { id: "r1", threatId: "t1", threatDisplayId: "P1-S-1" },
      { id: "r2", threatId: "t2", threatDisplayId: "P1.3-S-1" },
    ] as unknown as Risk[];
    const [table] = groupElementRisks(risks, threats);
    expect(table.elements.map((e) => e.elementId).sort()).toEqual([
      "P1",
      "P1.3",
    ]);
  });

  it("a dotted displayId is a real id for adoption signatures", () => {
    const info = {
      kind: "element" as const,
      tfId: "c7",
      type: "Process",
      name: "x",
    };
    expect(signatureOf({ ...info, displayId: "P-1.3" })).toBeDefined();
    expect(signatureOf({ ...info, displayId: "P-1" })).toBeDefined();
    expect(signatureOf({ ...info, displayId: "P-1." })).toBeUndefined();
  });

  it("auto-numbering replaces the whole dotted number in a label", () => {
    const xml =
      `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
      `<object label="A" type="Process" id="p"><mxCell style="ellipse;" vertex="1" parent="1">` +
      `<mxGeometry x="10" y="10" width="80" height="80" as="geometry"/></mxCell></object>` +
      `<object label="&lt;font&gt;P-1.3&lt;/font&gt;" type="idlabel" id="p-lbl">` +
      `<mxCell style="text;" vertex="1" parent="p">` +
      `<mxGeometry width="30" height="20" as="geometry"/></mxCell></object>` +
      `</root></mxGraphModel>`;
    const numbered = new DFDAutoNumbering().autoNumber(xml);
    expect(numbered).toContain('label="&lt;font&gt;P-1&lt;/font&gt;"');
    expect(numbered).not.toContain("P-1.3");
  });
});
