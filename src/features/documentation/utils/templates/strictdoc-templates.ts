// ==================== STRICTDOC TEMPLATES ====================
// String templates for StrictDoc (.sdoc) document generation
// Location: features/documentation/utils/templates/strictdoc-templates.ts
//
// StrictDoc format reference: https://strictdoc.readthedocs.io/
// Key concepts:
//   [DOCUMENT]        - document-level metadata
//   [GRAMMAR]         - custom field definitions (declared once per doc)
//   [SECTION] / [/SECTION] - hierarchical sections (= chapters)
//   [REQUIREMENT]     - structured requirement node with UID, TITLE, STATEMENT, etc.
//   [FREETEXT]        - prose block inside a section
//   [/FREETEXT]
//
// Design decisions:
//   - Threats and risks are modelled as [REQUIREMENT] nodes so StrictDoc can
//     trace them, generate coverage reports, and export to other formats.
//   - Narrative content (overview, descriptions) uses [FREETEXT].
//   - Tables (assets, DFD stats) are rendered as reStructuredText simple-tables
//     inside [FREETEXT] blocks — StrictDoc passes raw RST through to its backends.
//   - The grammar is declared at the top of the document and defines all custom
//     fields used by THREAT and RISK requirement types.

import type { DocLanguage } from "../../models/doc-types";

