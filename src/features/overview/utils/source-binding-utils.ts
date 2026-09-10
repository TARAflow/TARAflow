// src/features/overview/utils/source-binding-utils.ts
// ==================== SOURCE BINDING UTILS ====================
// Pure helpers for the Source Version Binding UI (Phase 1 — static entry,
// no resolution yet; see source-version-binding-implementation-plan.md §4).
// No IPC/network calls here — that belongs in ../services once Phase 2
// (git ls-remote resolution) lands.

import type { SourceBinding, SourceRefType } from "shared";

/**
 * Select-options for the ref-type dropdown, following the
 * WINDOW_OF_OPPORTUNITY_OPTIONS pattern (id + i18n key, not raw label
 * strings) so translations stay centrally swappable.
 */
export const SOURCE_REF_TYPE_OPTIONS: {
  id: SourceRefType;
  nameKey: string;
}[] = [
  { id: "branch", nameKey: "sourceBinding.refType.branch" },
  { id: "release_branch", nameKey: "sourceBinding.refType.releaseBranch" },
  { id: "tag", nameKey: "sourceBinding.refType.tag" },
  { id: "commit", nameKey: "sourceBinding.refType.commit" },
];

/**
 * Fresh, unresolved binding row for "+ Add reference". `driftEvents` starts
 * as an empty array (never undefined, per the SourceBinding contract);
 * everything resolution-related stays undefined until Phase 2.
 */
export function createEmptySourceBinding(id: string): SourceBinding {
  return {
    id,
    repoUrl: "",
    refType: "branch",
    refLabel: "",
    driftEvents: [],
  };
}

/**
 * Phase 1 has no resolution, so "complete" only means the analyst-entered
 * fields are filled in — not that anything has been verified against the
 * remote. Drives the per-row "not yet resolved" hint and the future Save
 * affordance; NOT the Phase 4 validation aggregation
 * (`sourceBindingsValidation`), which reasons about `resolvedCommitSha` and
 * `driftEvents` instead.
 */
export function isSourceBindingComplete(binding: SourceBinding): boolean {
  return (
    binding.repoUrl.trim().length > 0 && binding.refLabel.trim().length > 0
  );
}

/**
 * Loose, client-side shape check — enough to warn on an obviously-wrong
 * entry (a local filesystem path), not a validator. https/ssh remote URLs
 * and scp-like `git@host:path` forms are all legal per the SourceBinding
 * contract ("https or git@"); anything else is flagged as a soft warning,
 * never blocking, since Phase 1 does no server-side validation at all.
 */
export function looksLikeLocalPath(repoUrl: string): boolean {
  const trimmed = repoUrl.trim();
  if (trimmed.length === 0) return false;
  const isRemoteForm =
    /^https?:\/\//i.test(trimmed) ||
    /^git@[^:]+:.+/i.test(trimmed) ||
    /^ssh:\/\//i.test(trimmed) ||
    /^git:\/\//i.test(trimmed);
  return !isRemoteForm;
}
