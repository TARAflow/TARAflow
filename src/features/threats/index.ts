// ==================== TYPES ====================
export type {
  StrideMethod,
  ThreatTabProps,
  ThreatProjectData,
  ThreatData,
  ThreatUpdateResult,
} from "./models/threat-types";

// ==================== COMPONENTS ====================
export { ThreatsTab } from "./components/threats-tab";
export { ThreatTable } from "./components/threat-table";
export { ThreatDialog } from "./components/threat-dialog";
export { ThreatConfigDialog } from "./components/threat-config-dialog";

// ==================== HOOKS ====================

// ==================== SERVICES ====================
export { threatService, ThreatService } from "./services/threat-service";

export {
  getLocalizedThreatText,
  shouldUseTemplateLocalization,
  getSuggestedMitigations,
  getEffectiveThreatDescription,
} from "./services/interaction-templates";