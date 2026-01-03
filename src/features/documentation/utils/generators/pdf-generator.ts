// ==================== PDF DOCUMENT GENERATOR ====================
// Generates PDF documents using HTML as intermediate format and puppeteer for rendering
// Location: features/documentation/utils/generators/pdf-generator.ts
//
// Dependencies:
// - puppeteer or playwright for PDF generation
// - Install: npm install puppeteer
//
// Note: This generator works differently than others:
// - It first generates HTML content
// - Then uses a headless browser to render PDF

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
   * Note: This returns an object with the HTML content and instructions.
   * The actual PDF generation must happen in a Node.js environment with puppeteer.
   * 
   * For browser environments, use generateHtml() and send to a backend service.
   */
  generate(): DocumentGeneratorResult {
    // Generate HTML first
    const htmlResult = this.htmlGenerator.generate();

    // Return HTML with PDF metadata
    // The actual PDF conversion should be done by the caller
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
   * Get puppeteer options for PDF generation
   */
  getPuppeteerOptions(): object {
    const { lang } = this.ctx;
    const { project, config } = this.ctx;

    const headerTemplate = this.pdfOptions.displayHeaderFooter
      ? this.getHeaderFooterTemplate("header", lang, project.info.name, config.template.classification)
      : undefined;

    const footerTemplate = this.pdfOptions.displayHeaderFooter
      ? this.getHeaderFooterTemplate("footer", lang)
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

    // Footer
    const dateStr = formatDocDate(new Date(), this.ctx.config.template.dateFormat);
    return `
      ${styles}
      <div class="hf-container">
        <span>CoReTM 2.0</span>
        <span>${dateStr}</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `;
  }

  // ==================== TEMPLATE GETTERS (delegated to HTML) ====================
  // These are required by base class but we delegate to HtmlGenerator

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
    // Delegated to HTML generator via generate()
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

// ==================== PDF GENERATION UTILITY ====================

/**
 * Generate PDF from HTML using puppeteer
 * 
 * This function must be called in a Node.js environment with puppeteer installed.
 * 
 * @example
 * ```typescript
 * import { generatePdfBuffer } from "./pdf-generator";
 * 
 * const generator = new PdfGenerator(project, config, t);
 * const html = generator.generateHtml();
 * const options = generator.getPuppeteerOptions();
 * 
 * const pdfBuffer = await generatePdfBuffer(html, options);
 * fs.writeFileSync("document.pdf", pdfBuffer);
 * ```
 */
export async function generatePdfBuffer(
  html: string,
  puppeteerOptions: object
): Promise<Buffer> {
  // Dynamic import to avoid bundling puppeteer in browser builds
  const puppeteer = await import("puppeteer");
  
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    // Generate PDF
    const pdfBuffer = await page.pdf(puppeteerOptions as any);

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF and save to file
 */
export async function generatePdfFile(
  html: string,
  puppeteerOptions: object,
  outputPath: string
): Promise<void> {
  const fs = await import("fs/promises");
  const buffer = await generatePdfBuffer(html, puppeteerOptions);
  await fs.writeFile(outputPath, buffer);
}
