// ==================== ATTACK TREE TYPES ====================
// Type definitions for Attack Tree feature (Phase 5)
// Supports both Standard and Critical TARA workflows
//
// Architecture: Same pattern as threats-types.ts, risks-types.ts
// - AttackTreeData = persisted data in Project (like ThreatData, RiskData)
// - AttackTreeProjectData = props interface for AttackTreeTab

import type {
  PhaseStatusMap,
  StrideCategory,
  ThreatRelevanceRef,
} from "shared";
import type {
  AttackPotentialFactors,
  BenefitLevel,
  FeasibilityLevel,
} from "./attacktree-feasibility-types";

import type { FeasibilityConfiguration } from "./attacktree-feasibility-types";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "./attacktree-feasibility-types";

// ==================== EVALUATION METHODS ====================

export type EvaluationMethod = "simple" | "extended";

export interface SimpleEvaluation {
  probability: number; // 0.0-1.0
  impact: number; // 1-5
}

export interface ExtendedEvaluation {
  feasibility: number; // 0.0-1.0 (technical complexity)
  benefits: number; // 0.0-1.0 (attacker motivation)
  impact: number; // 1-5
}

// ==================== SECURITY GOAL TYPES ====================

export type SecurityGoalType =
  | "C" // Confidentiality
  | "I" // Integrity
  | "A" // Availability
  | "N" // Non-repudiation
  | "AuthZ" // Authorization
  | "AuthN" // Authentication
  | "Acc"; // Accountability

// ==================== REFERENCE TYPES ====================
// Minimal types for cross-feature references (passed via props)

export interface AssetReference {
  id: string;
  name: string;
  securityGoals: Array<{
    type: SecurityGoalType;
    enabled: boolean;
  }>;
  overallImpact: number;
}

export interface ThreatReference {
  id: string;
  strideCategory: StrideCategory;
  threatDescription: string;
  mitigation?: string;
  linkedAssetIds?: string[];
}

export interface RiskReference {
  id: string;
  threatId: string;
  calculatedRiskBeforeMitigation: number;
  moscowPriority: string;
}

export interface DFDElementReference {
  id: string;
  type: string;
  name: string;
}

/**
 * Mitigation lifecycle status.
 *
 * Mirrors MitigationStatus from features/risks/models/risk-mitigation-types.ts.
 * Duplicated locally (not imported) to preserve the attack-tree module's weak
 * coupling: cross-feature data only ever arrives pre-extracted via the adapter
 * layer (extractMitigationReferences), never through direct type imports.
 * Keep this union in sync with the Risk feature.
 */
export type MitigationVerificationStatus =
  | "open"
  | "in_progress"
  | "in_review"
  | "implemented"
  | "verified"
  | "rejected";

export interface MitigationReference {
  id: string;
  description?: string;

  /**
   * Verification/implementation status, mirrored read-only from the Risk tab
   * (Risk.selectedMitigations[].status). Undefined = the mitigation is
   * referenced in the DSL but not tracked in any risk yet.
   */
  status?: MitigationVerificationStatus;

  /** Linked Jira/ADO ticket key (e.g. "SCRUM-42"), mirrored from the Risk tab. */
  ticketId?: string;

  /** Direct URL to the linked ticket, mirrored from the Risk tab. */
  ticketUrl?: string;
}

/**
 * Display colour + icon per verification status. Label is i18n — resolve with
 * t("attacktree:tabs.attacktree.mitigationStatus.<status>").
 */
export const MITIGATION_VERIFICATION_DISPLAY: Record<
  MitigationVerificationStatus,
  { color: string; icon: string }
> = {
  open: { color: "#9ca3af", icon: "⚪" },
  in_progress: { color: "#3b82f6", icon: "🔵" },
  in_review: { color: "#8b5cf6", icon: "🟣" },
  implemented: { color: "#22c55e", icon: "🟢" },
  verified: { color: "#16a34a", icon: "✅" },
  rejected: { color: "#ef4444", icon: "🔴" },
};

// ==================== ANCHOR SYSTEM ====================

export type AttackTreeAnchorType = "asset" | "threat" | "risk" | "standalone";

export interface AttackTreeAnchor {
  type: AttackTreeAnchorType;

  // Asset anchor (Critical Workflow)
  assetId?: string;
  assetName?: string;
  securityGoal?: SecurityGoalType;

  // Threat anchor (Standard Workflow)
  threatId?: string;
  threatTitle?: string;
  strideCategory?: StrideCategory;

  // Risk anchor (Standard Workflow)
  riskId?: string;
  riskLevel?: string;
  moscowPriority?: string;
}

