// src/tests/unit/features/audit/services/audit-signer-manifest.test.ts
//
// The pure trust-root model: parsing, byte-stable serialization, authorization,
// and mutation. The flow (audit-signer-flow) is tested separately; this pins
// the primitives it stands on. Byte-stability matters because a manifest commit
// must show only the real add/remove, never reordering noise.

import { describe, it, expect } from "vitest";
import {
  parseAllowedSigners,
  serializeAllowedSigners,
  isAuthorized,
  addSigner,
  removeSigner,
  entryFromPubkey,
  allowedSignersPathOf,
  ALLOWED_SIGNERS_REL_PATH,
  type SignerEntry,
} from "features/audit/services/audit-signer-manifest";

const EMAIL = "me@example.com";
const PUB_ED = "ssh-ed25519 AAAAKEYED trailing comment";
const PUB_RSA = "ssh-rsa AAAAKEYRSA";

describe("parse / serialize", () => {
  it("parses a normal allowed_signers line into its parts", () => {
    const [e] = parseAllowedSigners(
      'me@example.com namespaces="git" ssh-ed25519 AAAAKEYED a comment',
    );
    expect(e).toEqual({
      principal: "me@example.com",
      options: 'namespaces="git"',
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEYED",
      comment: "a comment",
    });
  });

  it("skips blank lines and # comments", () => {
    const text = [
      "# this is a comment",
      "",
      '  me@example.com namespaces="git" ssh-ed25519 AAAAKEYED',
      "   ",
    ].join("\n");
    expect(parseAllowedSigners(text)).toHaveLength(1);
  });

  it("drops malformed lines (no key field / no blob)", () => {
    const text = [
      "me@example.com namespaces=\"git\"", // no key
      "ssh-ed25519 AAAAKEYED", // no principal before the key
      "me@example.com namespaces=\"git\" ssh-ed25519", // no blob
    ].join("\n");
    expect(parseAllowedSigners(text)).toHaveLength(0);
  });

  it("round-trips: parse(serialize(x)) preserves the entries", () => {
    const entries = [
      entryFromPubkey(EMAIL, PUB_ED),
      entryFromPubkey("her@example.com", PUB_RSA),
    ];
    const round = parseAllowedSigners(serializeAllowedSigners(entries));
    // sorted, but set-equal
    expect(round).toHaveLength(2);
    expect(round.map((e) => e.keyBlob).sort()).toEqual(
      ["AAAAKEYED", "AAAAKEYRSA"].sort(),
    );
  });

  it("serializes byte-stably regardless of input order (sorted by principal, then key)", () => {
    const a = entryFromPubkey("b@example.com", "ssh-ed25519 BBBB");
    const b = entryFromPubkey("a@example.com", "ssh-ed25519 AAAA");
    const c = entryFromPubkey("a@example.com", "ssh-ed25519 ZZZZ");
    expect(serializeAllowedSigners([a, b, c])).toBe(
      serializeAllowedSigners([c, a, b]),
    );
    // and the order is principal-then-key
    const out = serializeAllowedSigners([a, b, c]);
    expect(out.indexOf("a@example.com ")).toBeLessThan(
      out.indexOf("b@example.com "),
    );
    expect(out.indexOf("AAAA")).toBeLessThan(out.indexOf("ZZZZ"));
  });

  it("ends with exactly one trailing newline (LF), and empty → empty string", () => {
    const out = serializeAllowedSigners([entryFromPubkey(EMAIL, PUB_ED)]);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
    expect(out).not.toContain("\r");
    expect(serializeAllowedSigners([])).toBe("");
  });
});

describe("entryFromPubkey", () => {
  it("forces namespaces=\"git\" (git won't verify a commit signature without it)", () => {
    expect(entryFromPubkey(EMAIL, PUB_ED).options).toBe('namespaces="git"');
  });

  it("keeps the pubkey comment and splits type/blob", () => {
    const e = entryFromPubkey(EMAIL, PUB_ED);
    expect(e.keyType).toBe("ssh-ed25519");
    expect(e.keyBlob).toBe("AAAAKEYED");
    expect(e.comment).toBe("trailing comment");
  });

  it("trims surrounding whitespace on pasted input", () => {
    expect(entryFromPubkey(EMAIL, "  ssh-ed25519 AAAAKEYED  ").keyBlob).toBe(
      "AAAAKEYED",
    );
  });

  it("rejects non-key input", () => {
    expect(() => entryFromPubkey(EMAIL, "not a key")).toThrow();
    expect(() => entryFromPubkey(EMAIL, "")).toThrow();
  });
});

describe("isAuthorized", () => {
  const entries = [entryFromPubkey(EMAIL, PUB_ED)];
  it("is true for a present key", () => {
    expect(isAuthorized(entries, "ssh-ed25519", "AAAAKEYED")).toBe(true);
  });
  it("is false for an absent key", () => {
    expect(isAuthorized(entries, "ssh-ed25519", "OTHER")).toBe(false);
    expect(isAuthorized([], "ssh-ed25519", "AAAAKEYED")).toBe(false);
  });
});

describe("addSigner / removeSigner (pure, immutable)", () => {
  it("adds a new signer without mutating the input", () => {
    const before: SignerEntry[] = [entryFromPubkey(EMAIL, PUB_ED)];
    const after = addSigner(before, entryFromPubkey("x@example.com", PUB_RSA));
    expect(after).toHaveLength(2);
    expect(before).toHaveLength(1); // untouched
  });

  it("is a no-op (same reference) when principal+key already present", () => {
    const before: SignerEntry[] = [entryFromPubkey(EMAIL, PUB_ED)];
    const after = addSigner(before, entryFromPubkey(EMAIL, PUB_ED));
    expect(after).toBe(before);
  });

  it("removes every entry with the given key", () => {
    const before = [
      entryFromPubkey(EMAIL, PUB_ED),
      entryFromPubkey("x@example.com", PUB_RSA),
    ];
    const after = removeSigner(before, "ssh-ed25519", "AAAAKEYED");
    expect(after).toHaveLength(1);
    expect(after[0].keyBlob).toBe("AAAAKEYRSA");
    expect(before).toHaveLength(2); // untouched
  });
});

describe("path helpers", () => {
  it("builds the manifest path under .tara with the root's separator", () => {
    expect(allowedSignersPathOf("/home/jpm/repo")).toBe(
      "/home/jpm/repo/.tara/allowed_signers",
    );
    expect(allowedSignersPathOf("/home/jpm/repo/")).toBe(
      "/home/jpm/repo/.tara/allowed_signers",
    );
    expect(allowedSignersPathOf("C:\\repo")).toBe(
      "C:\\repo\\.tara\\allowed_signers",
    );
  });

  it("exposes the repo-relative POSIX pathspec", () => {
    expect(ALLOWED_SIGNERS_REL_PATH).toBe(".tara/allowed_signers");
  });
});
