// src/tests/unit/features/audit/services/audit-signer-flow.test.ts
//
// The signer flow is the ONLY writer of the trust root (.tara/allowed_signers).
// These tests pin the contract that matters for an audit tool:
//   - a change is always a SIGNED, path-scoped `audit:` commit on the manifest;
//   - a no-op (key already present / not present) makes NO commit;
//   - an invalid key or a failing git step fails cleanly, never a half-commit;
//   - the LAST signer can never be removed (that would lock the trail).
//
// Pure flow → fake FileIO (in-memory) + vi.fn git steps; no real git.

import { describe, it, expect, vi } from "vitest";
import {
  runAddSigner,
  runRemoveSigner,
  runSetRole,
  type SignerFlowDeps,
} from "features/audit/services/audit-signer-flow";
import {
  allowedSignersPathOf,
  ALLOWED_SIGNERS_REL_PATH,
  parseAllowedSigners,
  serializeAllowedSigners,
  entryFromPubkey,
  isMaintainer,
  maintainers,
} from "features/audit/services/audit-signer-manifest";
import type { AuditConfig } from "features/audit/models/audit-types";

const REPO = "/repo";
const ABS = allowedSignersPathOf(REPO); // /repo/.tara/allowed_signers
const EMAIL = "me@example.com";
const PUB1 = "ssh-ed25519 AAAAKEY1 first key";
const PUB2 = "ssh-ed25519 AAAAKEY2 second key";

const CONFIG = { author: { name: "Me", email: EMAIL } } as unknown as AuditConfig;

/** In-memory FileIO honouring the ENOENT→null contract. */
function fakeFileIO(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(ABS, initial);
  const read = vi.fn(async (p: string) => (store.has(p) ? store.get(p)! : null));
  const write = vi.fn(async (p: string, c: string) => {
    store.set(p, c);
  });
  return { fileIO: { read, write }, read, write, store };
}

function makeDeps(
  fileIO: SignerFlowDeps["fileIO"],
  over: Partial<SignerFlowDeps> = {},
) {
  const stage = vi.fn(async () => ({ success: true as const }));
  const commit = vi.fn(async () => ({
    success: true as const,
    data: { commit: "abc123" } as never,
  }));
  const deps: SignerFlowDeps = { fileIO, stage, commit, ...over };
  return { deps, stage, commit };
}

const manifestWith = (...pubs: string[]) =>
  serializeAllowedSigners(pubs.map((p) => entryFromPubkey(EMAIL, p)));

/** Manifest where the given pubs are maintainers, rest plain. */
const manifestWithMaintainers = (maint: string[], plain: string[] = []) =>
  serializeAllowedSigners([
    ...maint.map((p) => entryFromPubkey(EMAIL, p, { maintainer: true })),
    ...plain.map((p) => entryFromPubkey(EMAIL, p)),
  ]);

