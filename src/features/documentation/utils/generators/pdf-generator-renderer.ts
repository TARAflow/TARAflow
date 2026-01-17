// ==================== PDF DOCUMENT GENERATOR (Renderer) ====================
// Generates PDF documents using HTML as intermediate format
// Location: features/documentation/utils/generators/pdf-generator-renderer.ts
//
// Note: This is the RENDERER-SIDE implementation
// - Generates HTML content
// - Communicates with Main process via IPC for actual PDF generation
// - NO puppeteer imports (those are in electron/pdf-generator-main.ts)

import type { DocConfiguration, DocProjectData, DocLanguage } from "../../models/doc-types";
import { formatDocDate } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type DocumentGeneratorResult,
  type ChapterContent,
} from "./base-generator";
import { HtmlGenerator } from "./html-generator";

// ==================== PDF OPTIONS ====================

export interface PdfOptions {
  /** Page format */
  format?: "A4" | "A3" | "Letter" | "Legal";
  /** Landscape orientation */
  landscape?: boolean;
  /** Page margins in mm */
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  /** Display header and footer */
  displayHeaderFooter?: boolean;
  /** Header template (HTML) */
  headerTemplate?: string;
  /** Footer template (HTML) */
  footerTemplate?: string;
  /** Print background graphics */
  printBackground?: boolean;
  /** Scale of the webpage rendering (0.1 - 2) */
  scale?: number;
}

const DEFAULT_PDF_OPTIONS: PdfOptions = {
  format: "A4",
  landscape: false,
  margin: {
    top: 20,
    right: 15,
    bottom: 20,
    left: 15,
  },
  displayHeaderFooter: true,
  printBackground: true,
  scale: 1,
};

// ==================== PDF GENERATOR ====================

