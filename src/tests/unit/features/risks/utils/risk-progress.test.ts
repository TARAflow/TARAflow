// What the progress chip of the risk groups counts as done (user 2026-10-30,
// Headlamp: "6/17" — AT-9.1 with the ISO treatment "share" did not count).
import { describe, it, expect } from "vitest";
import { calculateProgress } from "features/risks/utils/risk-progress";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const risk = (treatment: string, statuses: string[] = [], moscowPriority = "should"): Any => ({
  treatment,
  moscowPriority,
  selectedMitigations: statuses.map((status, i) => ({ id: `M-${i}`, status })),
});

describe("calculateProgress", () => {
  it("done: accept, transfer, share (ISO), won't — or every mitigation implemented / verified / rejected", () => {
    const risks = [
      risk("accept"),
      risk("transfer"),
      risk("share"),
      risk("reduce", [], "wont"),
      risk("reduce", ["implemented", "verified"]),
      risk("reduce", ["implemented", "open"]),
      risk("reduce", ["open"]),
      risk("reduce"),
    ];
    expect(calculateProgress(risks)).toEqual({ done: 5, total: 8, percent: 62.5, srslOpen: 0 });
  });
});

describe("calculateProgress — EN 50742 A, SRSL controls open (0.20 patch 29)", () => {
  it("a risk with open SRSL controls is not done, whatever its treatment; counted as srslOpen", () => {
    const accepted = { ...risk("accept"), id: "R-1" };
    const wont = { ...risk("reduce", [], "wont"), id: "R-2" };
    const implemented = { ...risk("reduce", ["implemented"]), id: "R-3" };
    expect(calculateProgress([accepted, wont, implemented]).done).toBe(3);
    const p = calculateProgress([accepted, wont, implemented], new Set(["R-1", "R-2"]));
    expect(p).toMatchObject({ done: 1, total: 3, srslOpen: 2 });
  });
});
