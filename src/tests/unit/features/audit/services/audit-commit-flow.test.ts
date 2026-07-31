// ==================== AUDIT COMMIT FLOW — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect, vi } from "vitest";
import {
  runCommitFlow,
  type CommitFlowDeps,
} from "features/audit/services/audit-commit-flow";
import type { AuditConfig, CommitOptions } from "features/audit/models/audit-types";

const okRes = (data?: any) => ({ success: true, data });
const failRes = (error: string) => ({ success: false, error });

function deps(over: Partial<CommitFlowDeps> = {}): CommitFlowDeps {
  return {
    stage: async () => okRes(),
    createBranch: async () => okRes(),
    checkoutBranch: async () => okRes(),
    commit: async () => okRes({ commit: "abc123" }),
    push: async () => okRes({}),
    ...over,
  };
}

const opts = (o: Partial<CommitOptions> = {}): CommitOptions => ({
  branchName: "main",
  createBranch: false,
  message: "msg",
  roundName: "Detail Review",
  signCommit: true,
  pushAfterCommit: false,
  ...o,
});

const cfg = (o: Partial<AuditConfig> = {}): AuditConfig =>
  ({ remoteUrl: "", author: { name: "J", email: "j@x" }, ...o }) as AuditConfig;

describe("runCommitFlow", () => {
  it("commits on the current branch and returns the hash", async () => {
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(deps(), {
      options: opts(),
      config: cfg(),
      currentBranch: "main",
      relPaths,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.commit.commit).toBe("abc123");
      expect(r.branchName).toBe("main");
    }
  });

  it("passes the per-commit signCommit flag through to commit()", async () => {
    const commit = vi.fn(async () => okRes({ commit: "x" }));
    const relPaths = ["audit/report.md"];
    await runCommitFlow(deps({ commit }), {
      options: opts({ signCommit: true }),
      config: cfg(),
      currentBranch: "main",
      relPaths,
    });
    expect(commit).toHaveBeenCalledWith(
      "msg",
      expect.anything(),
      true,
      expect.anything(),
    );

    const commit2 = vi.fn(async () => okRes({ commit: "x" }));
    await runCommitFlow(deps({ commit: commit2 }), {
      options: opts({ signCommit: false }),
      config: cfg(),
      currentBranch: "main",
      relPaths,
    });
    expect(commit2).toHaveBeenCalledWith(
      "msg",
      expect.anything(),
      false,
      expect.anything(),
    );
  });

  it("creates a new branch when requested", async () => {
    const createBranch = vi.fn(async () => okRes());
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(deps({ createBranch }), {
      options: opts({ createBranch: true, branchName: "risk-round-2" }),
      config: cfg(),
      currentBranch: "main",
      relPaths,
    });
    expect(r.ok).toBe(true);
    expect(createBranch).toHaveBeenCalledWith("risk-round-2", true);
  });

  it("checks out an existing branch that isn't current", async () => {
    const checkoutBranch = vi.fn(async () => okRes());
    const relPaths = ["audit/report.md"];
    await runCommitFlow(deps({ checkoutBranch }), {
      options: opts({ branchName: "dev" }),
      config: cfg(),
      currentBranch: "main",
      relPaths,
    });
    expect(checkoutBranch).toHaveBeenCalledWith("dev");
  });

  it("pushes when a remote is set and push is requested", async () => {
    const push = vi.fn(async () => okRes({}));
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(deps({ push }), {
      options: opts({ pushAfterCommit: true }),
      config: cfg({ remoteUrl: "https://x/y.git" }),
      currentBranch: "main",
      relPaths,
    });
    expect(push).toHaveBeenCalledWith("origin", "main", expect.anything());
    expect(r.ok && r.pushWarning).toBeFalsy();
  });

  it("treats a push failure as a non-fatal warning", async () => {
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(
      deps({ push: async () => failRes("auth denied") }),
      {
        options: opts({ pushAfterCommit: true }),
        config: cfg({ remoteUrl: "https://x/y.git" }),
        currentBranch: "main",
        relPaths,
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pushWarning).toMatch(/auth denied/);
  });

  it("does not push when no remote is configured", async () => {
    const push = vi.fn(async () => okRes({}));
    const relPaths = ["audit/report.md"];
    await runCommitFlow(deps({ push }), {
      options: opts({ pushAfterCommit: true }),
      config: cfg({ remoteUrl: "" }),
      currentBranch: "main",
      relPaths,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("fails (without committing) when staging fails", async () => {
    const commit = vi.fn(async () => okRes({ commit: "x" }));
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(
      deps({ stage: async () => failRes("dirty"), commit }),
      {
        options: opts(),
        config: cfg(),
        currentBranch: "main",
        relPaths,
      },
    );
    expect(r.ok).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it("fails when the commit itself fails", async () => {
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(
      deps({ commit: async () => failRes("nothing to commit") }),
      {
        options: opts(),
        config: cfg(),
        currentBranch: "main",
        relPaths,
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/nothing to commit/);
  });

  it("fails (without committing) when branch creation fails", async () => {
    const commit = vi.fn(async () => okRes({ commit: "x" }));
    const relPaths = ["audit/report.md"];
    const r = await runCommitFlow(
      deps({ createBranch: async () => failRes("exists"), commit }),
      {
        options: opts({ createBranch: true, branchName: "b" }),
        config: cfg(),
        currentBranch: "main",
        relPaths,
      },
    );
    expect(r.ok).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });
});
