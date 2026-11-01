// src/tests/component/trust-boundary-default-deny.test.tsx
//
// The trust boundary's traffic policy is a multi-select since schema 12
// (iec-62443-4-2-cra-coverage.md P-1): several policies at once, "allow_all"
// excludes the others; an older single value is shown as a selection of one.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrustBoundaryDescriptionForm } from "features/dfd/components/forms/trust-boundary-form";
import type { DFDElement } from "features/dfd/models/dfd-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) || k.split(".").pop()!,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const boundary = (defaultDenyPolicy: unknown) =>
  ({
    id: "tb",
    type: "TrustBoundary",
    name: "Zone [Z]",
    displayId: "Z",
    position: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
    properties: { boundaryType: "network", defaultDenyPolicy },
  }) as unknown as DFDElement;

function openPolicies(value: unknown) {
  const onChange = vi.fn();
  render(<TrustBoundaryDescriptionForm element={boundary(value)} onChange={onChange} />);
  const input = screen.getByTestId("tb-default-deny-policy");
  fireEvent.mouseDown(within(input.parentElement!).getByRole("combobox"));
  return onChange;
}

const lastPolicies = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0].properties.defaultDenyPolicy;

describe("TrustBoundary — default traffic policy (multi-select)", () => {
  it("adds a policy to the selection", () => {
    const onChange = openPolicies(["deny_all_permit_exception"]);
    fireEvent.click(screen.getByRole("option", { name: /island_mode/ }));
    expect(lastPolicies(onChange)).toEqual(["deny_all_permit_exception", "island_mode"]);
  });

  it("allow_all replaces a restricting selection", () => {
    const onChange = openPolicies(["deny_all_permit_exception", "fail_close"]);
    fireEvent.click(screen.getByRole("option", { name: /allow_all/ }));
    expect(lastPolicies(onChange)).toEqual(["allow_all"]);
  });

  it("an older single value is extended, allow_all dropped when restricting", () => {
    const onChange = openPolicies("allow_all");
    fireEvent.click(screen.getByRole("option", { name: /fail_close/ }));
    expect(lastPolicies(onChange)).toEqual(["fail_close"]);
  });
});
