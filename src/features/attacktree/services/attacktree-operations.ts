// ==================== ATTACK TREE OPERATIONS ====================
// Pure helper functions for attack tree manipulation
// No React dependencies - can be tested independently
// Used by hooks and components

import {
  AttackTree,
  AttackTreeData,
  AttackTreeProjectData,
  AttackTreeAnchor,
  AttackTreeConfiguration,
  SecurityGoalType,
  createEmptyAttackTree,
  resolveFeasibilityConfiguration,
} from "../models/attacktree-types";
import { attackTreeParser } from "./attacktree-parser";
import { attackTreeValidator } from "./attacktree-validator";
import { attackTreeCalculator } from "./attacktree-calculator";
import { attackTreeService } from "./attacktree-service";
import type { AttackTreeNode } from "../models/attacktree-types";
import { canonicalStringify } from "shared/utils/tcs-canonical";

// ==================== PARSE & VALIDATE ====================

/**
 * Parse DSL and validate tree (pure function)
 * This is the core operation for DSL changes
 */
export function parseAndValidateTree(
  tree: AttackTree,
  dsl: string,
  projectData: AttackTreeProjectData,
): AttackTree {
  // Parse DSL
  const parseResult = attackTreeParser.parse(
    dsl,
    tree.configuration.evaluationMethod,
  );

  // Get anchor asset ID for validation
  const anchorAssetId =
    tree.anchor.type === "asset" ? tree.anchor.assetId : undefined;

  // 5b-1a: two distinct needs from the feasibility config.
  //
  // VALIDATION must enforce the ISO leaf format ONLY when the project has
  // EXPLICITLY chosen a model. A project that never configured one must not be
  // dragged into ISO enforcement — DEFAULT_FEASIBILITY_CONFIGURATION.likelihoodModel
  // is "feasibility-only" (ISO is the conservative methodological default), and
  // passing that to the validator would reject every Standard template
  // (p,i / f,b,i leaves) and suppress pathAnalysis. So the validator gets the
  // EXPLICIT config or undefined (-> its Standard default parameter).
  const explicitFeasibilityConfig =
    projectData.attackTrees?.configuration?.feasibilityConfiguration;

  // CALCULATION always needs a complete config for banding/weights, so it falls
  // back to DEFAULT. The banding default is independent of the validation gate.
  const feasibilityConfig = resolveFeasibilityConfiguration(
    projectData.attackTrees?.configuration,
  );

  // Validate
  const validation = attackTreeValidator.validateAttackTree(
    parseResult.ast,
    projectData,
    parseResult.errors,
    anchorAssetId,
    explicitFeasibilityConfig, // undefined unless the project explicitly chose a model
  );

  // Calculate path analysis if valid
  let pathAnalysis = undefined;
  if (parseResult.ast && validation.isValid) {
    pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
      parseResult.ast,
      tree.configuration.evaluationMethod,
      feasibilityConfig, // full config for banding; 5b-1a closed the always-DEFAULT gap
    );
  }

  // Return updated tree
  return {
    ...tree,
    dsl,
    ast: parseResult.ast,
    validation,
    pathAnalysis,
    lastModified: new Date().toISOString(),
  };
}

/**
 * Parse multiple trees in batch
 * Used when loading project or after sync
 */
export function batchParseAndValidate(
  trees: AttackTree[],
  projectData: AttackTreeProjectData
): AttackTree[] {
  return trees.map((tree) => parseAndValidateTree(tree, tree.dsl, projectData));
}

/**
 * Check whether a tree must be (re-)parsed before it can be used.
 *
 * Three cases (the third: a stale ast, see astLagsDsl below):
 *
 * 1. No AST — the tree was never parsed (freshly loaded from DSL).
 *
 * 2. Legacy pathAnalysis — the tree was persisted BEFORE AttackPath carried a
 *    stable `pathKey` (see attacktree-path-identity.ts). Its AST is present, so
 *    case 1 would not fire and the stale pathAnalysis would be served as-is,
 *    with `pathKey: undefined` on every path despite the type saying otherwise
 *    (TypeScript cannot see across the JSON boundary). Anything keying off
 *    pathKey — the threat generator, Class A/B diffing — would then collapse
 *    every path onto the same undefined key.
 *
 *    Re-parsing recomputes pathAnalysis and fills the keys in. This makes the
 *    migration self-healing: no schema version bump, no migration script, and
 *    a project saved once by the new version is clean from then on.
 */
export function needsParsing(tree: AttackTree): boolean {
  if (!tree.ast) return true;

  const paths = tree.pathAnalysis?.paths;
  if (paths && paths.length > 0 && !paths[0].pathKey) return true;

  return astLagsDsl(tree);
}

