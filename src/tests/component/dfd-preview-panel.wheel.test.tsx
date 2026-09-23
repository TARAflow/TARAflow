// src/tests/component/dfd-preview-panel.wheel.test.tsx
//
// Wheel-zoom on the DFD preview must cancel the page scroll. React's onWheel
// is a PASSIVE root listener, so preventDefault() there was ignored (console:
// "Unable to preventDefault inside passive event listener invocation"). The
// panel now binds a native { passive: false } listener.

import React from "react";
import { describe, it, expect } from "vitest";
import { act, render } from "@testing-library/react";
import { DFDPreviewPanel } from "shared/components/dfd-preview-panel";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("DFDPreviewPanel wheel zoom", () => {
  it("cancels the default scroll and zooms the image", () => {
    const { getByAltText } = render(<DFDPreviewPanel imageSrc={PNG} />);
    const img = getByAltText("DFD Preview");
    const container = img.parentElement!;
    const before = img.style.transform;

    const wheel = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
    act(() => {
      container.dispatchEvent(wheel);
    });

    expect(wheel.defaultPrevented).toBe(true);
    expect(img.style.transform).not.toBe(before);
  });
});
