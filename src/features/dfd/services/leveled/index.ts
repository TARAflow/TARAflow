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
