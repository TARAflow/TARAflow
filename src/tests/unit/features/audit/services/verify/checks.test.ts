// ============ AUDIT VERIFICATION — CHECK MODULE TESTS ============
// repo-state, history-shape, tcs-repro, anchor-tag, message-schema, four-eyes,
// protection-attestation — each in isolation. If you use Jest with globals,
// delete the next import line.
import { describe, it, expect } from "vitest";
import { checkRepoState } from "features/audit/services/verify/checks/repo-state";
import { checkHistoryShape } from "features/audit/services/verify/checks/history-shape";
import { checkTcsRepro } from "features/audit/services/verify/checks/tcs-repro";
import { checkAnchorTag } from "features/audit/services/verify/checks/anchor-tag";
import { checkMessageSchema } from "features/audit/services/verify/checks/message-schema";
import { checkFourEyes } from "features/audit/services/verify/checks/four-eyes";
import { checkProtectionAttestation } from "features/audit/services/verify/checks/protection-attestation";
import type { VerifyContext } from "features/audit/services/verify/verify-context";
import type {
  CommitInfo,
  GitReader,
} from "features/audit/services/verify/git-reader";
import { FakeGitReader, type FakeRepoSpec } from "./git-reader-fake";

const ids = (f: { id: string }[]) => f.map((x) => x.id).sort();

/** A compact canonicalize stub: deterministic minified JSON. */
const canon = (v: unknown) => JSON.stringify(v);

/** Build a VerifyContext with the given overrides (unused fields get inert defaults). */
function ctx(over: Partial<VerifyContext>): VerifyContext {
  return {
    reader: over.reader ?? (null as unknown as GitReader),
    anchor: over.anchor ?? "A",
    tip: over.tip ?? "A",
    history: over.history ?? [],
    policy:
      over.policy ??
      {
        bootstrapAnchor: "A",
        ref: "main",
        strict: false,
        mandateFourEyes: false,
        protectedBranches: [],
      },
    canonicalize: over.canonicalize ?? canon,
  };
}

function commit(
  hash: string,
  parents: string[] = [],
  extra: Partial<CommitInfo> = {},
): CommitInfo {
  const message = extra.message ?? hash;
  return {
    hash,
    parents,
    author: extra.author ?? { name: "Alice", email: "alice@x" },
    committer: extra.committer ?? { name: "Alice", email: "alice@x" },
    committedAt: "1970-01-01T00:00:00Z",
    subject: message.split("\n", 1)[0],
    message,
    ...extra,
  };
}

const taraMsg = (round: string, trailers: string[]) =>
  `[TARA] ${round}\n\n- Changes:\n  - Threats: 1 items\n\n${trailers.join("\n")}`;

const FULL_TRAILERS = [
  "Affected-Phases: Threats",
  "Batch-Size: 1",
  "Author: Alice",
  "Date: 2026-01-01T00:00:00Z",
];

// ── repo-state ────────────────────────────────────────────────────────────────
describe("checkRepoState", () => {
  it("is silent for a clean, attached repo", async () => {
    const reader = new FakeGitReader({ commits: [{ hash: "A", tree: {} }] });
    expect(await checkRepoState(ctx({ reader }))).toEqual([]);
  });
  it("flags a dirty working tree", async () => {
    const reader = new FakeGitReader({
      commits: [{ hash: "A", tree: {} }],
      workingTreeClean: false,
    });
    expect(ids(await checkRepoState(ctx({ reader })))).toEqual(["REPO_DIRTY"]);
  });
  it("flags a detached HEAD", async () => {
    const reader = new FakeGitReader({
      commits: [{ hash: "A", tree: {} }],
      headDetached: true,
    });
    expect(ids(await checkRepoState(ctx({ reader })))).toEqual([
      "REPO_DETACHED_HEAD",
    ]);
  });
});