// ==================== ATTACK GOAL CATEGORIES ====================

export type AttackGoalCategory =
  | "disclosure"
  | "manipulation"
  | "service-disruption"
  | "privilege-abuse"
  | "identity-misuse"
  | "accountability-evasion"
  | "destruction";

export const ATTACK_GOAL_TO_STRIDE: Record<
  AttackGoalCategory,
  StrideCategory[]
> = {
  disclosure: ["I"],
  manipulation: ["T"],
  "service-disruption": ["D"],
  "privilege-abuse": ["E"],
  "identity-misuse": ["S"],
  "accountability-evasion": ["R"],
  destruction: ["T", "D"],
};

export interface AttackGoalDefinition {
  id: AttackGoalCategory;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
  strideCategories: StrideCategory[];
  securityGoals: SecurityGoalType[];
}

export const ATTACK_GOAL_DEFINITIONS: AttackGoalDefinition[] = [
  {
    id: "disclosure",
    name: "Information Disclosure",
    nameDE: "Informationspreisgabe",
    description: "Unauthorized access to confidential data",
    descriptionDE: "Unbefugter Zugriff auf vertrauliche Daten",
    strideCategories: ["I"],
    securityGoals: ["C"],
  },
  {
    id: "manipulation",
    name: "Data Manipulation",
    nameDE: "Datenmanipulation",
    description: "Unauthorized modification of data or system state",
    descriptionDE: "Unbefugte Änderung von Daten oder Systemzustand",
    strideCategories: ["T"],
    securityGoals: ["I"],
  },
  {
    id: "service-disruption",
    name: "Service Disruption",
    nameDE: "Dienststörung",
    description: "Preventing legitimate access to services",
    descriptionDE: "Verhinderung des legitimen Zugriffs auf Dienste",
    strideCategories: ["D"],
    securityGoals: ["A"],
  },
  {
    id: "privilege-abuse",
    name: "Privilege Abuse",
    nameDE: "Rechtenmissbrauch",
    description: "Performing unauthorized operations",
    descriptionDE: "Ausführen nicht autorisierter Operationen",
    strideCategories: ["E"],
    securityGoals: ["AuthZ"],
  },
  {
    id: "identity-misuse",
    name: "Identity Misuse",
    nameDE: "Identitätsmissbrauch",
    description: "Impersonating another user or system",
    descriptionDE: "Ausgeben als anderer Benutzer oder System",
    strideCategories: ["S"],
    securityGoals: ["AuthN"],
  },
  {
    id: "accountability-evasion",
    name: "Accountability Evasion",
    nameDE: "Rechenschaftsumgehung",
    description: "Denying performed actions",
    descriptionDE: "Abstreiten durchgeführter Aktionen",
    strideCategories: ["R"],
    securityGoals: ["N", "Acc"],
  },
  {
    id: "destruction",
    name: "Destruction",
    nameDE: "Zerstörung",
    description: "Irreversible damage to data or systems",
    descriptionDE: "Irreversibler Schaden an Daten oder Systemen",
    strideCategories: ["T", "D"],
    securityGoals: ["I", "A"],
  },
];

// ==================== NODE TYPES ====================

export type NodeType = "ROOT" | "OR" | "AND" | "LEAF";

export interface AttackTreeNode {
  id: string;
  name: string;
  type: NodeType;
  level: number;
  lineNumber?: number;

  // TARA References
  assetRef?: string;
  dfdRef?: string;
  threatRef?: string;

  // Attack Goal
  attackGoal?: AttackGoalCategory;
  targetedSecurityGoals?: SecurityGoalType[];

  // Evaluation
  evaluation?: {
    simple?: SimpleEvaluation;
    extended?: ExtendedEvaluation;
    /**
     * Audit mode (Phase 2): the five attack-potential factors of ISO 21434
     * Annex G.2 / ISO/IEC 18045. Preferred over `simple`/`extended`, because
     * the feasibility→risk-scale mapping is then derived from the standard
     * rather than from a house convention.
     */
    attackPotential?: AttackPotentialFactors;
    /**
     * Attacker benefit. Parsed in BOTH likelihood models, but only folded into
     * the risk number in "feasibility-x-motivation" (IEC 62443 / classic).
     * In ISO mode it drives path plausibility, ordering and emission policy —
     * never the risk value (Cl. 3.1.29).
     */
    benefit?: BenefitLevel;
  };

  // Mitigations
  mitigations: string[];

  // Tree Structure
  children: AttackTreeNode[];
  parentId?: string;

