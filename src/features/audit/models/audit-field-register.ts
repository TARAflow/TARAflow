// ==================== AUDIT FIELD REGISTER ====================
// 0.20 item 16 (audit diff gaps, decided with the user 2026-11-22): every
// changed field of the project file goes into the audit commit — the fields
// the DiffService compares in its own words, every other one by name with
// old → new (services/unlisted-changes.ts). This register names the fields
// that are NOT listed by name, and why:
//
//   covered       the DiffService lists it (its own wording)
//   derived       the app computes or copies it — no analyst's change
//   presentation  how things look, not what the analysis says (user
//                 2026-11-22: DFD layout and report settings are not audited)
//   runtime       session state, never meant for the trail
//   snapshot      a component's frozen state — its content hash is listed
//
// A field in no entry is listed. A new field therefore shows up in the trail
// until someone registers it — never the other way round. The coverage test
// (audit-diff-coverage.test.ts) changes every field of the fixtures once and
// checks that exactly one of the two lists it, or that the register leaves
// it out on purpose.
//
// Paths are on the audit view of the file (unlisted-changes.ts auditView):
// the threat tables flattened to threats/perElement and threats/perInteraction;
// array entries by their key ("[R-12]", "[likelihood]") or position. "*" is
// one segment, "**" any number (also none).

export type AuditFieldClass = "covered" | "derived" | "presentation" | "runtime" | "snapshot";

export interface AuditFieldEntry {
  path: string;
  class: AuditFieldClass;
  why: string;
}

const covered = (path: string, why: string): AuditFieldEntry => ({ path, class: "covered", why });
const derived = (path: string, why: string): AuditFieldEntry => ({ path, class: "derived", why });
const presentation = (path: string, why: string): AuditFieldEntry => ({ path, class: "presentation", why });
const runtime = (path: string, why: string): AuditFieldEntry => ({ path, class: "runtime", why });

