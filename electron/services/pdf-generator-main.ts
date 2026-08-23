// electron/services/pdf-generator-main.ts
//
// PDF generation using Electron's built-in Chromium (webContents.printToPDF).
// Replaces the previous Puppeteer-based implementation, which bundled a second
// full Chromium (~300 MB on disk, ~1.2 GB in the download cache). Electron
// already ships a Chromium, so we render the report HTML in a hidden
// BrowserWindow and print it to PDF from there.
//
// The exported API (generatePdfBuffer / generatePdfFile / the "generate-pdf"
// IPC handler) is unchanged, so neither main.ts nor the renderer need edits.

import { BrowserWindow } from "electron";
import fs from "fs/promises";
import os from "os";
import path from "path";

// Options interface kept identical to the previous Puppeteer version so all
// callers keep working without changes.
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

const MM_PER_INCH = 25.4;

// Electron's printToPDF expects margins in inches; our public API uses
// millimetres (as Puppeteer's "20mm" strings did), so convert here.
function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export async function generatePdfBuffer(
  html: string,
  options: PdfOptions = {},
): Promise<Buffer> {
  // Hidden window used purely to render the report HTML. Locked down because
  // it renders generated document content: no Node access, sandboxed, isolated.
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Allow local images/fonts referenced by the report to load.
      webSecurity: true,
    },
  });

  // Large reports can exceed practical data:-URL limits, so stage the HTML in a
  // temp file and load it from disk. Cleaned up in the finally block.
  const tmpFile = path.join(
    os.tmpdir(),
    `taraflow-report-${Date.now()}-${Math.random().toString(36).slice(2)}.html`,
  );

  try {
    await fs.writeFile(tmpFile, html, "utf-8");
    await win.loadFile(tmpFile);

    // Mirror Puppeteer's "networkidle0" intent: give late-loading resources
    // (web fonts, inlined images) a brief moment to settle before printing.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const margin = options.margin ?? {};

    const pdfData = await win.webContents.printToPDF({
      pageSize: options.format ?? "A4",
      landscape: options.landscape ?? false,
      printBackground: options.printBackground ?? true,
      scale: options.scale ?? 1,
      displayHeaderFooter: options.displayHeaderFooter ?? true,
      // Pass empty strings (not undefined) so Chromium does not fall back to its
      // built-in default header/footer when display is enabled.
      headerTemplate: options.headerTemplate ?? "",
      footerTemplate: options.footerTemplate ?? "",
      margins: {
        top: mmToInches(margin.top ?? 20),
        right: mmToInches(margin.right ?? 15),
        bottom: mmToInches(margin.bottom ?? 20),
        left: mmToInches(margin.left ?? 15),
      },
    });

    // printToPDF already returns a Buffer.
    return pdfData;
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
    // Best-effort cleanup; a leftover temp file must never fail PDF generation.
    await fs.unlink(tmpFile).catch(() => {});
  }
}

export async function generatePdfFile(
  html: string,
  options: PdfOptions,
  outputPath: string,
): Promise<void> {
  const buffer = await generatePdfBuffer(html, options);
  await fs.writeFile(outputPath, buffer as unknown as Uint8Array);
}