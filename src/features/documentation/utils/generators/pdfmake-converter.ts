// ==================== PDFMAKE CONVERTER ====================
// Converts TARAflow project data to pdfMake document definition
// Location: features/documentation/utils/generators/pdfmake-converter.ts
//
// This converter transforms our structured data into pdfMake's declarative format
// pdfMake Documentation: http://pdfmake.org/

import type { TDocumentDefinitions, Content, TableCell, Style, PageSize } from "pdfmake/interfaces";
import type { DocConfiguration, DocProjectData, DocLanguage } from "../../models/doc-types";
import { formatDocDate } from "../../models/doc-types";
import type { DFDElement } from "../../../dfd/models/dfd-types";
import { getSecurityLevelText, getTrustLevelText } from "../../../dfd/models/dfd-types";
import type { TranslationFn } from "./base-generator";
import type { PdfOptions } from "./pdf-generator-adaptive";

// ==================== PDFMAKE CONVERTER ====================

export class PdfMakeConverter {
  private project: DocProjectData;
  private config: DocConfiguration;
  private t: TranslationFn;
  private lang: DocLanguage;

  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn
  ) {
    this.project = project;
    this.config = config;
    this.t = t;
    this.lang = config.language;
  }

  // ==================== DATA ACCESS HELPERS ====================

  private getAssets() {
    return this.project.assets?.assets ?? [];
  }

  private getThreats() {
    const perElementTables = this.project.threats?.perElementTables ?? [];
    const perInteractionTables = this.project.threats?.perInteractionTables ?? [];
    return [
      ...perElementTables.flatMap(t => t.threats),
      ...perInteractionTables.flatMap(t => t.threats)
    ];
  }

  private getThreatsPerElement() {
    const tables = this.project.threats?.perElementTables ?? [];
    return tables.flatMap(t => t.threats);
  }

  private getThreatsPerInteraction() {
    const tables = this.project.threats?.perInteractionTables ?? [];
    return tables.flatMap(t => t.threats);
  }

  private getRisks() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(r => r.moscowPriority !== "wont");
  }

  private getRisksPerElement() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(
      r => r.sourceStrideMethod === "per-element" && r.moscowPriority !== "wont"
    );
  }

  private getRisksPerInteraction() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(
      r => r.sourceStrideMethod === "per-interaction" && r.moscowPriority !== "wont"
    );
  }

  private getWontRisks() {
    const allRisks = this.project.risks?.risks ?? [];
    return allRisks.filter(r => r.moscowPriority === "wont");
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
        case "risks-per-element":
        case "risks-per-interaction":
          if (this.hasRisks()) {
            content.push(...this.createRisks());
          }
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
      header: (currentPage, pageCount) => this.createHeader(currentPage, pageCount),
      footer: (currentPage, pageCount) => this.createFooter(currentPage, pageCount),
    };
  }

  // ==================== COVER PAGE ====================

  private createCoverPage(): Content[] {
    const classification = this.config.template.classification || "internal";
    const classificationLabel = this.t(`common.classification.${classification}`);

    return [
      {
        text: this.project.info.name,
        style: "coverTitle",
        margin: [0, 100, 0, 20],
      },
      {
        text: this.t("doc.title"),
        style: "coverSubtitle",
        margin: [0, 0, 0, 10],
      },
      {
        text: this.project.info.version
          ? `${this.t("doc.version")}: ${this.project.info.version}`
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
              { text: this.t("doc.meta.date"), style: "metaLabel" },
              { text: formatDocDate(new Date(), this.config.template.dateFormat), style: "metaValue" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: this.t("doc.meta.author"), style: "metaLabel" },
              { text: this.project.info.responsible || "-", style: "metaValue" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: this.t("doc.meta.classification"), style: "metaLabel" },
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
      text: this.t("doc.toc.title"),
      style: "h1",
      tocItem: false,
    });

    const chapters = this.config.chapters.filter((c) => c.enabled);

    for (const chapter of chapters) {
      const hasContent = this.chapterHasContent(chapter.id);
      if (hasContent) {
        tocItems.push({
          text: this.t(`doc.chapters.${chapter.id}.title`),
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
      text: this.t("doc.chapters.executive-summary.title"),
      style: "h1",
      tocItem: true,
    });

    // Basic project description
    if (this.project.info.description) {
      content.push({
        text: this.t("doc.chapters.executive-summary.overview"),
        style: "h2",
      });
      content.push({
        text: this.project.info.description,
        margin: [0, 0, 0, 15],
      });
    }

    // Analysis statistics
    content.push({
      text: this.t("doc.chapters.executive-summary.results"),
      style: "h2",
    });

    const tableBody: TableCell[][] = [
      [
        { text: this.t("doc.meta.metric"), style: "tableHeader" },
        { text: this.t("doc.meta.value"), style: "tableHeader" },
      ],
      [
        { text: this.t("doc.stats.assets") },
        { text: this.getAssets().length.toString(), alignment: "center" },
      ],
      [
        { text: this.t("doc.stats.threats") },
        { text: this.getThreats().length.toString(), alignment: "center" },
      ],
      [
        { text: this.t("doc.stats.risks") },
        { text: this.getRisks().length.toString(), alignment: "center" },
      ],
      [
        { text: this.t("doc.stats.acceptedRisks") },
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
      text: this.t("doc.chapters.system-overview.title"),
      style: "h1",
      tocItem: true,
    });

    if (this.project.info.description) {
      content.push({
        text: this.t("doc.chapters.system-overview.description"),
        style: "h2",
      });
      content.push({
        text: this.project.info.description,
        margin: [0, 0, 0, 15],
      });
    }

    // Tags
    if (this.project.info.tags && this.project.info.tags.length > 0) {
      content.push({
        text: this.t("doc.chapters.system-overview.tags"),
        style: "h2",
      });

      content.push({
        text: this.project.info.tags.join(", "),
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
      text: this.t("doc.chapters.dfd.title"),
      style: "h1",
      tocItem: true,
    });

    // DFD image placeholder
    if (this.project.dfd?.thumbnail) {
      content.push({
        image: this.project.dfd.thumbnail,
        width: 500,
        margin: [0, 0, 0, 20],
      });
    } else {
      content.push({
        text: this.t("doc.chapters.dfd.noDiagram"),
        style: "placeholder",
        margin: [0, 0, 0, 20],
      });
    }

    // DFD Elements
    const elements = this.project.dfd?.elements ?? [];
    if (elements.length > 0) {
      content.push({
        text: this.t("doc.chapters.dfd.elements"),
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
      text: this.t("doc.chapters.assets.title"),
      style: "h1",
      tocItem: true,
    });

    const tableBody: TableCell[][] = [
      // Header
      [
        { text: this.t("doc.chapters.assets.table.id"), style: "tableHeader" },
        { text: this.t("doc.chapters.assets.table.name"), style: "tableHeader" },
        { text: this.t("doc.chapters.assets.table.description"), style: "tableHeader" },
        { text: this.t("doc.chapters.assets.table.impact"), style: "tableHeader" },
        { text: this.t("doc.chapters.assets.table.goals"), style: "tableHeader" },
      ],
    ];

    for (const asset of this.getAssets()) {
      // Filter enabled security goals
      const enabledGoals = asset.securityGoals
        .filter(g => g.enabled)
        .map(g => g.type)
        .join(", ") || "-";
      
      // Get impact label from cache or fallback to value
      const impactLabel = this.project.computed.impactLabels.get(asset.id) ?? 
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

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== THREATS ====================

  private createThreats(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.t("doc.chapters.threats.title"),
      style: "h1",
      tocItem: true,
    });

    // Determine which method has threats
    const threatsPerElement = this.getThreatsPerElement();
    const threatsPerInteraction = this.getThreatsPerInteraction();
    
    const method = threatsPerElement.length > 0 ? "per-element" : "per-interaction";
    const threats = method === "per-element" ? threatsPerElement : threatsPerInteraction;

    const tableBody: TableCell[][] = [
      // Header
      [
        { text: this.t("doc.chapters.threats.table.id"), style: "tableHeader" },
        { text: this.t("doc.chapters.threats.table.element"), style: "tableHeader" },
        { text: this.t("doc.chapters.threats.table.category"), style: "tableHeader" },
        { text: this.t("doc.chapters.threats.table.description"), style: "tableHeader" },
        { text: this.t("doc.chapters.threats.table.mitigation"), style: "tableHeader" },
      ],
    ];

    for (const threat of threats) {
      // Get STRIDE name from cache
      const strideName = this.project.computed.strideNames.get(threat.strideCategory) ?? 
                        threat.strideCategory;
      
      // Get element or flow name
      const elementOrFlow = threat.linkedElement?.elementName || 
                           threat.dataFlow?.dataFlowName ||
                           "-";
      
      tableBody.push([
        { text: threat.id },
        { text: elementOrFlow },
        { text: strideName },
        { text: threat.threatDescription || "-" },
        {
          text:
            (threat.proposedMitigations ?? [])
              .map((m) => m.id ?? m.notes ?? "")
              .filter(Boolean)
              .join(", ") || "-",
        },
      ]);
    }

    content.push({
      table: {
        headerRows: 1,
        widths: [50, "*", 60, "*", "*"],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== RISKS ====================

  private createRisks(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.t("doc.chapters.risks.title"),
      style: "h1",
      tocItem: true,
    });

    // Determine which method has risks
    const risksPerElement = this.getRisksPerElement();
    const risksPerInteraction = this.getRisksPerInteraction();
    
    const method = risksPerElement.length > 0 ? "per-element" : "per-interaction";
    const risks = method === "per-element" ? risksPerElement : risksPerInteraction;

    const tableBody: TableCell[][] = [
      // Header
      [
        { text: this.t("doc.chapters.risks.table.id"), style: "tableHeader" },
        { text: this.t("doc.chapters.risks.table.threat"), style: "tableHeader" },
        { text: this.t("doc.chapters.risks.table.riskBefore"), style: "tableHeader" },
        { text: this.t("doc.chapters.risks.table.mitigation"), style: "tableHeader" },
        { text: this.t("doc.chapters.risks.table.riskAfter"), style: "tableHeader" },
        { text: this.t("doc.chapters.risks.table.moscow"), style: "tableHeader" },
      ],
    ];

    for (const risk of risks) {
      // Get labels from cache
      const riskBeforeLabel = this.project.computed.riskBeforeLabels.get(risk.id) ?? 
                             risk.calculatedRiskBeforeMitigation.toString();
      const riskAfterLabel = this.project.computed.riskAfterLabels.get(risk.id) ?? 
                            risk.calculatedRiskAfterMitigation.toString();
      const moscowLabel = this.project.computed.moscowLabels.get(risk.moscowPriority) ?? 
                         risk.moscowPriority;
      
      // Format mitigations
      const mitigations = risk.selectedMitigations.join(", ") || "-";
      
      tableBody.push([
        { text: risk.id },
        { text: risk.threatId },
        { 
          text: riskBeforeLabel, 
          alignment: "center",
          fillColor: this.getRiskColorByValue(risk.calculatedRiskBeforeMitigation)
        },
        { text: mitigations },
        { 
          text: riskAfterLabel, 
          alignment: "center",
          fillColor: this.getRiskColorByValue(risk.calculatedRiskAfterMitigation)
        },
        { text: moscowLabel, alignment: "center" },
      ]);
    }

    content.push({
      table: {
        headerRows: 1,
        widths: [50, 60, 50, "*", 50, 50],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });

    content.push({ text: "", pageBreak: "after" });

    return content;
  }

  // ==================== ACCEPTED RISKS ====================

  private createAcceptedRisks(): Content[] {
    const content: Content[] = [];

    content.push({
      text: this.t("doc.chapters.accepted-risks.title"),
      style: "h1",
      tocItem: true,
    });

    const tableBody: TableCell[][] = [
      // Header
      [
        { text: this.t("doc.chapters.accepted-risks.table.id"), style: "tableHeader" },
        { text: this.t("doc.chapters.accepted-risks.table.description"), style: "tableHeader" },
        { text: this.t("doc.chapters.accepted-risks.table.justification"), style: "tableHeader" },
      ],
    ];

    for (const risk of this.getWontRisks()) {
      tableBody.push([
        { text: risk.id },
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
      text: this.t("doc.chapters.appendix.title"),
      style: "h1",
      tocItem: true,
    });

    content.push({
      text: this.t("doc.chapters.appendix.generatedBy"),
      margin: [0, 0, 0, 5],
    });

    content.push({
      text: `TARAflow ${this.config.template.customVersion || "1.0"}`,
      bold: true,
      margin: [0, 0, 0, 10],
    });

    const dateStr = formatDocDate(new Date(), this.config.template.dateFormat);
    content.push({
      text: `${this.t("doc.meta.date")}: ${dateStr}`,
      margin: [0, 0, 0, 20],
    });

    return content;
  }

  // ==================== HEADER/FOOTER ====================

  private createHeader(currentPage: number, pageCount: number): Content {
    if (currentPage === 1) return { text: "" }; // No header on cover page

    const classification = this.config.template.classification || "internal";
    const classificationLabel = this.t(`common.classification.${classification}`);

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
          text: this.t("doc.title"),
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

  private getRiskColorByValue(riskValue: number): string {
    // Map numeric risk values to colors
    if (riskValue >= 4) return "#fecaca";   // Critical/Red
    if (riskValue >= 3) return "#fed7aa";   // High/Orange
    if (riskValue >= 2) return "#fef08a";   // Medium/Yellow
    return "#bbf7d0";                       // Low/Green
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