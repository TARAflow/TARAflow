// src/tests/component/threat-table.rated-count.test.tsx
//
// Manual test 2026-11-19 (Pump Station): each table showed "0/19" although
// every threat had its relevance — the count read workflowStatus, which only
// the dialog sets. Rated = relevance decided, as the phase status counts.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

const threat = (id: string, relevance: string) => ({
  id,
  displayId: id,
  strideCategory: "S",
  threatDescription: "Spoofing",
  relevance,
  workflowStatus: "open", // set from the file, not by the dialog
  source: "generated",
  proposedMitigations: [],
  proposedVerifications: [],
  linkedElement: { elementId: "p1", displayId: "P-1", name: "Controller", type: "Process" },
  dataFlow: { dataFlowId: "DF-1", sourceId: "e1", sourceName: "EE", sourceType: "ExternalEntity", targetId: "p1", targetName: "Controller", targetType: "Process", direction: "IN" },
});

const table = (relevances: string[]) =>
  ({ trustBoundaryId: null, trustBoundaryName: "TB", displayIdentifier: "[TB]", threats: relevances.map((r, i) => threat(`T-${i}`, r)) }) as never;

describe.each([
  ["per element", ElementThreatTable],
  ["per interaction", InteractionThreatTable],
] as const)("threat table %s — rated count", (_name, Table) => {
  const count = (relevances: string[]) => {
    render(<Table table={table(relevances)} tableIndex={0} configuration={{} as never} onEdit={() => {}} onDelete={() => {}} onAdd={() => {}} />);
    return screen.getByText(/^\d+\/\d+$/).textContent;
  };

  it("every relevance decided: x/x", () => {
    expect(count(["relevant", "not_relevant", "uncertain"])).toBe("3/3");
  });

  it("unrated ones do not count", () => {
    expect(count(["relevant", "unrated"])).toBe("1/2");
  });
});
