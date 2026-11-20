// EN 50742 B in the Compliance tab (0.20 patch 14): the SL-T is fixed by
// Table 4 (read only), recommended rows are marked, a statement on a Table 4
// row is stored in the IEC 62443-4-2 family it shares with the 62443 matrix
// (K-6), one on an EN row in the EN 50742 family.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceTab, editionStatements, evaluateMatrix, type ComplianceInput, type Edition } from "features/compliance";
import { familyCompliance, type ComplianceData } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
afterEach(cleanup);

const B: Edition = {
  id: "en-50742-b",
  family: "en-50742",
  title: "prEN 50742:2025 Approach B (draft)",
  draft: true,
  ccsc2Label: "countermeasures of the machinery system",
  groups: ["process", "SI"] as never,
  rows: [
    { label: "EN-6/257", group: "process" as never, minSl: null, requirementIds: ["en-6-257" as never], supportingMeasuresAllowed: false },
    { label: "CR 3.5", group: "SI", minSl: 1, requirementIds: ["cr-3.5"], supportingMeasuresAllowed: false, family: "iec-62443-4-2" },
    {
      label: "HDR 3.14", group: "SI", minSl: 1, requirementIds: ["cr-3.14"], supportingMeasuresAllowed: false, family: "iec-62443-4-2",
      deviceCategories: ["HDR"], recommended: "recommended by analogy",
    },
  ],
  fixedSlTarget: { IAC: 2, UC: 2, SI: 2, DC: 0, RDF: 1, TRE: 1, RA: 2 },
};

function renderTab(data?: ComplianceData) {
  const input: ComplianceInput = {
    edition: B,
    view: { elements: [{ id: "p1", type: "Process", properties: {} }], flows: [] },
    scope: new Set(["p1"]),
    run: "achieved",
    statements: editionStatements(B, familyCompliance(data, B.family).statements, (f) => familyCompliance(data, f).statements),
    deviceCategories: { categories: ["HDR"], source: "manual" },
  };
  const onChange = vi.fn();
  render(
    <ComplianceTab
      edition={B}
      header="security-levels"
      achieved={evaluateMatrix(input)}
      planned={evaluateMatrix({ ...input, run: "planned" })}
      data={data}
      componentOptions={[]}
      nameOf={(id) => id}
      today="2026-11-20"
      onChange={onChange}
    />,
  );
  return onChange;
}

describe("ComplianceTab — EN 50742 B", () => {
  it("the SL-T is fixed by the standard: shown, not editable", () => {
    renderTab();
    expect(screen.getByTestId("compliance-target-fixed-SI").textContent).toBe("2");
    expect(screen.getByTestId("compliance-target-fixed-RDF").textContent).toBe("1");
    expect(screen.queryByTestId("compliance-target-all")).toBeNull();
    expect(screen.queryByTestId("compliance-target-SI")).toBeNull();
  });

  it("a recommended row is marked", () => {
    renderTab();
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "all" } });
    expect(screen.getByTestId("compliance-recommended-HDR 3.14")).toBeTruthy();
    expect(screen.queryByTestId("compliance-recommended-CR 3.5")).toBeNull();
  });

  it("a statement on a Table 4 row goes to the IEC 62443-4-2 family, one on an EN row to EN 50742", () => {
    const onChange = renderTab();
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "all" } });
    fireEvent.click(screen.getByTestId("compliance-statement-CR 3.5"));
    fireEvent.change(screen.getByTestId("statement-reasoning"), { target: { value: "Validated" } });
    fireEvent.click(screen.getByTestId("statement-save"));
    const first = onChange.mock.calls.at(-1)![0] as ComplianceData;
    expect(Object.keys(first.families?.["iec-62443-4-2"]?.statements ?? {})).toEqual(["cr-3.5"]);
    expect(first.families?.["en-50742"]).toBeUndefined();

    fireEvent.click(screen.getByTestId("compliance-statement-EN-6/257"));
    fireEvent.change(screen.getByTestId("statement-reasoning"), { target: { value: "IEC 62443-4-1 certified" } });
    fireEvent.click(screen.getByTestId("statement-save"));
    const second = onChange.mock.calls.at(-1)![0] as ComplianceData;
    expect(Object.keys(second.families?.["en-50742"]?.statements ?? {})).toEqual(["en-6-257"]);
  });
});
