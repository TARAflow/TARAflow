// electron/pdf-generator-main.ts
import { ipcMain } from "electron";
import puppeteer from "puppeteer";
import fs from "fs/promises";

// Optionen Interface übernehmen
export interface PdfOptions {
  format?: "A4" | "A3" | "Letter" | "Legal";
  landscape?: boolean;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  scale?: number;
}

export async function generatePdfBuffer(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: options.format || "A4",
      landscape: options.landscape || false,
      margin: {
        top: options.margin?.top ? `${options.margin.top}mm` : "20mm",
        right: options.margin?.right ? `${options.margin.right}mm` : "15mm",
        bottom: options.margin?.bottom ? `${options.margin.bottom}mm` : "20mm",
        left: options.margin?.left ? `${options.margin.left}mm` : "15mm",
      },
      displayHeaderFooter: options.displayHeaderFooter ?? true,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      printBackground: options.printBackground ?? true,
      scale: options.scale ?? 1,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function generatePdfFile(html: string, options: PdfOptions, outputPath: string) {
  const buffer = await generatePdfBuffer(html, options);
  await fs.writeFile(outputPath, buffer as unknown as Uint8Array);
}

// ==================== IPC Handler ====================
ipcMain.handle("generate-pdf", async (_event, html: string, options: PdfOptions) => {
  return await generatePdfBuffer(html, options);
});
