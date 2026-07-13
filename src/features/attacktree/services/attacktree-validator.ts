// ==================== ATTACK TREE VALIDATOR ====================
// TARA consistency validation for Attack Trees
// Validates references to Assets, Threats, DFD elements, and Mitigations
//
// Architecture: Weak coupling through AttackTreeProjectData interface
// - No direct imports from features/threats, features/risks, features/assets
// - Uses pre-extracted reference data from adapter layer

import {
  AttackTreeNode,
  ValidationError,
  AttackTreeValidation,
  AttackGoalCategory,
  ATTACK_GOAL_DEFINITIONS,
  ATTACK_GOAL_TO_STRIDE,
  AttackTreeProjectData,
  AssetReference,
  SecurityGoalType,
} from "../models/attacktree-types";

// ==================== TARA CONSISTENCY VALIDATION ====================

/**
 * Validate attack tree against TARA context (Assets, Threats, DFD, Mitigations)
 */
export function validateTARAConsistency(
  ast: AttackTreeNode,
  projectData: AttackTreeProjectData
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build lookup sets from project data
  const assetIds: { [key: string]: boolean } = {};
  projectData.assets.forEach((a) => {
    assetIds[a.id.toUpperCase()] = true;
  });

  const threatIds: { [key: string]: boolean } = {};
  projectData.threats.forEach((t) => {
    threatIds[t.id.toUpperCase()] = true;
  });

  const dfdElementIds: { [key: string]: boolean } = {};
  projectData.dfdElements.forEach((e) => {
    dfdElementIds[e.id.toUpperCase()] = true;
  });

  const mitigationIds: { [key: string]: boolean } = {};
  projectData.mitigations.forEach((m) => {
    mitigationIds[m.id.toUpperCase()] = true;
  });

  function validate(node: AttackTreeNode, path: string[]): void {
    const currentPath = path.concat([node.name]);

    // Validate Asset References
    if (node.assetRef) {
      const normalizedRef = node.assetRef.toUpperCase();
      if (!assetIds[normalizedRef]) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "tara",
          severity: "warning",
          message: 'Asset "' + node.assetRef + '" not found in asset table',
          messageDE: 'Asset "' + node.assetRef + '" nicht in Asset-Tabelle gefunden',
          context: currentPath.join(" > "),
        });
      }
    }

    // Validate Threat References
    if (node.threatRef) {
      const normalizedRef = node.threatRef.toUpperCase();
      if (!threatIds[normalizedRef] && !normalizedRef.startsWith("R-")) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "tara",
          severity: "warning",
          message: 'Threat "' + node.threatRef + '" not found in threat table',
          messageDE: 'Threat "' + node.threatRef + '" nicht in Threat-Tabelle gefunden',
          context: currentPath.join(" > "),
        });
      }
    }

    // Validate DFD References
    if (node.dfdRef) {
      const normalizedRef = node.dfdRef.toUpperCase();
      if (!dfdElementIds[normalizedRef]) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "tara",
          severity: "warning",
          message: 'DFD element "' + node.dfdRef + '" not found in DFD',
          messageDE: 'DFD-Element "' + node.dfdRef + '" nicht im DFD gefunden',
          context: currentPath.join(" > "),
        });
      }
    }

    // Validate Mitigation References
    node.mitigations.forEach((mid) => {
      if (!mitigationIds[mid.toUpperCase()]) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "tara",
          severity: "info",
          message: 'Mitigation "' + mid + '" not found in existing mitigations',
          messageDE: 'Maßnahme "' + mid + '" nicht in bestehenden Maßnahmen gefunden',
          context: currentPath.join(" > "),
        });
      }
    });

    // Recursive validation
    node.children.forEach((child) => validate(child, currentPath));
  }

  validate(ast, []);
  return errors;
}

// ==================== ATTACK GOAL VALIDATION ====================

/**
 * Validate attack goals against asset security goals
 */