export const AUDIT_FIELD_REGISTER: readonly AuditFieldEntry[] = [
  // ---- everywhere
  derived("**/lastModified", "timestamp"),
  derived("**/lastValidated", "timestamp"),
  derived("**/created", "timestamp"),
  derived("**/validation", "findings, recomputed"),
  derived("**/validation/**", "findings, recomputed"),

  // ---- project file and session
  runtime("id", "project identity"),
  derived("schemaVersion", "file format, set by the save"),
  runtime("_fromVersion", "migration marker"),
  runtime("_migrated", "migration marker"),
  runtime("isOpen", "session"),
  runtime("filePath", "session"),
  runtime("hasUnsavedChanges", "session"),
  runtime("lastOpened", "session"),
  runtime("currentPhase", "session"),
  runtime("status", "session"),
  derived("phaseStatus", "phase progress, recomputed"),
  derived("phaseStatus/**", "phase progress, recomputed"),
  derived("methodSelected", "legacy marker of the method choice"),
  derived("strideMethod", "legacy copy of threats.configuration.activeMethod"),

  // ---- DFD (compared by the DFD diff)
  covered("dfd", "DFD created / deleted"),
  covered("dfd/xml", "DFD diff: elements, flows, pages, layout"),
  covered("dfd/elements/*", "DFD diff: element added / removed"),
  covered("dfd/elements/*/id", "DFD diff"),
  covered("dfd/elements/*/type", "DFD diff"),
  covered("dfd/elements/*/name", "DFD diff"),
  covered("dfd/elements/*/displayId", "DFD diff"),
  covered("dfd/elements/*/description", "DFD diff"),
  covered("dfd/elements/*/properties", "DFD diff"),
  covered("dfd/elements/*/properties/**", "DFD diff"),
  covered("dfd/connections/*", "DFD diff: flow added / removed"),
  covered("dfd/connections/*/id", "DFD diff"),
  covered("dfd/connections/*/name", "DFD diff"),
  covered("dfd/connections/*/displayId", "DFD diff"),
  covered("dfd/connections/*/description", "DFD diff"),
  covered("dfd/connections/*/from", "DFD diff"),
  covered("dfd/connections/*/to", "DFD diff"),
  covered("dfd/connections/*/straight", "DFD diff"),
  covered("dfd/connections/*/entryX", "DFD diff"),
  covered("dfd/connections/*/entryY", "DFD diff"),
  covered("dfd/connections/*/exitX", "DFD diff"),
  covered("dfd/connections/*/exitY", "DFD diff"),
  covered("dfd/connections/*/properties", "DFD diff"),
  covered("dfd/connections/*/properties/**", "DFD diff"),
  covered("dfd/pages/*", "DFD diff: page added / removed"),
  covered("dfd/pages/*/pageId", "DFD diff"),
  covered("dfd/pages/*/decomposes", "DFD diff"),
  covered("dfd/pages/*/links", "DFD diff: context copies"),
  derived("dfd/pages/*/links/*/attached", "set by the component import (shell copies)"),
  covered("dfd/pages/*/links/**", "DFD diff: context copies"),
  presentation("dfd/elements/*/position/**", "layout"),
  presentation("dfd/elements/*/size/**", "layout"),
  presentation("dfd/connections/*/arrow/**", "layout"),
  presentation("dfd/connections/*/curved", "layout"),
  presentation("dfd/connections/*/offset/**", "layout"),
  presentation("dfd/connections/*/sourcePoint/**", "layout"),
  presentation("dfd/connections/*/targetPoint/**", "layout"),
  presentation("dfd/connections/*/waypoints", "layout"),
  presentation("dfd/connections/*/waypoints/**", "layout"),
  presentation("dfd/pages/*/order", "page order in the tree"),
  derived("dfd/thumbnail", "rendered image"),
  derived("dfd/pages/*/thumbnail", "rendered image"),
  derived("dfd/stats", "counts"),
  derived("dfd/stats/**", "counts"),
  derived("dfd/assets", "mirror of the assets for the DFD panel"),
  derived("dfd/assets/**", "mirror of the assets for the DFD panel"),

  // ---- assets (compareAssets)
  covered("assets/assets/*", "asset added / deleted"),
  covered("assets/assets/*/id", "asset identity"),
  covered("assets/assets/*/name", "Name"),
  covered("assets/assets/*/properties/description", "Description"),
  covered("assets/assets/*/properties/protectionNeed", "retired field"),
  covered("assets/assets/*/properties/criticality", "retired field"),
  covered("assets/assets/*/protectionNeed", "retired field"),
  covered("assets/assets/*/criticality", "retired field"),
  covered("assets/assets/*/overallImpact", "Overall Impact"),
  covered("assets/assets/*/impactRatings", "Impact Ratings"),
  covered("assets/assets/*/impactRatings/*", "Impact Ratings"),
  covered("assets/assets/*/impactRatings/*/value", "Impact Ratings"),
  derived("assets/assets/*/securityGoals/*", "a goal slot added / removed — its level is listed (none = no goal)"),
  covered("assets/assets/*/securityGoals/*/level", "Security Goals"),
  covered("assets/assets/*/securityGoals/*/formalDescription", "Security Goals"),
  covered("assets/assets/*/linkedDFDElements", "Linked DFD Elements"),
  covered("assets/assets/*/linkedDFDElements/*", "Linked DFD Elements (element + relation)"),
  derived("assets/assets/*/linkedDFDElements/*/displayId", "copy of the element's display id"),
  derived("assets/assets/*/linkedDFDElements/*/elementName", "copy of the element's name"),
  derived("assets/assets/*/linkedDFDElements/*/elementType", "copy of the element's type"),
  derived("assets/assets/*/numericId", "numbering"),
  derived("assets/assets/*/displayId", "numbering"),
  derived("assets/assets/*/aggregatedImpact", "computed from the ratings and the hazards"),
  derived("assets/assets/*/syncedWithDFD", "sync marker"),
  derived("assets/assets/*/source", "how the asset came in"),
  derived("assets/assets/*/importedFrom", "how the asset came in"),
  derived("assets/assets/*/securityGoals/*/suggestionAtDecision", "the suggestion recorded with the decision"),
  derived("assets/assets/*/securityGoals/*/suggestionAtDecision/**", "the suggestion recorded with the decision"),
  covered("assets/relations/*", "asset relation added / deleted"),
  covered("assets/relations/*/id", "asset relation identity"),
  covered("assets/relations/*/relationType", "asset relations"),
  covered("assets/relations/*/stepOrder", "asset relations"),
  covered("assets/relations/*/analyticallyActive", "asset relations"),
  covered("assets/relations/*/rationale", "asset relations"),
  covered("assets/relations/*/notes", "asset relations"),
  covered("assets/relations/*/degradationMode", "asset relations"),
  covered("assets/relations/*/degradationDescription", "asset relations"),
  // the endpoints never change in the app (a new edge instead) — named if they do

  // ---- threats (compareThreats; table fields are not in the view)
  derived("threats", "the phase container — its threats are listed"),
  covered("threats/perElement/*", "threat added / deleted"),
  covered("threats/perInteraction/*", "threat added / deleted"),
  covered("threats/*/*/threatDescription", "Threat Description"),
  covered("threats/*/*/relevance", "Relevance"),
  covered("threats/*/*/workflowStatus", "Workflow"),
  covered("threats/*/*/threatActor", "Threat actor"),
  covered("threats/*/*/evalNote", "Evaluation note"),
  covered("threats/*/*/attackDescription", "Attack Description"),
  covered("threats/*/*/proposedMitigations", "Mitigations"),
  covered("threats/*/*/proposedMitigations/**", "Mitigations"),
  covered("threats/*/*/proposedVerifications", "Verifications"),
  covered("threats/*/*/proposedVerifications/**", "Verifications"),
  covered("threats/configuration/customMitigations", "Project mitigation"),
  covered("threats/configuration/customMitigations/**", "Project mitigation"),
  covered("threats/catalogStamp", "Threat catalogue version"),
  covered("threats/catalogStamp/**", "Threat catalogue version"),
  derived("threats/*/*/id", "identity"),
  derived("threats/*/*/displayId", "numbering"),
  derived("threats/*/*/sequenceNumber", "numbering"),
  derived("threats/*/*/templateId", "catalogue template"),
  derived("threats/*/*/strideCategory", "from the template"),
  derived("threats/*/*/source", "how the threat came in"),
  derived("threats/*/*/isTextCustomized", "marker of a text edit (the text is listed)"),
  derived("threats/*/*/linkedElement", "copy of the DFD element"),
  derived("threats/*/*/linkedElement/**", "copy of the DFD element"),
  derived("threats/*/*/dataFlow", "copy of the DFD flow"),
  derived("threats/*/*/dataFlow/**", "copy of the DFD flow"),
  derived("threats/*/*/interactionContext", "from the DFD"),
  derived("threats/*/*/interactionContext/**", "from the DFD"),
  derived("threats/*/*/trustBoundaryId", "from the DFD"),
  derived("threats/*/*/trustBoundaryName", "from the DFD"),
  derived("threats/*/*/trustBoundaryDisplayId", "from the DFD"),
  derived("threats/*/*/initialImpact", "from the assets"),
  // re-derived from the DFD's asset relations on every graph sync
  // (refreshLinkedAssets) — moving a boundary listed 18 threats (0.20 manual
  // test D3, 2026-11-25)
  derived("threats/*/*/linkedAssetIds", "from the DFD's asset relations"),
  derived("threats/*/*/relevanceOverridden", "marker (the relevance is listed)"),
  derived("threats/*/*/review", "set when a rule changes"),
  derived("threats/*/*/review/**", "set when a rule changes"),
  derived("threats/*/*/retainedAfterRuleChange", "set when a rule changes"),
  derived("threats/*/*/retainedAfterRuleChange/**", "set when a rule changes"),
  derived("threats/configuration/customMitigationSeq", "counter"),
  presentation("threats/configuration/showThreatActor", "column shown"),
  // which method the Threats tab shows — the threats of both are compared and
  // reported (user, 0.20 manual test D5, 2026-11-26)
  presentation("threats/configuration/activeMethod", "method the Threats tab shows"),

  // ---- risks (compareRisks)
  derived("risks", "the phase container — its risks are listed"),
  covered("risks/risks/*", "risk added / deleted"),
  covered("risks/risks/*/calculatedRiskBeforeMitigation", "Risk Before Mitigation"),
  covered("risks/risks/*/calculatedRiskAfterMitigation", "Risk After Mitigation"),
  covered("risks/risks/*/moscowPriority", "MoSCoW Priority"),
  covered("risks/risks/*/treatment", "Treatment"),
  covered("risks/risks/*/treatmentJustification", "Treatment justification"),
  covered("risks/risks/*/wontJustification", "Won't justification"),
  covered("risks/risks/*/riskBeforeRationale", "Rationale before mitigation"),
  covered("risks/risks/*/riskAfterRationale", "Rationale after mitigation"),
  covered("risks/risks/*/selectedMitigations", "Mitigations"),
  covered("risks/risks/*/selectedMitigations/*", "Mitigations (added / removed)"),
  covered("risks/risks/*/selectedMitigations/*/status", "Mitigations"),
  covered("risks/risks/*/selectedVerifications", "Verifications"),
  covered("risks/risks/*/factorRatings", "Factor ratings"),
  covered("risks/risks/*/factorRatings/*", "Factor ratings"),
  covered("risks/risks/*/factorRatings/*/value", "Factor ratings"),
  covered("risks/risks/*/factorRatings/*/source", "Factor ratings"),
  covered("risks/risks/*/factorRatings/*/overrideRationale", "Factor ratings"),
  covered("risks/risks/*/mitigatedFactorRatings", "Factor ratings after mitigation"),
  covered("risks/risks/*/mitigatedFactorRatings/*", "Factor ratings after mitigation"),
  covered("risks/risks/*/mitigatedFactorRatings/*/value", "Factor ratings after mitigation"),
  covered("risks/risks/*/mitigatedFactorRatings/*/source", "Factor ratings after mitigation"),
  covered("risks/risks/*/mitigatedFactorRatings/*/overrideRationale", "Factor ratings after mitigation"),
  derived("risks/risks/*/factorRatings/*/derivedValue", "computed"),
  derived("risks/risks/*/factorRatings/*/weight", "from the configuration"),
  derived("risks/risks/*/mitigatedFactorRatings/*/derivedValue", "computed"),
  derived("risks/risks/*/mitigatedFactorRatings/*/weight", "from the configuration"),
  derived("risks/risks/*/threatId", "copy of the threat"),
  derived("risks/risks/*/threatDisplayId", "copy of the threat"),
  derived("risks/risks/*/threatDescription", "copy of the threat"),
  derived("risks/risks/*/attackDescription", "copy of the threat"),
  derived("risks/risks/*/causeDescription", "copy of the threat"),
  derived("risks/risks/*/strideCategory", "copy of the threat"),
  derived("risks/risks/*/threatRelevance", "copy of the threat"),
  derived("risks/risks/*/sourceStrideMethod", "copy of the threat"),
  derived("risks/risks/*/linkedAssetIds", "copy of the threat"),
  derived("risks/risks/*/proposedMitigations", "copy of the threat"),
  derived("risks/risks/*/proposedMitigations/**", "copy of the threat"),
  derived("risks/risks/*/proposedVerifications", "copy of the threat"),
  derived("risks/risks/*/proposedVerifications/**", "copy of the threat"),
  derived("risks/risks/*/calculatedImpact", "computed"),
  derived("risks/risks/*/calculatedLikelihood", "computed"),
  derived("risks/risks/*/calculatedApScore", "computed"),
  derived("risks/risks/*/calculatedApBand", "computed"),
  derived("risks/risks/*/calculatedSrsl", "computed"),
  derived("risks/risks/*/isoRisk", "computed"),
  derived("risks/risks/*/isoRisk/**", "computed"),
  derived("risks/risks/*/calcStamp", "calculation version"),
  derived("risks/risks/*/calcStamp/**", "calculation version"),
  derived("risks/risks/*/attackTreeAssessment", "from the attack tree"),
  derived("risks/risks/*/attackTreeAssessment/**", "from the attack tree"),
  derived("risks/risks/*/selectedMitigations/*/statusChangedAt", "timestamp"),
  derived("risks/risks/*/selectedMitigations/*/ticketStatus", "synced from the tracker"),
  derived("risks/risks/*/selectedMitigations/*/ticketSyncedAt", "timestamp"),
  runtime("risks/configuration/pendingSafetySourceRemoval", "pending dialog state"),
  derived("risks/configuration/likelihoodMethod", "from the regulation preset (method tags)"),
  derived("settings/regulationPreset", "from the method tags (project info, listed there)"),
  presentation("risks/configuration/showIndividualFactors", "columns shown"),
  presentation("risks/configuration/activeStrideMethod", "method the Risks tab shows"),

  // ---- attack trees (compareAttackTrees)
  derived("attackTrees", "the phase container — its trees are listed"),
  covered("attackTrees/trees/*", "attack tree added / deleted"),
  covered("attackTrees/trees/*/id", "identity"),
  covered("attackTrees/trees/*/name", "Name"),
  covered("attackTrees/trees/*/dsl", "DSL Content"),
  derived("attackTrees/trees/*/ast", "parsed from the DSL"),
  derived("attackTrees/trees/*/ast/**", "parsed from the DSL"),
  derived("attackTrees/trees/*/pathAnalysis", "computed from the DSL"),
  derived("attackTrees/trees/*/pathAnalysis/**", "computed from the DSL"),
  derived("attackTrees/trees/*/anchor/assetName", "copy of the asset"),
  derived("attackTrees/trees/*/anchor/threatTitle", "copy of the threat"),
  derived("attackTrees/trees/*/anchor/threatDisplayId", "copy of the threat"),
  presentation("attackTrees/trees/*/configuration/fontSize", "editor"),
  presentation("attackTrees/trees/*/configuration/showLineNumbers", "editor"),
  presentation("attackTrees/trees/*/configuration/highlightCriticalPath", "editor"),
  presentation("attackTrees/configuration/showLikelihoodExport", "export option"),

  // ---- hazards
  derived("hazards/relations/*/provenance", "how the relation came in"),
  derived("hazards/hazards/*/importMeta", "recorded at the import"),
  derived("hazards/hazards/*/importMeta/**", "recorded at the import"),

  // ---- compliance
  derived("compliance/**/statements/*/date", "timestamp of the statement"),
  derived("compliance/**/statements/*/modelStatusAtStatement", "the model's status recorded with the statement"),

  // ---- item definition, goals / claims, verifications (compareById)
  covered("itemDefinition/sections", "Section"),
  covered("itemDefinition/sections/**", "Section"),
  covered("itemDefinition/functions", "Function"),
  covered("itemDefinition/functions/**", "Function"),
  covered("itemDefinition/assumptions", "Assumption"),
  covered("itemDefinition/assumptions/**", "Assumption"),
  derived("itemDefinition/assumptionSeq", "counter"),
  covered("cybersecurityConcept/goals", "Goal"),
  covered("cybersecurityConcept/goals/**", "Goal"),
  covered("cybersecurityConcept/claims", "Claim"),
  covered("cybersecurityConcept/claims/**", "Claim"),
  covered("cybersecurityConcept/verifications", "Verification"),
  covered("cybersecurityConcept/verifications/**", "Verification"),
  derived("cybersecurityConcept/goalSeq", "counter"),
  derived("cybersecurityConcept/claimSeq", "counter"),

  // ---- imported components (compareById + compareInstances)
  // the snapshot first: the entry after it would claim it
  { path: "components/imports/*/snapshot", class: "snapshot", why: "the content hash is listed" },
  { path: "components/imports/*/snapshot/**", class: "snapshot", why: "the content hash is listed" },
  covered("components/imports/*", "Component import"),
  covered("components/imports/*/**", "Component import (without the snapshot)"),
  covered("components/imports/*/lastUpdate", "the update's lines"),
  covered("components/imports/*/lastUpdate/**", "the update's lines"),
  covered("components/instances/*", "Component instance added / deleted"),
  covered("components/instances/*/prefix", "Prefix"),
  covered("components/instances/*/quantity", "Quantity"),
  covered("components/instances/*/eeMapping", "EE mapping"),
  covered("components/instances/*/eeMapping/**", "EE mapping"),
  derived("components/instances/*/assumptions/*/instanceId", "identity"),
  covered("components/instances/*/assumptions", "assumption status"),
  covered("components/instances/*/assumptions/**", "assumption status"),
  covered("components/instances/*/relevanceOverrides", "Relevance"),
  covered("components/instances/*/relevanceOverrides/**", "Relevance"),
  covered("components/instances/*/measureOverrides", "Not effective here"),
  covered("components/instances/*/measureOverrides/**", "Not effective here"),
  covered("components/instances/*/pathOverlays", "Window of opportunity"),
  covered("components/instances/*/pathOverlays/**", "Window of opportunity"),
  covered("components/instances/*/citedClaims", "Cited"),
  covered("components/instances/*/citedClaims/**", "Cited"),
  covered("components/instances/*/reviewBasis", "Reviews open"),
  covered("components/instances/*/reviewBasis/**", "Reviews open"),
  derived("components/instances/*/id", "identity"),
  derived("components/instances/*/importId", "identity"),
  derived("components/instances/*/multiprocessTfId", "identity"),

  // ---- source bindings
  derived("sourceBindings/*/driftEvents", "recorded by the drift check"),
  derived("sourceBindings/*/driftEvents/**", "recorded by the drift check"),

  // ---- report (presentation, user 2026-11-22) and tool state
  presentation("documentation", "report settings and output"),
  presentation("documentation/**", "report settings and output"),
  derived("integration/connection/status", "connection test result"),
  derived("integration/connection/lastTested", "timestamp"),
  derived("integration/connection/projectName", "read from the tracker"),
  // the tracker project tickets go to — a tool setting that changes nothing in
  // the analysis, and dropped with every address change (user 2026-11-26)
  derived("integration/connection/credentials/projectKey", "tracker project chosen in the Issue tracker tab"),
  derived("integration/connection/issueTypes", "read from the tracker"),
  derived("integration/connection/issueTypes/**", "read from the tracker"),
  derived("audit/config/lastRoundNumber", "counter"),
  // Personal and machine-local values (PERSONAL_PATHS): prepareForDisk drops
  // them, so they change only once, when a file written before that is saved
  // again — not an analysis change (review of 201f1410, 2026-11-26).
  derived("audit/config/author", "personal — stays on this machine"),
  derived("audit/config/author/**", "personal — stays on this machine"),
  derived("audit/config/auth/patAccount", "machine-local — stays on this machine"),
  derived("audit/config/auth/sshKeyPath", "machine-local — stays on this machine"),
  derived("audit/config/signing/sshSigningKeyPath", "machine-local — stays on this machine"),
  derived("audit/config/signing/keyId", "personal — stays on this machine"),
  derived("audit/config/gpg/keyId", "personal — stays on this machine"),
  derived("audit/config/*/hasStoredKey", "runtime flag"),
  derived("integration/connection/credentials/email", "personal — stays on this machine"),
  derived("integration/connection/credentials/accountId", "personal — stays on this machine"),
];

