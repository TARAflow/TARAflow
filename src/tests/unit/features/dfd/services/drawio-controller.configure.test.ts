// draw.io zooms the diagram into the window on load and on every page
// switch unless told otherwise (Editor.fitDiagramOnLoad /
// fitDiagramOnPage, default true). A large diagram then opened tiny and
// needed "Reset view" — TARAflow opens at 100 %.
import { describe, expect, it } from "vitest";
import DrawioController from "features/dfd/services/drawio-controller";

function configureMessage(): Record<string, unknown> {
  let receive: ((message: MessageEvent) => void) | null = null;
  const sent: Array<Record<string, unknown>> = [];
  const communicator = {
    receive: (cb: (message: MessageEvent) => void) => {
      receive = cb;
    },
    send: (msg: Record<string, unknown>) => sent.push(msg),
  };
  const storage = { read: () => null, write: () => {} };
  new DrawioController(communicator as never, storage as never, "Test");
  receive!({ origin: "https://embed.diagrams.net", data: JSON.stringify({ event: "configure" }) } as MessageEvent);
  const msg = sent.find((m) => m.action === "configure");
  if (!msg) throw new Error("no configure message sent");
  return msg.config as Record<string, unknown>;
}

describe("draw.io configure", () => {
  it("does not fit the diagram into the window on load or on a page switch", () => {
    const config = configureMessage();
    expect(config.fitDiagramOnLoad).toBe(false);
    expect(config.fitDiagramOnPage).toBe(false);
  });
});
