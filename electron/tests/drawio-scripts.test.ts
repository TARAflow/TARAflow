// electron/tests/drawio-scripts.test.ts
// Review finding 5: the scripts that run inside the draw.io frame live in
// .js files and reach executeJavaScript as text. Each must be one function
// expression (the handler calls it with a JSON literal), parse cleanly, and
// answer like before when draw.io's API is missing.
import { describe, expect, it, vi } from "vitest";
import pluginScript from "../drawio-scripts/plugin.js?raw";
import syncPagesScript from "../drawio-scripts/sync-pages.js?raw";
import exportPageSvgsScript from "../drawio-scripts/export-page-svgs.js?raw";

/** Evaluates `(script)(args…)` with the given globals, as executeJavaScript would. */
function run(script: string, args: string, globals: Record<string, unknown>): unknown {
  const names = Object.keys(globals);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(...names, `return (${script})(${args});`)(...names.map((n) => globals[n]));
}

describe("draw.io frame scripts", () => {
  it.each([
    ["plugin.js", pluginScript],
    ["sync-pages.js", syncPagesScript],
    ["export-page-svgs.js", exportPageSvgsScript],
  ])("%s is one function expression", (_name, script) => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(`return (${script});`)();
    expect(typeof fn).toBe("function");
  });

  it("sync-pages answers without draw.io's page API", () => {
    const spec = JSON.stringify({ create: [], rename: [] });
    expect(run(syncPagesScript, spec, { Draw: {} })).toMatchObject({
      success: false,
      error: "draw.io page API not available",
    });
  });

  it("export-page-svgs answers without draw.io's export API", () => {
    expect(run(exportPageSvgsScript, JSON.stringify(["p1"]), { Draw: {} })).toEqual({
      success: false,
      error: "draw.io page export API not available",
    });
  });

  it("the plugin registers itself with Draw.loadPlugin", () => {
    const loadPlugin = vi.fn();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = run(pluginScript, "", { Draw: { loadPlugin }, mxEvent: {}, window: {} });
    expect(loadPlugin).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: true });
  });
});
