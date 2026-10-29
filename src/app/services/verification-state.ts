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
// timestamp.
//
// Status (shown in the Overview and the document, only under iso-21434):
//   verified    latest entry passed (with or without conditions), state unchanged
//   changed     the content differs from the latest entry's state
//   outdated    the latest entry is older than N days (default 90)
//   failed      the latest entry did not pass
//   none        no entry yet

import type { Project } from "../models/project-types";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import { fnv1aHex12 } from "shared/utils/fnv1a";
import type { VerificationEntry } from "shared";

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
    risks: project.risks ?? null,
    goals: concept?.goals ?? [],
    claims: concept?.claims ?? [],
  };
  return fnv1aHex12(canonicalStringify(strip(content)));
}

export type VerificationStatusKind = "verified" | "changed" | "outdated" | "failed" | "none";

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
  if (latest.stateHash !== currentHash) return { kind: "changed", ...base };
  if (ageDays > maxAgeDays) return { kind: "outdated", ...base };
  return { kind: "verified", ...base };
}
