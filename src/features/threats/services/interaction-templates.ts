// ==================== INTERACTION THREAT TEMPLATES ====================
// Template-based threat generation for STRIDE-per-Interaction method
// Uses placeholders for context-aware threat descriptions
// 
// ARCHITECTURE:
// - Templates are language-neutral with EN/DE variants
// - Service stores threats with empty descriptions (sprachneutral)
// - UI calls getLocalizedThreatText() for display
// 
// Placeholders:
//   {{sourceName}}      - Name of the sending component
//   {{targetName}}      - Name of the receiving component  
//   {{sourceType}}      - Type of source (Process, ExternalEntity, etc.)
//   {{targetType}}      - Type of target
//   {{dataFlowName}}    - Name/label of the data flow
//   {{trustBoundaryName}} - Name of the trust boundary

import type { StrideCategory } from "shared";
import type {
  InteractionDirection,
  DataFlowReference,
  Threat,
} from "../models/threat-types";

// ==================== TEMPLATE TYPES ====================

/**
 * Template for generating directional threats in STRIDE-per-Interaction
 */
export interface InteractionThreatTemplate {
  id: string;
  strideCategory: StrideCategory;
  direction: InteractionDirection;
  
  /** Template with placeholders (English) */
  threat: string;
  threatDE: string;
  attack: string;
  attackDE: string;
  
  /** Suggested mitigations for this direction */
  suggestedMitigations: string[];
  suggestedMitigationsDE: string[];
}

/**
 * Placeholders available in interaction templates
 */
export interface InteractionTemplatePlaceholders {
  sourceName: string;
  targetName: string;
  sourceType: string;
  targetType: string;
  dataFlowName: string;
  trustBoundaryName: string;
}

/**
 * Localized threat text result for UI display
 */
export interface LocalizedThreatText {
  threatDescription: string;
  attackDescription: string;
  suggestedMitigations: string[];
}

// ==================== SPOOFING TEMPLATES ====================

const SPOOFING_TEMPLATES: InteractionThreatTemplate[] = [
  {
    id: "S-INT-IN-001",
    strideCategory: "S",
    direction: "incoming",
    threat:
      "Sender spoofing: Attacker impersonates {{sourceName}} to deceive {{targetName}}",
    threatDE:
      "Sender-Spoofing: Angreifer gibt sich als {{sourceName}} aus, um {{targetName}} zu täuschen",
    attack:
      "Attacker forges identity of {{sourceName}} and sends malicious data to {{targetName}}, which processes it as legitimate",
    attackDE:
      "Angreifer fälscht die Identität von {{sourceName}} und sendet bösartige Daten an {{targetName}}, das diese als legitim verarbeitet",
    suggestedMitigations: [
      "Implement mutual TLS authentication",
      "Use client certificates to verify sender identity",
      "Implement message authentication codes (MAC/HMAC)",
      "Use digital signatures on messages",
    ],
    suggestedMitigationsDE: [
      "Gegenseitige TLS-Authentifizierung implementieren",
      "Client-Zertifikate zur Absenderverifizierung verwenden",
      "Message Authentication Codes (MAC/HMAC) implementieren",
      "Digitale Signaturen auf Nachrichten verwenden",
    ],
  },
  {
    id: "S-INT-OUT-001",
    strideCategory: "S",
    direction: "outgoing",
    threat:
      "Receiver spoofing: Attacker impersonates {{targetName}} to intercept data from {{sourceName}}",
    threatDE:
      "Empfänger-Spoofing: Angreifer gibt sich als {{targetName}} aus, um Daten von {{sourceName}} abzufangen",
    attack:
      "Attacker sets up rogue endpoint pretending to be {{targetName}}, causing {{sourceName}} to send sensitive data to attacker",
    attackDE:
      "Angreifer richtet gefälschten Endpunkt ein, der sich als {{targetName}} ausgibt, wodurch {{sourceName}} sensible Daten an den Angreifer sendet",
    suggestedMitigations: [
      "Implement server certificate validation",
      "Use certificate pinning for critical endpoints",
      "Validate endpoint identity before transmitting data",
      "Implement DNS security (DNSSEC)",
    ],
    suggestedMitigationsDE: [
      "Server-Zertifikatsvalidierung implementieren",
      "Certificate Pinning für kritische Endpunkte verwenden",
      "Endpunkt-Identität vor Datenübertragung validieren",
      "DNS-Sicherheit (DNSSEC) implementieren",
    ],
  },
];

