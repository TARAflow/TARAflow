// src/features/overview/services/source-binding-drift.ts
// ==================== SOURCE BINDING — DRIFT DETECTION (Phase 3) ====================
// See source-version-binding-implementation-plan.md §6. Builds directly on
// resolveSourceBinding() (source-binding-service.ts, Phase 2) — checkDrift
// consumes its already-flattened SourceBindingResolutionResult
// ({success, reachable, sha?, error?}), NOT the raw window.git.resolveRemoteRef
// IPC shape (which nests reachable/sha under `.data`).
//
// A drift check that DID NOT RUN — the analyst denied the network-consent
// prompt, or the git bridge is unavailable in a non-Electron build — must not
// be recorded as an "unreachable" transition. Doing so would write a false
// entry into the append-only, compliance-relevant driftEvents log, conflating
// "chose not to check" with "the on-prem host was down" — a distinction §3.2
// deliberately preserves. resolveSourceBinding flags exactly those two cases
// with the stable error codes below; every other outcome, including a genuine
// ls-remote failure (DNS / VPN / firewall / timeout), is a real check whose
// "unreachable" verdict IS recorded.

import type { SourceBinding, DriftStatus, DriftEvent } from "shared";
import {
  resolveSourceBinding,
  type SourceBindingResolutionResult,
} from "./source-binding-service";

/** resolveSourceBinding error codes meaning "the remote was never contacted"
 * — not a drift outcome, never classified or recorded. */
const CHECK_DID_NOT_RUN: ReadonlySet<string> = new Set([
  "consent_denied",
  "engine_unavailable",
]);

// No shared generateId() exists yet (use-source-bindings.ts defines the same
// fallback locally with an identical note). Duplicated here rather than
// guessed at; worth extracting to a shared util once a third caller needs it.
function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `drift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Six-way classification of a binding's current state vs. its recorded
 * resolvedCommitSha. Pure function — no IPC/network/consent here, so it's
 * trivially unit-testable against a fabricated SourceBindingResolutionResult.
 *
 * Precondition: the check actually ran. The did-not-run cases (consent denied /
 * engine unavailable) are filtered out by checkAndRecordDrift BEFORE this is
 * reached, so a `!reachable` result here always means a genuine, recordable
 * unreachable host — never a declined prompt.
 */
export function checkDrift(
  binding: SourceBinding,
  result: SourceBindingResolutionResult,
): DriftStatus {
  if (binding.refType === "commit") return "clean"; // cannot drift by definition
  if (!result.reachable) return "unreachable";

  const currentSha = result.sha;
  if (currentSha === null || currentSha === undefined) return "ref_missing";
  if (currentSha === binding.resolvedCommitSha) return "clean";

  if (binding.refType === "tag") return "tag_moved";
  if (binding.refType === "release_branch") return "branch_advanced_expected";
  return "branch_advanced";
}

/**
 * Appends a DriftEvent only when the newly-computed status differs from the
 * most recently LOGGED status (not from every check) — plan §6.3. Always
 * updates the live currentDriftStatus badge. Pure: never mutates the input,
 * keeps driftEvents strictly append-only.
 */
export function recordDriftIfTransitioned(
  binding: SourceBinding,
  newStatus: DriftStatus,
  currentCommitSha: string | undefined,
): SourceBinding {
  const updated: SourceBinding = { ...binding, currentDriftStatus: newStatus };

  // No baseline pin to compare against (shouldn't happen: the UI only checks
  // resolved bindings). Reflect the live status; record nothing rather than
  // writing an empty previousResolvedCommitSha into the traceability log.
  if (!binding.resolvedCommitSha) return updated;

  const events = binding.driftEvents;
  const lastLogged: DriftStatus = events.at(-1)?.status ?? "clean";

  if (newStatus === "clean" || newStatus === lastLogged) {
    return updated; // live badge updates; no new transition to log
  }

  const event: DriftEvent = {
    id: generateId(),
    bindingId: binding.id,
    detectedAt: new Date().toISOString(),
    status: newStatus,
    previousStatus: lastLogged,
    previousResolvedCommitSha: binding.resolvedCommitSha,
    currentCommitSha,
  };

  return { ...updated, driftEvents: [...binding.driftEvents, event] };
}

/**
 * Outcome of an on-demand drift check. `ran: false` means the check never
 * contacted the remote (consent denied / engine unavailable) — nothing was
 * classified or recorded, and the UI should surface `reason`, not a status.
 * `ran: true` carries the classified status, the updated binding, and whether
 * a new DriftEvent was appended (the signal to persist).
 */
export type DriftCheckOutcome =
  | { ran: true; binding: SourceBinding; status: DriftStatus; recorded: boolean }
  | { ran: false; reason: "consent_denied" | "engine_unavailable" };

/**
 * Orchestrates a full on-demand drift check for one binding: resolves the
 * current remote state (consent-gated, via resolveSourceBinding) and — only
 * if the check actually ran — classifies it and records a DriftEvent on a
 * genuine transition. This is the function the UI's "Check for changes"
 * button calls; it owns the full Phase 2 → Phase 3 handoff so callers never
 * assemble checkDrift/recordDriftIfTransitioned (or the did-not-run guard)
 * themselves.
 */
export async function checkAndRecordDrift(
  binding: SourceBinding,
  onConsentRequired: (host: string) => Promise<boolean>,
): Promise<DriftCheckOutcome> {
  const result = await resolveSourceBinding(binding, onConsentRequired);

  if (!result.success && result.error && CHECK_DID_NOT_RUN.has(result.error)) {
    return {
      ran: false,
      reason: result.error as "consent_denied" | "engine_unavailable",
    };
  }

  const status = checkDrift(binding, result);
  const updated = recordDriftIfTransitioned(
    binding,
    status,
    result.sha ?? undefined,
  );

  return {
    ran: true,
    binding: updated,
    status,
    recorded: updated.driftEvents.length !== binding.driftEvents.length,
  };
}
