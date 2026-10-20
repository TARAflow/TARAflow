// Review finding 3: the child-page steps run through one serial queue
// instead of a busy flag. A saved state that arrives while draw.io is still
// syncing is not dropped, and an analyst action waits for its turn instead
// of failing with "busy".
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useChildPages } from "features/dfd/hooks/use-child-pages";
import { SerialQueue } from "features/dfd/utils/serial-queue";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "features/dfd/models/dfd-types";
import type { DrawioPageSyncResult, DrawioPageSyncSpec } from "features/dfd/services/drawio-bridge";
import { mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

describe("SerialQueue", () => {
  it("runs tasks one after another, in order, also after a failing one", async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    let release!: () => void;
    const first = queue.run(
      () =>
        new Promise<string>((resolve) => {
          log.push("first starts");
          release = () => {
            log.push("first ends");
            resolve("a");
          };
        }),
    );
    const failing = queue.run(async () => {
      log.push("second");
      throw new Error("boom");
    });
    const third = queue.run(async () => {
      log.push("third");
      return "c";
    });
    expect(queue.size).toBe(3);
    await Promise.resolve();
    release();
    await expect(first).resolves.toBe("a");
    await expect(failing).rejects.toThrow("boom");
    await expect(third).resolves.toBe("c");
    await queue.idle();
    expect(log).toEqual(["first starts", "first ends", "second", "third"]);
    expect(queue.size).toBe(0);
  });
});

const project = (xml: string, pages?: DFDPage[], elements: object[] = []): DFDProjectData =>
  ({
    id: "p-queue",
    name: "queue",
    phaseStatus: {},
    dfd: { xml, pages, elements, connections: [], assets: [] },
  }) as unknown as DFDProjectData;

const EE = node("ee", "externalentity", "User", "EE-1", 10);
const OPENED = mxfile(page("p1", "Page-1", EE));
const ONE_MP = mxfile(page("p1", "Page-1", EE + node("mp", "multiprocess", "Gateway", "MP-xx", 300)));
const TWO_MPS = mxfile(
  page(
    "p1",
    "Page-1",
    EE + node("mp", "multiprocess", "Gateway", "MP-xx", 300) + node("mp2", "multiprocess", "Logger", "MP-xx", 600),
  ),
);

/** syncPages that answers only when the test says so. */
function slowSync() {
  const waiting: Array<(r: DrawioPageSyncResult) => void> = [];
  const syncPages = vi.fn(
    (_spec: DrawioPageSyncSpec) => new Promise<DrawioPageSyncResult>((resolve) => waiting.push(resolve)),
  );
  const answer = () => waiting.shift()?.({ success: true });
  return { syncPages, answer, pending: () => waiting.length };
}

describe("useChildPages — saved while a sync runs", () => {
  it("handles a state saved during a running sync once the sync is done", async () => {
    const { syncPages, answer, pending } = slowSync();
    const savePages = vi.fn(async (_p: DFDPage[]) => ({}) as DFDUpdateResult);
    let n = 0;
    const options = { enabled: true, syncPages, savePages, setNoChildPage: vi.fn(), newPageId: () => `child${++n}` };
    const { rerender } = renderHook(({ p }: { p: DFDProjectData }) => useChildPages(p, options), {
      initialProps: { p: project(OPENED) },
    });

    // MP-1 drawn: its page is being created …
    rerender({ p: project(ONE_MP) });
    await waitFor(() => expect(pending()).toBe(1));
    // … and while draw.io works, a second multiprocess is saved.
    rerender({ p: project(TWO_MPS) });
    expect(syncPages).toHaveBeenCalledTimes(1);

    // Draw.io answers every sync (page, Top rename, …): the second
    // multiprocess is not lost.
    const created = () => syncPages.mock.calls.flatMap((c) => c[0].create ?? []).map((c) => c.decomposes);
    for (let i = 0; i < 20 && !created().includes("mp2"); i++) {
      answer();
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(created()).toEqual(["mp", "mp2"]);
    while (pending() > 0) {
      answer();
      await new Promise((r) => setTimeout(r, 0));
    }
  });

  it("lets Sync context wait for a running sync instead of failing with busy", async () => {
    const { syncPages, answer, pending } = slowSync();
    const pages: DFDPage[] = [
      { pageId: "p1", name: "Top", order: 0 },
      { pageId: "gw", name: "Gateway", decomposes: "mp", order: 1 },
    ];
    // An MP-2 without page: the reconcile starts a sync that waits.
    const xml = mxfile(
      page("p1", "Top", EE + node("mp", "multiprocess", "Gateway", "MP-1", 300) + node("mp2", "multiprocess", "Logger", "MP-2", 600)),
      page("gw", "Gateway", node("gw_p", "process", "Part", "P-1.1", 10)),
    );
    const options = {
      enabled: true,
      syncPages,
      savePages: vi.fn(async () => ({}) as DFDUpdateResult),
      setNoChildPage: vi.fn(),
      newPageId: () => "child-new",
    };
    const { result } = renderHook(() =>
      useChildPages(project(xml, pages, [{ id: "mp", type: "Multiprocess" }, { id: "mp2", type: "Multiprocess" }]), options),
    );
    await waitFor(() => expect(pending()).toBe(1));
    const sync = result.current.syncContext("mp");
    // Still waiting behind the running sync — not "busy".
    answer();
    await waitFor(() => expect(syncPages.mock.calls.length).toBeGreaterThan(1));
    while (pending() > 0) {
      answer();
      await Promise.resolve();
    }
    await expect(sync).resolves.not.toBe("busy");
  });
});
