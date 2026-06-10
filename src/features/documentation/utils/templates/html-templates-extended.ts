// ==================== EXTENDED HTML TEMPLATES ====================
// Additional templates for detailed element descriptions and asset relations
// Location: features/documentation/utils/templates/html-templates-extended.ts

import type { DocLanguage } from "../../models/doc-types";

export const HTML_EXTENDED_TEMPLATES = {
  // ==================== DFD ELEMENT DETAILED ENTRY ====================

  dfdElementDetailedEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `<div class="element-detail" id="element-{{displayId}}">
  <h4>{{displayId}}: {{name}}</h4>
  
  {{propertyGroups}}
  
  {{#assetRelations}}<p class="asset-relations"><strong>Verknüpfte Assets:</strong> {{assetRelations}}</p>{{/assetRelations}}
</div>

`
      : `<div class="element-detail" id="element-{{displayId}}">
  <h4>{{displayId}}: {{name}}</h4>
  
  {{propertyGroups}}
  
  {{#assetRelations}}<p class="asset-relations"><strong>Linked Assets:</strong> {{assetRelations}}</p>{{/assetRelations}}
</div>

`,

  // Property Group Section
  propertyGroup: (lang: DocLanguage) =>
    `<div class="property-group">
  <h5 class="property-group-title">{{groupName}}</h5>
  <ul class="property-list">
{{properties}}
  </ul>
</div>

`,

  // Property Entry
  propertyEntry: `    <li><strong>{{label}}:</strong> {{value}}</li>
`,

  // ==================== DFD CONNECTION DETAILED ENTRY ====================

  dfdConnectionDetailedEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `<div class="connection-detail">
  <h4>{{displayId}}: {{fromElement}} → {{toElement}}</h4>
  
  {{#label}}<p class="connection-label"><strong>Label:</strong> {{label}}</p>{{/label}}
  
  {{propertyGroups}}
  
  {{#assetRelations}}<p class="asset-relations"><strong>Verknüpfte Assets:</strong> {{assetRelations}}</p>{{/assetRelations}}
</div>

`
      : `<div class="connection-detail">
  <h4>{{displayId}}: {{fromElement}} → {{toElement}}</h4>
  
  {{#label}}<p class="connection-label"><strong>Label:</strong> {{label}}</p>{{/label}}
  
  {{propertyGroups}}
  
  {{#assetRelations}}<p class="asset-relations"><strong>Linked Assets:</strong> {{assetRelations}}</p>{{/assetRelations}}
</div>

`,

  // ==================== ELEMENT OVERVIEW TABLE ====================

  dfdElementOverviewTable: (lang: DocLanguage) =>
    lang === "de"
      ? `<h3>Elementübersicht</h3>

<p>Die folgende Tabelle gibt einen schnellen Überblick über alle DFD-Elemente.</p>

<table class="data-table">
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Typ</th>
      <th>Beschreibung</th>
      <th>Assets</th>
    </tr>
  </thead>
  <tbody>
{{elementRows}}
  </tbody>
</table>

`
      : `<h3>Element Overview</h3>

<p>The following table provides a quick overview of all DFD elements.</p>

<table class="data-table">
  <thead>
    <tr>
      <th>ID</th>
      <th>Name</th>
      <th>Type</th>
      <th>Description</th>
      <th>Assets</th>
    </tr>
  </thead>
  <tbody>
{{elementRows}}
  </tbody>
</table>

`,

  elementOverviewRow: `    <tr>
      <td><a href="#element-{{displayId}}">{{displayId}}</a></td>
      <td>{{name}}</td>
      <td>{{type}}</td>
      <td>{{description}}</td>
      <td>{{assets}}</td>
    </tr>
`,

  // ==================== ASSET-ELEMENT RELATIONS ====================

  assetElementRelations: (lang: DocLanguage) =>
    lang === "de"
      ? `<section class="chapter">
  <h2>Asset-Element-Beziehungen</h2>
  
  <p>Dieses Kapitel zeigt, welche DFD-Elemente mit welchen Assets in Beziehung stehen.</p>
  
  {{assetSections}}
</section>

`
      : `<section class="chapter">
  <h2>Asset-Element Relations</h2>
  
  <p>This chapter shows which DFD elements are related to which assets.</p>
  
  {{assetSections}}
</section>

`,

  assetRelationSection: (lang: DocLanguage) =>
    lang === "de"
      ? `<div class="asset-section">
  <h3>{{assetId}}: {{assetName}}</h3>
  
  {{#assetDescription}}<p class="asset-description"><strong>Beschreibung:</strong> {{assetDescription}}</p>{{/assetDescription}}
  
  <p class="section-label"><strong>Verknüpfte Elemente:</strong></p>
  
  <ul class="element-relations">
{{elementRelations}}
  </ul>
</div>

`
      : `<div class="asset-section">
  <h3>{{assetId}}: {{assetName}}</h3>
  
  {{#assetDescription}}<p class="asset-description"><strong>Description:</strong> {{assetDescription}}</p>{{/assetDescription}}
  
  <p class="section-label"><strong>Linked Elements:</strong></p>
  
  <ul class="element-relations">
{{elementRelations}}
  </ul>
</div>

`,

  elementRelationEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `    <li>
      <strong>{{elementDisplayId}} ({{elementType}}):</strong> {{elementName}}
      <ul>
        <li>Beziehungen: {{relationTypes}}</li>
{{#notes}}        <li>Hinweise: {{notes}}</li>{{/notes}}
      </ul>
    </li>
`
      : `    <li>
      <strong>{{elementDisplayId}} ({{elementType}}):</strong> {{elementName}}
      <ul>
        <li>Relations: {{relationTypes}}</li>
{{#notes}}        <li>Notes: {{notes}}</li>{{/notes}}
      </ul>
    </li>
`,

  noAssetRelations: (lang: DocLanguage) =>
    lang === "de"
      ? `<p class="no-content"><em>Keine Asset-Element-Beziehungen definiert.</em></p>

`
      : `<p class="no-content"><em>No asset-element relations defined.</em></p>

`,
};

// Export all templates combined
export const HTML_ALL_TEMPLATES = {
  ...HTML_EXTENDED_TEMPLATES,
};