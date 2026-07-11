// features/documentation/utils/generators/pdf-generator-node.ts
//
// Phase 6 (TARAflow CLI Report Plan) — PDF generation for the CLI, without
// a headless browser (no Puppeteer, no Playwright, no Electron).
// Location: features/documentation/utils/generators/pdf-generator-node.ts
//
// KEY FINDING: pdfmake 0.3.x (installed: 0.3.2) completely reworked the
// Node API ("Unify interface for node and browser", see
// https://pdfmake.github.io/docs/0.3/getting-started/server-side/).
// The old `new PdfPrinter(fonts).createPdfKitDocument(docDefinition)`
// pattern (found in virtually every older blog post/GitHub issue) no
// longer exists in this version — require("pdfmake") now returns a
// singleton instance directly, with the same API as the browser build:
//
//   const pdfmake = require("pdfmake");
//   pdfmake.addFonts(fonts);
//   const pdf = pdfmake.createPdf(docDefinition);
//   const buffer = await pdf.getBuffer();
//
// FONT FINDING: @fontsource/roboto (already a dependency) ships ONLY
// .woff2 files — pdfmake needs .ttf/.otf file paths for addFonts().
// @fontsource/roboto is therefore NOT usable here (verified against
// npm/unpkg).
//
// SOLUTION: pdfmake/build/vfs_fonts.js — the same file pdf-generator-
// adaptive.ts uses for the browser fallback — already contains the
// Roboto .ttf bytes base64-encoded. We decode them once into temp files
// and register those paths — both with pdfmake (addFonts) and with resvg
// (fontFiles, see below). No new font dependency, same typeface as the
// browser path.
//
// SVG IMAGE FINDING (revised twice):
//   1. Using an svg: node instead of an image: node (pdfmake's built-in
//      svg-to-pdfkit) fixed "Unknown image format", but svg-to-pdfkit
//      doesn't support the full SVG feature set draw.io exports use —
//      labels were missing.
//   2. @resvg/resvg-js for actual PNG rasterization — BUT the installed
//      version (2.6.2, the real native napi library) does NOT support
//      `fontBuffers` (only `fontFiles`/`fontDirs`, file paths). The
//      `fontBuffers` examples in the official docs refer to the WASM
//      variant or a third-party fork, not this package (verified against
//      node_modules/@resvg/resvg-js/index.d.ts).
// Final solution: reuse the same temporary Roboto files we already write
// for pdfmake, also for resvg via `fontFiles` — one write, two consumers.
//
// BUILD NOTE: @resvg/resvg-js is a native library (compiled .node file) —
// esbuild cannot embed it into a single JS bundle. build:cli must
// therefore mark it as --external and copy node_modules/@resvg/*
// separately alongside dist-cli/taraflow-report.js (see package.json /
// packaging).

import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const pdfmake: any = require("pdfmake");

// ==================== FONT SETUP (shared: pdfmake + resvg) ====================

function resolveVfs(): Record<string, string> {
  const vfsFontsModule: any = require("pdfmake/build/vfs_fonts");
  // Same fallback chain as in pdf-generator-adaptive.ts, because pdfmake
  // has already changed this module's structure across major versions.
  return (
    vfsFontsModule.pdfMake?.vfs ??
    vfsFontsModule.default?.pdfMake?.vfs ??
    vfsFontsModule.vfs ??
    vfsFontsModule
  );
}

function writeFontFile(
  vfs: Record<string, string>,
  filename: string,
  dir: string,
): string {
  const base64 = vfs[filename];
  if (!base64) {
    throw new Error(
      `Font file "${filename}" not found in pdfmake/build/vfs_fonts — ` +
        `the installed pdfmake version may have changed its bundled fonts.`,
    );
  }
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Uint8Array.from(Buffer.from(base64, "base64")));
  return filePath;
}

interface RobotoFontPaths {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
}

let robotoFontPaths: RobotoFontPaths | null = null;

/** Writes the Roboto TTFs to a temp dir once; both pdfmake and resvg reuse the paths. */
function ensureFontFilesWritten(): RobotoFontPaths {
  if (robotoFontPaths) return robotoFontPaths;

  const vfs = resolveVfs();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taraflow-pdf-fonts-"));

  robotoFontPaths = {
    normal: writeFontFile(vfs, "Roboto-Regular.ttf", dir),
    bold: writeFontFile(vfs, "Roboto-Medium.ttf", dir),
    italics: writeFontFile(vfs, "Roboto-Italic.ttf", dir),
    bolditalics: writeFontFile(vfs, "Roboto-MediumItalic.ttf", dir),
  };

  return robotoFontPaths;
}

let fontsRegisteredWithPdfmake = false;

function ensureFontsRegistered(): void {
  if (fontsRegisteredWithPdfmake) return;
  pdfmake.addFonts({ Roboto: ensureFontFilesWritten() });
  fontsRegisteredWithPdfmake = true;
}

// ==================== SVG → PNG (resvg) ====================
//
// dfd.thumbnail is a base64 SVG data URL (see plan note: "no headless
// draw.io needed"). pdfmake-converter.ts (shared with the browser path,
// deliberately NOT touched here) embeds it as `{ image: dataUrl, ... }` —
// in the browser, the native Image() object rasterizes SVG automatically;
// Node has no equivalent for that. We take that over here ourselves: any
// image: node with an SVG data URL gets rasterized to a real PNG before
// PDF generation.

