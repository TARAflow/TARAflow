// ================ AUDIT VERIFICATION — IN-MEMORY GIT READER (FAKE) ============
// A GitReader backed by plain data, so the engine core (trust-walk, checks) is
// unit-testable with no real repo and no child processes. Suggested location:
// features/audit/services/verify/testing/git-reader-fake.ts.
//
// The test author describes a repository as a list of commits, each with a FULL
// tree snapshot (what exists at that commit) and an optional fake signing key.
// The fake derives changed paths by diffing snapshots, models signature
// verification by membership of the signing key in the supplied allowed_signers
// text (mirroring how git matches by KEY), and answers ancestry from the parent
// links. It parses manifests with the REAL parser so it stays honest about the
// manifest format.

import { parseAllowedSigners } from "features/audit/services/audit-signer-manifest";
import type {
  CommitHash,
  CommitInfo,
  ChangedPath,
  GitReader,
  Identity,
  VerifyResult,
} from "features/audit/services/verify/git-reader";

/** One commit in a fake repo. `tree` is the FULL snapshot at this commit. */
export interface FakeCommitSpec {
  hash: CommitHash;
  parents?: CommitHash[];
  author?: Identity;
  committer?: Identity;
  committedAt?: string;
  /** Full raw message; subject is derived from the first line. */
  message?: string;
  /** path -> content present in this commit's tree. Absent path = not present. */
  tree?: Record<string, string>;
  /**
   * Fake signing-key token = the `keyBlob` a manifest entry would carry for
   * this signer. undefined/null ⇒ the commit is unsigned. Membership of this
   * token in a supplied manifest decides "good" vs "bad".
   */
  signedBy?: string | null;
  /** Model a cryptographically INVALID signature (verifies "bad" everywhere). */
  badSignature?: boolean;
}

export interface FakeRepoSpec {
  commits: FakeCommitSpec[];
  /** ref name -> hash, e.g. `{ main: <tip>, "audit-root": <anchor> }`. */
  refs?: Record<string, CommitHash>;
  /** default true */
  workingTreeClean?: boolean;
  /** default false */
  headDetached?: boolean;
}

const DEFAULT_AUTHOR: Identity = { name: "Test", email: "test@example.com" };

export class FakeGitReader implements GitReader {
  private readonly byHash = new Map<CommitHash, FakeCommitSpec>();
  private readonly refs: Record<string, CommitHash>;
  private readonly clean: boolean;
  private readonly detached: boolean;

