// ==================== FIELD PURPOSE REGISTER ====================
//
// Model field purpose design (doc/Open/Risk/model-field-purpose-and-rating-
// context-design.md), phase 1 — roadmap-to-1.0.md rule 3.3: every input field
// of an asset and of every DFD element type has exactly one declared purpose
// (P2), so no field is entered without an effect again.
//
//   calculation    read for a result: threat generation, the threat catalogue
//                  (matching, closed-loop mitigation values), compliance
//                  evidence, a deriver, the graph analysis, a validator that
//                  derives a security finding from the value, the security
//                  drift. `readBy` names the files (src-relative) that read it.
//   context        rating context for the named likelihood factors (design §6,
//                  phase 2 — no field yet).
//   documentation  rendered in the report (element: the report's field layout
//                  or a model coverage field; asset: the description only).
//   pending        read by nothing today — the decision is open in the design
//                  (§5, §9); `note` says what is proposed. The set is frozen:
//                  the guard lets it shrink, never grow.
//
// The current truth of 0.20 (code at the 0.20 branch), not the target state.
// Plumbing does not count as a reader: the property types, defaults, option
// lists, forms, mappers, migrations, the asset sync, the diff and the
// validators that only ask for a value.
//
// Guard: src/tests/unit/shared/models/field-purpose-register.guard.test.ts —
// every field of the registered interfaces has an entry, every `readBy` file
// reads the field, every documentation field is in the report.

export type FieldPurpose =
  | {
      purpose: "calculation";
      readBy: readonly string[];
      /** Read under another name through this map (BLACK_BOX_FIELDS: Multiprocess black box → Process / DataStore rules). */
      via?: "BLACK_BOX_FIELDS";
    }
  | { purpose: "context"; factors: readonly string[] }
  | { purpose: "documentation" }
  | { purpose: "pending"; note: string };

/** The property interfaces the register covers, by their type name. */
export type RegisteredInterface =
  | "AssetProperties"
  | "ProcessProperties"
  | "MultiprocessProperties"
  | "ExternalEntityProperties"
  | "DataStoreProperties"
  | "DataFlowProperties"
  | "InterfaceProperties"
  | "TrustBoundaryProperties"
  | "ChipBoundaryProperties"
  | "PhysicalBoundaryProperties";

/** The DFD element type of each element interface (the report's layout key). */
export const REGISTERED_ELEMENT_TYPES: Readonly<Record<Exclude<RegisteredInterface, "AssetProperties">, string>> = {
  ProcessProperties: "Process",
  MultiprocessProperties: "Multiprocess",
  ExternalEntityProperties: "ExternalEntity",
  DataStoreProperties: "DataStore",
  DataFlowProperties: "DataFlow",
  InterfaceProperties: "Interface",
  TrustBoundaryProperties: "TrustBoundary",
  ChipBoundaryProperties: "ChipBoundary",
  PhysicalBoundaryProperties: "PhysicalBoundary",
};

const calc = (...readBy: string[]): FieldPurpose => ({ purpose: "calculation", readBy });
const viaBlackBox = (): FieldPurpose => ({
  purpose: "calculation",
  readBy: ["features/compliance/services/evaluate-matrix.ts"],
  via: "BLACK_BOX_FIELDS",
});
const DOC: FieldPurpose = { purpose: "documentation" };
const pending = (note: string): FieldPurpose => ({ purpose: "pending", note });