/**
 * Field names whose values never go into the trail — listed as changed only,
 * anywhere in the file. The names prepareForDisk never writes under
 * `integration` (INTEGRATION_SECRET_KEYS) and those of keys and passphrases;
 * they reach a commit only from a file written before them. The rest of a
 * tracker connection — tracker, address, project — is a project setting and
 * listed with its values (user 2026-11-26).
 */
export const SECRET_FIELD_NAMES: readonly string[] = [
  "apiToken",
  "personalAccessToken",
  "accessToken",
  "refreshToken",
  "token",
  "password",
  "clientSecret",
  "passphrase",
  "privateKey",
];

/**
 * Personal and machine-local values — never with their value in the trail
 * either. prepareForDisk drops them (PERSONAL VALUES, LOCAL / CREDENTIAL
 * FIELDS), but a file written before that still holds them, and the first
 * commit after saving it again listed them with their values: the author's
 * e-mail, the tracker account, absolute key paths (review of 201f1410,
 * 2026-11-26 — before it, the whole credentials and auth blocks were masked).
 */
export const PERSONAL_PATHS: readonly string[] = [
  "audit/config/author/**",
  "audit/config/auth/patAccount",
  "audit/config/auth/sshKeyPath",
  "audit/config/signing/sshSigningKeyPath",
  "audit/config/signing/keyId",
  "audit/config/gpg/keyId",
  "integration/connection/credentials/email",
  "integration/connection/credentials/accountId",
];

