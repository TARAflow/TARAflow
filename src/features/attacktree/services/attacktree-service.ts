// ==================== ATTACK TREE SERVICE ====================
// Business logic for attack tree operations
// Supports both Standard and Critical TARA workflows
//
// Architecture: Weak coupling through AttackTreeProjectData interface
// - No direct imports from features/threats, features/risks, features/assets

import {
  AttackTree,
  AttackTreeData,
  AttackTreeConfiguration,
  AttackTreeValidation,
  AttackTreeAnchor,
  PathAnalysis,
  AttackTreeExportData,
  AttackGoalCategory,
  LikelihoodExport,
  AttackTreeProjectData,
  AssetReference,
  ThreatReference,
  RiskReference,
  SecurityGoalType,
  createEmptyAttackTree,
  createDefaultAttackTreeData,
  ATTACK_TREE_TEMPLATES,
  ATTACK_GOAL_TO_STRIDE,
  getAnchorDisplayName,
} from "../models/attacktree-types";
import { attackTreeParser } from "./attacktree-parser";
import { attackTreeCalculator } from "./attacktree-calculator";
import { attackTreeValidator } from "./attacktree-validator";

// ==================== SAVE / LOAD ====================

/**
 * Save attack tree data
 */
export function saveAttackTree(
  projectData: AttackTreeProjectData,
  attackTree: AttackTree
): {
  success: boolean;
  attackTreeData: AttackTreeData;
  validation: AttackTreeValidation;
} {
  // Parse DSL
  const parseResult = attackTreeParser.parse(
    attackTree.dsl,
    attackTree.configuration.evaluationMethod
  );

  // Get anchor asset ID for validation
  const anchorAssetId =
    attackTree.anchor.type === "asset"
      ? attackTree.anchor.assetId
      : undefined;

  // Validate
  const validation = attackTreeValidator.validateAttackTree(
    parseResult.ast,
    projectData,
    parseResult.errors,
    anchorAssetId
  );

  // Calculate path analysis if valid
  let pathAnalysis: PathAnalysis | undefined;
  if (parseResult.ast && validation.isValid) {
    pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
      parseResult.ast,
      attackTree.configuration.evaluationMethod
    );
  }

  // Update attack tree
  const updatedTree: AttackTree = {
    ...attackTree,
    ast: parseResult.ast,
    validation: validation,
    pathAnalysis: pathAnalysis,
    lastModified: new Date().toISOString(),
  };

  // Get or create AttackTreeData
  let attackTreeData: AttackTreeData;
  if (projectData.attackTrees) {
    attackTreeData = { ...projectData.attackTrees };
    // Update or add tree
    const existingIndex = attackTreeData.trees.findIndex(
      (t) => t.id === updatedTree.id
    );
    if (existingIndex >= 0) {
      attackTreeData.trees = attackTreeData.trees.slice();
      attackTreeData.trees[existingIndex] = updatedTree;
    } else {
      attackTreeData.trees = attackTreeData.trees.concat([updatedTree]);
    }
    attackTreeData.lastModified = new Date().toISOString();
  } else {
    attackTreeData = {
      trees: [updatedTree],
      configuration: {
        defaultEvaluationMethod:
          attackTree.configuration.evaluationMethod,
        autoCreateForSecurityGoals: false,
        showLikelihoodExport: true,
      },
      lastModified: new Date().toISOString(),
    };
  }

  return {
    success: true,
    attackTreeData: attackTreeData,
    validation: validation,
  };
}

/**
 * Load attack tree data
 */
export function loadAttackTreeData(
  projectData: AttackTreeProjectData
): AttackTreeData {
  if (projectData.attackTrees) {
    return projectData.attackTrees;
  }

  return createDefaultAttackTreeData();
}

/**
 * Delete an attack tree from the collection
 */
export function deleteAttackTree(
  projectData: AttackTreeProjectData,
  treeId: string
): AttackTreeData {
  if (!projectData.attackTrees) {
    return createDefaultAttackTreeData();
  }

  const updatedTrees = projectData.attackTrees.trees.filter(
    (t) => t.id !== treeId
  );

  return {
    ...projectData.attackTrees,
    trees: updatedTrees,
    lastModified: new Date().toISOString(),
  };
}

// ==================== TEMPLATE OPERATIONS ====================

/**
 * Load template into attack tree
 */
