// ==================== HTML TEMPLATES ====================
// String templates for HTML document generation
// Location: features/documentation/utils/templates/html-templates.ts

import type { DocLanguage } from "../../models/doc-types";
import { HTML_EXTENDED_TEMPLATES } from "./html-templates-extended";
import { CSS_STYLES } from "./html-templates-styles"; 

export const HTML_TEMPLATES = {
  // ==================== DOCUMENT WRAPPER ====================
  documentWrapper: (lang: DocLanguage) => `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{projectName}} - ${
    lang === "de" ? "Bedrohungs- und Risikoanalyse" : "Threat and Risk Analysis"
  }</title>
  <style>${CSS_STYLES}</style>
</head>
<body>
  <div class="container">
{{content}}
  </div>
</body>
</html>
`,

  // ==================== HEADER ====================
  header: (lang: DocLanguage) =>
    lang === "de"
      ? `<header class="doc-header">
  <h1>{{projectName}}</h1>
  <p class="doc-subtitle">Bedrohungs- und Risikoanalyse</p>
  {{classification}}
  
  <table class="metadata-table">
    <tr><th>Version</th><td>{{version}}</td></tr>
    <tr><th>Verantwortlich</th><td>{{responsible}}</td></tr>
    <tr><th>Erstellt</th><td>{{created}}</td></tr>
    <tr><th>Zuletzt geändert</th><td>{{lastModified}}</td></tr>
    <tr><th>Organisation</th><td>{{organization}}</td></tr>
    <tr><th>Kritikalität</th><td>{{criticality}}</td></tr>
    {{#team}}<tr><th>Team</th><td>{{team}}</td></tr>{{/team}}
  </table>
  
  <h3>Tags</h3>
  {{tagsGrouped}}
</header>

`
      : `<header class="doc-header">
  <h1>{{projectName}}</h1>
  <p class="doc-subtitle">Threat and Risk Analysis</p>
  {{classification}}
  
  <table class="metadata-table">
    <tr><th>Version</th><td>{{version}}</td></tr>
    <tr><th>Responsible</th><td>{{responsible}}</td></tr>
    <tr><th>Created</th><td>{{created}}</td></tr>
    <tr><th>Last Modified</th><td>{{lastModified}}</td></tr>
    <tr><th>Organization</th><td>{{organization}}</td></tr>
    <tr><th>Criticality</th><td>{{criticality}}</td></tr>
    {{#team}}<tr><th>Team</th><td>{{team}}</td></tr>{{/team}}
  </table>
  
  <h3>Tags</h3>
  {{tagsGrouped}}
</header>

`,

  // ==================== TABLE OF CONTENTS ====================
  toc: (lang: DocLanguage) =>
    lang === "de"
      ? `<nav class="toc">
  <h2>Inhaltsverzeichnis</h2>
  <ol>
{{tocContent}}
  </ol>
</nav>

`
      : `<nav class="toc">
  <h2>Table of Contents</h2>
  <ol>
{{tocContent}}
  </ol>
</nav>

`,

  tocItem: `    <li><a href="#{{anchor}}">{{title}}</a></li>
`,

  // ==================== EXECUTIVE SUMMARY ====================
  executiveSummary: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="zusammenfassung">
  <h2>Zusammenfassung</h2>
  <p>Dieses Dokument beschreibt die Bedrohungs- und Risikoanalyse für <strong>{{projectName}}</strong>.</p>
  
  <h3>Übersicht</h3>
  <p>{{description}}</p>
  
  <h3>Analyse-Ergebnisse</h3>
  <table class="stats-table">
    <tr><th>Metrik</th><th>Wert</th></tr>
    <tr><td>Identifizierte Assets</td><td>{{assetCount}}</td></tr>
    <tr><td>Identifizierte Bedrohungen</td><td>{{threatCount}}</td></tr>
    <tr><td>Bewertete Risiken</td><td>{{riskCount}}</td></tr>
    <tr><td>Akzeptierte Risiken</td><td>{{wontRiskCount}}</td></tr>
    <tr><td>Kritische Risiken</td><td>{{criticalRiskCount}}</td></tr>
  </table>
</section>

`
      : `<section id="executive-summary">
  <h2>Executive Summary</h2>
  <p>This document describes the threat and risk analysis for <strong>{{projectName}}</strong>.</p>
  
  <h3>Overview</h3>
  <p>{{description}}</p>
  
  <h3>Analysis Results</h3>
  <table class="stats-table">
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Identified Assets</td><td>{{assetCount}}</td></tr>
    <tr><td>Identified Threats</td><td>{{threatCount}}</td></tr>
    <tr><td>Assessed Risks</td><td>{{riskCount}}</td></tr>
    <tr><td>Accepted Risks</td><td>{{wontRiskCount}}</td></tr>
    <tr><td>Critical Risks</td><td>{{criticalRiskCount}}</td></tr>
  </table>
</section>

`,

  // ==================== APPLICABLE REGULATIONS ====================
  applicableRegulations: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="anwendbare-regulierungen">
  <h2>Anwendbare Regulierungen</h2>
  <p>Die folgenden Regulierungen und Standards sind für dieses Projekt relevant und wurden bei der Bedrohungs- und Risikoanalyse berücksichtigt.</p>
  
{{regulationEntries}}
</section>

`
      : `<section id="applicable-regulations">
  <h2>Applicable Regulations</h2>
  <p>The following regulations and standards are applicable to this project and have been considered in the threat and risk analysis.</p>
  
{{regulationEntries}}
</section>

`,

  regulationEntry: (_lang: DocLanguage) => `<div class="regulation-entry">
  <h3>{{regulationName}}</h3>
  <p>{{regulationDescription}}</p>
</div>

`,

  // ==================== SYSTEM OVERVIEW ====================
  systemOverview: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="systemubersicht">
  <h2>Systemübersicht</h2>
  
  <h3>Projektbeschreibung</h3>
  <p>{{description}}</p>
  
  <h3>Verantwortlichkeiten</h3>
  <ul>
    <li><strong>Projektverantwortlicher:</strong> {{responsible}}</li>
    {{#team}}<li><strong>Teammitglieder:</strong> {{team}}</li>{{/team}}
  </ul>
  
  <h3>Klassifizierung</h3>
  {{tagsGrouped}}
</section>

`
      : `<section id="system-overview">
  <h2>System Overview</h2>
  
  <h3>Project Description</h3>
  <p>{{description}}</p>
  
  <h3>Responsibilities</h3>
  <ul>
    <li><strong>Project Lead:</strong> {{responsible}}</li>
    {{#team}}<li><strong>Team Members:</strong> {{team}}</li>{{/team}}
  </ul>
  
  <h3>Classification</h3>
  {{tagsGrouped}}
</section>

`,

  // ==================== DFD ====================
  dfd: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="datenflussdiagramm">
  <h2>Datenflussdiagramm</h2>
  <p>Das folgende Diagramm zeigt die Datenflüsse und Vertrauensgrenzen des Systems.</p>
  
  <img src="{{imagePath}}" alt="Datenflussdiagramm" class="dfd-image">
  
  <h3>DFD-Statistiken</h3>
  <table class="stats-table">
    <tr><th>Element-Typ</th><th>Anzahl</th></tr>
    <tr><td>Externe Entitäten</td><td>{{externalEntities}}</td></tr>
    <tr><td>Prozesse</td><td>{{processes}}</td></tr>
    <tr><td>Datenspeicher</td><td>{{dataStores}}</td></tr>
    <tr><td>Datenflüsse</td><td>{{dataFlows}}</td></tr>
    <tr><td>Trust Boundaries</td><td>{{trustBoundaries}}</td></tr>
    <tr><td><strong>Gesamt</strong></td><td><strong>{{totalElements}}</strong></td></tr>
  </table>
</section>

`
      : `<section id="data-flow-diagram">
  <h2>Data Flow Diagram</h2>
  <p>The following diagram shows the data flows and trust boundaries of the system.</p>
  
  <img src="{{imagePath}}" alt="Data Flow Diagram" class="dfd-image">
  
  <h3>DFD Statistics</h3>
  <table class="stats-table">
    <tr><th>Element Type</th><th>Count</th></tr>
    <tr><td>External Entities</td><td>{{externalEntities}}</td></tr>
    <tr><td>Processes</td><td>{{processes}}</td></tr>
    <tr><td>Data Stores</td><td>{{dataStores}}</td></tr>
    <tr><td>Data Flows</td><td>{{dataFlows}}</td></tr>
    <tr><td>Trust Boundaries</td><td>{{trustBoundaries}}</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>{{totalElements}}</strong></td></tr>
  </table>
</section>

`,

  // ==================== DFD DESCRIPTIONS ====================
  dfdDescriptions: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="dfd-elementbeschreibungen">
  <h2>DFD-Elementbeschreibungen</h2>
  <p>Dieses Kapitel beschreibt alle Elemente und Datenflüsse des Datenflussdiagramms mit ihren Sicherheitseigenschaften.</p>
  
{{elementSections}}
</section>

`
      : `<section id="dfd-element-descriptions">
  <h2>DFD Element Descriptions</h2>
  <p>This chapter describes all elements and data flows of the data flow diagram with their security properties.</p>
  
{{elementSections}}
</section>

`,

  dfdElementTypeHeader: (_lang: DocLanguage) => `<h3>{{elementTypeName}}</h3>

`,

  dfdElementEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `<div class="element-card">
  <div class="element-card-header">{{displayId}}: {{name}}</div>
  <div class="element-card-body">
    <table>
      <tr><th>Beschreibung</th><td>{{description}}</td></tr>
      <tr><th>Sicherheitsstufe</th><td>{{securityLevel}}</td></tr>
      <tr><th>Vertrauensstufe</th><td>{{trustLevel}}</td></tr>
      <tr><th>Authentifizierung erforderlich</th><td>{{authRequired}}</td></tr>
      <tr><th>Verschlüsselung erforderlich</th><td>{{encryptionRequired}}</td></tr>
      {{#securityNotes}}<tr><th>Sicherheitshinweise</th><td>{{securityNotes}}</td></tr>{{/securityNotes}}
    </table>
  </div>
</div>

`
      : `<div class="element-card">
  <div class="element-card-header">{{displayId}}: {{name}}</div>
  <div class="element-card-body">
    <table>
      <tr><th>Description</th><td>{{description}}</td></tr>
      <tr><th>Security Level</th><td>{{securityLevel}}</td></tr>
      <tr><th>Trust Level</th><td>{{trustLevel}}</td></tr>
      <tr><th>Authentication Required</th><td>{{authRequired}}</td></tr>
      <tr><th>Encryption Required</th><td>{{encryptionRequired}}</td></tr>
      {{#securityNotes}}<tr><th>Security Notes</th><td>{{securityNotes}}</td></tr>{{/securityNotes}}
    </table>
  </div>
</div>

`,

  dfdDataFlowsHeader: (lang: DocLanguage) =>
    lang === "de" ? `<h3>Datenflüsse</h3>\n\n` : `<h3>Data Flows</h3>\n\n`,

  dfdConnectionEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `<div class="element-card">
  <div class="element-card-header">{{displayId}}: {{fromElement}} → {{toElement}}</div>
  <div class="element-card-body">
    <table>
      {{#label}}<tr><th>Label</th><td>{{label}}</td></tr>{{/label}}
      <tr><th>Beschreibung</th><td>{{description}}</td></tr>
      <tr><th>Sicherheitsstufe</th><td>{{securityLevel}}</td></tr>
      <tr><th>Authentifizierung erforderlich</th><td>{{authRequired}}</td></tr>
      <tr><th>Verschlüsselung erforderlich</th><td>{{encryptionRequired}}</td></tr>
      {{#securityNotes}}<tr><th>Sicherheitshinweise</th><td>{{securityNotes}}</td></tr>{{/securityNotes}}
    </table>
  </div>
</div>

`
      : `<div class="element-card">
  <div class="element-card-header">{{displayId}}: {{fromElement}} → {{toElement}}</div>
  <div class="element-card-body">
    <table>
      {{#label}}<tr><th>Label</th><td>{{label}}</td></tr>{{/label}}
      <tr><th>Description</th><td>{{description}}</td></tr>
      <tr><th>Security Level</th><td>{{securityLevel}}</td></tr>
      <tr><th>Authentication Required</th><td>{{authRequired}}</td></tr>
      <tr><th>Encryption Required</th><td>{{encryptionRequired}}</td></tr>
      {{#securityNotes}}<tr><th>Security Notes</th><td>{{securityNotes}}</td></tr>{{/securityNotes}}
    </table>
  </div>
</div>

`,

  // ==================== ASSETS ====================
  assets: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="asset-inventar">
  <h2>Asset-Inventar</h2>
  <p>Die folgende Tabelle listet alle identifizierten Assets mit ihrer Bewertung auf.</p>
  
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Beschreibung</th>
        <th>Impact</th>
        <th>Schutzziele</th>
      </tr>
    </thead>
    <tbody>
{{assetRows}}
    </tbody>
  </table>
</section>

`
      : `<section id="asset-inventory">
  <h2>Asset Inventory</h2>
  <p>The following table lists all identified assets with their assessment.</p>
  
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Description</th>
        <th>Impact</th>
        <th>Security Goals</th>
      </tr>
    </thead>
    <tbody>
{{assetRows}}
    </tbody>
  </table>
</section>

`,

  assetRow: `      <tr>
        <td>{{id}}</td>
        <td>{{name}}</td>
        <td>{{description}}</td>
        <td>{{impactLabel}}</td>
        <td>{{securityGoals}}</td>
      </tr>
`,

  // ==================== THREATS ====================
  threatsHeader: (
    lang: DocLanguage,
    method: "per-element" | "per-interaction",
  ) =>
    lang === "de"
      ? `<section id="bedrohungsanalyse-${method}">
  <h2>Bedrohungsanalyse (STRIDE pro ${
    method === "per-element" ? "Element" : "Interaktion"
  })</h2>
  <p>Die folgende Tabelle zeigt die identifizierten Bedrohungen basierend auf der STRIDE-pro-${
    method === "per-element" ? "Element" : "Interaktion"
  }-Methodik.</p>
  
`
      : `<section id="threat-analysis-${method}">
  <h2>Threat Analysis (STRIDE per ${
    method === "per-element" ? "Element" : "Interaction"
  })</h2>
  <p>The following table shows the identified threats based on the STRIDE-per-${
    method === "per-element" ? "Element" : "Interaction"
  } methodology.</p>
  
`,

  threatsTable: (lang: DocLanguage) =>
    lang === "de"
      ? `  <table>
    <thead>
      <tr>
        <th>T-ID</th>
        <th>Element/Flow</th>
        <th>Bedrohung</th>
        <th>Mitigation</th>
        <th>Verifikation</th>
      </tr>
    </thead>
    <tbody>
{{threatRows}}
    </tbody>
  </table>
</section>

`
      : `  <table>
    <thead>
      <tr>
        <th>T-ID</th>
        <th>Element/Flow</th>
        <th>Threat</th>
        <th>Mitigation</th>
        <th>Verification</th>
      </tr>
    </thead>
    <tbody>
{{threatRows}}
    </tbody>
  </table>
</section>

`,

  threatRow: `      <tr>
        <td><a id="threat-{{id}}" href="#risk-{{id}}">{{id}}</a></td>
        <td>{{elementOrFlow}}</td>
        <td>{{threatDescription}}</td>
        <td>{{mitigation}}</td>
        <td>{{verification}}</td>
      </tr>
`,

  // ==================== RISKS ====================
  risksHeader: (
    lang: DocLanguage,
    method: "per-element" | "per-interaction",
  ) =>
    lang === "de"
      ? `<section id="risikobewertung-${method}">
  <h2>Risikobewertung (STRIDE pro ${
    method === "per-element" ? "Element" : "Interaktion"
  })</h2>
  <p>Die folgende Tabelle zeigt die Risikobewertung für Bedrohungen aus der STRIDE-pro-${
    method === "per-element" ? "Element" : "Interaktion"
  }-Analyse.</p>
  
`
      : `<section id="risk-assessment-${method}">
  <h2>Risk Assessment (STRIDE per ${
    method === "per-element" ? "Element" : "Interaction"
  })</h2>
  <p>The following table shows the risk assessment for threats from the STRIDE-per-${
    method === "per-element" ? "Element" : "Interaction"
  } analysis.</p>
  
`,

  risksTable: (lang: DocLanguage) =>
    lang === "de"
      ? `  <table>
    <thead>
      <tr>
        <th>T-ID</th>
        <th>Bedrohung</th>
        <th>Risiko (vorher)</th>
        <th>Mitigation</th>
        <th>Risiko (nachher)</th>
        <th>MoSCoW</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
{{riskRows}}
    </tbody>
  </table>
</section>

`
      : `  <table>
    <thead>
      <tr>
        <th>T-ID</th>
        <th>Threat</th>
        <th>Risk (Before)</th>
        <th>Mitigation</th>
        <th>Risk (After)</th>
        <th>MoSCoW</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
{{riskRows}}
    </tbody>
  </table>
</section>

`,

  riskRow: `      <tr>
        <td><a id="risk-{{threatId}}" href="#threat-{{threatId}}">{{threatId}}</a></td>
        <td>{{threatDescription}}</td>
        <td>{{riskBeforeLabel}}</td>
        <td>{{mitigations}}</td>
        <td>{{riskAfterLabel}}</td>
        <td>{{moscowLabel}}</td>
        <td>{{statusLabel}}</td>
      </tr>
`,

  // ==================== SRSL ASSESSMENT (EN 50742 A) ====================
  srslHeader: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="srsl-bewertung">
  <h2>SRSL-Bewertung (EN 50742 Approach A)</h2>
  <p>Der Security-Related Safety Level (SRSL) wird aus dem Attack Potential AP = (EL &times; WoO) + AC (Table B.4/B.5) und der Severity des verkn&uuml;pften Safety-Function-Assets (Table B.6) bestimmt. Der SRSL ist <strong>getrennt</strong> vom Rest-Risiko R = L &times; I: EL, WoO und AC speisen ausschliesslich den SRSL, nicht die Likelihood.</p>

`
      : `<section id="srsl-assessment">
  <h2>SRSL Assessment (EN 50742 Approach A)</h2>
  <p>The Security-Related Safety Level (SRSL) is derived from the attack potential AP = (EL &times; WoO) + AC (Table B.4/B.5) and the severity of the linked safety-function asset (Table B.6). SRSL is <strong>separate</strong> from the residual risk R = L &times; I: EL, WoO and AC feed only the SRSL, not the likelihood.</p>

`,

  srslTable: (lang: DocLanguage) =>
    lang === "de"
      ? `  <table>
    <thead>
      <tr><th>T-ID</th><th>Safety-Asset</th><th>Severity</th><th>EL</th><th>WoO</th><th>AC</th><th>AP</th><th>SRSL</th></tr>
    </thead>
    <tbody>
{{srslRows}}
    </tbody>
  </table>
</section>

`
      : `  <table>
    <thead>
      <tr><th>T-ID</th><th>Safety Asset</th><th>Severity</th><th>EL</th><th>WoO</th><th>AC</th><th>AP</th><th>SRSL</th></tr>
    </thead>
    <tbody>
{{srslRows}}
    </tbody>
  </table>
</section>

`,

  srslRow: `      <tr>
        <td><a href="#threat-{{threatId}}">{{threatId}}</a></td>
        <td>{{asset}}</td>
        <td>{{severity}}</td>
        <td>{{el}}</td>
        <td>{{woo}}</td>
        <td>{{ac}}</td>
        <td>{{ap}}</td>
        <td>{{srsl}}</td>
      </tr>
`,

  // ==================== ACCEPTED RISKS ====================
  acceptedRisks: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="akzeptierte-risiken">
  <h2>Akzeptierte Risiken (Wird nicht behandelt)</h2>
  <p>Die folgenden Risiken wurden bewertet und aus dokumentierten Gründen als akzeptabel eingestuft.</p>
  
  <div class="warning-box">Jedes akzeptierte Risiko muss eine Begründung enthalten für Compliance-Dokumentation.</div>
  
  <table>
    <thead>
      <tr>
        <th>T-ID</th>
        <th>Bedrohung</th>
        <th>Risiko</th>
        <th>Begründung</th>
      </tr>
    </thead>
    <tbody>
{{wontRiskRows}}
    </tbody>
  </table>
</section>

`
      : `<section id="accepted-risks">
  <h2>Accepted Risks (Won't Address)</h2>
  <p>The following risks have been assessed and classified as acceptable for documented reasons.</p>
  
  <div class="warning-box">Each accepted risk must include justification for compliance documentation.</div>
  
  <table>
    <thead>
      <tr>
        <th>T-ID</th>
        <th>Threat</th>
        <th>Risk</th>
        <th>Justification</th>
      </tr>
    </thead>
    <tbody>
{{wontRiskRows}}
    </tbody>
  </table>
</section>

`,

  wontRiskRow: `      <tr>
        <td><a id="risk-{{threatId}}" href="#threat-{{threatId}}">{{threatId}}</a></td>
        <td>{{threatDescription}}</td>
        <td>{{riskBeforeLabel}}</td>
        <td>{{justification}}</td>
      </tr>
`,

  // ==================== APPENDIX ====================
  appendix: (lang: DocLanguage) =>
    lang === "de"
      ? `<section id="anhang">
  <h2>Anhang</h2>
  
  <h3>A. STRIDE-Kategorien</h3>
  <table>
    <thead>
      <tr><th>Kategorie</th><th>Name</th><th>Beschreibung</th></tr>
    </thead>
    <tbody>
      <tr><td>S</td><td>Spoofing</td><td>Vorgeben, jemand anderes zu sein</td></tr>
      <tr><td>T</td><td>Tampering</td><td>Unbefugte Datenänderung</td></tr>
      <tr><td>R</td><td>Repudiation</td><td>Abstreiten einer Aktion</td></tr>
      <tr><td>I</td><td>Information Disclosure</td><td>Unbefugte Informationspreisgabe</td></tr>
      <tr><td>D</td><td>Denial of Service</td><td>Dienstverweigerung</td></tr>
      <tr><td>E</td><td>Elevation of Privilege</td><td>Unbefugte Rechteausweitung</td></tr>
    </tbody>
  </table>
  
  <h3>B. MoSCoW-Prioritäten</h3>
  <table>
    <thead>
      <tr><th>Priorität</th><th>Beschreibung</th></tr>
    </thead>
    <tbody>
      <tr><td>Must</td><td>Muss behandelt werden</td></tr>
      <tr><td>Should</td><td>Sollte behandelt werden</td></tr>
      <tr><td>Could</td><td>Könnte behandelt werden</td></tr>
      <tr><td>Won't</td><td>Wird nicht behandelt (akzeptiert)</td></tr>
    </tbody>
  </table>
  
  <h3>C. Dokumentinformationen</h3>
  <ul>
    <li><strong>Generiert am:</strong> {{generatedDate}}</li>
    <li><strong>Generator:</strong> TARAflow 1.0</li>
    <li><strong>Format:</strong> {{format}}</li>
  </ul>
</section>

`
      : `<section id="appendix">
  <h2>Appendix</h2>
  
  <h3>A. STRIDE Categories</h3>
  <table>
    <thead>
      <tr><th>Category</th><th>Name</th><th>Description</th></tr>
    </thead>
    <tbody>
      <tr><td>S</td><td>Spoofing</td><td>Pretending to be someone else</td></tr>
      <tr><td>T</td><td>Tampering</td><td>Unauthorized data modification</td></tr>
      <tr><td>R</td><td>Repudiation</td><td>Denying an action</td></tr>
      <tr><td>I</td><td>Information Disclosure</td><td>Unauthorized information exposure</td></tr>
      <tr><td>D</td><td>Denial of Service</td><td>Making service unavailable</td></tr>
      <tr><td>E</td><td>Elevation of Privilege</td><td>Gaining unauthorized access</td></tr>
    </tbody>
  </table>
  
  <h3>B. MoSCoW Priorities</h3>
  <table>
    <thead>
      <tr><th>Priority</th><th>Description</th></tr>
    </thead>
    <tbody>
      <tr><td>Must</td><td>Must be addressed</td></tr>
      <tr><td>Should</td><td>Should be addressed</td></tr>
      <tr><td>Could</td><td>Could be addressed</td></tr>
      <tr><td>Won't</td><td>Won't be addressed (accepted)</td></tr>
    </tbody>
  </table>
  
  <h3>C. Document Information</h3>
  <ul>
    <li><strong>Generated:</strong> {{generatedDate}}</li>
    <li><strong>Generator:</strong> TARAflow 1.0</li>
    <li><strong>Format:</strong> {{format}}</li>
  </ul>
</section>

`,

  // ==================== FOOTER ====================
  footer: (lang: DocLanguage) =>
    lang === "de"
      ? `<footer class="doc-footer">
  <p><em>Dieses Dokument wurde automatisch von TARAflow 1.0 generiert.</em></p>
  {{#footerText}}<p>{{footerText}}</p>{{/footerText}}
</footer>
`
      : `<footer class="doc-footer">
  <p><em>This document was automatically generated by TARAflow 1.0.</em></p>
  {{#footerText}}<p>{{footerText}}</p>{{/footerText}}
</footer>
`,
  ...HTML_EXTENDED_TEMPLATES,
};

