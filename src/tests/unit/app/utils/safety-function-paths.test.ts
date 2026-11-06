// Paths to a safety function (EN 50742 A, CM-12b): backwards along the flow
// direction from the asset's DFD elements, transitively, collecting flows and
// the interfaces they pass; a one-way boundary ends the path; a flow into a
// child of a decomposed element reaches the element.
import { describe, it, expect } from "vitest";
import { pathAnchors, type PathFlow, type SafetyPathInput } from "app/utils/safety-function-paths";

const flow = (id: string, from: string, to: string): PathFlow => ({ id, from, to });

function input(flows: PathFlow[], extra: Partial<SafetyPathInput> = {}): SafetyPathInput {
  return { flows, interfacesOf: (id) => (id === "f1" ? ["if-wlan"] : []), blocked: () => false, parentOf: () => undefined, ...extra };
}

// wlan --f1--> gateway --f2--> controller (safety function) --f3--> display
const CHAIN = [flow("f1", "wlan", "gateway"), flow("f2", "gateway", "controller"), flow("f3", "controller", "display")];

describe("pathAnchors", () => {
  it("collects every flow towards the safety function, transitively, with its interfaces", () => {
    expect([...pathAnchors(["controller"], input(CHAIN))].sort()).toEqual(["f1", "f2", "if-wlan"]);
  });

  it("flows away from the safety function are not on its path", () => {
    expect(pathAnchors(["controller"], input(CHAIN)).has("f3")).toBe(false);
  });

  it("a one-way boundary ends the path", () => {
    const anchors = pathAnchors(["controller"], input(CHAIN, { blocked: (id) => id === "f2" }));
    expect([...anchors]).toEqual([]);
  });

  it("a flow the asset transports is on the path with its source side", () => {
    expect([...pathAnchors(["f2"], input(CHAIN))].sort()).toEqual(["f1", "f2", "if-wlan"]);
  });

  it("a flow into a child of the decomposed safety-function element reaches it", () => {
    const flows = [flow("f1", "wlan", "child")];
    expect([...pathAnchors(["mp"], input(flows, { parentOf: (id) => (id === "child" ? "mp" : undefined) }))].sort()).toEqual(["f1", "if-wlan"]);
  });

  it("cycles end", () => {
    const flows = [flow("f1", "a", "b"), flow("f2", "b", "a"), flow("f3", "a", "sf")];
    expect([...pathAnchors(["sf"], input(flows))].sort()).toEqual(["f1", "f2", "f3", "if-wlan"]);
  });
});
