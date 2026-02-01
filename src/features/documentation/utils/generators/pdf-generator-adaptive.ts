// ==================== ADAPTIVE PDF GENERATOR ====================
// Automatically selects best PDF generation method based on environment
// Location: features/documentation/utils/generators/pdf-generator-adaptive.ts
//
// - In Electron: Uses Puppeteer (best quality, via IPC)
// - In Browser: Uses pdfMake (native PDF generation)
// - Fallback: Browser print dialog
//
// Usage:
//   const generator = new PdfGeneratorAdaptive(project, config, t);
//   const blob = await generator.generatePdfBuffer();

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type DocumentGeneratorResult,
  type ChapterContent,
} from "./base-generator";
import { HtmlGenerator } from "./html-generator";
import { PdfMakeConverter } from "./pdfmake-converter";

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
  /** Header template (HTML) - only for Puppeteer */
  headerTemplate?: string;
  /** Footer template (HTML) - only for Puppeteer */
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

// ==================== GENERATION METHOD ====================

export type PdfGenerationMethod = "puppeteer" | "pdfmake" | "print";

// ==================== ADAPTIVE PDF GENERATOR ====================

export class PdfGeneratorAdaptive extends BaseDocumentGenerator {
  private htmlGenerator: HtmlGenerator;
  private pdfMakeConverter: PdfMakeConverter;
  private pdfOptions: PdfOptions;

  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
    pdfOptions?: Partial<PdfOptions>,
  ) {
    super(project, config, t);
    this.htmlGenerator = new HtmlGenerator(project, config, t);
    this.pdfMakeConverter = new PdfMakeConverter(project, config, t);
    this.pdfOptions = { ...DEFAULT_PDF_OPTIONS, ...pdfOptions };
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "pdf";
  }

  getFileExtension(): string {
    return "pdf";
  }

  // ==================== ENVIRONMENT DETECTION ====================

  /**
   * Check which PDF generation method is available
   */
  getAvailableMethod(): PdfGenerationMethod {
    // Check if Electron PDF API is available
    if (typeof window !== "undefined" && window.pdf) {
      return "puppeteer";
    }

    // Check if pdfMake is available (will be loaded dynamically)
    return "pdfmake";
  }

  /**
   * Check if high-quality PDF generation is available
   */
  isHighQualityAvailable(): boolean {
    return this.getAvailableMethod() === "puppeteer";
  }

  // ==================== MAIN GENERATE ====================

  /**
   * Generate PDF document
   * Returns HTML for Puppeteer path, instructions for pdfMake path
   */
  generate(): DocumentGeneratorResult {
    const htmlResult = this.htmlGenerator.generate();

    return {
      content: htmlResult.content,
      format: "pdf",
      filename: this.generateFilename(),
    };
  }

  // ==================== PDF GENERATION ====================

  /**
   * Generate PDF buffer using best available method
   *
   * @returns Buffer (Puppeteer) or Blob (pdfMake)
   */
  async generatePdfBuffer(): Promise<Buffer | Blob> {
    const method = this.getAvailableMethod();

    switch (method) {
      case "puppeteer":
        return this.generateWithPuppeteer();
      case "pdfmake":
        return this.generateWithPdfMake();
      default:
        throw new Error("No PDF generation method available");
    }
  }

  /**
   * Generate PDF and save to file
   *
   * @param outputPath - Path where to save (only for Puppeteer)
   */
  async generatePdfFile(outputPath?: string): Promise<void> {
    const method = this.getAvailableMethod();

    if (method === "puppeteer") {
      if (!outputPath) {
        throw new Error("Output path required for Puppeteer method");
      }
      await this.generatePuppeteerFile(outputPath);
    } else {
      throw new Error(
        "File generation only supported in Electron (use generatePdfBuffer + save)",
      );
    }
  }

  /**
   * Open browser print dialog as fallback
   */
  openPrintDialog(): void {
    const html = this.htmlGenerator.generate().content;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Failed to open print window (popup blocked?)");
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait a bit for content to load, then open print dialog
    printWindow.addEventListener("load", () => {
      printWindow.print();
    });
  }

  // ==================== PUPPETEER (ELECTRON) ====================

  private async generateWithPuppeteer(): Promise<Buffer> {
    if (!window.pdf) {
      throw new Error("Puppeteer PDF API not available");
    }

    const html = this.htmlGenerator.generate().content;
    const options = this.getPuppeteerOptions();

    const result = await window.pdf.generateBuffer(html, options);

    if (!result.success) {
      throw new Error(result.error || "PDF generation failed");
    }

    return result.data!;
  }

  private async generatePuppeteerFile(outputPath: string): Promise<void> {
    if (!window.pdf) {
      throw new Error("Puppeteer PDF API not available");
    }

    const html = this.htmlGenerator.generate().content;
    const options = this.getPuppeteerOptions();

    const result = await window.pdf.generateFile(html, options, outputPath);

    if (!result.success) {
      throw new Error(result.error || "PDF generation failed");
    }
  }

  private getPuppeteerOptions(): object {
    const { lang } = this.ctx;
    const { project, config } = this.ctx;

    const headerTemplate = this.pdfOptions.displayHeaderFooter
      ? this.getHeaderFooterTemplate(
          "header",
          project.info.name,
          config.template.classification,
        )
      : undefined;

    const footerTemplate = this.pdfOptions.displayHeaderFooter
      ? this.getHeaderFooterTemplate("footer")
      : undefined;

    return {
      format: this.pdfOptions.format,
      landscape: this.pdfOptions.landscape,
      margin: {
        top: `${this.pdfOptions.margin?.top || 20}mm`,
        right: `${this.pdfOptions.margin?.right || 15}mm`,
        bottom: `${this.pdfOptions.margin?.bottom || 20}mm`,
        left: `${this.pdfOptions.margin?.left || 15}mm`,
      },
      displayHeaderFooter: this.pdfOptions.displayHeaderFooter,
      headerTemplate,
      footerTemplate,
      printBackground: this.pdfOptions.printBackground,
      scale: this.pdfOptions.scale,
    };
  }

  // ==================== PDFMAKE (BROWSER) ====================

  private async generateWithPdfMake(): Promise<Blob> {
    // Dynamic import to avoid bundling pdfMake when not needed
    const pdfMake = await import("pdfmake/build/pdfmake");
    const pdfFonts = await import("pdfmake/build/vfs_fonts");

    // Initialize fonts - handle different pdfMake versions
    // Try different possible structures for compatibility
    const vfs =
      (pdfFonts as any).pdfFonts?.pdfMake?.vfs || // Older versions
      (pdfFonts as any).default?.pdfMake?.vfs || // Some versions
      (pdfFonts as any).vfs || // Newer versions
      pdfFonts; // Direct export

    if (vfs) {
      (pdfMake.default as any).vfs = vfs;
    } else {
      console.warn("Could not initialize pdfMake fonts - vfs not found");
    }

    // Generate document definition
    const docDefinition = this.pdfMakeConverter.createDocumentDefinition(
      this.pdfOptions,
    );

    // Create PDF
    return new Promise((resolve, reject) => {
      try {
        const pdf = pdfMake.default.createPdf(docDefinition as any);
        pdf.getBlob((blob: Blob) => resolve(blob));
      } catch (error) {
        reject(error);
      }
    });
  }

  // ==================== HEADER/FOOTER TEMPLATES ====================

  private getHeaderFooterTemplate(
    type: "header" | "footer",
    projectName?: string,
    classification?: string,
  ): string {
    const { lang } = this.ctx;

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

    // Footer
    const dateStr = new Date().toLocaleDateString(
      lang === "de" ? "de-DE" : "en-US",
    );
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
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
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

  getDfdElementOverviewTableTemplate(): string {
    return this.htmlGenerator.getDfdElementOverviewTableTemplate();
  }

  getElementOverviewRowTemplate(): string {
    return this.htmlGenerator.getElementOverviewRowTemplate();
  }

  getDfdElementDetailedEntryTemplate(): string {
    return this.htmlGenerator.getDfdElementDetailedEntryTemplate();
  }

  getDfdConnectionDetailedEntryTemplate(): string {
    return this.htmlGenerator.getDfdConnectionDetailedEntryTemplate();
  }

  getPropertyGroupTemplate(): string {
    return this.htmlGenerator.getPropertyGroupTemplate();
  }

  getPropertyEntryTemplate(): string {
    return this.htmlGenerator.getPropertyEntryTemplate();
  }

  getAssetElementRelationsTemplate(): string {
    return this.htmlGenerator.getAssetElementRelationsTemplate();
  }

  getAssetRelationSectionTemplate(): string {
    return this.htmlGenerator.getAssetRelationSectionTemplate();
  }

  getElementRelationEntryTemplate(): string {
    return this.htmlGenerator.getElementRelationEntryTemplate();
  }

  getNoAssetRelationsTemplate(): string {
    return this.htmlGenerator.getNoAssetRelationsTemplate();
  }

  getFooterTemplate(): string {
    return this.htmlGenerator.getFooterTemplate();
  }
}