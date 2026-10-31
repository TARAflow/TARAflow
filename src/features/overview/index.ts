// ==================== OVERVIEW FEATURE INDEX ====================
// Public API of the overview feature
//

// ==================== COMPONENTS ====================
export { GeneralTab } from "./components/general-tab";
export {
  missingGeneralFields,
  generalPhaseStatus,
  type GeneralField,
} from "./services/general-completeness";
export { ProjectInfo } from "./components/project-info";
export { ProjectInfoFields } from "./components/project-info-fields";
export type {
  ProjectInfoFieldsValue,
  ProjectInfoRequiredField,
} from "./components/project-info-fields";
export { ProjectProgress } from "./components/project-progress";
export { ProjectSettings } from "./components/project-settings";

// TARA verification status text (Overview line, phase indicators)
export { verificationStatusText } from "./components/verification-status-line";

// ==================== TYPES ====================
export type {
  GeneralTabData,
  ProjectInfoData,
  ProjectProgressData,
  ProjectSettingsData,
  PhaseValidationInfo,
  ItemModelItem,
  MethodologySummary,
  VerificationStatusView,
} from "./models/overview-types";

// ==================== HOOKS ====================