  // Calculated Values
  riskScore?: number;
  probability?: number;
  criticalPath?: boolean;

  // UI State
  collapsed?: boolean;
  selected?: boolean;
}

// ==================== ATTACK PATH ASSESSMENT (Phase 5a) ====================

/**
 * The analyst's confirm/dismiss decision on ONE emitted attack-path threat.
 *
 * WHY THIS EXISTS
 * ---------------
 * generateThreatsFromAttackTree() is pure and always emits `relevance:
 * "unrated"` — it cannot know what the analyst decided. The decision has to be
 * persisted somewhere, and the tree is the only owner of the paths. This is
 * that store: the minimal state that turns a re-derivable threat set into a
 * workflow with memory.
 *
 * KEYED BY (pathKey, strideCategory), NOT pathKey ALONE
 * -----------------------------------------------------
 * A `destruction` path emits TWO threats (T and D — integrity and
 * availability). They are separately confirmable, so the assessment key must
 * carry the STRIDE suffix, matching the threat id AT-<treeId>-<pathKey>-<STRIDE>.
 *
 * The pathKey (Phase 1) is what makes the decision survive DSL edits: an
 * unrelated sibling insertion does not touch it, so the assessment stays
 * attached. Renaming a node ON this path changes the key — correct, that is a
 * different scenario that must be re-assessed.
 */
export interface AttackPathAssessment {
  pathKey: string;
  strideCategory: StrideCategory;
  relevance: ThreatRelevanceRef;
  evalNote?: string;
  /**
   * Catalogue mitigation ids attached to this path THROUGH THE DIALOG
   * (path-scoped, not a DSL edit). A leaf can appear in several paths under
   * shared AND/OR subtrees, so a path-level decision cannot be written back
   * into "the" leaf's DSL line unambiguously — it lives here instead. Stores
   * catalogue ids (e.g. "M-T-001"), never localized text. Legacy DSL
   * `[M-xxx]` refs on leaves stay separate and read-only (AttackPath.mitigations).
   */
  mitigationIds?: string[];
  /**
   * Catalogue verification ids attached to this path (e.g. "V-T-001") — the
   * tests/evidence that check the attached mitigations work. Flat and parallel
   * to mitigationIds, NOT linked per-mitigation: the existing threat model keeps
   * mitigations ∥ verifications independent and the catalogue carries no
   * mitigation→verification link, so a stored link would be hand-maintained.
   */
  verificationIds?: string[];
  lastModified: string;
}

// ==================== ATTACK TREE (Single Tree) ====================

/**
 * A single attack tree (one per anchor)
 */
export interface AttackTree {
  id: string;
  name: string;
  /**
   * Analyst-chosen override for the card/detail title (Phase 8 step 4).
   * When set, treeDisplayTitle shows this verbatim instead of the derived
   * title. The derived title (and `name`) are left untouched — this is a
   * pure overlay, never written by anything but the rename action, so
   * nothing (asset sync included) needs to guard against overwriting it.
   */
  customTitle?: string;
  description?: string;
  anchor: AttackTreeAnchor;
  dsl: string;
  ast?: AttackTreeNode;
  configuration: AttackTreeConfiguration;
  validation: AttackTreeValidation;
  pathAnalysis?: PathAnalysis;
  /**
   * Analyst confirm/dismiss decisions on this tree's emitted attack-path
   * threats (Phase 5a). Absent on every pre-5a tree → all paths read as
   * "unrated", which is exactly the pre-5a behaviour. Never written by the
   * pure generator; written only through the relevance workflow and carried
   * on the tree so it persists via the existing updateTree → auto-save path.
   */
  pathAssessments?: AttackPathAssessment[];
  /**
   * Threat-anchored trees ONLY. Opt-in split of "other routes to the same
   * effect" (see attacktree-threat-generator.ts). Unset (default): every path
   * feeds the anchor threat's likelihood via MAX aggregation, exactly as
   * before this feature existed — no behaviour change for existing projects.
   * Set: this path stays the one that feeds the anchor threat; every OTHER
   * path that also realises anchor.strideCategory becomes its own threat
   * candidate once confirmed, because a structurally different route usually
   * needs a different mitigation and deserves its own register entry.
   */
  primaryPathKey?: string;
  likelihoodExport?: LikelihoodExport;
  created: string;
  lastModified: string;
}

export interface LikelihoodExport {
  exportedToRisks: string[];
  maxPathProbability: number;
  avgPathProbability: number;
  criticalPathCount: number;
  lastExported: string;
}

// ==================== ATTACK TREE DATA (Persisted in Project) ====================

