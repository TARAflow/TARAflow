// src/tests/unit/features/audit/services/audit-git-host.test.ts
import { describe, it, expect } from "vitest";
import {
  detectGitHost,
  parseRemote,
} from "features/audit/services/audit-git-host";

describe("detectGitHost", () => {
  it("classifies the known SaaS hosts (ssh + https)", () => {
    expect(detectGitHost("git@github.com:o/r.git")).toBe("github");
    expect(detectGitHost("https://github.com/o/r.git")).toBe("github");
    expect(detectGitHost("git@gitlab.com:o/r.git")).toBe("gitlab");
    expect(detectGitHost("https://bitbucket.org/o/r.git")).toBe("bitbucket");
    expect(detectGitHost("https://dev.azure.com/org/proj/_git/r")).toBe("azure");
  });

  it("is unknown for empty or self-hosted-exotic remotes", () => {
    expect(detectGitHost(undefined)).toBe("unknown");
    expect(detectGitHost("")).toBe("unknown");
    expect(detectGitHost("git@git.mycorp.internal:o/r.git")).toBe("unknown");
  });
});

describe("parseRemote", () => {
  it("parses scp-style SSH", () => {
    expect(parseRemote("git@github.com:acme/widget.git")).toEqual({
      host: "github",
      owner: "acme",
      repo: "widget",
      webUrl: "https://github.com/acme/widget",
    });
  });

  it("parses HTTPS and strips .git", () => {
    expect(parseRemote("https://github.com/acme/widget.git")).toMatchObject({
      owner: "acme",
      repo: "widget",
      webUrl: "https://github.com/acme/widget",
    });
  });

  it("parses ssh:// URL form with a port (host unknown, but owner/repo parsed)", () => {
    expect(
      parseRemote("ssh://git@example.com:2222/acme/widget.git"),
    ).toMatchObject({
      host: "unknown",
      owner: "acme",
      repo: "widget",
      webUrl: "https://example.com/acme/widget",
    });
  });

  it("preserves GitLab subgroups in owner", () => {
    expect(parseRemote("git@gitlab.com:group/sub/widget.git")).toMatchObject({
      host: "gitlab",
      owner: "group/sub",
      repo: "widget",
    });
  });

  it("keeps Azure's /_git/ path in the web URL", () => {
    const r = parseRemote("https://dev.azure.com/org/project/_git/repo");
    expect(r.host).toBe("azure");
    expect(r.repo).toBe("repo");
    expect(r.webUrl).toBe("https://dev.azure.com/org/project/_git/repo");
  });

  it("returns nulls for an unparseable remote", () => {
    expect(parseRemote("not a url")).toEqual({
      host: "unknown",
      owner: null,
      repo: null,
      webUrl: null,
    });
  });
});
