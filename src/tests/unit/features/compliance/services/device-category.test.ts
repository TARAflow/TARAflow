// Device category proposal (iec-62443-4-2-2019-coverage.md §2, K-C1).
import { describe, it, expect } from "vitest";
import { proposeDeviceCategories } from "features/compliance";

const mp = (systemClass?: string) => ({ type: "Multiprocess", properties: systemClass ? { systemClass } : {} });

describe("proposeDeviceCategories", () => {
  it("from the system class", () => {
    expect(proposeDeviceCategories(mp("embedded_controller"), false).categories).toEqual(["EDR"]);
    expect(proposeDeviceCategories(mp("safety_system"), false).categories).toEqual(["EDR"]);
    expect(proposeDeviceCategories(mp("gateway"), false).categories).toEqual(["NDR"]);
    expect(proposeDeviceCategories(mp("scada_hmi"), false).categories).toEqual(["HDR"]);
    expect(proposeDeviceCategories(mp("backend_application"), false).categories).toEqual(["SAR"]);
    expect(proposeDeviceCategories(mp("cloud_platform"), false).categories).toEqual(["SAR"]);
  });

  it("no proposal for workstation and mobile device — the analyst decides", () => {
    expect(proposeDeviceCategories(mp("workstation"), true)).toEqual({ categories: [], reason: "ask" });
    expect(proposeDeviceCategories(mp("mobile_device"), false)).toEqual({ categories: [], reason: "ask" });
  });

  it("a chip boundary inside → EDR; a process → SAR; nothing known → ask", () => {
    expect(proposeDeviceCategories(mp(), true)).toEqual({ categories: ["EDR"], reason: "chip-boundary" });
    expect(proposeDeviceCategories({ type: "Process" }, false).categories).toEqual(["SAR"]);
    expect(proposeDeviceCategories(undefined, false)).toEqual({ categories: [], reason: "ask" });
  });
});
