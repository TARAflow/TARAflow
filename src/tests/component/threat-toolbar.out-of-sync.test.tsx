// src/tests/component/threat-toolbar.out-of-sync.test.tsx
//
// Manual test 2026-11-16: after P-4 was deleted and DF-8 redrawn, the
// per-interaction threats stayed on flows that no longer exist — nothing
// said so while per-element was shown. Each method button carries an
// orange dot when its threats no longer match the DFD.
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreatToolbar } from "features/threats/components/shared/threat-toolbar";
import type { StrideMethod } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const toolbar = (methodsOutOfSync?: StrideMethod[], methodsDrifting?: StrideMethod[]) =>
  render(
    <ThreatToolbar
      isGenerating={false}
      isSyncing={false}
      validation={null}
      activeMethod="per-element"
      {...(methodsOutOfSync ? { methodsOutOfSync } : {})}
      {...(methodsDrifting ? { methodsDrifting } : {})}
      hasThreats
      hasDFD
      syncStatus={null}
      showDFDPreview={false}
      showFilters={false}
      showStrategyIndicator={false}
      forceClassicMode={false}
      onToggleDFDPreview={vi.fn()}
      onToggleFilters={vi.fn()}
      onToggleStrategyIndicator={vi.fn()}
      onMethodChange={vi.fn()}
      onGenerate={vi.fn()}
      onSync={vi.fn()}
      onDeleteAll={vi.fn()}
      onOpenConfig={vi.fn()}
      onExport={vi.fn()}
      onImport={vi.fn()}
    />,
  );
const dot = (method: StrideMethod) =>
  screen.getByTestId(`threat-method-out-of-sync-${method}`).querySelector(".MuiBadge-badge")!;

describe("ThreatToolbar — methods out of sync", () => {
  it("no dot while both methods match the DFD", () => {
    toolbar();
    expect(dot("per-element").className).toContain("MuiBadge-invisible");
    expect(dot("per-interaction").className).toContain("MuiBadge-invisible");
  });

  it("a dot on the method out of sync — also when it is not the one shown", () => {
    toolbar(["per-interaction"]);
    expect(dot("per-interaction").className).not.toContain("MuiBadge-invisible");
    expect(dot("per-element").className).toContain("MuiBadge-invisible");
  });

  it("its tooltip says what to do", async () => {
    toolbar(["per-interaction"]);
    fireEvent.mouseOver(screen.getByTestId("threat-method-out-of-sync-per-interaction"));
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("regenerate"));
  });
});

// Manual test 2026-11-16: per interaction would have produced 5 new
// threats (generation drift) while per element was shown — a light-blue
// dot for drift; out of sync (orange) wins.
describe("ThreatToolbar — methods with generation drift", () => {
  it("a light-blue dot on the drifting method, with its tooltip", async () => {
    toolbar([], ["per-interaction"]);
    const d = dot("per-interaction");
    expect(d.className).not.toContain("MuiBadge-invisible");
    expect(d.className).toContain("MuiBadge-colorInfo");
    expect(dot("per-element").className).toContain("MuiBadge-invisible");
    fireEvent.mouseOver(screen.getByTestId("threat-method-out-of-sync-per-interaction"));
    await waitFor(() => expect(screen.getByRole("tooltip").textContent).toContain("would add or remove threats"));
  });

  it("out of sync wins over drift: orange", () => {
    toolbar(["per-interaction"], ["per-interaction"]);
    expect(dot("per-interaction").className).toContain("MuiBadge-colorWarning");
  });
});

