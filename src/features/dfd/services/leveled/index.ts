// ==================== LEVELED DFD ====================
// Occurrence model of leveled DFDs (leveled-dfd-multi-diagram-design.md §5).
// Pure, derived from ParseResult + dfd.pages; nothing here is persisted.
export { computeHomePages, type HomePages } from "./home-pages";
export {
  buildPageTree,
  type PageTree,
  type PageTreeInput,
  type PageTreeIssue,
} from "./page-tree";
export {
  findDuplicateDefinitions,
  type DuplicateDefinition,
} from "./duplicate-definitions";
export { findDanglingReferences, type DanglingReference } from "./dangling";
export {
  pruneStaleLinks,
  promoteToDefinition,
  makeDefinition,
  type CellRef,
  type LinkEditResult,
  type LinkEditRefusal,
  type PrunedLink,
} from "./identity-links";
export { linkAsContextCopy } from "./identity-links";
export { recordInfos, signatureOf, type RecordInfo } from "./signatures";
export {
  proposeAdoption,
  applyAdoption,
  type AdoptionProposal,
  type AdoptionGroup,
  type AdoptionPage,
  type AdoptionInput,
  type AdoptionDecisions,
  type AdoptionApplyResult,
  type DefinitionReason,
  type PageStatus,
} from "./adoption";
export {
  proposeCopyAssignments,
  applyCopyAssignments,
  type CopyAssignment,
  type CopyAssignmentResult,
} from "./copy-assignment";
