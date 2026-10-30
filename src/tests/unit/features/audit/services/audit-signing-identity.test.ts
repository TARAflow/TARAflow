// src/tests/unit/features/audit/services/audit-signing-identity.test.ts
import { describe, it, expect } from "vitest";
import { checkSigningIdentity, signingGuard } from "features/audit/services/audit-signing-identity";
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

// Review 2026-10-31 (TARAflow_Examples: SIG_UNSIGNED ×3) — with a signer
// manifest every commit is verified, so it must be signed, with a key.

describe("signingGuard", () => {
  const base = { format: "ssh" as const, sshSigningKeyPath: "/k/id_ed25519" };

  it("manifest: unchecked box or signing off in the project → required", () => {
    expect(signingGuard({ ...base, hasManifest: true, signCommit: false, signingEnabled: true })).toBe("signing-required");
    expect(signingGuard({ ...base, hasManifest: true, signCommit: true, signingEnabled: false })).toBe("signing-required");
  });

  it("signing intended but no key → key missing (git would commit unsigned)", () => {
    expect(signingGuard({ format: "ssh", hasManifest: true, signCommit: true, signingEnabled: true })).toBe("key-missing");
    expect(signingGuard({ format: "gpg", hasManifest: false, signCommit: true, signingEnabled: true })).toBe("key-missing");
  });

  it("manifest and a signed commit with a key, or no manifest and unsigned → fine", () => {
    expect(signingGuard({ ...base, hasManifest: true, signCommit: true, signingEnabled: true })).toBeNull();
    expect(signingGuard({ ...base, hasManifest: false, signCommit: false, signingEnabled: false })).toBeNull();
  });
});
