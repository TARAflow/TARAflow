// ============ AUDIT VERIFICATION — GIT READER (exec adapter) ============
// The reference GitReader, backed by real git via child_process. Node-only —
// used by the CLI and by the Electron MAIN process (the engine runs in main; the
// renderer never spawns git). Suggested location:
// src/features/audit/services/verify/git-reader-exec.ts.
//
// It self-provides the single primitive `raw(args) => { stdout, stderr, code }`
// by spawning `git -C <repoDir> <args>` and NEVER throwing on a non-zero exit
// (same contract as the app's `git:rawInDir`), because `verify-commit` exits
// non-zero on an unverifiable signature and that is data, not an exception.
//
// The concrete git plumbing here is the adapter's private choice; the PORT's
// documented properties are the contract (git-reader.ts).

import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type {
  CommitHash,
  CommitInfo,
  ChangedPath,
  GitReader,
  VerifyResult,
} from "./git-reader";

/** Raw git result — mirrors `git:rawInDir`. Never throws on non-zero exit. */
interface RawResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface GitReaderExecOptions {
  /** git binary (default "git"). */
  gitBinary?: string;
  /** Max stdout bytes for a single git call (default 256 MiB — large blobs). */
  maxBuffer?: number;
}

// Record/field separators for the batched `git log`. Unit-separator between
// fields, NUL between records (via `-z`), neither of which occurs in the data.
const US = "\x1f";
const FMT = [
  "%H", // hash
  "%P", // parents (space-separated)
  "%an", // author name
  "%ae", // author email
  "%cn", // committer name
  "%ce", // committer email
  "%cI", // committer date, strict ISO-8601
  "%s", // subject
  "%B", // raw body (may contain newlines; always last)
].join(US);

