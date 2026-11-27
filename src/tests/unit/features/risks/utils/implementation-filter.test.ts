// src/tests/unit/features/risks/utils/implementation-filter.test.ts
//
// 0.20.1 (user 2026-11-27): filter the risks by the implementation status of
// their mitigations. A risk with mixed statuses matches every status one of
// its mitigations has; the extra values follow the progress rule.
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
  it("mixed statuses: each status one of the mitigations has; not done", () => {
    expect(match(risk({ status: "open" }, { status: "implemented", ticketId: "T-1" }))).toEqual(["open", "implemented", "not_done"]);
  });

  it("no mitigation selected: only none", () => {
    expect(match(risk())).toEqual(["none"]);
  });

  it("all done (implemented, verified; rejected ones do not count against it)", () => {
    expect(match(risk({ status: "verified", evidenceNote: "test report" }, { status: "rejected" }))).toEqual(["verified", "rejected", "all_done"]);
  });

  it("a done status without ticket, note or reference: done without evidence — also without a tracker", () => {
    expect(match(risk({ status: "implemented" }))).toEqual(["implemented", "all_done", "done_without_evidence"]);
    expect(match(risk({ status: "in_review" }))).toEqual(["in_review", "not_done", "done_without_evidence"]);
  });
});