/**
 * Complete attack tree data for a project
 * This is what gets stored in Project.attackTrees
 * Analogous to ThreatData, RiskData, AssetData
 */
export interface AttackTreeData {
  /** All attack trees in the project */
  trees: AttackTree[];

  /** Project-wide configuration */
  configuration: AttackTreeProjectConfiguration;

  /** Validation state */
  validation?: AttackTreeDataValidation;

  /** Last modified timestamp */
  lastModified: string;
}

/**
 * Project-wide attack tree configuration
 */
export interface AttackTreeProjectConfiguration {
  defaultEvaluationMethod: EvaluationMethod;
  autoCreateForSecurityGoals: boolean;
  showLikelihoodExport: boolean;

  /**
   * Project-wide feasibility methodology (5b-1a): likelihood model
   * (ISO feasibility-only vs. Standard) + RC-15-11 method + bands/weights.
   * The single source of truth for how every tree in the project is rated, so
   * results stay comparable across the TARA (a mixed-method TARA is an audit
   * finding). Absent on pre-5b-1a projects → DEFAULT_FEASIBILITY_CONFIGURATION.
   */
  feasibilityConfiguration?: FeasibilityConfiguration;
}

export const DEFAULT_ATTACKTREE_PROJECT_CONFIGURATION: AttackTreeProjectConfiguration =
  {
    defaultEvaluationMethod: "simple",
    autoCreateForSecurityGoals: false,
    showLikelihoodExport: true,
  };

/**
 * Validation for the entire AttackTreeData
 */
export interface AttackTreeDataValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== SINGLE TREE CONFIGURATION ====================

export interface AttackTreeConfiguration {
  evaluationMethod: EvaluationMethod;
  autoSave: boolean;
  showLineNumbers: boolean;
  fontSize: number;
  highlightCriticalPath: boolean;
}

export const DEFAULT_ATTACKTREE_CONFIGURATION: AttackTreeConfiguration = {
  evaluationMethod: "simple",
  autoSave: true,
  showLineNumbers: true,
  fontSize: 14,
  highlightCriticalPath: true,
};

// ==================== SINGLE TREE VALIDATION ====================

export interface ValidationError {
  line: number;
  column?: number;
  type: "syntax" | "logic" | "tara" | "goal";
  severity: "error" | "warning" | "info";
  /** i18n key into the "attacktree" namespace, e.g. "tabs.attacktree.validation.tara.assetNotFound". */
  messageKey: string;
  /** Interpolation values for the key (node names, refs, methods, …). */
  params?: Record<string, string | number>;
  context?: string;
}

export interface AttackTreeValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
  lastValidated: string;
}

// ==================== PATH ANALYSIS ====================

export interface AttackPath {
  /**
   * Enumeration label ("path-1", "path-2", ...). DISPLAY ONLY.
   *
   * NOT an identity: it is assigned in traversal order, so inserting one DSL
   * line renumbers every subsequent path. Never persist it, never key an
   * assessment off it. Use `pathKey`.
   */
  id: string;

  /**
   * Stable identity, derived from the ROOT→leaf node-name chain
   * (see services/attacktree-path-identity.ts).
   *
   * Survives sibling insertion, branch reordering and reformatting; changes
   * when a node on the path is renamed (which is a different scenario and must
   * be re-assessed). This is the key an analyst's confirm/dismiss decision,
   * risk rating and Jira link hang on.
   */
  pathKey: string;

  path: string[];
  nodeIds: string[];

  /**
   * Attack feasibility of this path (ISO 21434 Cl. 15.7).
   *
   * Derived from the leaf's attack-potential factors (audit mode) or from its
   * probability (quick mode). Undefined when the leaf carries no evaluation at
   * all — an unrated path must NOT silently become "very-low", which would
   * understate it.
   */
  feasibilityLevel?: FeasibilityLevel;

  /** Attack potential sum behind `feasibilityLevel`, when audit mode was used. */
  attackPotential?: number;

  /**
   * Likelihood: feasibility, plus benefit iff the project's LikelihoodModel is
   * "feasibility-x-motivation" (IEC 62443 / classic). In ISO mode this always
   * equals `feasibilityLevel` — benefit never enters the risk number (3.1.29).
   */
  likelihoodLevel?: FeasibilityLevel;

  /** Attacker benefit stated on the leaf, if any. Analysis-only in ISO mode. */
  benefit?: BenefitLevel;
  riskScore: number;
  probability?: number;
  impact?: number;
  feasibility?: number;
  benefits?: number;
  attackGoals: AttackGoalCategory[];
  mitigations: string[];
  isCritical: boolean;
  isFullyMitigated: boolean;
}

