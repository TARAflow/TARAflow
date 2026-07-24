// ==================== USE SPLIT PERCENT RESIZE ====================
// Drag-to-resize for a split view, in PERCENT and CONTROLLED.
//
// Distinct from use-split-view-resize.ts, deliberately — that one is vertical
// only, works in pixels and owns its state in a local useState. Both properties
// are wrong for a divider whose position must survive a restart: the DFD
// preview already shows the consequence, where a persisted `topPanelHeight`
// sits in useAttackTreeUI next to the hook's own unpersisted copy, and the
// hook's default wins on reload.
//
// So this hook holds nothing. It reports a new percentage and the caller
// decides where that lives — localStorage, project settings, or nowhere.
// The percentage also survives a window resize, which a pixel value does not.

import { useCallback, useEffect, useRef, useState } from "react";

export type SplitAxis = "horizontal" | "vertical";

export interface UseSplitPercentResizeOptions {
  /** Current position, 0–100. The caller owns it. */
  percent: number;
  /** Called during the drag with the new position. */
  onChange: (percent: number) => void;
  /** "horizontal" splits left|right, "vertical" splits top|bottom. */
  axis?: SplitAxis;
  /** Clamp, in percent. Keeps either pane from being dragged shut. */
  min?: number;
  max?: number;
}

export interface UseSplitPercentResizeResult {
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Attach to the element the percentage is measured against. */
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useSplitPercentResize({
  percent,
  onChange,
  axis = "horizontal",
  min = 15,
  max = 85,
}: UseSplitPercentResizeOptions): UseSplitPercentResizeResult {
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Kept in refs so the move handler does not need to be rebuilt per drag frame.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const startPosRef = useRef(0);
  const startPercentRef = useRef(percent);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startPosRef.current = axis === "horizontal" ? e.clientX : e.clientY;
      startPercentRef.current = percent;
      setIsResizing(true);
    },
    [axis, percent],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!isResizing || !container) return;
      e.preventDefault();

      const size =
        axis === "horizontal" ? container.clientWidth : container.clientHeight;
      if (size === 0) return;

      const delta =
        (axis === "horizontal" ? e.clientX : e.clientY) - startPosRef.current;
      const next = startPercentRef.current + (delta / size) * 100;

      onChangeRef.current(Math.min(max, Math.max(min, next)));
    },
    [isResizing, axis, min, max],
  );

  const handleMouseUp = useCallback(() => setIsResizing(false), []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    // Without this the drag selects text and the cursor flickers over children.
    document.body.style.userSelect = "none";
    document.body.style.cursor =
      axis === "horizontal" ? "col-resize" : "row-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp, axis]);

  return { isResizing, handleMouseDown, containerRef };
}

export default useSplitPercentResize;
