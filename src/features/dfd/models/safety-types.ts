// ==================== SAFETY TYPES ====================
// Safety annotation layer for TARAflow
//
// Konzept: Safety als optionaler Annotation Layer über der Security-Analyse.
// Keine eigene Modellierungslogik - bestehende Beziehungen werden mit
// Safety-Kontext angereichert.
//
// Normreferenzen: EN 50742 / ISO 12100 / IEC 62443
// Kein Ersatz für formale Safety-Analyse (FMEA, FTA, ISO 13849)

// ==================== SAFETY RELEVANCE ====================

/**
 * Grad der Safety-Relevanz eines Elements oder einer Beziehung
 *
 * - none:     Kein Safety-Bezug
 * - indirect: Beeinflusst Safety-Funktionen indirekt
 *             (z.B. Logging-Service eines Safety-Systems)
 * - direct:   Ist selbst Teil einer Safety-Funktion oder kann
 *             direkt eine Safety-Funktion beeinflussen
 *             (z.B. Emergency-Stop-Logik)
 */
export type SafetyRelevance = "none" | "indirect" | "direct";

// ==================== SAFETY IMPACT ====================

/**
 * Maximaler Safety-Impact bei Kompromittierung
 * Orientiert an ISO 12100 / IEC 62443 Harm-Kategorien
 *
 * - none:                Kein Personenschaden möglich
 * - reversible_injury:   Verletzung mit vollständiger Erholung möglich
 * - irreversible_injury: Bleibende Schäden / Behinderung
 * - fatality:            Tödlicher Ausgang möglich
 *
 * Hinweis: Bei fatality wird Risk Priority = CRITICAL gesetzt,
 * unabhängig vom Business Impact (siehe Threat-Scoring)
 */
export type SafetyImpact =
  | "none"
  | "reversible_injury"
  | "irreversible_injury"
  | "fatality";

// ==================== SAFETY ANNOTATION ====================

/**
 * Safety Annotation für DFD-Elemente und Asset-Beziehungen
 *
 * Wird einheitlich verwendet auf:
 * - DFDElement (Process, DataStore, Interface, etc.)
 * - DFDConnection (DataFlow)
 * - AssetRelation (bei safety-relevanten Beziehungen)
 *
 * @example
 * // Process mit direkter Safety-Relevanz
 * {
 *   relevance: "direct",
 *   impact: "fatality",
 *   affectedSafetyFunctions: ["Emergency Stop", "Pressure Relief"],
 *   rationale: "Manipulation disables emergency stop function"
 * }
 *
 * @example
 * // DataFlow mit indirekter Safety-Relevanz
 * {
 *   relevance: "indirect",
 *   impact: "reversible_injury",
 *   rationale: "Carries sensor data used by safety-critical process"
 * }
 */
export interface SafetyAnnotation {
  /**
   * Grad der Safety-Relevanz
   * Pflichtfeld wenn Safety-Annotation vorhanden
   */
  relevance: SafetyRelevance;

  /**
   * Maximaler Safety-Impact bei Kompromittierung
   * Relevant wenn relevance !== "none"
   */
  impact?: SafetyImpact;

  /**
   * Spezifisch für Human Assets:
   * Markiert diese Person/Rolle als Schutzobjekt
   * (z.B. Operator der physisch gefährdet werden kann)
   */
  protectionTarget?: boolean;

  /**
   * Physisches Gefährdungspotenzial des Elements/Assets
   * Spezifisch für System Assets mit direktem Maschinenbezug
   * z.B. CNC-Maschine { physicalHazardPotential: 'high' }
   */
  physicalHazardPotential?: "low" | "medium" | "high";

  /**
   * Element/Asset ist eine physische Schutzbarriere
   * Spezifisch für Infrastructure Assets die Menschen schützen
   * z.B. Schutzumhausung { isPhysicalBarrier: true }
   * → Ausfall = direkter Safety-Impact auf Human Assets
   */
  isPhysicalBarrier?: boolean;

  /**
   * Referenzierte Safety-Funktionen die betroffen sind
   * (z.B. ["Emergency Stop", "Overpressure Protection"])
   * Ermöglicht Rückverfolgung zu Safety-Anforderungen
   */
  affectedSafetyFunctions?: string[];

  /**
   * Begründung der Safety-Relevanz in Normsprache
   * Wird für automatische Dokumentations-Generierung verwendet
   *
   * @example
   * "Manipulation of this data store could disable the emergency
   *  stop function, potentially resulting in fatal injuries."
   */
  rationale?: string;
}

// ==================== SAFETY HELPERS ====================

/**
 * Prüft ob eine Safety-Annotation eine kritische Priorität erfordert
 * (unabhängig vom Business Impact)
 *
 * Bedingung: relevance === "direct" ODER impact === "fatality"
 */
export function isSafetyCritical(safety: SafetyAnnotation | undefined): boolean {
  if (!safety) return false;
  return safety.relevance === "direct" || safety.impact === "fatality";
}

/**
 * Prüft ob eine Safety-Annotation überhaupt Safety-Relevanz hat
 */
export function hasSafetyRelevance(safety: SafetyAnnotation | undefined): boolean {
  if (!safety) return false;
  return safety.relevance !== "none";
}

/**
 * Erstellt eine leere Safety-Annotation (Default: keine Relevanz)
 */
export function createDefaultSafetyAnnotation(): SafetyAnnotation {
  return { relevance: "none" };
}
