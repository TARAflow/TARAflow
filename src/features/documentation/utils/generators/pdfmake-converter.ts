// ==================== PDFMAKE CONVERTER ====================
// Converts TARAflow project data to pdfMake document definition
// Location: features/documentation/utils/generators/pdfmake-converter.ts
//
// This converter transforms our structured data into pdfMake's declarative format
// pdfMake Documentation: http://pdfmake.org/

import { isIsoReport, isoRiskLabel } from "../iso-risk-label";
import { isoScenarioSummary, isoScenarioTitle } from "../iso-scenario-text";
import {
  attackTreeReportSections,
  attackTreesIntro,
  type AttackTreeOutlineItem,
} from "../attack-tree-report";
import { groupIsoScenarios } from "../../../risks/models/iso-scenarios";
import { impactAggregationSentence } from "../impact-aggregation-text";
import { dfdPageSectionsOf, noDfdImageText } from "../dfd-page-sections";
import { dfdParentLevelFlowsOf } from "../dfd-parent-level-flows";
import { reportGroupsOf } from "../dfd-report-groups";
import { dfdItemRefOfThreat } from "../../../../shared/models/dfd-table-groups";
import {
  riskGroupSummary,
  riskStatsTable,
  threatElementType,
  threatGroupSummary,
  threatStatsTable,
  type StatsTable,
} from "../threat-risk-stats";
import { getDFDElementTypeText } from "../../../dfd/models/dfd-formatters";
import type { DFDElementType } from "../../../dfd/models/dfd-types";
import type { TDocumentDefinitions, Content, TableCell, Style, PageSize } from "pdfmake/interfaces";
import type { DocConfiguration, DocProjectData, DocLanguage } from "../../models/doc-types";
import {
  en50742LevelFromRating,
  mandatedRequirementsForThreat,
} from "../../../risks/models/en50742-approach-a-core";
import type { SrslAnchorType } from "../../../risks/models/en50742-approach-a-core";
import {
  formatDocDate,
  getChapterTitle,
  getClassificationText,
} from "../../models/doc-types";
import type { DocChapterId } from "../../models/doc-types";
import type { TranslationFn } from "./base-generator";
import type { PdfOptions } from "./pdf-generator-adaptive";
import { flattenProjectTags } from "../../../../shared/models/project-tags";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
} from "../../../threats/services/threat-catalog-service";
import { formatRiskLabel } from "../../../../shared/models/risk-label";
import {
  buildSecurityGoalDocRows,
  securityGoalDocLabels,
} from "../security-goal-doc-rows";

// ==================== LABELS (Phase 6 fix) ====================
//
// FINDING: Practically every this.t(...) call in this file pointed at
// keys that never existed in doc.json (e.g. "tabs.doc.meta.*",
// "tabs.doc.chapters.threats.table.*") — likely a pre-existing bug that
// was never noticed in the browser PDF fallback (barely used, since
// Electron/Puppeteer was the "real" path). Instead of fixing a second,
// separately maintained i18next structure just for PDF, this fix follows
// the pattern all other generators (Markdown/AsciiDoc/HTML/StrictDoc)
// already use: hardcoded bilingual strings directly in code (see
// CHAPTER_TITLES in doc-types.ts, MD_TEMPLATES in markdown-templates.ts).
// Chapter titles and classification labels are sourced from the existing
// getChapterTitle()/getClassificationText() in doc-types.ts (single
// source of truth, consistent with all other formats) — everything else
// (table headers, stats rows, etc.) via the self-contained map below,
// using the same terminology as MD_TEMPLATES/ADOC_TEMPLATES.

const PDF_LABELS = {
  en: {
    docSubtitle: "Threat and Risk Analysis",
    version: "Version",
    metaDate: "Created",
    metaAuthor: "Responsible",
    metaClassification: "Classification",
    tocTitle: "Table of Contents",
    executiveSummaryOverview: "Overview",
    executiveSummaryResults: "Analysis Results",
    metricLabel: "Metric",
    valueLabel: "Value",
    statAssets: "Identified Assets",
    statThreats: "Identified Threats",
    statRisks: "Assessed Risks",
    statAcceptedRisks: "Accepted Risks",
    systemOverviewDescription: "Project Description",
    systemOverviewTags: "Classification",
    dfdNoDiagram: "No diagram available",
    dfdElements: "DFD Elements",
    assetsTableId: "ID",
    assetsTableName: "Name",
    assetsTableDescription: "Description",
    assetsTableImpact: "Impact",
    assetsTableGoals: "Security Goals",
    threatsTableId: "T-ID",
    threatsTableElement: "Element/Flow",
    threatsTableCategory: "Category",
    threatsTableDescription: "Threat",
    threatsTableMitigation: "Mitigation",
    risksTableId: "T-ID",
    risksTableThreat: "Threat",
    risksTableRiskBefore: "Risk (Before)",
    risksTableMitigation: "Mitigation",
    risksTableRiskAfter: "Risk (After)",
    risksTableMoscow: "MoSCoW",
    attackPathRisksIntro:
      "The following tables show the risk assessment per threat scenario (attack tree), one row per attack path. The scenario value is the highest value of its paths, the residual the highest residual (ISO/SAE 21434, 15.8 NOTE 2); risk values 1–5 per Annex H.8.",
    acceptedRisksTableId: "T-ID",
    acceptedRisksTableDescription: "Threat",
    acceptedRisksTableJustification: "Justification",
    appendixGeneratedBy: "This document was automatically generated by",
  },
  de: {
    docSubtitle: "Bedrohungs- und Risikoanalyse",
    version: "Version",
    metaDate: "Erstellt",
    metaAuthor: "Verantwortlich",
    metaClassification: "Klassifizierung",
    tocTitle: "Inhaltsverzeichnis",
    executiveSummaryOverview: "Übersicht",
    executiveSummaryResults: "Analyse-Ergebnisse",
    metricLabel: "Metrik",
    valueLabel: "Wert",
    statAssets: "Identifizierte Assets",
    statThreats: "Identifizierte Bedrohungen",
    statRisks: "Bewertete Risiken",
    statAcceptedRisks: "Akzeptierte Risiken",
    systemOverviewDescription: "Projektbeschreibung",
    systemOverviewTags: "Klassifizierung",
    dfdNoDiagram: "Kein Diagramm verfügbar",
    dfdElements: "DFD-Elemente",
    assetsTableId: "ID",
    assetsTableName: "Name",
    assetsTableDescription: "Beschreibung",
    assetsTableImpact: "Impact",
    assetsTableGoals: "Schutzziele",
    threatsTableId: "T-ID",
    threatsTableElement: "Element/Flow",
    threatsTableCategory: "Kategorie",
    threatsTableDescription: "Bedrohung",
    threatsTableMitigation: "Mitigation",
    risksTableId: "T-ID",
    risksTableThreat: "Bedrohung",
    risksTableRiskBefore: "Risiko (vorher)",
    risksTableMitigation: "Mitigation",
    risksTableRiskAfter: "Risiko (nachher)",
    risksTableMoscow: "MoSCoW",
    attackPathRisksIntro:
      "Die folgenden Tabellen zeigen die Risikobewertung je Bedrohungsszenario (Angriffsbaum), eine Zeile je Angriffspfad. Der Szenariowert ist der höchste Wert seiner Pfade, das Restrisiko das höchste Restrisiko (ISO/SAE 21434, 15.8 NOTE 2); Risikowerte 1–5 nach Anhang H.8.",
    acceptedRisksTableId: "T-ID",
    acceptedRisksTableDescription: "Bedrohung",
    acceptedRisksTableJustification: "Begründung",
    appendixGeneratedBy: "Dieses Dokument wurde automatisch generiert von",
  },
} as const;

