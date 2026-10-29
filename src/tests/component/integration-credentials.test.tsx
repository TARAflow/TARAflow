// src/tests/component/integration-credentials.test.tsx
//
// The token never reaches the project data (0.15.2 hotfix, kept for the new
// Integration tab of the adapters design §4.4): the connection test hands the
// secret to the main process's keychain — bound to tracker + host + account —
// and what onUpdate receives holds no secret. A failed test removes the
// secret again; an old connection without a stored token asks for a re-test.
// (The values below are obviously fake.)
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationTab } from "features/integration/components/integration-tab";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string } & Record<string, unknown>) =>
      (o?.defaultValue ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

const ok = (data: unknown) => ({ ok: true, status: 200, data });
let api: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  api = {
    saveToken: vi.fn(async () => ({ success: true })),
    hasToken: vi.fn(async () => ({ success: true, hasToken: true })),
    deleteToken: vi.fn(async () => ({ success: true })),
    request: vi.fn(async (req: { path: string }) =>
      req.path === "/rest/api/3/myself"
        ? ok({ accountId: "acc-1", displayName: "Someone" })
        : ok([{ id: "1", key: "SCRUM", name: "Scrum", projectTypeKey: "software", issueTypes: [] }]),
    ),
  };
  (window as any).electronAPI = { integration: api };
});
afterEach(() => {
  delete (window as any).electronAPI;
});

const fill = () => {
  fireEvent.change(screen.getByTestId("integration-host"), { target: { value: "https://ACME.atlassian.net/" } });
  fireEvent.change(screen.getByTestId("integration-user"), { target: { value: "Someone@Example.com" } });
  fireEvent.change(screen.getByTestId("integration-secret"), { target: { value: "FAKE-api-token" } });
  fireEvent.click(screen.getByTestId("integration-test"));
};

describe("Integration tab — the token stays out of the project", () => {
  it("the secret goes to the keychain bound to tracker + host + account; onUpdate holds none", async () => {
    const onUpdate = vi.fn();
    render(<IntegrationTab data={{ integration: null }} onUpdate={onUpdate} />);
    fill();
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(api.saveToken).toHaveBeenCalledWith({
      tool: "jira",
      host: "https://acme.atlassian.net",
      account: "someone@example.com",
      token: "FAKE-api-token",
    });
    const integration = onUpdate.mock.calls[0][0].integration;
    expect(JSON.stringify(integration)).not.toContain("FAKE-");
    expect(integration.connection).toMatchObject({
      tool: "jira",
      status: "connected",
      credentials: { authMethod: "pat", baseUrl: "https://acme.atlassian.net", email: "someone@example.com", accountId: "acc-1" },
    });
    // requests name the reference, never a token
    for (const [req] of api.request.mock.calls) expect(JSON.stringify(req)).not.toContain("FAKE-");
    expect(await screen.findByTestId("project-card-SCRUM")).toBeTruthy();
    expect((screen.getByTestId("integration-secret") as HTMLInputElement).value).toBe("");
  });

  it("a failed test removes the secret again and stores nothing", async () => {
    api.request.mockImplementation(async () => ({ ok: false, status: 401, data: null }));
    const onUpdate = vi.fn();
    render(<IntegrationTab data={{ integration: null }} onUpdate={onUpdate} />);
    fill();
    expect((await screen.findByTestId("integration-result")).textContent).toMatch(/Authentication failed/);
    expect(api.deleteToken).toHaveBeenCalledWith({ tool: "jira", host: "https://acme.atlassian.net", account: "someone@example.com" });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("an old connection without a token for its address asks for one connection test", async () => {
    api.hasToken.mockResolvedValue({ success: true, hasToken: false });
    render(
      <IntegrationTab
        data={{
          integration: {
            connection: { tool: "jira", status: "connected", projectName: "SCRUM", credentials: { authMethod: "pat", baseUrl: "https://acme.atlassian.net/", email: "someone@example.com" } },
            mapping: null,
          },
        }}
        onUpdate={() => {}}
      />,
    );
    expect(await screen.findByTestId("integration-retest")).toBeTruthy();
  });

  it("one form for all trackers; only Jira Cloud selectable in 0.16", () => {
    render(<IntegrationTab data={{ integration: null }} onUpdate={() => {}} />);
    fireEvent.mouseDown(within(screen.getByTestId("integration-tracker").parentElement!).getByRole("combobox"));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => [o.textContent?.split(" — ")[0], o.getAttribute("aria-disabled") === "true"])).toEqual([
      ["Jira Cloud", false],
      ["Jira Server / Data Center", true],
      ["Azure DevOps", true],
      ["GitHub Issues", true],
      ["GitLab Issues", true],
      ["Polarion", true],
      ["OpenProject", true],
    ]);
  });
});
