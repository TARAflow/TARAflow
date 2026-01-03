// ==================== ATTACK TREE SERVICE ====================
// Business logic for attack tree operations
// Supports both Standard and Critical TARA workflows
//
// Architecture: Weak coupling through AttackTreeProjectData interface
// - Uses attackTreeAdapter for Project <-> AttackTreeProjectData conversion
// - No direct imports from features/threats, features/risks, features/assets

import {
  AttackTreeData,
  AttackTreeCollection,
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
  createEmptyAttackTreeCollection,
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
  attackTreeData: AttackTreeData
): {
  success: boolean;
  collection: AttackTreeCollection;
  validation: AttackTreeValidation;
} {
  // Parse DSL
  const parseResult = attackTreeParser.parse(
    attackTreeData.dsl,
    attackTreeData.configuration.evaluationMethod
  );

  // Get anchor asset ID for validation
  const anchorAssetId =
    attackTreeData.anchor.type === "asset"
      ? attackTreeData.anchor.assetId
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
      attackTreeData.configuration.evaluationMethod
    );
  }

  // Update attack tree data
  const updatedData: AttackTreeData = {
    ...attackTreeData,
    ast: parseResult.ast,
    validation: validation,
    pathAnalysis: pathAnalysis,
    lastModified: new Date().toISOString(),
  };

  // Get or create collection
  let collection: AttackTreeCollection;
  if (projectData.attackTrees) {
    collection = { ...projectData.attackTrees };
    // Update or add tree
    const existingIndex = collection.trees.findIndex(
      (t) => t.id === updatedData.id
    );
    if (existingIndex >= 0) {
      collection.trees = collection.trees.slice();
      collection.trees[existingIndex] = updatedData;
    } else {
      collection.trees = collection.trees.concat([updatedData]);
    }
    collection.lastModified = new Date().toISOString();
  } else {
    collection = {
      trees: [updatedData],
      configuration: {
        defaultEvaluationMethod:
          attackTreeData.configuration.evaluationMethod,
        autoCreateForSecurityGoals: false,
        showLikelihoodExport: true,
      },
      lastModified: new Date().toISOString(),
    };
  }

  return {
    success: true,
    collection: collection,
    validation: validation,
  };
}

/**
 * Load attack tree collection
 */
export function loadAttackTreeCollection(
  projectData: AttackTreeProjectData
): AttackTreeCollection {
  if (projectData.attackTrees) {
    return projectData.attackTrees;
  }

  return createEmptyAttackTreeCollection();
}

// ==================== TEMPLATE OPERATIONS ====================

/**
 * Load template into attack tree
 */
export function loadTemplate(
  templateId: string,
  projectId: string,
  anchor?: AttackTreeAnchor
): AttackTreeData | null {
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

  return {
    id: "at-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
    projectId: projectId,
    name: template.name,
    description: template.description,
    anchor: anchor || { type: "standalone" },
    dsl: dsl,
    configuration: {
      evaluationMethod: dsl.indexOf("p=") >= 0 ? "simple" : "extended",
      autoSave: true,
      showLineNumbers: true,
      fontSize: 14,
      highlightCriticalPath: true,
    },
    validation: {
      isValid: false,
      errors: [],
      warnings: [],
      infos: [],
      lastValidated: new Date().toISOString(),
    },
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

// ==================== GENERATE FROM THREAT (Standard Workflow) ====================

/**
 * Generate attack tree DSL from threat reference
 */
export function generateFromThreat(
  projectData: AttackTreeProjectData,
  threatId: string
): AttackTreeData | null {
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

  const newTree = createEmptyAttackTree(projectData.id, anchor, {
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
): AttackTreeData | null {
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

  const newTree = createEmptyAttackTree(projectData.id, anchor, {
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
): AttackTreeData | null {
  // Get asset
  const asset = projectData.assets.find((a) => a.id === assetId);
  if (!asset) return null;

  // Find matching template
  const template = ATTACK_TREE_TEMPLATES.find(
    (t) =>
      t.category === "critical" &&
      t.securityGoals &&
      t.securityGoals.indexOf(securityGoal) >= 0
  );

  // Generate anchor
  const anchor: AttackTreeAnchor = {
    type: "asset",
    assetId: asset.id,
    assetName: asset.name,
    securityGoal: securityGoal,
  };

  if (template) {
    return loadTemplate(template.id, projectData.id, anchor);
  }

  // Generate generic DSL
  const goalName = getSecurityGoalName(securityGoal);
  const attackGoal = getDefaultAttackGoal(securityGoal);

  const dsl =
    "# Attack Tree: " + asset.name + " - " + goalName + "\n" +
    "# Asset: " + assetId + "\n" +
    "# Security Goal: " + securityGoal + "\n" +
    "# Created: " + new Date().toISOString().split("T")[0] + "\n" +
    "# Method: Extended (f,b,i)\n\n" +
    goalName + " Violation [" + assetId + "];ROOT @" + attackGoal + "\n" +
    "\t# Define attack vectors for " + goalName + "\n" +
    "\tRemote Attack;OR\n" +
    "\t\tNetwork Exploitation;0.5,0.5,3 @" + attackGoal + "\n" +
    "\t\tApplication Attack;0.5,0.5,3 @" + attackGoal + "\n" +
    "\tLocal Attack;OR\n" +
    "\t\tInsider Threat;0.3,0.8,4 @" + attackGoal + "\n" +
    "\t\tPhysical Access;0.2,0.5,3 @" + attackGoal + "\n";

  const newTree = createEmptyAttackTree(projectData.id, anchor, {
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
): AttackTreeData[] {
  const asset = projectData.assets.find((a) => a.id === assetId);
  if (!asset) return [];

  const enabledGoals = asset.securityGoals
    .filter((sg) => sg.enabled)
    .map((sg) => sg.type);

  const trees: AttackTreeData[] = [];
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
  attackTree: AttackTreeData,
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
  attackTree: AttackTreeData
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
  attackTreeData: AttackTreeData
): AttackTreeExportData {
  return {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    projectId: projectData.id,
    projectName: projectData.name,
    attackTree: {
      name: attackTreeData.name,
      description: attackTreeData.description,
      anchor: attackTreeData.anchor,
      dsl: attackTreeData.dsl,
      configuration: attackTreeData.configuration,
    },
  };
}

/**
 * Import attack tree from JSON
 */
export function importAttackTree(
  jsonData: string,
  projectId: string
): {
  success: boolean;
  data?: AttackTreeData;
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

    // Create attack tree data
    const attackTreeData: AttackTreeData = {
      id: "at-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
      projectId: projectId,
      name: importData.attackTree.name,
      description: importData.attackTree.description,
      anchor: importData.attackTree.anchor || { type: "standalone" },
      dsl: importData.attackTree.dsl,
      configuration: importData.attackTree.configuration,
      validation: {
        isValid: false,
        errors: [],
        warnings: [],
        infos: [],
        lastValidated: new Date().toISOString(),
      },
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    return {
      success: true,
      data: attackTreeData,
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
export function exportToGraphViz(attackTreeData: AttackTreeData): string {
  if (!attackTreeData.ast) {
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

  exportNode(attackTreeData.ast);
  lines.push("}");

  return lines.join("\n");
}

/**
 * Export to Mermaid format
 */
export function exportToMermaid(attackTreeData: AttackTreeData): string {
  if (!attackTreeData.ast) {
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

  exportNode(attackTreeData.ast);
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
  loadAttackTreeCollection,
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