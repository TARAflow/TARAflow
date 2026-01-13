// ==================== USE SPLIT VIEW RESIZE HOOK ====================
// Reusable hook for handling split view resize with mouse drag
// Can be used in any component that needs resizable panels

import { useState, useCallback, useRef, useEffect } from "react";

interface UseSplitViewResizeOptions {
  defaultHeight: number;
  minHeight: number;
}

interface UseSplitViewResizeResult {
  topPanelHeight: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  splitContainerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for handling resizable split view panels
 * 
 * @param options - Configuration options
 * @returns Object with height state, resize handlers, and container ref
 * 
 * @example
 * const { topPanelHeight, isResizing, handleMouseDown, splitContainerRef } = 
 *   useSplitViewResize({ defaultHeight: 250, minHeight: 100 });
 */
export function useSplitViewResize({
  defaultHeight,
  minHeight,
}: UseSplitViewResizeOptions): UseSplitViewResizeResult {
  const [topPanelHeight, setTopPanelHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startYRef.current = e.clientY;
      startHeightRef.current = topPanelHeight;
      setIsResizing(true);
    },
    [topPanelHeight]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) return;
      e.preventDefault();

      const deltaY = e.clientY - startYRef.current;
      const containerHeight = splitContainerRef.current.clientHeight;
      const maxHeight = containerHeight - minHeight - 8; // 8px for resize handle

      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, startHeightRef.current + deltaY)
      );

      setTopPanelHeight(newHeight);
    },
    [isResizing, minHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Attach/detach event listeners when resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    topPanelHeight,
    isResizing,
    handleMouseDown,
    splitContainerRef,
  };
}