// ==================== ATTACK TREE PARSER ====================
// Parser for Attack Tree DSL
// Supports both Standard and Critical TARA workflows
//
// Syntax:
// Node Name [Refs];TYPE evaluation @goal [Mitigations]
//
// Examples:
// Access Database [A-01] [DS-01];ROOT @disclosure
// SQL Injection;OR @manipulation
// Find Endpoint;p=0.7,i=3 [M-001]
// Craft Payload;0.8,0.9,4 @manipulation [M-001,M-002]
//
// Evaluation forms:
//   quick (legacy):  p=0.7,i=3
//   extended (legacy): f=0.8,b=0.9,i=3   or   0.8,0.9,4
//   audit (Phase 2): et=1w,se=expert,kn=restricted,wo=easy,eq=standard
//   benefit (any):   ,b=high

import {
  AttackTreeNode,
  ParseResult,
  ValidationError,
  EvaluationMethod,
  NodeType,
  AttackGoalCategory,
  ATTACK_GOAL_TO_STRIDE,
  ATTACK_GOAL_DEFINITIONS,
} from "../models/attacktree-types";
import {
  looksLikeAttackPotential,
  parseAttackPotential,
  parseBenefit,
} from "./attacktree-feasibility-parser";
import type { SecurityGoalType } from "features/assets/models/asset-security-goals-types";

// ==================== PARSER ====================

export function parseAttackTree(
  dsl: string,
  method: EvaluationMethod
): ParseResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  try {
    const lines = dsl.split("\n");
    const stack: AttackTreeNode[] = [];

    let rootNode: AttackTreeNode | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Get indentation level. Tabs are the primary unit (see
      // attacktree-editor.tsx, which inserts literal tabs). As a fallback for
      // pasted content that lost its tabs, treat every 2 leading spaces as one
      // level, so a stray paste doesn't collapse the whole subtree onto ROOT's
      // level and get rejected as "Node has no parent".
      const leadingWhitespace = line.match(/^[\t ]*/)?.[0] || "";
      const level = leadingWhitespace.includes("\t")
        ? (leadingWhitespace.match(/\t/g) || []).length
        : Math.floor(leadingWhitespace.length / 2);

      // Parse line
      const parseResult = parseLine(line, lineNumber, method);

      if (parseResult.error) {
        errors.push(parseResult.error);
        continue;
      }

      if (!parseResult.node) {
        continue;
      }

      const node = parseResult.node;
      node.level = level;
      node.lineNumber = lineNumber;

      // Add warnings from parsing
      if (parseResult.warnings) {
        warnings.push(...parseResult.warnings);
      }

      // Build tree structure
      if (node.type === "ROOT") {
        if (rootNode) {
          errors.push({
            line: lineNumber,
            type: "syntax",
            severity: "error",
            message: "Multiple ROOT nodes found. Only one ROOT allowed.",
            messageDE: "Mehrere ROOT-Knoten gefunden. Nur ein ROOT erlaubt.",
          });
          continue;
        }
        rootNode = node;
        stack.push(node);
      } else {
        // Pop stack until we find parent at correct level
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        if (stack.length === 0) {
          errors.push({
            line: lineNumber,
            type: "syntax",
            severity: "error",
            message: "Node has no parent. All nodes must be children of ROOT.",
            messageDE:
              "Knoten hat keinen Elternknoten. Alle Knoten müssen Kinder von ROOT sein.",
          });
          continue;
        }

        // Add to parent
        const parent = stack[stack.length - 1];
        node.parentId = parent.id;
        parent.children.push(node);
        stack.push(node);
      }
    }

    // Check if we have a root
    if (!rootNode) {
      errors.push({
        line: 1,
        type: "syntax",
        severity: "error",
        message:
          "No ROOT node found. Attack tree must start with a ROOT node.",
        messageDE:
          "Kein ROOT-Knoten gefunden. Angriffsbaum muss mit einem ROOT-Knoten beginnen.",
      });
    }

    // Validate tree structure
    if (rootNode && errors.length === 0) {
      const structureErrors = validateTreeStructure(rootNode, method);
      errors.push(
        ...structureErrors.filter((e) => e.severity === "error")
      );
      warnings.push(
        ...structureErrors.filter((e) => e.severity === "warning")
      );
    }

    return {
      success: errors.length === 0,
      ast: rootNode || undefined,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push({
      line: 0,
      type: "syntax",
      severity: "error",
      message: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
    });

    return {
      success: false,
      errors,
      warnings,
    };
  }
}

// ==================== LINE PARSER ====================