export function loadTemplate(
  templateId: string,
  anchor?: AttackTreeAnchor
): AttackTree | null {
  const template = ATTACK_TREE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;

  // Replace placeholders in DSL
  let dsl = template.dsl;
  if (anchor && anchor.assetId) {
    dsl = dsl.replace(/\[ASSET_ID\]/g, "[" + anchor.assetId + "]");
  }
  if (anchor && anchor.threatId) {
    dsl = dsl.replace(/\[THREAT_ID\]/g, "[" + anchor.threatId + "]");
  }

  const newTree = createEmptyAttackTree(anchor || { type: "standalone" }, {
    evaluationMethod: dsl.indexOf("p=") >= 0 ? "simple" : "extended",
  });

  newTree.name = template.name;
  newTree.description = template.description;
  newTree.dsl = dsl;

  return newTree;
}

// ==================== GENERATE FROM THREAT (Standard Workflow) ====================

/**
 * Generate attack tree DSL from threat reference
 */
export function generateFromThreat(
  projectData: AttackTreeProjectData,
  threatId: string
): AttackTree | null {
  // Get threat
  const threat = projectData.threats.find((t) => t.id === threatId);
  if (!threat) return null;

  // Get linked asset
  const assetIds = threat.linkedAssetIds || [];
  const asset = projectData.assets.find((a) =>
    assetIds.indexOf(a.id) >= 0
  );

  // Generate anchor
  const anchor: AttackTreeAnchor = {
    type: "threat",
    threatId: threat.id,
    threatTitle: threat.threatDescription
      ? threat.threatDescription.substring(0, 50)
      : undefined,
    strideCategory: threat.strideCategory,
  };

  // Generate DSL
  const mitigations = threat.mitigation
    ? "[" + threat.mitigation + "]"
    : "";

  const dsl =
    "# Attack Tree: " +
    (threat.threatDescription ? threat.threatDescription.substring(0, 50) : threatId) +
    "\n" +
    "# Threat ID: " + threatId + "\n" +
    "# STRIDE: " + threat.strideCategory + "\n" +
    "# Asset: " + (asset ? asset.name : "N/A") + "\n" +
    "# Generated: " + new Date().toISOString().split("T")[0] + "\n" +
    "# Method: Simple (p,i)\n\n" +
    (threat.threatDescription || "Threat Goal") + " [" + threatId + "];ROOT\n" +
    "\t# TODO: Define detailed attack paths\n" +
    "\tAttack Vector 1;OR\n" +
    "\t\tStep 1;p=0.5,i=3 " + mitigations + "\n" +
    "\t\tStep 2;p=0.5,i=3\n" +
    "\tAttack Vector 2;p=0.4,i=3\n";

  const newTree = createEmptyAttackTree(anchor, {
    evaluationMethod: "simple",
  });
  newTree.dsl = dsl;

  return newTree;
}

// ==================== GENERATE FROM RISK (Standard Workflow) ====================

/**
 * Generate attack tree for risk with uncertain likelihood
 */
export function generateFromRisk(
  projectData: AttackTreeProjectData,
  riskId: string
): AttackTree | null {
  // Get risk
  const risk = projectData.risks.find((r) => r.id === riskId);
  if (!risk) return null;

  // Get threat
  const threat = projectData.threats.find((t) => t.id === risk.threatId);

  // Generate anchor
  const anchor: AttackTreeAnchor = {
    type: "risk",
    riskId: risk.id,
    riskLevel: risk.calculatedRiskBeforeMitigation.toString(),
    moscowPriority: risk.moscowPriority,
  };

  // Generate DSL
  const dsl =
    "# Attack Tree: Risk Detail Analysis\n" +
    "# Risk ID: " + riskId + "\n" +
    "# Threat ID: " + risk.threatId + "\n" +
    "# Risk Level Before: " + risk.calculatedRiskBeforeMitigation + "\n" +
    "# Priority: " + risk.moscowPriority + "\n" +
    "# Generated: " + new Date().toISOString().split("T")[0] + "\n" +
    "# Method: Extended (f,b,i)\n\n" +
    (threat ? threat.threatDescription : "Risk Scenario") + " [" + riskId + "];ROOT\n" +
    "\t# Analyze attack vectors to refine likelihood assessment\n" +
    "\tPrimary Vector;OR\n" +
    "\t\tPath A;AND\n" +
    "\t\t\tStep 1;0.5,0.5,3\n" +
    "\t\t\tStep 2;0.5,0.5,3\n" +
    "\t\tPath B;0.4,0.6,3\n" +
    "\tSecondary Vector;0.3,0.4,3\n";

  const newTree = createEmptyAttackTree(anchor, {
    evaluationMethod: "extended",
  });
  newTree.dsl = dsl;

  return newTree;
}

