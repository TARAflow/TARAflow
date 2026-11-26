// EN 50742 Approach B evaluation (en-50742-rq-coverage.md §6.2, 0.20 patch
// 12): the IEC 62443-4-2 rows of Table 4 read the statements of their own
// family (K-6), recommended rows are shown but never counted (O14), the
// scope is the EN 50742 relevance scope (O17), 8.3/479 is a statement row
// (review 2026-11-21), 8.3/473 (CCSC 2) names the rows met only with
// countermeasures of the machinery system.
import { describe, it, expect } from "vitest";
import type { Project } from "app/models/project-types";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { EDITION_EN50742_A, EDITION_EN50742_B, statementKeyOf, vectorOf, countsForComponent } from "features/compliance";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";

const project = (): Project => parseAndRepair(loadProjectFixture("SmokeDetector.tara.json"))!;
const rowOf = <T extends { label: string }>(rows: readonly T[], label: string): T => rows.find((r) => r.label === label)!;
const statement = (status: "met" | "gap" | "n/a", extra: Record<string, unknown> = {}) => ({
  status,
  reasoning: "by test",
  date: "2026-11-20",
  ...extra,
});
const withStatements = (p: Project, family: string, byRowLabel: Record<string, ReturnType<typeof statement>>) => {
  const statements: Record<string, unknown> = {};
  for (const [label, s] of Object.entries(byRowLabel)) statements[statementKeyOf(EDITION_EN50742_B.rows.find((r) => r.label === label)!)] = s;
  return { ...p, compliance: { ...p.compliance, families: { ...p.compliance?.families, [family]: { statements } } } } as Project;
};

describe("EN 50742 B — evaluation", () => {
  it("scope: the EN 50742 relevance scope, the same as Approach A", () => {
    const context = prepareProjectCompliance(project())!;
    expect([...context.evaluate(EDITION_EN50742_B).scope].sort()).toEqual([...context.evaluate(EDITION_EN50742_A).scope].sort());
  });

  it("recommended rows carry their reason and never lower the SL-C", () => {
    const { achieved } = prepareProjectCompliance(project())!.evaluate(EDITION_EN50742_B);
    const recommended = achieved.rows.filter((r) => r.recommended);
    expect(recommended).toHaveLength(12);
    // the same rows counted would give a lower (or equal) vector
    const counted = vectorOf(achieved.rows.map((r) => ({ ...r, recommended: undefined })), countsForComponent);
    for (const fr of Object.keys(achieved.component) as (keyof typeof achieved.component)[]) {
      expect(achieved.component[fr]).toBeGreaterThanOrEqual(counted[fr]);
    }
    const blocking = { ...rowOf(recommended, "HDR 3.14"), status: "gap" as const };
    expect(vectorOf([blocking], countsForComponent).SI).toBe(4);
  });

  it("a Table 4 row reads the IEC 62443-4-2 statement (K-6); an EN row the EN 50742 one", () => {
    let p = withStatements(project(), "iec-62443-4-2", { "CR 1.2": statement("met") });
    p = withStatements(p, "en-50742", { "EN-6/257": statement("met") });
    const { achieved } = prepareProjectCompliance(p)!.evaluate(EDITION_EN50742_B);
    expect(rowOf(achieved.rows, "CR 1.2")).toMatchObject({ status: "met", source: "statement" });
    expect(rowOf(achieved.rows, "EN-6/257")).toMatchObject({ status: "met", source: "statement" });
    // a statement of the EN family under the CR key is not read for the Table 4 row
    const wrong = withStatements(project(), "en-50742", { "CR 1.2": statement("met") });
    expect(rowOf(prepareProjectCompliance(wrong)!.evaluate(EDITION_EN50742_B).achieved.rows, "CR 1.2").source).not.toBe("statement");
  });

  it("8.3/479: a statement row — a scope with elements proves no evaluation as a whole (review 2026-11-21)", () => {
    const context = prepareProjectCompliance(project())!;
    expect(context.en50742Relevance().relevant.size).toBeGreaterThan(0);
    expect(rowOf(context.evaluate(EDITION_EN50742_B).achieved.rows, "EN-8.3/479–480").status).toBe("needs-statement");
    const stated = withStatements(project(), "en-50742", { "EN-8.3/479–480": statement("met") });
    expect(rowOf(prepareProjectCompliance(stated)!.evaluate(EDITION_EN50742_B).achieved.rows, "EN-8.3/479–480")).toMatchObject({
      status: "met",
      source: "statement",
    });
  });

  it("8.3/473 (CCSC 2): met by the model when no row needs a countermeasure of the system; otherwise it names them", () => {
    const plain = prepareProjectCompliance(project())!.evaluate(EDITION_EN50742_B).achieved;
    const viaModel = rowOf(plain.rows, "EN-8.3/473–478");
    const supported = plain.rows.filter((r) => r.source === "supporting-measure" || r.source === "claim");
    if (supported.length === 0) expect(viaModel).toMatchObject({ status: "met", reason: { code: "noSystemCountermeasure" } });

    const p = withStatements(project(), "iec-62443-4-2", { "CR 2.1": statement("met", { supportingMeasure: "machine firewall" }) });
    const ccsc2 = rowOf(prepareProjectCompliance(p)!.evaluate(EDITION_EN50742_B).achieved.rows, "EN-8.3/473–478");
    expect(ccsc2.status).toBe("needs-statement");
    expect(ccsc2.reason).toMatchObject({ code: "nameCountermeasures" });
    expect(ccsc2.reason?.values?.list).toContain("CR 2.1");
  });
});

