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

import type {
  FeasibilityConfiguration,
  FeasibilityMethod,
} from "../models/attacktree-feasibility-types";
import { IMPLEMENTED_FEASIBILITY_METHODS } from "../models/attacktree-feasibility-types";

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
          messageKey: "tabs.attacktree.validation.tara.assetNotFound",
          params: { ref: node.assetRef },
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
          messageKey: "tabs.attacktree.validation.tara.threatNotFound",
          params: { ref: node.threatRef },
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
          messageKey: "tabs.attacktree.validation.tara.dfdNotFound",
          params: { ref: node.dfdRef },
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
          messageKey: "tabs.attacktree.validation.tara.mitigationNotFound",
          params: { ref: mid },
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
          messageKey: "tabs.attacktree.validation.goal.unknown",
          params: { goal: node.attackGoal },
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
            messageKey: "tabs.attacktree.validation.goal.notEnabledForAsset",
            params: {
              goal: node.attackGoal,
              goals: goalDef.securityGoals.join(", "),
              asset: anchorAssetId ?? "",
            },
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
        messageKey: "tabs.attacktree.validation.completeness.emptyName",
        context: currentPath.join(" > "),
      });
    }

    // Leaf nodes should have evaluation
    if (node.children.length === 0 && !node.evaluation) {
      errors.push({
        line: node.lineNumber || node.level,
        type: "logic",
        severity: "warning",
        messageKey: "tabs.attacktree.validation.completeness.leafNoEvaluation",
        params: { name: node.name },
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
          messageKey: "tabs.attacktree.validation.completeness.pathNoMitigations",
          params: { name: node.name },
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
      messageKey: "tabs.attacktree.validation.coverage.missingGoals",
      params: { goals: missingGoals.join(", ") },
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
          messageKey: "tabs.attacktree.validation.rating.mixedMethods",
          params: { name: node.name },
        });
      }

      node.children.forEach(walk);
    }
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
        messageKey: assetId
          ? "tabs.attacktree.validation.impact.ignoredWithAsset"
          : "tabs.attacktree.validation.impact.ignoredGeneric",
        params: assetId
          ? { name: node.name, asset: assetId }
          : { name: node.name },
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
  anchorAssetId?: string,
  feasibilityConfig?: FeasibilityConfiguration, // NEW
): AttackTreeValidation {
  const errors = syntaxErrors.filter((e) => e.severity === "error");
  const warnings = syntaxErrors.filter((e) => e.severity === "warning");
  const infos = syntaxErrors.filter((e) => e.severity === "info");

  if (!ast) {
    return {
      isValid: false,
      errors,
      warnings,
      infos,
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

  const isISO = feasibilityConfig?.likelihoodModel === "feasibility-only";

  // ── 5b-1a: ISO feasibility-method enforcement ─────────────────────────────
  if (feasibilityConfig) {
    validateISOFeasibilityMethod(ast, feasibilityConfig).forEach((e) => {
      if (e.severity === "error") errors.push(e);
      else if (e.severity === "warning") warnings.push(e);
      else infos.push(e);
    });
  }

  // Deprecated per-leaf impact (Phase 3): impact belongs to the damage scenario
  // (asset × security goal), not to an attack step. Informational — existing
  // trees keep working, the value is simply ignored.
  validateDeprecatedImpact(ast, anchorAssetId).forEach((e) => {
    if (isISO) errors.push({ ...e, severity: "error" });
    else infos.push(e);
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
      (a) => a.id.toUpperCase() === anchorAssetId.toUpperCase(),
    );
    if (asset) {
      const coverageErrors = validateSecurityGoalCoverage(ast, asset);
      coverageErrors.forEach((e) => warnings.push(e));
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    infos,
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

// ==================== ISO FEASIBILITY-METHOD ENFORCEMENT (5b-1a) ============
 
type LeafEvaluation = NonNullable<AttackTreeNode["evaluation"]>;
 
/**
 * Which leaf evaluation shape each audit-grade RC-15-11 method expects.
 *
 * ISO 21434 15.7 [RC-15-11] permits three feasibility approaches:
 *   a) attack-potential (RC-15-12): elapsed time, expertise, knowledge,
 *      window, equipment          → ev.attackPotential
 *   b) CVSS (RC-15-13): attack vector, complexity, privileges, user interaction
 *      → ev.cvss          (NOT YET IMPLEMENTED — 5b-1b)
 *   c) attack-vector               → ev.attackVector  (NOT YET IMPLEMENTED — 5b-1c)
 *
 * `simple` (p,i) and `extended` (f,b,i) are NOT RC-15-11 methods — they are the
 * "quick" drafting form, which 15.7 does not sanction as audit-grade, and are
 * rejected in ISO mode regardless of the configured method.
 *
 * Keyed on FeasibilityMethod so 5b-1b/c extend enforcement by adding a row —
 * the walker below does not change.
 */
const METHOD_EXPECTS_EVALUATION: Record<
  Exclude<FeasibilityMethod, "quick">,
  (ev: LeafEvaluation) => boolean
> = {
  "attack-potential": (ev) => !!ev.attackPotential,
  // Declared for totality; their evaluation branches arrive with 5b-1b/c. Until
  // then IMPLEMENTED_FEASIBILITY_METHODS gates the config UI, so a project
  // cannot select them and these predicates are unreachable in practice.
  cvss: () => false,
  "attack-vector": () => false,
};
 
/**
 * ISO mode: every rated leaf must use the project's configured feasibility
 * method, and that method must be one TARAflow has implemented. Standard mode
 * (feasibility-x-motivation) is a no-op.
 */
export function validateISOFeasibilityMethod(
  ast: AttackTreeNode,
  config: FeasibilityConfiguration,
): ValidationError[] {
  if (config.likelihoodModel !== "feasibility-only") return [];
 
  const errors: ValidationError[] = [];
  const method = config.method;
 
  // Class 1 — the configured method must be implemented and audit-grade.
  if (method === "quick" || !IMPLEMENTED_FEASIBILITY_METHODS.includes(method)) {
    errors.push({
      line: 0,
      type: "tara",
      severity: "error",
      messageKey:
        method === "quick"
          ? "tabs.attacktree.validation.iso.methodQuick"
          : "tabs.attacktree.validation.iso.methodNotImplemented",
      params: { method },
    });
  }
 
  const expects =
    method !== "quick" ? METHOD_EXPECTS_EVALUATION[method] : undefined;
 
  function walk(node: AttackTreeNode): void {
    if (node.children.length === 0 && node.evaluation) {
      const ev = node.evaluation;
      const line = node.lineNumber ?? 0;
 
      if (ev.simple || ev.extended) {
        errors.push({
          line,
          type: "syntax",
          severity: "error",
          messageKey: ev.simple
            ? "tabs.attacktree.validation.iso.probabilityLeaf"
            : "tabs.attacktree.validation.iso.extendedLeaf",
          params: { name: node.name, method },
        });
      } else if (expects && !expects(ev)) {
        errors.push({
          line,
          type: "syntax",
          severity: "error",
          messageKey: "tabs.attacktree.validation.iso.leafMethodMismatch",
          params: { name: node.name, method },
        });
      }
 
      // Benefit is analysis-only in ISO (Cl. 3.1.29) — info, not error.
      if (ev.benefit && !ev.simple && !ev.extended) {
        errors.push({
          line,
          type: "tara",
          severity: "info",
          messageKey: "tabs.attacktree.validation.iso.benefitAnalysisOnly",
          params: { name: node.name },
        });
      }
    }
    node.children.forEach(walk);
  }
 
  walk(ast);
  return errors;
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