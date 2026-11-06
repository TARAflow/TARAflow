// src/tests/component/compliance-tab.test.tsx
//
// The Compliance tab (iec-62443-4-2-cra-coverage.md D-9, IEC-8): open rows
// first, the target per FR, a statement that stores the model result of the
// moment (D-17), the device category confirmed before device rows count
// (K-C1).

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ComplianceTab,
  editionStatements,
  evaluateMatrix,
  FOUNDATIONAL_REQUIREMENTS,
  EDITION_2019,
  EDITION_PRAA_2026,
  type ComplianceInput,
  type Edition,
} from "features/compliance";
import { VOID_REASONS } from "features/compliance/components/compliance-tab";
import { familyCompliance, type ComplianceData, type FamilyComplianceData } from "shared";

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
  family: "iec-62443-4-2",
  title: id === "iec-62443-4-2-2019" ? "IEC 62443-4-2:2019" : "EN IEC 62443-4-2:2019/prAA:2026 (draft)",
  draft: id !== "iec-62443-4-2-2019",
  ccsc2Label: "supporting measures",
  groups: FOUNDATIONAL_REQUIREMENTS,
  rows,
});

/** The tab stores its data in the block of its family (schema 13, K-2). */
const fam = (data: FamilyComplianceData): ComplianceData => ({ families: { "iec-62443-4-2": data } });

const CRA_ROWS: Edition["rows"] = [
  { label: "CR 3.5", group: "SI", minSl: 1, requirementIds: ["cr-3.5"], supportingMeasuresAllowed: false, cra: ["h"] },
  { label: "CR 3.7", group: "SI", minSl: 1, requirementIds: ["cr-3.7"], supportingMeasuresAllowed: false, cra: ["k"] },
];