describe("EN 50742 A — risks on not relevant anchors have no SRSL at all (O18)", () => {
  it("relevant anchor: not rated yet (null); not relevant: no SRSL (undefined) — never counted as unrated", () => {
    const p = project();
    const relevant = prepareProjectCompliance(p)!.en50742Relevance().relevant;
    // a risk on a relevant flow (per-interaction threat) next to the stored per-element ones
    const onFlow = p.threats!.perInteractionTables.flatMap((t) => t.threats).find((t) => relevant.has(t.dataFlow?.connectionId ?? ""))!;
    expect(onFlow).toBeDefined();
    const template = p.risks!.risks[0];
    // every risk as the gate leaves it before EL / AC are rated
    p.risks = {
      ...p.risks!,
      risks: [...p.risks!.risks, { ...template, id: "R-flow", threatId: onFlow.id }].map((r) => ({ ...r, calculatedSrsl: null })),
    };
    const context = prepareProjectCompliance(p)!;
    const view = context.en50742View();
    const nulls = view.risks.filter((r) => r.srsl === null);
    const none = view.risks.filter((r) => r.srsl === undefined);
    expect(nulls.length).toBeGreaterThan(0);
    expect(none.length).toBeGreaterThan(0);
    for (const r of nulls) expect(relevant.has(r.anchorId!), r.label).toBe(true);
    for (const r of none) expect(!r.anchorId || !relevant.has(r.anchorId), r.label).toBe(true);
  });
});

describe("EN 50742 — retention of the audit records (B-F6, patch 13)", () => {
  const withAuditStore = (retention?: string) => {
    const p = project();
    const ds = p.dfd!.elements.find((e) => e.id === "DS-3")!; // in the relevance scope
    ds.properties = {
      ...(ds.properties as object),
      storedDataTypes: ["audit_logs"],
      ...(retention ? { auditRecordRetention: retention } : {}),
    } as typeof ds.properties;
    (p.dfd as unknown as Record<string, unknown>).graph = undefined;
    return p;
  };
  const statusOf = (p: Project, edition: typeof EDITION_EN50742_B | typeof EDITION_EN50742_A, label: string) =>
    rowOf(prepareProjectCompliance(p)!.evaluate(edition).achieved.rows, label).status;

  it("B 8.5 and A 7.3.4: at least 5 years meets the model part, less fails it, unset is unknown", () => {
    for (const [edition, label] of [[EDITION_EN50742_B, "EN-8.5/487–488"], [EDITION_EN50742_A, "EN-7.3.4/317–319"]] as const) {
      expect(statusOf(withAuditStore("at_least_5_years"), edition, label), label).toBe("met");
      expect(statusOf(withAuditStore("unlimited"), edition, label), label).toBe("met");
      expect(statusOf(withAuditStore("1_to_5_years"), edition, label), label).toBe("gap");
      expect(statusOf(withAuditStore(), edition, label), label).toBe("unknown");
    }
  });

  it("no audit-log store in the scope: a gap a statement can close — never n/a", () => {
    // a scope without any data store (Simple_Test_Project-like): still a gap
    const noStores = project();
    noStores.dfd = { ...noStores.dfd!, elements: noStores.dfd!.elements.filter((e) => e.type !== "DataStore") };
    (noStores.dfd as unknown as Record<string, unknown>).graph = undefined;
    const row = rowOf(prepareProjectCompliance(noStores)!.evaluate(EDITION_EN50742_B).achieved.rows, "EN-8.5/487–488");
    expect(row).toMatchObject({ status: "gap", reason: { code: "noAuditRecordStore" } });
    expect(statusOf(project(), EDITION_EN50742_B, "EN-8.5/487–488")).toBe("gap");
    expect(statusOf(project(), EDITION_EN50742_A, "EN-7.3.4/317–319")).toBe("gap");
  });
});