// ── history-shape ─────────────────────────────────────────────────────────────
describe("checkHistoryShape", () => {
  it("is silent for linear history", async () => {
    const history = [commit("A"), commit("B", ["A"]), commit("C", ["B"])];
    expect(await checkHistoryShape(ctx({ history, anchor: "A" }))).toEqual([]);
  });
  it("flags a merge commit as non-linear", async () => {
    const history = [commit("A"), commit("B", ["A"]), commit("M", ["B", "A"])];
    const f = await checkHistoryShape(ctx({ history, anchor: "A" }));
    expect(ids(f)).toEqual(["HISTORY_NONLINEAR"]);
    expect(f[0].commit).toBe("M");
  });
  it("flags a non-anchor orphan (no parents)", async () => {
    const history = [commit("A"), commit("Z")];
    const f = await checkHistoryShape(ctx({ history, anchor: "A" }));
    expect(ids(f)).toEqual(["HISTORY_ORPHAN"]);
    expect(f[0].commit).toBe("Z");
  });
  it("does not flag the anchor's own lack of parents", async () => {
    const history = [commit("A")];
    expect(await checkHistoryShape(ctx({ history, anchor: "A" }))).toEqual([]);
  });
});

// ── tcs-repro ─────────────────────────────────────────────────────────────────
describe("checkTcsRepro", () => {
  function repo(): FakeRepoSpec {
    return {
      commits: [
        { hash: "A", tree: { "ok.tara.json": '{"v":0}', "note.txt": "hi" } },
        {
          hash: "B",
          parents: ["A"],
          tree: { "ok.tara.json": '{ "v": 1 }', "note.txt": "hi" },
        },
        {
          hash: "C",
          parents: ["B"],
          tree: { "ok.tara.json": '{ "v": 1 }', "bad.tara.json": "{not json" },
        },
      ],
      refs: { main: "C", "audit-root": "A" },
    };
  }
  async function run() {
    const reader = new FakeGitReader(repo());
    const history = await reader.history("A", "C");
    return checkTcsRepro(ctx({ reader, history, canonicalize: canon }));
  }
  it("passes a canonical blob, flags a non-canonical one, and a parse error", async () => {
    const f = await run();
    expect(f.map((x) => ({ id: x.id, commit: x.commit }))).toEqual([
      { id: "TCS_NONREPRODUCIBLE", commit: "B" },
      { id: "TCS_PARSE_ERROR", commit: "C" },
    ]);
  });
  it("checks each changed blob exactly once (C-scope-3)", async () => {
    const f = await run();
    const okFindings = f.filter(
      (x) => (x.context as { path?: string })?.path === "ok.tara.json",
    );
    expect(okFindings.map((x) => x.commit)).toEqual(["B"]);
  });
});

// ── anchor-tag ────────────────────────────────────────────────────────────────
describe("checkAnchorTag", () => {
  const repo = (auditRoot?: string): FakeRepoSpec => ({
    commits: [
      { hash: "A", tree: {} },
      { hash: "B", parents: ["A"], tree: {} },
    ],
    refs: { main: "B", ...(auditRoot ? { "audit-root": auditRoot } : {}) },
  });
  it("is silent when the tag points at the anchor", async () => {
    const reader = new FakeGitReader(repo("A"));
    expect(await checkAnchorTag(ctx({ reader, anchor: "A" }))).toEqual([]);
  });
  it("is silent when there is no audit-root tag", async () => {
    const reader = new FakeGitReader(repo());
    expect(await checkAnchorTag(ctx({ reader, anchor: "A" }))).toEqual([]);
  });
  it("flags a moved tag", async () => {
    const reader = new FakeGitReader(repo("B")); // tag on B, anchor is A
    const f = await checkAnchorTag(ctx({ reader, anchor: "A" }));
    expect(ids(f)).toEqual(["ANCHOR_TAG_MOVED"]);
    expect(f[0].context).toEqual({ expected: "A", actual: "B" });
  });
});

