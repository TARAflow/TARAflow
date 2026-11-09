// Multi-project TARA phase 5b (design §9.2; review 2026-11-09): the
// inventory of stored machine decisions, old snapshot against new — take
// over / review (basis changed) / orphaned (no counterpart) — and the open
// reviews kept per instance (only those, with the oldest basis).

import { describe, expect, it } from "vitest";
import type { ComponentInstance } from "shared";
import type { Project } from "app/models/project-types";
import type { ComponentSnapshot } from "app/models/component-snapshot-types";
import {
  DECISION_KINDS,
  decisionDelta,
  instanceThreatKeys,
  nextReviewBasis,
  openReviews,
  snapshotDelta,
  withReviewConfirmed,
  type DecisionKind,
} from "app/services/component-import/update-inventory";
import { withAssumptionStatus } from "app/services/component-import/assumption-status";
import { withMeasureOverride } from "app/services/component-import/measure-overrides";
import { copyInstanceRatings } from "app/services/component-import/copy-ratings";
import { DiffService } from "features/audit/services/diff-service";
import { component, machine, tid } from "../../../../fixtures/component-treatment-machine";

/** The machine with decisions: ASM-01 fulfilled, M-S-001 not effective here, the reduce risk rated with a ticketed measure. */
const decided = (): Project => {
  let m = machine();
  m = { ...m, components: withAssumptionStatus(m.components!, "i1", "a1", { status: "fulfilled" }) } as Project;
  m = { ...m, components: withMeasureOverride(m.components!, "i1", "M-S-001", "stripped", "2026-11-09") } as Project;
  const risks = m.risks!.risks.map((r) =>
    r.threatId === tid(component.reduceThreat)
      ? {
          ...r,
          factorRatings: r.factorRatings.map((f, i) => (i === 0 ? { ...f, value: 3 } : f)),
          selectedMitigations: [{ id: "M-T-001", status: "in_progress", ticketId: "ABC-123" }],
        }
      : r,
  );
  return { ...m, risks: { ...m.risks!, risks } } as Project;
};
const instanceOf = (p: Project) => p.components!.instances[0];
const snapshotOf = (p: Project) => p.components!.imports[0].snapshot as ComponentSnapshot;
const change = (s: ComponentSnapshot, edit: (x: ComponentSnapshot) => void) => {
  const copy = structuredClone(s);
  edit(copy);
  return copy;
};
const outcome = (delta: ReturnType<typeof decisionDelta>, kind: DecisionKind, key: string) => delta.find((d) => d.kind === kind && d.key === key)?.outcome;
const threatKey = `threat|${component.reduceThreat}`;

