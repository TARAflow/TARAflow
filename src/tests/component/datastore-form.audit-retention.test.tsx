// EN 50742 B-F6 (0.20 patch 13): the data store form shows the retention of
// the audit records only where the store holds audit logs.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataStoreDescriptionForm } from "features/dfd/components/forms/datastore-description-form";
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

const store = (properties: Record<string, unknown>) =>
  ({ id: "ds", type: "DataStore", displayId: "DS-1", name: "Log", properties }) as unknown as DFDElement;

const renderForm = (element: DFDElement) =>
  render(
    <ModelFieldProvider elements={[element as unknown as VisibilityElement]} connections={[]}>
      <DataStoreDescriptionForm element={element} onChange={() => {}} />
    </ModelFieldProvider>,
  );

describe("DataStoreDescriptionForm — audit record retention", () => {
  it("a store with audit logs asks for the retention", () => {
    renderForm(store({ storedDataTypes: ["audit_logs"] }));
    expect(screen.getByTestId("model-field-auditRecordRetention")).toBeTruthy();
  });

  it("other stores do not", () => {
    renderForm(store({ storedDataTypes: ["config"] }));
    expect(screen.queryByTestId("model-field-auditRecordRetention")).toBeNull();
  });
});