  constructor(spec: FakeRepoSpec) {
    for (const c of spec.commits) {
      if (this.byHash.has(c.hash)) {
        throw new Error(`FakeGitReader: duplicate commit ${c.hash}`);
      }
      this.byHash.set(c.hash, c);
    }
    this.refs = spec.refs ?? {};
    this.clean = spec.workingTreeClean ?? true;
    this.detached = spec.headDetached ?? false;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private get(hash: CommitHash): FakeCommitSpec {
    const c = this.byHash.get(hash);
    if (!c) throw new Error(`FakeGitReader: unknown commit ${hash}`);
    return c;
  }

  /** Ancestors-or-self of `hash` (the reachable set via parent links). */
  private reachable(hash: CommitHash): Set<CommitHash> {
    const seen = new Set<CommitHash>();
    const stack = [hash];
    while (stack.length) {
      const h = stack.pop()!;
      if (seen.has(h)) continue;
      seen.add(h);
      for (const p of this.get(h).parents ?? []) stack.push(p);
    }
    return seen;
  }

  private info(c: FakeCommitSpec): CommitInfo {
    const message = c.message ?? "";
    return {
      hash: c.hash,
      parents: c.parents ?? [],
      author: c.author ?? DEFAULT_AUTHOR,
      committer: c.committer ?? c.author ?? DEFAULT_AUTHOR,
      committedAt: c.committedAt ?? "1970-01-01T00:00:00Z",
      subject: message.split("\n", 1)[0],
      message,
    };
  }

  // ── GitReader ──────────────────────────────────────────────────────────────

  async resolveRef(ref: string): Promise<CommitHash | null> {
    const stripped = ref.replace(/^refs\/(tags|heads)\//, "");
    return this.refs[ref] ?? this.refs[stripped] ?? null;
  }

  async history(anchor: CommitHash, tip: CommitHash): Promise<CommitInfo[]> {
    this.get(anchor);
    this.get(tip);
    if (!(await this.isAncestor(anchor, tip))) {
      throw new Error(
        `FakeGitReader: anchor ${anchor} is not an ancestor of tip ${tip}`,
      );
    }
    // The induced set: commits that are ancestors-or-self of tip AND have anchor
    // as an ancestor-or-self. Then order topologically (parents before child).
    const ancestorsOfTip = this.reachable(tip);
    const inSet = new Set<CommitHash>();
    for (const h of ancestorsOfTip) {
      if (this.reachable(h).has(anchor)) inSet.add(h);
    }

    // Kahn topological sort restricted to inSet.
    const indeg = new Map<CommitHash, number>();
    for (const h of inSet) {
      const parentsInSet = (this.get(h).parents ?? []).filter((p) =>
        inSet.has(p),
      );
      indeg.set(h, parentsInSet.length);
    }
    const ready = [...inSet].filter((h) => (indeg.get(h) ?? 0) === 0);
    // Stable order among ready nodes: by hash, so output is deterministic.
    ready.sort();
    const order: CommitHash[] = [];
    const children = new Map<CommitHash, CommitHash[]>();
    for (const h of inSet) {
      for (const p of (this.get(h).parents ?? []).filter((x) => inSet.has(x))) {
        (children.get(p) ?? children.set(p, []).get(p)!).push(h);
      }
    }
    while (ready.length) {
      const h = ready.shift()!;
      order.push(h);
      for (const child of (children.get(h) ?? []).sort()) {
        const d = (indeg.get(child) ?? 0) - 1;
        indeg.set(child, d);
        if (d === 0) {
          ready.push(child);
          ready.sort();
        }
      }
    }
    return order.map((h) => this.info(this.get(h)));
  }

  async countAncestors(commit: CommitHash): Promise<number> {
    // reachable() includes the commit itself; ancestors = size - 1.
    return this.reachable(commit).size - 1;
  }

  async readFileAt(
    commit: CommitHash,
    path: string,
  ): Promise<string | null> {
    return this.get(commit).tree?.[path] ?? null;
  }

  async changedPaths(commit: CommitHash): Promise<ChangedPath[]> {
    const c = this.get(commit);
    const tree = c.tree ?? {};
    const parents = c.parents ?? [];
    // Root: everything in the tree is added.
    const parentTree = parents.length
      ? this.get(parents[0]).tree ?? {}
      : {};

    const out: ChangedPath[] = [];
    for (const path of Object.keys(tree)) {
      if (!(path in parentTree)) out.push({ path, status: "A" });
      else if (parentTree[path] !== tree[path]) out.push({ path, status: "M" });
    }
    for (const path of Object.keys(parentTree)) {
      if (!(path in tree)) out.push({ path, status: "D" });
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async verifyCommitAgainst(
    commit: CommitHash,
    allowedSignersText: string,
  ): Promise<VerifyResult> {
    const c = this.get(commit);
    if (c.signedBy === undefined || c.signedBy === null) return "none";
    if (c.badSignature) return "bad"; // cryptographically invalid, everywhere
    const authorized = parseAllowedSigners(allowedSignersText).some(
      (e) => e.keyBlob === c.signedBy,
    );
    return authorized ? "good" : "bad";
  }

  async isAncestor(
    ancestor: CommitHash,
    descendant: CommitHash,
  ): Promise<boolean> {
    return this.reachable(descendant).has(ancestor);
  }

  async isWorkingTreeClean(): Promise<boolean> {
    return this.clean;
  }

  async isHeadDetached(): Promise<boolean> {
    return this.detached;
  }
}
