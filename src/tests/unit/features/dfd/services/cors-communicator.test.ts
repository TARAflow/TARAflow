import { describe, it, expect, vi } from "vitest";
import CORSCommunicator from "features/dfd/services/cors-communicator";

describe("CORSCommunicator.dispose", () => {
  it("removes every window message listener it registered", () => {
    const comm = new CORSCommunicator(null);
    const a = vi.fn();
    const b = vi.fn();
    comm.receive(a);
    comm.receive(b);
    window.dispatchEvent(new MessageEvent("message", { data: "x" }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    comm.dispose();
    window.dispatchEvent(new MessageEvent("message", { data: "y" }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
