// EN 50742 A risk and project evidence (en-50742-rq-coverage.md §9.2,
// CM-12) on small views: a mandated control done meets its clause, an
// unrated risk is unknown, a clear "no" is a gap and wins over unknown
// (D-12, step 9); the planned run counts chosen controls.
import { describe, it, expect } from "vitest";
import { externalOutcome, srslReached, srslSummary, type En50742Risk, type En50742View } from "features/compliance";

const risk = (id: string, extra: Partial<En50742Risk> = {}): En50742Risk => ({
  id,
  label: `R-${id}`,
  anchorId: "if1",
  safetyFunctionIds: ["sf1"],
  srsl: 2,
  exposed: true,
  mandated: [],
  anyOfMandated: false,
  controls: [],
  accepted: false,
  excluded: false,
  ...extra,
});

const view = (risks: En50742Risk[], extra: Partial<En50742View> = {}): En50742View => ({
  windowOfOpportunity: "limited",
  systemDefinition: { boundary: true, environment: true },
  hazards: { total: 1, unlinked: [] },
  safetyFunctions: [{ id: "sf1", name: "Emergency stop" }],
  interfaces: { exposed: ["if1"], unrated: [] },
  risks,
  ...extra,
});

const AUTH = { kind: "risk", check: "mandated", clause: "7.4.3.2.1" } as const;
const INTEGRITY = { kind: "risk", check: "mandated", clause: "7.4.3.4.2" } as const;

describe("7.4.3 clause rows (risk evidence)", () => {
  const spoofing = (controls: En50742Risk["controls"]) => risk("1", { mandated: ["7.4.3.2.1"], controls });

  it("the mandated control done → met; chosen but open → gap now, met in the planned run", () => {
    expect(externalOutcome(AUTH, view([spoofing([{ clause: "7.4.3.2.1", done: true, planned: true }])]), "achieved").status).toBe("met");
    const open = view([spoofing([{ clause: "7.4.3.2.1", done: false, planned: true }])]);
    expect(externalOutcome(AUTH, open, "achieved")).toMatchObject({ status: "gap", risks: ["R-1"] });
    expect(externalOutcome(AUTH, open, "planned").status).toBe("met");
  });

  it("a risk without SRSL is unknown; a gap elsewhere wins", () => {
    expect(externalOutcome(AUTH, view([risk("2", { srsl: null })]), "achieved")).toMatchObject({ status: "unknown", risks: ["R-2"] });
    expect(externalOutcome(AUTH, view([spoofing([]), risk("2", { srsl: null })]), "achieved").status).toBe("gap");
  });

  it("no risk mandates the clause → n/a; an excluded threat does not count", () => {
    expect(externalOutcome(AUTH, view([risk("1")]), "achieved").status).toBe("n/a");
    expect(externalOutcome(AUTH, view([risk("3", { mandated: ["7.4.3.2.1"], excluded: true })]), "achieved").status).toBe("n/a");
  });

  it("Interface × T: one of the integrity controls done meets every integrity clause (design §11.4)", () => {
    const tampering = risk("4", {
      mandated: ["7.4.3.4.1", "7.4.3.4.2", "7.4.3.4.4", "7.4.3.4.5"],
      anyOfMandated: true,
      controls: [{ clause: "7.4.3.4.1", done: true, planned: true }],
    });
    expect(externalOutcome(INTEGRITY, view([tampering]), "achieved").status).toBe("met");
    expect(externalOutcome({ kind: "risk", check: "all-mandated" }, view([tampering]), "achieved").status).toBe("met");
  });

  it("7.4.3.1 summary: every mandated control of every risk", () => {
    const two = [risk("1", { mandated: ["7.4.3.2.1"], controls: [{ clause: "7.4.3.2.1", done: true, planned: true }] }), risk("2", { mandated: ["7.4.3.3.1"] })];
    expect(externalOutcome({ kind: "risk", check: "all-mandated" }, view(two), "achieved")).toMatchObject({ status: "gap", risks: ["R-2"] });
  });
});

describe("information for use (9): remaining requirements", () => {
  const REMAINING = { kind: "risk", check: "remaining" } as const;

  it("an accepted risk or a missing mandated control must be passed on → statement naming them", () => {
    const out = externalOutcome(REMAINING, view([risk("1", { accepted: true }), risk("2", { mandated: ["7.4.3.3.1"] }), risk("3")]), "achieved");
    expect(out).toMatchObject({ status: "needs-statement", risks: ["R-1", "R-2"] });
  });

  it("nothing remains → n/a; unrated risks → unknown", () => {
    expect(externalOutcome(REMAINING, view([risk("3")]), "achieved").status).toBe("n/a");
    expect(externalOutcome(REMAINING, view([risk("3", { srsl: null })]), "achieved").status).toBe("unknown");
  });
});