function renderTab(ed: Edition, data?: ComplianceData, extra: Partial<React.ComponentProps<typeof ComplianceTab>> = {}) {
  const input: ComplianceInput = {
    edition: ed,
    view: { elements: [{ id: "p1", type: "Process", properties: { inputValidation: "none", errorHandling: "sanitized" } }], flows: [] },
    scope: new Set(["p1"]),
    run: "achieved",
    statements: editionStatements(ed, familyCompliance(data, ed.family).statements),
    deviceCategories: familyCompliance(data, ed.family).deviceCategories,
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

describe("claims in the info dialog (D-5, IEC-6)", () => {
  const supporting = {
    id: "c1", displayId: "CLM-04", statement: "Plant firewall filters the traffic", kind: "supporting" as const,
    riskIds: [], assumptionIds: [], requirements: ["iec62443:cr-3.7"],
  };

  it("a new claim covers the row's requirements, qualified by family; numbered after the existing claims", () => {
    const onConceptChange = vi.fn();
    renderTab(edition(CRA_ROWS), undefined, { concept: { goals: [], claims: [supporting], verifications: [] }, onConceptChange });
    fireEvent.click(screen.getByTestId("compliance-req-CR 3.5"));
    expect(within(screen.getByTestId("compliance-row-claims")).getByText(/No claim/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("compliance-add-claim"));
    fireEvent.change(screen.getByTestId("compliance-claim-statement"), { target: { value: "Gateway validates the input" } });
    fireEvent.change(screen.getByTestId("compliance-claim-party"), { target: { value: "Integrator" } });
    fireEvent.click(screen.getByTestId("compliance-claim-save"));
    const next = onConceptChange.mock.lastCall![0];
    expect(next.claims[1]).toMatchObject({
      displayId: "CLM-05", kind: "supporting", statement: "Gateway validates the input", responsibleParty: "Integrator", requirements: ["iec62443:cr-3.5"],
    });
  });

  it("an existing claim can be linked; a linked one is shown and can be removed from the row", () => {
    const onConceptChange = vi.fn();
    renderTab(edition(CRA_ROWS), undefined, { concept: { goals: [], claims: [supporting], verifications: [] }, onConceptChange });
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "all" } });
    fireEvent.click(screen.getByTestId("compliance-req-CR 3.7"));
    expect(screen.getByTestId("compliance-claim-CLM-04").textContent).toContain("Plant firewall");
    fireEvent.click(within(screen.getByTestId("compliance-claim-CLM-04")).getByRole("button"));
    expect(onConceptChange.mock.lastCall![0].claims[0].requirements).toEqual([]);
  });

  it("without a concept handler the dialog shows no claims", () => {
    renderTab(edition(CRA_ROWS));
    fireEvent.click(screen.getByTestId("compliance-req-CR 3.5"));
    expect(screen.queryByTestId("compliance-row-claims")).toBeNull();
  });
});

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
      "All (2)", "Open (1)", "Gap (1)", "Statement needed (0)", "Information missing (0)", "Not applicable (0)", "Met (incl. claimed) (1)",
    ]);
  });

  it("SL table (D-26): FRs as columns; the SL-C against the SL-T by colour and symbol; a target per FR", () => {
    const onChange = renderTab(edition(CRA_ROWS), fam({ target: { SI: 2 } }));
    const vector = screen.getByTestId("compliance-vector");
    expect(within(vector).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "IAC", "UC", "SI", "DC", "RDF", "TRE", "RA"]);
    const product = screen.getByTestId("compliance-vector-slcProduct");
    expect(within(product).getByText("0 ✗").closest("[data-level]")!.getAttribute("data-level")).toBe("below");
    expect(within(screen.getByTestId("compliance-vector-withSystem")).queryByText(/✗|✓/)).toBeNull();
    fireEvent.change(screen.getByTestId("compliance-target-SI"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith(fam({ target: { SI: 3 } }));
  });

  it("'all FR' sets the SL-T of every FR at once, and clears it", () => {
    const onChange = renderTab(edition(CRA_ROWS));
    fireEvent.change(screen.getByTestId("compliance-target-all"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith(fam({ target: { IAC: 3, UC: 3, SI: 3, DC: 3, RDF: 3, TRE: 3, RA: 3 } }));
    fireEvent.change(screen.getByTestId("compliance-target-all"), { target: { value: "-" } });
    expect(onChange).toHaveBeenLastCalledWith(fam({ target: {} }));
  });

  it("a statement stores the model result of the moment and the date (D-17)", () => {
    const onChange = renderTab(edition(CRA_ROWS));
    fireEvent.click(screen.getByTestId("compliance-statement-CR 3.5"));
    fireEvent.change(screen.getByTestId("statement-reasoning"), { target: { value: "Validated by the protocol stack" } });
    fireEvent.click(screen.getByTestId("statement-save"));
    expect(onChange).toHaveBeenLastCalledWith(
      fam({
        // Stored per requirement (D-31) — the classic edition shows it too.
        statements: {
          "cr-3.5": { status: "met", reasoning: "Validated by the protocol stack", modelStatusAtStatement: "gap", date: "2026-11-02" },
        },
      }),
    );
  });

  it("met by a statement while the model still has a gap: the dialog says so (user 2026-11-06, CR 1.7)", () => {
    renderTab(
      edition(CRA_ROWS),
      fam({ statements: { "cr-3.5": { status: "met", reasoning: "Validated by the protocol stack", modelStatusAtStatement: "gap", date: "2026-11-02" } } }),
    );
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "met" } });
    fireEvent.click(screen.getByTestId("compliance-req-CR 3.5"));
    expect(screen.getByTestId("compliance-met-model-open").textContent).toMatch(/^Met by the statement\. The model alone does not show it yet/);
  });

  it("met by a statement while the model lacks properties: the note says the model is still open", () => {
    const rows: Edition["rows"] = [
      { label: "CR 3.6", group: "SI", minSl: 1, requirementIds: ["cr-3.6"], supportingMeasuresAllowed: false },
    ];
    renderTab(
      edition(rows),
      fam({ statements: { "cr-3.6": { status: "met", reasoning: "Outputs go to a safe state", modelStatusAtStatement: "unknown", date: "2026-11-02" } } }),
    );
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "met" } });
    expect(within(screen.getByTestId("compliance-row-CR 3.6")).getByText(/model still open — information missing on P-1 Controller \(fail safe output state\)/)).toBeTruthy();
  });

  it("met by the model: no such hint", () => {
    renderTab(edition(CRA_ROWS));
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "all" } });
    fireEvent.click(screen.getByTestId("compliance-req-CR 3.7"));
    expect(screen.queryByTestId("compliance-met-model-open")).toBeNull();
  });

  it("a void row links to the dialog with the edition's reason, without statement (FX-22)", () => {
    const rows: Edition["rows"] = [
      { label: "CR 1.14", group: "IAC", minSl: null, requirementIds: [], void: "void in prAA", supportingMeasuresAllowed: false },
      ...CRA_ROWS,
    ];
    renderTab(edition(rows));
    fireEvent.change(screen.getByTestId("compliance-filter"), { target: { value: "all" } });
    fireEvent.click(screen.getByTestId("compliance-req-CR 1.14"));
    expect(screen.getByTestId("compliance-void-reason").textContent).toMatch(/^The CRA edition .* declares this requirement void/);
    expect(screen.queryByTestId("compliance-info-statement")).toBeNull();
    expect(within(screen.getByTestId("compliance-info-dialog")).queryByText("Statement")).toBeNull();
  });

  it("every void reason of the editions has a text (FX-22)", () => {
    const reasons = [...EDITION_PRAA_2026.rows, ...EDITION_2019.rows].flatMap((r) => (r.void ? [r.void] : []));
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) expect(VOID_REASONS[reason], reason).toBeDefined();
  });

  it("a statement needs a reasoning", () => {
    renderTab(edition(CRA_ROWS));
    fireEvent.click(screen.getByTestId("compliance-statement-CR 3.5"));
    expect((screen.getByTestId("statement-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("2019 edition: a derived device category is a proposal to confirm (K-C1)", () => {
    const rows: Edition["rows"] = [
      { label: "EDR 3.10", group: "SI", minSl: 1, requirementIds: ["cr-3.10"], supportingMeasuresAllowed: false, deviceCategories: ["EDR"] },
    ];
    const onChange = renderTab(edition(rows, "iec-62443-4-2-2019"), undefined, {
      deviceProposal: { categories: ["EDR"], reason: "system-class" },
    });
    const box = screen.getByTestId("compliance-device-categories");
    expect(within(box).getByText(/Proposal from the model: EDR/)).toBeTruthy();
    expect(within(screen.getByTestId("compliance-rows")).getByText("confirm category")).toBeTruthy();
    fireEvent.click(within(box).getByText("Confirm"));
    expect(onChange).toHaveBeenLastCalledWith(fam({ deviceCategories: { categories: ["EDR"], source: "manual" } }));
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
    renderTab(edition(CRA_ROWS), fam({ target: { SI: 1 } }), { typeOf: (id) => (id === "p1" ? "Process" : undefined) });
    const entry = screen.getByTestId("compliance-todo-p1");
    expect(within(entry).getByText("P-1 Controller")).toBeTruthy();
    expect(within(entry).getByText(/not met, check: input validation/)).toBeTruthy();
    fireEvent.click(within(entry).getByText("CR 3.5"));
    expect(within(screen.getByTestId("compliance-info-dialog")).getByText("CR 3.5 – Input validation")).toBeTruthy();
  });

  it("a requirement in the to-do list has the same tooltip as in the table", async () => {
    renderTab(edition(CRA_ROWS), fam({ target: { SI: 1 } }));
    fireEvent.mouseOver(within(screen.getByTestId("compliance-todo-p1")).getByText("CR 3.5"));
    const tip = await screen.findByTestId("compliance-tooltip-CR 3.5");
    expect(within(tip).getByText("CR 3.5 – Input validation")).toBeTruthy();
  });

  it("the element of a to-do entry links to the diagram", () => {
    const onShowElement = vi.fn();
    renderTab(edition(CRA_ROWS), fam({ target: { SI: 1 } }), { onShowElement });
    fireEvent.click(screen.getByTestId("compliance-todo-link-p1"));
    expect(onShowElement).toHaveBeenCalledWith("p1");
  });

  it("without the callback the element is plain text", () => {
    renderTab(edition(CRA_ROWS), fam({ target: { SI: 1 } }));
    expect(screen.queryByTestId("compliance-todo-link-p1")).toBeNull();
    expect(within(screen.getByTestId("compliance-todo-p1")).getByText("P-1 Controller")).toBeTruthy();
  });
});