export interface PathAnalysis {
  paths: AttackPath[];
  criticalPaths: AttackPath[];
  maxRiskScore: number;
  averageRiskScore: number;
  totalPaths: number;
  aggregatedLikelihood: number;
  likelihoodMethod: "max" | "weighted-avg";

  /**
   * Feasibility of the threat scenario as a whole = the MAXIMUM across its
   * attack paths (ISO 21434 15.8 NOTE 2, which gives the maximum as its
   * example). The attacker takes the easiest route, so the scenario is as
   * feasible as its most feasible path. Averaging would let a pile of hard
   * paths mask one trivial one.
   *
   * Undefined when no path carries an evaluation.
   */
  aggregatedFeasibility?: FeasibilityLevel;

  /** Same aggregation on the likelihood axis (differs from the above only in 62443 mode). */
  aggregatedLikelihoodLevel?: FeasibilityLevel;

  /** The single most feasible path — what `cheapest-per-goal` emission uses (Phase 4). */
  cheapestPath?: AttackPath;
  goalSummary: Record<AttackGoalCategory, number>;
  analysisDate: string;
}

// ==================== EXPORT FORMAT ====================

export interface AttackTreeExportData {
  version: string;
  exportedAt: string;
  projectId: string;
  projectName: string;
  attackTree: {
    name: string;
    description?: string;
    anchor: AttackTreeAnchor;
    dsl: string;
    configuration: AttackTreeConfiguration;
  };
}

// ==================== PROJECT DATA INTERFACE (Props) ====================

/**
 * What AttackTreeTab needs as props
 * Mapped in main-layout.tsx from Project
 * Analogous to ThreatProjectData, RiskProjectData
 */
export interface AttackTreeProjectData {
  id: string;
  name: string;
  phaseStatus: PhaseStatusMap;
  isHighImpact: boolean;

  /** Attack tree data (from Project.attackTrees) */
  attackTrees: AttackTreeData | null;

  /** References for validation (extracted in main-layout.tsx) */
  assets: AssetReference[];
  threats: ThreatReference[];
  risks: RiskReference[];
  dfdElements: DFDElementReference[];
  mitigations: MitigationReference[];

  /** DFD preview */
  dfdPreviewImage?: string;

  lastModified: string;
}

// ==================== UPDATE RESULT ====================

/**
 * What AttackTreeTab returns after updates
 * Analogous to ThreatUpdateResult, RiskUpdateResult
 */
