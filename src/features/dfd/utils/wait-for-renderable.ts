// ==================== WAIT FOR RENDERABLE ====================
// Single Responsibility: decide when the draw.io iframe can produce a faithful
// image export.
//
// draw.io renders labels as HTML (<foreignObject>) and measures them in the
// live DOM when exporting. Exporting while the iframe is hidden (DFD tab not
// active → display:none / 0×0) yields thumbnails with missing or shifted
// labels. Fixed timers cannot know that, so this waits for it explicitly.
//
// CROSS-ORIGIN: draw.io is loaded from https://embed.diagrams.net, so the
// iframe's contentWindow / contentDocument belong to another origin. Reading
// a property of a cross-origin WindowProxy (e.g. requestAnimationFrame)
// THROWS a SecurityError. Only the <iframe> element itself (offsetWidth /
// offsetHeight) and the PARENT window are touched unguarded; the fonts probe
// is best-effort and fully guarded. This function never rejects.

/** Structural subset of HTMLIFrameElement — keeps the helper testable. */
export interface RenderableFrame {
  offsetWidth: number;
  offsetHeight: number;
  /** Null for a cross-origin frame; may also throw in some embeddings. */
  readonly contentDocument?: { fonts?: { ready?: Promise<unknown> } } | null;
}

export interface WaitForRenderableOptions {
  /** Give up waiting for visibility after this long (ms). Default 10 000. */
  timeoutMs?: number;
  /** Visibility poll interval (ms). Default 250. */
  intervalMs?: number;
}

const FONTS_TIMEOUT_MS = 2_000;
const FRAME_TIMEOUT_MS = 100;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolve when `p` settles or after `ms`, whichever comes first; never rejects. */
function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  return Promise.race([p.then(() => undefined, () => undefined), sleep(ms)]);
}

/**
 * One PARENT animation frame (the iframe's own rAF is not reachable
 * cross-origin). rAF is paused while the app window is hidden, so it is capped
 * by a short timeout.
 */
function nextFrame(): Promise<void> {
  const raf =
    typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : null;
  const frame = raf
    ? new Promise<void>((resolve) => raf(() => resolve()))
    : sleep(16);
  return settleWithin(frame, FRAME_TIMEOUT_MS);
}

function fontsReady(frame: RenderableFrame): Promise<unknown> | undefined {
  try {
    return frame.contentDocument?.fonts?.ready;
  } catch {
    return undefined; // cross-origin
  }
}

function isVisible(frame: RenderableFrame | null | undefined): frame is RenderableFrame {
  return !!frame && frame.offsetWidth > 0 && frame.offsetHeight > 0;
}

/**
 * Resolves true once the frame is visible (non-zero size), its fonts are
 * loaded where observable, and two animation frames have passed. Resolves
 * false if the frame never became visible within the timeout — the caller
 * should then skip the export rather than persist a broken image.
 */
export async function waitForRenderable(
  getFrame: () => RenderableFrame | null | undefined,
  { timeoutMs = 10_000, intervalMs = 250 }: WaitForRenderableOptions = {},
): Promise<boolean> {
  try {
    const deadline = Date.now() + timeoutMs;
    let frame = getFrame();
    while (!isVisible(frame)) {
      if (Date.now() >= deadline) return false;
      await sleep(intervalMs);
      frame = getFrame();
    }

    const fonts = fontsReady(frame);
    if (fonts) await settleWithin(fonts, FONTS_TIMEOUT_MS);

    await nextFrame();
    await nextFrame();
    return true;
  } catch {
    // Defensive: never block a thumbnail on an unexpected probe error.
    return isVisible(getFrame());
  }
}
