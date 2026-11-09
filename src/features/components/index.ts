// ==================== FEATURE: COMPONENTS ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3): the UI of
// the component import. Imports only `shared` — reading, checking and
// applying an import is done in the app layer (app/services/component-import).

export { ComponentImportDialog, type ComponentImportDialogProps } from "./components/component-import-dialog";
// Multi-project TARA phase 5c-2: the update dialog over every instance of an import.
export {
  ComponentUpdateDialog,
  TAKE_OVER,
  type ComponentUpdateDialogProps,
  type ComponentUpdatePreview,
  type ComponentUpdateChoice,
  type ComponentUpdateOutcome,
  type UpdateChangeKind,
} from "./components/component-update-dialog";
export {
  ComponentAttackPathsSection,
  type ComponentAttackPathsSectionProps,
  type ComponentAttackPathView,
  type PathWindow,
} from "./components/component-attack-paths-section";
export { ComponentTreatmentSection, type ComponentTreatmentView } from "./components/component-treatment-section";
export {
  ComponentAssumptionsChecklist,
  type ComponentAssumptionsChecklistProps,
  type AssumptionCheckView,
  type AssumptionCheckDecision,
} from "./components/component-assumptions-checklist";
export type {
  ComponentImportCandidate,
  MachineElementOption,
  ComponentPickError,
  ComponentPickResult,
  ComponentImportDialogChoice,
} from "./models/component-import-dialog-types";
