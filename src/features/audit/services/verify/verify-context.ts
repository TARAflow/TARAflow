// ==================== AUDIT VERIFICATION — CHECK CONTEXT ====================
// The read-only context every standalone check receives, plus the Check type.
// Lives apart from engine.ts so checks and the orchestrator don't import each
// other in a cycle. Suggested location:
// src/features/audit/services/verify/verify-context.ts.

import type { CommitHash, CommitInfo, GitReader } from "./git-reader";
import type { Finding } from "./findings";
import type { Policy } from "./policy";

export interface VerifyContext {
  /** The repository reader (local/offline). */
  reader: GitReader;
  /** The pinned bootstrap anchor (from policy). */
  anchor: CommitHash;
  /** The resolved target-ref tip. */
  tip: CommitHash;
  /**
   * The audit commits anchor..tip, ancestry order (anchor first). Empty when the
   * anchor is unusable (the trust walk has already reported the mismatch), so a
   * history-based check simply produces nothing.
   */
  history: CommitInfo[];
  /** The active policy. */
  policy: Policy;
  /**
   * The TCS canonical serializer, injected so the engine core does not hard-wire
   * the app-layer `prepare-for-disk` path. The wiring supplies the real
   * `canonicalStringify`; tests supply a stub.
   */
  canonicalize: (value: unknown) => string;
}

/** A standalone check: reads the context, returns zero or more findings. */
export type Check = (ctx: VerifyContext) => Promise<Finding[]>;
