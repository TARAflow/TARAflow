// ==================== ATTACK TREE CALCULATOR ====================
// Risk score calculation, path analysis, and likelihood export
// Supports both Standard and Critical TARA workflows

import {
  AttackTreeNode,
  AttackPath,
  PathAnalysis,
  EvaluationMethod,
  RiskCalculationResult,
  calculateRiskLevel,
  AttackGoalCategory,
  LikelihoodExport,
  ATTACK_GOAL_TO_STRIDE,
} from "../models/attacktree-types";
import { computePathKey } from "./attacktree-path-identity";

// ==================== RISK SCORE CALCULATION ====================

/**
 * Calculate risk score for a node based on evaluation method
 * - Simple: p × i × 5 (normalized to 0-25)
 * - Extended: f × b × i × 5 (normalized to 0-125)
 */
export function calculateNodeRiskScore(
  node: AttackTreeNode,
  method: EvaluationMethod
): number {
  // Leaf node with evaluation
  if (node.children.length === 0 && node.evaluation) {
    if (method === "simple" && node.evaluation.simple) {
      const { probability, impact } = node.evaluation.simple;
      return probability * impact * 5; // 0-25
    }

    if (method === "extended" && node.evaluation.extended) {
      const { feasibility, benefits, impact } = node.evaluation.extended;
      return feasibility * benefits * impact * 5; // 0-125
    }

    return 0;
  }

  // Gate node - calculate based on children
  if (node.children.length > 0) {
    const childScores = node.children.map((child) =>
      calculateNodeRiskScore(child, method)
    );

    // Filter out zero scores for meaningful calculation
    const validScores = childScores.filter((s) => s > 0);
    if (validScores.length === 0) return 0;

    // AND: Minimum (weakest link, hardest for attacker)
    if (node.type === "AND") {
      return Math.min.apply(null, validScores);
    }

    // OR/ROOT: Maximum (easiest path for attacker)
    if (node.type === "OR" || node.type === "ROOT") {
      return Math.max.apply(null, validScores);
    }
  }

  return 0;
}

/**
 * Calculate probability for a node (for likelihood export)
 */
export function calculateNodeProbability(
  node: AttackTreeNode,
  method: EvaluationMethod
): number {
  // Leaf node with evaluation
  if (node.children.length === 0 && node.evaluation) {
    if (method === "simple" && node.evaluation.simple) {
      return node.evaluation.simple.probability;
    }

    if (method === "extended" && node.evaluation.extended) {
      // For extended: probability = feasibility × benefits
      const { feasibility, benefits } = node.evaluation.extended;
      return feasibility * benefits;
    }

    return 0;
  }

  // Gate node - calculate based on children
  if (node.children.length > 0) {
    const childProbs = node.children.map((child) =>
      calculateNodeProbability(child, method)
    );

    const validProbs = childProbs.filter((p) => p > 0);
    if (validProbs.length === 0) return 0;

    // AND: Multiply probabilities (all must succeed)
    if (node.type === "AND") {
      return validProbs.reduce((acc, p) => acc * p, 1);
    }

    // OR/ROOT: 1 - (1-p1)(1-p2)... (at least one succeeds)
    if (node.type === "OR" || node.type === "ROOT") {
      const failProb = validProbs.reduce((acc, p) => acc * (1 - p), 1);
      return 1 - failProb;
    }
  }

  return 0;
}

/**
 * Calculate risk scores for entire tree (mutates nodes)
 */
export function calculateTreeRiskScores(
  root: AttackTreeNode,
  method: EvaluationMethod
): void {
  function calculate(node: AttackTreeNode): number {
    // Calculate children first (post-order traversal)
    for (const child of node.children) {
      calculate(child);
    }

    // Calculate this node's score
    const score = calculateNodeRiskScore(node, method);
    node.riskScore = score;

    // Calculate probability
    node.probability = calculateNodeProbability(node, method);

    return score;
  }

  calculate(root);
}

// ==================== PATH EXTRACTION ====================

/**
 * Extract all paths from root to leaves
 */
