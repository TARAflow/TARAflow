// What the window title names (0.20 item 17).
import { describe, expect, it } from "vitest";
import { projectWindowTitle } from "app/utils/project-window-title";

describe("projectWindowTitle", () => {
  it("name and file; the browser build has no file; no project: empty", () => {
    expect(projectWindowTitle({ info: { name: "Machine" }, filePath: "/work/machine.tara.json" })).toBe("Machine — /work/machine.tara.json");
    expect(projectWindowTitle({ info: { name: "Machine" }, filePath: "" })).toBe("Machine");
    expect(projectWindowTitle(null)).toBe("");
  });
});
