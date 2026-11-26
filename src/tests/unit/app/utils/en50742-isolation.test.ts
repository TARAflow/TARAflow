// SRSL0 only for a completely isolated safety function (0.20 patch 22, user
// 2026-11-21, the stricter reading of F2): every interface on a path to it
// has EL0. A controller with a USB port (EL1) and an internal bus (EL0) to
// the safety function: the function is not isolated, so the bus's risk gets
// no SRSL0 either.
import { describe, it, expect } from "vitest";
import { safetyFunctionIsolation, threatIsolation, threatIsolationText } from "app/utils/en50742-relevance";
import type { SafetyPathInput } from "app/utils/safety-function-paths";

// USB-IF (EL1) → CTRL → BUS-IF (EL0) → SF-ELEM
const flows = [
  { id: "DF-usb", from: "laptop", to: "ctrl" },
  { id: "DF-bus", from: "ctrl", to: "drive" },
];
const interfaces: Record<string, string[]> = { "DF-usb": ["IF-usb"], "DF-bus": ["IF-bus"] };
const paths = (blocked: string[] = []): SafetyPathInput => ({
  flows,
  interfacesOf: (id) => interfaces[id] ?? [],
  blocked: (id) => blocked.includes(id),
  parentOf: () => undefined,
});
const items = (el: Record<string, string | undefined>) => (id: string) =>
  id.startsWith("IF-") ? { type: "Interface", exposureLevel: el[id] } : id.startsWith("DF-") ? { type: "DataFlow", exposureLevel: el[id] } : undefined;

describe("safetyFunctionIsolation", () => {
  it("every interface on its paths EL0: isolated", () => {
    expect(safetyFunctionIsolation(["drive"], paths(), items({ "IF-usb": "EL0", "IF-bus": "EL0" }))).toEqual({ isolated: true, exposedBy: [] });
  });

  it("the USB port upstream (EL1) makes it reachable — although the bus is EL0", () => {
    expect(safetyFunctionIsolation(["drive"], paths(), items({ "IF-usb": "EL1", "IF-bus": "EL0" }))).toEqual({
      isolated: false,
      exposedBy: [{ id: "IF-usb", el: "EL1" }],
    });
  });

  it("an interface without an EL is not proven isolated; a flow above EL0 counts too", () => {
    expect(safetyFunctionIsolation(["drive"], paths(), items({ "IF-bus": "EL0" })).exposedBy).toEqual([{ id: "IF-usb", el: "unset" }]);
    expect(
      safetyFunctionIsolation(["drive"], paths(), items({ "IF-usb": "EL0", "IF-bus": "EL0", "DF-bus": "EL2" })).exposedBy,
    ).toEqual([{ id: "DF-bus", el: "EL2" }]);
  });

  it("a one-way boundary ends the path: what lies behind it does not count", () => {
    expect(safetyFunctionIsolation(["drive"], paths(["DF-usb"]), items({ "IF-usb": "EL4", "IF-bus": "EL0" })).isolated).toBe(true);
  });

  it("an interface linked to the function directly counts", () => {
    const direct = safetyFunctionIsolation(["IF-panel"], paths(), (id) => (id === "IF-panel" ? { type: "Interface", exposureLevel: "EL1" } : undefined));
    expect(direct.exposedBy).toEqual([{ id: "IF-panel", el: "EL1" }]);
  });
});

describe("threatIsolation", () => {
  const isolation = new Map([
    ["SF-stop", { isolated: true, exposedBy: [] }],
    ["SF-speed", { isolated: false, exposedBy: [{ id: "IF-usb", el: "EL1" }] }],
  ]);

  it("isolated only when every linked safety function is; none linked → undefined", () => {
    expect(threatIsolation(["SF-stop"], isolation)?.isolated).toBe(true);
    expect(threatIsolation(["SF-stop", "SF-speed", "DA-1"], isolation)).toEqual({
      isolated: false,
      notIsolated: [{ functionId: "SF-speed", exposedBy: [{ id: "IF-usb", el: "EL1" }] }],
    });
    expect(threatIsolation(["DA-1"], isolation)).toBeUndefined();
    expect(threatIsolation(undefined, isolation)).toBeUndefined();
  });

  it("the text names the function and what makes it reachable", () => {
    const t = (_k: string, o: Record<string, unknown>) =>
      String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o[n] ?? ""));
    const label = (id: string) => ({ "SF-speed": "Safe speed", "IF-usb": "IF-1 USB" })[id] ?? id;
    expect(threatIsolationText(threatIsolation(["SF-speed"], isolation)!.notIsolated, label, t)).toBe("Safe speed is reachable via IF-1 USB (EL1)");
  });
});