interface LineParseResult {
  node?: AttackTreeNode;
  error?: ValidationError;
  warnings?: ValidationError[];
}

/**
 * Parse a single line of DSL
 *
 * Format: Node Name [Ref1] [Ref2];TYPE evaluation @goal [Mitigations]
 *
 * Examples:
 * Access Database [A-01] [DS-01];ROOT @disclosure
 * SQL Injection [T-001];OR @manipulation
 * Find Endpoint;p=0.7,i=3 [M-001]
 * Craft Payload;0.8,0.9,4 @manipulation [M-001,M-002]
 */
function parseLine(
  line: string,
  lineNumber: number,
  method: EvaluationMethod
): LineParseResult {
  const warnings: ValidationError[] = [];
  const trimmed = line.trim();

  // Extended regex to capture:
  // 1. Node name
  // 2-3. Optional refs [A-01] [DS-01]
  // 4. Type or evaluation after semicolon
  // 5. Optional additional content (evaluation, @goal, mitigations)
  const mainMatch = trimmed.match(
    /^([^;\[\]]+)(?:\s*\[([^\]]+)\])?(?:\s*\[([^\]]+)\])?\s*;(.+)$/
  );

  if (!mainMatch) {
    return {
      error: {
        line: lineNumber,
        type: "syntax",
        severity: "error",
        message: `Invalid syntax. Expected: "Node Name [Refs];TYPE evaluation @goal [Mitigations]"`,
        messageDE: `Ungültige Syntax. Erwartet: "Knotenname [Refs];TYPE Bewertung @goal [Mitigations]"`,
        context: trimmed,
      },
    };
  }

  const [, name, ref1, ref2, remainder] = mainMatch;

  const node: AttackTreeNode = {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    type: "LEAF",
    level: 0,
    children: [],
    mitigations: [],
  };

  // Parse references
  if (ref1) {
    parseReference(ref1.trim(), node);
  }
  if (ref2) {
    parseReference(ref2.trim(), node);
  }

  // Parse remainder: TYPE evaluation @goal [Mitigations]
  const parseRemainderResult = parseRemainder(
    remainder.trim(),
    lineNumber,
    method,
    node
  );

  if (parseRemainderResult.error) {
    return { error: parseRemainderResult.error };
  }

  if (parseRemainderResult.warnings) {
    warnings.push(...parseRemainderResult.warnings);
  }

  return { node, warnings };
}

// ==================== REMAINDER PARSER ====================

interface RemainderParseResult {
  error?: ValidationError;
  warnings?: ValidationError[];
}

/**
 * Parse the part after semicolon: TYPE evaluation @goal [Mitigations]
 */
function parseRemainder(
  remainder: string,
  lineNumber: number,
  method: EvaluationMethod,
  node: AttackTreeNode
): RemainderParseResult {
  const warnings: ValidationError[] = [];

  // Extract mitigations first [M-001,M-002]
  const mitigationMatch = remainder.match(/\[([^\]]+)\]\s*$/);
  let workingStr = remainder;

  if (mitigationMatch) {
    const mitigationStr = mitigationMatch[1];
    // Check if it's actually mitigations (starts with M-) or a reference
    if (/^M-/i.test(mitigationStr) || /,/.test(mitigationStr)) {
      node.mitigations = mitigationStr
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);
      workingStr = remainder.slice(0, mitigationMatch.index).trim();
    }
  }

  // Extract attack goal @goal
  const goalMatch = workingStr.match(/@(\w+(?:-\w+)?)/);
  if (goalMatch) {
    const goalStr = goalMatch[1].toLowerCase();
    if (isValidAttackGoal(goalStr)) {
      node.attackGoal = goalStr as AttackGoalCategory;
      // Derive targeted security goals from attack goal
      const goalDef = ATTACK_GOAL_DEFINITIONS.find((g) => g.id === goalStr);
      if (goalDef) {
        node.targetedSecurityGoals = goalDef.securityGoals;
      }
    } else {
      warnings.push({
        line: lineNumber,
        type: "goal",
        severity: "warning",
        message: `Unknown attack goal "@${goalStr}". Valid goals: disclosure, manipulation, service-disruption, privilege-abuse, identity-misuse, accountability-evasion, destruction`,
        messageDE: `Unbekanntes Angriffsziel "@${goalStr}". Gültige Ziele: disclosure, manipulation, service-disruption, privilege-abuse, identity-misuse, accountability-evasion, destruction`,
      });
    }
    workingStr = workingStr.replace(/@\w+(?:-\w+)?/, "").trim();
  }

  // Now parse TYPE and/or evaluation
  // Possible formats:
  // ROOT, OR, AND (gate types)
  // p=0.5,i=3 (simple evaluation)
  // 0.8,0.9,3 (extended evaluation)
  // ROOT p=0.5,i=3 (gate with evaluation - warning)

  const parts = workingStr.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length === 0) {
    return {
      error: {
        line: lineNumber,
        type: "syntax",
        severity: "error",
        message: "Missing node type or evaluation after semicolon",
        messageDE: "Fehlender Knotentyp oder Bewertung nach Semikolon",
      },
    };
  }

  // First part might be TYPE
  const firstPart = parts[0].toUpperCase();
  if (firstPart === "ROOT" || firstPart === "OR" || firstPart === "AND") {
    node.type = firstPart as NodeType;

    // Check if there's evaluation after gate type (warning)
    if (parts.length > 1) {
      const evalStr = parts.slice(1).join(" ");
      if (evalStr.match(/^(p=|[\d.]+,)/)) {
        warnings.push({
          line: lineNumber,
          type: "logic",
          severity: "warning",
          message: `Gate nodes (${node.type}) should not have evaluations. Evaluation ignored.`,
          messageDE: `Gate-Knoten (${node.type}) sollten keine Bewertungen haben. Bewertung ignoriert.`,
        });
      }
    }
  } else {
    // Must be evaluation - node is LEAF
    node.type = "LEAF";
    const evalStr = parts.join(" ");
    const evalResult = parseEvaluation(evalStr, lineNumber, method);

    if (evalResult.error) {
      return { error: evalResult.error };
    }

    node.evaluation = evalResult.evaluation;
  }

  return { warnings };
}