export const SDOC_TEMPLATES = {
  // ==================== DOCUMENT HEADER ====================
  // [DOCUMENT] block + [GRAMMAR] declaring custom fields.
  header: (lang: DocLanguage) =>
    lang === "de"
      ? `[DOCUMENT]
TITLE: {{projectName}}
VERSION: {{version}}
DATE: {{created}}

[GRAMMAR]
ELEMENTS:
- TAG: TEXT
  FIELDS:
  - TITLE: UID
    TYPE: String
    REQUIRED: False
  - TITLE: STATEMENT
    TYPE: String
    REQUIRED: False
  RELATIONS:
  - TYPE: Parent
- TAG: REQUIREMENT
  FIELDS:
  - TITLE: UID
    TYPE: String
    REQUIRED: True
  - TITLE: STATUS
    TYPE: SingleChoice(Offen, In Bearbeitung, Abgeschlossen, Akzeptiert)
    REQUIRED: False
  - TITLE: PRIORITY
    TYPE: SingleChoice(Must, Should, Could, Wont)
    REQUIRED: False
  - TITLE: STRIDE
    TYPE: SingleChoice(S, T, R, I, D, E)
    REQUIRED: False
  - TITLE: RISIKO_VORHER
    TYPE: SingleChoice(Kritisch, Hoch, Mittel, Niedrig)
    REQUIRED: False
  - TITLE: RISIKO_NACHHER
    TYPE: SingleChoice(Kritisch, Hoch, Mittel, Niedrig)
    REQUIRED: False
  - TITLE: STATEMENT
    TYPE: String
    REQUIRED: True
  - TITLE: MITIGATION
    TYPE: String
    REQUIRED: False
  - TITLE: VERIFIKATION
    TYPE: String
    REQUIRED: False
  - TITLE: BEGRUENDUNG
    TYPE: String
    REQUIRED: False
  RELATIONS:
  - TYPE: Parent

[FREETEXT]
Bedrohungs- und Risikoanalyse

Verantwortlich: {{responsible}}
Zuletzt geändert: {{lastModified}}
Organisation: {{organization}}
Kritikalität: {{criticality}}
{{#team}}Team: {{team}}{{/team}}
{{#classification}}Klassifizierung: {{classification}}{{/classification}}
[/FREETEXT]

`
      : `[DOCUMENT]
TITLE: {{projectName}}
VERSION: {{version}}
DATE: {{created}}

[GRAMMAR]
ELEMENTS:
- TAG: TEXT
  FIELDS:
  - TITLE: UID
    TYPE: String
    REQUIRED: False
  - TITLE: STATEMENT
    TYPE: String
    REQUIRED: False
  RELATIONS:
  - TYPE: Parent
- TAG: REQUIREMENT
  FIELDS:
  - TITLE: UID
    TYPE: String
    REQUIRED: True
  - TITLE: STATUS
    TYPE: SingleChoice(Open, In Progress, Completed, Accepted)
    REQUIRED: False
  - TITLE: PRIORITY
    TYPE: SingleChoice(Must, Should, Could, Wont)
    REQUIRED: False
  - TITLE: STRIDE
    TYPE: SingleChoice(S, T, R, I, D, E)
    REQUIRED: False
  - TITLE: RISK_BEFORE
    TYPE: SingleChoice(Critical, High, Medium, Low)
    REQUIRED: False
  - TITLE: RISK_AFTER
    TYPE: SingleChoice(Critical, High, Medium, Low)
    REQUIRED: False
  - TITLE: STATEMENT
    TYPE: String
    REQUIRED: True
  - TITLE: MITIGATION
    TYPE: String
    REQUIRED: False
  - TITLE: VERIFICATION
    TYPE: String
    REQUIRED: False
  - TITLE: JUSTIFICATION
    TYPE: String
    REQUIRED: False
  RELATIONS:
  - TYPE: Parent

[FREETEXT]
Threat and Risk Analysis

Responsible: {{responsible}}
Last Modified: {{lastModified}}
Organization: {{organization}}
Criticality: {{criticality}}
{{#team}}Team: {{team}}{{/team}}
{{#classification}}Classification: {{classification}}{{/classification}}
[/FREETEXT]

`,

  // ==================== TABLE OF CONTENTS ====================
  // StrictDoc generates TOC automatically — nothing to emit.
  toc: (_lang: DocLanguage) => "",

  // ==================== EXECUTIVE SUMMARY ====================
  executiveSummary: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Zusammenfassung

[FREETEXT]
Dieses Dokument beschreibt die Bedrohungs- und Risikoanalyse für **{{projectName}}**.

{{description}}

Analyse-Ergebnisse:

- Identifizierte Assets: {{assetCount}}
- Identifizierte Bedrohungen: {{threatCount}}
- Bewertete Risiken: {{riskCount}}
- Akzeptierte Risiken (Won't): {{wontRiskCount}}
- Kritische Risiken: {{criticalRiskCount}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: Executive Summary

[FREETEXT]
This document describes the threat and risk analysis for **{{projectName}}**.

{{description}}

Analysis Results:

- Identified Assets: {{assetCount}}
- Identified Threats: {{threatCount}}
- Assessed Risks: {{riskCount}}
- Accepted Risks (Won't): {{wontRiskCount}}
- Critical Risks: {{criticalRiskCount}}
[/FREETEXT]

[/SECTION]

`,

  // ==================== APPLICABLE REGULATIONS ====================
  applicableRegulations: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Anwendbare Regulierungen

[FREETEXT]
Die folgenden Regulierungen und Standards sind für dieses Projekt relevant und wurden bei der Bedrohungs- und Risikoanalyse berücksichtigt.
[/FREETEXT]

{{regulationEntries}}
[/SECTION]

`
      : `[SECTION]
TITLE: Applicable Regulations

[FREETEXT]
The following regulations and standards are applicable to this project and have been considered in the threat and risk analysis.
[/FREETEXT]

{{regulationEntries}}
[/SECTION]

`,

  regulationEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: {{regulationName}}

[FREETEXT]
{{regulationDescription}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: {{regulationName}}

[FREETEXT]
{{regulationDescription}}
[/FREETEXT]

[/SECTION]

`,

  // ==================== SYSTEM OVERVIEW ====================
  systemOverview: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Systemübersicht

[SECTION]
TITLE: Projektbeschreibung

[FREETEXT]
{{description}}
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: Verantwortlichkeiten

[FREETEXT]
Projektverantwortlicher: {{responsible}}
{{#team}}Teammitglieder: {{team}}{{/team}}
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: Klassifizierung

[FREETEXT]
{{tagsGrouped}}
[/FREETEXT]

[/SECTION]

[/SECTION]

`
      : `[SECTION]
TITLE: System Overview

[SECTION]
TITLE: Project Description

[FREETEXT]
{{description}}
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: Responsibilities

[FREETEXT]
Project Lead: {{responsible}}
{{#team}}Team Members: {{team}}{{/team}}
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: Classification

[FREETEXT]
{{tagsGrouped}}
[/FREETEXT]

[/SECTION]

[/SECTION]

`,

  // ==================== DFD ====================
  dfd: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Datenflussdiagramm

[FREETEXT]
Das folgende Diagramm zeigt die Datenflüsse und Vertrauensgrenzen des Systems.

.. image:: {{imagePath}}
   :alt: Datenflussdiagramm

DFD-Statistiken:

.. list-table::
   :header-rows: 1
   :widths: 40 20

   * - Element-Typ
     - Anzahl
   * - Externe Entitäten
     - {{externalEntities}}
   * - Prozesse
     - {{processes}}
   * - Datenspeicher
     - {{dataStores}}
   * - Datenflüsse
     - {{dataFlows}}
   * - Trust Boundaries
     - {{trustBoundaries}}
   * - **Gesamt**
     - **{{totalElements}}**
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: Data Flow Diagram

[FREETEXT]
The following diagram shows the data flows and trust boundaries of the system.

.. image:: {{imagePath}}
   :alt: Data Flow Diagram

DFD Statistics:

.. list-table::
   :header-rows: 1
   :widths: 40 20

   * - Element Type
     - Count
   * - External Entities
     - {{externalEntities}}
   * - Processes
     - {{processes}}
   * - Data Stores
     - {{dataStores}}
   * - Data Flows
     - {{dataFlows}}
   * - Trust Boundaries
     - {{trustBoundaries}}
   * - **Total**
     - **{{totalElements}}**
[/FREETEXT]

[/SECTION]

`,

  // ==================== DFD DESCRIPTIONS ====================
  dfdDescriptions: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: DFD-Elementbeschreibungen

[FREETEXT]
Dieses Kapitel beschreibt alle Elemente und Datenflüsse des Datenflussdiagramms mit ihren Sicherheitseigenschaften.
[/FREETEXT]

{{elementSections}}
[/SECTION]

`
      : `[SECTION]
TITLE: DFD Element Descriptions

[FREETEXT]
This chapter describes all elements and data flows of the data flow diagram with their security properties.
[/FREETEXT]

{{elementSections}}
[/SECTION]

`,

  dfdElementTypeHeader: (lang: DocLanguage) =>
    `[SECTION]
TITLE: {{elementTypeName}}

`,

  dfdElementEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: {{displayId}}: {{name}}

[FREETEXT]
- **Beschreibung**: {{description}}
- **Sicherheitsstufe**: {{securityLevel}}
- **Vertrauensstufe**: {{trustLevel}}
- **Authentifizierung erforderlich**: {{authRequired}}
- **Verschlüsselung erforderlich**: {{encryptionRequired}}
{{#securityNotes}}- **Sicherheitshinweise**: {{securityNotes}}{{/securityNotes}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: {{displayId}}: {{name}}

[FREETEXT]
- **Description**: {{description}}
- **Security Level**: {{securityLevel}}
- **Trust Level**: {{trustLevel}}
- **Authentication Required**: {{authRequired}}
- **Encryption Required**: {{encryptionRequired}}
{{#securityNotes}}- **Security Notes**: {{securityNotes}}{{/securityNotes}}
[/FREETEXT]

[/SECTION]

`,

  dfdDataFlowsHeader: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Datenflüsse

`
      : `[SECTION]
TITLE: Data Flows

`,

  dfdConnectionEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: {{displayId}}: {{fromElement}} -> {{toElement}}

[FREETEXT]
{{#label}}- **Label**: {{label}}{{/label}}
- **Beschreibung**: {{description}}
- **Sicherheitsstufe**: {{securityLevel}}
- **Authentifizierung erforderlich**: {{authRequired}}
- **Verschlüsselung erforderlich**: {{encryptionRequired}}
{{#securityNotes}}- **Sicherheitshinweise**: {{securityNotes}}{{/securityNotes}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: {{displayId}}: {{fromElement}} -> {{toElement}}

[FREETEXT]
{{#label}}- **Label**: {{label}}{{/label}}
- **Description**: {{description}}
- **Security Level**: {{securityLevel}}
- **Authentication Required**: {{authRequired}}
- **Encryption Required**: {{encryptionRequired}}
{{#securityNotes}}- **Security Notes**: {{securityNotes}}{{/securityNotes}}
[/FREETEXT]

[/SECTION]

`,

  // ==================== ASSETS ====================
  assets: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Asset-Inventar

[FREETEXT]
Die folgende Tabelle listet alle identifizierten Assets mit ihrer Bewertung auf.

.. list-table::
   :header-rows: 1
   :widths: 10 20 35 15 20

   * - ID
     - Name
     - Beschreibung
     - Impact
     - Schutzziele
{{assetRows}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: Asset Inventory

[FREETEXT]
The following table lists all identified assets with their assessment.

.. list-table::
   :header-rows: 1
   :widths: 10 20 35 15 20

   * - ID
     - Name
     - Description
     - Impact
     - Security Goals
{{assetRows}}
[/FREETEXT]

[/SECTION]

`,

  // RST list-table row (two-space indent + "   * -" per cell)
  assetRow: `   * - {{id}}
     - {{name}}
     - {{description}}
     - {{impactLabel}}
     - {{securityGoals}}
`,

  // ==================== THREATS ====================
  // Threats become [REQUIREMENT] nodes — traceable in StrictDoc.
  threatsHeader: (
    lang: DocLanguage,
    method: "per-element" | "per-interaction",
  ) =>
    lang === "de"
      ? method === "per-element"
        ? `[SECTION]
TITLE: Bedrohungsanalyse (STRIDE pro Element)

[FREETEXT]
Die folgenden Bedrohungen wurden basierend auf der STRIDE-pro-Element-Methodik identifiziert.
[/FREETEXT]

`
        : `[SECTION]
TITLE: Bedrohungsanalyse (STRIDE pro Interaktion)

[FREETEXT]
Die folgenden Bedrohungen wurden basierend auf der STRIDE-pro-Interaktion-Methodik identifiziert.
[/FREETEXT]

`
      : method === "per-element"
      ? `[SECTION]
TITLE: Threat Analysis (STRIDE per Element)

[FREETEXT]
The following threats were identified based on the STRIDE-per-Element methodology.
[/FREETEXT]

`
      : `[SECTION]
TITLE: Threat Analysis (STRIDE per Interaction)

[FREETEXT]
The following threats were identified based on the STRIDE-per-Interaction methodology.
[/FREETEXT]

`,

  // The "table" template is just a pass-through — rows are [REQUIREMENT] nodes,
  // not table cells. The {{threatRows}} placeholder contains pre-rendered nodes.
  threatsTable: (_lang: DocLanguage) => `{{threatRows}}`,

  // Each threat becomes a full [REQUIREMENT] node.
  threatRow: `[REQUIREMENT]
UID: {{id}}
STRIDE: {{strideCategory}}
TITLE: {{strideCategory}} – {{elementOrFlow}}
STATEMENT: {{threatDescription}}
MITIGATION: {{mitigation}}
VERIFICATION: {{verification}}

`,

  // ==================== RISKS ====================
  risksHeader: (
    lang: DocLanguage,
    method: "per-element" | "per-interaction",
  ) =>
    lang === "de"
      ? method === "per-element"
        ? `[SECTION]
TITLE: Risikobewertung (STRIDE pro Element)

[FREETEXT]
Die folgenden Risiken wurden für Bedrohungen aus der STRIDE-pro-Element-Analyse bewertet.
[/FREETEXT]

`
        : `[SECTION]
TITLE: Risikobewertung (STRIDE pro Interaktion)

[FREETEXT]
Die folgenden Risiken wurden für Bedrohungen aus der STRIDE-pro-Interaktion-Analyse bewertet.
[/FREETEXT]

`
      : method === "per-element"
      ? `[SECTION]
TITLE: Risk Assessment (STRIDE per Element)

[FREETEXT]
The following risks were assessed for threats from the STRIDE-per-Element analysis.
[/FREETEXT]

`
      : `[SECTION]
TITLE: Risk Assessment (STRIDE per Interaction)

[FREETEXT]
The following risks were assessed for threats from the STRIDE-per-Interaction analysis.
[/FREETEXT]

`,

  risksTable: (_lang: DocLanguage) => `{{riskRows}}`,

  // Risk row — RELATIONS back to the parent threat requirement.
  riskRow: `[REQUIREMENT]
UID: RISK-{{threatId}}
STATUS: {{statusLabel}}
PRIORITY: {{moscowLabel}}
RISK_BEFORE: {{riskBeforeLabel}}
RISK_AFTER: {{riskAfterLabel}}
TITLE: Risk for {{threatId}}
STATEMENT: {{threatDescription}}
MITIGATION: {{mitigations}}
RELATIONS:
- TYPE: Parent
  VALUE: {{threatId}}

`,

  // ==================== ACCEPTED RISKS ====================
  acceptedRisks: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Akzeptierte Risiken (Wird nicht behandelt)

[FREETEXT]
Die folgenden Risiken wurden bewertet und aus dokumentierten Gründen als akzeptabel eingestuft.

Hinweis: Jedes akzeptierte Risiko muss eine Begründung enthalten für Compliance-Dokumentation.
[/FREETEXT]

{{wontRiskRows}}
[/SECTION]

`
      : `[SECTION]
TITLE: Accepted Risks (Won't Address)

[FREETEXT]
The following risks have been assessed and classified as acceptable for documented reasons.

Note: Each accepted risk must include justification for compliance documentation.
[/FREETEXT]

{{wontRiskRows}}
[/SECTION]

`,

  wontRiskRow: `[REQUIREMENT]
UID: RISK-{{threatId}}
STATUS: Accepted
PRIORITY: Wont
RISK_BEFORE: {{riskBeforeLabel}}
TITLE: Accepted Risk for {{threatId}}
STATEMENT: {{threatDescription}}
JUSTIFICATION: {{justification}}
RELATIONS:
- TYPE: Parent
  VALUE: {{threatId}}

`,

  // ==================== APPENDIX ====================
  appendix: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Anhang

[SECTION]
TITLE: A. STRIDE-Kategorien

[FREETEXT]
.. list-table::
   :header-rows: 1
   :widths: 10 20 70

   * - Kategorie
     - Name
     - Beschreibung
   * - S
     - Spoofing
     - Vorgeben, jemand anderes zu sein
   * - T
     - Tampering
     - Unbefugte Datenänderung
   * - R
     - Repudiation
     - Abstreiten einer Aktion
   * - I
     - Information Disclosure
     - Unbefugte Informationspreisgabe
   * - D
     - Denial of Service
     - Dienstverweigerung
   * - E
     - Elevation of Privilege
     - Unbefugte Rechteausweitung
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: B. MoSCoW-Prioritäten

[FREETEXT]
.. list-table::
   :header-rows: 1
   :widths: 20 80

   * - Priorität
     - Beschreibung
   * - Must
     - Muss behandelt werden
   * - Should
     - Sollte behandelt werden
   * - Could
     - Könnte behandelt werden
   * - Won't
     - Wird nicht behandelt (akzeptiert)
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: C. Dokumentinformationen

[FREETEXT]
- Generiert am: {{generatedDate}}
- Generator: TARAflow 1.0
- Format: StrictDoc (.sdoc)
[/FREETEXT]

[/SECTION]

[/SECTION]

`
      : `[SECTION]
TITLE: Appendix

[SECTION]
TITLE: A. STRIDE Categories

[FREETEXT]
.. list-table::
   :header-rows: 1
   :widths: 10 20 70

   * - Category
     - Name
     - Description
   * - S
     - Spoofing
     - Pretending to be someone else
   * - T
     - Tampering
     - Unauthorized data modification
   * - R
     - Repudiation
     - Denying an action
   * - I
     - Information Disclosure
     - Unauthorized information exposure
   * - D
     - Denial of Service
     - Making service unavailable
   * - E
     - Elevation of Privilege
     - Gaining unauthorized access
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: B. MoSCoW Priorities

[FREETEXT]
.. list-table::
   :header-rows: 1
   :widths: 20 80

   * - Priority
     - Description
   * - Must
     - Must be addressed
   * - Should
     - Should be addressed
   * - Could
     - Could be addressed
   * - Won't
     - Won't be addressed (accepted)
[/FREETEXT]

[/SECTION]

[SECTION]
TITLE: C. Document Information

[FREETEXT]
- Generated: {{generatedDate}}
- Generator: TARAflow 1.0
- Format: StrictDoc (.sdoc)
[/FREETEXT]

[/SECTION]

[/SECTION]

`,

  // ==================== FOOTER ====================
  // StrictDoc has no document-level footer concept — emit a minimal comment.
  footer: (lang: DocLanguage) =>
    lang === "de"
      ? `
// Dieses Dokument wurde automatisch von TARAflow 1.0 generiert.
{{footerText}}
`
      : `
// This document was automatically generated by TARAflow 1.0.
{{footerText}}
`,
};
