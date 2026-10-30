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