export function validateAttackGoals(
  ast: AttackTreeNode,
  projectData: AttackTreeProjectData,
  anchorAssetId?: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Get asset if anchored
  let anchorAsset: AssetReference | undefined;
  if (anchorAssetId) {
    anchorAsset = projectData.assets.find(
      (a) => a.id.toUpperCase() === anchorAssetId.toUpperCase()
    );
  }

  // Get enabled security goals for anchor asset
  const enabledSecurityGoals: { [key: string]: boolean } = {};
  if (anchorAsset && anchorAsset.securityGoals) {
    anchorAsset.securityGoals
      .filter((sg) => sg.enabled)
      .forEach((sg) => {
        enabledSecurityGoals[sg.type] = true;
      });
  }

  const hasEnabledGoals = Object.keys(enabledSecurityGoals).length > 0;

  function validate(node: AttackTreeNode, path: string[]): void {
    const currentPath = path.concat([node.name]);

    if (node.attackGoal) {
      const goalDef = ATTACK_GOAL_DEFINITIONS.find(
        (g) => g.id === node.attackGoal
      );

      if (!goalDef) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "goal",
          severity: "warning",
          message: 'Unknown attack goal "' + node.attackGoal + '"',
          messageDE: 'Unbekanntes Angriffsziel "' + node.attackGoal + '"',
          context: currentPath.join(" > "),
        });
      } else if (anchorAsset && hasEnabledGoals) {
        // Check if attack goal targets enabled security goals
        const targetsEnabledGoal = goalDef.securityGoals.some(
          (sg) => enabledSecurityGoals[sg]
        );

        if (!targetsEnabledGoal) {
          errors.push({
            line: node.lineNumber || node.level,
            type: "goal",
            severity: "info",
            message:
              'Attack goal "' +
              node.attackGoal +
              '" targets security goals (' +
              goalDef.securityGoals.join(", ") +
              ") not enabled for asset " +
              anchorAssetId,
            messageDE:
              'Angriffsziel "' +
              node.attackGoal +
              '" zielt auf Schutzziele (' +
              goalDef.securityGoals.join(", ") +
              "), die für Asset " +
              anchorAssetId +
              " nicht aktiviert sind",
            context: currentPath.join(" > "),
          });
        }
      }
    }

    // Recursive validation
    node.children.forEach((child) => validate(child, currentPath));
  }

  validate(ast, []);
  return errors;
}

// ==================== COMPLETENESS VALIDATION ====================

/**
 * Check if attack tree is complete
 */
export function validateCompleteness(
  ast: AttackTreeNode
): ValidationError[] {
  const errors: ValidationError[] = [];

  function validate(node: AttackTreeNode, path: string[]): void {
    const currentPath = path.concat([node.name]);

    // Check for empty names
    if (!node.name || node.name.trim().length === 0) {
      errors.push({
        line: node.lineNumber || node.level,
        type: "logic",
        severity: "error",
        message: "Node has empty name",
        messageDE: "Knoten hat keinen Namen",
        context: currentPath.join(" > "),
      });
    }

    // Leaf nodes should have evaluation
    if (node.children.length === 0 && !node.evaluation) {
      errors.push({
        line: node.lineNumber || node.level,
        type: "logic",
        severity: "warning",
        message: 'Leaf node "' + node.name + '" has no risk evaluation',
        messageDE: 'Blattknoten "' + node.name + '" hat keine Risiko-Bewertung',
        context: currentPath.join(" > "),
      });
    }

    // Check for isolated nodes (no mitigations in entire path)
    if (node.children.length === 0) {
      const hasAnyMitigation = checkPathForMitigations(node, ast);
      if (!hasAnyMitigation) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "logic",
          severity: "info",
          message: 'Path to "' + node.name + '" has no mitigations assigned',
          messageDE: 'Pfad zu "' + node.name + '" hat keine Maßnahmen zugewiesen',
          context: currentPath.join(" > "),
        });
      }
    }

    // Recursive validation
    node.children.forEach((child) => validate(child, currentPath));
  }

  validate(ast, []);
  return errors;
}

/**
 * Check if any node in path to this node has mitigations
 */
function checkPathForMitigations(
  targetNode: AttackTreeNode,
  root: AttackTreeNode
): boolean {
  function findPath(
    node: AttackTreeNode,
    target: AttackTreeNode,
    currentPath: AttackTreeNode[]
  ): AttackTreeNode[] | null {
    const path = currentPath.concat([node]);

    if (node.id === target.id) {
      return path;
    }

    for (let i = 0; i < node.children.length; i++) {
      const found = findPath(node.children[i], target, path);
      if (found) {
        return found;
      }
    }

    return null;
  }

  const path = findPath(root, targetNode, []);
  if (!path) return false;

  return path.some((node) => node.mitigations.length > 0);
}

// ==================== COVERAGE VALIDATION (Critical Workflow) ====================

/**
 * Check if attack tree covers all enabled security goals for an asset
 */
