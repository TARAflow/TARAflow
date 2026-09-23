// src/tests/unit/features/dfd/utils/wait-for-renderable.test.ts
//
// The thumbnail export must only run once the draw.io iframe can render
// faithfully: visible (non-zero size), fonts loaded, layout settled.

import { describe, it, expect } from "vitest";
import {
  waitForRenderable,
  type RenderableFrame,
} from "features/dfd/utils/wait-for-renderable";

function frame(over: Partial<RenderableFrame> = {}): RenderableFrame {
  return {
    offsetWidth: 800,
    offsetHeight: 600,
    contentDocument: { fonts: { ready: Promise.resolve() } },
    ...over,
  };
}

describe("waitForRenderable", () => {
  it("resolves true for a visible frame with loaded fonts", async () => {
    await expect(waitForRenderable(() => frame())).resolves.toBe(true);
  });

  it("resolves false when the frame never becomes visible (hidden tab)", async () => {
    const hidden = frame({ offsetWidth: 0, offsetHeight: 0 });
    await expect(
      waitForRenderable(() => hidden, { timeoutMs: 60, intervalMs: 10 }),
    ).resolves.toBe(false);
  });

  it("resolves false when there is no frame at all", async () => {
    await expect(
      waitForRenderable(() => null, { timeoutMs: 30, intervalMs: 10 }),
    ).resolves.toBe(false);
  });

  it("waits for the frame to become visible", async () => {
    const f = frame({ offsetWidth: 0, offsetHeight: 0 });
    setTimeout(() => {
      f.offsetWidth = 800;
      f.offsetHeight = 600;
    }, 30);
    await expect(
      waitForRenderable(() => f, { timeoutMs: 1_000, intervalMs: 10 }),
    ).resolves.toBe(true);
  });

  it("waits for fonts before resolving", async () => {
    let fontsLoaded = false;
    const ready = new Promise<void>((r) =>
      setTimeout(() => {
        fontsLoaded = true;
        r();
      }, 30),
    );
    await waitForRenderable(() => frame({ contentDocument: { fonts: { ready } } }));
    expect(fontsLoaded).toBe(true);
  });

  it("works with a cross-origin draw.io frame (contentDocument is null)", async () => {
    // Real case: https://embed.diagrams.net → contentDocument === null.
    await expect(
      waitForRenderable(() => frame({ contentDocument: null })),
    ).resolves.toBe(true);
  });

  it("never touches the frame's cross-origin window", async () => {
    // Regression: reading contentWindow.requestAnimationFrame on a
    // cross-origin WindowProxy throws a SecurityError; that rejected the wait
    // and silently stopped every thumbnail update after an autosave.
    const crossOrigin = frame({ contentDocument: null });
    Object.defineProperty(crossOrigin, "contentWindow", {
      get() {
        throw new DOMException("Blocked a frame with origin", "SecurityError");
      },
    });
    await expect(waitForRenderable(() => crossOrigin)).resolves.toBe(true);
  });

  it("tolerates a contentDocument getter that throws", async () => {
    const f = frame();
    Object.defineProperty(f, "contentDocument", {
      get() {
        throw new DOMException("Blocked a frame", "SecurityError");
      },
    });
    await expect(waitForRenderable(() => f)).resolves.toBe(true);
  });

  it("does not hang on fonts that never become ready", async () => {
    const never = new Promise(() => {});
    const started = Date.now();
    await expect(
      waitForRenderable(() => frame({ contentDocument: { fonts: { ready: never } } })),
    ).resolves.toBe(true);
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});