describe("project checks", () => {
  const check = (id: "hazards-linked" | "system-definition" | "interfaces-assessed" | "srsl-complete" | "srsl-consistent", v: En50742View) =>
    externalOutcome({ kind: "project", check: id }, v, "achieved");

  it("4.3/217: hazards imported and linked, every safety function has risks", () => {
    expect(check("hazards-linked", view([risk("1")])).status).toBe("met");
    expect(check("hazards-linked", view([risk("1")], { hazards: { total: 0, unlinked: [] } })).status).toBe("unknown");
    expect(check("hazards-linked", view([risk("1")], { hazards: { total: 2, unlinked: ["H-2"] } })).reasoning).toContain("H-2");
    expect(check("hazards-linked", view([])).status).toBe("gap");
  });

  it("4.3/220: an unset WoO or an empty system definition is unknown, never met", () => {
    expect(check("system-definition", view([])).status).toBe("met");
    const unset = check("system-definition", view([], { windowOfOpportunity: undefined, systemDefinition: { boundary: true, environment: false } }));
    expect(unset.status).toBe("unknown");
    expect(unset.reasoning).toContain("window of opportunity");
    expect(unset.reasoning).toContain("operational environment");
  });

  it("7.1/260: every exposed interface has a risk with SRSL or an excluded threat", () => {
    expect(check("interfaces-assessed", view([risk("1")])).status).toBe("met");
    expect(check("interfaces-assessed", view([risk("1", { anchorId: "if9" })]))).toMatchObject({ status: "gap", failing: ["if1"] });
    expect(check("interfaces-assessed", view([risk("1", { srsl: null })]))).toMatchObject({ status: "unknown", unknown: ["if1"] });
    expect(check("interfaces-assessed", view([risk("1", { srsl: null, excluded: true })])).status).toBe("met");
    expect(check("interfaces-assessed", view([], { interfaces: { exposed: [], unrated: ["if2"] } })).status).toBe("unknown");
    expect(check("interfaces-assessed", view([], { interfaces: { exposed: [], unrated: [] } })).status).toBe("n/a");
  });

  it("7.4.2/334: every safety function has risks, all rated", () => {
    expect(check("srsl-complete", view([risk("1")])).status).toBe("met");
    expect(check("srsl-complete", view([risk("1", { safetyFunctionIds: [] })])).status).toBe("gap");
    expect(check("srsl-complete", view([risk("1", { srsl: null })])).status).toBe("unknown");
    expect(check("srsl-complete", view([risk("1", { srsl: undefined })])).status).toBe("unknown");
  });

  it("7.4.2/344: SRSL 0 on an interface above EL0 is a gap (finding F2)", () => {
    expect(check("srsl-consistent", view([risk("1", { srsl: 0, exposed: true })]))).toMatchObject({ status: "gap", risks: ["R-1"] });
    expect(check("srsl-consistent", view([risk("1", { srsl: 0, exposed: false })])).status).toBe("met");
    expect(check("srsl-consistent", view([risk("1", { srsl: 0, exposed: undefined })])).status).toBe("unknown");
    expect(check("srsl-consistent", view([risk("1", { srsl: undefined })])).status).toBe("n/a");
  });
});

describe("SRSL precondition and header", () => {
  it("applies from SRSL 2: reached / not reached / unknown while unrated", () => {
    expect(srslReached(2, view([risk("1", { srsl: 3 })]))).toBe("yes");
    expect(srslReached(2, view([risk("1", { srsl: 1 })]))).toBe("no");
    expect(srslReached(2, view([risk("1", { srsl: 1 }), risk("2", { srsl: null })]))).toBe("unknown");
    expect(srslReached(2, view([]))).toBe("unknown");
  });

  it("the header shows the highest SRSL per safety function, not rated as null", () => {
    const summary = srslSummary(
      view([risk("1", { srsl: 1 }), risk("2", { srsl: 3 }), risk("3", { srsl: 3, excluded: true, safetyFunctionIds: ["sf2"] })], {
        safetyFunctions: [{ id: "sf1", name: "Emergency stop" }, { id: "sf2", name: "Guard door" }],
      }),
    );
    expect(summary).toEqual({
      windowOfOpportunity: "limited",
      safetyFunctions: [
        { id: "sf1", name: "Emergency stop", srsl: 3 },
        { id: "sf2", name: "Guard door", srsl: null },
      ],
    });
  });
});