// ==================== GENERATE FROM ASSET (Critical Workflow) ====================

/**
 * Generate attack tree for asset security goal
 */
export function generateFromAsset(
  projectData: AttackTreeProjectData,
  assetId: string,
  securityGoal: SecurityGoalType
): AttackTree | null {
  // Get asset
  const asset = projectData.assets.find((a) => a.id === assetId);
  if (!asset) return null;

  // Generate anchor
  const anchor: AttackTreeAnchor = {
    type: "asset",
    assetId: asset.id,
    assetName: asset.name,
    securityGoal: securityGoal,
  };

  // Get attack goal for security goal
  const attackGoal = getDefaultAttackGoal(securityGoal);
  const goalName = getSecurityGoalName(securityGoal);

  // Generate DSL
  const dsl =
    "# Attack Tree: " + asset.name + " - " + goalName + "\n" +
    "# Asset ID: " + assetId + "\n" +
    "# Security Goal: " + securityGoal + " (" + goalName + ")\n" +
    "# Impact: " + asset.overallImpact + "\n" +
    "# Generated: " + new Date().toISOString().split("T")[0] + "\n" +
    "# Method: Extended (f,b,i)\n\n" +
    "Compromise " + goalName + " [" + assetId + "];ROOT @" + attackGoal + "\n" +
    "\t# Define attack vectors for " + goalName + "\n" +
    "\tRemote Attack;OR\n" +
    "\t\tNetwork Exploitation;0.5,0.5,3 @" + attackGoal + "\n" +
    "\t\tApplication Attack;0.5,0.5,3 @" + attackGoal + "\n" +
    "\tLocal Attack;OR\n" +
    "\t\tInsider Threat;0.3,0.8,4 @" + attackGoal + "\n" +
    "\t\tPhysical Access;0.2,0.5,3 @" + attackGoal + "\n";

  const newTree = createEmptyAttackTree(anchor, {
    evaluationMethod: "extended",
  });
  newTree.dsl = dsl;

  return newTree;
}

/**
 * Generate all required attack trees for an asset (Critical Workflow)
 */
export function generateAllForAsset(
  projectData: AttackTreeProjectData,
  assetId: string
): AttackTree[] {
  const asset = projectData.assets.find((a) => a.id === assetId);
  if (!asset) return [];

  const enabledGoals = asset.securityGoals
    .filter((sg) => sg.enabled)
    .map((sg) => sg.type);

  const trees: AttackTree[] = [];
  enabledGoals.forEach((goal) => {
    const tree = generateFromAsset(projectData, assetId, goal);
    if (tree) {
      trees.push(tree);
    }
  });

  return trees;
}

// ==================== LIKELIHOOD EXPORT ====================

/**
 * Export likelihood data to Risk Assessment
 */
export function exportLikelihoodToRisk(
  attackTree: AttackTree,
  targetRiskIds: string[]
): LikelihoodExport | null {
  if (!attackTree.pathAnalysis) return null;

  return attackTreeCalculator.generateLikelihoodExport(
    attackTree.pathAnalysis,
    targetRiskIds
  );
}

/**
 * Get suggested likelihood value for a risk based on attack tree analysis
 */
export function getSuggestedLikelihood(
  attackTree: AttackTree
): {
  value: number;
  level: number;
  source: string;
} | null {
  if (!attackTree.pathAnalysis) return null;

  const maxProb = attackTree.pathAnalysis.aggregatedLikelihood;
  const level = attackTreeCalculator.probabilityToRiskLevel(maxProb);

  return {
    value: maxProb,
    level: level,
    source:
      "Attack Tree: " +
      attackTree.name +
      " (" +
      attackTree.pathAnalysis.criticalPaths.length +
      " critical paths)",
  };
}

// ==================== EXPORT / IMPORT ====================

/**
 * Export attack tree to JSON
 */
export function exportAttackTree(
  projectData: AttackTreeProjectData,
  attackTree: AttackTree
): AttackTreeExportData {
  return {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    projectId: projectData.id,
    projectName: projectData.name,
    attackTree: {
      name: attackTree.name,
      description: attackTree.description,
      anchor: attackTree.anchor,
      dsl: attackTree.dsl,
      configuration: attackTree.configuration,
    },
  };
}

/**
 * Import attack tree from JSON
 */
