// src/tests/component/multiprocess-form.order.test.tsx
//
// Field order on the Multiprocess form (TESTPLAN-0.17 F2): the update
// mechanism sits under Security next to the session fields, as on the
// Process form; "safety-relevant" closes the Security section.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiprocessDescriptionForm } from "features/dfd/components/forms/multiprocess-description-form";
import type { DFDElement } from "features/dfd/models/dfd-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const element = {
  id: "mp1",
  type: "Multiprocess",
  displayId: "MP-1",
  name: "Pump Controller",
  properties: { systemClass: "embedded_controller" },
} as unknown as DFDElement;

/** a comes before b in the document. */
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("MultiprocessDescriptionForm — field order", () => {
  it("update mechanism under Security before the session fields; safety-relevant last", () => {
    render(<MultiprocessDescriptionForm element={element} onChange={() => {}} />);
    const security = screen.getByText("Security");
    const documentation = screen.getByText("Documentation");
    const update = screen.getAllByText("Update Mechanism")[0];
    const sessions = screen.getAllByText("Session Lock after Inactivity")[0];
    const safety = screen.getByText("Safety-Relevant System");
    expect(before(security, update)).toBe(true);
    expect(before(update, sessions)).toBe(true);
    expect(before(sessions, safety)).toBe(true);
    expect(before(safety, documentation)).toBe(true);
  });
});
