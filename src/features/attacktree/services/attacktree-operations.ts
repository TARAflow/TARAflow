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
} from "../models/attacktree-types";
import { attackTreeParser } from "./attacktree-parser";
import { attackTreeValidator } from "./attacktree-validator";
import { attackTreeCalculator } from "./attacktree-calculator";
import { attackTreeService } from "./attacktree-service";

// ==================== PARSE & VALIDATE ====================

/**
 * Parse DSL and validate tree (pure function)
 * This is the core operation for DSL changes
 */
export function parseAndValidateTree(
  tree: AttackTree,
  dsl: string,
  projectData: AttackTreeProjectData
): AttackTree {
  // Parse DSL
  const parseResult = attackTreeParser.parse(
    dsl,
    tree.configuration.evaluationMethod
  );

  // Get anchor asset ID for validation
  const anchorAssetId =
    tree.anchor.type === "asset" ? tree.anchor.assetId : undefined;

  // Validate
  const validation = attackTreeValidator.validateAttackTree(
    parseResult.ast,
    projectData,
    parseResult.errors,
    anchorAssetId
  );

  // Calculate path analysis if valid
  let pathAnalysis = undefined;
  if (parseResult.ast && validation.isValid) {
    pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
      parseResult.ast,
      tree.configuration.evaluationMethod
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
 * Check if tree needs parsing (no AST present)
 */
export function needsParsing(tree: AttackTree): boolean {
  return !tree.ast;
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