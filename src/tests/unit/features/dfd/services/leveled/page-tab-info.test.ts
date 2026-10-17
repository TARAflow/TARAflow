// Leveled-DFD Phase 5c — tooltip and finding badge for draw.io's own page
// tabs (design §12): the place of the page in the tree, a decomposition not
// in effect yet (D15), the findings on the page.
import { describe, it, expect } from "vitest";
import { buildPageTabInfo, type PageOutline } from "features/dfd/services/leveled";

// The default texts with their parameters filled in, like i18next does.
const t = (_key: string, o: Record<string, unknown>) =>
  String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o[name]));

const OUTLINE: PageOutline = {
  nodes: [
    { pageId: "sys", name: "System", depth: 0, pendingDecomposition: false, errors: 2, warnings: 1 },
    {
      pageId: "sen",
      name: "Sensor Module",
      depth: 1,
      decomposes: { tfId: "mp1", label: "MP-1 Sensor Module" },
      pendingDecomposition: false,
      errors: 0,
      warnings: 3,
    },
    {
      pageId: "ctl",
      name: "Controller Module",
      depth: 1,
      decomposes: { tfId: "mp2", label: "MP-2 Controller Module" },
      pendingDecomposition: true,
      errors: 0,
      warnings: 0,
    },
    { pageId: "p4", name: "Page-4", pendingDecomposition: false, errors: 0, warnings: 0 },
  ],
};

describe("buildPageTabInfo", () => {
  const info = buildPageTabInfo(OUTLINE, t);

  it("describes the root page with its findings and an error badge", () => {
    expect(info.sys).toEqual({
      title: "System\nTop level\n2 error(s), 1 warning(s)",
      badge: { count: 2, severity: "error" },
    });
  });

  it("names the detailed multiprocess; warnings give a warning badge", () => {
    expect(info.sen).toEqual({
      title: "Sensor Module\nDetails MP-1 Sensor Module\n0 error(s), 3 warning(s)",
      badge: { count: 3, severity: "warning" },
    });
  });

  it("explains a decomposition not in effect yet; no findings, no badge", () => {
    expect(info.ctl).toEqual({
      title:
        "Controller Module\nDetails MP-2 Controller Module\n" +
        "No part of its own yet — the multiprocess is analysed as a whole",
    });
  });

  it("marks a page outside the tree", () => {
    expect(info.p4.title).toBe("Page-4\nNot in the page tree");
  });

  it("is empty without an outline (one page, adoption pending)", () => {
    expect(buildPageTabInfo(null, t)).toEqual({});
  });
});
