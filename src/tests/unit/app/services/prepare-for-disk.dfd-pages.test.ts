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
