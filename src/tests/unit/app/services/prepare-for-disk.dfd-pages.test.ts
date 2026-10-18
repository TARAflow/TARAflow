// Leveled-DFD Phase 1.3 — dfd.pages is persisted as written (design §5.3).
// It is optional and additive: absent stays absent (no churn for classic
// projects), present is written unchanged.
import { describe, it, expect } from "vitest";
import { prepareForDisk } from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";

const project = (dfd: Record<string, unknown>) =>
  ({
    id: "p",
    schemaVersion: 8,
    info: { name: "P" },
    dfd: { elements: [], connections: [], assets: [], ...dfd },
  }) as unknown as Project;

describe("prepareForDisk keeps dfd.pages", () => {
  it("writes the page tree unchanged", () => {
    const pages = [
      { pageId: "sys", name: "System", order: 0 },
      { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 0 },
    ];
    const onDisk = prepareForDisk(project({ xml: "<mxfile/>", pages }));
    expect((onDisk.dfd as { pages?: unknown }).pages).toEqual(pages);
  });

  it("does not add pages to a classic project", () => {
    const onDisk = prepareForDisk(project({ xml: "<mxfile/>" }));
    expect(onDisk.dfd).not.toHaveProperty("pages");
  });
});

describe("prepareForDisk pins the page thumbnails (D18)", () => {
  const svg = (id: string) =>
    "data:image/svg+xml;base64," + btoa(`<svg id="ge-svg-${id}"><g/></svg>`);

  it("pins the random draw.io id of every page thumbnail like dfd.thumbnail", () => {
    const pages = [
      { pageId: "sys", name: "Top", order: 0, thumbnail: svg("a1B2") },
      { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1, thumbnail: svg("x9") },
      { pageId: "ctl", name: "Controller", decomposes: "mp2", order: 2 },
    ];
    const onDisk = prepareForDisk(project({ xml: "<mxfile/>", pages, thumbnail: svg("a1B2") }));
    const written = (onDisk.dfd as { pages: { thumbnail?: string }[]; thumbnail: string });
    const pinned = svg("thumb");
    expect(written.pages.map((p) => p.thumbnail)).toEqual([pinned, pinned, undefined]);
    expect(written.thumbnail).toBe(pinned);
    // Two renders of the same page give the same bytes.
    const again = prepareForDisk(project({ xml: "<mxfile/>", pages: [{ ...pages[0], thumbnail: svg("zz") }] }));
    expect((again.dfd as { pages: { thumbnail?: string }[] }).pages[0].thumbnail).toBe(pinned);
  });
});