describe("runAddSigner", () => {
  it("adds a new signer, writes the manifest, and makes a SIGNED path-scoped audit commit", async () => {
    const { fileIO, write } = fakeFileIO(); // empty repo → read returns null
    const { deps, stage, commit } = makeDeps(fileIO);

    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: PUB1,
    });

    expect(res.ok).toBe(true);

    // manifest written with the key + mandatory git namespace
    expect(write).toHaveBeenCalledTimes(1);
    const written = write.mock.calls[0][1];
    expect(written).toContain('namespaces="git,taraflow-maintainer"');
    expect(
      parseAllowedSigners(written).some((e) => e.keyBlob === "AAAAKEY1"),
    ).toBe(true);

    // staged + committed: signed (true), scoped to the manifest, audit: subject
    expect(stage).toHaveBeenCalledWith([ALLOWED_SIGNERS_REL_PATH]);
    expect(commit).toHaveBeenCalledWith(
      expect.stringContaining("audit:"),
      CONFIG,
      true,
      [ALLOWED_SIGNERS_REL_PATH],
    );
  });

  it("accepts pasted pubkey text the same as file contents (both go through entryFromPubkey)", async () => {
    const { fileIO, write } = fakeFileIO();
    const { deps } = makeDeps(fileIO);
    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: "  ssh-ed25519 AAAAKEY1 pasted-with-whitespace  ",
    });
    expect(res.ok).toBe(true);
    expect(
      parseAllowedSigners(write.mock.calls[0][1]).some(
        (e) => e.keyBlob === "AAAAKEY1",
      ),
    ).toBe(true);
  });

  it("is a no-op when the key is already authorized (no write, no commit)", async () => {
    const { fileIO, write } = fakeFileIO(manifestWith(PUB1));
    const { deps, commit } = makeDeps(fileIO);

    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: PUB1,
    });

    expect(res.ok).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects an invalid public key without writing or committing", async () => {
    const { fileIO, write } = fakeFileIO();
    const { deps, commit } = makeDeps(fileIO);

    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: "definitely-not-a-key",
    });

    expect(res.ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("uses a custom commit subject when given", async () => {
    const { fileIO } = fakeFileIO();
    const { deps, commit } = makeDeps(fileIO);
    await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: PUB1,
      message: "audit: onboard reviewer alice",
    });
    expect(commit).toHaveBeenCalledWith(
      "audit: onboard reviewer alice",
      CONFIG,
      true,
      [ALLOWED_SIGNERS_REL_PATH],
    );
  });

  it("fails cleanly if staging fails (no commit)", async () => {
    const { fileIO } = fakeFileIO();
    const stage = vi.fn(async () => ({
      success: false as const,
      error: "stage boom",
    }));
    const commit = vi.fn(async () => ({
      success: true as const,
      data: {} as never,
    }));
    const res = await runAddSigner(
      { fileIO, stage, commit },
      { repoRoot: REPO, config: CONFIG, principal: EMAIL, pubkey: PUB1 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("stage boom");
    expect(commit).not.toHaveBeenCalled();
  });

  it("fails cleanly if the commit fails", async () => {
    const { fileIO } = fakeFileIO();
    const stage = vi.fn(async () => ({ success: true as const }));
    const commit = vi.fn(async () => ({
      success: false as const,
      error: "commit boom",
    }));
    const res = await runAddSigner(
      { fileIO, stage, commit },
      { repoRoot: REPO, config: CONFIG, principal: EMAIL, pubkey: PUB1 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("commit boom");
  });

  it("fails cleanly if writing the manifest throws (no commit)", async () => {
    const read = vi.fn(async () => null);
    const write = vi.fn(async () => {
      throw new Error("disk full");
    });
    const { deps, commit } = makeDeps({ read, write });
    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: PUB1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("disk full");
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("runRemoveSigner", () => {
  it("removes a signer and commits when others remain", async () => {
    const { fileIO, write } = fakeFileIO(manifestWith(PUB1, PUB2));
    const { deps, stage, commit } = makeDeps(fileIO);

    const res = await runRemoveSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY1",
    });

    expect(res.ok).toBe(true);
    const entries = parseAllowedSigners(write.mock.calls[0][1]);
    expect(entries.some((e) => e.keyBlob === "AAAAKEY1")).toBe(false);
    expect(entries.some((e) => e.keyBlob === "AAAAKEY2")).toBe(true);

    expect(stage).toHaveBeenCalledWith([ALLOWED_SIGNERS_REL_PATH]);
    expect(commit).toHaveBeenCalledWith(
      expect.stringContaining("audit:"),
      CONFIG,
      true,
      [ALLOWED_SIGNERS_REL_PATH],
    );
  });

  it("refuses to remove the LAST signer (would lock the trail — no write, no commit)", async () => {
    const { fileIO, write } = fakeFileIO(manifestWith(PUB1));
    const { deps, commit } = makeDeps(fileIO);

    const res = await runRemoveSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY1",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/last authorized signer/i);
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("is a no-op when the key to remove isn't present", async () => {
    const { fileIO, write } = fakeFileIO(manifestWith(PUB1));
    const { deps, commit } = makeDeps(fileIO);

    const res = await runRemoveSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "NOT-PRESENT",
    });

    expect(res.ok).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("roles (maintainer)", () => {
  it("forces the FIRST signer of an empty manifest to be a maintainer", async () => {
    const { fileIO, write } = fakeFileIO(); // empty
    const { deps } = makeDeps(fileIO);
    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: EMAIL,
      pubkey: PUB1,
      maintainer: false, // ignored — first signer must be maintainer
    });
    expect(res.ok).toBe(true);
    const entries = parseAllowedSigners(write.mock.calls[0][1]);
    expect(maintainers(entries)).toHaveLength(1);
  });

  it("adds a non-maintainer signer once a maintainer exists", async () => {
    const { fileIO, write } = fakeFileIO(manifestWithMaintainers([PUB1]));
    const { deps } = makeDeps(fileIO);
    const res = await runAddSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      principal: "bob@example.com",
      pubkey: PUB2,
    });
    expect(res.ok).toBe(true);
    const entries = parseAllowedSigners(write.mock.calls[0][1]);
    expect(entries.find((e) => e.keyBlob === "AAAAKEY2")!.role).toBeUndefined();
  });

  it("refuses to remove the last maintainer (even if other signers remain)", async () => {
    const { fileIO, write } = fakeFileIO(
      manifestWithMaintainers([PUB1], [PUB2]),
    );
    const { deps, commit } = makeDeps(fileIO);
    const res = await runRemoveSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY1", // the only maintainer
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/last maintainer/i);
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("allows removing a maintainer when another remains (handover)", async () => {
    const { fileIO, write } = fakeFileIO(
      manifestWithMaintainers([PUB1, PUB2]),
    );
    const { deps } = makeDeps(fileIO);
    const res = await runRemoveSigner(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY1",
    });
    expect(res.ok).toBe(true);
    const entries = parseAllowedSigners(write.mock.calls[0][1]);
    expect(maintainers(entries)).toHaveLength(1);
  });

  it("promotes a plain signer to maintainer via runSetRole", async () => {
    const { fileIO, write } = fakeFileIO(
      manifestWithMaintainers([PUB1], [PUB2]),
    );
    const { deps, commit } = makeDeps(fileIO);
    const res = await runSetRole(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY2",
      maintainer: true,
    });
    expect(res.ok).toBe(true);
    const entries = parseAllowedSigners(write.mock.calls[0][1]);
    expect(maintainers(entries)).toHaveLength(2);
    expect(commit).toHaveBeenCalledWith(
      expect.stringContaining("audit:"),
      CONFIG,
      true,
      [ALLOWED_SIGNERS_REL_PATH],
    );
  });

  it("refuses to demote the last maintainer", async () => {
    const { fileIO, write } = fakeFileIO(
      manifestWithMaintainers([PUB1], [PUB2]),
    );
    const { deps } = makeDeps(fileIO);
    const res = await runSetRole(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY1",
      maintainer: false,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/last maintainer/i);
    expect(write).not.toHaveBeenCalled();
  });

  it("setRole is a no-op when the role already matches", async () => {
    const { fileIO, write } = fakeFileIO(manifestWithMaintainers([PUB1]));
    const { deps, commit } = makeDeps(fileIO);
    const res = await runSetRole(deps, {
      repoRoot: REPO,
      config: CONFIG,
      keyType: "ssh-ed25519",
      keyBlob: "AAAAKEY1",
      maintainer: true,
    });
    expect(res.ok).toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});