// ==================== TAMPERING TEMPLATES ====================

const TAMPERING_TEMPLATES: InteractionThreatTemplate[] = [
  {
    id: "T-INT-IN-001",
    strideCategory: "T",
    direction: "incoming",
    threat:
      "Data tampering on incoming flow: Attacker modifies data before it reaches {{targetName}}",
    threatDE:
      "Datenmanipulation auf eingehendem Fluss: Angreifer modifiziert Daten bevor sie {{targetName}} erreichen",
    attack:
      "Attacker intercepts data flow from {{sourceName}} and modifies commands/data before delivery to {{targetName}}",
    attackDE:
      "Angreifer fängt Datenfluss von {{sourceName}} ab und modifiziert Befehle/Daten vor der Zustellung an {{targetName}}",
    suggestedMitigations: [
      "Implement end-to-end encryption (TLS 1.3)",
      "Use message integrity checks (HMAC)",
      "Implement sequence numbers to detect replay/reorder attacks",
      "Validate all incoming data at {{targetName}}",
    ],
    suggestedMitigationsDE: [
      "Ende-zu-Ende-Verschlüsselung implementieren (TLS 1.3)",
      "Message Integrity Checks (HMAC) verwenden",
      "Sequenznummern zur Erkennung von Replay/Reorder-Angriffen implementieren",
      "Alle eingehenden Daten bei {{targetName}} validieren",
    ],
  },
  {
    id: "T-INT-OUT-001",
    strideCategory: "T",
    direction: "outgoing",
    threat:
      "Response tampering: Attacker modifies response data before it reaches {{sourceName}}",
    threatDE:
      "Antwortmanipulation: Angreifer modifiziert Antwortdaten bevor sie {{sourceName}} erreichen",
    attack:
      "Attacker intercepts response from {{targetName}} and modifies data, causing {{sourceName}} to process falsified information",
    attackDE:
      "Angreifer fängt Antwort von {{targetName}} ab und modifiziert Daten, wodurch {{sourceName}} gefälschte Informationen verarbeitet",
    suggestedMitigations: [
      "Implement response signing by {{targetName}}",
      "Use authenticated encryption for all responses",
      "Implement request-response correlation with nonces",
      "Validate response integrity at {{sourceName}}",
    ],
    suggestedMitigationsDE: [
      "Antwortsignierung durch {{targetName}} implementieren",
      "Authentifizierte Verschlüsselung für alle Antworten verwenden",
      "Request-Response-Korrelation mit Nonces implementieren",
      "Antwortintegrität bei {{sourceName}} validieren",
    ],
  },
];

// ==================== REPUDIATION TEMPLATES ====================