// ==================== REFERENCE PARSER ====================

/**
 * Parse a reference [A-01], [T-001], [DS-01], etc.
 */
function parseReference(ref: string, node: AttackTreeNode) {
  const upperRef = ref.toUpperCase();

  if (/^A-?\d+$/i.test(ref)) {
    // Asset reference: A-01, A01
    node.assetRef = upperRef;
  } else if (/^T-/i.test(ref)) {
    // Threat reference: T-P1-S-1, T-001
    node.threatRef = upperRef;
  } else if (
    /^(DS-|IF-|P-|EE-|DF-|TB-)/i.test(ref)
  ) {
    // DFD element reference
    node.dfdRef = upperRef;
  } else if (/^R-/i.test(ref)) {
    // Risk reference (for linking)
    node.threatRef = upperRef; // Store in threatRef for now
  } else {
    // Generic reference - assume DFD element
    node.dfdRef = ref;
  }
}

// ==================== EVALUATION PARSER ====================

interface EvalParseResult {
  /**
   * Derived from AttackTreeNode rather than re-declared.
   *
   * This used to be a hand-written duplicate of the node's evaluation shape,
   * which meant every new evaluation variant had to be added in two places —
   * and adding attackPotential/benefit to the node only (Phase 2) broke the
   * build here. Deriving it makes that class of drift impossible.
   */
  evaluation?: NonNullable<AttackTreeNode["evaluation"]>;
  error?: ValidationError;
}

/**
 * Parse evaluation string
 * Simple: p=0.5,i=3
 * Extended: 0.8,0.9,3 (f,b,i)
 */
