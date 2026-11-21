// What the progress chip of the risk groups counts as done (user 2026-10-30,
// Headlamp: "6/17" — AT-9.1 with the ISO treatment "share" did not count).
import { describe, it, expect } from "vitest";
import { calculateProgress, openRiskReasonLines, openRiskReasons } from "features/risks/utils/risk-progress";

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

describe("openRiskReasons — why risks are not done (0.20 item 14)", () => {
  const r = (id: string, extra: Record<string, unknown>) => ({ ...risk("reduce"), id, threatDisplayId: `T-${id}`, ...extra });

  it("by reason, the done ones left out; SRSL open wins over the mitigation state", () => {
    const risks = [
      r("1", { selectedMitigations: [] }),
      r("2", { selectedMitigations: [{ id: "M-1", status: "planned" }] }),
      r("3", { treatment: "accept" }),
      r("4", { treatment: "accept" }),
      r("5", { selectedMitigations: [{ id: "M-2", status: "implemented" }] }),
    ];
    expect(openRiskReasons(risks as never, new Set(["4"]))).toEqual({
      srslOpen: ["T-4"],
      noMitigation: ["T-1"],
      mitigationsOpen: ["T-2"],
    });
  });

  it("one line per reason with risks, capped", () => {
    const t = (_k: string, o: Record<string, unknown>) => String(o.defaultValue).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o[n]));
    const lines = openRiskReasonLines({ srslOpen: [], noMitigation: ["A", "B", "C"], mitigationsOpen: [] }, t, 2);
    expect(lines).toEqual(["to reduce, no mitigation selected yet (3): A, B …"]);
  });
});
