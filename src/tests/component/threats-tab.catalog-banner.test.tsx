// Catalogue divergence phase A: threats generated with an older threat
// catalogue show the drift banner and a findings row even when the drift
// (keys only) is empty; current stamps — or no generated threats — show
// nothing.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      typeof o === "object" && o?.defaultValue !== undefined
        ? String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o[n] ?? ""))
        : k,
    i18n: { language: "en", exists: () => false },
  }),
}));

vi.mock("features/threats/services/threat-generation-drift", async (orig) => ({
  ...(await orig<object>()),
  detectGenerationDrift: () => ({ obsolete: [], addedCount: 0 }),
}));
vi.mock("features/threats/components/per-element/element-threats-view", () => ({ ElementThreatsView: () => null }));
vi.mock("features/threats/components/per-interaction/interaction-threats-view", () => ({ InteractionThreatsView: () => null }));

import { ThreatsTab } from "features/threats/components/threats-tab";
import { THREAT_CATALOG_VERSION } from "features/threats/services/threat-catalog-version";

afterEach(cleanup);

const threat = (source: string) => ({
  id: "e1",
  displayId: "P-1-S-1",
  strideCategory: "S",
  threatDescription: "x",
  relevance: "relevant",
  source,
  linkedElement: { elementId: "p1", displayId: "P-1" },
});
const GRAPH = { elementsById: new Map([["p1", { id: "p1", displayId: "P-1", type: "Process", name: "P" }]]), connectionsById: new Map(), dataFlowAnalysis: new Map(), outgoingConnections: new Map(), incomingConnections: new Map() };

const project = (source: string, stamp?: number) =>
  ({
    id: "p",
    name: "P",
    phaseStatus: {},
    dfdGraph: GRAPH,
    dfdElements: [{ id: "p1", displayId: "P-1", type: "Process" }],
    threats: {
      configuration: { activeMethod: "per-element" },
      perElementTables: [{ trustBoundaryId: null, trustBoundaryName: "TB", displayIdentifier: "[TB]", threats: [threat(source)] }],
      perInteractionTables: [],
      ...(stamp !== undefined ? { catalogStamp: { "per-element": stamp } } : {}),
    },
  }) as never;

const ctx = { isDummy: () => false } as never;
const BANNER = /generated with threat catalogue v/;

describe("ThreatsTab — outdated threat catalogue", () => {
  it("an older stamp shows the banner with both versions", () => {
    render(<ThreatsTab project={project("generated", THREAT_CATALOG_VERSION - 1)} dfdContext={ctx} onUpdate={() => {}} />);
    const text = screen.getByText(
      new RegExp(`generated with threat catalogue v${THREAT_CATALOG_VERSION - 1}, current is v${THREAT_CATALOG_VERSION}`),
    );
    // shown, not only mounted in a closed Collapse
    expect(text.closest(".MuiCollapse-root")!.className).toContain("MuiCollapse-entered");
  });

  it("a current stamp shows nothing", () => {
    render(<ThreatsTab project={project("generated", THREAT_CATALOG_VERSION)} dfdContext={ctx} onUpdate={() => {}} />);
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it("manual threats alone are nothing to re-evaluate", () => {
    render(<ThreatsTab project={project("manual", THREAT_CATALOG_VERSION - 1)} dfdContext={ctx} onUpdate={() => {}} />);
    expect(screen.queryByText(BANNER)).toBeNull();
  });
});
