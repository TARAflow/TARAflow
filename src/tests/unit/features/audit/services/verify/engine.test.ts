// ============ AUDIT VERIFICATION — ENGINE (ORCHESTRATOR) TESTS ============
// End-to-end over the fake reader: trust walk + all standalone checks assembled
// into a result. If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import { verifyAudit } from "features/audit/services/verify/engine";
import { makePolicy } from "features/audit/services/verify/policy";
import { FakeGitReader, type FakeRepoSpec } from "./git-reader-fake";
import {
  entryFromPubkey,
  serializeAllowedSigners,
} from "features/audit/services/audit-signer-manifest";

const MANIFEST = ".tara/allowed_signers";
const canon = (v: unknown) => JSON.stringify(v);

function manifest(entries: { key: string; maintainer?: boolean }[]): string {
  return serializeAllowedSigners(
    entries.map((e) =>
      entryFromPubkey("u@example.com", `ssh-ed25519 ${e.key}`, {
        maintainer: e.maintainer,
      }),
    ),
  );
}

// A conformant [TARA] message (subject + required trailers).
const taraMsg = (round: string) =>
  `[TARA] ${round}\n\n- Changes:\n  - Threats: 1 items\n\n` +
  `Affected-Phases: Threats\nBatch-Size: 1\nAuthor: Tester\nDate: 2026-01-01T00:00:00Z`;

// Clean, verifiable repo: pre-anchor → anchor(KM maintainer) → a conformant
// signed round. tara.json blobs are canonical under `canon` (minified JSON).
function cleanRepo(overrides?: {
  workingTreeClean?: boolean;
  headDetached?: boolean;
}): FakeRepoSpec {
  const m = manifest([{ key: "KM", maintainer: true }]);
  return {
    commits: [
      { hash: "P0", message: "seed", tree: { "proj.tara.json": '{"v":0}' } },
      {
        hash: "A",
        parents: ["P0"],
        message: "audit: bootstrap signer manifest",
        tree: { [MANIFEST]: m, "proj.tara.json": '{"v":0}' },
        signedBy: "KM",
      },
      {
        hash: "B",
        parents: ["A"],
        message: taraMsg("Detail Review"),
        tree: { [MANIFEST]: m, "proj.tara.json": '{"v":1}' },
        signedBy: "KM",
      },
    ],
    refs: { main: "B", "audit-root": "A" },
    workingTreeClean: overrides?.workingTreeClean,
    headDetached: overrides?.headDetached,
  };
}

const policy = (over?: { ref?: string; strict?: boolean }) =>
  makePolicy({
    bootstrapAnchor: "A",
    ref: over?.ref ?? "main",
    strict: over?.strict,
  });

describe("verifyAudit", () => {
  it("passes a clean, verifiable repo — only a PRE_ANCHOR_COMMITS info", async () => {
    const reader = new FakeGitReader(cleanRepo());
    const res = await verifyAudit({ reader, policy: policy(), canonicalize: canon });
    expect(res.result).toBe("pass");
    expect(res.findings.map((f) => f.id)).toEqual(["PRE_ANCHOR_COMMITS"]);
    expect(res.aveVersion).toBe(1);
  });

  it("fails when the target ref does not resolve (config error)", async () => {
    const reader = new FakeGitReader(cleanRepo());
    const res = await verifyAudit({
      reader,
      policy: policy({ ref: "nope" }),
      canonicalize: canon,
    });
    expect(res.result).toBe("fail");
    expect(res.findings.map((f) => f.id)).toEqual(["ENGINE_ERROR"]);
  });

  it("fails a repo whose anchor introduces no maintainer", async () => {
    const m = manifest([{ key: "KS" }]); // no maintainer
    const reader = new FakeGitReader({
      commits: [
        { hash: "A", message: "audit: bootstrap", tree: { [MANIFEST]: m }, signedBy: "KS" },
      ],
      refs: { main: "A" },
    });
    const res = await verifyAudit({ reader, policy: policy(), canonicalize: canon });
    expect(res.result).toBe("fail");
    expect(res.findings.some((f) => f.id === "MANIFEST_NO_MAINTAINER")).toBe(true);
  });

  it("treats a dirty tree as a warning (pass) — and as an error under strict (fail)", async () => {
    const lax = await verifyAudit({
      reader: new FakeGitReader(cleanRepo({ workingTreeClean: false })),
      policy: policy(),
      canonicalize: canon,
    });
    expect(lax.result).toBe("pass");
    expect(lax.findings.some((f) => f.id === "REPO_DIRTY")).toBe(true);

    const strict = await verifyAudit({
      reader: new FakeGitReader(cleanRepo({ workingTreeClean: false })),
      policy: policy({ strict: true }),
      canonicalize: canon,
    });
    expect(strict.result).toBe("fail");
    expect(strict.strict).toBe(true);
  });

  it("flags a non-canonical committed tara.json via the TCS check", async () => {
    const m = manifest([{ key: "KM", maintainer: true }]);
    const reader = new FakeGitReader({
      commits: [
        {
          hash: "A",
          message: "audit: bootstrap",
          tree: { [MANIFEST]: m, "p.tara.json": '{ "v": 0 }' }, // non-canonical spaces
          signedBy: "KM",
        },
      ],
      refs: { main: "A" },
    });
    const res = await verifyAudit({ reader, policy: policy(), canonicalize: canon });
    expect(res.result).toBe("fail");
    expect(res.findings.some((f) => f.id === "TCS_NONREPRODUCIBLE")).toBe(true);
  });

  it("flags a moved audit-root tag as a warning", async () => {
    const spec = cleanRepo();
    spec.refs = { ...spec.refs, "audit-root": "B" }; // tag moved off the anchor A
    const res = await verifyAudit({
      reader: new FakeGitReader(spec),
      policy: policy(),
      canonicalize: canon,
    });
    expect(res.result).toBe("pass"); // warning, not error
    expect(res.findings.some((f) => f.id === "ANCHOR_TAG_MOVED")).toBe(true);
  });
});
