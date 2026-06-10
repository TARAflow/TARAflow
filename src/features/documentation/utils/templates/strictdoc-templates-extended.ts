// ==================== EXTENDED STRICTDOC TEMPLATES ====================
// Additional templates for detailed element descriptions and asset relations
// Location: features/documentation/utils/templates/strictdoc-templates-extended.ts

import type { DocLanguage } from "../../models/doc-types";

export const SDOC_EXTENDED_TEMPLATES = {
  // ==================== DFD ELEMENT DETAILED ENTRY ====================
  // Rendered inside the [SECTION] opened by dfdElementTypeHeader.
  // Each element gets its own sub-section with a [FREETEXT] block.

  dfdElementDetailedEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: {{displayId}}: {{name}}

[FREETEXT]
{{propertyGroups}}
{{#assetRelations}}
**Verknüpfte Assets:** {{assetRelations}}
{{/assetRelations}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: {{displayId}}: {{name}}

[FREETEXT]
{{propertyGroups}}
{{#assetRelations}}
**Linked Assets:** {{assetRelations}}
{{/assetRelations}}
[/FREETEXT]

[/SECTION]

`,

  // ==================== PROPERTY GROUP ====================
  // Groups of properties rendered as RST definition lists inside [FREETEXT].

  propertyGroup: (_lang: DocLanguage) =>
    `**{{groupName}}**

{{properties}}
`,

  propertyEntry: `- **{{label}}**: {{value}}
`,

  // ==================== DFD CONNECTION DETAILED ENTRY ====================

  dfdConnectionDetailedEntry: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: {{displayId}}: {{fromElement}} -> {{toElement}}

[FREETEXT]
{{#label}}**Label**: {{label}}

{{/label}}
{{propertyGroups}}
{{#assetRelations}}
**Verknüpfte Assets:** {{assetRelations}}
{{/assetRelations}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: {{displayId}}: {{fromElement}} -> {{toElement}}

[FREETEXT]
{{#label}}**Label**: {{label}}

{{/label}}
{{propertyGroups}}
{{#assetRelations}}
**Linked Assets:** {{assetRelations}}
{{/assetRelations}}
[/FREETEXT]

[/SECTION]

`,

  // ==================== ELEMENT OVERVIEW TABLE ====================
  // RST list-table inside a [FREETEXT] block.

  dfdElementOverviewTable: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Elementübersicht

[FREETEXT]
Die folgende Tabelle gibt einen schnellen Überblick über alle DFD-Elemente.

.. list-table::
   :header-rows: 1
   :widths: 10 20 20 35 15

   * - ID
     - Name
     - Typ
     - Beschreibung
     - Assets
{{elementRows}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: Element Overview

[FREETEXT]
The following table provides a quick overview of all DFD elements.

.. list-table::
   :header-rows: 1
   :widths: 10 20 20 35 15

   * - ID
     - Name
     - Type
     - Description
     - Assets
{{elementRows}}
[/FREETEXT]

[/SECTION]

`,

  // RST list-table row for element overview (4-space indent for continuation rows)
  elementOverviewRow: `   * - [{{displayId}}](#element-{{displayId}})
     - {{name}}
     - {{type}}
     - {{description}}
     - {{assets}}
`,

  // ==================== ASSET-ELEMENT RELATIONS ====================

  assetElementRelations: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: Asset-Element-Beziehungen

[FREETEXT]
Dieses Kapitel zeigt, welche DFD-Elemente mit welchen Assets in Beziehung stehen.
[/FREETEXT]

{{assetSections}}
[/SECTION]

`
      : `[SECTION]
TITLE: Asset-Element Relations

[FREETEXT]
This chapter shows which DFD elements are related to which assets.
[/FREETEXT]

{{assetSections}}
[/SECTION]

`,

  assetRelationSection: (lang: DocLanguage) =>
    lang === "de"
      ? `[SECTION]
TITLE: {{assetId}}: {{assetName}}

[FREETEXT]
{{#assetDescription}}**Beschreibung**: {{assetDescription}}

{{/assetDescription}}
**Verknüpfte Elemente:**

{{elementRelations}}
[/FREETEXT]

[/SECTION]

`
      : `[SECTION]
TITLE: {{assetId}}: {{assetName}}

[FREETEXT]
{{#assetDescription}}**Description**: {{assetDescription}}

{{/assetDescription}}
**Linked Elements:**

{{elementRelations}}
[/FREETEXT]

[/SECTION]

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
      ? `[FREETEXT]
Keine Asset-Element-Beziehungen definiert.
[/FREETEXT]

`
      : `[FREETEXT]
No asset-element relations defined.
[/FREETEXT]

`,
};

export const SDOC_ALL_TEMPLATES = {
  ...SDOC_EXTENDED_TEMPLATES,
};