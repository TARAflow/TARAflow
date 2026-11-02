// src/tests/component/model-field-inputs.test.tsx
//
// The model coverage fields in the Security sub-tabs (model-coverage-
// implementation-plan.md §3, CM-5a / CM-5d): entries from the registry,
// visible where the element's settings and flows make them meaningful (user
// 2026-11-02), each in its tab, with only the fitting values; nothing without
// the DFD tab's model.

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelFieldProvider, useModelFieldEntries } from "features/dfd/components/forms/model-field-inputs";
import { SecurityTabs } from "features/dfd/components/forms/security-tabs";
import type { VisibilityElement, VisibilityFlowInput } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) || k,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const operator: VisibilityElement = { id: "op", type: "ExternalEntity", properties: { entityType: "operator" } };
const scada: VisibilityElement = { id: "scada", type: "ExternalEntity", properties: { entityType: "scada_hmi" } };

const Fields: React.FC<{ element: VisibilityElement; onChange: (p: string, v: unknown) => void; formKey: string }> = ({
  element,
  onChange,
  formKey,
}) => <SecurityTabs formKey={formKey} entries={useModelFieldEntries(element, onChange)} />;

let run = 0;
function renderFields(properties: Record<string, unknown>, flows: VisibilityFlowInput[], provider = true) {
  const element: VisibilityElement = { id: "p", type: "Process", properties };
  const onChange = vi.fn();
  // A form key per test: the chosen tab is kept per key.
  const fields = <Fields element={element} onChange={onChange} formKey={`test-${run++}`} />;
  render(
    provider ? (
      <ModelFieldProvider elements={[element, operator, scada]} connections={flows}>
        {fields}
      </ModelFieldProvider>
    ) : (
      fields
    ),
  );
  return onChange;
}

const passwordLogin: VisibilityFlowInput = { id: "f", from: "op", to: "p", properties: { endpointAuthentication: "password" } };

describe("model fields in the Security sub-tabs", () => {
  it("a process with a password login from an operator: accounts, both password fields and the authenticator fields under login, five open", () => {
    renderFields({ authenticationRequired: "yes" }, [passwordLogin]);
    expect(screen.getByTestId("security-tab-login").textContent).toBe("Login & accounts (5)");
    expect(screen.getByTestId("model-field-defaultCredentials")).toBeTruthy();
    expect(screen.getByTestId("model-field-authenticatorChangeable")).toBeTruthy();
    expect(screen.getByTestId("model-field-userAccounts")).toBeTruthy();
    expect(screen.getByTestId("model-field-passwordStrength")).toBeTruthy();
    expect(screen.getByTestId("model-field-passwordLifetime")).toBeTruthy();
    expect(screen.queryByTestId("security-tab-authorization")).toBeNull(); // no RBAC → no roleMapping
  });

  it("RBAC: role permissions in the authorization tab; without human users or passwords only the authenticator fields under login", () => {
    renderFields({ authenticationRequired: "yes", authorizationModel: "rbac", roleMapping: "fixed_roles" }, []);
    expect(screen.getByTestId("security-tab-authorization").textContent).toBe("Authorization");
    expect(screen.getByTestId("security-tab-login").textContent).toBe("Login & accounts (2)");
    expect(screen.queryByTestId("model-field-userAccounts")).toBeNull();
  });

  it("no authentication decided yet, certificate login: no field, no tab", () => {
    renderFields({}, [{ ...passwordLogin, properties: { endpointAuthentication: "certificate" } }]);
    expect(screen.queryByTestId("security-tabs")).toBeNull();
  });

  it("only the fitting lifetime values; a choice is passed on", () => {
    const onChange = renderFields({ authenticationRequired: "yes" }, [passwordLogin]);
    fireEvent.mouseDown(within(screen.getByTestId("model-field-passwordLifetime")).getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("data-value"))).toEqual(["", "none", "human_accounts"]);
    fireEvent.click(screen.getByRole("option", { name: "human_accounts" }));
    expect(onChange).toHaveBeenCalledWith("passwordLifetime", "human_accounts");
  });

  it("a stored value outside the fitting ones stays visible and selectable", () => {
    renderFields({ authenticationRequired: "yes", passwordLifetime: "machine_accounts" }, [passwordLogin]);
    fireEvent.mouseDown(within(screen.getByTestId("model-field-passwordLifetime")).getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("data-value"))).toEqual(["", "none", "human_accounts", "machine_accounts"]);
  });

  it("without the DFD tab's model nothing is shown", () => {
    renderFields({ authenticationRequired: "yes" }, [passwordLogin], false);
    expect(screen.queryByTestId(/^model-field-/)).toBeNull();
  });
});
