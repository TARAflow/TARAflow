// app/services/verification-state.ts
//
// What a TARA verification (ISO/SAE 21434 RQ-09-07 → WP-09-05; conformance
// plan Phase 4, decision 25) covered, and whether it still holds.
//
// The verified state is a hash of the ANALYSIS CONTENT — independent of git:
// item definition, hazards, the DFD model (elements, flows, pages), assets,
// threats, attack trees, risks, goals and claims. Left out, so that neither a
// save nor a re-layout counts as a change: the verification records
// themselves, audit and document settings, the draw.io XML and thumbnails
// (layout), derived caches (graph, validation, calculation stamps) and every
// timestamp. Implementation progress is not analysis content either (review
// 2026-10-30): a selected mitigation counts with its id, notes and scope, and
// whether it is rejected (with the reason) — rejecting a control changes the
// treatment; its status otherwise, evidence and the ticket fields do not, so a
// ticket moving in the tracker leaves the verification standing.
//
// Hash version: VERIFICATION_HASH_VERSION (shared). An entry made with another
// version cannot be compared and asks to be confirmed again ("reconfirm").
// Migrations keep verifications valid: loading re-seals an entry whose hash
// matched the file as read (resealVerifications, migration-service).
//
// Status (shown in the Overview and the document, only under iso-21434):
//   verified    latest entry passed (with or without conditions), state unchanged
//   changed     the content differs from the latest entry's state
//   reconfirm   the latest entry was hashed by another hash version
//   outdated    the latest entry is older than N days (default 90)
//   failed      the latest entry did not pass
//   none        no entry yet

import type { Project } from "../models/project-types";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import { EMPTY_PROJECT_TAGS, regulationPresetFromTags, VERIFICATION_HASH_VERSION, type VerificationEntry } from "shared";

export const DEFAULT_VERIFICATION_MAX_AGE_DAYS = 90;

/** Keys that never count as analysis content (anywhere in the tree). */
const VOLATILE_KEYS = new Set([
  "lastModified",
  "lastValidated",
  "lastOpened",
  "created",
  "thumbnail",
  "graph",
  "validation",
  "calcStamp",
  "xml",
]);

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value === null || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (VOLATILE_KEYS.has(k) || v === undefined) continue;
    out[k] = strip(v);
  }
  return out;
}

/** Fields of a selected mitigation that track its implementation, not the analysis. */
const IMPLEMENTATION_KEYS = new Set([
  "status",
  "statusChangedAt",
  "evidenceRef",
  "evidenceNote",
  "ticketId",
  "ticketUrl",
  "ticketStatus",
  "ticketSyncedAt",
]);

function analysisOfSelected(m: Record<string, unknown>): Record<string, unknown> {
  const out = Object.fromEntries(Object.entries(m).filter(([k]) => !IMPLEMENTATION_KEYS.has(k)));
  if (m.status === "rejected") out.rejected = true;
  else {
    delete out.rejectionReason;
    delete out.rejectedByTicket;
  }
  return out;
}

function analysisOfRisks(risks: Project["risks"] | undefined) {
  if (!risks) return null;
  return {
    ...risks,
    risks: (risks.risks ?? []).map((r) => ({
      ...r,
      selectedMitigations: (r.selectedMitigations ?? []).map((m) => analysisOfSelected(m as unknown as Record<string, unknown>)),
    })),
  };
}

/** 12-hex hash of the analysis content (see header). */
export function verificationStateHash(project: Partial<Project>): string {
  const concept = project.cybersecurityConcept;
  const content = {
    description: project.info?.description ?? "",
    itemDefinition: project.itemDefinition ?? null,
    hazards: project.hazards ?? null,
    dfd: project.dfd
      ? {
          elements: project.dfd.elements ?? [],
          connections: project.dfd.connections ?? [],
          pages: project.dfd.pages ?? [],
        }
      : null,
    assets: project.assets ?? null,
    threats: project.threats ?? null,
    attackTrees: project.attackTrees ?? null,
    risks: analysisOfRisks(project.risks),
    goals: concept?.goals ?? [],
    claims: concept?.claims ?? [],
  };
  return fnv1aHex12(canonicalStringify(strip(content)));
}

export type VerificationStatusKind = "verified" | "changed" | "reconfirm" | "outdated" | "failed" | "none";

/** Whether the entry's hash can be compared with the current one. */
export const sameHashVersion = (entry: Pick<VerificationEntry, "hashVersion">) =>
  (entry.hashVersion ?? 1) === VERIFICATION_HASH_VERSION;

export interface VerificationStatus {
  kind: VerificationStatusKind;
  /** The latest entry (by date), if any. */
  latest?: VerificationEntry;
  /** Days since the latest entry. */
  ageDays?: number;
  maxAgeDays: number;
}

const days = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * The status of the latest verification against `currentHash` on `asOf`
 * (ISO date: today in the Overview, the creation date in the document).
 */
export function verificationStatus(
  entries: readonly VerificationEntry[] | undefined,
  currentHash: string,
  asOf: string,
  maxAgeDays: number = DEFAULT_VERIFICATION_MAX_AGE_DAYS,
): VerificationStatus {
  const latest = [...(entries ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).at(-1);
  if (!latest) return { kind: "none", maxAgeDays };
  const ageDays = Math.max(0, days(latest.date, asOf));
  const base = { latest, ageDays, maxAgeDays };
  if (latest.result === "failed") return { kind: "failed", ...base };
  if (!sameHashVersion(latest)) return { kind: "reconfirm", ...base };
  if (latest.stateHash !== currentHash) return { kind: "changed", ...base };
  if (ageDays > maxAgeDays) return { kind: "outdated", ...base };
  return { kind: "verified", ...base };
}

/**
 * The status the document shows (plan Phase 4, decision 25): only under
 * iso-21434, as of the document's creation date.
 */
export function docVerificationOf(
  project: Partial<Project>,
  asOf: string,
): { kind: VerificationStatusKind; latest?: VerificationEntry; maxAgeDays: number; asOf: string } | undefined {
  const presetId = regulationPresetFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS);
  if (presetId !== "iso-21434") return undefined;
  const status = verificationStatus(
    project.cybersecurityConcept?.verifications,
    verificationStateHash(project),
    asOf,
    project.audit?.config?.verificationMaxAgeDays,
  );
  return { kind: status.kind, ...(status.latest ? { latest: status.latest } : {}), maxAgeDays: status.maxAgeDays, asOf };
}

/**
 * Loading keeps verifications valid across migrations and repairs: an entry
 * whose hash matched the file as read (`before`, hashed before any migration)
 * is re-sealed with the hash of the loaded project. Entries that did not match
 * stay as they are. Returns the project (a copy when something changed).
 */
export function resealVerifications<P extends Partial<Project>>(project: P, before: string): P {
  const entries = project.cybersecurityConcept?.verifications;
  if (!entries?.length) return project;
  const after = verificationStateHash(project);
  if (after === before || !entries.some((e) => sameHashVersion(e) && e.stateHash === before)) return project;
  return {
    ...project,
    cybersecurityConcept: {
      ...project.cybersecurityConcept!,
      verifications: entries.map((e) => (sameHashVersion(e) && e.stateHash === before ? { ...e, stateHash: after } : e)),
    },
  };
}
