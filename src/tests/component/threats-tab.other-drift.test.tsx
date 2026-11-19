// src/tests/component/threats-tab.other-drift.test.tsx
//
// Review of patch f598af81 / 9faf6bd2 (2026-11-20): the drift of the method
// not shown (its dot on the toolbar) ran a full generation again on every
// change of the project's threats — every rating of a relevance. A rating
// changes nothing the drift looks at; the other method's drift is computed
// again only when its own threats (ids, generated or manual) change.

import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (typeof o === "object" && o?.defaultValue !== undefined ? String(o.defaultValue) : k),
    i18n: { language: "en", exists: () => false },
  }),
}));

const detect = vi.fn((..._args: unknown[]) => ({ obsolete: [], addedCount: 0 }));
vi.mock("features/threats/services/threat-generation-drift", async (orig) => ({
  ...(await orig<object>()),
  detectGenerationDrift: (...args: unknown[]) => detect(...args),
}));
vi.mock("features/threats/components/per-element/element-threats-view", () => ({ ElementThreatsView: () => null }));
vi.mock("features/threats/components/per-interaction/interaction-threats-view", () => ({ InteractionThreatsView: () => null }));

import { ThreatsTab } from "features/threats/components/threats-tab";

afterEach(() => {
  cleanup();
  detect.mockClear();
});

const threat = (id: string, relevance: string) => ({
  id,
  displayId: id,
  strideCategory: "S",
  threatDescription: "x",
  relevance,
  source: "generated",
  linkedElement: { elementId: "p1", displayId: "P-1" },
});

// the app passes the same graph and elements while only a rating changes
const GRAPH = { elementsById: new Map([["p1", { id: "p1", displayId: "P-1", type: "Process", name: "P" }]]), connectionsById: new Map(), dataFlowAnalysis: new Map(), outgoingConnections: new Map(), incomingConnections: new Map() };
const ELEMENTS = [{ id: "p1", displayId: "P-1", type: "Process" }];
const CONFIG = { activeMethod: "per-element" };
const OTHER = [{ trustBoundaryId: null, trustBoundaryName: "TB", displayIdentifier: "[TB]", threats: [threat("i1", "unrated")] }];

const project = (relevance: string) =>
  ({
    id: "p",
    name: "P",
    phaseStatus: {},
    dfdGraph: GRAPH,
    dfdElements: ELEMENTS,
    threats: {
      configuration: CONFIG,
      perElementTables: [{ trustBoundaryId: null, trustBoundaryName: "TB", displayIdentifier: "[TB]", threats: [threat("e1", relevance)] }],
      perInteractionTables: OTHER,
    },
  }) as never;

const otherCalls = () => detect.mock.calls.filter((c) => c[3] === "per-interaction").length;

describe("ThreatsTab — drift of the other method", () => {
  it("is not computed again when a threat of the shown method is rated", () => {
    const ctx = { isDummy: () => false } as never;
    const { rerender } = render(<ThreatsTab project={project("unrated")} dfdContext={ctx} onUpdate={() => {}} />);
    const before = otherCalls();
    expect(before).toBeGreaterThan(0);
    rerender(<ThreatsTab project={project("relevant")} dfdContext={ctx} onUpdate={() => {}} />);
    rerender(<ThreatsTab project={project("not_relevant")} dfdContext={ctx} onUpdate={() => {}} />);
    expect(otherCalls()).toBe(before);
  });
});
