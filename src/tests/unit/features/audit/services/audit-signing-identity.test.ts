// src/tests/unit/features/audit/services/audit-signing-identity.test.ts
import { describe, it, expect } from "vitest";
import { checkSigningIdentity } from "features/audit/services/audit-signing-identity";
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