export function extractAllPaths(
  root: AttackTreeNode,
  method: EvaluationMethod
): AttackPath[] {
  const paths: AttackPath[] = [];
  let pathIdCounter = 0;

  function extractPath(
    node: AttackTreeNode,
    currentPath: string[],
    currentNodeIds: string[],
    currentMitigations: string[],
    currentGoals: AttackGoalCategory[],
    pathProbability: number
  ): void {
    const path = currentPath.concat([node.name]);
    const nodeIds = currentNodeIds.concat([node.id]);

    // Merge mitigations (avoid duplicates)
    const mitigationSet: { [key: string]: boolean } = {};
    currentMitigations.forEach((m) => {
      mitigationSet[m] = true;
    });
    node.mitigations.forEach((m) => {
      mitigationSet[m] = true;
    });
    const mitigations = Object.keys(mitigationSet);

    // Merge goals (avoid duplicates)
    const goalSet: { [key: string]: boolean } = {};
    currentGoals.forEach((g) => {
      goalSet[g] = true;
    });
    if (node.attackGoal) {
      goalSet[node.attackGoal] = true;
    }
    const goals = Object.keys(goalSet) as AttackGoalCategory[];

    // Update probability based on node type
    let newProbability = pathProbability;
    if (node.evaluation) {
      const nodeProb = calculateNodeProbability(node, method);
      if (node.type === "AND" || node.children.length === 0) {
        newProbability *= nodeProb;
      }
    }

    // Leaf node - create path
    if (node.children.length === 0) {
      // Calculate path-specific values
      let impact = 0;
      let feasibility: number | undefined;
      let benefits: number | undefined;

      if (node.evaluation) {
        if (method === "simple" && node.evaluation.simple) {
          impact = node.evaluation.simple.impact;
        } else if (method === "extended" && node.evaluation.extended) {
          impact = node.evaluation.extended.impact;
          feasibility = node.evaluation.extended.feasibility;
          benefits = node.evaluation.extended.benefits;
        }
      }

      paths.push({
        // Display label only — renumbers on any structural edit.
        id: "path-" + ++pathIdCounter,
        // Stable identity — this is what assessments key off.
        pathKey: computePathKey(path),
        path: path,
        nodeIds: nodeIds,
        riskScore: node.riskScore || 0,
        probability: newProbability,
        impact: impact,
        feasibility: feasibility,
        benefits: benefits,
        attackGoals: goals,
        mitigations: mitigations,
        isCritical: false, // Will be set later
        isFullyMitigated: mitigations.length > 0,
      });
      return;
    }

    // Continue down tree
    for (const child of node.children) {
      extractPath(child, path, nodeIds, mitigations, goals, newProbability);
    }
  }

  extractPath(root, [], [], [], [], 1.0);
  return paths;
}

// ==================== PATH ANALYSIS ====================

/**
 * Analyze all attack paths
 */
export function analyzeAttackPaths(
  root: AttackTreeNode,
  method: EvaluationMethod
): PathAnalysis {
  // First calculate all risk scores
  calculateTreeRiskScores(root, method);

  // Extract all paths
  const paths = extractAllPaths(root, method);

  if (paths.length === 0) {
    return {
      paths: [],
      criticalPaths: [],
      maxRiskScore: 0,
      averageRiskScore: 0,
      totalPaths: 0,
      aggregatedLikelihood: 0,
      likelihoodMethod: "max",
      goalSummary: createEmptyGoalSummary(),
      analysisDate: new Date().toISOString(),
    };
  }

  // Calculate statistics
  const riskScores = paths.map((p) => p.riskScore);
  const maxRiskScore = Math.max.apply(null, riskScores);
  const averageRiskScore =
    riskScores.reduce((sum, s) => sum + s, 0) / paths.length;

  // Determine critical paths (top 25% or above threshold)
  const threshold = method === "simple" ? 18 : 90; // 75% of max
  const criticalPaths = paths
    .filter((p) => p.riskScore >= threshold || p.riskScore === maxRiskScore)
    .sort((a, b) => b.riskScore - a.riskScore);

  // Mark critical paths
  const criticalPathIds: { [key: string]: boolean } = {};
  criticalPaths.forEach((p) => {
    p.isCritical = true;
    criticalPathIds[p.id] = true;
  });

  // Update paths array with critical flag
  paths.forEach((p) => {
    if (criticalPathIds[p.id]) {
      p.isCritical = true;
    }
  });

  // Mark critical nodes in tree
  markCriticalNodes(root, criticalPaths);

  // Calculate aggregated likelihood (for Risk Assessment export)
  const probabilities = paths.map((p) => p.probability || 0);
  const maxProbability = Math.max.apply(null, probabilities.concat([0]));

  // Calculate goal summary
  const goalSummary = createEmptyGoalSummary();

  paths.forEach((path) => {
    path.attackGoals.forEach((goal) => {
      goalSummary[goal]++;
    });
  });

  return {
    paths: paths.sort((a, b) => b.riskScore - a.riskScore),
    criticalPaths: criticalPaths,
    maxRiskScore: maxRiskScore,
    averageRiskScore: averageRiskScore,
    totalPaths: paths.length,
    aggregatedLikelihood: maxProbability,
    likelihoodMethod: "max",
    goalSummary: goalSummary,
    analysisDate: new Date().toISOString(),
  };
}

