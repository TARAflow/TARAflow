// ==================== PAGE TAB INFO ====================
// Leveled-DFD Phase 5c (leveled-dfd-multi-diagram-design.md §12): what the
// page tabs at the bottom of draw.io show in addition to the page name — a
// tooltip with the page's place in the tree and a finding badge. draw.io's
// own tab bar navigates; TARAflow only decorates it (no second page tree).
// Pure: texts come in through `t`, so the result can be sent to draw.io.

import type { PageOutline } from "./page-outline";

export interface PageTabInfo {
  /** Tooltip, one line per fact. */
  title: string;
  /** Finding badge: the error count, else the warning count. */
  badge?: { count: number; severity: "error" | "warning" };
}

/** pageId → info for its tab. */
export type PageTabInfoMap = Record<string, PageTabInfo>;

type Translate = (key: string, options: Record<string, unknown>) => string;

export function buildPageTabInfo(outline: PageOutline | null, t: Translate): PageTabInfoMap {
  const result: PageTabInfoMap = {};
  for (const node of outline?.nodes ?? []) {
    const lines = [node.name || node.pageId];
    if (node.depth === undefined) {
      lines.push(t("tabs.dfd.pageTabs.notPlaced", { defaultValue: "Not in the page tree" }));
    } else if (!node.decomposes) {
      lines.push(t("tabs.dfd.pageTabs.root", { defaultValue: "Top level" }));
    } else {
      lines.push(
        t("tabs.dfd.pageTabs.details", {
          defaultValue: "Details {{element}}",
          element: node.decomposes.label,
        }),
      );
      if (node.pendingDecomposition) {
        lines.push(
          t("tabs.dfd.pageTabs.pendingDecomposition", {
            defaultValue: "No part of its own yet — the multiprocess is analysed as a whole",
          }),
        );
      }
    }
    if (node.errors > 0 || node.warnings > 0) {
      lines.push(
        t("tabs.dfd.pageTabs.findings", {
          defaultValue: "{{errors}} error(s), {{warnings}} warning(s)",
          errors: node.errors,
          warnings: node.warnings,
        }),
      );
    }
    result[node.pageId] = {
      title: lines.join("\n"),
      ...(node.errors > 0
        ? { badge: { count: node.errors, severity: "error" as const } }
        : node.warnings > 0
          ? { badge: { count: node.warnings, severity: "warning" as const } }
          : {}),
    };
  }
  return result;
}
