// @vitest-environment node
//
// taraflow-reporter/tests/integration/leveled-analysis-node.test.ts
//
// Leveled DFD (Phase 7): in plain Node — no browser DOM, as in the CLI —
// installDomParser makes the leveled analysis of the draw.io XML work.

import { describe, expect, it } from "vitest";
import { installDomParser } from "../../cli/dom-parser-node";
import { analyseLeveled } from "../../../src/features/dfd/services/leveled/leveled-analysis";
import { multiprocessGroupsFrom } from "../../../src/features/dfd/services/leveled/table-groups";
import type { DFDConnection, DFDElement, DFDPage } from "../../../src/features/dfd/models/dfd-types";
import fixture from "../../../src/tests/fixtures/leveled/smoke-detector-leveled.json";

describe("leveled analysis in Node (CLI)", () => {
  it("has no DOM of its own, and analyses the leveled SmokeDetector after installDomParser", () => {
    expect(typeof (globalThis as { DOMParser?: unknown }).DOMParser).toBe("undefined");
    installDomParser();
    const analysis = analyseLeveled({
      xml: fixture.leveledXml,
      pages: fixture.pages as DFDPage[],
      elements: fixture.leveledElements as unknown as DFDElement[],
      connections: fixture.connections as unknown as DFDConnection[],
    });
    expect(analysis.parse.pages.map((p) => p.name)).toEqual([
      "Top",
      "Sensor Head",
      "Smoke Detector Controller",
    ]);
    expect(analysis.parse.elements.length).toBeGreaterThan(10);
    expect(multiprocessGroupsFrom(analysis)?.groups.length).toBeGreaterThan(1);
  });
});
