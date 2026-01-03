// ==================== ASCIIDOC TEMPLATES ====================
// String templates for AsciiDoc document generation
// Location: features/documentation/utils/templates/asciidoc-templates.ts

import type { DocLanguage } from "../../models/doc-types";

export const ADOC_TEMPLATES = {
  // ==================== HEADER ====================
  header: (lang: DocLanguage) =>
    lang === "de"
      ? `= {{projectName}}
:toc: left
:toclevels: 3
:sectnums:
:icons: font

[.lead]
*Bedrohungs- und Risikoanalyse*

{{classification}}

[cols="1,2", options="header"]
|===
| Eigenschaft | Wert

| *Version* | {{version}}
| *Verantwortlich* | {{responsible}}
| *Erstellt* | {{created}}
| *Zuletzt geändert* | {{lastModified}}
| *Organisation* | {{organization}}
| *Kritikalität* | {{criticality}}
{{#team}}| *Team* | {{team}}{{/team}}
|===

=== Tags

{{tagsGrouped}}

'''

`
      : `= {{projectName}}
:toc: left
:toclevels: 3
:sectnums:
:icons: font

[.lead]
*Threat and Risk Analysis*

{{classification}}

[cols="1,2", options="header"]
|===
| Property | Value

| *Version* | {{version}}
| *Responsible* | {{responsible}}
| *Created* | {{created}}
| *Last Modified* | {{lastModified}}
| *Organization* | {{organization}}
| *Criticality* | {{criticality}}
{{#team}}| *Team* | {{team}}{{/team}}
|===

=== Tags

{{tagsGrouped}}

'''

`,

  // ==================== TABLE OF CONTENTS ====================
  // AsciiDoc handles TOC via :toc: attribute
  toc: (_lang: DocLanguage) => "",

  // ==================== EXECUTIVE SUMMARY ====================
  executiveSummary: (lang: DocLanguage) =>
    lang === "de"
      ? `== Zusammenfassung

Dieses Dokument beschreibt die Bedrohungs- und Risikoanalyse für *{{projectName}}*.

=== Übersicht

{{description}}

=== Analyse-Ergebnisse

[cols="2,1", options="header"]
|===
| Metrik | Wert

| *Identifizierte Assets* | {{assetCount}}
| *Identifizierte Bedrohungen* | {{threatCount}}
| *Bewertete Risiken* | {{riskCount}}
| *Akzeptierte Risiken* | {{wontRiskCount}}
| *Kritische Risiken* | {{criticalRiskCount}}
|===

`
      : `== Executive Summary

This document describes the threat and risk analysis for *{{projectName}}*.

=== Overview

{{description}}

=== Analysis Results

[cols="2,1", options="header"]
|===
| Metric | Value

| *Identified Assets* | {{assetCount}}
| *Identified Threats* | {{threatCount}}
| *Assessed Risks* | {{riskCount}}
| *Accepted Risks* | {{wontRiskCount}}
| *Critical Risks* | {{criticalRiskCount}}
|===

`,

  // ==================== APPLICABLE REGULATIONS ====================
  applicableRegulations: (lang: DocLanguage) =>
    lang === "de"
      ? `== Anwendbare Regulierungen

Die folgenden Regulierungen und Standards sind für dieses Projekt relevant und wurden bei der Bedrohungs- und Risikoanalyse berücksichtigt.

{{regulationEntries}}

`
      : `== Applicable Regulations

The following regulations and standards are applicable to this project and have been considered in the threat and risk analysis.

{{regulationEntries}}

`,

  regulationEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `=== {{regulationName}}

{{regulationDescription}}

'''

`
      : `=== {{regulationName}}

{{regulationDescription}}

'''

`,

  // ==================== SYSTEM OVERVIEW ====================
  systemOverview: (lang: DocLanguage) =>
    lang === "de"
      ? `== Systemübersicht

=== Projektbeschreibung

{{description}}

=== Verantwortlichkeiten

* *Projektverantwortlicher*: {{responsible}}
{{#team}}* *Teammitglieder*: {{team}}{{/team}}

=== Klassifizierung

{{tagsGrouped}}

`
      : `== System Overview

=== Project Description

{{description}}

=== Responsibilities

* *Project Lead*: {{responsible}}
{{#team}}* *Team Members*: {{team}}{{/team}}

=== Classification

{{tagsGrouped}}

`,

  // ==================== DFD ====================
  dfd: (lang: DocLanguage) =>
    lang === "de"
      ? `== Datenflussdiagramm

Das folgende Diagramm zeigt die Datenflüsse und Vertrauensgrenzen des Systems.

image::{{imagePath}}[Datenflussdiagramm]

=== DFD-Statistiken

[cols="2,1", options="header"]
|===
| Element-Typ | Anzahl

| Externe Entitäten | {{externalEntities}}
| Prozesse | {{processes}}
| Datenspeicher | {{dataStores}}
| Datenflüsse | {{dataFlows}}
| Trust Boundaries | {{trustBoundaries}}
| *Gesamt* | *{{totalElements}}*
|===

`
      : `== Data Flow Diagram

The following diagram shows the data flows and trust boundaries of the system.

image::{{imagePath}}[Data Flow Diagram]

=== DFD Statistics

[cols="2,1", options="header"]
|===
| Element Type | Count

| External Entities | {{externalEntities}}
| Processes | {{processes}}
| Data Stores | {{dataStores}}
| Data Flows | {{dataFlows}}
| Trust Boundaries | {{trustBoundaries}}
| *Total* | *{{totalElements}}*
|===

`,

  // ==================== DFD DESCRIPTIONS ====================
  dfdDescriptions: (lang: DocLanguage) =>
    lang === "de"
      ? `== DFD-Elementbeschreibungen

Dieses Kapitel beschreibt alle Elemente und Datenflüsse des Datenflussdiagramms mit ihren Sicherheitseigenschaften.

{{elementSections}}

`
      : `== DFD Element Descriptions

This chapter describes all elements and data flows of the data flow diagram with their security properties.

{{elementSections}}

`,

  dfdElementTypeHeader: (lang: DocLanguage) =>
    lang === "de"
      ? `=== {{elementTypeName}}

`
      : `=== {{elementTypeName}}

`,

  dfdElementEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `==== {{displayId}}: {{name}}

[cols="1,3", options="header"]
|===
| Eigenschaft | Wert

| *Beschreibung* | {{description}}
| *Sicherheitsstufe* | {{securityLevel}}
| *Vertrauensstufe* | {{trustLevel}}
| *Authentifizierung erforderlich* | {{authRequired}}
| *Verschlüsselung erforderlich* | {{encryptionRequired}}
{{#securityNotes}}| *Sicherheitshinweise* | {{securityNotes}}{{/securityNotes}}
|===

'''

`
      : `==== {{displayId}}: {{name}}

[cols="1,3", options="header"]
|===
| Property | Value

| *Description* | {{description}}
| *Security Level* | {{securityLevel}}
| *Trust Level* | {{trustLevel}}
| *Authentication Required* | {{authRequired}}
| *Encryption Required* | {{encryptionRequired}}
{{#securityNotes}}| *Security Notes* | {{securityNotes}}{{/securityNotes}}
|===

'''

`,

  dfdDataFlowsHeader: (lang: DocLanguage) =>
    lang === "de"
      ? `=== Datenflüsse

`
      : `=== Data Flows

`,

  dfdConnectionEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `==== {{displayId}}: {{fromElement}} → {{toElement}}

{{#label}}*Label*: {{label}}{{/label}}

[cols="1,3", options="header"]
|===
| Eigenschaft | Wert

| *Beschreibung* | {{description}}
| *Sicherheitsstufe* | {{securityLevel}}
| *Authentifizierung erforderlich* | {{authRequired}}
| *Verschlüsselung erforderlich* | {{encryptionRequired}}
{{#securityNotes}}| *Sicherheitshinweise* | {{securityNotes}}{{/securityNotes}}
|===

'''

`
      : `==== {{displayId}}: {{fromElement}} → {{toElement}}

{{#label}}*Label*: {{label}}{{/label}}

[cols="1,3", options="header"]
|===
| Property | Value

| *Description* | {{description}}
| *Security Level* | {{securityLevel}}
| *Authentication Required* | {{authRequired}}
| *Encryption Required* | {{encryptionRequired}}
{{#securityNotes}}| *Security Notes* | {{securityNotes}}{{/securityNotes}}
|===

'''

`,

  // ==================== ASSETS ====================
  assets: (lang: DocLanguage) =>
    lang === "de"
      ? `== Asset-Inventar

Die folgende Tabelle listet alle identifizierten Assets mit ihrer Bewertung auf.

[cols="1,2,3,1,2", options="header"]
|===
| ID | Name | Beschreibung | Impact | Schutzziele

{{assetRows}}
|===

`
      : `== Asset Inventory

The following table lists all identified assets with their assessment.

[cols="1,2,3,1,2", options="header"]
|===
| ID | Name | Description | Impact | Security Goals

{{assetRows}}
|===

`,

  assetRow: `| {{id}} | {{name}} | {{description}} | {{impactLabel}} | {{securityGoals}}
`,

  // ==================== THREATS ====================
  threatsHeader: (
    lang: DocLanguage,
    method: "per-element" | "per-interaction"
  ) =>
    lang === "de"
      ? method === "per-element"
        ? `== Bedrohungsanalyse (STRIDE pro Element)

Die folgende Tabelle zeigt die identifizierten Bedrohungen basierend auf der STRIDE-pro-Element-Methodik.

`
        : `== Bedrohungsanalyse (STRIDE pro Interaktion)

Die folgende Tabelle zeigt die identifizierten Bedrohungen basierend auf der STRIDE-pro-Interaktion-Methodik.

`
      : method === "per-element"
      ? `== Threat Analysis (STRIDE per Element)

The following table shows the identified threats based on the STRIDE-per-Element methodology.

`
      : `== Threat Analysis (STRIDE per Interaction)

The following table shows the identified threats based on the STRIDE-per-Interaction methodology.

`,

  threatsTable: (lang: DocLanguage) =>
    lang === "de"
      ? `[cols="1,2,3,3,2", options="header"]
|===
| T-ID | Element/Flow | Bedrohung | Mitigation | Verifikation

{{threatRows}}
|===

`
      : `[cols="1,2,3,3,2", options="header"]
|===
| T-ID | Element/Flow | Threat | Mitigation | Verification

{{threatRows}}
|===

`,

  threatRow: `| [[threat-{{id}}]]<<risk-{{id}},{{id}}>> | {{elementOrFlow}} | {{threatDescription}} | {{mitigation}} | {{verification}}
`,

  threatDetail: (lang: DocLanguage) =>
    lang === "de"
      ? `=== {{id}}: {{strideCategory}} - {{strideName}}

*Element/Flow*: {{elementOrFlow}} +
*Trust Boundary*: {{trustBoundary}}

*Bedrohung*: {{threatDescription}}

*Angriffsszenario*: {{attackDescription}}

*Mitigation*: {{mitigation}}

*Verifikation*: {{verification}}

'''

`
      : `=== {{id}}: {{strideCategory}} - {{strideName}}

*Element/Flow*: {{elementOrFlow}} +
*Trust Boundary*: {{trustBoundary}}

*Threat*: {{threatDescription}}

*Attack Scenario*: {{attackDescription}}

*Mitigation*: {{mitigation}}

*Verification*: {{verification}}

'''

`,

  // ==================== RISKS ====================
  risksHeader: (lang: DocLanguage, method: "per-element" | "per-interaction") =>
    lang === "de"
      ? method === "per-element"
        ? `== Risikobewertung (STRIDE pro Element)

Die folgende Tabelle zeigt die Risikobewertung für Bedrohungen aus der STRIDE-pro-Element-Analyse.

`
        : `== Risikobewertung (STRIDE pro Interaktion)

Die folgende Tabelle zeigt die Risikobewertung für Bedrohungen aus der STRIDE-pro-Interaktion-Analyse.

`
      : method === "per-element"
      ? `== Risk Assessment (STRIDE per Element)

The following table shows the risk assessment for threats from the STRIDE-per-Element analysis.

`
      : `== Risk Assessment (STRIDE per Interaction)

The following table shows the risk assessment for threats from the STRIDE-per-Interaction analysis.

`,

  risksTable: (lang: DocLanguage) =>
    lang === "de"
      ? `[cols="1,2,1,2,1,1,1", options="header"]
|===
| T-ID | Bedrohung | Risiko (vorher) | Mitigation | Risiko (nachher) | MoSCoW | Status

{{riskRows}}
|===

`
      : `[cols="1,2,1,2,1,1,1", options="header"]
|===
| T-ID | Threat | Risk (Before) | Mitigation | Risk (After) | MoSCoW | Status

{{riskRows}}
|===

`,

  riskRow: `| [[risk-{{threatId}}]]<<threat-{{threatId}},{{threatId}}>> | {{threatDescription}} | {{riskBeforeLabel}} | {{mitigations}} | {{riskAfterLabel}} | {{moscowLabel}} | {{statusLabel}}
`,

  // ==================== ACCEPTED RISKS ====================
  acceptedRisks: (lang: DocLanguage) =>
    lang === "de"
      ? `== Akzeptierte Risiken (Wird nicht behandelt)

Die folgenden Risiken wurden bewertet und aus dokumentierten Gründen als akzeptabel eingestuft.

WARNING: Jedes akzeptierte Risiko muss eine Begründung enthalten für Compliance-Dokumentation.

[cols="1,2,1,3", options="header"]
|===
| T-ID | Bedrohung | Risiko | Begründung

{{wontRiskRows}}
|===

`
      : `== Accepted Risks (Won't Address)

The following risks have been assessed and classified as acceptable for documented reasons.

WARNING: Each accepted risk must include justification for compliance documentation.

[cols="1,2,1,3", options="header"]
|===
| T-ID | Threat | Risk | Justification

{{wontRiskRows}}
|===

`,

  wontRiskRow: `| [[risk-{{threatId}}]]<<threat-{{threatId}},{{threatId}}>> | {{threatDescription}} | {{riskBeforeLabel}} | {{justification}}
`,

  // ==================== APPENDIX ====================
  appendix: (lang: DocLanguage) =>
    lang === "de"
      ? `== Anhang

=== A. STRIDE-Kategorien

[cols="1,2,4", options="header"]
|===
| Kategorie | Name | Beschreibung

| S | Spoofing | Vorgeben, jemand anderes zu sein
| T | Tampering | Unbefugte Datenänderung
| R | Repudiation | Abstreiten einer Aktion
| I | Information Disclosure | Unbefugte Informationspreisgabe
| D | Denial of Service | Dienstverweigerung
| E | Elevation of Privilege | Unbefugte Rechteausweitung
|===

=== B. MoSCoW-Prioritäten

[cols="1,3", options="header"]
|===
| Priorität | Beschreibung

| Must | Muss behandelt werden
| Should | Sollte behandelt werden
| Could | Könnte behandelt werden
| Won't | Wird nicht behandelt (akzeptiert)
|===

=== C. Dokumentinformationen

* *Generiert am*: {{generatedDate}}
* *Generator*: CoReTM 2.0
* *Format*: {{format}}

`
      : `== Appendix

=== A. STRIDE Categories

[cols="1,2,4", options="header"]
|===
| Category | Name | Description

| S | Spoofing | Pretending to be someone else
| T | Tampering | Unauthorized data modification
| R | Repudiation | Denying an action
| I | Information Disclosure | Unauthorized information exposure
| D | Denial of Service | Making service unavailable
| E | Elevation of Privilege | Gaining unauthorized access
|===

=== B. MoSCoW Priorities

[cols="1,3", options="header"]
|===
| Priority | Description

| Must | Must be addressed
| Should | Should be addressed
| Could | Could be addressed
| Won't | Won't be addressed (accepted)
|===

=== C. Document Information

* *Generated*: {{generatedDate}}
* *Generator*: CoReTM 2.0
* *Format*: {{format}}

`,

  // ==================== FOOTER ====================
  footer: (lang: DocLanguage) =>
    lang === "de"
      ? `'''

_Dieses Dokument wurde automatisch von CoReTM 2.0 generiert._

{{footerText}}
`
      : `'''

_This document was automatically generated by CoReTM 2.0._

{{footerText}}
`,
};