/**
 * Create empty goal summary
 */
function createEmptyGoalSummary(): Record<AttackGoalCategory, number> {
  return {
    disclosure: 0,
    manipulation: 0,
    "service-disruption": 0,
    "privilege-abuse": 0,
    "identity-misuse": 0,
    "accountability-evasion": 0,
    destruction: 0,
  };
}

/**
 * Mark nodes that are part of critical paths
 */
function markCriticalNodes(
  root: AttackTreeNode,
  criticalPaths: AttackPath[]
): void {
  const criticalNodeIds: { [key: string]: boolean } = {};

  criticalPaths.forEach((p) => {
    p.nodeIds.forEach((id) => {
      criticalNodeIds[id] = true;
    });
  });

  function mark(node: AttackTreeNode): void {
    node.criticalPath = criticalNodeIds[node.id] === true;
    node.children.forEach(mark);
  }

  mark(root);
}

// ==================== LIKELIHOOD EXPORT ====================

/**
 * Generate likelihood export data for Risk Assessment
 */
export function generateLikelihoodExport(
  pathAnalysis: PathAnalysis,
  exportedToRisks: string[]
): LikelihoodExport {
  const probabilities = pathAnalysis.paths.map((p) => p.probability || 0);
  const maxProb = probabilities.length > 0 ? Math.max.apply(null, probabilities) : 0;
  const avgProb =
    probabilities.length > 0
      ? probabilities.reduce((a, b) => a + b, 0) / probabilities.length
      : 0;

  return {
    exportedToRisks: exportedToRisks,
    maxPathProbability: maxProb,
    avgPathProbability: avgProb,
    criticalPathCount: pathAnalysis.criticalPaths.length,
    lastExported: new Date().toISOString(),
  };
}

/**
 * Convert probability to risk scale level (1-5)
 */
export function probabilityToRiskLevel(probability: number): number {
  if (probability >= 0.8) return 5; // Very High
  if (probability >= 0.6) return 4; // High
  if (probability >= 0.4) return 3; // Medium
  if (probability >= 0.2) return 2; // Low
  return 1; // Very Low
}

/**
 * Get likelihood label
 */
export function getLikelihoodLabel(
  probability: number,
  isGerman: boolean
): string {
  const level = probabilityToRiskLevel(probability);
  const labels = isGerman
    ? ["Sehr Niedrig", "Niedrig", "Mittel", "Hoch", "Sehr Hoch"]
    : ["Very Low", "Low", "Medium", "High", "Very High"];
  return labels[level - 1];
}

// ==================== PATH COMPARISON ====================

/**
 * Compare two paths
 */
export interface PathComparison {
  path1: AttackPath;
  path2: AttackPath;
  riskDifference: number;
  probabilityDifference: number;
  commonNodes: string[];
  uniqueToPath1: string[];
  uniqueToPath2: string[];
  commonMitigations: string[];
  uniqueMitigationsPath1: string[];
  uniqueMitigationsPath2: string[];
  commonGoals: AttackGoalCategory[];
}

