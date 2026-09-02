// src/tests/unit/source-binding-service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SourceBinding } from "shared";
import {
  extractRepoHost,
  isHostApproved,
  approveHost,
  resolveSourceBinding,
  _resetApprovedHostsForTests,
} from "features/overview/services/source-binding-service";

const binding: SourceBinding = {
  id: "b-1",
  repoUrl: "https://github.com/org/repo.git",
  refType: "tag",
  refLabel: "v2.3.1",
  driftEvents: [],
};

describe("extractRepoHost", () => {
  it.each([
    ["https://github.com/org/repo.git", "github.com"],
    ["http://gitlab.internal.example.com/org/repo.git", "gitlab.internal.example.com"],
    ["git@github.com:org/repo.git", "github.com"],
    [
      "ssh://git@gitlab.internal.example.com:2222/org/repo.git",
      "gitlab.internal.example.com",
    ],
    ["git://github.com/org/repo.git", "github.com"],
  ])("extracts the host from %s", (repoUrl, expectedHost) => {
    expect(extractRepoHost(repoUrl)).toBe(expectedHost);
  });

  it("falls back to the raw input for an unparseable value", () => {
    expect(extractRepoHost("not-a-url")).toBe("not-a-url");
  });
});

describe("consent tracking", () => {
  beforeEach(() => {
    _resetApprovedHostsForTests();
  });

  it("starts with no host approved", () => {
    expect(isHostApproved("github.com")).toBe(false);
  });

  it("remembers an approved host", () => {
    approveHost("github.com");
    expect(isHostApproved("github.com")).toBe(true);
    expect(isHostApproved("gitlab.com")).toBe(false);
  });
});

describe("resolveSourceBinding", () => {
  beforeEach(() => {
    _resetApprovedHostsForTests();
    (window as any).git = { resolveRemoteRef: vi.fn() };
  });

  it("asks for consent exactly once per host, not on a second call to the same host", async () => {
    const onConsentRequired = vi.fn().mockResolvedValue(true);
    (window as any).git.resolveRemoteRef.mockResolvedValue({
      success: true,
      data: { reachable: true, sha: "abc1234" },
    });

    await resolveSourceBinding(binding, onConsentRequired);
    await resolveSourceBinding(binding, onConsentRequired);

    expect(onConsentRequired).toHaveBeenCalledTimes(1);
    expect(onConsentRequired).toHaveBeenCalledWith("github.com");
  });

  it("does not call window.git at all when consent is denied", async () => {
    const onConsentRequired = vi.fn().mockResolvedValue(false);

    const result = await resolveSourceBinding(binding, onConsentRequired);

    expect(result).toEqual({
      success: false,
      reachable: false,
      error: "consent_denied",
    });
    expect((window as any).git.resolveRemoteRef).not.toHaveBeenCalled();
  });

  it("skips the consent prompt for an already-approved host", async () => {
    approveHost("github.com");
    const onConsentRequired = vi.fn();
    (window as any).git.resolveRemoteRef.mockResolvedValue({
      success: true,
      data: { reachable: true, sha: "abc1234" },
    });

    await resolveSourceBinding(binding, onConsentRequired);

    expect(onConsentRequired).not.toHaveBeenCalled();
  });

  it("returns the resolved sha on success", async () => {
    approveHost("github.com");
    (window as any).git.resolveRemoteRef.mockResolvedValue({
      success: true,
      data: { reachable: true, sha: "deadbeef" },
    });

    const result = await resolveSourceBinding(binding, vi.fn());

    expect(result).toEqual({
      success: true,
      reachable: true,
      sha: "deadbeef",
    });
  });

  it("reports reachable-but-not-found distinctly from unreachable", async () => {
    approveHost("github.com");
    (window as any).git.resolveRemoteRef.mockResolvedValue({
      success: true,
      data: { reachable: true, sha: null },
    });

    const result = await resolveSourceBinding(binding, vi.fn());

    expect(result).toEqual({ success: true, reachable: true, sha: null });
  });

  it("surfaces an unreachable host as reachable: false with the IPC error", async () => {
    approveHost("github.com");
    (window as any).git.resolveRemoteRef.mockResolvedValue({
      success: false,
      data: { reachable: false, sha: null },
      error: "getaddrinfo ENOTFOUND github.com",
    });

    const result = await resolveSourceBinding(binding, vi.fn());

    expect(result).toEqual({
      success: false,
      reachable: false,
      error: "getaddrinfo ENOTFOUND github.com",
    });
  });
});
