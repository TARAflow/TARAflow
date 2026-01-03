// ==================== OVERVIEW FEATURE INDEX ====================
// Public API of the overview feature
//

// ==================== COMPONENTS ====================
export { GeneralTab } from "./components/general-tab";
export { ActivityLog } from "./components/activity-log";
export { ProjectInfo } from "./components/project-info";
export { ProjectProgress } from "./components/project-progress";
export { ProjectSettings } from "./components/project-settings";

// ==================== TYPES ====================
export type {
  GeneralTabData,
  ProjectInfoData,
  ProjectProgressData,
  ProjectSettingsData,
  PhaseValidationInfo,
} from "./models/overview-types";

// ==================== HOOKS ====================

// ==================== SERVICES ====================
export {
  getPhaseById,
  getNextPhase,
  getPreviousPhase,
  calculatePhaseProgress,
  isPhaseAccessible,
} from "./services/phase-helpers";

export { getWorkflowMode, sortPhasesByWorkflow } from "./models/overview-types";