function parseEvaluation(
  evalStr: string,
  lineNumber: number,
  method: EvaluationMethod,
): EvalParseResult {
  // ── Audit mode (Phase 2): attack potential per ISO 21434 Annex G.2 ────────
  // Checked FIRST because it is the preferred, audit-grade form. The legacy
  // formats below are untouched, so existing trees keep parsing byte-identically.
  if (looksLikeAttackPotential(evalStr)) {
    const result = parseAttackPotential(evalStr, lineNumber);
    if (result.error) {
      return { error: result.error };
    }
    return {
      evaluation: {
        attackPotential: result.factors,
        benefit: result.benefit,
      },
    };
  }

  // Benefit may also accompany the legacy formats (b=high alongside p=/f,b,i).
  const benefitResult = parseBenefit(evalStr, lineNumber);
  if (benefitResult.error) {
    return { error: benefitResult.error };
  }
  const benefit = benefitResult.benefit;

  // Try simple format first: p=0.5,i=3
  const simpleMatch = evalStr.match(/p\s*=\s*([\d.]+)\s*,\s*i\s*=\s*(\d+)/i);
  if (simpleMatch) {
    const probability = parseFloat(simpleMatch[1]);
    const impact = parseInt(simpleMatch[2]);

    if (probability < 0 || probability > 1) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Probability must be between 0.0 and 1.0, got ${probability}`,
          messageDE: `Wahrscheinlichkeit muss zwischen 0.0 und 1.0 liegen, erhalten: ${probability}`,
        },
      };
    }

    if (impact < 1 || impact > 5) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Impact must be between 1 and 5, got ${impact}`,
          messageDE: `Auswirkung muss zwischen 1 und 5 liegen, erhalten: ${impact}`,
        },
      };
    }

    return {
      evaluation: {
        simple: { probability, impact },
        benefit,
      },
    };
  }

  // Try extended format: f=0.8,b=0.9,i=3 OR 0.8,0.9,3
  const extendedExplicitMatch = evalStr.match(
    /f\s*=\s*([\d.]+)\s*,\s*b\s*=\s*([\d.]+)\s*,\s*i\s*=\s*(\d+)/i,
  );
  const extendedMatch = evalStr.match(/^([\d.]+)\s*,\s*([\d.]+)\s*,\s*(\d+)$/);
  const match = extendedExplicitMatch || extendedMatch;

  if (match) {
    const feasibility = parseFloat(match[1]);
    const benefits = parseFloat(match[2]);
    const impact = parseInt(match[3]);

    if (feasibility < 0 || feasibility > 1) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Feasibility must be between 0.0 and 1.0, got ${feasibility}`,
          messageDE: `Machbarkeit muss zwischen 0.0 und 1.0 liegen, erhalten: ${feasibility}`,
        },
      };
    }

    if (benefits < 0 || benefits > 1) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Benefits must be between 0.0 and 1.0, got ${benefits}`,
          messageDE: `Nutzen muss zwischen 0.0 und 1.0 liegen, erhalten: ${benefits}`,
        },
      };
    }

    if (impact < 1 || impact > 5) {
      return {
        error: {
          line: lineNumber,
          type: "syntax",
          severity: "error",
          message: `Impact must be between 1 and 5, got ${impact}`,
          messageDE: `Auswirkung muss zwischen 1 und 5 liegen, erhalten: ${impact}`,
        },
      };
    }

    return {
      evaluation: {
        extended: { feasibility, benefits, impact },
      },
    };
  }

  // Invalid format
  return {
    error: {
      line: lineNumber,
      type: "syntax",
      severity: "error",
      message:
        method === "simple"
          ? `Invalid evaluation format. Expected: p=0.0-1.0,i=1-5`
          : `Invalid evaluation format. Expected: f=0.0-1.0,b=0.0-1.0,i=1-5 or 0.0-1.0,0.0-1.0,1-5`,
      messageDE:
        method === "simple"
          ? `Ungültiges Bewertungsformat. Erwartet: p=0.0-1.0,i=1-5`
          : `Ungültiges Bewertungsformat. Erwartet: f=0.0-1.0,b=0.0-1.0,i=1-5 oder 0.0-1.0,0.0-1.0,1-5`,
      context: evalStr,
    },
  };
}

// ==================== ATTACK GOAL VALIDATION ====================

const VALID_ATTACK_GOALS = new Set<string>([
  "disclosure",
  "manipulation",
  "service-disruption",
  "privilege-abuse",
  "identity-misuse",
  "accountability-evasion",
  "destruction",
]);

function isValidAttackGoal(goal: string): boolean {
  return VALID_ATTACK_GOALS.has(goal.toLowerCase());
}

// ==================== STRUCTURE VALIDATION ====================

