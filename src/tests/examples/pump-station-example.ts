// src/tests/examples/pump-station-example.ts
//
// The "Pump Station Controller" example: an industrial component under the
// CRA edition of IEC 62443-4-2 (iec-62443-4-2-cra-coverage.md IEC-10). It
// shows the requirement matrix with every status: rows met by the model,
// rows met only by planned mitigations, rows closed by a statement, open
// statements, gaps and rows that do not apply.
//
// Everything runs through the REAL services, like the Simple Controller
// examples: the app's DFD parser reads the diagram (pump-station-diagram.ts),
// the asset factory / deriver / impact calculator build the assets, the
// threat generators the threats, the risk sync the risks. Only the analyst
// decisions are written here: the element properties, the relevance of the
// threats, the chosen mitigations with their status and the statements.
//
// pump-station-example.test.ts checks what the example promises and writes
// the file when WRITE_EXAMPLES=<dir> is set.

import type { Asset, AssetConfiguration, AssetData } from "features/assets/models/asset-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";
import type { AssetProperties } from "shared/models/asset-property-types";
import type { A2ARelation } from "shared/models/a2a-relation-types";
import type { A2ARelationType } from "shared/models/asset-group-types";
import { addA2ARelation } from "shared/services/a2a-relation-service";
import type { ItemDefinition } from "shared/models/item-definition-types";
import type { SecurityGoalType } from "features/assets/models/asset-security-goals-types";
import { createEmptyAsset } from "features/assets/services/asset-factory";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import { recalculateAllImpacts } from "features/assets/services/asset-impact-calculator";
import { dfdParser } from "features/dfd/services/dfd-parser";
import type {
  DataFlowProperties,
  DataStoreProperties,
  ExternalEntityProperties,
  InterfaceProperties,
  MultiprocessProperties,
  PhysicalBoundaryProperties,
  ProcessProperties,
  TrustBoundaryProperties,
} from "features/dfd/models/element-properties";
import type { ExposureLevel } from "features/dfd/models/element-shared-types";
import { DFDGraphAnalysisContext } from "features/dfd";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import { createDefaultThreatData } from "features/threats/models/threat-types";
import type { ThreatData, ThreatProjectData, ThreatTable } from "features/threats/models/threat-types";
import { getAllMitigations } from "features/threats";
import { createDefaultRiskData } from "features/risks/models/risk-assessment-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { ALL_PREDEFINED_FACTORS } from "features/risks/models/risk-factor-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import type { MitigationStatus } from "features/risks/models/risk-mitigation-types";
import type { ComplianceData, ComplianceStatement } from "shared/models/compliance-data-types";
import { deriveDfdAssets } from "app/utils/asset-to-dfd-mapper";
import { resolveDfdGraph } from "app/utils/resolve-dfd-graph";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { extractThreatReferences } from "app/utils/extract-threat-references";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { meetsExpected, readControlValue } from "shared/utils/control-value-semantics";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { commitLoadedPhaseStatus } from "app/services/phase-status-commit";
import type { Project } from "app/models/project-types";
import { dfdService } from "features/dfd/services/dfd-service";
import { threatPhaseStatus } from "features/threats/services/threat-phase-status";
import { riskService } from "features/risks/services/risk-service";
import { PHASE_STATUS_KEY } from "shared/models/common-types";
import { createDefaultDocData } from "features/documentation/models/doc-types";
import { pumpStationXml } from "./pump-station-diagram";
import { EDITION_2019, EDITION_PRAA_2026, statementKeyOf } from "features/compliance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProjectJson = any;

const DATE = "2026-11-01T00:00:00.000Z";
const SCALE = "4-level" as const;

/** Default asset criteria — the example is not safety-relevant (no hazard analysis). */
export const ASSET_CONFIGURATION: AssetConfiguration = DEFAULT_ASSET_CONFIGURATION;

// ── Element properties (the analyst's model) ────────────────────────────────
// Deliberate weak spots, so the matrix has something to say:
//   DF-7   engineering download: password, no encryption — planned fix open
//   DF-10/11  fieldbus to the pumps: no authentication, CRC only — a gap
//   DF-9   service USB: password, no encryption

const exposure = (level: ExposureLevel, rationale: string) => ({
  exposureLevel: level,
  exposureLevelSource: "manual" as const,
  exposureLevelRationale: rationale,
});

/** Typed per element type: a value the DFD cannot hold does not compile. */
const as = <T,>(properties: T) => properties as Record<string, unknown>;

