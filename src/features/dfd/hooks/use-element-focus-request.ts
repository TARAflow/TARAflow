// features/dfd/hooks/use-element-focus-request.ts
//
// "Show in the diagram" from another tab (Compliance to-do list, user
// 2026-11-02): switch the DFD tab to the drawing, wait until draw.io is ready,
// then select the element once — the details panel follows the selection.

import { useEffect, useRef } from "react";
import type { DFDViewMode } from "../models/dfd-types";

/** A new object per request, so the same element can be asked for twice. */
export interface ElementFocusRequest {
  readonly elementId: string;
  /** A tab of the element form to open (e.g. "component" from the Overview). */
  readonly tab?: string;
}

/** After switching to the drawing the bridge re-initialises (see dfd-tab); select after that. */
export const SELECT_AFTER_SWITCH_MS = 300;

export function useElementFocusRequest(
  request: ElementFocusRequest | null | undefined,
  viewMode: DFDViewMode,
  setViewMode: (mode: DFDViewMode) => void,
  pluginReady: boolean,
  selectCell: (elementId: string) => Promise<void> | void,
): void {
  const handled = useRef<ElementFocusRequest | null>(null);
  const switched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!request || handled.current === request) return;
    if (viewMode !== "draw") {
      switched.current = true;
      setViewMode("draw");
      return;
    }
    if (!pluginReady) return;
    handled.current = request;
    const delay = switched.current ? SELECT_AFTER_SWITCH_MS : 0;
    switched.current = false;
    // Not cleared on a re-run: the request is handled once, whatever changes next.
    timer.current = setTimeout(() => void selectCell(request.elementId), delay);
  }, [request, viewMode, setViewMode, pluginReady, selectCell]);
}
