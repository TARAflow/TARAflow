// ==================== EXTENDED MARKDOWN TEMPLATES ====================
// Additional templates for detailed element descriptions and asset relations
// Location: features/documentation/utils/templates/markdown-templates-extended.ts

import type { DocLanguage } from "../../models/doc-types";

export const MD_EXTENDED_TEMPLATES = {
  // ==================== DFD ELEMENT DETAILED ENTRY ====================

  dfdElementDetailedEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `<a id="element-{{displayId}}"></a>

#### {{displayId}}: {{name}}

{{propertyGroups}}

{{#assetRelations}}**Verknüpfte Assets:** {{assetRelations}}{{/assetRelations}}

---

`
      : `<a id="element-{{displayId}}"></a>

#### {{displayId}}: {{name}}

{{propertyGroups}}

{{#assetRelations}}**Linked Assets:** {{assetRelations}}{{/assetRelations}}

---

`,

  // Property Group Section
  propertyGroup: (lang: DocLanguage) =>
    `**{{groupName}}**

{{properties}}

`,

  // Property Entry
  propertyEntry: `- **{{label}}**: {{value}}
`,

  // ==================== DFD CONNECTION DETAILED ENTRY ====================

  dfdConnectionDetailedEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `#### {{displayId}}: {{fromElement}} → {{toElement}}

{{#label}}**Label**: {{label}}

{{/label}}

{{propertyGroups}}

{{#assetRelations}}**Verknüpfte Assets:** {{assetRelations}}{{/assetRelations}}

---

`
      : `#### {{displayId}}: {{fromElement}} → {{toElement}}

{{#label}}**Label**: {{label}}{{/label}}

{{propertyGroups}}

{{#assetRelations}}**Linked Assets:** {{assetRelations}}{{/assetRelations}}

---

`,

  // ==================== ELEMENT OVERVIEW TABLE ====================

  dfdElementOverviewTable: (lang: DocLanguage) =>
    lang === "de"
      ? `### Elementübersicht

Die folgende Tabelle gibt einen schnellen Überblick über alle DFD-Elemente.

| ID | Name | Typ | Beschreibung | Assets |
|----|------|-----|--------------|--------|
{{elementRows}}

`
      : `### Element Overview

The following table provides a quick overview of all DFD elements.

| ID | Name | Type | Description | Assets |
|----|------|------|-------------|--------|
{{elementRows}}

`,

  elementOverviewRow: `| [{{displayId}}](#element-{{displayId}}) | {{name}} | {{type}} | {{description}} | {{assets}} |
`,

  // ==================== ASSET-ELEMENT RELATIONS ====================

  assetElementRelations: (lang: DocLanguage) =>
    lang === "de"
      ? `## Asset-Element-Beziehungen

Dieses Kapitel zeigt, welche DFD-Elemente mit welchen Assets in Beziehung stehen.

{{assetSections}}

`
      : `## Asset-Element Relations

This chapter shows which DFD elements are related to which assets.

{{assetSections}}

`,

  assetRelationSection: (lang: DocLanguage) =>
    lang === "de"
      ? `### {{assetDisplayId}}: {{assetName}}

{{#assetDescription}}**Beschreibung**: {{assetDescription}}{{/assetDescription}}

**Verknüpfte Elemente:**

{{elementRelations}}

---

`
      : `### {{assetDisplayId}}: {{assetName}}

{{#assetDescription}}**Description**: {{assetDescription}}{{/assetDescription}}

**Linked Elements:**

{{elementRelations}}

---

`,

  elementRelationEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `- **{{elementDisplayId}} ({{elementType}})**: {{elementName}}
  - Beziehungen: {{relationTypes}}
{{#notes}}  - Hinweise: {{notes}}{{/notes}}
`
      : `- **{{elementDisplayId}} ({{elementType}})**: {{elementName}}
  - Relations: {{relationTypes}}
{{#notes}}  - Notes: {{notes}}{{/notes}}
`,

  noAssetRelations: (lang: DocLanguage) =>
    lang === "de"
      ? `_Keine Asset-Element-Beziehungen definiert._

`
      : `_No asset-element relations defined._

`,
};

// Export all templates combined
export const MD_ALL_TEMPLATES = {
  ...MD_EXTENDED_TEMPLATES,
};