function decodeSvgDataUrl(dataUrl: string): string | null {
  const base64Match = dataUrl.match(/^data:image\/svg\+xml(;charset=[^;]+)?;base64,(.+)$/s);
  if (base64Match) {
    return Buffer.from(base64Match[2], "base64").toString("utf-8");
  }
  const plainMatch = dataUrl.match(/^data:image\/svg\+xml(;charset=[^;]+)?,(.+)$/s);
  if (plainMatch) {
    return decodeURIComponent(plainMatch[2]);
  }
  return null;
}

// ==================== CSS light-dark()/var() RESOLUTION ====================
//
// FINDING: draw.io exports use the modern CSS function light-dark(light,
// dark) plus CSS variables (var(--ge-dark-color, fallback)) for
// automatic light/dark switching, e.g.:
//   style="fill: light-dark(#ffffff, var(--ge-dark-color, #121212));"
// resvg/usvg doesn't know light-dark(), can't parse the value, and falls
// back to SVG's default fill (black) — hence black instead of white
// filled Process/DataStore/Interface/ExternalEntity symbols. We resolve
// both functions textually to a static (light) value before the SVG goes
// to resvg. Real paren-balancing instead of a naive regex, because values
// like "rgb(0, 0, 0)" contain commas themselves.

function findMatchingParen(s: string, openParenIdx: number): number {
  let depth = 0;
  for (let i = openParenIdx; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevelArgs(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Resolves `light-dark(light, dark)` → light value, and
 * `var(--name, fallback)` → fallback value, repeatedly until none remain
 * (handles nesting, e.g. light-dark(A, var(--x, B))). Malformed/unbalanced
 * input is left untouched rather than throwing — a rendering quirk is far
 * better than a crashed PDF generation.
 */
function resolveCssFunctions(input: string): string {
  let result = input;

  // Safety cap: a legitimate SVG has at most a few hundred such calls;
  // this just guards against a pathological input causing an infinite loop.
  for (let iterations = 0; iterations < 5000; iterations++) {
    const varIdx = result.indexOf("var(");
    const lightDarkIdx = result.indexOf("light-dark(");
    if (varIdx === -1 && lightDarkIdx === -1) break;

    const isVar = varIdx !== -1 && (lightDarkIdx === -1 || varIdx < lightDarkIdx);
    const fnName = isVar ? "var" : "light-dark";
    const startIdx = isVar ? varIdx : lightDarkIdx;
    const openParenIdx = startIdx + fnName.length;
    const closeParenIdx = findMatchingParen(result, openParenIdx);
    if (closeParenIdx === -1) break; // unbalanced — bail out safely

    const args = splitTopLevelArgs(result.slice(openParenIdx + 1, closeParenIdx));
    const replacement = isVar
      ? (args.length > 1 ? args.slice(1).join(",").trim() : "")
      : (args[0] ?? "").trim();

    result = result.slice(0, startIdx) + replacement + result.slice(closeParenIdx + 1);
  }

  return result;
}

/**
 * Rasterize SVG markup to a PNG data URL. Renders at 2x the target display
 * width for print-quality sharpness (pdfmake scales back down via the
 * node's own `width` property). Uses the same Roboto files as pdfmake as
 * the only loaded font (loadSystemFonts: false) — fully deterministic,
 * no dependency on fonts being installed in the container.
 */
function svgToPngDataUrl(svgMarkup: string, targetWidthPx?: number): string {
  const fonts = ensureFontFilesWritten();
  const cleanedSvg = resolveCssFunctions(svgMarkup);

  const resvg = new Resvg(cleanedSvg, {
    fitTo: targetWidthPx
      ? { mode: "width", value: Math.round(targetWidthPx * 2) }
      : { mode: "original" },
    font: {
      loadSystemFonts: false,
      fontFiles: [fonts.normal, fonts.bold, fonts.italics, fonts.bolditalics],
      defaultFontFamily: "Roboto",
    },
  });
  const pngBuffer = resvg.render().asPng();
  return `data:image/png;base64,${Buffer.from(Uint8Array.from(pngBuffer)).toString("base64")}`;
}

function convertSvgImageNodes(node: any): any {
  if (Array.isArray(node)) {
    return node.map(convertSvgImageNodes);
  }
  if (node && typeof node === "object") {
    if (
      typeof node.image === "string" &&
      node.image.startsWith("data:image/svg+xml")
    ) {
      const svgMarkup = decodeSvgDataUrl(node.image);
      if (svgMarkup) {
        const widthPx = typeof node.width === "number" ? node.width : undefined;
        return { ...node, image: svgToPngDataUrl(svgMarkup, widthPx) };
      }
    }
    const result: any = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = convertSvgImageNodes(value);
    }
    return result;
  }
  return node;
}

// ==================== PDF GENERATION ====================

/**
 * Generate a PDF buffer from a pdfmake document definition, entirely in
 * Node — no headless browser required.
 */
export async function generatePdfBufferNode(
  docDefinition: TDocumentDefinitions,
): Promise<Buffer> {
  ensureFontsRegistered();
  const nodeSafeDocDefinition = convertSvgImageNodes(docDefinition);
  const pdf = pdfmake.createPdf(nodeSafeDocDefinition);
  return pdf.getBuffer();
}