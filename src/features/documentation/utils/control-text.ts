// ==================== CONTROLS IN THE REPORT ====================
// Controls (mitigations) and verifications of a risk as the report shows
// them: "M-VEH-004 — Grant diagnostic access only after authentication …",
// an analyst note in brackets, a custom entry by its note. The id stays for
// traceability, the text makes it readable. Same bullet layout as the threat
// tables ("• …", one per line).

// Deep path: the generation path imports no feature barrel (depcruise-doc).
import {
  getLocalizedMitigation,
  getLocalizedVerification,
} from "../../threats/services/threat-catalog-service";

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
