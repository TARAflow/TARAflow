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
      ["added", "CAM1"],
    ]);
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
    expect(section.changes[0]).toMatchObject({ type: "modified", name: "CAM1" });
  });
});
