// src/tests/component/integration-credentials.test.tsx
//
// Hotfix 2026-10-29: the issue-tracker token goes to the OS keychain and
// never into the project data handed to onUpdate.
//   - Jira: after a successful connection test the form passed its test
//     credentials (with the token) on as a second write; that write put the
//     token into the project and dropped the accountId the keychain uses.
//   - ADO: the PAT was stored in the project by design.
// (The values below are obviously fake.)
import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JiraConfig } from "features/integration/components/jira-config";
import { useIntegrationConnection } from "features/integration/hooks/use-integration-connection";
import * as integrationService from "features/integration/services/integration-service";
import { adoKeychainAccount } from "features/integration/services/ado-service";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k, i18n: { language: "en" } }),
}));

const saveToken = vi.fn(async () => ({ success: true }));
beforeEach(() => {
  (window as any).electronAPI = { jira: { saveToken, getToken: vi.fn(async () => ({ token: null })) } };
});
afterEach(() => {
  vi.restoreAllMocks();
  saveToken.mockClear();
  delete (window as any).electronAPI;
});

describe("Jira connection form", () => {
  it("a successful test does not pass the token on as credentials", async () => {
    const onCredentialsChange = vi.fn();
    const onTestConnection = vi.fn(async (_credentials: unknown) => ({ success: true, message: "ok", projects: [] }));
    render(
      <JiraConfig
        credentials={{ authMethod: "pat", baseUrl: "" } as never}
        selectedProject={undefined as never}
        onCredentialsChange={onCredentialsChange}
        onProjectSelect={() => {}}
        onTestConnection={onTestConnection}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Jira URL/), { target: { value: "https://example.atlassian.net" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "someone@example.com" } });
    fireEvent.change(screen.getByLabelText(/API Token/), { target: { value: "FAKE-api-token" } });
    fireEvent.click(screen.getByRole("button", { name: /Test Connection/ }));
    await waitFor(() => expect(onTestConnection).toHaveBeenCalled());
    // the token reaches the test handler (which puts it into the keychain) …
    expect(onTestConnection.mock.calls[0][0]).toMatchObject({ apiToken: "FAKE-api-token" });
    // … and nothing else
    expect(onCredentialsChange).not.toHaveBeenCalled();
  });
});

describe("connection handlers", () => {
  it("Jira: token to the keychain under the accountId, project data without it", async () => {
    vi.spyOn(integrationService, "testConnection").mockResolvedValue({ success: true, message: "ok", projects: [], accountId: "acc-1" } as never);
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useIntegrationConnection({ integration: null }, onUpdate));
    await act(async () => {
      await result.current.handleJiraTestConnection({ authMethod: "pat", baseUrl: "https://x", email: "e@x", apiToken: "FAKE-api-token" } as never);
    });
    expect(saveToken).toHaveBeenCalledWith("acc-1", "FAKE-api-token");
    const credentials = onUpdate.mock.calls[0][0].integration.connection.credentials;
    expect(credentials).toEqual({ authMethod: "pat", baseUrl: "https://x", email: "e@x", accountId: "acc-1" });
  });

  it("ADO: PAT to the keychain, project data without it", async () => {
    vi.spyOn(integrationService, "testConnection").mockResolvedValue({ success: true, message: "ok", projects: [] } as never);
    const onUpdate = vi.fn();
    const { result } = renderHook(() => useIntegrationConnection({ integration: null }, onUpdate));
    await act(async () => {
      await result.current.handleAdoTestConnection({ authMethod: "pat", organizationUrl: "https://dev.azure.com/Org/", personalAccessToken: "FAKE-pat" });
    });
    expect(saveToken).toHaveBeenCalledWith(adoKeychainAccount("https://dev.azure.com/Org/"), "FAKE-pat");
    expect(adoKeychainAccount("https://dev.azure.com/Org/")).toBe("azure-devops:https://dev.azure.com/org");
    expect(onUpdate.mock.calls[0][0].integration.connection.credentials).toEqual({
      authMethod: "pat",
      organizationUrl: "https://dev.azure.com/Org/",
    });
  });
});