const REPUDIATION_TEMPLATES: InteractionThreatTemplate[] = [
  {
    id: "R-INT-IN-001",
    strideCategory: "R",
    direction: "incoming",
    threat:
      "Sender repudiation: {{sourceName}} denies sending the request/data",
    threatDE:
      "Absender-Abstreitbarkeit: {{sourceName}} bestreitet das Senden der Anfrage/Daten",
    attack:
      "{{sourceName}} claims it never sent the command/data that {{targetName}} received and processed",
    attackDE:
      "{{sourceName}} behauptet, niemals den Befehl/die Daten gesendet zu haben, die {{targetName}} empfangen und verarbeitet hat",
    suggestedMitigations: [
      "Implement digital signatures on all requests",
      "Log all incoming requests with sender identity",
      "Use authenticated channels with non-repudiation",
      "Implement audit trail with tamper-proof logging",
    ],
    suggestedMitigationsDE: [
      "Digitale Signaturen auf alle Anfragen implementieren",
      "Alle eingehenden Anfragen mit Absenderidentität protokollieren",
      "Authentifizierte Kanäle mit Nichtabstreitbarkeit verwenden",
      "Audit-Trail mit manipulationssicherer Protokollierung implementieren",
    ],
  },
  {
    id: "R-INT-OUT-001",
    strideCategory: "R",
    direction: "outgoing",
    threat:
      "Receiver repudiation: {{targetName}} denies receiving or processing the request",
    threatDE:
      "Empfänger-Abstreitbarkeit: {{targetName}} bestreitet den Empfang oder die Verarbeitung der Anfrage",
    attack:
      "{{targetName}} claims it never received the data from {{sourceName}}, or denies having processed it",
    attackDE:
      "{{targetName}} behauptet, die Daten von {{sourceName}} nie empfangen zu haben, oder bestreitet deren Verarbeitung",
    suggestedMitigations: [
      "Implement signed acknowledgments/receipts",
      "Log all processed requests with timestamps",
      "Use message queues with delivery confirmation",
      "Implement cryptographic proof of delivery",
    ],
    suggestedMitigationsDE: [
      "Signierte Bestätigungen/Quittungen implementieren",
      "Alle verarbeiteten Anfragen mit Zeitstempeln protokollieren",
      "Message Queues mit Zustellbestätigung verwenden",
      "Kryptographischen Zustellnachweis implementieren",
    ],
  },
];

// ==================== INFORMATION DISCLOSURE TEMPLATES ====================

const INFO_DISCLOSURE_TEMPLATES: InteractionThreatTemplate[] = [
  {
    id: "I-INT-IN-001",
    strideCategory: "I",
    direction: "incoming",
    threat:
      "Eavesdropping on incoming data: Attacker intercepts sensitive data sent to {{targetName}}",
    threatDE:
      "Abhören eingehender Daten: Angreifer fängt sensible Daten ab, die an {{targetName}} gesendet werden",
    attack:
      "Attacker captures data flow from {{sourceName}} to {{targetName}}, exposing credentials, commands, or sensitive payload",
    attackDE:
      "Angreifer erfasst Datenfluss von {{sourceName}} zu {{targetName}} und legt Zugangsdaten, Befehle oder sensible Nutzdaten offen",
    suggestedMitigations: [
      "Encrypt all data in transit (TLS 1.3)",
      "Avoid transmitting sensitive data when possible",
      "Implement forward secrecy",
      "Use encrypted channels even for internal traffic",
    ],
    suggestedMitigationsDE: [
      "Alle Daten während der Übertragung verschlüsseln (TLS 1.3)",
      "Übertragung sensibler Daten nach Möglichkeit vermeiden",
      "Forward Secrecy implementieren",
      "Verschlüsselte Kanäle auch für internen Verkehr verwenden",
    ],
  },
  {
    id: "I-INT-OUT-001",
    strideCategory: "I",
    direction: "outgoing",
    threat:
      "Eavesdropping on response: Attacker intercepts sensitive response from {{targetName}} to {{sourceName}}",
    threatDE:
      "Abhören der Antwort: Angreifer fängt sensible Antwort von {{targetName}} an {{sourceName}} ab",
    attack:
      "Attacker captures response data from {{targetName}}, exposing query results, user data, or system information",
    attackDE:
      "Angreifer erfasst Antwortdaten von {{targetName}} und legt Abfrageergebnisse, Benutzerdaten oder Systeminformationen offen",
    suggestedMitigations: [
      "Encrypt all responses in transit",
      "Minimize data exposure in responses",
      "Implement data masking for sensitive fields",
      "Use authenticated encryption (AES-GCM)",
    ],
    suggestedMitigationsDE: [
      "Alle Antworten während der Übertragung verschlüsseln",
      "Datenexposition in Antworten minimieren",
      "Datenmaskierung für sensible Felder implementieren",
      "Authentifizierte Verschlüsselung verwenden (AES-GCM)",
    ],
  },
];

