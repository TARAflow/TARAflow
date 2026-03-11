// ==================== SECURITY GOALS (CIANAAA) ====================


/**
 * Security goal with formal description
 */
export interface SecurityGoal {
  type: SecurityGoalType;
  enabled: boolean;
  formalDescription: string;
  /**
   * "suggested" = graph proposed this goal via relation type (Tabelle 4.2)
   * "manual"    = analyst explicitly set or overrode the suggestion
   * undefined   = legacy / not yet evaluated
   */
  source?: "suggested" | "manual";
  /** Required when analyst deviates from graph suggestion (IEC 62443-4-1) */
  rationale?: string;
}

export type SecurityGoalType =
  | "C"    // Confidentiality
  | "I"    // Integrity
  | "A"    // Availability
  | "N"    // Non-repudiation
  | "AuthZ" // Authorization
  | "AuthN" // Authentication
  | "Acc"; // Accountability

export interface SecurityGoalDefinition {
  type: SecurityGoalType;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
  templateEN: string;
  templateDE: string;
}

export const SECURITY_GOALS: SecurityGoalDefinition[] = [
  {
    type: "C",
    name: "Confidentiality",
    nameDE: "Vertraulichkeit",
    description: "Protection against unauthorized disclosure",
    descriptionDE: "Schutz vor unbefugter Offenlegung",
    templateEN: "Data must only be accessible by authorized personnel",
    templateDE: "Daten dürfen nur von autorisierten Personen eingesehen werden",
  },
  {
    type: "I",
    name: "Integrity",
    nameDE: "Integrität",
    description: "Protection against unauthorized modification",
    descriptionDE: "Schutz vor unbefugter Änderung",
    templateEN: "Data must be protected against unauthorized modification",
    templateDE: "Daten müssen vor unbefugter Änderung geschützt werden",
  },
  {
    type: "A",
    name: "Availability",
    nameDE: "Verfügbarkeit",
    description: "Ensuring timely and reliable access",
    descriptionDE: "Gewährleistung rechtzeitigen und zuverlässigen Zugriffs",
    templateEN: "System must maintain required availability levels",
    templateDE: "System muss erforderliche Verfügbarkeitsstufen einhalten",
  },
  {
    type: "N",
    name: "Non-repudiation",
    nameDE: "Nichtabstreitbarkeit",
    description: "Ensuring actions cannot be denied",
    descriptionDE: "Sicherstellung, dass Aktionen nicht abgestritten werden können",
    templateEN: "All actions must be traceable and undeniable",
    templateDE: "Alle Aktionen müssen nachvollziehbar und nicht abstreitbar sein",
  },
  {
    type: "AuthZ",
    name: "Authorization",
    nameDE: "Autorisierung",
    description: "Controlling access rights and permissions",
    descriptionDE: "Kontrolle von Zugriffsrechten und Berechtigungen",
    templateEN: "Access must be restricted based on defined permissions",
    templateDE: "Zugriff muss basierend auf definierten Berechtigungen eingeschränkt werden",
  },
  {
    type: "AuthN",
    name: "Authentication",
    nameDE: "Authentifizierung",
    description: "Verifying identity of users or systems",
    descriptionDE: "Überprüfung der Identität von Benutzern oder Systemen",
    templateEN: "Identity must be verified before granting access",
    templateDE: "Identität muss vor Gewährung des Zugriffs verifiziert werden",
  },
  {
    type: "Acc",
    name: "Accountability",
    nameDE: "Rechenschaftspflicht",
    description: "Tracking and logging of actions",
    descriptionDE: "Verfolgung und Protokollierung von Aktionen",
    templateEN: "All actions must be logged for audit purposes",
    templateDE: "Alle Aktionen müssen zu Prüfungszwecken protokolliert werden",
  },
];