function validateTreeStructure(
  root: AttackTreeNode,
  method: EvaluationMethod
): ValidationError[] {
  const errors: ValidationError[] = [];

  function validate(node: AttackTreeNode, path: string[] = []) {
    const currentPath = [...path, node.name];

    // AND/OR gates must have at least 2 children
    if (
      (node.type === "AND" || node.type === "OR") &&
      node.children.length < 2
    ) {
      errors.push({
        line: node.lineNumber || node.level,
        type: "logic",
        severity: "error",
        message: `${node.type} gate "${node.name}" must have at least 2 children, has ${node.children.length}`,
        messageDE: `${node.type}-Gate "${node.name}" muss mindestens 2 Kinder haben, hat ${node.children.length}`,
        context: currentPath.join(" > "),
      });
    }

    // ROOT should have at least one child
    if (node.type === "ROOT" && node.children.length === 0) {
      errors.push({
        line: node.lineNumber || node.level,
        type: "logic",
        severity: "error",
        message: `ROOT node must have at least one child`,
        messageDE: `ROOT-Knoten muss mindestens ein Kind haben`,
      });
    }

    // Leaf nodes should have evaluation
    if (node.children.length === 0 && !node.evaluation) {
      errors.push({
        line: node.lineNumber || node.level,
        type: "logic",
        severity: "warning",
        message: `Leaf node "${node.name}" has no evaluation`,
        messageDE: `Blattknoten "${node.name}" hat keine Bewertung`,
        context: currentPath.join(" > "),
      });
    }

    // Check evaluation method consistency
    if (node.evaluation) {
      if (method === "simple" && !node.evaluation.simple) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "logic",
          severity: "warning",
          message: `Node "${node.name}" has extended evaluation but simple method is selected`,
          messageDE: `Knoten "${node.name}" hat erweiterte Bewertung, aber einfache Methode ist ausgewählt`,
        });
      }
      if (method === "extended" && !node.evaluation.extended) {
        errors.push({
          line: node.lineNumber || node.level,
          type: "logic",
          severity: "warning",
          message: `Node "${node.name}" has simple evaluation but extended method is selected`,
          messageDE: `Knoten "${node.name}" hat einfache Bewertung, aber erweiterte Methode ist ausgewählt`,
        });
      }
    }

    // Recursive validation
    for (const child of node.children) {
      validate(child, currentPath);
    }
  }

  validate(root);
  return errors;
}

// ==================== DSL GENERATOR ====================

/**
 * Generate DSL from AST (for round-trip editing)
 */
export function generateDSL(
  ast: AttackTreeNode,
  method: EvaluationMethod
): string {
  const lines: string[] = [];

  function generateNode(node: AttackTreeNode, indent: number = 0) {
    const tabs = "\t".repeat(indent);
    let line = `${tabs}${node.name}`;

    // Add references
    if (node.assetRef) {
      line += ` [${node.assetRef}]`;
    }
    if (node.dfdRef) {
      line += ` [${node.dfdRef}]`;
    }
    if (node.threatRef) {
      line += ` [${node.threatRef}]`;
    }

    // Add type or evaluation
    line += ";";
    if (node.type === "ROOT" || node.type === "OR" || node.type === "AND") {
      line += node.type;
    } else if (node.evaluation) {
      if (method === "simple" && node.evaluation.simple) {
        line += `p=${node.evaluation.simple.probability},i=${node.evaluation.simple.impact}`;
      } else if (method === "extended" && node.evaluation.extended) {
        const { feasibility, benefits, impact } = node.evaluation.extended;
        line += `${feasibility},${benefits},${impact}`;
      }
    }

    // Add attack goal
    if (node.attackGoal) {
      line += ` @${node.attackGoal}`;
    }

    // Add mitigations
    if (node.mitigations.length > 0) {
      line += ` [${node.mitigations.join(",")}]`;
    }

    lines.push(line);

    // Process children
    for (const child of node.children) {
      generateNode(child, indent + 1);
    }
  }

  generateNode(ast);
  return lines.join("\n");
}

// ==================== UTILITIES ====================

/**
 * Find node by ID in tree
 */
export function findNodeById(
  root: AttackTreeNode,
  id: string
): AttackTreeNode | null {
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}

/**
 * Get all leaf nodes
 */
export function getLeafNodes(root: AttackTreeNode): AttackTreeNode[] {
  const leaves: AttackTreeNode[] = [];

  function collect(node: AttackTreeNode) {
    if (node.children.length === 0) {
      leaves.push(node);
    } else {
      node.children.forEach(collect);
    }
  }

  collect(root);
  return leaves;
}

/**
 * Get all nodes with attack goals
 */
export function getNodesWithAttackGoals(
  root: AttackTreeNode
): AttackTreeNode[] {
  const nodes: AttackTreeNode[] = [];

  function collect(node: AttackTreeNode) {
    if (node.attackGoal) {
      nodes.push(node);
    }
    node.children.forEach(collect);
  }

  collect(root);
  return nodes;
}

/**
 * Count nodes by type
 */
export function countNodesByType(
  root: AttackTreeNode
): Record<NodeType, number> {
  const counts: Record<NodeType, number> = {
    ROOT: 0,
    OR: 0,
    AND: 0,
    LEAF: 0,
  };

  function count(node: AttackTreeNode) {
    counts[node.type]++;
    node.children.forEach(count);
  }

  count(root);
  return counts;
}

// ==================== EXPORT ====================

export const attackTreeParser = {
  parse: parseAttackTree,
  parseLine,
  generateDSL,
  findNodeById,
  getLeafNodes,
  getNodesWithAttackGoals,
  countNodesByType,
};