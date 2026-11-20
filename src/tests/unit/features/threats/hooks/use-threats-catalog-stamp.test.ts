// Catalogue divergence phase A: a full (re)generation of a method stamps the
// current threat catalogue version for that method; every other update of
// the threat tables carries the stored stamp unchanged.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ThreatData, ThreatProjectData, ThreatTable } from "features/threats/models/threat-types";
import { DEFAULT_THREAT_CONFIGURATION } from "features/threats/models/threat-types";
import { THREAT_CATALOG_VERSION } from "features/threats/services/threat-catalog-version";
import { elementThreatService } from "features/threats/services/per-element/element-threat-service";
import { interactionThreatService } from "features/threats/services/per-interaction/interaction-threat-service";
import { useElementThreats } from "features/threats/hooks/per-element/use-element-threats";
import { useInteractionThreats } from "features/threats/hooks/per-interaction/use-interaction-threats";

const table = (id: string): ThreatTable => ({
  trustBoundaryId: null,
  trustBoundaryName: "",
  displayIdentifier: id,
  threats: [],
});

const STORED = { "per-element": 0, "per-interaction": 0 };

const project = (): ThreatProjectData =>
  ({
    id: "p",
    name: "p",
    threats: {
      configuration: DEFAULT_THREAT_CONFIGURATION,
      perElementTables: [table("pe")],
      perInteractionTables: [table("pi")],
      catalogStamp: { ...STORED },
      lastModified: "",
    },
    dfdElements: [],
    dfdConnections: [],
    lastModified: "",
  }) as unknown as ThreatProjectData;

const context = { isDummy: () => false } as never;

beforeEach(() => vi.restoreAllMocks());

describe.each([
  ["per-element", useElementThreats, elementThreatService, "per-interaction"],
  ["per-interaction", useInteractionThreats, interactionThreatService, "per-element"],
] as const)("%s hook — catalogue stamp", (method, useHook, service, other) => {
  const render = () => {
    const updates: ThreatData[] = [];
    // One object for every render: a new project per render re-runs the
    // hooks' table effects without end.
    const stable = project();
    const { result } = renderHook(() =>
      useHook({
        project: stable,
        dfdContext: context,
        configuration: DEFAULT_THREAT_CONFIGURATION,
        onUpdate: (d: ThreatData) => updates.push(d),
      }),
    );
    return { result, updates };
  };

  it("a generation stamps the method with the current version, the other method keeps its stamp", async () => {
    vi.spyOn(service, "generateThreats").mockReturnValue({ success: true, tables: [table("new")] });
    const { result, updates } = render();
    await act(async () => {
      await result.current.generateThreats({ keepManual: true });
    });
    expect(updates.at(-1)!.catalogStamp).toEqual({ [method]: THREAT_CATALOG_VERSION, [other]: 0 });
  });

  it("replacing or deleting tables carries the stored stamp unchanged", () => {
    const { result, updates } = render();
    act(() => result.current.replaceTables([table("x")]));
    act(() => result.current.deleteAllThreats({ keepManual: true }));
    expect(updates).toHaveLength(2);
    for (const u of updates) expect(u.catalogStamp).toEqual(STORED);
  });

  it("a failed generation writes nothing", async () => {
    vi.spyOn(service, "generateThreats").mockReturnValue({ success: false, tables: [], error: "x" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, updates } = render();
    await act(async () => {
      await result.current.generateThreats();
    });
    expect(updates).toHaveLength(0);
  });
});