export function comparePaths(
  path1: AttackPath,
  path2: AttackPath
): PathComparison {
  const nodes1Set: { [key: string]: boolean } = {};
  const nodes2Set: { [key: string]: boolean } = {};
  const mits1Set: { [key: string]: boolean } = {};
  const mits2Set: { [key: string]: boolean } = {};
  const goals1Set: { [key: string]: boolean } = {};
  const goals2Set: { [key: string]: boolean } = {};

  path1.path.forEach((n) => { nodes1Set[n] = true; });
  path2.path.forEach((n) => { nodes2Set[n] = true; });
  path1.mitigations.forEach((m) => { mits1Set[m] = true; });
  path2.mitigations.forEach((m) => { mits2Set[m] = true; });
  path1.attackGoals.forEach((g) => { goals1Set[g] = true; });
  path2.attackGoals.forEach((g) => { goals2Set[g] = true; });

  const commonNodes = path1.path.filter((n) => nodes2Set[n]);
  const uniqueToPath1 = path1.path.filter((n) => !nodes2Set[n]);
  const uniqueToPath2 = path2.path.filter((n) => !nodes1Set[n]);

  const commonMitigations = path1.mitigations.filter((m) => mits2Set[m]);
  const uniqueMitigationsPath1 = path1.mitigations.filter((m) => !mits2Set[m]);
  const uniqueMitigationsPath2 = path2.mitigations.filter((m) => !mits1Set[m]);

  const commonGoals = path1.attackGoals.filter((g) =>
    goals2Set[g]
  ) as AttackGoalCategory[];

  return {
    path1: path1,
    path2: path2,
    riskDifference: path1.riskScore - path2.riskScore,
    probabilityDifference: (path1.probability || 0) - (path2.probability || 0),
    commonNodes: commonNodes,
    uniqueToPath1: uniqueToPath1,
    uniqueToPath2: uniqueToPath2,
    commonMitigations: commonMitigations,
    uniqueMitigationsPath1: uniqueMitigationsPath1,
    uniqueMitigationsPath2: uniqueMitigationsPath2,
    commonGoals: commonGoals,
  };
}

// ==================== MITIGATION EFFECTIVENESS ====================

/**
 * Calculate how much mitigations reduce risk
 */
export interface MitigationEffectiveness {
  mitigationId: string;
  affectedPaths: number;
  totalRiskReduced: number;
  averageRiskReduction: number;
  criticalPathsAffected: number;
  affectedGoals: AttackGoalCategory[];
}

export function analyzeMitigationEffectiveness(
  paths: AttackPath[]
): MitigationEffectiveness[] {
  const mitigationMap: { [key: string]: AttackPath[] } = {};

  // Group paths by mitigation
  paths.forEach((path) => {
    path.mitigations.forEach((mid) => {
      if (!mitigationMap[mid]) {
        mitigationMap[mid] = [];
      }
      mitigationMap[mid].push(path);
    });
  });

  // Calculate effectiveness
  const effectiveness: MitigationEffectiveness[] = [];

  Object.keys(mitigationMap).forEach((mitigationId) => {
    const affectedPaths = mitigationMap[mitigationId];
    const totalRiskReduced = affectedPaths.reduce(
      (sum, p) => sum + p.riskScore,
      0
    );
    const criticalPathsAffected = affectedPaths.filter(
      (p) => p.isCritical
    ).length;

    // Collect all affected goals
    const affectedGoalSet: { [key: string]: boolean } = {};
    affectedPaths.forEach((p) => {
      p.attackGoals.forEach((g) => { affectedGoalSet[g] = true; });
    });

    effectiveness.push({
      mitigationId: mitigationId,
      affectedPaths: affectedPaths.length,
      totalRiskReduced: totalRiskReduced,
      averageRiskReduction: totalRiskReduced / affectedPaths.length,
      criticalPathsAffected: criticalPathsAffected,
      affectedGoals: Object.keys(affectedGoalSet) as AttackGoalCategory[],
    });
  });

  // Sort by effectiveness (critical paths first, then total risk)
  effectiveness.sort((a, b) => {
    if (a.criticalPathsAffected !== b.criticalPathsAffected) {
      return b.criticalPathsAffected - a.criticalPathsAffected;
    }
    return b.totalRiskReduced - a.totalRiskReduced;
  });

  return effectiveness;
}

// ==================== ATTACK GOAL ANALYSIS ====================

