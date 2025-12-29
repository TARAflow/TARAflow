// ==================== DOCUMENTATION TEMPLATES ====================
// String templates for Markdown and AsciiDoc generation
// Uses simple placeholder replacement: {{placeholder}}

import type {
  DocLanguage,
  DocTemplateConfig,
  DocProjectInfo,
  DocDFDData,
  DocAsset,
  DocThreat,
  DocRisk,
} from "../models/doc-types";
import { formatDocDate, getClassificationText } from "../models/doc-types";

// ==================== PLACEHOLDER HELPERS ====================

/**
 * Replace all placeholders in a template string
 */
export function replacePlaceholders(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    result = result.replace(placeholder, String(value ?? ""));
  }
  return result;
}

// ==================== MARKDOWN TEMPLATES ====================

export const MD_TEMPLATES = {
  // Document header with metadata
  header: (lang: DocLanguage) =>
    lang === "de"
      ? `# {{projectName}}

> **Bedrohungs- und Risikoanalyse**

{{classification}}

| Eigenschaft | Wert |
|-------------|------|
| **Version** | {{version}} |
| **Verantwortlich** | {{responsible}} |
| **Erstellt** | {{created}} |
| **Zuletzt geändert** | {{lastModified}} |
| **Organisation** | {{organization}} |
{{#tags}}| **Tags** | {{tags}} |{{/tags}}
{{#team}}| **Team** | {{team}} |{{/team}}

---

`
      : `# {{projectName}}

> **Threat and Risk Analysis**

{{classification}}

| Property | Value |
|----------|-------|
| **Version** | {{version}} |
| **Responsible** | {{responsible}} |
| **Created** | {{created}} |
| **Last Modified** | {{lastModified}} |
| **Organization** | {{organization}} |
{{#tags}}| **Tags** | {{tags}} |{{/tags}}
{{#team}}| **Team** | {{team}} |{{/team}}

---

`,

  // Table of contents
  toc: (lang: DocLanguage) =>
    lang === "de"
      ? `## Inhaltsverzeichnis

{{tocContent}}

---

`
      : `## Table of Contents

{{tocContent}}

---

`,

  // Executive Summary
  executiveSummary: (lang: DocLanguage) =>
    lang === "de"
      ? `## Zusammenfassung

Dieses Dokument beschreibt die Bedrohungs- und Risikoanalyse für **{{projectName}}**.

### Übersicht

{{description}}

### Analyse-Ergebnisse

| Metrik | Wert |
|--------|------|
| **Identifizierte Assets** | {{assetCount}} |
| **Identifizierte Bedrohungen** | {{threatCount}} |
| **Bewertete Risiken** | {{riskCount}} |
| **Akzeptierte Risiken** | {{wontRiskCount}} |
| **Kritische Risiken** | {{criticalRiskCount}} |

`
      : `## Executive Summary

This document describes the threat and risk analysis for **{{projectName}}**.

### Overview

{{description}}

### Analysis Results

| Metric | Value |
|--------|-------|
| **Identified Assets** | {{assetCount}} |
| **Identified Threats** | {{threatCount}} |
| **Assessed Risks** | {{riskCount}} |
| **Accepted Risks** | {{wontRiskCount}} |
| **Critical Risks** | {{criticalRiskCount}} |

`,

  // System Overview
  systemOverview: (lang: DocLanguage) =>
    lang === "de"
      ? `## Systemübersicht

### Projektbeschreibung

{{description}}

### Verantwortlichkeiten

- **Projektverantwortlicher**: {{responsible}}
{{#team}}- **Teammitglieder**: {{team}}{{/team}}

### Klassifizierung

{{#tags}}**Tags**: {{tags}}{{/tags}}

`
      : `## System Overview

### Project Description

{{description}}

### Responsibilities

- **Project Lead**: {{responsible}}
{{#team}}- **Team Members**: {{team}}{{/team}}

### Classification

{{#tags}}**Tags**: {{tags}}{{/tags}}

`,

  // DFD Chapter
  dfd: (lang: DocLanguage) =>
    lang === "de"
      ? `## Datenflussdiagramm

Das folgende Diagramm zeigt die Datenflüsse und Vertrauensgrenzen des Systems.

![Datenflussdiagramm]({{imagePath}})

### DFD-Statistiken

| Element-Typ | Anzahl |
|-------------|--------|
| Externe Entitäten | {{externalEntities}} |
| Prozesse | {{processes}} |
| Datenspeicher | {{dataStores}} |
| Datenflüsse | {{dataFlows}} |
| Trust Boundaries | {{trustBoundaries}} |
| **Gesamt** | **{{totalElements}}** |

`
      : `## Data Flow Diagram

The following diagram shows the data flows and trust boundaries of the system.

![Data Flow Diagram]({{imagePath}})

### DFD Statistics

| Element Type | Count |
|--------------|-------|
| External Entities | {{externalEntities}} |
| Processes | {{processes}} |
| Data Stores | {{dataStores}} |
| Data Flows | {{dataFlows}} |
| Trust Boundaries | {{trustBoundaries}} |
| **Total** | **{{totalElements}}** |

`,

  // Assets Chapter
  assets: (lang: DocLanguage) =>
    lang === "de"
      ? `## Asset-Inventar

Die folgende Tabelle listet alle identifizierten Assets mit ihrer Bewertung auf.

| ID | Name | Beschreibung | Impact | Schutzziele |
|----|------|--------------|--------|-------------|
{{assetRows}}

`
      : `## Asset Inventory

The following table lists all identified assets with their assessment.

| ID | Name | Description | Impact | Security Goals |
|----|------|-------------|--------|----------------|
{{assetRows}}

`,

  // Asset row
  assetRow: `| {{id}} | {{name}} | {{description}} | {{impactLabel}} | {{securityGoals}} |
`,

  // Threats Chapter Header
  threatsHeader: (
    lang: DocLanguage,
    method: "per-element" | "per-interaction"
  ) =>
    lang === "de"
      ? method === "per-element"
        ? `## Bedrohungsanalyse (STRIDE pro Element)

Die folgende Tabelle zeigt die identifizierten Bedrohungen basierend auf der STRIDE-pro-Element-Methodik.

`
        : `## Bedrohungsanalyse (STRIDE pro Interaktion)

Die folgende Tabelle zeigt die identifizierten Bedrohungen basierend auf der STRIDE-pro-Interaktion-Methodik.

`
      : method === "per-element"
      ? `## Threat Analysis (STRIDE per Element)

The following table shows the identified threats based on the STRIDE-per-Element methodology.

`
      : `## Threat Analysis (STRIDE per Interaction)

The following table shows the identified threats based on the STRIDE-per-Interaction methodology.

`,

  // Threats table - STRIDE column removed, Verification added
  threatsTable: (lang: DocLanguage) =>
    lang === "de"
      ? `| T-ID | Element/Flow | Bedrohung | Mitigation | Verifikation |
|------|--------------|-----------|------------|--------------|
{{threatRows}}

`
      : `| T-ID | Element/Flow | Threat | Mitigation | Verification |
|------|--------------|--------|------------|--------------|
{{threatRows}}

`,

  // Threat row - with anchor AND link to risk table
  threatRow: `| <a id="threat-{{id}}"></a>[{{id}}](#risk-{{id}}) | {{elementOrFlow}} | {{threatDescription}} | {{mitigation}} | {{verification}} |
`,

  // Threat detail (for appendix or expanded view)
  threatDetail: (lang: DocLanguage) =>
    lang === "de"
      ? `### {{id}}: {{strideCategory}} - {{strideName}}

**Element/Flow**: {{elementOrFlow}}  
**Trust Boundary**: {{trustBoundary}}

**Bedrohung**: {{threatDescription}}

**Angriffsszenario**: {{attackDescription}}

**Mitigation**: {{mitigation}}

**Verifikation**: {{verification}}

---

`
      : `### {{id}}: {{strideCategory}} - {{strideName}}

**Element/Flow**: {{elementOrFlow}}  
**Trust Boundary**: {{trustBoundary}}

**Threat**: {{threatDescription}}

**Attack Scenario**: {{attackDescription}}

**Mitigation**: {{mitigation}}

**Verification**: {{verification}}

---

`,

  // Risks Chapter Header
  risksHeader: (lang: DocLanguage, method: "per-element" | "per-interaction") =>
    lang === "de"
      ? method === "per-element"
        ? `## Risikobewertung (STRIDE pro Element)

Die folgende Tabelle zeigt die Risikobewertung für Bedrohungen aus der STRIDE-pro-Element-Analyse.

`
        : `## Risikobewertung (STRIDE pro Interaktion)

Die folgende Tabelle zeigt die Risikobewertung für Bedrohungen aus der STRIDE-pro-Interaktion-Analyse.

`
      : method === "per-element"
      ? `## Risk Assessment (STRIDE per Element)

The following table shows the risk assessment for threats from the STRIDE-per-Element analysis.

`
      : `## Risk Assessment (STRIDE per Interaction)

The following table shows the risk assessment for threats from the STRIDE-per-Interaction analysis.

`,

  // Risks table - T-ID instead of R-ID, STRIDE removed
  risksTable: (lang: DocLanguage) =>
    lang === "de"
      ? `| T-ID | Bedrohung | Risiko (vorher) | Mitigation | Risiko (nachher) | MoSCoW | Status |
|------|-----------|-----------------|------------|------------------|--------|--------|
{{riskRows}}

`
      : `| T-ID | Threat | Risk (Before) | Mitigation | Risk (After) | MoSCoW | Status |
|------|--------|---------------|------------|--------------|--------|--------|
{{riskRows}}

`,

  // Risk row - with anchor AND link to threat table
  riskRow: `| <a id="risk-{{threatId}}"></a>[{{threatId}}](#threat-{{threatId}}) | {{threatDescription}} | {{riskBeforeLabel}} | {{mitigations}} | {{riskAfterLabel}} | {{moscowLabel}} | {{statusLabel}} |
`,

  // Accepted Risks Chapter - T-ID instead of R-ID, STRIDE removed
  acceptedRisks: (lang: DocLanguage) =>
    lang === "de"
      ? `## Akzeptierte Risiken (Wird nicht behandelt)

Die folgenden Risiken wurden bewertet und aus dokumentierten Gründen als akzeptabel eingestuft.

> ⚠️ **Hinweis**: Jedes akzeptierte Risiko muss eine Begründung enthalten für Compliance-Dokumentation.

| T-ID | Bedrohung | Risiko | Begründung |
|------|-----------|--------|------------|
{{wontRiskRows}}

`
      : `## Accepted Risks (Won't Address)

The following risks have been assessed and classified as acceptable for documented reasons.

> ⚠️ **Note**: Each accepted risk must include justification for compliance documentation.

| T-ID | Threat | Risk | Justification |
|------|--------|------|---------------|
{{wontRiskRows}}

`,

  // Won't risk row - with anchor AND link to threat table
  wontRiskRow: `| <a id="risk-{{threatId}}"></a>[{{threatId}}](#threat-{{threatId}}) | {{threatDescription}} | {{riskBeforeLabel}} | {{justification}} |
`,

  // Appendix
  appendix: (lang: DocLanguage) =>
    lang === "de"
      ? `## Anhang

### A. STRIDE-Kategorien

| Kategorie | Name | Beschreibung |
|-----------|------|--------------|
| S | Spoofing | Vorgeben, jemand anderes zu sein |
| T | Tampering | Unbefugte Datenänderung |
| R | Repudiation | Abstreiten einer Aktion |
| I | Information Disclosure | Unbefugte Informationspreisgabe |
| D | Denial of Service | Dienstverweigerung |
| E | Elevation of Privilege | Unbefugte Rechteausweitung |

### B. MoSCoW-Prioritäten

| Priorität | Beschreibung |
|-----------|--------------|
| Must | Muss behandelt werden |
| Should | Sollte behandelt werden |
| Could | Könnte behandelt werden |
| Won't | Wird nicht behandelt (akzeptiert) |

### C. Dokumentinformationen

- **Generiert am**: {{generatedDate}}
- **Generator**: CoReTM 2.0
- **Format**: {{format}}

`
      : `## Appendix

### A. STRIDE Categories

| Category | Name | Description |
|----------|------|-------------|
| S | Spoofing | Pretending to be someone else |
| T | Tampering | Unauthorized data modification |
| R | Repudiation | Denying an action |
| I | Information Disclosure | Unauthorized information exposure |
| D | Denial of Service | Making service unavailable |
| E | Elevation of Privilege | Gaining unauthorized access |

### B. MoSCoW Priorities

| Priority | Description |
|----------|-------------|
| Must | Must be addressed |
| Should | Should be addressed |
| Could | Could be addressed |
| Won't | Won't be addressed (accepted) |

### C. Document Information

- **Generated**: {{generatedDate}}
- **Generator**: CoReTM 2.0
- **Format**: {{format}}

`,

  // Footer
  footer: (lang: DocLanguage) =>
    lang === "de"
      ? `---

_Dieses Dokument wurde automatisch von CoReTM 2.0 generiert._

{{footerText}}
`
      : `---

_This document was automatically generated by CoReTM 2.0._

{{footerText}}
`,
};

