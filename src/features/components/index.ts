// ==================== FEATURE: COMPONENTS ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3): the UI of
// the component import. Imports only `shared` — reading, checking and
// applying an import is done in the app layer (app/services/component-import).

export { ComponentImportDialog, type ComponentImportDialogProps } from "./components/component-import-dialog";
export {
  ComponentAttackPathsSection,
  type ComponentAttackPathsSectionProps,
  type ComponentAttackPathView,
  type PathWindow,
} from "./components/component-attack-paths-section";
export type {
  ComponentImportCandidate,
  MachineElementOption,
  ComponentPickError,
  ComponentPickResult,
  ComponentImportDialogChoice,
} from "./models/component-import-dialog-types";
