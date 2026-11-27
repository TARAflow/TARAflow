// src/tests/component/audit-config-dialog.ssh-key.test.tsx
//
// 0.20.1 (user 2026-11-27): the public key (….pub) was accepted as the SSH
// key path. The field asks the main process what the path names and says
// what is wrong; a .pub with its private key beside it offers that one.
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditConfigDialog } from "features/audit/components/audit-config-dialog";
import { DEFAULT_AUDIT_CONFIG, type AuditConfig } from "features/audit/models/audit-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      String((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

const inspectSshKey = vi.fn();
beforeEach(() => {
  inspectSshKey.mockReset();
  (window as unknown as { electron: unknown }).electron = { file: { inspectSshKey, pickFile: vi.fn() } };
});
afterEach(() => {
  cleanup();
  delete (window as unknown as { electron?: unknown }).electron;
});

const config = (sshKeyPath: string): AuditConfig => ({ ...DEFAULT_AUDIT_CONFIG, auth: { method: "ssh", sshKeyPath } });
const openAuth = (path: string) => {
  render(<AuditConfigDialog open config={config(path)} onSave={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: /Authentication/i }));
};
const field = () => screen.getByTestId("ssh-key-path") as HTMLInputElement;

describe("SSH key path in the audit settings", () => {
  it("a .pub with its private key beside it: the problem named, the private key offered with one click", async () => {
    inspectSshKey.mockResolvedValue({ success: true, data: { status: "public_key", keyType: "rsa", privateKeyPath: "~/.ssh/ado" } });
    openAuth("~/.ssh/ado.pub");
    await screen.findByText(/This is a public key \(\.pub\)/);
    expect(inspectSshKey).toHaveBeenCalledWith("~/.ssh/ado.pub");
    inspectSshKey.mockResolvedValue({ success: true, data: { status: "ok", keyType: "rsa" } });
    fireEvent.click(screen.getByTestId("ssh-key-use-private"));
    expect(field().value).toBe("~/.ssh/ado");
    await screen.findByText(/Private key \(RSA\)\./);
    expect(screen.queryByText(/This is a public key/)).toBeNull();
  });

  it("a missing file: named at the field", async () => {
    inspectSshKey.mockResolvedValue({ success: true, data: { status: "missing" } });
    openAuth("~/.ssh/nothing");
    await screen.findByText(/No file at this path\./);
  });

  it("empty: nothing asked", async () => {
    openAuth("");
    await new Promise((r) => setTimeout(r, 350));
    expect(inspectSshKey).not.toHaveBeenCalled();
  });

  it("the help text says private key", () => {
    inspectSshKey.mockResolvedValue({ success: true, data: { status: "ok" } });
    openAuth("~/.ssh/id_audit");
    expect(screen.getByText(/Path to the private key \(not \.pub\)/)).toBeTruthy();
  });
});
