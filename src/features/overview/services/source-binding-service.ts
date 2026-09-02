// src/features/overview/services/source-binding-service.ts
// ==================== SOURCE BINDING SERVICE (Phase 2 STUB) ====================
// Not wired into any component yet. This exists now so the Phase 2 patch
// (electron/ipc/git-handlers.ts resolution handler + preload bridge + this
// implementation) is additive on top of the Phase 1 UI, instead of the UI
// needing rework once resolution lands.
//
// Deliberately left unimplemented rather than faked: implementation plan §4
// is explicit that Phase 1 is "static entry, no resolution yet" — a
// resolveSourceBinding() that silently no-ops or returns a made-up result
// would be worse than an honest "not implemented" error, since a caller
// could mistake a no-op for "checked, nothing changed".
//
// Phase 2 contract (plan §5):
//   - primary path: `git ls-remote <repoUrl> <refLabel>` against the
//     persisted remote URL, via a new electron/ipc/git-handlers.ts handler
//     (window.git-style IPC, returning GitOperationResult<{ sha: string }>)
//   - explicit network consent before the first outbound call per host in a
//     session — never silent
//   - LocalCheckoutHint (machine-local only) is a speed-up, never the
//     system of record

import type { SourceBinding } from "shared";

export interface SourceBindingResolutionResult {
  success: boolean;
  sha?: string;
  error?: string;
}

/**
 * Resolves `binding.refLabel` to an immutable commit SHA. NOT IMPLEMENTED —
 * see header. Phase 2 wires this to a new IPC channel once
 * electron/ipc/git-handlers.ts grows a resolution handler.
 */
export async function resolveSourceBinding(
  binding: SourceBinding,
): Promise<SourceBindingResolutionResult> {
  throw new Error(
    "resolveSourceBinding is not implemented yet (Phase 2 — see " +
      "source-version-binding-implementation-plan.md §5)",
  );
}