// ==================== ASCIIDOC TEMPLATES ====================

export const ADOC_TEMPLATES = {
  // Document header with metadata
  header: (lang: DocLanguage) =>
    lang === "de"
      ? `= {{projectName}}
:doctype: book
:toc: left
:toclevels: 3
:sectnums:
:icons: font
:source-highlighter: highlight.js

[.lead]
_Bedrohungs- und Risikoanalyse_

{{classification}}

[cols="1,2", options="header"]
|===
| Eigenschaft | Wert

| *Version* | {{version}}
| *Verantwortlich* | {{responsible}}
| *Erstellt* | {{created}}
| *Zuletzt geändert* | {{lastModified}}
| *Organisation* | {{organization}}
{{#tags}}| *Tags* | {{tags}}{{/tags}}
{{#team}}| *Team* | {{team}}{{/team}}
|===

'''

`
      : `= {{projectName}}
:doctype: book
:toc: left
:toclevels: 3
:sectnums:
:icons: font
:source-highlighter: highlight.js

[.lead]
_Threat and Risk Analysis_

{{classification}}

[cols="1,2", options="header"]
|===
| Property | Value

| *Version* | {{version}}
| *Responsible* | {{responsible}}
| *Created* | {{created}}
| *Last Modified* | {{lastModified}}
| *Organization* | {{organization}}
{{#tags}}| *Tags* | {{tags}}{{/tags}}
{{#team}}| *Team* | {{team}}{{/team}}
|===

'''

`,

  // Table of contents (handled by :toc: attribute in AsciiDoc)
  toc: (_lang: DocLanguage) => "",

  // Executive Summary
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

  // System Overview
  systemOverview: (lang: DocLanguage) =>
    lang === "de"
      ? `== Systemübersicht

=== Projektbeschreibung

{{description}}

=== Verantwortlichkeiten

* *Projektverantwortlicher*: {{responsible}}
{{#team}}* *Teammitglieder*: {{team}}{{/team}}

=== Klassifizierung

{{#tags}}*Tags*: {{tags}}{{/tags}}

`
      : `== System Overview

=== Project Description

{{description}}

=== Responsibilities

* *Project Lead*: {{responsible}}
{{#team}}* *Team Members*: {{team}}{{/team}}

=== Classification

{{#tags}}*Tags*: {{tags}}{{/tags}}

`,

  // DFD Chapter
  dfd: (lang: DocLanguage) =>
    lang === "de"
      ? `== Datenflussdiagramm

Das folgende Diagramm zeigt die Datenflüsse und Vertrauensgrenzen des Systems.

image::{{imagePath}}[Datenflussdiagramm, align="center"]

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

image::{{imagePath}}[Data Flow Diagram, align="center"]

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

  // Assets Chapter
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

  // Asset row
  assetRow: `| {{id}} | {{name}} | {{description}} | {{impactLabel}} | {{securityGoals}}
`,

  // Threats Chapter Header
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

  // Threats table - STRIDE removed, Verification added
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

  // Threat row - with anchor AND link to risk table
  threatRow: `| [[threat-{{id}}]]<<risk-{{id}},{{id}}>> | {{elementOrFlow}} | {{threatDescription}} | {{mitigation}} | {{verification}}
`,

  // Risks Chapter Header
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

  // Risks table - T-ID instead of R-ID, STRIDE removed
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

  // Risk row - with anchor AND link to threat table
  riskRow: `| [[risk-{{threatId}}]]<<threat-{{threatId}},{{threatId}}>> | {{threatDescription}} | {{riskBeforeLabel}} | {{mitigations}} | {{riskAfterLabel}} | {{moscowLabel}} | {{statusLabel}}
`,

  // Accepted Risks Chapter - T-ID instead of R-ID, STRIDE removed
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

  // Won't risk row - with anchor AND link to threat table
  wontRiskRow: `| [[risk-{{threatId}}]]<<threat-{{threatId}},{{threatId}}>> | {{threatDescription}} | {{riskBeforeLabel}} | {{justification}}
`,

  // Appendix
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

  // Footer
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Escape special characters for Markdown tables
 */
export function escapeMarkdownTable(text: string): string {
  if (!text) return "";
  return text
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}

/**
 * Escape special characters for AsciiDoc tables
 */
export function escapeAsciiDocTable(text: string): string {
  if (!text) return "";
  return text
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " +\n")
    .replace(/\r/g, "");
}

/**
 * Truncate text with ellipsis for table cells
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format security goals as comma-separated string
 */
export function formatSecurityGoals(
  goals: Array<{ type: string; description: string }>
): string {
  if (!goals || goals.length === 0) return "-";
  return goals.map((g) => g.type).join(", ");
}

/**
 * Format mitigations as joined string
 */
export function formatMitigations(mitigations: string[]): string {
  if (!mitigations || mitigations.length === 0) return "-";
  return mitigations.join("; ");
}

/**
 * Format text with fallback to "-" if empty
 */
export function formatTextOrDash(text: string | undefined | null): string {
  if (!text || text.trim() === "") return "-";
  return text;
}