// Leveled-DFD Phase 5a — the draw.io selection carries its page (design
// §5.2: cell ids are page-local), also for an empty selection after a page
// switch.
import { describe, it, expect, vi } from "vitest";
import DrawioController from "features/dfd/services/drawio-controller";
import type CORSCommunicator from "features/dfd/services/cors-communicator";
import type LocalStorageModel from "features/dfd/services/local-storage-model";

function controllerWithInbox() {
  let deliver: (message: MessageEvent) => void = () => {};
  const comm = {
    receive: (handler: (message: MessageEvent) => void) => {
      deliver = handler;
    },
    send: vi.fn(),
  } as unknown as CORSCommunicator;
  const controller = new DrawioController(comm, {} as LocalStorageModel, "p");
  const send = (data: object) =>
    deliver({ origin: "https://embed.diagrams.net", data: JSON.stringify(data) } as MessageEvent);
  return { controller, send };
}

describe("DrawioController selection", () => {
  it("passes the page id with every cell and to the callback", () => {
    const { controller, send } = controllerWithInbox();
    const callback = vi.fn();
    controller.onSelectionChanged(callback);

    send({ event: "selection", selection: [{ id: "sen_mp2" }], pageId: "sen" });

    expect(callback).toHaveBeenCalledWith([{ xmlId: "sen_mp2", pageId: "sen" }], "sen");
  });

  it("reports the page of an empty selection (page switch)", () => {
    const { controller, send } = controllerWithInbox();
    const callback = vi.fn();
    controller.onSelectionChanged(callback);

    send({ event: "selection", selection: [], pageId: "ctl" });

    expect(callback).toHaveBeenCalledWith([], "ctl");
  });

  it("passes null from a plugin that reports no page", () => {
    const { controller, send } = controllerWithInbox();
    const callback = vi.fn();
    controller.onSelectionChanged(callback);

    send({ event: "selection", selection: ["c1"] });

    expect(callback).toHaveBeenCalledWith([{ xmlId: "c1", pageId: null }], null);
  });
});