// ==================== STORED AST VS DSL (plan F7) ====================
//
// Stale AST: the stored ast no longer states what the DSL states (seen in the
// Headlamp example: every leaf carried other attack-potential factors than its
// DSL line, while the path analysis matched the DSL). The tree view draws the
// ast, so it showed the stale ratings until the DSL was edited. The DSL is
// what the analyst edits and the analysis runs on, so it wins: re-parse.
//
// Compared is only what the DSL states — not node ids (older projects carry
// random ids) and not the values the calculator writes onto the nodes
// (riskScore, probability, criticalPath); comparing those would re-parse every
// older tree, and the calculator's own writes would re-trigger it. Cached per
// tree object: a tree is checked once until it changes.

/** The part of a node the DSL determines. */
function dslContent(node: AttackTreeNode): unknown {
  return {
    name: node.name,
    type: node.type,
    assetRef: node.assetRef,
    dfdRef: node.dfdRef,
    threatRef: node.threatRef,
    attackGoal: node.attackGoal,
    targetedSecurityGoals: node.targetedSecurityGoals,
    attackVector: node.attackVector,
    evaluation: node.evaluation,
    mitigations: node.mitigations,
    children: (node.children ?? []).map(dslContent),
  };
}

const astCheck = new WeakMap<AttackTree, boolean>();

/** Whether the stored ast differs from what the tree's DSL parses to. */
export function astLagsDsl(tree: AttackTree): boolean {
  const cached = astCheck.get(tree);
  if (cached !== undefined) return cached;
  let lags = false;
  if (tree.ast) {
    const parsed = attackTreeParser.parse(tree.dsl ?? "", tree.configuration?.evaluationMethod ?? "simple");
    if (parsed.success && parsed.ast) {
      try {
        lags = canonicalStringify(dslContent(parsed.ast)) !== canonicalStringify(dslContent(tree.ast));
      } catch {
        lags = false; // non-serializable values: leave the tree as it is
      }
    }
  }
  astCheck.set(tree, lags);
  return lags;
}

/**
 * Parse only trees that need it (optimization)
 */
export function parseIfNeeded(
  trees: AttackTree[],
  projectData: AttackTreeProjectData
): AttackTree[] {
  return trees.map((tree) => {
    if (needsParsing(tree)) {
      return parseAndValidateTree(tree, tree.dsl, projectData);
    }
    return tree;
  });
}

// ==================== TREE CREATION ====================

/**
 * Create new attack tree with anchor
 * Parses initial DSL immediately
 */
export function createParsedTree(
  anchor: AttackTreeAnchor,
  configuration: Partial<AttackTreeConfiguration>,
  projectData: AttackTreeProjectData
): AttackTree {
  // Create empty tree
  const newTree = createEmptyAttackTree(anchor, configuration);

  // Parse initial DSL
  return parseAndValidateTree(newTree, newTree.dsl, projectData);
}

/**
 * Create tree from template
 */
export function createTreeFromTemplate(
  templateId: string,
  anchor: AttackTreeAnchor,
  projectData: AttackTreeProjectData
): AttackTree | null {
  const templateTree = attackTreeService.loadTemplate(templateId, anchor);
  if (!templateTree) return null;

  // Parse template DSL
  return parseAndValidateTree(templateTree, templateTree.dsl, projectData);
}

/**
 * Generate tree from asset with security goal
 */
export function generateTreeFromAsset(
  projectData: AttackTreeProjectData,
  assetId: string,
  securityGoal: SecurityGoalType
): AttackTree | null {
  const generatedTree = attackTreeService.generateFromAsset(
    projectData,
    assetId,
    securityGoal
  );
  if (!generatedTree) return null;

  // Parse generated DSL
  return parseAndValidateTree(generatedTree, generatedTree.dsl, projectData);
}

/**
 * Generate tree from threat
 */
export function generateTreeFromThreat(
  projectData: AttackTreeProjectData,
  threatId: string
): AttackTree | null {
  const generatedTree = attackTreeService.generateFromThreat(
    projectData,
    threatId
  );
  if (!generatedTree) return null;

  // Parse generated DSL
  return parseAndValidateTree(generatedTree, generatedTree.dsl, projectData);
}

/**
 * Generate tree from risk
 */
export function generateTreeFromRisk(
  projectData: AttackTreeProjectData,
  riskId: string
): AttackTree | null {
  const generatedTree = attackTreeService.generateFromRisk(projectData, riskId);
  if (!generatedTree) return null;

  // Parse generated DSL
  return parseAndValidateTree(generatedTree, generatedTree.dsl, projectData);
}

// ==================== TREE UPDATES ====================

/**
 * Update tree in collection
 */
export function updateTreeInCollection(
  trees: AttackTree[],
  updatedTree: AttackTree
): AttackTree[] {
  const index = trees.findIndex((t) => t.id === updatedTree.id);
  if (index < 0) return trees;

  const newTrees = [...trees];
  newTrees[index] = updatedTree;
  return newTrees;
}

