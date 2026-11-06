// ==================== CONTROLS IN THE REPORT ====================
// Controls (mitigations) and verifications of a risk as the report shows
// them: "M-VEH-004 — Grant diagnostic access only after authentication …",
// an analyst note in brackets, a custom entry by its note. The id stays for
// traceability, the text makes it readable. Same bullet layout as the threat
// tables ("• …", one per line). Rejected mitigations follow the active ones
// with their reason (FX-3): the audit trail shows what was turned down and
// why (IEC 62443-4-1).

// Deep path: the generation path imports no feature barrel (depcruise-doc).
import {
  getLocalizedMitigation,
  getLocalizedVerification,
} from "../../threats/services/threat-catalog-service";
import type { DocLanguage } from "../models/doc-types";

export interface ControlRef {
  id?: string;
  notes?: string;
}

/** "ID — text (note)"; an unknown id stays as the id; a custom entry is its note. */
export function controlLabel(ref: ControlRef, kind: "mitigation" | "verification"): string {
  const note = ref.notes?.trim();
  if (!ref.id) return note ?? "";
  const resolved = kind === "mitigation" ? getLocalizedMitigation(ref.id) : getLocalizedVerification(ref.id);
  // i18next returns the key itself when the text is missing.
  const text = resolved && !resolved.endsWith(`.${kind}`) ? resolved : "";
  const base = text ? `${ref.id} — ${text}` : ref.id;
  return note ? `${base} (${note})` : base;
}

/** The labels of a list, empty entries dropped. */
export function controlLabels(refs: readonly ControlRef[], kind: "mitigation" | "verification"): string[] {
  return refs.map((r) => controlLabel(r, kind)).filter((s) => s.length > 0);
}

/** A selected mitigation as far as the report needs it. */
export interface MitigationRef extends ControlRef {
  status?: string;
  rejectionReason?: string;
  rejectedByTicket?: { key: string; resolution: string };
}

const REJECTED_TEXT: Record<DocLanguage, { rejected: string; reason: string; none: string; ticket: (key: string, resolution: string) => string }> = {
  en: {
    rejected: "Rejected",
    reason: "Reason",
    none: "none given",
    ticket: (key, resolution) => `Ticket ${key} closed as ${resolution}`,
  },
  de: {
    rejected: "Abgelehnt",
    reason: "Begründung",
    none: "keine angegeben",
    ticket: (key, resolution) => `Ticket ${key} geschlossen als ${resolution}`,
  },
};

/** The reason of a rejected mitigation: the analyst's text and / or the ticket closed without a fix. */
export function rejectionReasonText(ref: MitigationRef, lang: DocLanguage): string {
  const text = REJECTED_TEXT[lang];
  const parts = [
    ref.rejectionReason?.trim(),
    ref.rejectedByTicket ? text.ticket(ref.rejectedByTicket.key, ref.rejectedByTicket.resolution) : undefined,
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join("; ") : text.none;
}

/**
 * The mitigations of a risk for the report: the active ones, then each
 * rejected one as "Rejected: ID — text · Reason: …". Rejected mitigations
 * still do not count for the residual risk — they are shown, not applied.
 */
export function mitigationLabels(refs: readonly MitigationRef[], lang: DocLanguage): string[] {
  const text = REJECTED_TEXT[lang];
  const active = controlLabels(refs.filter((m) => m.status !== "rejected"), "mitigation");
  const rejected = refs
    .filter((m) => m.status === "rejected")
    .map((m) => {
      const label = controlLabel(m, "mitigation") || "-";
      return `${text.rejected}: ${label} · ${text.reason}: ${rejectionReasonText(m, lang)}`;
    });
  return [...active, ...rejected];
}
