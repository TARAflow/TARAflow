// ==================== DEVICE CATEGORY PROPOSAL ====================
// 2019 edition (iec-62443-4-2-2019-coverage.md §2, K-C1): the device category
// of the component under evaluation, derived from its systemClass or a chip
// boundary inside it — a PROPOSAL the analyst confirms (source "derived"),
// never adopted silently. No proposal for workstation and mobile_device: the
// analyst decides (HDR when the supplier delivers the device, SAR for an app
// or engineering tool only).

import type { DeviceCategory } from "../models/compliance-types";

const BY_SYSTEM_CLASS: Readonly<Record<string, DeviceCategory | null>> = {
  embedded_controller: "EDR",
  safety_system: "EDR",
  gateway: "NDR",
  scada_hmi: "HDR",
  backend_application: "SAR",
  cloud_platform: "SAR",
  workstation: null,
  mobile_device: null,
};

export interface DeviceCategoryProposal {
  categories: DeviceCategory[];
  /** Why — shown next to the proposal. */
  reason: "system-class" | "chip-boundary" | "process" | "ask";
}

/**
 * @param component      the selected element (type, properties); undefined = whole model
 * @param hasChipBoundary a chip boundary lies inside the component
 */
export function proposeDeviceCategories(
  component: { type: string; properties?: Record<string, unknown> } | undefined,
  hasChipBoundary: boolean,
): DeviceCategoryProposal {
  if (component?.type === "Process") return { categories: ["SAR"], reason: "process" };
  const systemClass = component?.properties?.systemClass;
  if (typeof systemClass === "string" && systemClass in BY_SYSTEM_CLASS) {
    const category = BY_SYSTEM_CLASS[systemClass];
    return category ? { categories: [category], reason: "system-class" } : { categories: [], reason: "ask" };
  }
  if (hasChipBoundary) return { categories: ["EDR"], reason: "chip-boundary" };
  return { categories: [], reason: "ask" };
}
