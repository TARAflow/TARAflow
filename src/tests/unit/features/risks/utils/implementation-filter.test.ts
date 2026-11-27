// src/tests/unit/features/risks/utils/implementation-filter.test.ts
//
// 0.20.1 (user 2026-11-27): filter the risks by the implementation status of
// their mitigations — the status the column "Implementation" shows (a risk
// with an open and an in-review mitigation is "in review", not "open"); the
// extra values follow the progress rule.
import { describe, expect, it } from "vitest";
import { matchesImplementationFilter, type ImplementationFilter } from "features/risks/utils/implementation-filter";
import type { Risk } from "features/risks/models/risk-assessment-types";

const risk = (...ms: Array<{ status: string; ticketId?: string; evidenceNote?: string }>) =>
  ({ selectedMitigations: ms.map((m, i) => ({ id: `M-${i}`, ...m })) }) as unknown as Risk;
const match = (r: Risk) =>
  (["open", "in_progress", "in_review", "implemented", "verified", "rejected", "none", "not_done", "all_done", "done_without_evidence"] as ImplementationFilter[]).filter(
    (f) => matchesImplementationFilter(r, f),
  );

describe("matchesImplementationFilter", () => {
  it("mixed statuses: the column's status only (user 2026-11-27: open + in review is in review, not open)", () => {
    expect(match(risk({ status: "open" }, { status: "in_review", ticketId: "T-1" }))).toEqual(["in_review", "not_done"]);
    // partly done: in progress
    expect(match(risk({ status: "open" }, { status: "implemented", ticketId: "T-1" }))).toEqual(["in_progress", "not_done"]);
    expect(match(risk({ status: "open" }, { status: "open" }))).toEqual(["open", "not_done"]);
  });

  it("no mitigation selected: only none", () => {
    expect(match(risk())).toEqual(["none"]);
  });

  it("all done (implemented, verified; rejected ones do not count against it)", () => {
    expect(match(risk({ status: "verified", evidenceNote: "test report" }, { status: "rejected" }))).toEqual(["verified", "all_done"]);
    expect(match(risk({ status: "rejected" }))).toEqual(["rejected", "all_done"]);
  });

  it("a done status without ticket, note or reference: done without evidence — also without a tracker", () => {
    expect(match(risk({ status: "implemented" }))).toEqual(["implemented", "all_done", "done_without_evidence"]);
    expect(match(risk({ status: "in_review" }))).toEqual(["in_review", "not_done", "done_without_evidence"]);
  });
});