// ==================== DENIAL OF SERVICE TEMPLATES ====================

const DOS_TEMPLATES: InteractionThreatTemplate[] = [
  {
    id: "D-INT-IN-001",
    strideCategory: "D",
    direction: "incoming",
    threat:
      "Request flooding: Attacker overwhelms {{targetName}} with excessive requests",
    threatDE:
      "Anfragenflutung: Angreifer überlastet {{targetName}} mit übermäßigen Anfragen",
    attack:
      "Attacker sends high volume of requests pretending to be {{sourceName}}, exhausting {{targetName}}'s resources",
    attackDE:
      "Angreifer sendet hohes Volumen an Anfragen, die vorgeben von {{sourceName}} zu sein, und erschöpft die Ressourcen von {{targetName}}",
    suggestedMitigations: [
      "Implement rate limiting per source",
      "Use request queuing with limits",
      "Implement circuit breakers",
      "Deploy DDoS protection",
    ],
    suggestedMitigationsDE: [
      "Rate Limiting pro Quelle implementieren",
      "Anfragen-Warteschlangen mit Limits verwenden",
      "Circuit Breakers implementieren",
      "DDoS-Schutz bereitstellen",
    ],
  },
  {
    id: "D-INT-OUT-001",
    strideCategory: "D",
    direction: "outgoing",
    threat:
      "Response blocking: Attacker prevents {{sourceName}} from receiving responses from {{targetName}}",
    threatDE:
      "Antwortblockierung: Angreifer verhindert, dass {{sourceName}} Antworten von {{targetName}} empfängt",
    attack:
      "Attacker disrupts the response channel, causing {{sourceName}} to time out or operate on stale data",
    attackDE:
      "Angreifer unterbricht den Antwortkanal, wodurch {{sourceName}} Timeouts hat oder mit veralteten Daten arbeitet",
    suggestedMitigations: [
      "Implement response timeout handling",
      "Use redundant communication channels",
      "Cache last-known-good responses",
      "Implement graceful degradation",
    ],
    suggestedMitigationsDE: [
      "Antwort-Timeout-Behandlung implementieren",
      "Redundante Kommunikationskanäle verwenden",
      "Letzte bekannte gute Antworten cachen",
      "Graceful Degradation implementieren",
    ],
  },
];

// ==================== ELEVATION OF PRIVILEGE TEMPLATES ====================

const EOP_TEMPLATES: InteractionThreatTemplate[] = [
  {
    id: "E-INT-IN-001",
    strideCategory: "E",
    direction: "incoming",
    threat:
      "Command injection: Attacker injects commands via data flow to {{targetName}}",
    threatDE:
      "Command Injection: Angreifer injiziert Befehle über Datenfluss an {{targetName}}",
    attack:
      "Attacker crafts malicious payload in data from {{sourceName}} that, when processed by {{targetName}}, executes with elevated privileges",
    attackDE:
      "Angreifer erstellt bösartige Nutzdaten in Daten von {{sourceName}}, die bei Verarbeitung durch {{targetName}} mit erhöhten Rechten ausgeführt werden",
    suggestedMitigations: [
      "Implement strict input validation and sanitization",
      "Use parameterized queries/commands",
      "Apply principle of least privilege to {{targetName}}",
      "Implement command whitelisting",
    ],
    suggestedMitigationsDE: [
      "Strikte Eingabevalidierung und -bereinigung implementieren",
      "Parametrisierte Abfragen/Befehle verwenden",
      "Prinzip der geringsten Rechte auf {{targetName}} anwenden",
      "Befehls-Whitelisting implementieren",
    ],
  },
  {
    id: "E-INT-OUT-001",
    strideCategory: "E",
    direction: "outgoing",
    threat:
      "Response manipulation for privilege escalation: Attacker modifies auth response from {{targetName}}",
    threatDE:
      "Antwortmanipulation zur Rechteausweitung: Angreifer modifiziert Auth-Antwort von {{targetName}}",
    attack:
      "Attacker intercepts authentication/authorization response from {{targetName}} and modifies it to grant {{sourceName}} elevated privileges",
    attackDE:
      "Angreifer fängt Authentifizierungs-/Autorisierungsantwort von {{targetName}} ab und modifiziert sie, um {{sourceName}} erhöhte Rechte zu gewähren",
    suggestedMitigations: [
      "Sign all authorization responses cryptographically",
      "Implement end-to-end integrity for auth flows",
      "Validate authorization at each trust boundary",
      "Use token-based auth with server-side validation",
    ],
    suggestedMitigationsDE: [
      "Alle Autorisierungsantworten kryptographisch signieren",
      "Ende-zu-Ende-Integrität für Auth-Flows implementieren",
      "Autorisierung an jeder Trust Boundary validieren",
      "Token-basierte Auth mit serverseitiger Validierung verwenden",
    ],
  },
];