type PdfLabelKey = keyof (typeof PDF_LABELS)["en"];
type DocRisk = NonNullable<DocProjectData["risks"]>["risks"][number];

// ==================== PDFMAKE CONVERTER ====================

export class PdfMakeConverter {
  private project: DocProjectData;
  private config: DocConfiguration;
  private t: TranslationFn;
  private lang: DocLanguage;

  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
  ) {
    this.project = project;
    this.config = config;
    this.t = t;
    this.lang = config.language;
  }

  // ==================== LABEL HELPER (Phase 6 fix) ====================

  private typeLabel(type: string): string {
    return getDFDElementTypeText(type as DFDElementType, this.t);
  }

  /** The statistics of a threat / risk chapter as a small table. */
  private statsTable(table: StatsTable): Content {
    return {
      table: {
        headerRows: 1,
        widths: ["*", ...table.headers.slice(1).map(() => "auto" as const)],
        body: [
          table.headers.map((h): TableCell => ({ text: h, style: "tableHeader" })),
          ...table.rows.map((r) => r.map((c, i): TableCell => ({ text: c, alignment: i === 0 ? "left" : "center" }))),
          table.total.map((c, i): TableCell => ({ text: c, bold: true, alignment: i === 0 ? "left" : "center" })),
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 14],
    };
  }

  private label(key: PdfLabelKey): string {
    return PDF_LABELS[this.lang]?.[key] ?? PDF_LABELS.en[key];
  }

  private chapterTitle(chapterId: DocChapterId): string {
    const chapterConfig = this.config.chapters.find((c) => c.id === chapterId);
    return getChapterTitle(
      chapterId,
      this.lang,
      chapterConfig?.customTitle,
      chapterConfig?.customTitleDE,
    );
  }

  // ==================== DATA ACCESS HELPERS ====================

  private getAssets() {
    return this.project.assets?.assets ?? [];
  }

  private getThreats() {
    const perElementTables = this.project.threats?.perElementTables ?? [];
    const perInteractionTables =
      this.project.threats?.perInteractionTables ?? [];
    return [
      ...perElementTables.flatMap((t) => t.threats),
      ...perInteractionTables.flatMap((t) => t.threats),
    ];
  }

  private getThreatsPerElement() {
    const tables = this.project.threats?.perElementTables ?? [];
    return tables.flatMap((t) => t.threats);
  }

  private getThreatsPerInteraction() {
    const tables = this.project.threats?.perInteractionTables ?? [];
    return tables.flatMap((t) => t.threats);
  }

  private getRisks() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter((r) => r.moscowPriority !== "wont");
  }

  private getRisksPerElement() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(
      (r) =>
        r.sourceStrideMethod === "per-element" && r.moscowPriority !== "wont",
    );
  }

  private getRisksPerInteraction() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(
      (r) =>
        r.sourceStrideMethod === "per-interaction" &&
        r.moscowPriority !== "wont",
    );
  }

  private getRisksAttackPath() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(
      (r) =>
        r.sourceStrideMethod === "attack-path" && r.moscowPriority !== "wont",
    );
  }

  private getWontRisks() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter((r) => r.moscowPriority === "wont");
  }

  // ==================== MAIN CONVERTER ====================

  createDocumentDefinition(pdfOptions?: PdfOptions): TDocumentDefinitions {
    const content: Content[] = [];

    // Cover page
    content.push(...this.createCoverPage());

    // Table of contents
    content.push(...this.createTableOfContents());

    // Chapters
    const chapters = this.config.chapters.filter((c) => c.enabled);

    for (const chapterConfig of chapters) {
      switch (chapterConfig.id) {
        case "executive-summary":
          content.push(...this.createExecutiveSummary());
          break;
        case "applicable-regulations":
          // Regulations feature not yet in DocProjectData - skip for now
          break;
        case "system-overview":
          content.push(...this.createSystemOverview());
          break;
        case "dfd":
          if (this.project.dfd) {
            content.push(...this.createDfd());
          }
          break;
        case "assets":
          if (this.getAssets().length > 0) {
            content.push(...this.createAssets());
          }
          break;
        case "threats-per-element":
        case "threats-per-interaction":
          if (this.hasThreats()) {
            content.push(...this.createThreats());
          }
          break;
        // One chapter per method, each only with its own risks.
        case "risks-per-element":
          if (this.getRisksPerElement().length > 0) {
            content.push(...this.createRisks("per-element"));
          }
          break;
        case "risks-per-interaction":
          if (this.getRisksPerInteraction().length > 0) {
            content.push(...this.createRisks("per-interaction"));
          }
          break;
        case "risks-attack-path":
          if (isIsoReport(this.project.risks?.configuration) && this.getRisksAttackPath().length > 0) {
            content.push(...this.createAttackPathRisks());
          }
          break;
        case "srsl-assessment":
          content.push(...this.createSRSLAssessment());
          break;
        case "attack-trees":
          content.push(...this.createAttackTrees());
          break;
        case "accepted-risks":
          if (this.getWontRisks().length > 0) {
            content.push(...this.createAcceptedRisks());
          }
          break;
        case "appendix":
          content.push(...this.createAppendix());
          break;
      }
    }

    const format = pdfOptions?.format ?? "A4";

    return {
      content,
      styles: this.getStyles(),
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
        lineHeight: 1.4,
      },
      pageSize: this.convertPageSize(format),
      pageOrientation: pdfOptions?.landscape ? "landscape" : "portrait",
      pageMargins: [
        this.mmToPt(pdfOptions?.margin?.left || 15),
        this.mmToPt(pdfOptions?.margin?.top || 20),
        this.mmToPt(pdfOptions?.margin?.right || 15),
        this.mmToPt(pdfOptions?.margin?.bottom || 20),
      ],
      header: (currentPage, pageCount) =>
        this.createHeader(currentPage, pageCount),
      footer: (currentPage, pageCount) =>
        this.createFooter(currentPage, pageCount),
    };
  }

  // ==================== COVER PAGE ====================

  private createCoverPage(): Content[] {
    const classification = this.config.template.classification || "internal";
    const classificationLabel = getClassificationText(
      classification,
      this.lang,
    );

    return [
      {
        text: this.project.info.name,
        style: "coverTitle",
        margin: [0, 100, 0, 20],
      },
      {
        text: this.label("docSubtitle"),
        style: "coverSubtitle",
        margin: [0, 0, 0, 10],
      },
      {
        text: this.project.info.version
          ? `${this.label("version")}: ${this.project.info.version}`
          : "",
        style: "coverVersion",
        margin: [0, 0, 0, 40],
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 2,
            lineColor: "#e2e8f0",
          },
        ],
        margin: [0, 0, 0, 40],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: this.label("metaDate"), style: "metaLabel" },
              {
                text: formatDocDate(
                  new Date(),
                  this.config.template.dateFormat,
                ),
                style: "metaValue",
              },
            ],
          },
          {
            width: "*",
            stack: [
              { text: this.label("metaAuthor"), style: "metaLabel" },
              {
                text: this.project.info.responsible || "-",
                style: "metaValue",
              },
            ],
          },
          {
            width: "*",
            stack: [
              { text: this.label("metaClassification"), style: "metaLabel" },
              {
                text: classificationLabel.toUpperCase(),
                style: ["metaValue", `classification-${classification}`],
              },
            ],
          },
        ],
      },
      { text: "", pageBreak: "after" },
    ];
  }

  // ==================== TABLE OF CONTENTS ====================

  private createTableOfContents(): Content[] {
    const tocItems: Content[] = [];

    tocItems.push({
      text: this.label("tocTitle"),
      style: "h1",
      tocItem: false,
    });

    const chapters = this.config.chapters.filter((c) => c.enabled);

    for (const chapter of chapters) {
      const hasContent = this.chapterHasContent(chapter.id);
      if (hasContent) {
        tocItems.push({
          text: this.chapterTitle(chapter.id as DocChapterId),
          style: "tocItem",
          tocItem: true,
          tocMargin: [0, 5, 0, 0],
        });
      }
    }

    tocItems.push({ text: "", pageBreak: "after" });

    return tocItems;
  }

  // ==================== EXECUTIVE SUMMARY ====================

  private createExecutiveSummary(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.chapterTitle("executive-summary"),
      style: "h1",
      tocItem: true,
    });

    // Basic project description
    if (this.project.info.description) {
      content.push({
        text: this.label("executiveSummaryOverview"),
        style: "h2",
      });
      content.push({
        text: this.project.info.description,
        margin: [0, 0, 0, 15],
      });
    }

    // Analysis statistics
    content.push({
      text: this.label("executiveSummaryResults"),
      style: "h2",
    });

    const tableBody: TableCell[][] = [
      [
        { text: this.label("metricLabel"), style: "tableHeader" },
        { text: this.label("valueLabel"), style: "tableHeader" },
      ],
      [
        { text: this.label("statAssets") },
        { text: this.getAssets().length.toString(), alignment: "center" },
      ],
      [
        { text: this.label("statThreats") },
        { text: this.getThreats().length.toString(), alignment: "center" },
      ],
      [
        { text: this.label("statRisks") },
        { text: this.getRisks().length.toString(), alignment: "center" },
      ],
      [
        { text: this.label("statAcceptedRisks") },
        { text: this.getWontRisks().length.toString(), alignment: "center" },
      ],
    ];

    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 100],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== SYSTEM OVERVIEW ====================

  private createSystemOverview(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.chapterTitle("system-overview"),
      style: "h1",
      tocItem: true,
    });

    if (this.project.info.description) {
      content.push({
        text: this.label("systemOverviewDescription"),
        style: "h2",
      });
      content.push({
        text: this.project.info.description,
        margin: [0, 0, 0, 15],
      });
    }

    // Tags
    const flatTags = flattenProjectTags(this.project.info.tags);
    if (flatTags.length > 0) {
      content.push({
        text: this.label("systemOverviewTags"),
        style: "h2",
      });

      content.push({
        text: flatTags.join(", "),
        margin: [0, 0, 0, 15],
      });
    }

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== DFD ====================

  private createDfd(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.chapterTitle("dfd"),
      style: "h1",
      tocItem: true,
    });

    // Leveled DFD (7a/7b): one section per page — heading, figure, the
    // elements defined on it.
    const sections = dfdPageSectionsOf(this.project.dfd, this.lang);
    if (sections) {
      for (const section of sections) {
        content.push({ text: section.title, style: "h2" });
        if (section.isPage) {
          content.push(
            section.image
              ? { image: section.image, width: 500, margin: [0, 0, 0, 12] }
              : { text: noDfdImageText(this.lang), style: "placeholder", margin: [0, 0, 0, 12] },
          );
        }
        for (const element of section.elements) {
          content.push(
            { text: element.name, style: "h3", margin: [0, 6, 0, 2] },
            { text: element.description || "-", margin: [0, 0, 0, 6] },
          );
        }
      }
      // 7c: the flows analysed on a parent level.
      const parentLevel = dfdParentLevelFlowsOf(this.project.dfd, this.lang);
      if (parentLevel) {
        const header = this.lang === "de" ? ["Fluss", "Von", "Nach", "Grund"] : ["Flow", "From", "To", "Reason"];
        content.push(
          { text: parentLevel.title, style: "h2" },
          { text: parentLevel.intro, margin: [0, 0, 0, 8] },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "auto", "auto", "*"],
              body: [
                header.map((h): TableCell => ({ text: h, bold: true })),
                ...parentLevel.rows.map((r): TableCell[] => [r.flow, r.from, r.to, r.reason]),
              ],
            },
            margin: [0, 0, 0, 12],
          },
        );
      }
      content.push({ text: "", pageBreak: "after" });
      return content;
    }

    // DFD image placeholder
    if (this.project.dfd?.thumbnail) {
      content.push({
        image: this.project.dfd.thumbnail,
        width: 500,
        margin: [0, 0, 0, 20],
      });
    } else {
      content.push({
        text: this.label("dfdNoDiagram"),
        style: "placeholder",
        margin: [0, 0, 0, 20],
      });
    }

    // DFD Elements
    const elements = this.project.dfd?.elements ?? [];
    if (elements.length > 0) {
      content.push({
        text: this.label("dfdElements"),
        style: "h2",
      });

      for (const element of elements) {
        content.push({
          text: element.name,
          style: "h3",
          margin: [0, 10, 0, 5],
        });
        content.push({
          text: element.description || "-",
          margin: [0, 0, 0, 10],
        });
      }
    }

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== ASSETS ====================

  private createAssets(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.chapterTitle("assets"),
      style: "h1",
      tocItem: true,
    });

    const tableBody: TableCell[][] = [
      // Header
      [
        { text: this.label("assetsTableId"), style: "tableHeader" },
        { text: this.label("assetsTableName"), style: "tableHeader" },
        { text: this.label("assetsTableDescription"), style: "tableHeader" },
        { text: this.label("assetsTableImpact"), style: "tableHeader" },
        { text: this.label("assetsTableGoals"), style: "tableHeader" },
      ],
    ];

    for (const asset of this.getAssets()) {
      // Filter enabled security goals
      const enabledGoals =
        asset.securityGoals
          .filter((g) => g.level !== "none")
          .map((g) => g.type)
          .join(", ") || "-";

      // Get impact label from cache or fallback to value
      const impactLabel =
        this.project.computed.impactLabels.get(asset.id) ??
        asset.overallImpact.toString();

      tableBody.push([
        { text: asset.id },
        { text: asset.name },
        { text: asset.properties?.description || "-" },
        { text: impactLabel, alignment: "center" },
        { text: enabledGoals },
      ]);
    }

    content.push({
      table: {
        headerRows: 1,
        widths: [50, "*", "*", 60, "*"],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });

    content.push(...this.createSecurityGoalTable());

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // Security-goal table (asset × active or excluded goal) — same rows as the
  // text formats via buildSecurityGoalDocRows. Omitted when there are none.
  private createSecurityGoalTable(): Content[] {
    const impactScale =
      this.project.assets?.configuration?.impactScale ?? "4-level";
    const rows = buildSecurityGoalDocRows(
      this.getAssets(),
      impactScale,
      this.lang,
    );
    if (rows.length === 0) return [];

    const labels = securityGoalDocLabels(this.lang);
    const body: TableCell[][] = [
      labels.headers.map((h) => ({ text: h, style: "tableHeader" })),
      ...rows.map((r) => {
        // Excluded goals are decisions, not protection needs — set apart.
        const ex = r.excluded ? { italics: true, color: "#6b7280" } : {};
        return [
          { text: r.asset, ...ex },
          { text: r.goal, ...ex },
          { text: r.level, ...ex },
          { text: r.source, fontSize: 8, ...ex },
          { text: r.basis, fontSize: 8, ...ex },
          { text: r.consequence, fontSize: 8, ...ex },
        ];
      }),
    ];

    return [
      { text: labels.title, style: "h2" },
      { text: labels.intro, margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: [55, 65, 45, 75, "*", "*"],
          body,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      },
    ];
  }

  // ==================== THREATS ====================

  private createThreats(): Content[] {
    const content: Content[] = [];

    // Determine which method has threats
    const threatsPerElement = this.getThreatsPerElement();
    const threatsPerInteraction = this.getThreatsPerInteraction();

    const method =
      threatsPerElement.length > 0 ? "per-element" : "per-interaction";
    const threats =
      method === "per-element" ? threatsPerElement : threatsPerInteraction;

    content.push({
      text: this.chapterTitle(
        method === "per-element"
          ? "threats-per-element"
          : "threats-per-interaction",
      ),
      style: "h1",
      tocItem: true,
    });

    const threatHeader: TableCell[] = [
      { text: this.label("threatsTableId"), style: "tableHeader" },
      { text: this.label("threatsTableElement"), style: "tableHeader" },
      { text: this.label("threatsTableCategory"), style: "tableHeader" },
      { text: this.label("threatsTableDescription"), style: "tableHeader" },
      { text: this.label("threatsTableMitigation"), style: "tableHeader" },
    ];
    const threatTable = (list: typeof threats): Content => {
      const tableBody: TableCell[][] = [threatHeader];
      for (const threat of list) {
        // Get STRIDE name from cache
        const strideName =
          this.project.computed.strideNames.get(threat.strideCategory) ??
          threat.strideCategory;

        // Get element or flow name
        const elementOrFlow =
          threat.linkedElement?.elementName ||
          threat.dataFlow?.dataFlowName ||
          "-";

        tableBody.push([
          { text: threat.displayId },
          { text: elementOrFlow },
          { text: strideName },
          { text: threat.threatDescription || "-" },
          {
            text:
              resolveMitigationDrafts(threat.proposedMitigations ?? [])
                .map((m) => (m.isCustom ? `[custom] ${m.notes ?? ""}` : m.text))
                .filter(Boolean)
                .map((s) => `• ${s}`)
                .join("\n") || "-",
          },
        ]);
      }
      return {
        table: {
          headerRows: 1,
          widths: [50, "*", 60, "*", "*"],
          body: tableBody,
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 20],
      };
    };

    // Leveled DFD (7d): one table per group, as the app's accordions.
    const groups = reportGroupsOf(this.project.dfd, this.lang, threats, (threat) =>
      dfdItemRefOfThreat(threat),
    );
    content.push(this.statsTable(threatStatsTable(threats, this.lang, (type) => this.typeLabel(type))));
    if (groups) {
      for (const group of groups) {
        content.push(
          { text: group.title, style: "h2" },
          { text: threatGroupSummary(group.items, this.lang), margin: [0, 0, 0, 6] },
          threatTable(group.items),
        );
      }
    } else {
      content.push(threatTable(threats));
    }

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== RISKS ====================

  // EN 50742 Approach A SRSL table (pdfmake). One row per risk with an exposure
  // anchor (EL > 0); en-50742-a projects only. Mirrors createRisks().
  private createSRSLAssessment(): Content[] {
    const config = this.project.risks?.configuration;
    if (config?.likelihoodMethod !== "en-50742-a") return [];

    const woo = (config.windowOfOpportunity ?? "-").replace(/_/g, " ");
    const assetsById = new Map(
      (this.project.assets?.assets ?? []).map((a) => [a.id, a]),
    );
    const ratingValue = (
      risk: { factorRatings?: { factorId: string; value: number }[] },
      factorId: string,
    ): number =>
      risk.factorRatings?.find((f) => f.factorId === factorId)?.value ?? 0;

    const rows = (this.project.risks?.risks ?? []).filter(
      (r) => r.moscowPriority !== "wont" && ratingValue(r, "exposure_level") > 0,
    );
    if (rows.length === 0) return [];

    const threatById = new Map(
      [
        ...(this.project.threats?.perElementTables?.flatMap((t) => t.threats) ??
          []),
        ...(this.project.threats?.perInteractionTables?.flatMap(
          (t) => t.threats,
        ) ?? []),
      ].map((t) => [t.id, t]),
    );

    const content: Content[] = [];
    content.push({
      text: this.chapterTitle("srsl-assessment"),
      style: "h1",
      tocItem: true,
    });

    const tableBody: TableCell[][] = [
      [
        { text: "T-ID", style: "tableHeader" },
        { text: "Safety Asset", style: "tableHeader" },
        { text: "Severity", style: "tableHeader" },
        { text: "EL", style: "tableHeader" },
        { text: "WoO", style: "tableHeader" },
        { text: "AC", style: "tableHeader" },
        { text: "AP", style: "tableHeader" },
        { text: "SRSL", style: "tableHeader" },
        { text: "Mandated 7.4.3 Controls", style: "tableHeader" },
      ],
    ];

    for (const risk of rows) {
      const el =
        en50742LevelFromRating(
          "exposure_level",
          ratingValue(risk, "exposure_level"),
        ) ?? "-";
      const ac =
        en50742LevelFromRating(
          "attacker_capability",
          ratingValue(risk, "attacker_capability"),
        ) ?? "-";
      const linked = (risk.linkedAssetIds ?? [])
        .map((id) => assetsById.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));
      const safetyAsset =
        linked.find((a) => a.physicalImpact) ?? linked[0] ?? null;
      const ap =
        risk.calculatedApScore != null
          ? `${risk.calculatedApScore} (${risk.calculatedApBand ?? "-"})`
          : "-";
      const threat = threatById.get(risk.threatId);
      const et = threat?.linkedElement?.elementType;
      const anchorType: SrslAnchorType | undefined =
        et === "Interface"
          ? "Interface"
          : et === "DataFlow" || threat?.dataFlow
            ? "DataFlow"
            : undefined;
      const controls =
        anchorType && risk.calculatedSrsl
          ? mandatedRequirementsForThreat(
              anchorType,
              risk.strideCategory,
              risk.calculatedSrsl,
            )
              .map((r) => `${r.category} (${r.clause})`)
              .join("; ") || "-"
          : "-";
      tableBody.push([
        { text: risk.threatDisplayId },
        { text: safetyAsset?.name ?? "-" },
        { text: (safetyAsset?.physicalImpact ?? "-").replace(/_/g, " ") },
        { text: el, alignment: "center" },
        { text: woo, alignment: "center" },
        { text: ac, alignment: "center" },
        { text: ap, alignment: "center" },
        { text: risk.calculatedSrsl ?? "-", alignment: "center" },
        { text: controls },
      ]);
    }

    content.push({
      table: { headerRows: 1, widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto", "*"], body: tableBody },
      layout: "lightHorizontalLines",
      margin: [0, 4, 0, 12],
    });

    return content;
  }

  /**
   * ISO/SAE 21434 (plan F4): attack-path risks per threat scenario, same
   * structure as the template generators (base-generator
   * generateAttackPathRisks).
   */
  private createAttackPathRisks(): Content[] {
    const config = this.project.risks?.configuration;
    const risks = this.getRisksAttackPath();
    const content: Content[] = [
      { text: this.chapterTitle("risks-attack-path"), style: "h1", tocItem: true },
      {
        text: this.label("attackPathRisksIntro"),
        margin: [0, 0, 0, 8],
      },
    ];
    const assetLabel = (id: string) => {
      const asset = this.project.assets?.assets?.find((a) => a.id === id);
      return asset ? `${asset.displayId ?? asset.id} ${asset.name}` : id;
    };
    const scale = {
      iso: true,
      scale: config?.scale ?? "4-level",
      roundingMethod: config?.roundingMethod,
    } as const;
    content.push(
      this.statsTable(
        riskStatsTable(risks, (r) => r.linkedAssetIds?.[0] ?? "-", scale, this.lang, assetLabel, "asset"),
      ),
    );
    for (const sc of groupIsoScenarios(risks)) {
      content.push(
        { text: isoScenarioTitle(sc, this.project.attackTree), style: "h2" },
        { text: isoScenarioSummary(sc, this.t, config), margin: [0, 0, 0, 6] },
        this.riskTable(sc.risks),
      );
    }
    content.push({ text: "", pageBreak: "after" });
    return content;
  }

  /** Plan F5: one section per attack tree, same content as the template generators. */
  private createAttackTrees(): Content[] {
    const sections = attackTreeReportSections(this.project, this.t);
    if (sections.length === 0) return [];
    // Nested pdfmake list from the depth-annotated outline.
    const nest = (items: AttackTreeOutlineItem[], depth: number): Content[] => {
      const out: Content[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].depth !== depth) continue;
        out.push(items[i].text);
        const children: AttackTreeOutlineItem[] = [];
        for (let j = i + 1; j < items.length && items[j].depth > depth; j++) children.push(items[j]);
        if (children.length > 0) out.push({ ul: nest(children, depth + 1) });
      }
      return out;
    };
    const content: Content[] = [
      { text: this.chapterTitle("attack-trees"), style: "h1", tocItem: true },
      { text: attackTreesIntro(this.t), margin: [0, 0, 0, 8] },
    ];
    for (const section of sections) {
      content.push({ text: section.title, style: "h2" });
      for (const [label, value] of section.facts) {
        content.push({ text: [{ text: `${label}: `, bold: true }, value] });
      }
      if (section.outline.length > 0) {
        content.push(
          { text: section.outlineTitle, bold: true, margin: [0, 6, 0, 2] },
          { ul: nest(section.outline, 0) },
        );
      }
      if (section.rows.length > 0) {
        content.push(
          { text: section.pathsTitle, bold: true, margin: [0, 6, 0, 2] },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "*", "auto", "auto", "auto"],
              body: [
                section.headers.map((h): TableCell => ({ text: h, style: "tableHeader" })),
                ...section.rows.map((r) => r.map((c): TableCell => ({ text: c }))),
              ],
            },
            layout: "lightHorizontalLines",
            margin: [0, 0, 0, 12],
          },
        );
      }
    }
    content.push({ text: "", pageBreak: "after" });
    return content;
  }

  /** A risk table (per-element, per-interaction and attack-path chapters). */
  private riskTable(list: readonly DocRisk[]): Content {
    const riskHeader: TableCell[] = [
      { text: this.label("risksTableId"), style: "tableHeader" },
      { text: this.label("risksTableThreat"), style: "tableHeader" },
      { text: this.label("risksTableRiskBefore"), style: "tableHeader" },
      { text: this.label("risksTableMitigation"), style: "tableHeader" },
      { text: this.label("risksTableRiskAfter"), style: "tableHeader" },
      { text: this.label("risksTableMoscow"), style: "tableHeader" },
    ];
    const tableBody: TableCell[][] = [riskHeader];
    for (const risk of list) {
      // Get labels from cache
      // ISO/SAE 21434: risk value 1–5 instead of `I × L` (3a-2, decision 23).
      const iso = isIsoReport(this.project.risks?.configuration);
      const riskBeforeLabel = iso
        ? isoRiskLabel(risk, this.t, false)
        : (this.project.computed.riskBeforeLabels.get(risk.id) ??
          risk.calculatedRiskBeforeMitigation.toString());
      const riskAfterLabel = iso
        ? isoRiskLabel(risk, this.t, true)
        : (this.project.computed.riskAfterLabels.get(risk.id) ??
          risk.calculatedRiskAfterMitigation.toString());
      const moscowLabel =
        this.project.computed.moscowLabels.get(risk.moscowPriority) ??
        risk.moscowPriority;

      // Format mitigations (mirrors base-generator.ts: notes take priority,
      // fall back to the raw catalog ID — no catalog-text resolution here,
      // unlike the Threats table's proposedMitigations)
      const mitigations =
        risk.selectedMitigations
          .filter((m) => m.status !== "rejected")
          .map((m) => m.notes?.trim() || m.id || "")
          .filter(Boolean)
          .join(", ") || "-";

      tableBody.push([
        { text: formatRiskLabel(risk) },
        { text: risk.threatDisplayId },
        {
          text: riskBeforeLabel,
          alignment: "center",
          fillColor: iso
            ? this.getIsoRiskFill(risk.isoRisk?.value)
            : this.getRiskColorByValue(risk.calculatedRiskBeforeMitigation),
        },
        { text: mitigations },
        {
          text: riskAfterLabel,
          alignment: "center",
          fillColor: iso
            ? this.getIsoRiskFill(risk.isoRisk?.residual?.value)
            : this.getRiskColorByValue(risk.calculatedRiskAfterMitigation),
        },
        { text: moscowLabel, alignment: "center" },
      ]);
    }
    return {
      table: {
        headerRows: 1,
        widths: [50, 60, 50, "*", 50, 50],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    };
  }

  private createRisks(method: "per-element" | "per-interaction"): Content[] {
    const content: Content[] = [];
    const risks =
      method === "per-element"
        ? this.getRisksPerElement()
        : this.getRisksPerInteraction();

    content.push({
      text: this.chapterTitle(
        method === "per-element"
          ? "risks-per-element"
          : "risks-per-interaction",
      ),
      style: "h1",
      tocItem: true,
    });
    content.push({
      text: impactAggregationSentence(
        this.project.risks?.configuration?.impactAggregation,
        this.lang,
      ),
      margin: [0, 0, 0, 8],
    });

    // Leveled DFD (7d): one table per group — a risk follows its threat.
    const threatById = new Map(
      [...this.getThreatsPerElement(), ...this.getThreatsPerInteraction()].map((t) => [t.id, t]),
    );
    const groups = reportGroupsOf(this.project.dfd, this.lang, risks, (risk) => {
      const threat = threatById.get(risk.threatId);
      return threat ? dfdItemRefOfThreat(threat) : undefined;
    });
    const scale = {
      iso: isIsoReport(this.project.risks?.configuration),
      scale: this.project.risks?.configuration?.scale ?? "4-level",
      roundingMethod: this.project.risks?.configuration?.roundingMethod,
    } as const;
    const riskType = (risk: (typeof risks)[number]) => {
      const threat = threatById.get(risk.threatId);
      return threat ? threatElementType(threat) : "-";
    };
    content.push(
      this.statsTable(
        riskStatsTable(risks, riskType, scale, this.lang, (type) => this.typeLabel(type)),
      ),
    );
    if (groups) {
      for (const group of groups) {
        content.push(
          { text: group.title, style: "h2" },
          { text: riskGroupSummary(group.items, scale, this.lang), margin: [0, 0, 0, 6] },
          this.riskTable(group.items),
        );
      }
    } else {
      content.push(this.riskTable(risks));
    }

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== ACCEPTED RISKS ====================

  private createAcceptedRisks(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.chapterTitle("accepted-risks"),
      style: "h1",
      tocItem: true,
    });

    const tableBody: TableCell[][] = [
      // Header
      [
        { text: this.label("acceptedRisksTableId"), style: "tableHeader" },
        {
          text: this.label("acceptedRisksTableDescription"),
          style: "tableHeader",
        },
        {
          text: this.label("acceptedRisksTableJustification"),
          style: "tableHeader",
        },
      ],
    ];

    for (const risk of this.getWontRisks()) {
      tableBody.push([
        { text: formatRiskLabel(risk) },
        { text: risk.threatDescription || "-" },
        { text: risk.wontJustification || "-" },
      ]);
    }

    content.push({
      table: {
        headerRows: 1,
        widths: [60, "*", "*"],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== APPENDIX ====================

  private createAppendix(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.chapterTitle("appendix"),
      style: "h1",
      tocItem: true,
    });

    content.push({
      text: this.label("appendixGeneratedBy"),
      margin: [0, 0, 0, 5],
    });

    content.push({
      text: `TARAflow ${this.config.template.customVersion || "1.0"}`,
      bold: true,
      margin: [0, 0, 0, 10],
    });

    const dateStr = formatDocDate(new Date(), this.config.template.dateFormat);
    content.push({
      text: `${this.label("metaDate")}: ${dateStr}`,
      margin: [0, 0, 0, 20],
    });

    return content;
  }

  // ==================== HEADER/FOOTER ====================

  private createHeader(currentPage: number, pageCount: number): Content {
    if (currentPage === 1) return { text: "" }; // No header on cover page

    const classification = this.config.template.classification || "internal";
    const classificationLabel = getClassificationText(
      classification,
      this.lang,
    );

    return {
      columns: [
        {
          width: "*",
          text: this.project.info.name,
          fontSize: 8,
          color: "#64748b",
        },
        {
          width: "auto",
          text: classificationLabel.toUpperCase(),
          fontSize: 8,
          bold: true,
          color: this.getClassificationColor(classification),
        },
        {
          width: "*",
          text: this.label("docSubtitle"),
          fontSize: 8,
          color: "#64748b",
          alignment: "right",
        },
      ],
      margin: [40, 15, 40, 0],
    };
  }

  private createFooter(currentPage: number, pageCount: number): Content {
    if (currentPage === 1) return { text: "" }; // No footer on cover page

    const dateStr = formatDocDate(new Date(), this.config.template.dateFormat);

    return {
      columns: [
        {
          width: "*",
          text: `TARAflow ${this.config.template.customVersion || "1.0"}`,
          fontSize: 8,
          color: "#64748b",
        },
        {
          width: "*",
          text: dateStr,
          fontSize: 8,
          color: "#64748b",
          alignment: "center",
        },
        {
          width: "*",
          text: `${currentPage} / ${pageCount}`,
          fontSize: 8,
          color: "#64748b",
          alignment: "right",
        },
      ],
      margin: [40, 0, 40, 15],
    };
  }

  // ==================== STYLES ====================

  private getStyles(): { [name: string]: Style } {
    return {
      coverTitle: {
        fontSize: 28,
        bold: true,
        color: "#0f172a",
      },
      coverSubtitle: {
        fontSize: 18,
        color: "#475569",
      },
      coverVersion: {
        fontSize: 12,
        color: "#64748b",
      },
      metaLabel: {
        fontSize: 9,
        color: "#64748b",
        margin: [0, 0, 0, 3],
      },
      metaValue: {
        fontSize: 11,
        bold: true,
      },
      "classification-public": {
        color: "#166534",
      },
      "classification-internal": {
        color: "#1e40af",
      },
      "classification-confidential": {
        color: "#92400e",
      },
      "classification-restricted": {
        color: "#991b1b",
      },
      h1: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 15],
        color: "#0f172a",
      },
      h2: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 8],
        color: "#1e293b",
      },
      h3: {
        fontSize: 12,
        bold: true,
        margin: [0, 8, 0, 5],
        color: "#334155",
      },
      tocItem: {
        fontSize: 11,
        margin: [0, 3, 0, 3],
      },
      tableHeader: {
        bold: true,
        fillColor: "#f1f5f9",
        margin: [5, 5, 5, 5],
      },
      placeholder: {
        fontSize: 10,
        italics: true,
        color: "#94a3b8",
      },
    };
  }

  // ==================== UTILITY METHODS ====================

  private convertPageSize(
    format: PdfOptions["format"] | undefined,
  ): PageSize | undefined {
    if (!format) return undefined;

    switch (format) {
      case "A4":
      case "A3":
        return format; // passt direkt
      case "Letter":
        return "A4"; // oder eigenes Mapping
      case "Legal":
        return "A4"; // oder "A3" je nach Wunsch
      default:
        return undefined;
    }
  }

  private mmToPt(mm: number): number {
    return mm * 2.83465;
  }

  private hasThreats(): boolean {
    return this.getThreats().length > 0;
  }

  private hasRisks(): boolean {
    return this.getRisks().length > 0;
  }

  private chapterHasContent(chapterId: string): boolean {
    switch (chapterId) {
      case "executive-summary":
        return true;
      case "regulations":
        // Regulations not yet in DocProjectData
        return false;
      case "system-overview":
        return true;
      case "dfd":
        return this.project.dfd !== null;
      case "assets":
        return this.getAssets().length > 0;
      case "threats":
        return this.hasThreats();
      case "risks":
        return this.hasRisks();
      case "accepted-risks":
        return this.getWontRisks().length > 0;
      case "appendix":
        return true;
      default:
        return false;
    }
  }

  private calculateRiskLevel(likelihood: string, impact: string): string {
    // Simplified risk calculation
    const likelihoodValue = this.getLikelihoodValue(likelihood);
    const impactValue = this.getImpactValue(impact);
    const riskValue = likelihoodValue * impactValue;

    if (riskValue >= 15) return "Critical";
    if (riskValue >= 10) return "High";
    if (riskValue >= 5) return "Medium";
    return "Low";
  }

  private getLikelihoodValue(likelihood: string): number {
    const map: { [key: string]: number } = {
      rare: 1,
      unlikely: 2,
      possible: 3,
      likely: 4,
      certain: 5,
    };
    return map[likelihood?.toLowerCase()] || 0;
  }

  private getImpactValue(impact: string): number {
    const map: { [key: string]: number } = {
      negligible: 1,
      minor: 2,
      moderate: 3,
      major: 4,
      catastrophic: 5,
    };
    return map[impact?.toLowerCase()] || 0;
  }

  private getRiskColor(riskLevel: string): string {
    const colors: { [key: string]: string } = {
      Critical: "#fecaca",
      High: "#fed7aa",
      Medium: "#fef08a",
      Low: "#bbf7d0",
    };
    return colors[riskLevel] || "#f1f5f9";
  }

  /** ISO risk value 1–5 → pale fill (5 critical … 1 minimal); none → no fill. */
  private getIsoRiskFill(value: number | undefined): string | undefined {
    if (!value) return undefined;
    return ["#bbf7d0", "#fef08a", "#fed7aa", "#fecaca", "#f5d0fe"][value - 1];
  }

  private getRiskColorByValue(riskValue: number): string {
    // Map numeric risk values to colors
    if (riskValue >= 4) return "#fecaca"; // Critical/Red
    if (riskValue >= 3) return "#fed7aa"; // High/Orange
    if (riskValue >= 2) return "#fef08a"; // Medium/Yellow
    return "#bbf7d0"; // Low/Green
  }

  private getClassificationColor(classification: string): string {
    const colors: { [key: string]: string } = {
      public: "#166534",
      internal: "#1e40af",
      confidential: "#92400e",
      restricted: "#991b1b",
    };
    return colors[classification] || "#64748b";
  }
}