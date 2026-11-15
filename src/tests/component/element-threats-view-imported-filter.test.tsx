// src/tests/component/element-threats-view-imported-filter.test.tsx
//
// Manual test 2026-11-15: the filter bar of the Threats tab applies to the
// threats of imported components too — a component group without a match
// is left out, one with matches shows the matching threats only.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElementThreatsView } from "features/threats/components/per-element/element-threats-view";
import type { ImportedThreatSection } from "features/threats/components/shared/imported-threats-section";
import type { Threat, ThreatConfiguration } from "features/threats/models/threat-types";

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({
    t: (k: string, opt?: Record<string, unknown>) =>
      ((opt?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(opt?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const threat = (id: string, text: string) =>
  ({
    id,
    displayId: id,
    strideCategory: "T",
    relevance: "relevant",
    linkedElement: { elementId: "e", elementName: "Element", elementType: "Process", displayId: "P-1" },
    threatDescription: text,
    attackDescription: "",
    proposedMitigations: [],
  }) as unknown as Threat;

const machine = threat("m-1", "machine wiring tampered");
const importedA = threat("i-1", "sensor firmware replaced");
const importedB = threat("i-2", "calibration data altered");

function section(threats: Threat[]): ImportedThreatSection {
  return {
    key: "imported-cmp",
    label: "SDC1 · Smoke Detector Case",
    count: threats.length,
    threats,
    render: () => (
      <div data-testid="imported-rows">{threats.map((x) => x.id).join(",")}</div>
    ),
    filtered: (keep) => section(threats.filter(keep)),
  };
}

function renderView() {
  render(
    <ElementThreatsView
      tables={[{ trustBoundaryId: "tb", trustBoundaryName: "TB", displayIdentifier: "TB", threats: [machine] }]}
      isGenerating={false}
      hasDFD
      configuration={{} as ThreatConfiguration}
      onGenerate={vi.fn()}
      onOpenEditDialog={vi.fn()}
      onDelete={vi.fn()}
      onAdd={vi.fn()}
      importedSections={[section([importedA, importedB])]}
    />,
  );
}
const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search threats..."), { target: { value: text } });

describe("ElementThreatsView — the filter bar and imported threats", () => {
  it("without a filter the component group lists all its threats", () => {
    renderView();
    expect(screen.getByTestId("imported-rows").textContent).toBe("i-1,i-2");
  });

  it("a filter narrows the component group to the matching threats", () => {
    renderView();
    search("firmware");
    expect(screen.getByTestId("imported-rows").textContent).toBe("i-1");
  });

  it("a component group without a match is left out", () => {
    renderView();
    search("wiring");
    expect(screen.queryByTestId("imported-threat-card-imported-cmp")).toBeNull();
  });
});