export function validateSecurityGoalCoverage(
  ast: AttackTreeNode,
  asset: AssetReference
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Get enabled security goals
  const enabledGoals = asset.securityGoals
    ? asset.securityGoals.filter((sg) => sg.enabled).map((sg) => sg.type)
    : [];

  if (enabledGoals.length === 0) {
    return errors; // No goals to check
  }

  // Collect all attack goals in tree
  const coveredSecurityGoals: { [key: string]: boolean } = {};

  function collectGoals(node: AttackTreeNode): void {
    if (node.attackGoal) {
      const goalDef = ATTACK_GOAL_DEFINITIONS.find(
        (g) => g.id === node.attackGoal
      );
      if (goalDef) {
        goalDef.securityGoals.forEach((sg) => {
          coveredSecurityGoals[sg] = true;
        });
      }
    }
    node.children.forEach(collectGoals);
  }

  collectGoals(ast);

  // Check coverage
  const missingGoals = enabledGoals.filter(
    (goal) => !coveredSecurityGoals[goal]
  );

  if (missingGoals.length > 0) {
    errors.push({
      line: 0,
      type: "goal",
      severity: "warning",
      message: "Attack tree does not cover security goals: " + missingGoals.join(", "),
      messageDE: "Attack Tree deckt Schutzziele nicht ab: " + missingGoals.join(", "),
      context: "Asset: " + asset.id,
    });
  }

  return errors;
}

// ==================== FULL VALIDATION ====================

/**
 * Complete validation: syntax + logic + TARA + goals
 */
/**
 * A gate whose children mix rating methods cannot be aggregated.
 *
 * Carried over from Phase 2: an AND gate composes its children by SUMMING attack
 * potential (effort accumulates) or MULTIPLYING probabilities. There is no honest
 * way to combine "four weeks of expert work" with "p=0.8" — they are different
 * kinds of quantity.
 *
 * The calculator therefore returns undefined for such a gate. Without this check
 * the path would silently carry NO feasibility and drop out of the analysis
 * entirely — an attack path that quietly stops being assessed. Hence: error, not
 * warning.
 */
export function validateRatingMethodConsistency(
  ast: AttackTreeNode,
): ValidationError[] {
  const errors: ValidationError[] = [];

  function ratingKindOf(node: AttackTreeNode): "potential" | "probability" | undefined {
    if (node.children.length === 0) {
      if (node.evaluation?.attackPotential) return "potential";
      if (node.evaluation?.simple || node.evaluation?.extended) return "probability";
      return undefined;
    }
    // A gate inherits the kind of its (consistent) children.
    const kinds = new Set(
      node.children
        .map(ratingKindOf)
        .filter((k): k is "potential" | "probability" => !!k),
    );
    return kinds.size === 1 ? [...kinds][0] : undefined;
  }

  function walk(node: AttackTreeNode): void {
    if (node.children.length > 0) {
      const kinds = new Set(
        node.children
          .map(ratingKindOf)
          .filter((k): k is "potential" | "probability" => !!k),
      );

      if (kinds.size > 1) {
        errors.push({
          line: node.lineNumber ?? 0,
          type: "syntax",
          severity: "error",
          message: `Node "${node.name}" mixes rating methods: attack potential cannot be combined with probability. Rate all children the same way.`,
          messageDE: `Knoten "${node.name}" mischt Bewertungsmethoden: Attack Potential kann nicht mit Wahrscheinlichkeit kombiniert werden. Alle Kinder einheitlich bewerten.`,
        });
      }
    }

    node.children.forEach(walk);
  }

  walk(ast);
  return errors;
}

/**
 * The DSL's per-leaf impact (`i=`) is deprecated (Phase 3).
 *
 * Impact belongs to the damage scenario — asset × security goal (ISO 3.1.22 /
 * 3.1.24) — not to an attack step. Leaving `i` on leaves lets a tree claim two
 * different impacts for one damage scenario, which the tool used to accept
 * silently.
 *
 * Informational, not an error: existing trees must keep working. The value is
 * simply ignored in the risk computation.
 */
