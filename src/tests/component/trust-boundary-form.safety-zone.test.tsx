// EN 50742 O18 (user 2026-11-21): the trust boundary form asks for the
// safety zone mark in EN 50742 projects only (and where it is already set).
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrustBoundaryDescriptionForm as TrustBoundaryForm } from "features/dfd/components/forms/trust-boundary-form";
import { ModelFieldProvider } from "features/dfd/components/forms/model-field-inputs";
import type { DFDElement } from "features/dfd/models/dfd-types";
import type { VisibilityElement } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));
afterEach(cleanup);

const boundary = (properties: Record<string, unknown>) =>
  ({ id: "tb", type: "TrustBoundary", displayId: "TB-1", name: "Machine", properties }) as unknown as DFDElement;

const renderForm = (element: DFDElement, en50742: boolean) =>
  render(
    <ModelFieldProvider elements={[element as unknown as VisibilityElement]} connections={[]} en50742={en50742}>
      <TrustBoundaryForm element={element} onChange={() => {}} />
    </ModelFieldProvider>,
  );

describe("TrustBoundaryForm — EN 50742 safety zone", () => {
  it("EN 50742 project: asked", () => {
    renderForm(boundary({ boundaryType: "network" }), true);
    expect(screen.getByTestId("model-field-safetyZone")).toBeTruthy();
  });

  it("other projects: not asked", () => {
    renderForm(boundary({ boundaryType: "network" }), false);
    expect(screen.queryByTestId("model-field-safetyZone")).toBeNull();
  });

  it("already marked: shown, so it can be taken back", () => {
    renderForm(boundary({ boundaryType: "network", safetyZone: "yes" }), false);
    expect(screen.getByTestId("model-field-safetyZone")).toBeTruthy();
  });
});