/**
 * Add tree to collection
 */
export function addTreeToCollection(
  trees: AttackTree[],
  newTree: AttackTree
): AttackTree[] {
  return [...trees, newTree];
}

/**
 * Remove tree from collection
 */
export function removeTreeFromCollection(
  trees: AttackTree[],
  treeId: string
): AttackTree[] {
  return trees.filter((t) => t.id !== treeId);
}

/**
 * Update tree configuration
 */
export function updateTreeConfiguration(
  tree: AttackTree,
  configuration: Partial<AttackTreeConfiguration>,
  projectData: AttackTreeProjectData
): AttackTree {
  const updatedTree = {
    ...tree,
    configuration: {
      ...tree.configuration,
      ...configuration,
    },
  };

  // Re-parse if evaluation method changed
  if (
    configuration.evaluationMethod &&
    configuration.evaluationMethod !== tree.configuration.evaluationMethod
  ) {
    return parseAndValidateTree(updatedTree, updatedTree.dsl, projectData);
  }

  return updatedTree;
}

// ==================== IMPORT/EXPORT ====================

/**
 * Import tree from JSON and parse
 */
export function importAndParseTree(
  jsonData: string,
  projectData: AttackTreeProjectData
): {
  success: boolean;
  tree?: AttackTree;
  error?: string;
} {
  const result = attackTreeService.importAttackTree(jsonData);
  if (!result.success || !result.data) {
    return result;
  }

  // Parse imported tree
  const parsedTree = parseAndValidateTree(
    result.data,
    result.data.dsl,
    projectData
  );

  return {
    success: true,
    tree: parsedTree,
  };
}

// ==================== SYNC OPERATIONS ====================

/**
 * Generate all missing trees for asset security goals
 */
export function generateMissingTreesForAsset(
  existingTrees: AttackTree[],
  projectData: AttackTreeProjectData,
  assetId: string
): AttackTree[] {
  const asset = projectData.assets.find((a) => a.id === assetId);
  if (!asset) return [];

  // Get enabled security goals
  const enabledGoals = asset.securityGoals
    .filter((sg) => sg.enabled)
    .map((sg) => sg.type);

  // Find which goals already have trees
  const coveredGoals = existingTrees
    .filter(
      (t) => t.anchor.type === "asset" && t.anchor.assetId === assetId
    )
    .map((t) => t.anchor.securityGoal)
    .filter((g): g is SecurityGoalType => g !== undefined);

  // Generate trees for missing goals
  const missingGoals = enabledGoals.filter((g) => !coveredGoals.includes(g));

  const newTrees: AttackTree[] = [];
  missingGoals.forEach((goal) => {
    const tree = generateTreeFromAsset(projectData, assetId, goal);
    if (tree) {
      newTrees.push(tree);
    }
  });

  return newTrees;
}

/**
 * Sync all missing trees from all assets
 */
export function syncAllMissingTrees(
  existingTrees: AttackTree[],
  projectData: AttackTreeProjectData
): AttackTree[] {
  const allNewTrees: AttackTree[] = [];

  projectData.assets.forEach((asset) => {
    const newTrees = generateMissingTreesForAsset(
      existingTrees,
      projectData,
      asset.id
    );
    allNewTrees.push(...newTrees);
  });

  return allNewTrees;
}

// ==================== VALIDATION HELPERS ====================

/**
 * Count valid trees
 */
export function countValidTrees(trees: AttackTree[]): number {
  return trees.filter((t) => t.validation?.isValid).length;
}

/**
 * Get trees with errors
 */
export function getTreesWithErrors(trees: AttackTree[]): AttackTree[] {
  return trees.filter(
    (t) => t.validation && t.validation.errors.length > 0
  );
}

/**
 * Get trees with warnings
 */
export function getTreesWithWarnings(trees: AttackTree[]): AttackTree[] {
  return trees.filter(
    (t) => t.validation && t.validation.warnings.length > 0
  );
}

// ==================== EXPORT ====================

export const attackTreeOperations = {
  // Parse & Validate
  parseAndValidateTree,
  batchParseAndValidate,
  needsParsing,
  astLagsDsl,
  parseIfNeeded,

  // Tree Creation
  createParsedTree,
  createTreeFromTemplate,
  generateTreeFromAsset,
  generateTreeFromThreat,
  generateTreeFromRisk,

  // Tree Updates
  updateTreeInCollection,
  addTreeToCollection,
  removeTreeFromCollection,
  updateTreeConfiguration,

  // Import/Export
  importAndParseTree,

  // Sync Operations
  generateMissingTreesForAsset,
  syncAllMissingTrees,

  // Validation Helpers
  countValidTrees,
  getTreesWithErrors,
  getTreesWithWarnings,
};

export default attackTreeOperations;