export const FIELD_PURPOSE_REGISTER: Readonly<Record<RegisteredInterface, Readonly<Record<string, FieldPurpose>>>> = {
  AssetProperties: {
    category: calc("features/assets/services/asset-cianaaa-deriver.ts"),
    description: DOC,
    owner: pending("not in the report — documentation → report (model-field-purpose design §5)"),
    notes: pending("not in the report — documentation → report (model-field-purpose design §5)"),
    dataType: pending("deriver input or documentation (D4)"),
    lifecycle: pending("keep as rating context → window of opportunity (D3, phase 2)"),
    isSafetyFunction: pending("retire — the derived safety chain replaces it (model-field-purpose design §5)"),
    externalRefs: pending("documentation → report (model-field-purpose design §5)"),
    automationLevel: pending("keep as rating context → intrusion detection, window of opportunity (D3, phase 2)"),
    changeFrequency: pending("keep as rating context → window of opportunity (D3, meaning to confirm)"),
    domain: pending("retire — the project tag \"domain\" (model-field-purpose design §5)"),
    regulatoryReference: pending("documentation → report (model-field-purpose design §5)"),
    isValidatedProcess: pending("documentation → report (model-field-purpose design §5)"),
    validationRationale: pending("documentation → report (model-field-purpose design §5)"),
    exposure: pending("retire in 0.21 (D2) — context from the elements"),
    physicalAccessControl: pending("retire in 0.21 (D2) — context from the physical boundary"),
    location: pending("retire in 0.21 (D2) — context from the elements"),
    environmentalHazard: pending("retire — the hazard tab replaces it (model-field-purpose design §5)"),
    isUnique: pending("retire or report (model-field-purpose design §5)"),
    uniquenessRationale: pending("retire or report (model-field-purpose design §5)"),
    portability: pending("retire in 0.21 (D2) — PhysicalBoundary.physicalMobility"),
    serviceType: pending("retire in 0.21 (D2) — ExternalEntity.entityType"),
    responsibility: pending("keep as rating context → knowledge, threat source (D3, phase 2)"),
    responsibilityScope: pending("documentation → report (model-field-purpose design §5)"),
    providerName: pending("documentation → report (model-field-purpose design §5)"),
    slaReference: pending("documentation → report (model-field-purpose design §5)"),
    role: pending("retire in 0.21 (D2) — context from the external entity"),
    securityRelevant: pending("retire — every modelled asset is (model-field-purpose design §5)"),
    isProtectionTarget: pending("retire — isHazardTarget replaces it (model-field-purpose design §5)"),
    isSecureStorage: calc("features/assets/services/asset-cianaaa-deriver.ts"),
    isBusinessSecret: calc("features/assets/services/asset-cianaaa-deriver.ts"),
    isPersonalData: calc("features/assets/services/asset-cianaaa-deriver.ts"),
    physicalImpact: calc("features/threats/utils/stride-modifier.ts", "features/assets/services/asset-physical-impact-deriver.ts"),
    physicalImpactSource: calc("features/assets/services/asset-physical-impact-deriver.ts", "app/utils/commit-hazard-safety.ts"),
    physicalImpactRationale: calc("features/assets/services/asset-physical-impact-deriver.ts", "app/utils/commit-hazard-safety.ts"),
    isHighValueAsset: calc("features/assets/services/asset-hva-deriver.ts", "features/assets/services/asset-physical-impact-deriver.ts"),
    isHighValueAssetSource: calc("features/assets/services/asset-hva-deriver.ts"),
    assetDestructionImpact: calc("features/assets/services/asset-hva-deriver.ts", "features/assets/services/asset-physical-impact-deriver.ts"),
    replacementLeadTime: calc("features/assets/services/asset-hva-deriver.ts"),
    replacementLeadTimeNote: pending("rationale of an HVA factor — not in the report"),
    vendorDependency: calc("features/assets/services/asset-hva-deriver.ts"),
    spareAvailability: calc("features/assets/services/asset-hva-deriver.ts"),
    highValueRationale: pending("rationale of the HVA flag — not in the report"),
  },
  ProcessProperties: {
    runsAs: DOC,
    privilegeLevel: calc("features/compliance/data/evidence-rules.ts"),
    authenticationRequired: calc("features/threats/services/threat-catalog-service.ts"),
    tlsTermination: calc("features/dfd/services/validators/endpoint-protection-validator.ts"),
    authorizationModel: calc("features/threats/services/catalog/mitigations/mitigations-denial.json"),
    inputValidation: calc("features/compliance/data/evidence-rules.ts"),
    errorHandling: calc("features/compliance/data/evidence-rules.ts"),
    securityControls: pending("named by the report's label table, not in its layout"),
    exposedToInternet: calc("features/compliance/data/evidence-rules.ts"),
    technology: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    processSemantic: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    malwareProtection: calc("features/compliance/data/evidence-rules.ts"),
    failSafeOutputState: calc("features/threats/services/threat-catalog-service.ts"),
    accountManagement: calc("features/threats/services/threat-catalog-service.ts"),
    authenticatorStorage: calc("features/threats/services/threat-catalog-service.ts"),
    userAccounts: calc("features/compliance/data/evidence-rules.ts"),
    passwordStrength: calc("features/compliance/data/evidence-rules.ts"),
    passwordLifetime: calc("features/compliance/data/evidence-rules.ts"),
    roleMapping: calc("features/compliance/data/evidence-rules.ts"),
    defaultCredentials: calc("features/compliance/data/evidence-rules.ts"),
    authenticatorChangeable: calc("features/compliance/data/evidence-rules.ts"),
    loginLockout: calc("features/compliance/data/evidence-rules.ts"),
    updateDelivery: calc("features/compliance/data/evidence-rules.ts"),
    updateEncryption: calc("features/dfd/services/validators/endpoint-protection-validator.ts"),
    keyRenewal: calc("features/dfd/services/validators/endpoint-protection-validator.ts"),
    updateDefaults: DOC,
    secureByDefault: calc("features/compliance/data/evidence-rules.ts"),
    securityConfigReporting: calc("features/compliance/data/evidence-rules.ts"),
    userDataDeletion: calc("features/compliance/data/evidence-rules.ts"),
    sessionControl: calc("features/compliance/data/evidence-rules.ts"),
    updateMechanism: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    nonRepudiation: calc("features/compliance/data/evidence-rules.ts", "features/compliance/data/en50742-a-rules.ts"),
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    owner: DOC,
    notes: DOC,
  },
  MultiprocessProperties: {
    noChildPage: calc("features/dfd/services/leveled/child-pages-orchestrator.ts"),
    systemClass: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    operatingSystem: DOC,
    certificationLevel: DOC,
    updateMechanism: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    sessionControl: calc("features/compliance/data/evidence-rules.ts"),
    boundaryAuthentication: calc("features/threats/services/threat-catalog-service.ts", "features/compliance/data/evidence-rules.ts"),
    tlsTermination: calc("features/dfd/services/validators/endpoint-protection-validator.ts"),
    authorizationModel: calc("features/threats/services/catalog/mitigations/mitigations-denial.json"),
    exposedToInternet: calc("features/compliance/data/evidence-rules.ts"),
    remoteAccessEnabled: calc("features/compliance/data/evidence-rules.ts"),
    airGapped: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    multiTenant: calc("features/threats/utils/stride-modifier.ts"),
    safetyRelevant: calc("features/threats/utils/stride-modifier.ts"),
    safetyRationale: DOC,
    internalComponents: DOC,
    securitySummary: DOC,
    malwareProtection: calc("features/compliance/data/evidence-rules.ts"),
    accountManagement: calc("features/threats/services/threat-catalog-service.ts"),
    authenticatorStorage: calc("features/threats/services/threat-catalog-service.ts"),
    userAccounts: calc("features/compliance/data/evidence-rules.ts"),
    passwordStrength: calc("features/compliance/data/evidence-rules.ts"),
    passwordLifetime: calc("features/compliance/data/evidence-rules.ts"),
    roleMapping: calc("features/compliance/data/evidence-rules.ts"),
    defaultCredentials: calc("features/compliance/data/evidence-rules.ts"),
    authenticatorChangeable: calc("features/compliance/data/evidence-rules.ts"),
    loginLockout: calc("features/compliance/data/evidence-rules.ts"),
    updateDelivery: calc("features/compliance/data/evidence-rules.ts"),
    updateEncryption: calc("features/dfd/services/validators/endpoint-protection-validator.ts"),
    keyRenewal: calc("features/dfd/services/validators/endpoint-protection-validator.ts"),
    updateDefaults: DOC,
    secureByDefault: calc("features/compliance/data/evidence-rules.ts"),
    securityConfigReporting: calc("features/compliance/data/evidence-rules.ts"),
    userDataDeletion: calc("features/compliance/data/evidence-rules.ts"),
    innerInputValidation: viaBlackBox(),
    innerErrorHandling: viaBlackBox(),
    innerFailSafeOutputState: viaBlackBox(),
    innerDataClassification: viaBlackBox(),
    innerEncryptionAtRest: viaBlackBox(),
    innerIntegrityProtection: viaBlackBox(),
    innerDeletionMechanism: viaBlackBox(),
    backupMechanism: calc("features/threats/services/threat-catalog-service.ts"),
    nonRepudiation: calc("features/compliance/data/evidence-rules.ts", "features/compliance/data/en50742-a-rules.ts"),
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    owner: DOC,
    notes: DOC,
  },
  ExternalEntityProperties: {
    entityType: calc("features/threats/services/threat-catalog-service.ts", "features/compliance/data/evidence-rules.ts"),
    trustLevel: DOC,
    authenticationMethod: DOC,
    authorizationScope: DOC,
    ownership: DOC,
    threatActor: DOC,
    contractExists: DOC,
    rateLimited: calc("features/threats/services/catalog/mitigations/mitigations-denial.json"),
    threatProfile: pending("dead (phase 3 F-scoring never built) — retire (model-field-purpose design §5 §5.2)"),
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    owner: DOC,
    notes: DOC,
  },
  DataStoreProperties: {
    storedDataTypes: calc("features/compliance/data/evidence-rules.ts", "features/compliance/data/en50742-a-rules.ts"),
    dataClassification: calc("features/compliance/data/evidence-rules.ts"),
    encryptionAtRest: calc("features/compliance/data/evidence-rules.ts"),
    accessControlMechanism: calc("features/threats/services/catalog/mitigations/mitigations-denial.json"),
    accessControl: DOC,
    integrityProtection: calc("features/threats/services/catalog/mitigations/mitigations-repudiation.json"),
    backupEnabled: calc("features/compliance/data/evidence-rules.ts"),
    cryptoStandard: calc("features/threats/services/threat-catalog-service.ts"),
    deletionMechanism: calc("features/compliance/data/evidence-rules.ts"),
    deletionPolicy: DOC,
    technology: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    accessModel: calc("features/threats/services/threat-catalog-service.ts"),
    accessModelSource: pending("provenance of accessModel — read by the property validator only"),
    accessModelRationale: DOC,
    multiTenant: calc("features/threats/utils/stride-modifier.ts"),
    containsSafetyRelevantData: calc("features/threats/utils/stride-modifier.ts"),
    safetyRationale: DOC,
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    owner: DOC,
    notes: DOC,
  },
  DataFlowProperties: {
    protocol: calc("features/threats/services/threat-catalog-service.ts"),
    frequency: DOC,
    messageType: DOC,
    dataClassification: calc("features/compliance/data/evidence-rules.ts"),
    dataTypeNotes: DOC,
    accessMode: calc("features/threats/services/threat-catalog-service.ts"),
    dataMinimization: pending("documentation → report (model-field-purpose design §5 §5.2)"),
    volume: pending("named by the report's label table, not in its layout"),
    encryptionInTransit: calc("features/threats/services/threat-catalog-service.ts"),
    integrityProtection: calc("features/threats/services/catalog/mitigations/mitigations-repudiation.json"),
    endpointAuthentication: calc("features/compliance/data/evidence-rules.ts"),
    exposureLevel: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    exposureLevelSource: calc("features/dfd/services/dfd-graph-builder.ts"),
    exposureLevelRationale: pending("documentation → report (model-field-purpose design §5 §5.2)"),
    location: calc("features/threats/services/threat-catalog-service.ts"),
    locationRationale: DOC,
    medium: calc("features/dfd/services/dfd-graph-builder.ts", "features/dfd/services/validators/endpoint-protection-validator.ts"),
    couplingMode: pending("sensor / actuator model (transducer design) — not wired yet"),
    injectability: pending("sensor / actuator feasibility gating (transducer design) — keep"),
    controllability: pending("sensor / actuator feasibility gating (transducer design) — keep"),
    redundancy: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    physicalPathProtection: calc("features/threats/services/threat-elimination-filter.ts", "features/threats/services/threat-catalog-service.ts"),
    safetyFunction: calc("features/threats/services/threat-catalog-service.ts"),
    crossesSafetyBoundary: pending("named in the STRIDE modifier's comment and type, read by nothing"),
    safetyRationale: DOC,
    cryptoStandard: calc("features/threats/services/threat-catalog-service.ts"),
    assumedTrusted: pending("copied into the reference graph (to-reference-graph.ts), read by nothing — rationale input + check (design §5.2)"),
    assumedTrustedRationale: pending("no input yet — input + check when assumedTrusted is set (design §5.2)"),
    excludeFromThreatGen: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/per-element/element-generator.ts"),
    excludeFromThreatGenRationale: DOC,
    refines: calc("features/dfd/services/leveled/effective-model.ts", "features/dfd/services/leveled/leveled-analysis.ts"),
    abstract: calc("features/dfd/services/leveled/effective-model.ts", "features/dfd/services/leveled/leveled-analysis.ts"),
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    notes: DOC,
  },
  InterfaceProperties: {
    type: calc("features/threats/services/threat-catalog-service.ts", "features/threats/utils/stride-modifier.ts"),
    location: calc("features/threats/services/threat-catalog-service.ts"),
    operationalState: calc("features/threats/services/threat-elimination-filter.ts"),
    connectorType: calc("features/dfd/services/validators/element-validator.ts"),
    connectionSpeed: pending("named by the report's label table, not in its layout"),
    exposureLevel: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    exposureLevelSource: calc("features/dfd/services/dfd-graph-builder.ts"),
    exposureLevelRationale: pending("documentation → report (model-field-purpose design §5 §5.2)"),
    implementedControls: calc("features/threats/services/threat-elimination-filter.ts", "features/threats/services/threat-catalog-service.ts"),
    safetyRelevant: calc("features/threats/utils/stride-modifier.ts"),
    safetyRationale: DOC,
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    notes: DOC,
  },
  TrustBoundaryProperties: {
    boundaryId: pending("written by the DFD parser, read by nothing"),
    boundaryType: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    defaultExposureLevel: calc("features/dfd/services/dfd-graph-builder.ts"),
    securityAssumptions: DOC,
    assumptionIds: calc("app/services/component-import/cited-claims.ts", "features/risks/services/concept-findings.ts"),
    boundaryControlTypes: calc("features/compliance/data/evidence-rules.ts", "app/services/compliance-report.ts"),
    customBoundaryControls: DOC,
    monitoringEnabled: calc("features/compliance/data/evidence-rules.ts"),
    complianceRelevance: DOC,
    defaultDenyPolicy: calc("features/compliance/data/evidence-rules.ts", "shared/utils/control-value-semantics.ts"),
    owner: DOC,
    notes: DOC,
  },
  ChipBoundaryProperties: {
    chipType: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    defaultExposureLevel: calc("features/dfd/services/dfd-graph-builder.ts"),
    debugInterfacePresent: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    debugInterfaceLocked: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    secureBootEnabled: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    firmwareProtection: calc("features/threats/utils/stride-modifier.ts", "features/compliance/data/evidence-rules.ts"),
    bitstreamEncryption: calc("features/threats/utils/stride-modifier.ts"),
    tamperProtection: calc("features/compliance/data/evidence-rules.ts"),
    supplyChainTrust: calc("features/threats/utils/stride-modifier.ts"),
    authenticatorStorage: calc("features/threats/services/threat-catalog-service.ts"),
    cryptoStandard: calc("features/threats/services/threat-catalog-service.ts"),
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    safetyRelevant: calc("features/threats/utils/stride-modifier.ts"),
    safetyRationale: pending("ChipBoundary is not in the report"),
    notes: pending("ChipBoundary is not in the report"),
  },
  PhysicalBoundaryProperties: {
    boundaryType: calc("features/threats/utils/stride-modifier.ts", "features/threats/services/threat-catalog-service.ts"),
    physicalExposureLevel: calc("features/dfd/services/dfd-graph-builder.ts"),
    physicalMobility: calc("features/threats/services/threat-catalog-service.ts"),
    accessibility: calc("features/threats/services/threat-catalog-service.ts"),
    tamperProtection: calc("features/compliance/data/evidence-rules.ts"),
    physicalAccessControl: calc("features/threats/services/catalog/mitigations/mitigations-physicalboundary.json"),
    monitoringType: calc("features/threats/services/threat-catalog-service.ts"),
    customPhysicalControls: DOC,
    debugInterfaceAccessible: calc("features/threats/services/threat-catalog-service.ts"),
    removableMediaAccessible: calc("features/threats/services/threat-catalog-service.ts"),
    requiresToolAccess: calc("features/threats/services/catalog/mitigations/mitigations-physicalboundary.json"),
    safetyRelevant: calc("features/threats/utils/stride-modifier.ts"),
    safetyRationale: DOC,
    securityControlOwnership: calc("app/hooks/use-security-drift.ts", "features/dfd/services/apply-control-suggestion.ts"),
    owner: DOC,
    notes: DOC,
  },
};