export function importAttackTree(
  jsonData: string
): {
  success: boolean;
  data?: AttackTree;
  error?: string;
} {
  try {
    const importData = JSON.parse(jsonData) as AttackTreeExportData;

    // Validate structure
    if (!importData.version || !importData.attackTree) {
      return {
        success: false,
        error: "Invalid import file format",
      };
    }

    // Create attack tree
    const attackTree = createEmptyAttackTree(
      importData.attackTree.anchor || { type: "standalone" },
      importData.attackTree.configuration
    );

    attackTree.name = importData.attackTree.name;
    attackTree.description = importData.attackTree.description;
    attackTree.dsl = importData.attackTree.dsl;

    return {
      success: true,
      data: attackTree,
    };
  } catch (error) {
    return {
      success: false,
      error: "Import failed: " + (error instanceof Error ? error.message : String(error)),
    };
  }
}

// ==================== EXPORT FORMATS ====================

/**
 * Export to GraphViz DOT format
 */
export function exportToGraphViz(attackTree: AttackTree): string {
  if (!attackTree.ast) {
    return "";
  }

  const lines: string[] = [];
  lines.push("digraph AttackTree {");
  lines.push("  rankdir=TB;");
  lines.push("  node [shape=box, style=filled];");
  lines.push("");

  function exportNode(node: any, parentId?: string): void {
    const nodeId = "node_" + node.id.replace(/[^a-zA-Z0-9]/g, "_");
    const label = node.name.replace(/"/g, '\\"');
    const color = node.criticalPath ? "#ffcdd2" : "#e3f2fd";
    const borderColor = node.criticalPath ? "#d32f2f" : "#1976d2";
    const score = node.riskScore ? " (" + node.riskScore.toFixed(1) + ")" : "";
    const goal = node.attackGoal ? " @" + node.attackGoal : "";

    lines.push(
      '  ' + nodeId + ' [label="' + label + score + goal + '", fillcolor="' + color + '", color="' + borderColor + '"];'
    );

    if (parentId) {
      const edgeColor = node.criticalPath ? "#d32f2f" : "#999999";
      lines.push('  ' + parentId + ' -> ' + nodeId + ' [color="' + edgeColor + '"];');
    }

    node.children.forEach(function(child: any) {
      exportNode(child, nodeId);
    });
  }

  exportNode(attackTree.ast);
  lines.push("}");

  return lines.join("\n");
}

/**
 * Export to Mermaid format
 */
export function exportToMermaid(attackTree: AttackTree): string {
  if (!attackTree.ast) {
    return "";
  }

  const lines: string[] = [];
  lines.push("graph TD");

  let nodeCounter = 0;

  function exportNode(node: any, parentId?: string): void {
    nodeCounter++;
    const nodeId = "N" + nodeCounter;

    const label = node.name;
    const score = node.riskScore ? " [" + node.riskScore.toFixed(1) + "]" : "";
    const goal = node.attackGoal ? " @" + node.attackGoal : "";
    const style = node.criticalPath ? ":::critical" : "";

    lines.push('  ' + nodeId + '["' + label + score + goal + '"]' + style);

    if (parentId) {
      lines.push("  " + parentId + " --> " + nodeId);
    }

    node.children.forEach(function(child: any) {
      exportNode(child, nodeId);
    });
  }

  exportNode(attackTree.ast);
  lines.push("");
  lines.push("classDef critical fill:#ffcdd2,stroke:#d32f2f,stroke-width:3px");

  return lines.join("\n");
}

// ==================== HELPER FUNCTIONS ====================

function getSecurityGoalName(goal: SecurityGoalType): string {
  const names: { [key: string]: string } = {
    C: "Confidentiality",
    I: "Integrity",
    A: "Availability",
    N: "Non-repudiation",
    AuthZ: "Authorization",
    AuthN: "Authentication",
    Acc: "Accountability",
  };
  return names[goal] || goal;
}

function getDefaultAttackGoal(
  securityGoal: SecurityGoalType
): AttackGoalCategory {
  const mapping: { [key: string]: AttackGoalCategory } = {
    C: "disclosure",
    I: "manipulation",
    A: "service-disruption",
    N: "accountability-evasion",
    AuthZ: "privilege-abuse",
    AuthN: "identity-misuse",
    Acc: "accountability-evasion",
  };
  return mapping[securityGoal] || "manipulation";
}

// ==================== EXPORT ====================

export const attackTreeService = {
  saveAttackTree,
  loadAttackTreeData,
  deleteAttackTree,
  loadTemplate,
  generateFromThreat,
  generateFromRisk,
  generateFromAsset,
  generateAllForAsset,
  exportLikelihoodToRisk,
  getSuggestedLikelihood,
  exportAttackTree,
  importAttackTree,
  exportToGraphViz,
  exportToMermaid,
};