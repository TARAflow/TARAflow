import { describe, it, expect } from "vitest";
import {
  inferProviderFromUrl,
  readGitDerivedInfo,
  deriveAuditConfigFromGit,
  type GitConfigReader,
} from "audit/services/derive-audit-config";
import {
  DEFAULT_AUDIT_CONFIG,
  type AuditConfig,
} from "audit/models/audit-types";

function fakeGit(map: Record<string, string>): GitConfigReader {
  return {
    raw: async (args) => {
      const key = args.join(" ");
      if (key in map) return { success: true, data: map[key] };
      return { success: false, error: "not set" };
    },
  };
}
const base = (): AuditConfig => structuredClone(DEFAULT_AUDIT_CONFIG);

describe("inferProviderFromUrl", () => {
  it("maps known hosts, else generic (incl. Azure DevOps)", () => {
    expect(inferProviderFromUrl("git@github.com:x/y.git")).toBe("github");
    expect(inferProviderFromUrl("https://gitlab.com/x/y.git")).toBe("gitlab");
    expect(inferProviderFromUrl("git@bitbucket.org:x/y.git")).toBe("bitbucket");
    expect(inferProviderFromUrl("git@ssh.dev.azure.com:v3/org/proj/repo")).toBe("generic");
    expect(inferProviderFromUrl(undefined)).toBe("generic");
  });
});

describe("readGitDerivedInfo", () => {
  it("reads an Azure DevOps repo", async () => {
    const git = fakeGit({
      "remote get-url origin": "git@ssh.dev.azure.com:v3/org/project/repo",
      "config user.name": "Test User",
      "config user.email": "1004272+messi1@users.noreply.github.com",
      "rev-parse --abbrev-ref origin/HEAD": "origin/main",
    });
    const info = await readGitDerivedInfo(git);
    expect(info.remoteUrl).toContain("dev.azure.com");
    expect(info.provider).toBe("generic");
    expect(info.authorName).toBe("Test User");
    expect(info.authorEmail).toBe("1004272+messi1@users.noreply.github.com");
    expect(info.defaultBranch).toBe("main");
    expect(info.signing).toBeUndefined();
  });
  it("derives ssh signing when configured", async () => {
    const git = fakeGit({
      "config user.signingkey": "/home/u/.ssh/id_ed25519.pub",
      "config gpg.format": "ssh",
      "config commit.gpgsign": "true",
    });
    const info = await readGitDerivedInfo(git);
    expect(info.signing).toEqual({
      format: "ssh", enabled: true, sshSigningKeyPath: "/home/u/.ssh/id_ed25519.pub",
    });
  });
});

describe("deriveAuditConfigFromGit (non-destructive)", () => {
  it("fills empty fields + overrides still-default provider/branch", () => {
    const out = deriveAuditConfigFromGit(base(), {
      remoteUrl: "git@ssh.dev.azure.com:v3/o/p/r",
      provider: "generic",
      authorName: "Test User",
      authorEmail: "1004272+messi1@users.noreply.github.com",
      defaultBranch: "main", // equals default → stays main (no-op but fine)
    });
    expect(out.remoteUrl).toBe("git@ssh.dev.azure.com:v3/o/p/r");
    expect(out.provider).toBe("generic"); // overrode default "github"
    expect(out.author).toEqual({
      name: "Test User",
      email: "1004272+messi1@users.noreply.github.com",
    });
  });
  it("never overwrites user-set values", () => {
    const cur = base();
    cur.remoteUrl = "git@github.com:me/mine.git";
    cur.provider = "bitbucket"; // user explicitly chose a NON-default provider
    cur.author = { name: "Set Name", email: "set@x.com" };
    cur.defaultBranch = "develop"; // user changed from default
    const out = deriveAuditConfigFromGit(cur, {
      remoteUrl: "git@evil/other",
      provider: "gitlab",
      authorName: "OTHER",
      authorEmail: "other@x",
      defaultBranch: "main",
    });
    expect(out.remoteUrl).toBe("git@github.com:me/mine.git");
    expect(out.provider).toBe("bitbucket"); // non-default user value kept
    expect(out.author).toEqual({ name: "Set Name", email: "set@x.com" });
    expect(out.defaultBranch).toBe("develop"); // not default → kept
  });
  it("overrides a still-DEFAULT provider/branch with the repo's real values", () => {
    // provider "github" and branch "main" are the package defaults → treated as
    // untouched, so the repo's actual values win (that is the point of auto-fill).
    const out = deriveAuditConfigFromGit(base(), {
      provider: "gitlab",
      defaultBranch: "trunk",
    });
    expect(out.provider).toBe("gitlab");
    expect(out.defaultBranch).toBe("trunk");
  });

  it("pre-fills signing key without auto-enabling", () => {
    const out = deriveAuditConfigFromGit(base(), {
      signing: { format: "ssh", enabled: true, sshSigningKeyPath: "/k.pub" },
    });
    expect(out.signing?.sshSigningKeyPath).toBe("/k.pub");
    expect(out.signing?.format).toBe("ssh");
    expect(out.signing?.enabled).toBe(false); // NOT auto-enabled
  });
  it("does not clobber a configured signing key", () => {
    const cur = base();
    cur.signing = {
      enabled: true,
      format: "ssh",
      sshSigningKeyPath: "/mine.pub",
    };
    const out = deriveAuditConfigFromGit(cur, {
      signing: { format: "gpg", sshSigningKeyPath: "/theirs.pub" },
    });
    expect(out.signing?.sshSigningKeyPath).toBe("/mine.pub");
    expect(out.signing?.format).toBe("ssh"); // untouchedSigning=false → format kept
  });
});