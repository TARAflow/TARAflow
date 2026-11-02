// src/tests/component/compliance-tab.test.tsx
//
// The Compliance tab (iec-62443-4-2-cra-coverage.md D-9, IEC-8): open rows
// first, the target per FR, a statement that stores the model result of the
// moment (D-17), the device category confirmed before device rows count
// (K-C1).

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceTab, editionStatements, evaluateMatrix, type ComplianceInput, type Edition } from "features/compliance";
import type { ComplianceData } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const edition = (rows: Edition["rows"], id: Edition["id"] = "en-iec-62443-4-2-praa-2026"): Edition => ({
  id,
  title: id === "iec-62443-4-2-2019" ? "IEC 62443-4-2:2019" : "EN IEC 62443-4-2:2019/prAA:2026 (draft)",
  draft: id !== "iec-62443-4-2-2019",
  ccsc2Label: "supporting measures",
  rows,
});

const CRA_ROWS: Edition["rows"] = [
  { label: "CR 3.5", fr: "SI", minSl: 1, requirementIds: ["cr-3.5"], supportingMeasuresAllowed: false, cra: ["h"] },
  { label: "CR 3.7", fr: "SI", minSl: 1, requirementIds: ["cr-3.7"], supportingMeasuresAllowed: false, cra: ["k"] },
];

function renderTab(ed: Edition, data?: ComplianceData, extra: Partial<React.ComponentProps<typeof ComplianceTab>> = {}) {
  const input: ComplianceInput = {
    edition: ed,
    view: { elements: [{ id: "p1", type: "Process", properties: { inputValidation: "none", errorHandling: "sanitized" } }], flows: [] },
    scope: new Set(["p1"]),
    run: "achieved",
    statements: editionStatements(ed, data?.statements),
    deviceCategories: data?.deviceCategories,
  };
  const achieved = evaluateMatrix(input);
  const planned = evaluateMatrix({ ...input, run: "planned" });
  const onChange = vi.fn();
  render(
    <ComplianceTab
      edition={ed}
      achieved={achieved}
      planned={planned}
      data={data}
      componentOptions={[{ id: "p1", label: "P-1 Controller" }]}
      nameOf={(id) => (id === "p1" ? "P-1 Controller" : id)}
      today="2026-11-02"
      onChange={onChange}
      {...extra}
    />,
  );
  return onChange;
}