const PROPERTIES: Record<string, Record<string, unknown>> = {
  CN: as<TrustBoundaryProperties>({
    boundaryType: "network",
    boundaryControlTypes: ["firewall", "network_segmentation"],
    defaultDenyPolicy: ["deny_all_permit_exception"],
    monitoringEnabled: true,
    defaultExposureLevel: "EL2",
  }),
  CAB: as<PhysicalBoundaryProperties>({
    boundaryType: "cabinet",
    accessibility: "controlled",
    physicalAccessControl: "key",
    tamperProtection: "switch",
    monitoringType: "tamper_monitoring",
    physicalExposureLevel: "PEL2",
    physicalMobility: "fixed",
    debugInterfaceAccessible: false,
    removableMediaAccessible: true,
    requiresToolAccess: true,
  }),
  "P-1": as<ProcessProperties>({
    processSemantic: "execution_unit",
    technology: "ui",
    authenticationRequired: "yes",
    authorizationModel: "rbac",
    accountManagement: "local_only",
    authenticatorStorage: "software_only",
    inputValidation: "strict",
    errorHandling: "sanitized",
    nonRepudiation: "audit_log",
    malwareProtection: "application_whitelist",
    privilegeLevel: "low",
    runsAs: "user",
    exposedToInternet: false,
    failSafeOutputState: "hold_last_value",
    sessionControl: { sessionLockEnabled: true, remoteTerminationEnabled: true, maxConcurrentSessions: 1 },
  }),
  "MP-1": as<MultiprocessProperties>({
    systemClass: "embedded_controller",
    operatingSystem: "rtos",
    updateMechanism: "signed_ota",
    boundaryAuthentication: "certificate",
    tlsTermination: "server",
    authorizationModel: "rbac",
    accountManagement: "local_only",
    authenticatorStorage: "secure_element",
    malwareProtection: "code_signing",
    backupMechanism: "manual_local",
    nonRepudiation: "audit_log",
    remoteAccessEnabled: true,
    // Engineering, SCADA and remote service sessions (CR 2.5 – 2.7).
    sessionControl: { sessionLockEnabled: true, remoteTerminationEnabled: true, maxConcurrentSessions: 2 },
    exposedToInternet: false,
    airGapped: false,
  }),
  "DS-1": as<DataStoreProperties>({
    technology: "flash",
    storedDataTypes: ["config"],
    dataClassification: "internal",
    integrityProtection: "signature",
    encryptionAtRest: "none",
    accessControlMechanism: "process_enforced",
    backupEnabled: true,
    deletionMechanism: "factory_reset",
  }),
  "IF-1": as<InterfaceProperties>({
    type: "touchscreen",
    location: "external_panel",
    ...exposure("EL2", "Operator panel in the cabinet door, reachable on site."),
    operationalState: "enabled",
    implementedControls: { linkAuthentication: "none", abuseProtection: "lockout", serviceAccessPolicy: "always_enabled" },
  }),
  "IF-2": as<InterfaceProperties>({
    type: "usb",
    connectorType: "usb_a",
    location: "in_enclosure",
    operationalState: "enabled",
    ...exposure("EL2", "Behind the locked cabinet door; maintenance staff only."),
    implementedControls: { linkAuthentication: "none", abuseProtection: "lockout", serviceAccessPolicy: "maintenance_only" },
  }),
  "IF-3": as<InterfaceProperties>({
    type: "ethernet",
    connectorType: "rj45",
    location: "network_port",
    operationalState: "enabled",
    ...exposure("EL3", "Connected to the plant control network."),
    implementedControls: { linkAuthentication: "certificate_based", abuseProtection: "rate_limited", serviceAccessPolicy: "always_enabled" },
  }),
  "IF-4": as<InterfaceProperties>({
    type: "rs485",
    connectorType: "terminal",
    location: "field_accessible",
    operationalState: "enabled",
    ...exposure("EL2", "Field cable to the pumps, runs through the station building."),
    implementedControls: { linkAuthentication: "none", abuseProtection: "rate_limited", serviceAccessPolicy: "always_enabled" },
  }),
  "IF-5": as<InterfaceProperties>({
    type: "jtag",
    connectorType: "jtag_20pin",
    location: "on_board",
    operationalState: "hw_disabled",
    ...exposure("EL1", "On the controller board; fused off after production."),
    implementedControls: { linkAuthentication: "none", debugProtection: "fused_off", monitoringControl: "tamper_logged", serviceAccessPolicy: "factory_only" },
  }),
  "EE-1": as<ExternalEntityProperties>({ entityType: "operator", ownership: "internal", trustLevel: "medium", authenticationMethod: "password" }),
  "EE-2": as<ExternalEntityProperties>({ entityType: "maintenance", ownership: "internal", trustLevel: "medium", authenticationMethod: "password" }),
  "EE-3": as<ExternalEntityProperties>({ entityType: "scada_hmi", ownership: "internal", trustLevel: "medium", authenticationMethod: "certificate" }),
  "EE-4": as<ExternalEntityProperties>({ entityType: "update_server", ownership: "external", trustLevel: "medium", authenticationMethod: "certificate" }),
  "EE-5": as<ExternalEntityProperties>({ entityType: "remote_access", ownership: "internal", trustLevel: "low", authenticationMethod: "certificate" }),
  "EE-6": as<ExternalEntityProperties>({ entityType: "engineering_workstation", ownership: "internal", trustLevel: "medium", authenticationMethod: "password" }),
  "EE-7": as<ExternalEntityProperties>({ entityType: "actuator", ownership: "internal", trustLevel: "low" }),
  "EE-8": as<ExternalEntityProperties>({ entityType: "debugger", ownership: "internal", trustLevel: "low" }),
};

const SECURE_OPC: DataFlowProperties = {
  protocol: "opc_ua",
  endpointAuthentication: "certificate",
  encryptionInTransit: "tls",
  integrityProtection: "signature",
  cryptoStandard: "nist_approved",
};

const FLOW_PROPERTIES: Record<string, DataFlowProperties> = {
  "DF-1": { protocol: "human_input", endpointAuthentication: "password", encryptionInTransit: "none", integrityProtection: "none", messageType: "command", dataClassification: "internal" },
  "DF-2": { ...SECURE_OPC, messageType: "command", dataClassification: "internal" },
  "DF-3": { ...SECURE_OPC, messageType: "measurement", dataClassification: "internal" },
  "DF-4": { ...SECURE_OPC, dataClassification: "internal" },
  "DF-5": { ...SECURE_OPC, messageType: "command", dataClassification: "internal" },
  "DF-6": { protocol: "https", endpointAuthentication: "certificate", encryptionInTransit: "tls", integrityProtection: "signature", cryptoStandard: "nist_approved", dataClassification: "confidential" },
  // OPC UA in security mode None today; Sign & Encrypt is planned (DF-7 mitigations in progress).
  "DF-7": { protocol: "opc_ua", endpointAuthentication: "password", encryptionInTransit: "none", integrityProtection: "none", cryptoStandard: "nist_approved", dataClassification: "confidential" },
  "DF-8": { protocol: "https", endpointAuthentication: "mutual_tls", encryptionInTransit: "vpn", integrityProtection: "hmac", cryptoStandard: "nist_approved", dataClassification: "internal" },
  "DF-9": { protocol: "file", endpointAuthentication: "password", encryptionInTransit: "none", integrityProtection: "hash", dataClassification: "internal" },
  "DF-10": { protocol: "modbus_rtu", endpointAuthentication: "none", encryptionInTransit: "none", integrityProtection: "crc", messageType: "command", dataClassification: "internal" },
  "DF-11": { protocol: "modbus_rtu", endpointAuthentication: "none", encryptionInTransit: "none", integrityProtection: "crc", dataClassification: "internal" },
  "DF-12": { protocol: "file", endpointAuthentication: "none", encryptionInTransit: "none", integrityProtection: "signature", dataClassification: "internal" },
  // Production programming only: the JTAG is fused off afterwards (IF-5).
  // The production image holds no device secrets — they are provisioned
  // later into the secure element — so the flow is internal.
  "DF-14": { protocol: "custom", endpointAuthentication: "none", encryptionInTransit: "none", integrityProtection: "none", dataClassification: "internal" },
  "DF-13": { protocol: "file", endpointAuthentication: "none", encryptionInTransit: "none", integrityProtection: "signature", dataClassification: "internal" },
};