/**
 * Analyze attack goals in the tree
 */
export interface GoalAnalysis {
  goal: AttackGoalCategory;
  pathCount: number;
  maxRiskScore: number;
  avgRiskScore: number;
  strideCategories: string[];
  hasCriticalPath: boolean;
}

export function analyzeAttackGoals(paths: AttackPath[]): GoalAnalysis[] {
  const goalMap: { [key: string]: AttackPath[] } = {};

  // Group paths by goal
  paths.forEach((path) => {
    path.attackGoals.forEach((goal) => {
      if (!goalMap[goal]) {
        goalMap[goal] = [];
      }
      goalMap[goal].push(path);
    });
  });

  // Calculate analysis
  const analysis: GoalAnalysis[] = [];

  Object.keys(goalMap).forEach((goal) => {
    const goalPaths = goalMap[goal];
    const scores = goalPaths.map((p) => p.riskScore);
    const maxRiskScore = Math.max.apply(null, scores);
    const avgRiskScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const hasCriticalPath = goalPaths.some((p) => p.isCritical);
    const strideCategories = ATTACK_GOAL_TO_STRIDE[goal as AttackGoalCategory] || [];

    analysis.push({
      goal: goal as AttackGoalCategory,
      pathCount: goalPaths.length,
      maxRiskScore: maxRiskScore,
      avgRiskScore: avgRiskScore,
      strideCategories: strideCategories,
      hasCriticalPath: hasCriticalPath,
    });
  });

  // Sort by max risk score
  analysis.sort((a, b) => b.maxRiskScore - a.maxRiskScore);

  return analysis;
}

// ==================== TREE STATISTICS ====================

export interface TreeStatistics {
  totalNodes: number;
  leafNodes: number;
  gateNodes: number;
  maxDepth: number;
  evaluatedLeaves: number;
  unevaluatedLeaves: number;
  nodesWithGoals: number;
  nodesWithMitigations: number;
  uniqueMitigations: number;
  uniqueGoals: number;
}

export function calculateTreeStatistics(
  root: AttackTreeNode
): TreeStatistics {
  let totalNodes = 0;
  let leafNodes = 0;
  let gateNodes = 0;
  let maxDepth = 0;
  let evaluatedLeaves = 0;
  let unevaluatedLeaves = 0;
  let nodesWithGoals = 0;
  let nodesWithMitigations = 0;
  const allMitigations: { [key: string]: boolean } = {};
  const allGoals: { [key: string]: boolean } = {};

  function traverse(node: AttackTreeNode, depth: number): void {
    totalNodes++;
    if (depth > maxDepth) {
      maxDepth = depth;
    }

    if (node.children.length === 0) {
      leafNodes++;
      if (node.evaluation) {
        evaluatedLeaves++;
      } else {
        unevaluatedLeaves++;
      }
    } else {
      gateNodes++;
    }

    if (node.attackGoal) {
      nodesWithGoals++;
      allGoals[node.attackGoal] = true;
    }

    if (node.mitigations.length > 0) {
      nodesWithMitigations++;
      node.mitigations.forEach((m) => { allMitigations[m] = true; });
    }

    node.children.forEach((child) => traverse(child, depth + 1));
  }

  traverse(root, 0);

  return {
    totalNodes: totalNodes,
    leafNodes: leafNodes,
    gateNodes: gateNodes,
    maxDepth: maxDepth,
    evaluatedLeaves: evaluatedLeaves,
    unevaluatedLeaves: unevaluatedLeaves,
    nodesWithGoals: nodesWithGoals,
    nodesWithMitigations: nodesWithMitigations,
    uniqueMitigations: Object.keys(allMitigations).length,
    uniqueGoals: Object.keys(allGoals).length,
  };
}

// ==================== EXPORT ====================

export const attackTreeCalculator = {
  calculateNodeRiskScore,
  calculateNodeProbability,
  calculateTreeRiskScores,
  extractAllPaths,
  analyzeAttackPaths,
  generateLikelihoodExport,
  probabilityToRiskLevel,
  getLikelihoodLabel,
  comparePaths,
  analyzeMitigationEffectiveness,
  analyzeAttackGoals,
  calculateTreeStatistics,
};