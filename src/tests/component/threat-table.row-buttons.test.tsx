// src/tests/component/threat-table.row-buttons.test.tsx
//
// Manual test 2026-11-19: the trash icon's click also reached the row, which
// opens the threat dialog — the dialog covered the delete confirmation. The
// row buttons handle their click alone: delete deletes (after asking), edit
// opens the dialog once.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElementThreatTable } from "features/threats/components/per-element/element-threat-table";
import { InteractionThreatTable } from "features/threats/components/per-interaction/interaction-threat-table";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      typeof o === "object" && o?.defaultValue !== undefined ? String(o.defaultValue) : k,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const threat = {
  id: "t1",
  displayId: "P1-S-1",
  strideCategory: "S",
  threatDescription: "Spoofing",
  attackDescription: "",
  relevance: "relevant",
  source: "manual",
  proposedMitigations: [],
  proposedVerifications: [],
  linkedElement: { elementId: "p1", displayId: "P-1", name: "Controller", type: "Process" },
  dataFlow: { dataFlowId: "DF-1", sourceId: "e1", sourceName: "EE", sourceType: "ExternalEntity", targetId: "p1", targetName: "Controller", targetType: "Process", direction: "IN" },
};
const table = { trustBoundaryId: null, trustBoundaryName: "TB", displayIdentifier: "[TB]", threats: [threat] } as never;

const cases = [
  ["per element", ElementThreatTable],
  ["per interaction", InteractionThreatTable],
] as const;

describe.each(cases)("threat table %s — row buttons", (_name, Table) => {
  const renderTable = () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<Table table={table} tableIndex={0} configuration={{} as never} onEdit={onEdit} onDelete={onDelete} onAdd={() => {}} />);
    // the group opens first (collapsed by default)
    for (const summary of document.querySelectorAll('[aria-expanded="false"]')) fireEvent.click(summary);
    return { onEdit, onDelete };
  };

  it("delete: only the delete, not the row's dialog", () => {
    const { onEdit, onDelete } = renderTable();
    fireEvent.click(screen.getByLabelText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("t1");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("edit: the dialog once", () => {
    const { onEdit } = renderTable();
    fireEvent.click(screen.getByLabelText("Edit"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