// ── The remaining form fields ───────────────────────────────────────────────
// Every field the property forms show, filled as an analyst would — owner and
// notes included. Fields without a form field (accessMode, dataMinimization,
// volume, assumedTrusted, connectionSpeed), the leveled-DFD fields and the
// physical-coupling fields stay unset.

const OT = "Water utility OT team";
const VENDOR = "Vendor (controller)";
const flow = (p: DataFlowProperties) => as<DataFlowProperties>({ medium: "logical", safetyFunction: "none", crossesSafetyBoundary: false, ...p });

const FORM_COMPLETION: Record<string, Record<string, unknown>> = {
  CN: as<TrustBoundaryProperties>({
    securityAssumptions: "Only the pump station's control network is behind the firewall; the plant IT network and everything beyond are untrusted.",
    customBoundaryControls: "Industrial firewall with an OPC UA allowlist",
    assumptionIds: ["asm-it", "asm-remote"],
    complianceRelevance: "IEC 62443-3-3 zone \"Pump station\" (SL-T 2)",
    owner: OT,
    notes: "Conduits to SCADA and to the vendor gateway are the only permitted crossings.",
  }),
  CAB: as<PhysicalBoundaryProperties>({
    customPhysicalControls: "Video surveillance of the pump station building by the operator",
    owner: OT,
    notes: "Key held by the maintenance team; door switch alarm goes to SCADA.",
  }),
  "P-1": as<ProcessProperties>({
    tlsTermination: "server",
    updateMechanism: "signed_ota",
    owner: VENDOR,
    notes: "Updated together with the controller firmware.",
  }),
  "MP-1": as<MultiprocessProperties>({
    certificationLevel: "iec62443_sl2",
    multiTenant: false,
    internalComponents: "RTOS, pump control application, OPC UA server, Modbus RTU master, update agent, secure element",
    securitySummary: "Signed firmware with secure boot, certificate-based OPC UA, role-based access, audit log; fieldbus without authentication (planned).",
    owner: VENDOR,
    notes: "IEC 62443-4-2 SL-C 2 targeted; see the Compliance tab.",
  }),
  "DS-1": as<DataStoreProperties>({
    accessControl: "Read and written by the controller only",
    cryptoStandard: "nist_approved",
    deletionPolicy: "Recipes and configuration are overwritten on factory reset",
    accessModel: "direct_access",
    accessModelSource: "manual",
    accessModelRationale: "Flash read and written directly by the controller application, no service in between.",
    multiTenant: false,
    containsSafetyRelevantData: false,
    owner: VENDOR,
    notes: "Signed records; a backup is taken before every program download.",
  }),
  "IF-1": as<InterfaceProperties>({ safetyRelevant: false, notes: "Capacitive touch panel in the cabinet door." }),
  "IF-2": as<InterfaceProperties>({ safetyRelevant: false, notes: "Disabled in operation mode; enabled by the maintenance role." }),
  "IF-3": as<InterfaceProperties>({ safetyRelevant: false, notes: "100 Mbit/s, managed switch port with port security." }),
  "IF-4": as<InterfaceProperties>({ safetyRelevant: false, notes: "Modbus RTU, 19.2 kbit/s, terminated in the cabinet." }),
  "IF-5": as<InterfaceProperties>({ safetyRelevant: false, notes: "Fused off after production programming." }),
  "EE-1": as<ExternalEntityProperties>({ authorizationScope: "Operate pumps, change setpoints", threatActor: "insider", contractExists: true, rateLimited: false, owner: OT, notes: "Shift staff of the water utility." }),
  "EE-2": as<ExternalEntityProperties>({ authorizationScope: "Service and diagnostics, configuration", threatActor: "insider", contractExists: true, rateLimited: false, owner: OT, notes: "Own and contracted maintenance staff." }),
  "EE-3": as<ExternalEntityProperties>({ authorizationScope: "Read process values, write remote setpoints", threatActor: "compromised", contractExists: true, rateLimited: true, owner: OT, notes: "Control room of the water utility." }),
  "EE-4": as<ExternalEntityProperties>({ authorizationScope: "Deliver signed firmware", threatActor: "compromised", contractExists: true, rateLimited: true, owner: VENDOR, notes: "Operated by the controller vendor." }),
  "EE-5": as<ExternalEntityProperties>({ authorizationScope: "Forward approved vendor service sessions", threatActor: "malicious", contractExists: true, rateLimited: true, owner: OT, notes: "Gateway in the utility's DMZ; sessions approved per ticket." }),
  "EE-6": as<ExternalEntityProperties>({ authorizationScope: "Download the PLC program", threatActor: "compromised", contractExists: true, rateLimited: false, owner: OT, notes: "Engineering laptop of the automation team." }),
  "EE-7": as<ExternalEntityProperties>({ authenticationMethod: "none", authorizationScope: "Execute actuator commands, report sensor values", threatActor: "benign", contractExists: true, rateLimited: false, owner: OT, notes: "Pumps, valves and their sensors on the fieldbus." }),
  "EE-8": as<ExternalEntityProperties>({ authenticationMethod: "none", authorizationScope: "Production programming only", threatActor: "insider", contractExists: true, rateLimited: false, owner: VENDOR, notes: "Used at the vendor's production line." }),
  "DF-1": flow({ frequency: "ondemand", dataTypeNotes: "Pump start / stop, setpoint changes", location: "in_enclosure", locationRationale: "Touch panel in the cabinet door", redundancy: "none", physicalPathProtection: "none", notes: "Masked PIN entry before changes." }),
  "DF-2": flow({ frequency: "ondemand", dataTypeNotes: "Setpoints", location: "in_enclosure", locationRationale: "Cabinet-internal Ethernet", redundancy: "none", physicalPathProtection: "locked_cabinet", notes: "OPC UA Sign & Encrypt." }),
  "DF-3": flow({ frequency: "continuous", dataTypeNotes: "Pressures, flows, levels", location: "in_enclosure", locationRationale: "Cabinet-internal Ethernet", redundancy: "none", physicalPathProtection: "locked_cabinet", notes: "OPC UA subscription." }),
  "DF-4": flow({ frequency: "continuous", dataTypeNotes: "Process values and alarms", location: "local_network", locationRationale: "Plant control network to the control room", redundancy: "buffered", physicalPathProtection: "cable_duct", notes: "Buffered in the controller when SCADA is unreachable." }),
  "DF-5": flow({ frequency: "ondemand", dataTypeNotes: "Remote setpoints", location: "local_network", locationRationale: "Plant control network from the control room", redundancy: "none", physicalPathProtection: "cable_duct", notes: "Range-checked by the controller." }),
  "DF-6": flow({ frequency: "ondemand", dataTypeNotes: "Firmware image", location: "enterprise_network", locationRationale: "From the vendor's update server through the utility's firewall", redundancy: "none", physicalPathProtection: "none", notes: "Signature checked before installation." }),
  "DF-7": flow({ frequency: "ondemand", dataTypeNotes: "PLC program", location: "local_network", locationRationale: "Engineering laptop on the control network", redundancy: "none", physicalPathProtection: "cable_duct", notes: "Sign & Encrypt planned (mitigations in progress)." }),
  "DF-8": flow({ frequency: "ondemand", dataTypeNotes: "Service commands and diagnostics", location: "enterprise_network", locationRationale: "Vendor session through the utility's DMZ gateway", redundancy: "none", physicalPathProtection: "none", notes: "Mutual TLS inside a VPN; approved per ticket." }),
  "DF-9": flow({ frequency: "ondemand", dataTypeNotes: "Service commands", location: "in_enclosure", locationRationale: "USB port inside the locked cabinet", redundancy: "none", physicalPathProtection: "locked_cabinet", notes: "Maintenance role required." }),
  "DF-10": flow({ frequency: "periodic", dataTypeNotes: "Actuator commands", location: "field_cable", locationRationale: "RS-485 cable to the pumps in the station", redundancy: "none", physicalPathProtection: "cable_duct", notes: "No authentication on Modbus RTU (gap, planned mitigation)." }),
  "DF-11": flow({ frequency: "continuous", dataTypeNotes: "Sensor values", location: "field_cable", locationRationale: "RS-485 cable from the pumps in the station", redundancy: "none", physicalPathProtection: "cable_duct", notes: "No authentication on Modbus RTU (gap, planned mitigation)." }),
  "DF-12": flow({ frequency: "ondemand", dataTypeNotes: "Recipes", location: "on_board", locationRationale: "Controller-internal flash", redundancy: "none", physicalPathProtection: "locked_cabinet", notes: "Signed records." }),
  "DF-13": flow({ frequency: "event_based", dataTypeNotes: "Configuration", location: "on_board", locationRationale: "Read at start-up", redundancy: "none", physicalPathProtection: "locked_cabinet", notes: "Signature checked on read." }),
  "DF-14": flow({ frequency: "ondemand", dataTypeNotes: "Production image, debug commands", location: "on_board", locationRationale: "Probe on the board's JTAG header", redundancy: "none", physicalPathProtection: "locked_cabinet", notes: "Only at the production line; fused off afterwards." }),
};

