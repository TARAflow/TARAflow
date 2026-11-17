// src/tests/unit/app/services/local-user-settings.test.ts
//
// Personal values of a project stay on this machine (user 2026-10-30): the
// commit author per project, the tracker account and connection state per
// tracker host. The stored value wins; a file written before 0.16 hands its
// values over once (onlyMissing) — never over this user's own.

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  rememberLocalSettings,
  withLocalAudit,
  withLocalIntegration,
} from "app/services/local-user-settings";
import type { Project } from "app/models/project-types";

type Audit = Project["audit"];
type Integration = Project["integration"];

const audit = (author?: { name: string; email: string }): Audit =>
  ({ config: { provider: "github", defaultBranch: "main", auth: { method: "ssh" }, ...(author ? { author } : {}) } }) as unknown as Audit;

const integration = (credentials: Record<string, unknown>, extra: Record<string, unknown> = {}): Integration =>
  ({
    connection: { tool: "jira", credentials: { authMethod: "pat", baseUrl: "https://team.atlassian.net/", projectKey: "SCRUM", ...credentials }, projectName: "SCRUM", ...extra },
    mapping: null,
  }) as unknown as Integration;

afterEach(() => localStorage.clear());

describe("local user settings", () => {
  it("a file without personal values: empty author, not connected", () => {
    expect(withLocalAudit("p1", audit())!.config.author).toEqual({ name: "", email: "" });
    const conn = withLocalIntegration("p1", integration({}))!.connection!;
    expect(conn.status).toBe("disconnected");
    expect(conn.credentials).not.toHaveProperty("email");
  });

  it("an edit is remembered and filled in after reopening the stripped file", () => {
    rememberLocalSettings("p1", audit({ name: "Ann", email: "ann@x" }), null);
    rememberLocalSettings("p1", null, integration({ email: "ann@x", accountId: "a-1" }, { status: "connected", lastTested: "2026-10-30T10:00:00Z" }));
    expect(withLocalAudit("p1", audit())!.config.author).toEqual({ name: "Ann", email: "ann@x" });
    const conn = withLocalIntegration("p1", integration({}))!.connection!;
    expect(conn.credentials).toMatchObject({ email: "ann@x", accountId: "a-1", baseUrl: "https://team.atlassian.net/" });
    expect(conn.status).toBe("connected");
    expect(conn.lastTested).toBe("2026-10-30T10:00:00Z");
  });

  it("the tracker account is per host — another project on the same Jira shares it", () => {
    rememberLocalSettings("p1", null, integration({ email: "ann@x" }, { status: "connected" }));
    expect(withLocalIntegration("p2", integration({}))!.connection!.credentials).toMatchObject({ email: "ann@x" });
    const other = integration({ baseUrl: "https://other.atlassian.net" });
    expect(withLocalIntegration("p2", other)!.connection!.status).toBe("disconnected");
  });

  it("an older file hands its values over once, never over this user's own", () => {
    rememberLocalSettings("p1", audit({ name: "Old", email: "old@x" }), integration({ email: "old@x" }, { status: "connected" }), { onlyMissing: true });
    expect(withLocalAudit("p1", audit())!.config.author.name).toBe("Old");

    rememberLocalSettings("p1", audit({ name: "Ann", email: "ann@x" }), null);
    rememberLocalSettings("p1", audit({ name: "Old", email: "old@x" }), null, { onlyMissing: true });
    // The stored value wins over a teammate's value still in the file.
    expect(withLocalAudit("p1", audit({ name: "Old", email: "old@x" }))!.config.author.name).toBe("Ann");
  });
});

// Manual test 2026-11-17: the signing key had to be picked again on every
// open — the file carries no key path (rightly), and the git-config
// hydration ran for one of three load paths only. The key path / id is a
// personal value of the project like the author.
describe("local user settings — the user's keys", () => {
  const withKeys = (signing: Record<string, unknown>, extra: Record<string, unknown> = {}): Audit =>
    ({ config: { provider: "github", defaultBranch: "main", auth: { method: "ssh" }, signing, gpg: { enabled: false }, ...extra } }) as unknown as Audit;

  it("a picked SSH signing key is remembered and filled in after reopening the stripped file", () => {
    rememberLocalSettings("p1", withKeys({ enabled: true, format: "ssh", sshSigningKeyPath: "/home/u/.ssh/sign.pub" }), null);
    const reopened = withLocalAudit("p1", withKeys({ enabled: true, format: "ssh" }))!;
    expect(reopened.config.signing).toEqual({ enabled: true, format: "ssh", sshSigningKeyPath: "/home/u/.ssh/sign.pub" });
  });

  it("GPG key id and the SSH key for the remote too", () => {
    rememberLocalSettings(
      "p1",
      withKeys({ enabled: true, format: "gpg", keyId: "ABCD1234" }, { gpg: { enabled: true, keyId: "ABCD1234" }, auth: { method: "ssh", sshKeyPath: "/home/u/.ssh/id_ed25519" } }),
      null,
    );
    const reopened = withLocalAudit("p1", withKeys({ enabled: true, format: "gpg" }, { gpg: { enabled: true }, auth: { method: "ssh" } }))!;
    expect(reopened.config.signing?.keyId).toBe("ABCD1234");
    expect(reopened.config.gpg?.keyId).toBe("ABCD1234");
    expect(reopened.config.auth?.sshKeyPath).toBe("/home/u/.ssh/id_ed25519");
  });

  it("a key in memory is not replaced; another project keeps its own", () => {
    rememberLocalSettings("p1", withKeys({ enabled: true, format: "ssh", sshSigningKeyPath: "/a.pub" }), null);
    expect(withLocalAudit("p1", withKeys({ enabled: true, format: "ssh", sshSigningKeyPath: "/b.pub" }))!.config.signing?.sshSigningKeyPath).toBe("/b.pub");
    expect(withLocalAudit("p2", withKeys({ enabled: true, format: "ssh" }))!.config.signing).not.toHaveProperty("sshSigningKeyPath");
  });

  it("nothing to fill in: the same object (no re-render)", () => {
    rememberLocalSettings("p1", audit({ name: "Ann", email: "ann@x" }), null);
    const a = withLocalAudit("p1", audit())!;
    expect(withLocalAudit("p1", a)).toBe(a);
  });
});

