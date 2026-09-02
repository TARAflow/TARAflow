// src/features/overview/services/source-binding-service.ts
// ==================== SOURCE BINDING SERVICE (Phase 2) ====================
// Remote-first commit resolution via `git ls-remote`, consent-gated
// (implementation plan §5). The IPC handler itself
// (electron/ipc/git-handlers.ts `git:resolveRemoteRef`) is stateless and
// never asks for consent — this module owns that decision, since the UI
// that has to show the consent dialog lives on this side anyway.
//
// Consent is per-host, per Electron app SESSION (module-scope Set, resets
// on app restart, never persisted) — deliberately not per-binding: two
// bindings on the same host shouldn't prompt twice, and the approval
// carries no meaning across app restarts.

import type { SourceBinding } from "shared";

export interface SourceBindingResolutionResult {
  success: boolean;
  /** false = host/network unreachable; the repo was never contacted. */
  reachable: boolean;
  /** Resolved commit SHA, or null if the repo was reached but refLabel
   * doesn't resolve there (e.g. a deleted tag). */
  sha?: string | null;
  error?: string;
}

// ==================== HOST EXTRACTION ====================

/**
 * Pulls the host out of any of the remote URL forms SourceBinding.repoUrl
 * allows (plan §3.2: "https or git@") — used as the consent-dialog subject
 * and the approved-hosts cache key. Falls back to the raw input for a form
 * that doesn't parse (better an odd-looking consent prompt than silently
 * skipping consent).
 */
export function extractRepoHost(repoUrl: string): string {
  const trimmed = repoUrl.trim();

  // scp-like form: git@host:path (no scheme)
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const scpMatch = trimmed.match(/^[^@/]+@([^:/]+):/);
    if (scpMatch) return scpMatch[1];
  }

  // scheme://[user@]host[:port]/...  (https, ssh, git)
  const urlMatch = trimmed.match(
    /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?/i,
  );
  if (urlMatch) return urlMatch[1];

  return trimmed;
}

// ==================== CONSENT (session-scoped, per host) ====================

const approvedHostsThisSession = new Set<string>();

export function isHostApproved(host: string): boolean {
  return approvedHostsThisSession.has(host);
}

export function approveHost(host: string): void {
  approvedHostsThisSession.add(host);
}

/** Test-only: consent state is module-scope and would otherwise leak
 * between test cases. Not used by production code. */
export function _resetApprovedHostsForTests(): void {
  approvedHostsThisSession.clear();
}

// ==================== RESOLUTION ====================

/**
 * Resolves `binding.refLabel` to an immutable commit SHA against the
 * persisted remote URL. Prompts for consent via `onConsentRequired`
 * exactly once per host per session — the caller owns how that prompt
 * looks (a modal, in the current UI: NetworkConsentDialog), this function
 * only owns WHETHER and WHEN to ask.
 */
export async function resolveSourceBinding(
  binding: SourceBinding,
  onConsentRequired: (host: string) => Promise<boolean>,
): Promise<SourceBindingResolutionResult> {
  const host = extractRepoHost(binding.repoUrl);

  if (!isHostApproved(host)) {
    const approved = await onConsentRequired(host);
    if (!approved) {
      return {
        success: false,
        reachable: false,
        error: "consent_denied",
      };
    }
    approveHost(host);
  }

  if (!window.git?.resolveRemoteRef) {
    return {
      success: false,
      reachable: false,
      error: "window.git.resolveRemoteRef is not available in this build",
    };
  }

  const result = await window.git.resolveRemoteRef(
    binding.repoUrl,
    binding.refLabel,
  );

  if (!result.success) {
    return { success: false, reachable: false, error: result.error };
  }
  return {
    success: true,
    reachable: result.data.reachable,
    sha: result.data.sha,
  };
}
