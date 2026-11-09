// ==================== MITIGATION EVIDENCE ====================
// With an issue tracker connected, a mitigation counts as done either
// through its ticket or through evidence the analyst gives (user
// 2026-11-10): the status stays manual, but "in review", "implemented" or
// "verified" without a linked ticket needs an evidence note or a reference.
// Without a tracker nothing is required (offline mode, as before).

import { DONE_MITIGATION_STATUSES } from "shared/models/control-instance";
import type { SelectedMitigation } from "../models/risk-mitigation-types";

/** A done status without ticket, evidence note or reference — while a tracker is connected. */
export function needsStatusEvidence(m: SelectedMitigation, trackerConnected: boolean): boolean {
  return (
    trackerConnected &&
    DONE_MITIGATION_STATUSES.includes(m.status) &&
    !m.ticketId &&
    !m.evidenceNote?.trim() &&
    !m.evidenceRef?.trim()
  );
}
