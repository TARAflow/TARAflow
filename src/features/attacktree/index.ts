// ==================== ATTACK TREE FEATURE ====================
// Phase 5: Attack Tree Modeling
// Supports both Standard and Critical TARA workflows

// ==================== COMPONENTS ====================

export { AttackTreeTab } from "./components/attacktree-tab";
export { AttackTreeEditor } from "./components/attacktree-editor";
export { AttackTreePreview } from "./components/attacktree-preview";
export { AttackTreeConfigDialog } from "./components/attacktree-config-dialog";
export { AttackTreeTableView } from "./components/attacktree-tableview";

// ==================== TYPES ====================

export type {
  // Core types
  AttackTreeData,
  AttackTreeCollection,
  AttackTreeConfiguration,
  AttackTreeProjectConfiguration,
  AttackTreeNode,
  AttackTreeAnchor,
  AttackTreeAnchorType,

  // Evaluation
  EvaluationMethod,
  SimpleEvaluation,
  ExtendedEvaluation,

  // Attack Goals
  AttackGoalCategory,
  AttackGoalDefinition,

  // Security Goals
  SecurityGoalType,

  // Path Analysis
  AttackPath,
  PathAnalysis,
  LikelihoodExport,

  // Validation
  ValidationError,
  AttackTreeValidation,
  ParseResult,

  // Risk
  RiskCalculationResult,

  // Templates
  AttackTreeTemplate,

  // Project Interface
  AttackTreeProjectData,
  AttackTreeUpdateResult,
  AttackTreeTabProps,

  // References
  AssetReference,
  ThreatReference,
  RiskReference,
  DFDElementReference,
  MitigationReference,

  // Export
  AttackTreeExportData,
} from "./models/attacktree-types";

// ==================== CONSTANTS ====================

export {
  ATTACK_GOAL_TO_STRIDE,
  ATTACK_GOAL_DEFINITIONS,
  ATTACK_TREE_TEMPLATES,
  DEFAULT_ATTACKTREE_CONFIGURATION,
  DEFAULT_ATTACKTREE_PROJECT_CONFIGURATION,
} from "./models/attacktree-types";

// ==================== UTILITY FUNCTIONS ====================

export {
  createEmptyAttackTree,
  createEmptyAttackTreeCollection,
  getAnchorDisplayName,
  getAnchorTypeIcon,
  getNodeTypeColor,
  getRiskScoreEmoji,
  getAttackGoalColor,
  getTreesByAnchorType,
  getTreesForAsset,
  getTreesForSecurityGoal,
  checkAssetAttackTreeCoverage,
  calculateRiskLevel,
  generateAttackTreeId,
} from "./models/attacktree-types";

// ==================== HELPERS (for main-layout.tsx) ====================

export {
  extractAssetReferences,
  extractThreatReferencesForAttackTree,
  extractRiskReferences,
  extractDFDElementReferences,
  extractMitigationReferences,
} from "./models/attacktree-helpers";

// ==================== SERVICES ====================

export { attackTreeParser } from "./services/attacktree-parser";
export { attackTreeCalculator } from "./services/attacktree-calculator";
export { attackTreeValidator } from "./services/attacktree-validator";
export { attackTreeService } from "./services/attacktree-serivice";
