// electron/ipc/pdf-handlers.ts
// ==================== PDF GENERATION ====================

import { ipcMain } from "electron";
import {
  generatePdfBuffer,
  generatePdfFile,
} from "../services/pdf-generator-main";

export function registerPdfHandlers() {
  // Generate PDF buffer from HTML
  ipcMain.handle(
    "pdf:generateBuffer",
    async (_, html: string, puppeteerOptions: object) => {
      try {
        const buffer = await generatePdfBuffer(html, puppeteerOptions);
        return { success: true, data: buffer };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // Generate PDF file and save
  ipcMain.handle(
    "pdf:generateFile",
    async (_, html: string, puppeteerOptions: object, outputPath: string) => {
      try {
        await generatePdfFile(html, puppeteerOptions, outputPath);
        return { success: true, data: outputPath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );
}