describe("update inventory (phase 5b)", () => {
  it("covers every kind of decision (a Record — a new kind does not compile without a rule)", () => {
    expect(Object.keys(DECISION_KINDS).sort()).toEqual(
      ["a2aRelation", "aouStatus", "assetRating", "boundaryThreat", "citedClaim", "conceptRiskRef", "eeMapping", "hazardLink", "measureOverride", "pathOverlay", "quantity", "relevanceOverride", "riskRating", "riskTreatment"].sort(),
    );
  });

  it("unchanged state: every decision is taken over", () => {
    const p = decided();
    const delta = decisionDelta(p, instanceOf(p), snapshotOf(p), structuredClone(snapshotOf(p)));
    expect(delta.length).toBeGreaterThan(0);
    expect(delta.every((d) => d.outcome === "take_over")).toBe(true);
    expect(delta.map((d) => d.kind)).toEqual(expect.arrayContaining(["eeMapping", "aouStatus", "measureOverride", "riskRating", "riskTreatment"]));
  });

  it("basis changed → review: the assumption's text, the measure's relying assumption", () => {
    const p = decided();
    const next = change(snapshotOf(p), (s) => {
      s.assumptions![0] = { ...s.assumptions![0], text: "Frames are checked by the controller AND the gateway" };
    });
    const delta = decisionDelta(p, instanceOf(p), snapshotOf(p), next);
    expect(outcome(delta, "aouStatus", "a1")).toBe("review");
    expect(outcome(delta, "eeMapping", "EE-1")).toBe("take_over");
  });

  it("counterpart gone → orphaned; an orphaned treatment names its tracker tickets", () => {
    const p = decided();
    const next = change(snapshotOf(p), (s) => {
      for (const t of s.threats!.perElementTables) t.threats = t.threats.filter((x) => x.id !== component.reduceThreat);
      s.risks = s.risks.filter((r) => r.threatId !== component.reduceThreat);
    });
    const delta = decisionDelta(p, instanceOf(p), snapshotOf(p), next);
    expect(outcome(delta, "riskRating", threatKey)).toBe("orphaned");
    expect(delta.find((d) => d.kind === "riskTreatment" && d.key === threatKey)).toMatchObject({ outcome: "orphaned", ticketIds: ["ABC-123"] });
    // M-S-001 was chosen only on that risk: its "not effective here" has no counterpart either
    expect(outcome(delta, "measureOverride", "M-S-001")).toBe("orphaned");
  });

  it("reviews kept per instance: only the open ones, with the OLDEST basis; settles when the basis comes back; confirming removes it", () => {
    const p = decided();
    const s0 = snapshotOf(p);
    const s1 = change(s0, (s) => {
      s.assumptions![0] = { ...s.assumptions![0], text: "v1" };
    });
    const s2 = change(s0, (s) => {
      s.assumptions![0] = { ...s.assumptions![0], text: "v2" };
    });
    let inst: ComponentInstance = instanceOf(p);
    // update 1: s0 → s1
    const b1 = nextReviewBasis(inst, decisionDelta(p, inst, s0, s1), s1)!;
    expect(Object.keys(b1)).toEqual(["aouStatus|a1"]);
    inst = { ...inst, reviewBasis: b1 };
    expect(openReviews(inst, s1)).toEqual([{ kind: "aouStatus", key: "a1" }]);
    // update 2 before the review: s1 → s2 keeps the basis of s0
    const b2 = nextReviewBasis(inst, decisionDelta(p, inst, s1, s2), s2)!;
    expect(b2["aouStatus|a1"]).toBe(b1["aouStatus|a1"]);
    // the component restores the text of s0: the review settles by itself
    expect(nextReviewBasis({ ...inst, reviewBasis: b2 }, decisionDelta(p, inst, s2, s0), s0)).toBeUndefined();
    expect(openReviews({ ...inst, reviewBasis: b2 }, s0)).toEqual([]);
    // confirming removes the entry
    expect(withReviewConfirmed(inst, "aouStatus", "a1").reviewBasis).toBeUndefined();
    // an orphaned decision's review goes
    const s3 = change(s1, (s) => {
      s.assumptions = [];
    });
    expect(nextReviewBasis(inst, decisionDelta(p, inst, s1, s3), s3)).toBeUndefined();
  });

  it("the audit diff sees an open review and its confirmation (commit gate)", () => {
    const p = decided();
    const withReview = { ...p, components: { ...p.components!, instances: [{ ...instanceOf(p), reviewBasis: { "aouStatus|a1": "abc" } }] } } as Project;
    const strip = (x: Project) => ({ ...x, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(p), strip(withReview)).find((c) => c.phase === "components")!;
    expect(section.changes[0].details!.map((d) => d.field)).toContain("reviewBasis");
  });

  it("copying ratings takes a copied decision's open review along", () => {
    const p = decided();
    const source = { ...instanceOf(p), reviewBasis: { "aouStatus|a1": "abc", "riskTreatment|x": "def" } };
    const target = { ...instanceOf(p), id: "i2", prefix: "SD2", reviewBasis: undefined, assumptions: [] };
    const two = { ...p, components: { ...p.components!, instances: [source, target] } } as Project;
    const copied = copyInstanceRatings(two, "i1", "i2", { decisions: true, assetImpact: false, mode: "fill" });
    // the AoU status is copied with its review; the treatment is not copied, nor its review
    expect(copied.components.instances.find((i) => i.id === "i2")!.reviewBasis).toEqual({ "aouStatus|a1": "abc" });
  });

  it("instance threat keys: table threats and attack-path threats map back to the component's terms", () => {
    const p = decided();
    const keys = instanceThreatKeys("i1", snapshotOf(p));
    expect(keys.get(tid(component.reduceThreat))).toBe(threatKey);
  });

  it("what changed: elements, new EEs needing a mapping, threats, measures, assumptions …", () => {
    const p = decided();
    const s0 = snapshotOf(p);
    const s1 = change(s0, (s) => {
      s.dfd!.elements = [...s.dfd!.elements, { ...s.dfd!.elements.find((e) => e.type === "ExternalEntity")!, id: "EE-NEW" }];
      s.assumptions = s.assumptions!.slice(1);
    });
    const d = snapshotDelta(s0, s1);
    expect(d.elements.added).toEqual(["EE-NEW"]);
    expect(d.newEes).toEqual(["EE-NEW"]);
    expect(d.assumptions.removed).toEqual(["a1"]);
    expect(d.threats).toEqual({ added: [], removed: [] });
  });
});