// ── message-schema ────────────────────────────────────────────────────────────
describe("checkMessageSchema", () => {
  it("accepts an audit: infra commit (exempt)", async () => {
    const history = [commit("A", [], { message: "audit: bootstrap signer manifest" })];
    expect(await checkMessageSchema(ctx({ history }))).toEqual([]);
  });
  it("accepts a well-formed [TARA] round with all trailers", async () => {
    const history = [
      commit("A", [], { message: taraMsg("Detail Review", FULL_TRAILERS) }),
    ];
    expect(await checkMessageSchema(ctx({ history }))).toEqual([]);
  });
  it("flags a [TARA] round missing trailers", async () => {
    const history = [
      commit("A", [], {
        message: taraMsg("Detail Review", ["Author: Alice"]),
      }),
    ];
    const f = await checkMessageSchema(ctx({ history }));
    expect(ids(f)).toEqual(["MSG_SCHEMA"]);
    expect(f[0].context).toEqual({ missing: ["Affected-Phases", "Batch-Size", "Date"] });
  });
  it("flags a subject that is neither [TARA] nor audit:", async () => {
    const history = [commit("A", [], { message: "random subject" })];
    const f = await checkMessageSchema(ctx({ history }));
    expect(ids(f)).toEqual(["MSG_SCHEMA"]);
  });
});

// ── four-eyes ─────────────────────────────────────────────────────────────────
describe("checkFourEyes", () => {
  const mandate = {
    bootstrapAnchor: "A",
    ref: "main",
    strict: false,
    mandateFourEyes: true,
    protectedBranches: [],
  };
  it("is a no-op when not mandated", async () => {
    const history = [commit("A", [], { message: taraMsg("R", FULL_TRAILERS) })];
    expect(await checkFourEyes(ctx({ history }))).toEqual([]); // default policy: not mandated
  });
  it("flags a [TARA] round with no reviewer", async () => {
    const history = [commit("A", [], { message: taraMsg("R", FULL_TRAILERS) })];
    const f = await checkFourEyes(ctx({ history, policy: mandate }));
    expect(ids(f)).toEqual(["REVIEW_MISSING"]);
  });
  it("accepts a reviewer different from the author", async () => {
    const history = [
      commit("A", [], {
        message: taraMsg("R", [...FULL_TRAILERS, "Reviewed-by: Bob"]),
      }),
    ];
    expect(await checkFourEyes(ctx({ history, policy: mandate }))).toEqual([]);
  });
  it("flags self-review (reviewer == author)", async () => {
    const history = [
      commit("A", [], {
        author: { name: "Alice", email: "alice@x" },
        message: taraMsg("R", [...FULL_TRAILERS, "Reviewed-by: Alice"]),
      }),
    ];
    const f = await checkFourEyes(ctx({ history, policy: mandate }));
    expect(ids(f)).toEqual(["REVIEW_SELF"]);
  });
  it("does not apply to audit: infra commits", async () => {
    const history = [commit("A", [], { message: "audit: authorize signer X" })];
    expect(await checkFourEyes(ctx({ history, policy: mandate }))).toEqual([]);
  });
});

// ── protection-attestation ────────────────────────────────────────────────────
describe("checkProtectionAttestation", () => {
  it("is silent when no protected branches are configured", async () => {
    expect(await checkProtectionAttestation(ctx({}))).toEqual([]);
  });
  it("emits an info when protected branches are configured", async () => {
    const policy = {
      bootstrapAnchor: "A",
      ref: "main",
      strict: false,
      mandateFourEyes: false,
      protectedBranches: ["main", "audit"],
    };
    const f = await checkProtectionAttestation(ctx({ policy }));
    expect(ids(f)).toEqual(["PROTECTION_ATTESTATION"]);
    expect(f[0].severity).toBe("info");
    expect(f[0].context).toEqual({ branches: ["main", "audit"] });
  });
});