describe("Compliance tab", () => {
  it("shows the open rows first; 'All' adds the met ones", () => {
    renderTab(edition(CRA_ROWS));
    const rows = screen.getByTestId("compliance-rows");
    expect(within(rows).getByTestId("compliance-row-CR 3.5")).toBeTruthy();
    expect(within(rows).queryByTestId("compliance-row-CR 3.7")).toBeNull();
    expect(within(rows).getByText(/not met by: P-1 Controller/)).toBeTruthy();
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "all" } });
    expect(within(screen.getByTestId("compliance-rows")).getByTestId("compliance-row-CR 3.7")).toBeTruthy();
  });

  it("the filter shows one status at a time, with the count per choice; met includes claimed", () => {
    renderTab(edition(CRA_ROWS));
    const shown = () => within(screen.getByTestId("compliance-rows")).queryAllByTestId(/^compliance-row-/).map((r) => r.dataset.testid);
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "met" } });
    expect(shown()).toEqual(["compliance-row-CR 3.7"]);
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "gap" } });
    expect(shown()).toEqual(["compliance-row-CR 3.5"]);
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "unknown" } });
    expect(shown()).toEqual([]);
    expect(screen.getByText("No requirements with this status.")).toBeTruthy();
    fireEvent.mouseDown(within(screen.getByTestId("compliance-filter").parentElement!).getByRole("combobox"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual([
      "All (2)", "Open (1)", "Gap (1)", "Statement needed (0)", "Unknown (0)", "Not applicable (0)", "Met (incl. claimed) (1)",
    ]);
  });

  it("SL table (D-26): FRs as columns; the SL-C against the SL-T by colour and symbol; a target per FR", () => {
    const onChange = renderTab(edition(CRA_ROWS), { target: { SI: 2 } });
    const vector = screen.getByTestId("compliance-vector");
    expect(within(vector).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "IAC", "UC", "SI", "DC", "RDF", "TRE", "RA"]);
    const product = screen.getByTestId("compliance-vector-slcProduct");
    expect(within(product).getByText("0 ✗").closest("[data-level]")!.getAttribute("data-level")).toBe("below");
    expect(within(screen.getByTestId("compliance-vector-withSystem")).queryByText(/✗|✓/)).toBeNull();
    fireEvent.change(screen.getByTestId("compliance-target-SI"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith({ target: { SI: 3 } });
  });

  it("'all FR' sets the SL-T of every FR at once, and clears it", () => {
    const onChange = renderTab(edition(CRA_ROWS));
    fireEvent.change(screen.getByTestId("compliance-target-all"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith({ target: { IAC: 3, UC: 3, SI: 3, DC: 3, RDF: 3, TRE: 3, RA: 3 } });
    fireEvent.change(screen.getByTestId("compliance-target-all"), { target: { value: "-" } });
    expect(onChange).toHaveBeenLastCalledWith({ target: {} });
  });

  it("a statement stores the model result of the moment and the date (D-17)", () => {
    const onChange = renderTab(edition(CRA_ROWS));
    fireEvent.click(screen.getByTestId("compliance-statement-CR 3.5"));
    fireEvent.change(screen.getByTestId("statement-reasoning"), { target: { value: "Validated by the protocol stack" } });
    fireEvent.click(screen.getByTestId("statement-save"));
    expect(onChange).toHaveBeenLastCalledWith({
      // Stored per requirement (D-31) — the classic edition shows it too.
      statements: {
        "cr-3.5": { status: "met", reasoning: "Validated by the protocol stack", modelStatusAtStatement: "gap", date: "2026-11-02" },
      },
    });
  });

  it("a statement needs a reasoning", () => {
    renderTab(edition(CRA_ROWS));
    fireEvent.click(screen.getByTestId("compliance-statement-CR 3.5"));
    expect((screen.getByTestId("statement-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("2019 edition: a derived device category is a proposal to confirm (K-C1)", () => {
    const rows: Edition["rows"] = [
      { label: "EDR 3.10", fr: "SI", minSl: 1, requirementIds: ["cr-3.10"], supportingMeasuresAllowed: false, deviceCategories: ["EDR"] },
    ];
    const onChange = renderTab(edition(rows, "iec-62443-4-2-2019"), undefined, {
      deviceProposal: { categories: ["EDR"], reason: "system-class" },
    });
    const box = screen.getByTestId("compliance-device-categories");
    expect(within(box).getByText(/Proposal from the model: EDR/)).toBeTruthy();
    expect(within(screen.getByTestId("compliance-rows")).getByText("confirm category")).toBeTruthy();
    fireEvent.click(within(box).getByText("Confirm"));
    expect(onChange).toHaveBeenLastCalledWith({ deviceCategories: { categories: ["EDR"], source: "manual" } });
  });

  it("choosing the component (D-7)", () => {
    const onChange = renderTab(edition(CRA_ROWS));
    fireEvent.change(screen.getByTestId("compliance-component"), { target: { value: "p1" } });
    expect(onChange).toHaveBeenLastCalledWith({ componentId: "p1" });
  });

  it("hovering the requirement number shows the compact tooltip: title and our own summary (D-27)", async () => {
    renderTab(edition(CRA_ROWS));
    fireEvent.mouseOver(screen.getByTestId("compliance-req-CR 3.5"));
    const tip = await screen.findByTestId("compliance-tooltip-CR 3.5");
    expect(within(tip).getByText("CR 3.5 – Input validation")).toBeTruthy();
    expect(within(tip).getByText("Security-relevant input from external interfaces is validated.")).toBeTruthy();
    expect(within(tip).queryByText(/How TARAflow checks it/)).toBeNull();
  });

  it("a click opens the info dialog with everything; its statement button closes it first, then opens the statement dialog", () => {
    const asked: (readonly string[])[] = [];
    renderTab(edition(CRA_ROWS), undefined, {
      mitigationSuggestions: (ids, openElementIds) => {
        asked.push(openElementIds);
        return ids.includes("cr-3.5") ? [{ id: "M-T-004", text: "Implement input validation" }] : [];
      },
    });
    fireEvent.click(screen.getByTestId("compliance-req-CR 3.5"));
    const dialog = screen.getByTestId("compliance-info-dialog");
    expect(within(dialog).getByText("CR 3.5 – Input validation")).toBeTruthy();
    expect(within(dialog).getByText(/Checked in the model: every Process: input validation = strict \/ schema/)).toBeTruthy();
    expect(within(dialog).getByText(/not met by: P-1 Controller/)).toBeTruthy();
    expect(within(dialog).getByText("M-T-004")).toBeTruthy();
    // D-29: the suggestions are asked for the elements still open
    expect(asked.at(-1)).toEqual(["p1"]);
    expect(within(dialog).getByText("Summary in our own words — the standard is authoritative.")).toBeTruthy();

    fireEvent.click(within(dialog).getByTestId("compliance-info-statement"));
    expect(screen.queryByTestId("compliance-info-dialog")).toBeNull();
    expect(screen.getByTestId("statement-reasoning")).toBeTruthy();
  });

  it("the quick guide is open the first time, collapsed from then on; it can be opened", () => {
    localStorage.removeItem("taraflow.compliance.guideSeen");
    const expanded = () => within(screen.getByTestId("compliance-guide")).getByRole("button").getAttribute("aria-expanded");
    renderTab(edition(CRA_ROWS));
    expect(expanded()).toBe("true");
    expect(within(screen.getByTestId("compliance-guide")).getByText(/Set the SL-T per foundational requirement/)).toBeTruthy();
    cleanup();
    renderTab(edition(CRA_ROWS));
    expect(expanded()).toBe("false");
    fireEvent.click(within(screen.getByTestId("compliance-guide")).getByRole("button"));
    expect(expanded()).toBe("true");
  });

  it("without an SL-T the to-do list asks for it first", () => {
    renderTab(edition(CRA_ROWS));
    expect(within(screen.getByTestId("compliance-todo")).getByText(/Set the SL-T above/)).toBeTruthy();
  });

  it("with an SL-T the to-do list names the element, the row and the property; the row opens the info dialog", () => {
    renderTab(edition(CRA_ROWS), { target: { SI: 1 } }, { typeOf: (id) => (id === "p1" ? "Process" : undefined) });
    const entry = screen.getByTestId("compliance-todo-p1");
    expect(within(entry).getByText("P-1 Controller")).toBeTruthy();
    expect(within(entry).getByText(/not met, check: input validation/)).toBeTruthy();
    fireEvent.click(within(entry).getByText("CR 3.5"));
    expect(within(screen.getByTestId("compliance-info-dialog")).getByText("CR 3.5 – Input validation")).toBeTruthy();
  });

  it("the element of a to-do entry links to the diagram", () => {
    const onShowElement = vi.fn();
    renderTab(edition(CRA_ROWS), { target: { SI: 1 } }, { onShowElement });
    fireEvent.click(screen.getByTestId("compliance-todo-link-p1"));
    expect(onShowElement).toHaveBeenCalledWith("p1");
  });

  it("without the callback the element is plain text", () => {
    renderTab(edition(CRA_ROWS), { target: { SI: 1 } });
    expect(screen.queryByTestId("compliance-todo-link-p1")).toBeNull();
    expect(within(screen.getByTestId("compliance-todo-p1")).getByText("P-1 Controller")).toBeTruthy();
  });
});
