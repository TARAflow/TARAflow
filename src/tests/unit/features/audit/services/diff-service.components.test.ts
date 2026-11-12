// tests/unit/features/audit/services/diff-service.components.test.ts
//
// Schema 14 (multi-project TARA design §8.2): imported components are part
// of the project file, so the audit diff shows an import, a moved state and
// the instances — without dumping the snapshot (its content hash stands for it).

import { describe, expect, it } from "vitest";
import { DiffService } from "features/audit/services/diff-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const svc = new DiffService();
const imp = (sha: string, hash: string): Any => ({
  id: "imp1",
  componentId: "cam",
  name: "Camera system",
  source: { commitSha: sha, schemaVersion: 14 },
  importedAt: "2026-11-07",
  methodology: { likelihoodMethod: "weighted-mean", factors: [], hash: "000000000000" },
  snapshot: { snapshotFormat: 1, big: "x".repeat(1000) },
  contentHash: hash,
});
const base = (components?: Any): Any => ({ dfd: null, assets: null, threats: null, risks: null, attackTrees: null, ...(components ? { components } : {}) });

describe("audit diff — components", () => {
  it("no components, no section", () => {
    expect(svc.detectChanges(base(), base())).toEqual([]);
  });

  it("an import and its instance added", () => {
    const cur = base({ imports: [imp("abcdef1234", "111")], instances: [{ id: "i1", importId: "imp1", multiprocessTfId: "mp1", prefix: "CAM1", eeMapping: [], assumptions: [] }] });
    const [section] = svc.detectChanges(cur, base());
    expect(section.phase).toBe("components");
    expect(section.changes.map((c) => [c.type, c.name])).toEqual([
      ["added", "Camera system @ abcdef12"],
      ["added", "CAM1 · Camera system"],
    ]);
  });

  it("an unpinned import is named as such", () => {
    const unpinned = { ...imp("x", "111"), source: { schemaVersion: 14, unpinned: "no_repo" } };
    const [section] = svc.detectChanges(base({ imports: [unpinned], instances: [] }), base());
    expect(section.changes[0].name).toBe("Camera system @ unpinned");
  });

  it("a moved state names the changed fields, never the snapshot", () => {
    const prev = base({ imports: [imp("aaaaaaaa", "111")], instances: [] });
    const cur = base({ imports: [imp("bbbbbbbb", "222")], instances: [] });
    const [section] = svc.detectChanges(cur, prev);
    const fields = section.changes[0].details!.map((d) => d.field).sort();
    expect(fields).toEqual(["contentHash", "source"]);
    expect(JSON.stringify(section)).not.toContain("xxxxxxxx");
  });

  it("an assumption status of an instance is a modification", () => {
    const inst = (status: string): Any => ({ id: "i1", importId: "imp1", multiprocessTfId: "mp1", prefix: "CAM1", eeMapping: [], assumptions: [{ instanceId: "i1", assumptionId: "a1", status }] });
    const [section] = svc.detectChanges(base({ imports: [], instances: [inst("fulfilled")] }), base({ imports: [], instances: [inst("open")] }));
    expect(section.changes[0]).toMatchObject({ type: "modified", name: "CAM1 · imp1" });
  });

  it("instance changes as lines in the component's words, not \"[object Object]\" (6b)", () => {
    const snapshotImp = {
      ...imp("abcdef1234", "111"),
      snapshot: {
        snapshotFormat: 1,
        assumptions: [{ id: "a1", displayId: "ASM-01", text: "Locked", status: "confirmed" }],
        concept: { goals: [], claims: [{ id: "c1", displayId: "CLM-01" }] },
        dfd: { elements: [{ id: "ee1", name: "Controller" }] },
        threats: { perElementTables: [{ threats: [{ id: "t1", displayId: "DF7-T-1" }] }], perInteractionTables: [] },
      },
    };
    const dfd = { elements: [{ id: "m1", displayId: "P-1", name: "Alarm" }, { id: "m2", displayId: "P-2", name: "Comm" }] };
    const inst = (over: Any): Any => ({ id: "i1", importId: "imp1", multiprocessTfId: "mp1", prefix: "CAM1", eeMapping: [{ componentEeId: "ee1", machineTfId: "m1" }], assumptions: [], ...over });
    const prev = { ...base({ imports: [snapshotImp], instances: [inst({})] }), dfd };
    const cur = {
      ...base({
        imports: [snapshotImp],
        instances: [
          inst({
            quantity: 3,
            eeMapping: [{ componentEeId: "ee1", machineTfId: "m2" }],
            assumptions: [{ instanceId: "i1", assumptionId: "a1", status: "fulfilled", evidence: { mitigationIds: ["M-C-004"], elementIds: ["m2"] } }],
            relevanceOverrides: [{ threatKey: "t1", relevance: "not_relevant", rationale: "Sealed", componentRelevance: "relevant", date: "d" }],
            measureOverrides: [{ measureId: "M-I-002", rationale: "No TLS here", date: "d" }],
            citedClaims: [{ claimId: "c1", requirements: ["iec-62443-4-2:cr-1.1"], date: "d" }],
          }),
        ],
      }),
      dfd,
    };
    const section = svc.detectChanges(cur, prev).find((p) => p.phase === "components")!;
    const lines = section.changes[0].details!.map((d) => `${d.fieldLabel}: ${d.oldValue ?? "—"} → ${d.newValue ?? "—"}`);
    expect(lines).toEqual([
      "Quantity: 1 → 3",
      "EE Controller: P-1 Alarm → P-2 Comm",
      "ASM-01: — → fulfilled [evidence: M-C-004, P-2 Comm]",
      "Relevance DF7-T-1: — → not_relevant (Sealed)",
      "Not effective here M-I-002: — → No TLS here",
      "Cited CLM-01: — → iec-62443-4-2:cr-1.1",
    ]);
    expect(JSON.stringify(section)).not.toContain("[object Object]");
  });
});