/** The analyst's description of every element and flow (the DFD counts as complete only with them). */
const DESCRIPTIONS: Record<string, string> = {
  CN: "Plant control network of the pump station: firewall and segmentation towards the plant network, default deny.",
  CAB: "Locked control cabinet in the pump station building; door switch reported to SCADA.",
  "P-1": "HMI runtime on the cabinet door panel: shows process values, lets operators change setpoints.",
  "MP-1": "Pump controller (PLC, RTOS) running the pump and valve control; updated over signed OTA.",
  "DS-1": "Flash store for recipes and the controller configuration, signed.",
  "IF-1": "Touch panel in the cabinet door.",
  "IF-2": "Service USB port inside the cabinet, maintenance only.",
  "IF-3": "Ethernet port to the plant control network.",
  "IF-4": "RS-485 fieldbus to the pumps and valves.",
  "IF-5": "JTAG header on the controller board, fused off after production programming.",
  "EE-1": "Operator on site.",
  "EE-2": "Maintenance technician with service access in the cabinet.",
  "EE-3": "Control room SCADA of the water utility.",
  "EE-4": "Vendor update server delivering signed firmware.",
  "EE-5": "Remote access gateway for vendor service sessions.",
  "EE-6": "Engineering workstation that downloads the PLC program.",
  "EE-7": "Pumps and valves with their sensors on the fieldbus.",
  "EE-8": "Debug probe used at production programming only.",
  "DF-1": "Operator commands entered on the touch panel.",
  "DF-2": "Setpoints from the HMI to the controller (OPC UA, signed and encrypted).",
  "DF-3": "Process values from the controller to the HMI.",
  "DF-4": "Process values reported to SCADA.",
  "DF-5": "Remote setpoints written by SCADA.",
  "DF-6": "Signed firmware images from the update server.",
  "DF-7": "PLC program download from the engineering workstation — no encryption yet, Sign & Encrypt planned.",
  "DF-8": "Vendor remote service session through the access gateway (mutual TLS over VPN).",
  "DF-9": "Service commands from the technician over the service USB.",
  "DF-10": "Actuator commands to pumps and valves over Modbus RTU — no authentication.",
  "DF-11": "Sensor values from the field over Modbus RTU — no authentication.",
  "DF-12": "Recipes written to the configuration store.",
  "DF-13": "Configuration read at start-up.",
  "DF-14": "Debug session at production programming; the JTAG is fused off afterwards.",
};

// ── DFD ─────────────────────────────────────────────────────────────────────

export function buildDfd(): ProjectJson {
  const xml = pumpStationXml();
  const parsed = dfdParser.parse(xml);
  const props = { ...PROPERTIES, ...FLOW_PROPERTIES };
  for (const [id, more] of Object.entries(FORM_COMPLETION)) props[id] = { ...props[id], ...more };
  const withProps = <T extends { displayId?: string; properties?: unknown }>(item: T): T => {
    const own = props[item.displayId ?? ""];
    if (!own) throw new Error(`no properties for ${item.displayId}`);
    const description = DESCRIPTIONS[item.displayId ?? ""];
    if (!description) throw new Error(`no description for ${item.displayId}`);
    return { ...item, description, properties: { ...(item.properties as object), ...own } };
  };
  return {
    xml,
    elements: parsed.elements.map(withProps),
    connections: parsed.connections.map(withProps),
    assets: [],
    stats: parsed.stats,
    thumbnail: null,
    validation: { errors: [], warnings: [], isComplete: false, lastValidated: DATE },
    lastModified: DATE,
  };
}

// ── Assets ──────────────────────────────────────────────────────────────────

type Ratings = Partial<Record<string, number>>;

