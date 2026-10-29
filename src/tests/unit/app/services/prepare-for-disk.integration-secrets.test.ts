// src/tests/unit/app/services/prepare-for-disk.integration-secrets.test.ts
//
// Hotfix 2026-10-29: issue-tracker secrets never reach a .tara.json. A second
// write after the Jira connection test put `apiToken` into
// integration.connection.credentials, and the ADO tab stored its PAT / OAuth
// tokens there; the file goes into the audit repository. prepareForDisk is
// the safety net for every writer, whatever path put the secret there.
// (The values below are obviously fake.)

import { describe, it, expect } from "vitest";
import { prepareForDisk, serialiseProject, INTEGRATION_SECRET_KEYS } from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";

const project = (integration: unknown): Project =>
  ({
    id: "proj_1",
    schemaVersion: 10,
    info: { name: "P", description: "", version: "1.0", responsible: "", created: "", lastModified: "", tags: {}, team: [], isHighImpact: false },
    strideMethod: null,
    methodSelected: false,
    phaseStatus: {},
    settings: {},
    status: "draft",
    hazards: null,
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    documentation: null,
    audit: null,
    integration,
  }) as unknown as Project;

const jira = {
  connection: {
    tool: "jira",
    status: "connected",
    credentials: {
      authMethod: "pat",
      baseUrl: "https://example.atlassian.net/",
      email: "someone@example.com",
      accountId: "acc-1",
      projectKey: "SCRUM",
      apiToken: "FAKE-api-token",
      accessToken: "FAKE-oauth-access",
      refreshToken: "FAKE-oauth-refresh",
    },
    lastTested: "2026-09-19T06:47:09.094Z",
    projectName: "SCRUM",
  },
  mapping: { mustPriority: "High", shouldPriority: "Medium", couldPriority: "Low", wontPriority: "Lowest", workItemType: "Task" },
};

describe("prepareForDisk — integration secrets", () => {
  it("removes the Jira token and OAuth tokens, keeps the connection", () => {
    const out = prepareForDisk(project(jira)).integration!;
    expect(out.connection?.credentials).toEqual({
      authMethod: "pat",
      baseUrl: "https://example.atlassian.net/",
      email: "someone@example.com",
      accountId: "acc-1",
      projectKey: "SCRUM",
    });
    expect(out.mapping).toEqual(jira.mapping);
    expect(out.connection?.projectName).toBe("SCRUM");
  });

  it("removes the ADO PAT", () => {
    const ado = {
      connection: {
        tool: "azure-devops",
        status: "connected",
        credentials: { authMethod: "pat", organizationUrl: "https://dev.azure.com/org", personalAccessToken: "FAKE-pat" },
      },
      mapping: null,
    };
    expect(prepareForDisk(project(ado)).integration?.connection?.credentials).toEqual({
      authMethod: "pat",
      organizationUrl: "https://dev.azure.com/org",
    });
  });

  it("no secret-named field anywhere in the written bytes; the in-memory project is untouched", () => {
    const p = project({ ...jira, extra: [{ password: "FAKE-pw", clientSecret: "FAKE-cs", token: "FAKE-t", keep: 1 }] });
    const bytes = serialiseProject(p);
    for (const key of INTEGRATION_SECRET_KEYS) expect(bytes).not.toContain(`"${key}"`);
    expect(bytes).not.toContain("FAKE-");
    expect(bytes).toContain('"keep": 1');
    expect((p.integration as any).connection.credentials.apiToken).toBe("FAKE-api-token");
  });

  it("no integration stays null", () => {
    expect(prepareForDisk(project(null)).integration).toBeNull();
  });
});
