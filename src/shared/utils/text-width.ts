// ==================== TEXT WIDTH ====================
// The width a text takes in a font — for table columns that have to be at
// least as wide as their header or their longest label (risk table,
// 2026-11-27: "Risiko (Nachher)" overlapped the next column at 80 px).
// Measured on a canvas in the app; where there is none (jsdom in the tests)
// estimated from the length, generously.

let context: CanvasRenderingContext2D | null | undefined;

function canvasContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context;
  context = null;
  if (typeof document === "undefined") return context;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return context;
  try {
    context = document.createElement("canvas").getContext("2d");
  } catch {
    context = null;
  }
  return context;
}

/**
 * Width in px of `text` at `fontSizePx`, `fontWeight` and `fontFamily`,
 * rounded up. Without a canvas: 0.62 × font size per character (bold-ish
 * sans-serif; on the wide side, so a column is rather too wide than cut).
 */
export function textWidth(
  text: string,
  fontSizePx: number,
  fontWeight: number | string = 400,
  fontFamily = "Roboto, Helvetica, Arial, sans-serif",
): number {
  const ctx = canvasContext();
  if (ctx) {
    ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
    return Math.ceil(ctx.measureText(text).width);
  }
  return Math.ceil(text.length * fontSizePx * 0.62);
}