export interface AttackTreeUpdateResult {
  attackTrees: AttackTreeData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== TAB PROPS ====================

export interface AttackTreeTabProps {
  project: AttackTreeProjectData;
  onUpdate: (updates: AttackTreeUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== PARSER RESULT ====================

export interface ParseResult {
  success: boolean;
  ast?: AttackTreeNode;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ==================== RISK CALCULATION ====================

export interface RiskCalculationResult {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  color: string;
}

export function calculateRiskLevel(
  score: number,
  method: EvaluationMethod,
): RiskCalculationResult {
  const maxScore = method === "simple" ? 25 : 125;
  const percentage = (score / maxScore) * 100;

  if (percentage >= 75) {
    return { score, level: "critical", color: "#d32f2f" };
  } else if (percentage >= 50) {
    return { score, level: "high", color: "#f57c00" };
  } else if (percentage >= 25) {
    return { score, level: "medium", color: "#fbc02d" };
  } else {
    return { score, level: "low", color: "#388e3c" };
  }
}

// ==================== TEMPLATES ====================

export interface AttackTreeTemplate {
  id: string;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
  dsl: string;
  category: "generic" | "web" | "iot" | "cloud" | "critical" | "custom";
  suitableFor: AttackTreeAnchorType[];
  securityGoals?: SecurityGoalType[];
}

export const ATTACK_TREE_TEMPLATES: AttackTreeTemplate[] = [
  {
    id: "template-confidentiality",
    name: "Confidentiality Breach",
    nameDE: "Vertraulichkeitsverletzung",
    description: "Attack tree for unauthorized data access (Critical Workflow)",
    descriptionDE:
      "Angriffsbaum für unbefugten Datenzugriff (Kritischer Workflow)",
    category: "critical",
    suitableFor: ["asset"],
    securityGoals: ["C"],
    dsl: `# Attack Tree: Confidentiality Breach
# Security Goal: C (Confidentiality)
# Method: Extended (f,b,i)

Unauthorized Data Access [ASSET_ID];ROOT @disclosure
\tRemote Attack;OR
\t\tSQL Injection;AND @disclosure
\t\t\tFind Injection Point;0.7,0.9,3
\t\t\tExtract Data;0.8,0.9,4 [M-001]
\t\tAPI Exploitation;0.5,0.8,3 @disclosure [M-002]
\tLocal Attack;OR
\t\tInsider Access;0.3,0.95,4 @disclosure [M-003]
\t\tPhysical Access;AND @disclosure
\t\t\tBypass Physical Security;0.2,0.5,2 [M-004]
\t\t\tExtract from Storage;0.4,0.8,4 [M-005]`,
  },
  {
    id: "template-integrity",
    name: "Integrity Violation",
    nameDE: "Integritätsverletzung",
    description: "Attack tree for data tampering (Critical Workflow)",
    descriptionDE: "Angriffsbaum für Datenmanipulation (Kritischer Workflow)",
    category: "critical",
    suitableFor: ["asset"],
    securityGoals: ["I"],
    dsl: `# Attack Tree: Integrity Violation
# Security Goal: I (Integrity)
# Method: Extended (f,b,i)

Data Tampering [ASSET_ID];ROOT @manipulation
\tApplication Layer;OR
\t\tInput Validation Bypass;AND @manipulation
\t\t\tFind Weak Validation;0.6,0.8,3
\t\t\tInject Malicious Data;0.7,0.9,4 [M-001]
\t\tLogic Manipulation;0.4,0.7,3 @manipulation [M-002]
\tTransport Layer;OR @manipulation
\t\tMITM Attack;AND
\t\t\tIntercept Communication;0.3,0.6,2 [M-003]
\t\t\tModify in Transit;0.5,0.8,4
\tStorage Layer;0.2,0.5,4 @manipulation [M-004]`,
  },
  {
    id: "template-availability",
    name: "Availability Attack",
    nameDE: "Verfügbarkeitsangriff",
    description: "Attack tree for denial of service (Critical Workflow)",
    descriptionDE: "Angriffsbaum für Dienstverweigerung (Kritischer Workflow)",
    category: "critical",
    suitableFor: ["asset"],
    securityGoals: ["A"],
    dsl: `# Attack Tree: Availability Attack
# Security Goal: A (Availability)
# Method: Extended (f,b,i)

Deny Service [ASSET_ID];ROOT @service-disruption
\tResource Exhaustion;OR
\t\tNetwork Flood;0.7,0.6,3 @service-disruption [M-001]
\t\tCPU Exhaustion;0.5,0.7,3 @service-disruption [M-002]
\t\tMemory Exhaustion;0.4,0.7,3 @service-disruption [M-002]
\tComponent Destruction;OR @destruction
\t\tData Corruption;AND
\t\t\tGain Write Access;0.3,0.8,4 [M-003]
\t\t\tCorrupt Critical Data;0.6,0.9,5
\t\tService Crash;0.5,0.6,3 @service-disruption [M-004]`,
  },
  {
    id: "template-db-access",
    name: "Database Access",
    nameDE: "Datenbankzugriff",
    description: "Generic attack tree for unauthorized database access",
    descriptionDE: "Generischer Angriffsbaum für unbefugten Datenbankzugriff",
    category: "generic",
    suitableFor: ["asset", "threat", "standalone"],
    dsl: `# Attack Tree: Unauthorized Database Access
# Method: Simple (p,i)

Access Database [ASSET_ID];ROOT
\tSQL Injection;OR
\t\tFind Vulnerable Endpoint;p=0.7,i=3
\t\tCraft Payload;p=0.9,i=3 [M-001]
\tSteal Credentials;OR
\t\tPhishing Attack;p=0.4,i=4 [M-002]
\t\tBrute Force;p=0.2,i=3 [M-003]
\tInsider Threat;p=0.1,i=5 [M-004]`,
  },
  {
    id: "template-api-access",
    name: "API Access",
    nameDE: "API-Zugriff",
    description: "Attack tree for unauthorized API access",
    descriptionDE: "Angriffsbaum für unbefugten API-Zugriff",
    category: "web",
    suitableFor: ["asset", "threat", "standalone"],
    dsl: `# Attack Tree: Unauthorized API Access
# Method: Extended (f,b,i)

Access API [ASSET_ID];ROOT
\tBypass Authentication;OR @identity-misuse
\t\tToken Theft;AND
\t\t\tIntercept Token;0.6,0.8,3 [M-005]
\t\t\tReplay Token;0.9,0.7,3
\t\tExploit Auth Bug;0.4,0.9,4 [M-006]
\tAPI Key Exposure;0.5,0.8,3 @disclosure [M-007]`,
  },
  {
    id: "template-iot-device",
    name: "IoT Device Compromise",
    nameDE: "IoT-Gerätekompromittierung",
    description: "Attack tree for IoT device attacks",
    descriptionDE: "Angriffsbaum für IoT-Geräteangriffe",
    category: "iot",
    suitableFor: ["asset", "threat", "standalone"],
    dsl: `# Attack Tree: IoT Device Compromise
# Method: Extended (f,b,i)

Compromise IoT Device [ASSET_ID];ROOT
\tNetwork Attack;OR
\t\tExploit Weak Protocol;0.6,0.8,4 @manipulation [M-001]
\t\tDefault Credentials;0.8,0.9,3 @identity-misuse [M-002]
\tFirmware Attack;OR
\t\tExtract Firmware;AND @disclosure
\t\t\tPhysical Access;0.3,0.5,2 [M-003]
\t\t\tDump Flash;0.7,0.8,3
\t\tMalicious Update;0.4,0.9,5 @manipulation [M-004]
\tSide Channel;0.2,0.6,3 @disclosure [M-005]`,
  },
];

// ==================== UTILITY FUNCTIONS ====================

/**
 * Create empty attack tree with anchor
 */
export function createEmptyAttackTree(
  anchor: AttackTreeAnchor,
  configuration?: Partial<AttackTreeConfiguration>,
): AttackTree {
  const anchorName = getAnchorDisplayName(anchor);

  return {
    id: generateAttackTreeId(),
    name: "Attack Tree: " + anchorName,
    description: "",
    anchor,
    dsl: generateInitialDSL(anchor),
    configuration: { ...DEFAULT_ATTACKTREE_CONFIGURATION, ...configuration },
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

export function getAnchorDisplayName(anchor: AttackTreeAnchor): string {
  switch (anchor.type) {
    case "asset":
      const goalSuffix = anchor.securityGoal
        ? " (" + anchor.securityGoal + ")"
        : "";
      return (
        (anchor.assetId || "Asset") +
        (anchor.assetName ? ": " + anchor.assetName : "") +
        goalSuffix
      );
    case "threat":
      return (
        (anchor.threatId || "Threat") +
        (anchor.threatTitle ? ": " + anchor.threatTitle : "")
      );
    case "risk":
      return (anchor.riskId || "Risk") + " [" + (anchor.riskLevel || "?") + "]";
    case "standalone":
      return "Standalone Analysis";
    default:
      return "Unknown";
  }
}

function generateInitialDSL(anchor: AttackTreeAnchor): string {
  const timestamp = new Date().toISOString().split("T")[0];

  switch (anchor.type) {
    case "asset":
      const goalComment = anchor.securityGoal
        ? "# Security Goal: " + anchor.securityGoal
        : "# Security Goal: (not specified)";
      return (
        "# Attack Tree: " +
        (anchor.assetName || anchor.assetId || "Asset") +
        "\n" +
        "# Asset: " +
        (anchor.assetId || "A-XX") +
        "\n" +
        goalComment +
        "\n" +
        "# Created: " +
        timestamp +
        "\n" +
        "# Method: Extended (f,b,i)\n\n" +
        "Attack Goal [" +
        (anchor.assetId || "A-XX") +
        "];ROOT\n" +
        "\t# TODO: Define attack paths\n" +
        "\tAttack Vector 1;OR\n" +
        "\t\tSub-Attack;0.5,0.5,3\n"
      );

    case "threat":
      return (
        "# Attack Tree: " +
        (anchor.threatTitle || anchor.threatId || "Threat Detail") +
        "\n" +
        "# Threat: " +
        (anchor.threatId || "T-XXX") +
        "\n" +
        "# STRIDE: " +
        (anchor.strideCategory || "?") +
        "\n" +
        "# Created: " +
        timestamp +
        "\n" +
        "# Method: Simple (p,i)\n\n" +
        (anchor.threatTitle || "Threat Goal") +
        " [" +
        (anchor.threatId || "T-XXX") +
        "];ROOT\n" +
        "\t# TODO: Define detailed attack paths\n" +
        "\tPrimary Attack;OR\n" +
        "\t\tStep 1;p=0.5,i=3\n" +
        "\t\tStep 2;p=0.5,i=3\n"
      );

    case "risk":
      return (
        "# Attack Tree: Risk Detail Analysis\n" +
        "# Risk: " +
        (anchor.riskId || "R-XXX") +
        "\n" +
        "# Risk Level: " +
        (anchor.riskLevel || "Unknown") +
        "\n" +
        "# Created: " +
        timestamp +
        "\n" +
        "# Method: Extended (f,b,i)\n\n" +
        "Risk Scenario [" +
        (anchor.riskId || "R-XXX") +
        "];ROOT\n" +
        "\t# TODO: Analyze attack vectors to refine likelihood\n" +
        "\tVector 1;OR\n" +
        "\t\tPath A;0.5,0.5,3\n" +
        "\t\tPath B;0.5,0.5,3\n"
      );

    case "standalone":
    default:
      return (
        "# Attack Tree: New Analysis\n" +
        "# Created: " +
        timestamp +
        "\n" +
        "# Method: Simple (p,i)\n\n" +
        "Root Goal;ROOT\n" +
        "\t# TODO: Define attack tree structure\n" +
        "\tAttack Path;OR\n" +
        "\t\tLeaf Node;p=0.5,i=3\n"
      );
  }
}

/**
 * Create empty AttackTreeData for new projects
 */
export function createDefaultAttackTreeData(): AttackTreeData {
  return {
    trees: [],
    configuration: { ...DEFAULT_ATTACKTREE_PROJECT_CONFIGURATION },
    lastModified: new Date().toISOString(),
  };
}

export function getTreesByAnchorType(
  data: AttackTreeData,
  type: AttackTreeAnchorType,
): AttackTree[] {
  return data.trees.filter(function (t) {
    return t.anchor.type === type;
  });
}

export function getTreesForAsset(
  data: AttackTreeData,
  assetId: string,
): AttackTree[] {
  return data.trees.filter(function (t) {
    return t.anchor.type === "asset" && t.anchor.assetId === assetId;
  });
}

export function getTreesForSecurityGoal(
  data: AttackTreeData,
  assetId: string,
  securityGoal: SecurityGoalType,
): AttackTree[] {
  return data.trees.filter(function (t) {
    return (
      t.anchor.type === "asset" &&
      t.anchor.assetId === assetId &&
      t.anchor.securityGoal === securityGoal
    );
  });
}

export function checkAssetAttackTreeCoverage(
  data: AttackTreeData,
  assetId: string,
  enabledSecurityGoals: SecurityGoalType[],
): {
  covered: SecurityGoalType[];
  missing: SecurityGoalType[];
  isComplete: boolean;
} {
  const assetTrees = getTreesForAsset(data, assetId);
  const coveredGoals: { [key: string]: boolean } = {};

  assetTrees.forEach(function (tree) {
    if (tree.anchor.securityGoal) {
      coveredGoals[tree.anchor.securityGoal] = true;
    }
  });

  const covered = enabledSecurityGoals.filter(function (g) {
    return coveredGoals[g];
  });
  const missing = enabledSecurityGoals.filter(function (g) {
    return !coveredGoals[g];
  });

  return {
    covered: covered,
    missing: missing,
    isComplete: missing.length === 0,
  };
}

export function getNodeTypeColor(type: NodeType): string {
  switch (type) {
    case "ROOT":
      return "#1976d2";
    case "OR":
      return "#ed6c02";
    case "AND":
      return "#9c27b0";
    case "LEAF":
      return "#2e7d32";
    default:
      return "#757575";
  }
}

export function getRiskScoreEmoji(
  level: "low" | "medium" | "high" | "critical",
): string {
  switch (level) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
  }
}

export function getAttackGoalColor(goal: AttackGoalCategory): string {
  switch (goal) {
    case "disclosure":
      return "#2196f3";
    case "manipulation":
      return "#ff9800";
    case "service-disruption":
      return "#f44336";
    case "privilege-abuse":
      return "#9c27b0";
    case "identity-misuse":
      return "#00bcd4";
    case "accountability-evasion":
      return "#795548";
    case "destruction":
      return "#d32f2f";
    default:
      return "#757575";
  }
}

export function getAnchorTypeIcon(type: AttackTreeAnchorType): string {
  switch (type) {
    case "asset":
      return "📦";
    case "threat":
      return "⚠️";
    case "risk":
      return "📊";
    case "standalone":
      return "🔍";
    default:
      return "📄";
  }
}

export function generateAttackTreeId(): string {
  return "at-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}

export function resolveFeasibilityConfiguration(
  cfg: AttackTreeProjectConfiguration | undefined,
): FeasibilityConfiguration {
  return cfg?.feasibilityConfiguration ?? DEFAULT_FEASIBILITY_CONFIGURATION;
}