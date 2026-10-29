// ==================== CATALOG ENTRIES ON A THREAT ====================
// Custom mitigation catalog design CM-1 (doc/InProgress/Threat/
// custom-mitigation-catalog.md): the closed loop keys on catalog ids, so a
// catalog entry chosen for an analyst-authored threat must be stored as
// `{ id }`, never as its text. Pure list operations for the threat dialogs.

import type { MitigationDraft, VerificationDraft } from "../models/threat-types";
import {
  getAllMitigations,
  getAllVerifications,
  getLocalizedMitigation,
  getLocalizedVerification,
} from "./threat-catalog-service";

const norm = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * The catalog entry whose (current language) text equals a free-text entry —
 * offered as a one-click "Link to …", never applied automatically: the
 * analyst may have meant the text only (design §3.3).
 */
export function catalogMatchFor(
  kind: "mitigation" | "verification",
  text: string | undefined,
): string | undefined {
  const wanted = norm(text ?? "");
  if (!wanted) return undefined;
  const entries = kind === "mitigation" ? getAllMitigations() : getAllVerifications();
  const localize = kind === "mitigation" ? getLocalizedMitigation : getLocalizedVerification;
  return entries.find((e) => norm(localize(e.id) ?? "") === wanted)?.id;
}

/**
 * Add a catalog mitigation; its catalog verifications follow it (as in the
 * generated threats and the risk dialog). Entries already present stay.
 */
export function addCatalogMitigation(
  mitigations: MitigationDraft[],
  verifications: VerificationDraft[],
  id: string,
): { mitigations: MitigationDraft[]; verifications: VerificationDraft[] } {
  const linked = getAllMitigations().find((m) => m.id === id)?.verifications ?? [];
  const has = new Set(verifications.map((v) => v.id).filter(Boolean));
  return {
    mitigations: mitigations.some((m) => m.id === id) ? mitigations : [...mitigations, { id }],
    verifications: [...verifications, ...linked.filter((v) => !has.has(v)).map((v) => ({ id: v }))],
  };
}

/** Add a catalog verification (no-op when present). */
export function addCatalogVerification(verifications: VerificationDraft[], id: string): VerificationDraft[] {
  return verifications.some((v) => v.id === id) ? verifications : [...verifications, { id }];
}

/**
 * Replace the free-text entry at `index` by the catalog entry `id`. When the
 * entry is on the list already the free-text duplicate just goes.
 */
export function linkDraftToCatalog<T extends { id?: string; notes?: string }>(
  drafts: T[],
  index: number,
  id: string,
): T[] {
  if (drafts.some((d) => d.id === id)) return drafts.filter((_, i) => i !== index);
  return drafts.map((d, i) => (i === index ? ({ id } as T) : d));
}