// ==================== TEMPLATE REGISTRY ====================

export const INTERACTION_THREAT_TEMPLATES: Record<StrideCategory, InteractionThreatTemplate[]> = {
  S: SPOOFING_TEMPLATES,
  T: TAMPERING_TEMPLATES,
  R: REPUDIATION_TEMPLATES,
  I: INFO_DISCLOSURE_TEMPLATES,
  D: DOS_TEMPLATES,
  E: EOP_TEMPLATES,
};

// ==================== TEMPLATE ACCESS FUNCTIONS ====================

export function getInteractionTemplates(
  strideCategory: StrideCategory,
  direction?: InteractionDirection
): InteractionThreatTemplate[] {
  const templates = INTERACTION_THREAT_TEMPLATES[strideCategory] || [];
  return direction
    ? templates.filter((t) => t.direction === direction)
    : templates;
}

export function getPrimaryInteractionTemplate(
  strideCategory: StrideCategory,
  direction: InteractionDirection
): InteractionThreatTemplate | undefined {
  return getInteractionTemplates(strideCategory, direction)[0];
}

// ==================== PLACEHOLDER ENGINE ====================

export function applyTemplatePlaceholders(
  template: string,
  placeholders: InteractionTemplatePlaceholders
): string {
  return template
    .replace(/\{\{sourceName\}\}/g, placeholders.sourceName)
    .replace(/\{\{targetName\}\}/g, placeholders.targetName)
    .replace(/\{\{sourceType\}\}/g, placeholders.sourceType)
    .replace(/\{\{targetType\}\}/g, placeholders.targetType)
    .replace(/\{\{dataFlowName\}\}/g, placeholders.dataFlowName)
    .replace(/\{\{trustBoundaryName\}\}/g, placeholders.trustBoundaryName);
}

export function createPlaceholdersFromDataFlow(
  dataFlow: {
    sourceName: string;
    sourceType: string;
    targetName: string;
    targetType: string;
    dataFlowName: string;
  },
  trustBoundaryName: string
): InteractionTemplatePlaceholders {
  return {
    sourceName: dataFlow.sourceName || "Source",
    targetName: dataFlow.targetName || "Target",
    sourceType: dataFlow.sourceType || "Component",
    targetType: dataFlow.targetType || "Component",
    dataFlowName: dataFlow.dataFlowName || "Data Flow",
    trustBoundaryName: trustBoundaryName || "Trust Boundary",
  };
}

// ==================== SERVICE HELPER (für threat-service.ts) ====================

/**
 * Apply template for service-level generation (backward compatibility)
 * Note: Service should ideally store empty strings and let UI localize
 */