function asset(
  dfd: ProjectJson,
  displayId: string,
  name: string,
  group: "data" | "process" | "function",
  ratings: Ratings,
  links: [string, string][], // [element displayId, relationType]
  properties: AssetProperties,
): Asset {
  const a = createEmptyAsset(displayId, ASSET_CONFIGURATION, group, displayId);
  const all = [...dfd.elements, ...dfd.connections];
  const built: Asset = {
    ...a,
    name,
    properties: { ...a.properties, ...properties },
    impactRatings: a.impactRatings.map(
      (r): ImpactRating => ({ criterionId: r.criterionId, value: (ratings[r.criterionId] ?? null) as ImpactRating["value"] }),
    ),
    linkedDFDElements: links.map(([id, relationType]) => {
      const e = all.find((x: { displayId: string }) => x.displayId === id);
      if (!e) throw new Error(`no DFD element ${id}`);
      const type = dfd.connections.includes(e) ? "DataFlow" : e.type;
      return { elementId: e.id, displayId: id, elementName: e.name, elementType: type, relationType };
    }) as never,
    source: "dfd",
    syncedWithDFD: true,
    created: DATE,
    lastModified: DATE,
  };
  const goals = deriveSecurityGoalSuggestions(built, built.securityGoals, SCALE).map((g) =>
    g.level === "none" ? g : { ...g, formalDescription: GOAL_TEXT[g.type](name) },
  );
  return { ...built, securityGoals: goals };
}

/** The formal description of an active security goal, as the analyst writes it. */
const GOAL_TEXT: Record<SecurityGoalType, (name: string) => string> = {
  C: (n) => `${n} shall be protected against unauthorised disclosure.`,
  I: (n) => `${n} shall be protected against unauthorised modification.`,
  A: (n) => `${n} shall be available when the pump station needs it.`,
  N: (n) => `Changes to ${n} shall be attributable to their originator.`,
  AuthZ: (n) => `Only authorised roles shall read or change ${n}.`,
  AuthN: (n) => `The origin of ${n} shall be authenticated.`,
  Acc: (n) => `Actions on ${n} shall be logged with the acting identity.`,
};

function buildAssets(dfd: ProjectJson): Asset[] {
  return [
    asset(dfd, "DA-001", "Setpoints and commands", "data",
      { financial_damage: 2, operational: 4, regulatory_compliance: 2, recoverability: 2, affected_users: 3 },
      [["DF-1", "transports"], ["DF-2", "transports"], ["DF-5", "transports"], ["DF-10", "transports"]],
      { protectionNeed: "high", dataType: ["config"], lifecycle: "transient", description: "Setpoints and operator commands that drive the pumps." }),
    asset(dfd, "DA-002", "Process values", "data",
      { financial_damage: 1, operational: 3, regulatory_compliance: 1, recoverability: 1, affected_users: 2 },
      [["DF-3", "transports"], ["DF-4", "transports"], ["DF-11", "transports"]],
      { protectionNeed: "medium", dataType: ["telemetry"], lifecycle: "transient", description: "Pressures, flows and levels measured in the field." }),
    asset(dfd, "DA-003", "PLC program and firmware", "data",
      { financial_damage: 3, operational: 4, regulatory_compliance: 2, recoverability: 3, affected_users: 3 },
      [["DF-6", "transports"], ["DF-7", "transports"], ["DF-9", "transports"]],
      { protectionNeed: "critical", dataType: ["firmware"], lifecycle: "stored", description: "Controller firmware and the PLC program." }),
    asset(dfd, "DA-004", "Recipes and configuration", "data",
      { financial_damage: 2, operational: 3, regulatory_compliance: 1, recoverability: 2, affected_users: 2 },
      [["DS-1", "stores"], ["DF-12", "transports"], ["DF-13", "transports"]],
      { protectionNeed: "high", dataType: ["config", "calibration"], lifecycle: "stored", description: "Recipes, calibration and the controller configuration." }),
    asset(dfd, "DA-005", "Remote service session", "data",
      { financial_damage: 2, operational: 3, regulatory_compliance: 2, recoverability: 2, affected_users: 2 },
      [["DF-8", "transports"]],
      { protectionNeed: "high", dataType: ["credentials", "config"], lifecycle: "transient", description: "Credentials and commands of a vendor remote service session." }),
    asset(dfd, "FU-001", "Keep pressure and level", "function",
      { financial_damage: 3, operational: 4, regulatory_compliance: 3, recoverability: 2, affected_users: 4 },
      [["MP-1", "implements"]],
      { protectionNeed: "critical", isSafetyFunction: false, description: "Keeps pressures and levels of the supply within their limits." }),
    asset(dfd, "FU-002", "Report process state", "function",
      { financial_damage: 1, operational: 3, regulatory_compliance: 2, recoverability: 1, affected_users: 2 },
      [["MP-1", "executes"], ["P-1", "implements"]],
      { protectionNeed: "medium", isSafetyFunction: false, description: "Shows process values and alarms to the operator and the control room." }),
    asset(dfd, "FU-003", "Accept service and updates", "function",
      { financial_damage: 2, operational: 3, regulatory_compliance: 2, recoverability: 3, affected_users: 2 },
      [["MP-1", "implements"]],
      { protectionNeed: "high", isSafetyFunction: false, description: "Program download, firmware update, local and remote service." }),
    asset(dfd, "PR-001", "Pump control", "process",
      { financial_damage: 3, operational: 4, regulatory_compliance: 3, recoverability: 2, affected_users: 4 },
      [["MP-1", "is_an"]],
      { protectionNeed: "critical", automationLevel: "fully_automated", description: "The automatic control of pumps and valves." }),
  ];
}

/**
 * Asset-to-asset relations, added through the app's relations service (rules
 * per asset group, deterministic order): what the pump control needs, uses
 * and is configured by, and where the setpoints come from.
 */
function assetRelations(assets: Asset[]): A2ARelation[] {
  const id = (displayId: string) => assets.find((a) => a.displayId === displayId)!.id;
  const groupOf = (assetId: string) => assets.find((a) => a.id === assetId)?.assetGroup;
  const wanted: [string, A2ARelationType, string, string][] = [
    ["DA-001", "required_by", "PR-001", "The pump control runs on the setpoints."],
    ["DA-002", "consumed_by", "PR-001", "Measured values close the control loop."],
    ["DA-003", "required_by", "PR-001", "Firmware and PLC program are the pump control."],
    ["DA-004", "configures", "PR-001", "Recipes and configuration parameterise the control."],
    ["DA-005", "configures", "PR-001", "A service session can change parameters of the control."],
    ["DA-001", "derives_from", "DA-004", "Setpoints are taken from the active recipe."],
    // The functions: what the pump control implements and what each needs.
    ["PR-001", "implements", "FU-001", "The control loop is how the station keeps pressure and level."],
    ["DA-001", "required_by", "FU-001", "Pressure and level are kept to the setpoints."],
    ["DA-004", "configures", "FU-001", "Recipes set the limits of the control."],
    ["DA-002", "required_by", "FU-002", "The state reported is the measured process values."],
    ["DA-003", "required_by", "FU-003", "Updates and downloads deliver firmware and program."],
    ["DA-005", "required_by", "FU-003", "Remote service runs in a service session."],
  ];
  let relations: A2ARelation[] = [];
  for (const [source, relationType, target, rationale] of wanted) {
    const result = addA2ARelation(
      relations,
      { sourceAssetId: id(source), targetAssetId: id(target), relationType, rationale },
      groupOf,
      () => `rel-${source}-${relationType}-${target}`.toLowerCase(),
    );
    if (!result.ok) throw new Error(`${source} ${relationType} ${target}: ${result.reason}`);
    relations = result.relations;
  }
  return relations;
}

