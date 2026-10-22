// Leveled-DFD Phase 5k — a linked definition cell deleted / drawn again:
// the question appears after the save, the candidates follow the drawing,
// re-attach restores the record, "Later" waits for a new cell.
import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLostDefinitions } from "features/dfd/hooks/use-lost-definitions";
import { dfdParser } from "features/dfd/services/dfd-parser";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "features/dfd/models/dfd-types";
import { mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const MP1 = node("mp1", "multiprocess", "Sensor Module", "MP-1", 600);
const SEN = page("sen", "Sensor Module", "");
const LINKED: DFDPage[] = [
  { pageId: "sys", name: "Top", order: 0, links: [{ cellId: "cx", tfId: "tx", role: "definition" }] },
  { pageId: "sen", name: "Sensor Module", decomposes: "mp1", order: 1 },
];
const UNLINKED: DFDPage[] = [{ ...LINKED[0], links: [] }, LINKED[1]];

const project = (top: string, pages: DFDPage[]): DFDProjectData => {
  const xml = mxfile(page("sys", "Top", top), SEN);
  const { elements, connections } = dfdParser.parse(xml, pages);
  return {
    id: "p",
    name: "p",
    phaseStatus: {},
    dfd: {
      xml,
      pages,
      elements: elements.map((e) =>
        e.id === "tx" ? { ...e, properties: { notes: "keep" }, assetRelations: [{ assetId: "a1" }] } : e,
      ),
      connections,
      assets: [],
    },
  } as unknown as DFDProjectData;
};

const BEFORE = project(MP1 + node("cx", "process", "Logger", "P-3", 10), LINKED);
const DELETED = project(MP1, UNLINKED);
const REDRAWN = project(MP1 + node("cy", "process", "Logger", "P-3", 10), UNLINKED);

function setup() {
  const savePages = vi.fn(async (_pages: DFDPage[]) => ({}) as DFDUpdateResult);
  const restoreRecord = vi.fn();
  const hook = renderHook(({ p }: { p: DFDProjectData }) => useLostDefinitions(p, { savePages, restoreRecord }), {
    initialProps: { p: BEFORE },
  });
  return { ...hook, savePages, restoreRecord };
}

describe("useLostDefinitions", () => {
  it("asks after the save that lost the element, and offers the cell drawn later", async () => {
    const { result, rerender } = setup();
    expect(result.current.lost).toEqual([]);
    rerender({ p: DELETED });
    await waitFor(() => expect(result.current.lost.map((l) => l.tfId)).toEqual(["tx"]));
    expect(result.current.lost[0].candidates).toEqual([]);
    rerender({ p: REDRAWN });
    await waitFor(() =>
      expect(result.current.lost[0].candidates).toEqual([{ cellId: "cy", label: "P-3 Logger" }]),
    );
  });

  it("re-attaches the old identity and restores its record", async () => {
    const { result, rerender, savePages, restoreRecord } = setup();
    rerender({ p: REDRAWN });
    await waitFor(() => expect(result.current.lost).toHaveLength(1));
    let error: string | null = "unset";
    await act(async () => {
      error = await result.current.reattach("tx", "cy");
    });
    expect(error).toBeNull();
    expect(savePages.mock.calls[0][0][0].links).toEqual([{ cellId: "cy", tfId: "tx", role: "definition" }]);
    expect(restoreRecord.mock.calls[0][0].record).toMatchObject({
      properties: { notes: "keep" },
      assetRelations: [{ assetId: "a1" }],
    });
    expect(result.current.lost).toEqual([]);
  });

  it("'Later' hides the question until a new cell appears", async () => {
    const { result, rerender } = setup();
    rerender({ p: DELETED });
    await waitFor(() => expect(result.current.lost).toHaveLength(1));
    act(() => result.current.postpone("tx"));
    expect(result.current.lost).toEqual([]);
    rerender({ p: REDRAWN });
    await waitFor(() => expect(result.current.lost).toHaveLength(1));
  });

  it("an undo that brings the cell back ends the question", async () => {
    const { result, rerender } = setup();
    rerender({ p: DELETED });
    await waitFor(() => expect(result.current.lost).toHaveLength(1));
    rerender({ p: project(MP1 + node("cx", "process", "Logger", "P-3", 10), LINKED) });
    await waitFor(() => expect(result.current.lost).toEqual([]));
  });

  it("accepting the deletion ends the question", async () => {
    const { result, rerender } = setup();
    rerender({ p: DELETED });
    await waitFor(() => expect(result.current.lost).toHaveLength(1));
    act(() => result.current.acceptDeletion("tx"));
    expect(result.current.lost).toEqual([]);
  });
});