export function applyTemplateToInteraction(
  template: InteractionThreatTemplate,
  placeholders: InteractionTemplatePlaceholders,
  locale: "en" | "de" = "en"
): {
  threat: string;
  attack: string;
  suggestedMitigations: string[];
} {
  const isDE = locale === "de";
  return {
    threat: applyTemplatePlaceholders(
      isDE ? template.threatDE : template.threat,
      placeholders
    ),
    attack: applyTemplatePlaceholders(
      isDE ? template.attackDE : template.attack,
      placeholders
    ),
    suggestedMitigations: (isDE
      ? template.suggestedMitigationsDE
      : template.suggestedMitigations
    ).map((m) => applyTemplatePlaceholders(m, placeholders)),
  };
}

// ==================== UI LOCALIZATION FUNCTIONS ====================

/**
 * Get localized threat text for UI display
 *
 * Call this from ThreatDialog to get localized text based on:
 * - threat.interactionContext (direction)
 * - threat.dataFlow (source/target names)
 * - current locale from i18n
 *
 * @param threat - Threat with interactionContext and dataFlow
 * @param locale - Current UI language ('en' | 'de')
 * @returns Localized text or null if not applicable
 */
export function getLocalizedThreatText(
  threat: Threat,
  locale: "en" | "de"
): LocalizedThreatText | null {
  // Only for per-interaction threats
  if (!threat.interactionContext || !threat.dataFlow) {
    return null;
  }

  const template = getPrimaryInteractionTemplate(
    threat.strideCategory,
    threat.interactionContext.direction
  );

  if (!template) {
    return null;
  }

  const placeholders = createPlaceholdersFromDataFlow(
    threat.dataFlow,
    threat.trustBoundaryName || ""
  );

  const isDE = locale === "de";
  return {
    threatDescription: applyTemplatePlaceholders(
      isDE ? template.threatDE : template.threat,
      placeholders
    ),
    attackDescription: applyTemplatePlaceholders(
      isDE ? template.attackDE : template.attack,
      placeholders
    ),
    suggestedMitigations: (isDE
      ? template.suggestedMitigationsDE
      : template.suggestedMitigations
    ).map((m) => applyTemplatePlaceholders(m, placeholders)),
  };
}

/**
 * Check if threat should use template-based localization
 * 
 * Returns true if:
 * - Has interactionContext (per-interaction method)
 * - Description is empty OR source is "auto"
 */
export function shouldUseTemplateLocalization(threat: Threat): boolean {
  if (!threat.interactionContext || !threat.dataFlow) {
    return false;
  }
  
  // Use template if empty or auto-generated
  return !threat.threatDescription.trim() || threat.source === "auto";
}

/**
 * Get effective threat description for display
 * Returns localized template or stored description
 */
export function getEffectiveThreatDescription(
  threat: Threat,
  locale: "en" | "de"
): string {
  if (shouldUseTemplateLocalization(threat)) {
    const localized = getLocalizedThreatText(threat, locale);
    if (localized) return localized.threatDescription;
  }
  return threat.threatDescription;
}

/**
 * Get effective attack description for display
 */
export function getEffectiveAttackDescription(
  threat: Threat,
  locale: "en" | "de"
): string {
  if (shouldUseTemplateLocalization(threat)) {
    const localized = getLocalizedThreatText(threat, locale);
    if (localized) return localized.attackDescription;
  }
  return threat.attackDescription;
}

/**
 * Get suggested mitigations for a threat
 */
export function getSuggestedMitigations(
  threat: Threat,
  locale: "en" | "de"
): string[] {
  const localized = getLocalizedThreatText(threat, locale);
  return localized?.suggestedMitigations || [];
}

/**
 * Format direction label for UI
 */
export function formatInteractionDirection(
  direction: InteractionDirection,
  locale: "en" | "de"
): string {
  const labels = {
    en: { incoming: "Incoming", outgoing: "Outgoing" },
    de: { incoming: "Eingehend", outgoing: "Ausgehend" },
  };
  return labels[locale][direction];
}

/**
 * Get color for direction badge
 */
export function getDirectionColor(direction: InteractionDirection): string {
  return direction === "incoming" ? "#2196f3" : "#ff9800";
}