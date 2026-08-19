// src/app/update/should-surface.ts
// ==================== UPDATE — SURFACE GATING ====================
// Pure decision: given a check result and what triggered it, should the UI
// show anything? Startup is silent unless there's a real update (no nagging
// when up-to-date or offline); a manual check always reports its outcome —
// the user asked for it.

import type { UpdateCheckResult } from "shared/models/update-types";

export type UpdateTrigger = "startup" | "manual";

export function shouldSurface(
  result: UpdateCheckResult,
  trigger: UpdateTrigger,
): boolean {
  if (trigger === "manual") return true;
  return result.status === "update-available";
}
