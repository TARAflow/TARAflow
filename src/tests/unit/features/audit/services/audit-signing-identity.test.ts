// src/tests/unit/features/audit/services/audit-signing-identity.test.ts
import { describe, it, expect, vi } from "vitest";
import { checkSigningIdentity, commitSigning } from "features/audit/services/audit-signing-identity";
import { loadCommittedManifest, loadManifestAnchored, loadSigningState } from "features/audit/services/audit-prev-state";
import { entryFromPubkey } from "features/audit/services/audit-signer-manifest";

const alice = entryFromPubkey("alice@example.com", "ssh-ed25519 AAAA", {
  maintainer: true,
});
const bob = entryFromPubkey("bob@example.com", "ssh-ed25519 BBBB");

describe("checkSigningIdentity", () => {
  it("ok when the author email is any principal in the manifest", () => {
    expect(
      checkSigningIdentity({
        authorEmail: "bob@example.com",
        manifestEntries: [alice, bob],
      }),
    ).toEqual({ ok: true });
  });

  it("not ok when the author email is absent", () => {
    expect(
      checkSigningIdentity({
        authorEmail: "carol@example.com",
        manifestEntries: [alice, bob],
      }),
    ).toEqual({ ok: false, reason: "email-not-authorized" });
  });

  it("not ok on an empty manifest", () => {
    expect(
      checkSigningIdentity({
        authorEmail: "alice@example.com",
        manifestEntries: [],
      }),
    ).toEqual({ ok: false, reason: "empty-manifest" });
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(
      checkSigningIdentity({
        authorEmail: "  ALICE@Example.com ",
        manifestEntries: [alice],
      }),
    ).toEqual({ ok: true });
  });
});

// Reviews 2026-10-31 (TARAflow_Examples: SIG_UNSIGNED ×3, guard read the
// working tree) — one truth, the manifest committed at HEAD: with it every
// commit is signed, with a key and an authorized author email.
const MANIFEST = 'alice@example.com namespaces="git" ssh-ed25519 AAAA\n';

describe("commitSigning", () => {
  const base = { format: "ssh" as const, sshSigningKeyPath: "/k/id_ed25519", authorEmail: "alice@example.com" };

  it("a committed manifest: signed whatever the switch and the box say", () => {
    const d = commitSigning({ ...base, committedManifest: MANIFEST, signCommit: false, signingEnabled: false });
    expect(d).toEqual({ required: true, sign: true, problem: null });
  });

  it("a committed manifest but no key: key missing (git would commit unsigned)", () => {
    const d = commitSigning({ format: "ssh", authorEmail: "alice@example.com", committedManifest: MANIFEST, signCommit: true, signingEnabled: true });
    expect(d.problem).toBe("key-missing");
  });

  it("an author not in the COMMITTED manifest is not authorized (a working-tree entry does not count)", () => {
    const d = commitSigning({ ...base, authorEmail: "bob@example.com", committedManifest: MANIFEST, signCommit: true, signingEnabled: true });
    expect(d.problem).toBe("email-not-authorized");
  });

  it("once the repository signs, it always signs — the manifest removed since: required, 'manifest-removed'", () => {
    const d = commitSigning({ ...base, committedManifest: null, anchored: true, signCommit: false, signingEnabled: false });
    expect(d).toEqual({ required: true, sign: true, problem: "manifest-removed" });
  });

  it("no manifest at HEAD and none in the history: the project's choice", () => {
    expect(commitSigning({ ...base, committedManifest: null, signCommit: false, signingEnabled: true })).toEqual({
      required: false,
      sign: false,
      problem: null,
    });
    expect(commitSigning({ ...base, committedManifest: null, signCommit: true, signingEnabled: true }).problem).toBe("empty-manifest");
  });
});

describe("loadCommittedManifest", () => {
  it("reads .tara/allowed_signers from HEAD, not the working tree", async () => {
    const raw = vi.fn().mockResolvedValue({ success: true, data: MANIFEST });
    expect(await loadCommittedManifest(raw)).toBe(MANIFEST);
    expect(raw).toHaveBeenCalledWith(["show", "HEAD:.tara/allowed_signers"]);
  });

  it("none at HEAD or a git error → null", async () => {
    expect(await loadCommittedManifest(vi.fn().mockResolvedValue({ success: false, error: "fatal: path not in HEAD" }))).toBeNull();
    expect(await loadCommittedManifest(vi.fn().mockRejectedValue(new Error("unborn HEAD")))).toBeNull();
  });
});

describe("loadManifestAnchored", () => {
  it("true once the history introduced .tara/allowed_signers", async () => {
    const raw = vi.fn().mockResolvedValue({ success: true, data: "abc123\n" });
    expect(await loadManifestAnchored(raw)).toBe(true);
    expect(raw).toHaveBeenCalledWith(["log", "HEAD", "--diff-filter=A", "--format=%H", "--", ".tara/allowed_signers"]);
  });

  it("never introduced, or a git error → false", async () => {
    expect(await loadManifestAnchored(vi.fn().mockResolvedValue({ success: true, data: "" }))).toBe(false);
    expect(await loadManifestAnchored(vi.fn().mockRejectedValue(new Error("no repo")))).toBe(false);
  });
});

describe("loadSigningState — the branch the commit goes to", () => {
  it("reads manifest and anchor of the given ref, not HEAD", async () => {
    const raw = vi.fn(async (args: string[]) =>
      args[0] === "show" ? { success: true, data: MANIFEST } : { success: true, data: "abc\n" },
    );
    expect(await loadSigningState(raw, "release")).toEqual({ manifest: MANIFEST, anchored: true });
    expect(raw).toHaveBeenCalledWith(["show", "release:.tara/allowed_signers"]);
    expect(raw).toHaveBeenCalledWith(["log", "release", "--diff-filter=A", "--format=%H", "--", ".tara/allowed_signers"]);
  });
});
