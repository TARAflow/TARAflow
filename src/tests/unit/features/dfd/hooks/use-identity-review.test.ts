// Leveled-DFD Phase 5b — state behind the adoption / assignment dialog
// (design §11.2.1, §5.2). The paste hint is asked once per cell: every
// decision moves the baseline.
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIdentityReview } from "features/dfd/hooks/use-identity-review";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
} from "../../../../fixtures/leveled-dfd-xml";

const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);
const PASTED = mxfile(
  SYSTEM,
  SENSOR,
  page(
    "ctl",
    "Controller Module",
    node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
      node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
      node("ctl_paste", "process", "Sample Smoke Sensor", "P-2", 600),
  ),
);

const project = (xml: string, pages?: DFDPage[]): DFDProjectData =>
  ({
    id: "p-hook",
    name: "hook",
    phaseStatus: {},
    dfd: { xml, pages, elements: [], connections: [], assets: [] },
  }) as unknown as DFDProjectData;

const saved = (xml: string, pages: DFDPage[]): DFDUpdateResult =>
  ({ dfd: { xml, pages, elements: [], connections: [], assets: [] } }) as unknown as DFDUpdateResult;

describe("useIdentityReview — adoption", () => {
  it("opens the proposal for the current draw.io XML and saves the pages", async () => {
    const savePages = vi.fn(async (pages: DFDPage[]) => saved(XML, pages));
    const { result } = renderHook(() =>
      useIdentityReview(project(mxfile(SYSTEM)), {
        adoptionPending: true,
        savePages,
        readXml: () => XML,
      }),
    );
    expect(result.current.adoptionPending).toBe(true);

    act(() => result.current.openAdoption());
    expect(result.current.review?.kind).toBe("adoption");

    let error: string | null = "unset";
    await act(async () => {
      error = await result.current.applyAdoption({});
    });
    expect(error).toBeNull();
    expect(savePages).toHaveBeenCalledTimes(1);
    expect(savePages.mock.calls[0][0].map((p) => [p.pageId, p.decomposes])).toEqual([
      ["sys", undefined],
      ["sen", "mp1"],
      ["ctl", "mp2"],
    ]);
    expect(result.current.review).toBeNull();
  });

  it("opens nothing when the XML has no unadopted pages", () => {
    const { result } = renderHook(() =>
      useIdentityReview(project(XML, LEVELED_PAGES), {
        adoptionPending: false,
        savePages: vi.fn(),
        readXml: () => XML,
      }),
    );
    act(() => result.current.openAdoption());
    expect(result.current.review).toBeNull();
  });

  it("keeps the dialog open and reports a failed save", async () => {
    const { result } = renderHook(() =>
      useIdentityReview(project(mxfile(SYSTEM)), {
        adoptionPending: true,
        savePages: vi.fn(async () => null),
        readXml: () => XML,
      }),
    );
    act(() => result.current.openAdoption());
    let error: string | null = null;
    await act(async () => {
      error = await result.current.applyAdoption({});
    });
    expect(error).toBe("SAVE_FAILED");
    expect(result.current.review?.kind).toBe("adoption");
  });
});

describe("useIdentityReview — paste hint", () => {
  it("counts pasted copies after a save and asks about them once", () => {
    const options = { adoptionPending: false, savePages: vi.fn(), readXml: () => null };
    const { result, rerender } = renderHook(
      ({ p }: { p: DFDProjectData }) => useIdentityReview(p, options),
      { initialProps: { p: project(XML, LEVELED_PAGES) } },
    );
    expect(result.current.pendingCopies).toBe(0);

    rerender({ p: project(PASTED, LEVELED_PAGES) });
    expect(result.current.pendingCopies).toBe(1);

    act(() => result.current.openAssignment());
    expect(result.current.review?.kind).toBe("assignment");

    act(() => result.current.dismissAssignment());
    expect(result.current.review).toBeNull();
    expect(result.current.pendingCopies).toBe(0);
  });

  it("links the chosen copies via savePages", async () => {
    const savePages = vi.fn(async (pages: DFDPage[]) => saved(PASTED, pages));
    const { result, rerender } = renderHook(
      ({ p }: { p: DFDProjectData }) =>
        useIdentityReview(p, { adoptionPending: false, savePages, readXml: () => null }),
      { initialProps: { p: project(XML, LEVELED_PAGES) } },
    );
    rerender({ p: project(PASTED, LEVELED_PAGES) });
    act(() => result.current.openAssignment());
    await act(async () => {
      await result.current.applyAssignment([{ pageId: "ctl", cellId: "ctl_paste" }]);
    });
    const ctl = savePages.mock.calls[0][0].find((p) => p.pageId === "ctl")!;
    expect(ctl.links).toContainEqual({ cellId: "ctl_paste", tfId: "sen_p2", role: "ref" });
  });

  it("does not ask about the cells of an adoption that just happened", () => {
    const options = { adoptionPending: false, savePages: vi.fn(), readXml: () => null };
    const { result, rerender } = renderHook(
      ({ p }: { p: DFDProjectData }) => useIdentityReview(p, options),
      { initialProps: { p: project(mxfile(SYSTEM)) } },
    );
    // Classic → adopted: the baseline is taken with the pages.
    rerender({ p: project(XML, LEVELED_PAGES) });
    expect(result.current.pendingCopies).toBe(0);
  });
});