/** Whether a path (segments) matches a pattern ("*" one segment, "**" any number). */
export function matchesPath(pattern: readonly string[], path: readonly string[]): boolean {
  if (pattern.length === 0) return path.length === 0;
  const [head, ...rest] = pattern;
  if (head === "**") {
    for (let i = 0; i <= path.length; i++) if (matchesPath(rest, path.slice(i))) return true;
    return false;
  }
  if (path.length === 0) return false;
  return (head === "*" || head === path[0]) && matchesPath(rest, path.slice(1));
}

const SPLIT = AUDIT_FIELD_REGISTER.map((e) => ({ ...e, segments: e.path.split("/") }));
const SECRET_NAMES = new Set(SECRET_FIELD_NAMES);
const PERSONAL_SPLIT = PERSONAL_PATHS.map((p) => p.split("/"));

/** The register entry of a path (the first that matches), if any. */
export function auditFieldEntry(path: readonly string[]): AuditFieldEntry | undefined {
  return SPLIT.find((e) => matchesPath(e.segments, path));
}

/** Whether a path's values stay out of the trail: a secret's name, or a personal value. */
export function isSecretPath(path: readonly string[]): boolean {
  return path.some((segment) => SECRET_NAMES.has(segment)) || PERSONAL_SPLIT.some((p) => matchesPath(p, path));
}
