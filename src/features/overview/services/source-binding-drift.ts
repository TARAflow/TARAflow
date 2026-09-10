// src/features/overview/services/source-binding-drift.ts
// ==================== SOURCE BINDING — DRIFT DETECTION (Phase 3) ====================
// See source-version-binding-implementation-plan.md §6. Builds directly on
// resolveSourceBinding() (source-binding-service.ts, Phase 2) — checkDrift
// consumes its already-flattened SourceBindingResolutionResult
// ({success, reachable, sha?, error?}), NOT the raw
// window.git.resolveRemoteRef() IPC shape (which nests reachable/sha under
// `.data`). resolveSourceBinding already normalizes that; duplicating the
// nested shape here would silently drift from what the service actually
// returns.

import type { SourceBinding, DriftStatus, DriftEvent } from "shared";
import {
  resolveSourceBinding,
  type SourceBindingResolutionResult,
} from "./source-binding-service";

// No shared generateId() exists yet (use-source-bindings.ts defines the
// same fallback locally with an identical note). Duplicated here rather
// than guessed at; worth extracting to a shared util once a third caller
// needs it.
function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `drift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Six-way classification of a binding's current state vs. its recorded
 * resolvedCommitSha. Pure function — no IPC/network/consent here, so it's
 * trivially unit-testable against a fabricated
 * SourceBindingResolutionResult.
 *
 * `!result.reachable` also catches consent_denied and the
 * window.git-unavailable case: resolveSourceBinding always sets
 * `reachable: false` alongside `success: false` for those, so a single
 * check covers "genuinely unreachable host" and "couldn't even try" alike
 * — both correctly read as DriftStatus "unreachable", not a false "clean".
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
 * most recently LOGGED status (not from every check) — plan §6.3. Keeps
 * `driftEvents` bounded to genuine transitions instead of growing on every
 * on-demand check of a long-lived binding.
 */
export function recordDriftIfTransitioned(
  binding: SourceBinding,
  newStatus: DriftStatus,
  currentCommitSha: string | undefined,
): SourceBinding {
  const events = binding.driftEvents;
  const lastLogged: DriftStatus =
    events.length > 0 ? events[events.length - 1].status : "clean";

  const updated: SourceBinding = { ...binding, currentDriftStatus: newStatus };

  if (newStatus === "clean" || newStatus === lastLogged) {
    return updated; // live badge updates; no new transition to log
  }

  const event: DriftEvent = {
    id: generateId(),
    bindingId: binding.id,
    detectedAt: new Date().toISOString(),
    status: newStatus,
    previousStatus: lastLogged,
    previousResolvedCommitSha: binding.resolvedCommitSha ?? "",
    currentCommitSha,
  };

  return { ...updated, driftEvents: [...binding.driftEvents, event] };
}

/**
 * Orchestrates a full on-demand drift check for one binding: resolves the
 * current remote state (consent-gated, via resolveSourceBinding), classifies
 * it, and records a DriftEvent if it's a genuine transition. This is the
 * function the UI's "Check drift" button should call — it owns the full
 * Phase 2 → Phase 3 handoff so callers never assemble
 * checkDrift/recordDriftIfTransitioned themselves.
 */
export async function checkAndRecordDrift(
  binding: SourceBinding,
  onConsentRequired: (host: string) => Promise<boolean>,
): Promise<SourceBinding> {
  const result = await resolveSourceBinding(binding, onConsentRequired);
  const status = checkDrift(binding, result);
  return recordDriftIfTransitioned(binding, status, result.sha ?? undefined);
}
