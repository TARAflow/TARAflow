// src/tests/component/integration-change-connection.test.tsx
//
// 0.20 manual test D7 (2026-11-26): an address edited while connected was not
// stored, and "Disconnect" removed the whole integration — the ticket mapping
// with it. Now (user decisions 2026-11-26):
//   - tracker and address are project settings: saved as they are changed
//     — the address when the field is left or Enter is pressed (review
//     2026-11-27) — and listed by the audit; e-mail and token stay on this
//     machine;
//   - Disconnect ends the connection here (token, status) and keeps tracker,
//     address, project and mapping;
//   - changing tracker, address or user while connected asks first — the
//     token is bound to them: "Keep connection" leaves everything,
//     "Disconnect" ends it and takes the new value (the project chosen on the
//     old address goes).
// (The values below are obviously fake.)
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationTab } from "features/integration/components/integration-tab";
import type { IntegrationData } from "features/integration/models/integration-types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string } & Record<string, unknown>) =>
      (o?.defaultValue ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

let deleteToken: ReturnType<typeof vi.fn>;
beforeEach(() => {
  deleteToken = vi.fn(async () => ({ success: true }));
  (window as any).electronAPI = {
    integration: {
      saveToken: vi.fn(async () => ({ success: true })),
      hasToken: vi.fn(async () => ({ success: true, hasToken: true })),
      deleteToken,
      request: vi.fn(),
    },
  };
});
afterEach(() => {
  delete (window as any).electronAPI;
});

const MAPPING = {
  mustPriority: "Highest",
  shouldPriority: "High",
  couldPriority: "Low",
  wontPriority: "Lowest",
  workItemType: "Bug",
  defaultLabels: ["tara"],
};
const CONNECTION = {
  tool: "jira",
  status: "connected",
  credentials: { authMethod: "pat", baseUrl: "https://acme.example.net", email: "someone@example.com", projectKey: "K" },
  projectName: "K",
};
const CONNECTED = { connection: CONNECTION, mapping: MAPPING } as unknown as IntegrationData;

const host = () => screen.getByTestId("integration-host") as HTMLInputElement;
const last = (onUpdate: ReturnType<typeof vi.fn>) => onUpdate.mock.calls.at(-1)![0].integration;

describe("Issue tracker — settings in the project, the connection on this machine", () => {
  it("Disconnect: token and status go; tracker, address, project and mapping stay", async () => {
    const onUpdate = vi.fn();
    render(<IntegrationTab data={{ integration: CONNECTED }} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("integration-disconnect"));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(deleteToken).toHaveBeenCalled();
    expect(last(onUpdate)).toEqual({ connection: { ...CONNECTION, status: "disconnected" }, mapping: MAPPING });
  });

  it("editing the address while connected asks first; Keep connection changes nothing", () => {
    const onUpdate = vi.fn();
    render(<IntegrationTab data={{ integration: CONNECTED }} onUpdate={onUpdate} />);
    fireEvent.change(host(), { target: { value: "https://acme.example.net2" } });
    expect(screen.getByTestId("integration-change-dialog").textContent).toContain("https://acme.example.net");
    fireEvent.click(screen.getByTestId("integration-change-keep"));
    expect(host().value).toBe("https://acme.example.net");
    expect(onUpdate).not.toHaveBeenCalled();
    expect(deleteToken).not.toHaveBeenCalled();
  });

  it("Disconnect in the dialog: the new address saved in the project, the old project gone, the mapping kept", async () => {
    const onUpdate = vi.fn();
    render(<IntegrationTab data={{ integration: CONNECTED }} onUpdate={onUpdate} />);
    fireEvent.change(host(), { target: { value: "https://acme.example.net2" } });
    fireEvent.click(screen.getByTestId("integration-change-disconnect"));
    await waitFor(() => expect(host().value).toBe("https://acme.example.net2"));
    fireEvent.blur(host());
    await waitFor(() => expect(last(onUpdate)?.connection?.credentials?.baseUrl).toBe("https://acme.example.net2"));
    expect(deleteToken).toHaveBeenCalled();
    expect(last(onUpdate)).toEqual({
      connection: {
        tool: "jira",
        status: "disconnected",
        credentials: { authMethod: "pat", baseUrl: "https://acme.example.net2", email: "someone@example.com" },
      },
      mapping: MAPPING,
    });
    expect(host().value).toBe("https://acme.example.net2");
  });

  it("not connected: the address is saved when the field is left, no dialog; the user name stays local", () => {
    const onUpdate = vi.fn();
    render(<IntegrationTab data={{ integration: null }} onUpdate={onUpdate} />);
    fireEvent.change(host(), { target: { value: "https://other.example.net" } });
    expect(screen.queryByTestId("integration-change-dialog")).toBeNull();
    fireEvent.blur(host());
    expect(last(onUpdate).connection).toMatchObject({ tool: "jira", status: "disconnected", credentials: { baseUrl: "https://other.example.net" } });
    const calls = onUpdate.mock.calls.length;
    fireEvent.change(screen.getByTestId("integration-user"), { target: { value: "me@example.com" } });
    expect(onUpdate.mock.calls.length).toBe(calls);
  });

  // review 2026-11-27: every keystroke was a project change and dropped the
  // chosen tracker project — now the address is saved once, when the field is
  // left or Enter is pressed
  it("typing the address changes the project only once: on leaving the field or Enter", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<IntegrationTab data={{ integration: null }} onUpdate={onUpdate} />);
    for (const value of ["https://o", "https://ot", "https://other.example.net"]) fireEvent.change(host(), { target: { value } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.keyDown(host(), { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(last(onUpdate).connection.credentials.baseUrl).toBe("https://other.example.net");
    rerender(<IntegrationTab data={{ integration: last(onUpdate) }} onUpdate={onUpdate} />); // the saved state comes back
    fireEvent.blur(host()); // unchanged since: nothing more
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