export function validateDeprecatedImpact(
  ast: AttackTreeNode,
  assetId: string | undefined,
): ValidationError[] {
  const errors: ValidationError[] = [];

  function walk(node: AttackTreeNode): void {
    const hasLeafImpact =
      node.evaluation?.simple?.impact !== undefined ||
      node.evaluation?.extended?.impact !== undefined;

    if (hasLeafImpact) {
      errors.push({
        line: node.lineNumber ?? 0,
        type: "tara",
        severity: "info",
        message: assetId
          ? `Impact on "${node.name}" is ignored — it is derived from asset ${assetId} and the tree's security goal.`
          : `Impact on "${node.name}" is ignored — impact belongs to the damage scenario (asset × security goal), not to an attack step.`,
        messageDE: assetId
          ? `Impact auf "${node.name}" wird ignoriert — er wird aus Asset ${assetId} und dem Schutzziel des Baums abgeleitet.`
          : `Impact auf "${node.name}" wird ignoriert — Impact gehört zum Damage Scenario (Asset × Schutzziel), nicht zu einem Angriffsschritt.`,
      });
    }

    node.children.forEach(walk);
  }

  walk(ast);
  return errors;
}

export function validateAttackTree(
  ast: AttackTreeNode | undefined,
  projectData: AttackTreeProjectData,
  syntaxErrors: ValidationError[],
  anchorAssetId?: string
): AttackTreeValidation {
  const errors: ValidationError[] = syntaxErrors.filter((e) => e.severity === "error");
  const warnings: ValidationError[] = syntaxErrors.filter((e) => e.severity === "warning");
  const infos: ValidationError[] = syntaxErrors.filter((e) => e.severity === "info");

  if (!ast) {
    return {
      isValid: false,
      errors: errors,
      warnings: warnings,
      infos: infos,
      lastValidated: new Date().toISOString(),
    };
  }

  // Completeness validation
  const completenessErrors = validateCompleteness(ast);
  completenessErrors.forEach((e) => {
    if (e.severity === "error") {
      errors.push(e);
    } else if (e.severity === "warning") {
      warnings.push(e);
    } else {
      infos.push(e);
    }
  });

  // TARA consistency validation
  const taraErrors = validateTARAConsistency(ast, projectData);
  taraErrors.forEach((e) => {
    if (e.severity === "error") {
      errors.push(e);
    } else if (e.severity === "warning") {
      warnings.push(e);
    } else {
      infos.push(e);
    }
  });

  // Rating method consistency (Phase 2/3): a gate mixing attack potential and
  // probability cannot be aggregated, and the calculator returns undefined for
  // it. Without this error the path would silently carry no feasibility and drop
  // out of the analysis.
  validateRatingMethodConsistency(ast).forEach((e) => {
    errors.push(e);
  });

  // Deprecated per-leaf impact (Phase 3): impact belongs to the damage scenario
  // (asset × security goal), not to an attack step. Informational — existing
  // trees keep working, the value is simply ignored.
  validateDeprecatedImpact(ast, anchorAssetId).forEach((e) => {
    infos.push(e);
  });

  // Attack goal validation
  const goalErrors = validateAttackGoals(ast, projectData, anchorAssetId);
  goalErrors.forEach((e) => {
    if (e.severity === "error") {
      errors.push(e);
    } else if (e.severity === "warning") {
      warnings.push(e);
    } else {
      infos.push(e);
    }
  });

  // Security goal coverage (if asset-anchored)
  if (anchorAssetId) {
    const asset = projectData.assets.find(
      (a) => a.id.toUpperCase() === anchorAssetId.toUpperCase()
    );
    if (asset) {
      const coverageErrors = validateSecurityGoalCoverage(ast, asset);
      coverageErrors.forEach((e) => warnings.push(e));
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    infos: infos,
    lastValidated: new Date().toISOString(),
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if attack tree has any attack goals defined
 */
export function hasAttackGoals(ast: AttackTreeNode): boolean {
  if (ast.attackGoal) return true;
  return ast.children.some((child) => hasAttackGoals(child));
}

/**
 * Get all unique attack goals in tree
 */
export function getUniqueAttackGoals(
  ast: AttackTreeNode
): AttackGoalCategory[] {
  const goals: { [key: string]: boolean } = {};

  function collect(node: AttackTreeNode): void {
    if (node.attackGoal) {
      goals[node.attackGoal] = true;
    }
    node.children.forEach(collect);
  }

  collect(ast);
  return Object.keys(goals) as AttackGoalCategory[];
}

// ==================== EXPORT ====================

export const attackTreeValidator = {
  validateTARAConsistency,
  validateAttackGoals,
  validateCompleteness,
  validateSecurityGoalCoverage,
  validateRatingMethodConsistency,
  validateDeprecatedImpact,
  validateAttackTree,
  hasAttackGoals,
  getUniqueAttackGoals,
};