export class PdfGenerator extends BaseDocumentGenerator {
  private htmlGenerator: HtmlGenerator;
  private pdfOptions: PdfOptions;

  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
    pdfOptions?: Partial<PdfOptions>
  ) {
    super(project, config, t);
    this.htmlGenerator = new HtmlGenerator(project, config, t);
    this.pdfOptions = { ...DEFAULT_PDF_OPTIONS, ...pdfOptions };
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "pdf";
  }

  getFileExtension(): string {
    return "pdf";
  }

  // ==================== MAIN GENERATE ====================

  /**
   * Generate PDF document
   * 
   * Returns HTML content that can be converted to PDF via IPC
   */
  generate(): DocumentGeneratorResult {
    const htmlResult = this.htmlGenerator.generate();

    return {
      content: htmlResult.content,
      format: "pdf",
      filename: this.generateFilename(),
    };
  }

  /**
   * Get the HTML content for PDF generation
   */
  generateHtml(): string {
    const result = this.htmlGenerator.generate();
    return result.content;
  }

  /**
   * Get PDF options for Main process generation
   */
  getPdfOptions(): PdfOptions {
    const { lang } = this.ctx;
    const { project, config } = this.ctx;

    const headerTemplate = this.pdfOptions.displayHeaderFooter
      ? this.getHeaderFooterTemplate("header", lang, project.info.name, config.template.classification)
      : undefined;

    const footerTemplate = this.pdfOptions.displayHeaderFooter
      ? this.getHeaderFooterTemplate("footer", lang)
      : undefined;

    return {
      ...this.pdfOptions,
      headerTemplate,
      footerTemplate,
    };
  }

  /**
   * Generate PDF buffer via Electron IPC
   * 
   * This calls the Main process to generate the actual PDF
   */
  async generatePdfBuffer(): Promise<Buffer> {
    if (!window.pdf) {
      throw new Error("PDF API not available. Are you running in Electron?");
    }

    const html = this.generateHtml();
    const options = this.getPdfOptions();

    const result = await window.pdf.generateBuffer(html, options);

    if (!result.success) {
      throw new Error(result.error || "PDF generation failed");
    }

    return result.data!;
  }

  /**
   * Generate PDF and save to file via Electron IPC
   * 
   * @param outputPath - Path where to save the PDF file
   */
  async generatePdfFile(outputPath: string): Promise<void> {
    if (!window.pdf) {
      throw new Error("PDF API not available. Are you running in Electron?");
    }

    const html = this.generateHtml();
    const options = this.getPdfOptions();

    const result = await window.pdf.generateFile(html, options, outputPath);

    if (!result.success) {
      throw new Error(result.error || "PDF generation failed");
    }
  }

  private getHeaderFooterTemplate(
    type: "header" | "footer",
    lang: DocLanguage,
    projectName?: string,
    classification?: string
  ): string {
    const styles = `
      <style>
        .hf-container {
          width: 100%;
          font-size: 9px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #64748b;
          padding: 0 15mm;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .classification {
          font-weight: 600;
          text-transform: uppercase;
        }
        .classification-public { color: #166534; }
        .classification-internal { color: #1e40af; }
        .classification-confidential { color: #92400e; }
        .classification-restricted { color: #991b1b; }
      </style>
    `;

    if (type === "header") {
      const classificationHtml = classification
        ? `<span class="classification classification-${classification}">${classification.toUpperCase()}</span>`
        : "";
      
      return `
        ${styles}
        <div class="hf-container">
          <span>${projectName || ""}</span>
          ${classificationHtml}
          <span>${lang === "de" ? "Bedrohungs- und Risikoanalyse" : "Threat and Risk Analysis"}</span>
        </div>
      `;
    }

    const dateStr = formatDocDate(new Date(), this.ctx.config.template.dateFormat);
    return `
      ${styles}
      <div class="hf-container">
        <span>TARAflow 1.0</span>
        <span>${dateStr}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `;
  }

  // ==================== TEMPLATE GETTERS (delegated to HTML) ====================

  escapeTableText(text: string): string {
    return this.htmlGenerator.escapeTableText(text);
  }

  formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>
  ): string {
    return this.htmlGenerator.formatTagsGrouped(tagsByCategory);
  }

  formatClassification(text: string): string {
    return this.htmlGenerator.formatClassification(text);
  }

  protected generateTocContent(chapters: ChapterContent[]): string {
    return "";
  }

  getHeaderTemplate(): string {
    return this.htmlGenerator.getHeaderTemplate();
  }

  getTocTemplate(): string {
    return this.htmlGenerator.getTocTemplate();
  }

  getExecutiveSummaryTemplate(): string {
    return this.htmlGenerator.getExecutiveSummaryTemplate();
  }

  getApplicableRegulationsTemplate(): string {
    return this.htmlGenerator.getApplicableRegulationsTemplate();
  }

  getRegulationEntryTemplate(): string {
    return this.htmlGenerator.getRegulationEntryTemplate();
  }

  getSystemOverviewTemplate(): string {
    return this.htmlGenerator.getSystemOverviewTemplate();
  }

  getDfdTemplate(): string {
    return this.htmlGenerator.getDfdTemplate();
  }

  getDfdDescriptionsTemplate(): string {
    return this.htmlGenerator.getDfdDescriptionsTemplate();
  }

  getDfdElementTypeHeaderTemplate(): string {
    return this.htmlGenerator.getDfdElementTypeHeaderTemplate();
  }

  getDfdElementEntryTemplate(): string {
    return this.htmlGenerator.getDfdElementEntryTemplate();
  }

  getDfdDataFlowsHeaderTemplate(): string {
    return this.htmlGenerator.getDfdDataFlowsHeaderTemplate();
  }

  getDfdConnectionEntryTemplate(): string {
    return this.htmlGenerator.getDfdConnectionEntryTemplate();
  }

  getAssetsTemplate(): string {
    return this.htmlGenerator.getAssetsTemplate();
  }

  getAssetRowTemplate(): string {
    return this.htmlGenerator.getAssetRowTemplate();
  }

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return this.htmlGenerator.getThreatsHeaderTemplate(method);
  }

  getThreatsTableTemplate(): string {
    return this.htmlGenerator.getThreatsTableTemplate();
  }

  getThreatRowTemplate(): string {
    return this.htmlGenerator.getThreatRowTemplate();
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return this.htmlGenerator.getRisksHeaderTemplate(method);
  }

  getRisksTableTemplate(): string {
    return this.htmlGenerator.getRisksTableTemplate();
  }

  getRiskRowTemplate(): string {
    return this.htmlGenerator.getRiskRowTemplate();
  }

  getAcceptedRisksTemplate(): string {
    return this.htmlGenerator.getAcceptedRisksTemplate();
  }

  getWontRiskRowTemplate(): string {
    return this.htmlGenerator.getWontRiskRowTemplate();
  }

  getAppendixTemplate(): string {
    return this.htmlGenerator.getAppendixTemplate();
  }

  getFooterTemplate(): string {
    return this.htmlGenerator.getFooterTemplate();
  }
}