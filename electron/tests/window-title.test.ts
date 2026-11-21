// The window title names the open project; the version comes from the main process (0.20 item 17).
import { describe, expect, it } from "vitest";
import { windowTitle } from "../window-title";

describe("windowTitle", () => {
  it("project and file before the app and its version; none: the app alone", () => {
    expect(windowTitle("Machine — /work/machine.tara.json", "0.20.0-beta")).toBe("Machine — /work/machine.tara.json — TARAflow 0.20.0-beta");
    expect(windowTitle("", "0.20.0-beta")).toBe("TARAflow 0.20.0-beta");
    expect(windowTitle("  ", "0.20.0-beta")).toBe("TARAflow 0.20.0-beta");
    // the page title set by the main process itself is not doubled
    expect(windowTitle("TARAflow 0.20.0-beta", "0.20.0-beta")).toBe("TARAflow 0.20.0-beta");
  });
});