export function createGitReaderExec(
  repoDir: string,
  options: GitReaderExecOptions = {},
): GitReader {
  const gitBinary = options.gitBinary ?? "git";
  const maxBuffer = options.maxBuffer ?? 256 * 1024 * 1024;

  const raw = (args: string[]): Promise<RawResult> =>
    new Promise((resolve) => {
      execFile(
        gitBinary,
        ["-C", repoDir, ...args],
        { encoding: "utf8", maxBuffer },
        (err, stdout, stderr) => {
          // err is ExecException|null (code: string|number|undefined). A numeric
          // code is git's exit status; a non-numeric/absent code on error means
          // a spawn failure (e.g. git not found) → 127.
          const code =
            err && typeof err.code === "number"
              ? err.code
              : err
                ? 127
                : 0;
          resolve({ stdout: stdout ?? "", stderr: stderr ?? "", code });
        },
      );
    });

  /** Parse a NUL-separated `git log` batch (see FMT) into CommitInfo[]. */
  function parseLog(stdout: string): CommitInfo[] {
    return stdout
      .split("\x00")
      .map((r) => r.replace(/^\n+/, "")) // strip any stray leading newline
      .filter((r) => r.length > 0)
      .map((rec) => {
        const f = rec.split(US);
        const parents = f[1].trim() ? f[1].trim().split(/\s+/) : [];
        return {
          hash: f[0],
          parents,
          author: { name: f[2], email: f[3] },
          committer: { name: f[4], email: f[5] },
          committedAt: f[6],
          subject: f[7],
          message: f[8] ?? "",
        } satisfies CommitInfo;
      });
  }

  const reader: GitReader = {
    async resolveRef(ref) {
      // Peel tags to the underlying commit; --quiet + non-zero exit ⇒ not found.
      const r = await raw([
        "rev-parse",
        "--verify",
        "--quiet",
        `${ref}^{commit}`,
      ]);
      const hash = r.stdout.trim();
      return r.code === 0 && hash ? hash : null;
    },

    async history(anchor, tip) {
      if (!(await reader.isAncestor(anchor, tip))) {
        throw new Error(
          `git-reader-exec: anchor ${anchor} is not an ancestor of tip ${tip}`,
        );
      }
      // Commits AFTER the anchor (oldest first), then prepend the anchor itself.
      const range = await raw([
        "log",
        "-z",
        "--reverse",
        "--topo-order",
        `--format=${FMT}`,
        `${anchor}..${tip}`,
      ]);
      const anchorRec = await raw(["log", "-1", "-z", `--format=${FMT}`, anchor]);
      if (anchorRec.code !== 0) {
        throw new Error(`git-reader-exec: cannot read anchor ${anchor}`);
      }
      return [...parseLog(anchorRec.stdout), ...parseLog(range.stdout)];
    },

    async countAncestors(commit) {
      const r = await raw(["rev-list", "--count", commit]);
      if (r.code !== 0) {
        throw new Error(`git-reader-exec: rev-list --count failed for ${commit}`);
      }
      const total = parseInt(r.stdout.trim(), 10);
      return Number.isFinite(total) ? Math.max(0, total - 1) : 0;
    },

    async readFileAt(commit, path) {
      // A blob at a path in a tree; a missing path exits non-zero → null.
      const r = await raw(["cat-file", "-p", `${commit}:${path}`]);
      return r.code === 0 ? r.stdout : null;
    },

    async changedPaths(commit) {
      // Paths changed vs the first parent; --root shows a root commit's adds.
      const r = await raw([
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--no-renames",
        "--name-status",
        "-r",
        commit,
      ]);
      const out: ChangedPath[] = [];
      for (const line of r.stdout.split("\n")) {
        if (!line.trim()) continue;
        const [statusField, path] = line.split("\t");
        if (!path) continue;
        const s = statusField[0];
        const status: ChangedPath["status"] =
          s === "A" ? "A" : s === "D" ? "D" : "M"; // M, T, and anything else → M
        out.push({ path, status });
      }
      return out.sort((a, b) => a.path.localeCompare(b.path));
    },

    async verifyCommitAgainst(commit, allowedSignersText) {
      // `git verify-commit` exits non-zero and SILENT for an unsigned commit, so
      // it cannot tell "unsigned" from "unverifiable". Detect "unsigned" first,
      // manifest-independently, via %G? == N (N means no signature regardless of
      // the configured allowed_signers).
      const sig = await raw(["log", "-1", "--format=%G?", commit]);
      if (sig.code === 0 && sig.stdout.trim() === "N") return "none";

      // Signed: materialize the historical manifest and verify against exactly
      // it, so the check is faithful, local, and works on a bare clone.
      const tmp = join(
        tmpdir(),
        `taraflow-allowed-signers-${randomBytes(8).toString("hex")}`,
      );
      try {
        await writeFile(tmp, allowedSignersText, "utf8");
        const r = await raw([
          "-c",
          `gpg.ssh.allowedSignersFile=${tmp}`,
          "verify-commit",
          commit,
        ]);
        return classifyVerify(r);
      } catch {
        return "error";
      } finally {
        await unlink(tmp).catch(() => {});
      }
    },

    async isAncestor(ancestor, descendant) {
      const r = await raw([
        "merge-base",
        "--is-ancestor",
        ancestor,
        descendant,
      ]);
      return r.code === 0;
    },

    async isWorkingTreeClean() {
      const r = await raw(["status", "--porcelain"]);
      return r.code === 0 && r.stdout.trim() === "";
    },

    async isHeadDetached() {
      // symbolic-ref succeeds (code 0) on a branch; fails when HEAD is detached.
      const r = await raw(["symbolic-ref", "-q", "HEAD"]);
      return r.code !== 0;
    },
  };

  return reader;
}

/**
 * Map a signed commit's `git verify-commit` result to a VerifyResult (the
 * unsigned case is handled earlier via %G?). Exit 0 ⇒ good (valid + the signer
 * is in the supplied allowed_signers). A git usage error (bad object, not a
 * repo, unreadable signers file) ⇒ error. Any other non-zero exit ⇒ bad
 * (invalid signature or signer not in the manifest — v1 does not separate
 * these). The error patterns vary slightly across git versions; adjust here if a
 * version reports differently.
 */
function classifyVerify(r: RawResult): VerifyResult {
  if (r.code === 0) return "good";
  const out = `${r.stderr}\n${r.stdout}`;
  if (
    /fatal:\s+(bad revision|unknown revision|ambiguous argument|not a git repository|does not exist)/i.test(
      out,
    ) ||
    /allowedsignersfile/i.test(out)
  ) {
    return "error";
  }
  return "bad";
}