// ── Threats and risks ───────────────────────────────────────────────────────

function generateThreats(dfd: ProjectJson, assets: Asset[], tags: ProjectJson): ThreatData {
  const graph = resolveDfdGraph(dfd)!;
  const data = {
    id: "example-pump-station",
    name: "Pump Station Controller",
    threats: null,
    phaseStatus: {},
    dfdGraph: toReferenceGraph(graph),
    assetDataRef: buildAssetDataReference(assets, {}, SCALE, ASSET_CONFIGURATION.impactCriteria),
    info: { tags },
    lastModified: DATE,
  } as unknown as ThreatProjectData;
  const base = createDefaultThreatData();
  // The analyst confirmed every generated threat as relevant.
  const rate = (tables: ThreatTable[]) =>
    tables.map((t) => ({ ...t, threats: t.threats.map((th) => ({ ...th, relevance: "relevant" as const })) }));
  const perElement = elementThreatGenerator.generateThreatsForProject(data, { ...base.configuration, activeMethod: "per-element" });
  const perInteraction = interactionThreatGenerator.generateThreatsForProject(
    data,
    new DFDGraphAnalysisContext(graph),
    { ...base.configuration, activeMethod: "per-interaction" },
  );
  return {
    ...base,
    configuration: { ...base.configuration, activeMethod: "per-interaction" },
    perElementTables: rate(perElement),
    perInteractionTables: rate(perInteraction),
    lastModified: DATE,
  };
}

/**
 * Mitigation status per element: the fieldbus fix is only planned, the
 * engineering download fix is in progress; everything else is verified.
 */
const STATUS_AT: Record<string, MitigationStatus> = {
  "DF-7": "in_progress",
  "DF-10": "open",
  "DF-11": "open",
};

/**
 * Likelihood the analyst rates per element: 3 on the weak spots reachable
 * from outside, 1 inside the cabinet (internal flows, the store, the fused
 * JTAG), 2 elsewhere.
 */
const LIKELIHOOD_AT: Record<string, number> = {
  "DF-7": 3, "DF-9": 3, "DF-10": 3, "DF-11": 3, "IF-2": 3, "IF-4": 3,
  "DF-2": 1, "DF-3": 1, "DF-12": 1, "DF-13": 1, "DS-1": 1, "IF-5": 1,
};

/**
 * The analyst's rating of one risk: likelihood factors per element, impact
 * as derived from the assets by the sync (operational 2 where no asset is
 * linked), residual likelihood two levels lower once mitigations are chosen.
 * Scores through the risk service's own calculation.
 */
function rate(risk: RiskData["risks"][number], at: string, configuration: RiskData["configuration"]): RiskData["risks"][number] {
  const isLikelihood = (id: string) => ALL_PREDEFINED_FACTORS.find((f) => f.id === id)?.category === "likelihood";
  const base = LIKELIHOOD_AT[at] ?? 2;
  const residual = risk.selectedMitigations.length > 0 ? Math.max(1, base - 2) : base;
  const withLikelihood = (ratings: FactorRating[], value: number) =>
    ratings.map((r) => (isLikelihood(r.factorId) ? { ...r, value } : r));
  let factorRatings = withLikelihood(risk.factorRatings, base);
  if (calculateRiskValues(factorRatings, configuration).impact === 0) {
    factorRatings = factorRatings.map((r) => (r.factorId === "operational" ? { ...r, value: 2, source: "manual" as const } : r));
  }
  const mitigatedFactorRatings = withLikelihood(factorRatings, residual);
  const before = calculateRiskValues(factorRatings, configuration);
  const after = calculateRiskValues(mitigatedFactorRatings, configuration);
  return {
    ...risk,
    factorRatings,
    mitigatedFactorRatings,
    calculatedImpact: before.impact,
    calculatedLikelihood: before.likelihood,
    calculatedRiskBeforeMitigation: before.risk,
    calculatedRiskAfterMitigation: after.risk,
  };
}

/** Proposals the analyst does not take: no encryption on the RS-485 fieldbus (process values are not confidential). */
const SKIPPED: Record<string, string[]> = { "DF-10": ["M-I-002"], "DF-11": ["M-I-002"] };

