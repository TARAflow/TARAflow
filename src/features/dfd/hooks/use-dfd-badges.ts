// ==================== USE DFD BADGES HOOK ====================
// Single Responsibility: keep the EL badges and the safety-zone style of the
// diagram in step with the element properties (dfd-badges.ts).
//
// Runs once the editor has loaded and again whenever what the badges show
// changes: an exposure level, the safety-zone mark or its size, the project
// setting or the identity links of a leveled DFD (a new context copy). The
// editor's diagram is reloaded only if the marks differ.
//
// Display only (patch 23): nothing is saved here. The marks live in the
// editor; every save strips them (dfdService), so opening a project never
// changes its file.

import { useEffect, useRef } from "react";
import type { UseDrawioBridgeReturn } from "./use-drawio-bridge";
import type { DFDElement, DFDPage } from "../models/dfd-types";
import { applyDfdBadges, badgeText, type BadgeElement } from "../services/dfd-badges";

const BADGE_XML_TYPE: Record<string, string> = {
  TrustBoundary: "trustboundary",
  ChipBoundary: "chipboundary",
  PhysicalBoundary: "physicalboundary",
  Interface: "interface",
};

export interface UseDfdBadgesOptions {
  elements: readonly DFDElement[] | undefined;
  pages: readonly DFDPage[] | undefined;
  /** Project setting settings.dfdBadges — absent = on. */
  enabled: boolean;
  en50742: boolean;
  /** Delay after load / change, so draw.io holds the diagram (ms). */
  delay?: number;
}

/** What the badges depend on — a change runs the badge update. */
export function badgeSignature(options: UseDfdBadgesOptions): string {
  const parts: string[] = [`on=${options.enabled}`, `en50742=${options.en50742}`];
  for (const element of options.elements ?? []) {
    const xmlType = BADGE_XML_TYPE[element.type];
    if (!xmlType) continue;
    const text = badgeText(xmlType, element, options.en50742) ?? "";
    // the zone frame has the boundary's size — a resize redraws it
    const zone =
      element.type === "TrustBoundary" && text.startsWith("Safety")
        ? `zone@${element.size?.width ?? ""}x${element.size?.height ?? ""}`
        : "";
    parts.push(`${element.id}:${text}:${zone}`);
  }
  for (const page of options.pages ?? []) {
    parts.push(`${page.pageId}[${(page.links ?? []).map((l) => `${l.cellId}>${l.tfId}`).join(",")}]`);
  }
  return parts.join("|");
}

export function useDfdBadges(bridge: UseDrawioBridgeReturn, options: UseDfdBadgesOptions): void {
  const signature = badgeSignature(options);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const { delay = 1000 } = options;

  useEffect(() => {
    if (bridge.isLoading) return;
    const timer = setTimeout(() => {
      const xml = bridge.getCurrentXML();
      if (!xml) return;
      const { elements, pages, enabled, en50742 } = optionsRef.current;
      const byId = new Map<string, BadgeElement>((elements ?? []).map((e) => [e.id, e]));
      try {
        const next = applyDfdBadges(xml, byId, pages, { enabled, en50742 });
        if (next === xml) return;
        void bridge.loadXML(next);
      } catch (error) {
        console.error("[useDfdBadges] badge update failed:", error);
      }
    }, delay);
    return () => clearTimeout(timer);
    // The signature stands for the options; the bridge is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, bridge.isLoading, delay]);
}
