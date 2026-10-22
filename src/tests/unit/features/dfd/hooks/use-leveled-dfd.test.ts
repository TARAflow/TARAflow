// Review finding 4: the leveled-DFD flows of the DFD tab live in one façade
// hook. It holds the shared analysis (finding 1) and derives everything the
// tab shows of it; a classic DFD gets nothing leveled.
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLeveledDfd } from "features/dfd/hooks/use-leveled-dfd";
import type { UseDFDEditorReturn } from "features/dfd/hooks/use-dfd-editor";
import { dfdParser } from "features/dfd/services/dfd-parser";
import type { DFDElement, DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
} from "../../../../fixtures/leveled-dfd-xml";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key }),
}));

const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);

function projectOf(xml: string, pages?: DFDPage[], assetRelations?: Record<string, unknown[]>): DFDProjectData {
  const { elements, connections } = dfdParser.parse(xml, pages);
  return {
    id: "p",
    name: "leveled",
    phaseStatus: {},
    dfd: {
      xml,
      pages,
      elements: elements.map((e) => (assetRelations?.[e.id] ? { ...e, assetRelations: assetRelations[e.id] } : e)),
      connections,
      assets: [],
    },
  } as unknown as DFDProjectData;
}

function editorMock(pluginReady = false) {
  return {
    pluginReady,
    validation: null,
    savePages: vi.fn(async () => null),
    syncPages: vi.fn(async () => ({ success: true })),
    setPageTabInfo: vi.fn(async () => {}),
    setContextCells: vi.fn(async () => {}),
    exportPageSvgs: vi.fn(async () => ({ success: false })),
    updatePageThumbnails: vi.fn(),
    updateElementDescription: vi.fn(),
    updateConnectionDescription: vi.fn(),
    iframeRef: { current: null },
    getCurrentPageId: () => null,
    autoNumberLabels: vi.fn(async () => {}),
    openPage: vi.fn(async () => {}),
    selectCellAt: vi.fn(async () => {}),
  } as unknown as UseDFDEditorReturn;
}

const NONE = { cellRef: null };

describe("useLeveledDfd", () => {
  it("gives a classic DFD no leveled analysis, outline or page tools", () => {
    const classic = projectOf(mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10))));
    const { result } = renderHook(() => useLeveledDfd(classic, editorMock(), NONE));
    expect(result.current.analysis).toBeNull();
    expect(result.current.parse).toBeNull();
    expect(result.current.pageOutline).toBeNull();
    expect(result.current.refinementCandidates).toBeUndefined();
    expect(result.current.insertContext.data).toBeNull();
  });

  it("analyses a leveled DFD once and keeps the analysis across renders", () => {
    const project = projectOf(XML, LEVELED_PAGES);
    const editor = editorMock();
    const { result, rerender } = renderHook(() => useLeveledDfd(project, editor, NONE));
    const first = result.current.analysis;
    expect(first?.model.containmentParent.get("sen_p2")).toBe("mp1");
    expect(result.current.pageOutline?.nodes.map((n) => n.pageId)).toEqual(["sys", "sen", "ctl"]);
    rerender();
    expect(result.current.analysis).toBe(first);
  });

  it("derives roll-up and child page of the selected multiprocess", () => {
    const relation = { assetId: "fw", assetGroup: "data", relationType: "stores" };
    const project = projectOf(XML, LEVELED_PAGES, { sen_p2: [relation] });
    const mp1 = project.dfd!.elements.find((e) => e.id === "mp1") as DFDElement;
    const { result } = renderHook(() =>
      useLeveledDfd(project, editorMock(true), { element: mp1, cellRef: null }),
    );
    expect(result.current.selection.assetRollup?.assets.rollup.map((e) => [e.assetId, e.via])).toEqual([
      ["fw", ["sen_p2"]],
    ]);
    expect(result.current.selection.assetRollup?.partLabel("sen_p2")).toBe("P-2");
    expect(result.current.selection.childPage).toMatchObject({ pageName: "Sensor Module" });
  });

  it("pushes context copies and page-tab info to draw.io once the plugin is ready", async () => {
    const editor = editorMock(true);
    renderHook(() => useLeveledDfd(projectOf(XML, LEVELED_PAGES), editor, NONE));
    await waitFor(() => expect(editor.setContextCells).toHaveBeenCalled());
    expect(editor.setPageTabInfo).toHaveBeenCalled();
    const cells = (editor.setContextCells as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    expect(Object.keys(cells)).toEqual(expect.arrayContaining(["sen", "ctl"]));
  });

  it("marks a multiprocess whose child page was deleted as keeping no page", async () => {
    // The Controller Module page (child of MP-2) is gone from the XML.
    const project = projectOf(mxfile(SYSTEM, SENSOR), LEVELED_PAGES);
    const editor = editorMock(true);
    renderHook(() => useLeveledDfd(project, editor, NONE));
    await waitFor(() =>
      expect(editor.updateElementDescription).toHaveBeenCalledWith("mp2", {
        properties: expect.objectContaining({ noChildPage: true }),
      }),
    );
  });

  it("hands the asset graph the pages for its page filter; none for a classic DFD", () => {
    const leveled = renderHook(() => useLeveledDfd(projectOf(XML, LEVELED_PAGES), editorMock(), NONE));
    expect(leveled.result.current.pageScope?.pages.map((p) => p.name)).toEqual([
      "System",
      "Sensor Module",
      "Controller Module",
    ]);
    const classic = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10)));
    const plain = renderHook(() => useLeveledDfd(projectOf(classic), editorMock(), NONE));
    expect(plain.result.current.pageScope).toBeUndefined();
  });
});