function buildRisks(dfd: ProjectJson, assets: Asset[], threats: ThreatData): RiskData {
  const elements = dfd.elements;
  const refs = [
    ...extractThreatReferences(threats, "per-element", assets, elements),
    ...extractThreatReferences(threats, "per-interaction", assets, elements),
  ];
  const dfdRef = {
    processes: elements
      .filter((e: ProjectJson) => e.type === "Process" || e.type === "Multiprocess")
      .map((e: ProjectJson) => ({ id: e.id, label: e.name ?? e.id })),
    elements: elements.map((e: ProjectJson) => ({ id: e.id, properties: e.properties })),
    connections: dfd.connections.map((c: ProjectJson) => ({ id: c.id, properties: c.properties })),
  };
  const synced = syncRisksFromThreats(
    createDefaultRiskData(),
    refs,
    dfdRef,
    buildAssetDataReference(assets, {}, SCALE, ASSET_CONFIGURATION.impactCriteria),
  ).riskData;

  // The analyst picks up to two proposed catalog mitigations per risk, those
  // naming an IEC 62443 requirement first. "verified" only where the model
  // already shows the control (every SHOULD value of the closed loop met);
  // on the weak spots (STATUS_AT) the mitigations are still planned, and a
  // risk with no control in place gets its first proposal as "open".
  const catalog = getAllMitigations();
  const referencing = new Set(catalog.filter((m) => m.iec62443?.length).map((m) => m.id));
  const known = new Set(catalog.map((m) => m.id));
  const displayOf = new Map([...elements, ...dfd.connections].map((x: ProjectJson) => [x.id, x.displayId]));
  const threatAt = new Map<string, string>();
  for (const t of [...threats.perElementTables, ...threats.perInteractionTables].flatMap((x) => x.threats)) {
    threatAt.set(t.id, displayOf.get(t.linkedElement?.elementId ?? t.dataFlow?.connectionId ?? "") ?? "");
  }
  const candidates = (r: RiskData["risks"][number]) =>
    (r.proposedMitigations ?? [])
      .map((m: { id?: string }) => m.id)
      .filter((id): id is string => !!id && known.has(id))
      .sort((a, b) => Number(referencing.has(b)) - Number(referencing.has(a)));
  const all: RiskData = {
    ...synced,
    risks: synced.risks.map((r) => ({ ...r, selectedMitigations: candidates(r).map((id) => ({ id, status: "open" as const })) })),
  };
  const properties = new Map([...elements, ...dfd.connections].map((x: ProjectJson) => [x.id, x.properties ?? {}]));
  const unmet = new Set<string>(); // riskId::mitigationId
  for (const c of deriveControlInstances(threats, all, dfd, catalog)) {
    if (meetsExpected(c.property, readControlValue(properties.get(c.elementId), c.property), c.expectedValue)) continue;
    for (const riskId of c.coversRiskIds) for (const id of c.coversMitigationIds) unmet.add(`${riskId}::${id}`);
  }
  return {
    ...synced,
    lastModified: DATE,
    risks: synced.risks.map((r) => {
      const at = threatAt.get(r.threatId) ?? "";
      const planned = STATUS_AT[at];
      const ids = candidates(r)
        .filter((id) => !SKIPPED[at]?.includes(id))
        .filter((id) => planned || !unmet.has(`${r.id}::${id}`))
        .slice(0, 2);
      // Nothing in place yet: the first proposal is planned.
      const selectedMitigations = ids.length
        ? ids.map((id) => ({ id, status: planned ?? ("verified" as const) }))
        : candidates(r).slice(0, 1).map((id) => ({ id, status: "open" as const }));
      return rate({ ...r, selectedMitigations }, at, synced.configuration);
    }),
  };
}

// ── Compliance ──────────────────────────────────────────────────────────────

const statement = (status: ComplianceStatement["status"], reasoning: string, evidenceRef?: string): ComplianceStatement => ({
  status,
  reasoning,
  ...(evidenceRef ? { evidenceRef } : {}),
  date: "2026-11-01",
});

/**
 * Statements per row label of the CRA edition, up to the target SL 2. Open on
 * purpose: CR 7.8 (inventory, SL 2) and every row above the target.
 */
export const STATEMENTS: Record<string, ComplianceStatement> = {
  "CR 1.1 RE(1)": statement("met", "Every operator and technician logs in with a personal account; there is no shared login.", "User manual §4.1"),
  "CR 1.7": statement("met", "Minimum length, complexity and lifetime of passwords are configurable; the defaults follow NIST SP 800-63B.", "Security manual §2.3"),
  "CR 1.10": statement("met", "PIN and password entry on the touch panel is masked."),
  "CR 1.11": statement("met", "After five failed logins the account is locked for 15 minutes; the limit is configurable.", "Security manual §2.4"),
  "CR 1.12": statement("met", "The HMI shows a configurable notice before the login screen."),
  "CR 2.4": statement("n/a", "Neither the PLC nor the HMI runtime loads scripts, plug-ins or other mobile code."),
  "CR 2.4 RE(1)": statement("n/a", "No mobile code (see CR 2.4)."),
  "CR 2.8 RE(1)": statement("met", "Only the administrator role can disable audit categories; the change itself is logged."),
  "CR 2.9": statement("met", "4 MB of flash are reserved for the audit log as a ring buffer; a full log never stops pump control.", "Design spec §7.2"),
  "CR 2.10": statement("met", "On an audit write error the controller keeps running and raises a maintenance alarm to SCADA."),
  "CR 2.11": statement("met", "Audit records carry a UTC time stamp from the real-time clock."),
  "CR 2.11 RE(1)": statement("met", "The real-time clock is synchronised with the plant NTP server every hour."),
  "CR 3.8": statement("met", "HMI session IDs are 128-bit random values and are invalidated at logout and on timeout."),
  "CR 3.13": statement("not-met", "Trust anchors are provisioned by the vendor at production; owner provisioning is planned for firmware 2.0."),
  "CR 6.1": statement("met", "The audit log can be read, read-only, over OPC UA by the maintenance role and exported as CSV."),
  "CR 7.3 RE(1)": statement("met", "Configuration backups carry a signature that is checked before a restore.", "Service manual §5.3"),
  "CR 7.6": statement("met", "A secure-defaults profile can be applied from the HMI; the current settings can be viewed there."),
};

/** Statements on rows only the classic edition (2019) has. */
const CLASSIC_ONLY_STATEMENTS: Record<string, ComplianceStatement> = {
  "CR 3.3": statement("met", "The controller tests its security functions at start-up and on demand from the HMI (maintenance role).", "Service manual §6.1"),
};

/**
 * Stored per requirement (D-31): the statements hold in the CRA and in the
 * classic edition alike. Device category EDR confirmed for the classic one.
 */
export const COMPLIANCE: ComplianceData = {
  target: { IAC: 2, UC: 2, SI: 2, DC: 2, RDF: 2, TRE: 2, RA: 2 },
  deviceCategories: { categories: ["EDR"], source: "manual" },
  statements: Object.fromEntries([
    ...Object.entries(STATEMENTS).map(([label, statement]) => {
      const row = EDITION_PRAA_2026.rows.find((r) => r.label === label);
      if (!row) throw new Error(`no CRA row ${label}`);
      return [statementKeyOf(row), statement] as const;
    }),
    // Rows only the classic edition has.
    ...Object.entries(CLASSIC_ONLY_STATEMENTS).map(([label, statement]) => {
      const row = EDITION_2019.rows.find((r) => r.label === label);
      if (!row) throw new Error(`no classic row ${label}`);
      return [statementKeyOf(row), statement] as const;
    }),
  ]),
};

// ── System definition (Overview → Definition) ───────────────────────────────
// Outside ISO/SAE 21434 the item definition is the system definition — for
// the CRA the intended purpose (info.description) and the product description.

const SOURCE = { document: "Pump Station Controller — system specification", version: "1.0" };

function systemDefinition(assets: Asset[]): ItemDefinition {
  const asset = (displayId: string) => assets.find((a) => a.displayId === displayId)!.id;
  return {
    sections: {
      functions: { source: { ...SOURCE, section: "§1 Purpose" } },
      boundary: {
        text: "The controller in its cabinet: HMI runtime, pump controller (PLC), configuration store and the cabinet's interfaces (touch panel, service USB, Ethernet, fieldbus, JTAG). Not part of it: SCADA, the vendor's update server and gateway, the engineering workstation and the pumps and valves in the field.",
        source: { ...SOURCE, section: "§2 Scope" },
        modelRefs: ["tb-cn", "pb-cab"],
      },
      architecture: {
        text: "The PLC runs the pump control on an RTOS with an OPC UA server towards HMI, SCADA and engineering and a Modbus RTU master towards the field; recipes and configuration are kept in signed flash records. See the DFD.",
        source: { ...SOURCE, section: "§3 Architecture" },
        modelRefs: ["mp-plc", "p-hmi", "ds-cfg"],
      },
      environment: {
        text: "Pump station of a water utility: locked building, controller in a locked cabinet, control network of the station behind the utility's firewall; vendor service only through the utility's remote access gateway.",
        source: { ...SOURCE, section: "§4 Operational environment" },
        modelRefs: ["tb-cn"],
      },
      constraints: {
        text: "Cyber Resilience Act (Regulation (EU) 2024/2847) with EN IEC 62443-4-2 (draft prAA) as the harmonised standard, SL-T 2 for the station's zone; drinking-water regulations of the operator.",
        source: { ...SOURCE, section: "§5 Requirements" },
      },
    },
    functions: [
      { id: "fn-control", name: "Pump control", description: "Keeps pressures and levels by driving pumps and valves.", lifecyclePhases: ["operation"], functionAssetId: asset("FU-001") },
      { id: "fn-monitor", name: "Monitoring", description: "Reports process values and alarms to the HMI and SCADA.", lifecyclePhases: ["operation"], functionAssetId: asset("FU-002") },
      { id: "fn-service", name: "Service and update", description: "Program download, firmware update, remote and local service.", lifecyclePhases: ["maintenance"], functionAssetId: asset("FU-003") },
      { id: "fn-provision", name: "Production programming", description: "Initial firmware via JTAG, then fused off; secrets into the secure element.", lifecyclePhases: ["production"] },
      { id: "fn-reset", name: "Factory reset", description: "Overwrites recipes, configuration and credentials before disposal.", lifecyclePhases: ["decommissioning"] },
    ],
    assumptions: [
      { id: "asm-cabinet", displayId: "ASM-01", text: "The cabinet is locked; only the maintenance team holds the key.", owner: OT, status: "confirmed", source: { ...SOURCE, section: "§4" } },
      { id: "asm-it", displayId: "ASM-02", text: "The plant IT network is untrusted; the utility maintains the firewall between it and the control network.", owner: OT, status: "confirmed", source: { ...SOURCE, section: "§4" } },
      { id: "asm-remote", displayId: "ASM-03", text: "Vendor remote access is only possible through the utility's gateway, approved per ticket.", owner: OT, reviewBy: "2027-06-30", status: "open", source: { ...SOURCE, section: "§4" } },
    ],
    assumptionSeq: 3,
  };
}

// ── Project ─────────────────────────────────────────────────────────────────

export const TAGS = {
  custom: [],
  domain: ["Industrial"],
  platform: ["OT"],
  regulation: ["EN IEC 62443 (CRA)", "CRA"],
};

export function buildPumpStationProject(): ProjectJson {
  const dfd = buildDfd();
  const assets = buildAssets(dfd);

  // Asset links live on the diagram (assetRelations), dfd.assets mirrors them.
  const dfdItems = [...dfd.elements, ...dfd.connections];
  for (const a of assets) {
    for (const link of a.linkedDFDElements) {
      const item = dfdItems.find((x: { id: string }) => x.id === link.elementId);
      (item.assetRelations ??= []).push({ assetId: a.id, assetGroup: a.assetGroup, relationType: link.relationType });
    }
  }
  dfd.assets = deriveDfdAssets(assets, dfd.elements, dfd.connections);
  const assetData: AssetData = recalculateAllImpacts({
    configuration: ASSET_CONFIGURATION,
    assets,
    relations: assetRelations(assets),
    lastModified: DATE,
  });

  const threats = generateThreats(dfd, assetData.assets, TAGS);
  const synced = buildRisks(dfd, assetData.assets, threats);
  // The validation the Risk tab stores with its data (Overview, phase status).
  const risks: RiskData = { ...synced, validation: { ...riskService.validate(synced), lastValidated: DATE } };

  // Phase statuses by the app's own rules, as the tabs set them when they
  // save: DFD from its validation, threats when every one is rated, then
  // General, Assets, Risk and Attack Tree as on load.
  const dfdStatus = dfdService.phaseStatusOf(dfdService.validateSavedState({ dfd } as never)!);
  const phaseStatus = {
    ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, "not-started"])),
    [PHASE_STATUS_KEY.dfd]: dfdStatus,
    [PHASE_STATUS_KEY.threats]: threatPhaseStatus(threats),
  };

  const project = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: "example-pump-station-controller",
    info: {
      name: "TARAflow Example – Pump Station Controller",
      description:
        "Industrial pump station controller (PLC with HMI, configuration store, service and fieldbus interfaces) evaluated against the CRA edition of IEC 62443-4-2 (EN IEC 62443-4-2/prAA, draft). Shows the requirement matrix with met, planned, stated, open and gap rows.",
      version: "1.0",
      responsible: "TARAflow",
      team: ["TARAflow"],
      created: DATE,
      lastModified: DATE,
      isHighImpact: false,
      safetyRelevant: false,
      tags: TAGS,
    },
    status: "draft",
    settings: { autoSave: true, autoSaveInterval: 2, regulationPreset: "standard", strictMode: false },
    methodSelected: true,
    strideMethod: "per-interaction",
    phaseStatus,
    itemDefinition: systemDefinition(assetData.assets),
    dfd,
    assets: { ...assetData, lastModified: DATE },
    threats,
    risks,
    compliance: COMPLIANCE,
    attackTrees: null,
    hazards: null,
    documentation: { ...createDefaultDocData(), lastModified: DATE },
    integration: null,
    audit: null,
  };
  return commitLoadedPhaseStatus(project as unknown as Project);
}

