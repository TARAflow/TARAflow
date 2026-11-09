// Multi-project TARA phase 4a (design §8.1, review 2026-11-09): a finding on
// a cell that came with a component belongs to the component — except a
// structural finding on a boundary flow (the connection is the machine's;
// its properties are the component's).

import { describe, expect, it } from "vitest";
import { componentAssetGoals, componentLockedIds, componentOwnership, findingOwner } from "app/services/component-import/component-scope";
import { FINDING_CLASS } from "features/dfd/utils/finding-ownership";
import { ValidationMessages } from "features/dfd/services/validators/validator-utils";
import { instanceAssetId } from "features/dfd";
import { isStructuralFinding } from "features/dfd";
import { componentInstanceTfId } from "features/dfd";
import { assetFindingOwner, assetFindingView } from "features/assets/components/asset-notification-panel";
import { machine, snapshot } from "../../../../fixtures/component-treatment-machine";

describe("finding ownership (phase 4a)", () => {
  const m = machine();
  const owners = componentOwnership(m);
  const ees = new Set((snapshot.dfd!.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const process = snapshot.dfd!.elements!.find((e) => e.type === "Process")!;
  const boundary = snapshot.dfd!.connections!.find((c) => ees.has(c.from) !== ees.has(c.to))!;
  const internal = snapshot.dfd!.connections!.find((c) => !ees.has(c.from) && !ees.has(c.to))!;
  const cell = (id: string) => componentInstanceTfId("i1", id);

  it("the component's elements and flows, not its EEs (machine elements) nor the machine's own cells", () => {
    expect(owners.get(cell(process.id))).toEqual({ prefix: "SD1", label: "SD1 · Smoke Detector", boundary: false });
    expect(owners.get(cell(internal.id))?.boundary).toBe(false);
    expect(owners.get(cell(boundary.id))?.boundary).toBe(true);
    for (const ee of ees) expect(owners.has(cell(ee))).toBe(false);
    expect(owners.has("m_p1")).toBe(false);
  });

  it("boundary flow: structure is the machine's, properties (and property suggestions) the component's", () => {
    expect(isStructuralFinding("dfdValidation.unconnectedDataflow")).toBe(true);
    expect(isStructuralFinding("dfdValidation.leveled.BAL_UNRESOLVED_ENDPOINT")).toBe(true);
    expect(isStructuralFinding("tabs.dfd.validation.df.tls.noTerminator")).toBe(false);
    expect(findingOwner(owners, cell(boundary.id), "dfdValidation.invalidDataflowTarget")).toBeUndefined();
    expect(findingOwner(owners, cell(boundary.id), "tabs.dfd.validation.df.prop.protocolMissing")?.prefix).toBe("SD1");
    expect(findingOwner(owners, cell(boundary.id))?.prefix).toBe("SD1");
    // inside the component even a structural finding is the component's
    expect(findingOwner(owners, cell(process.id), "dfdValidation.unconnectedElement")?.prefix).toBe("SD1");
    expect(findingOwner(owners, "m_p1", "dfdValidation.unconnectedElement")).toBeUndefined();
  });

  it("every validation message is classified (complete by type); keys outside it are property, leveled ones structure", () => {
    expect(Object.keys(FINDING_CLASS).sort()).toEqual(Object.keys(ValidationMessages).sort());
    expect(FINDING_CLASS.UNCONNECTED_DATAFLOW).toBe("structure");
    expect(FINDING_CLASS.DF_TLS_NO_TERMINATOR).toBe("property");
    expect(FINDING_CLASS.DUPLICATE_IDLABEL).toBe("property");
    expect(isStructuralFinding(ValidationMessages.EXTERNAL_ENTITY_INSIDE_TB)).toBe(true);
    expect(isStructuralFinding("tabs.dfd.validation.df.something.new")).toBe(false);
  });

  it("locked in the asset graph: the component's elements, flows and instance assets (phase 4a-3)", () => {
    const locked = componentLockedIds(m);
    expect(locked.get(cell(process.id))).toBe("SD1 · Smoke Detector");
    expect(locked.get(instanceAssetId("i1", snapshot.assets[0].id))).toBe("SD1 · Smoke Detector");
    expect(locked.has("m_p1")).toBe(false);
  });

  it("the goal types the component has active, per instance asset", () => {
    const goals = componentAssetGoals(m);
    const a = snapshot.assets[0] as { id: string; securityGoals?: { type: string; level: string }[] };
    expect(goals.get(instanceAssetId("i1", a.id))).toEqual((a.securityGoals ?? []).filter((g) => g.level !== "none").map((g) => g.type));
  });

  it("imported asset: name and DFD links are the component's, impact / goals / safety the machine's", () => {
    const assets = [{ id: "a1", importedFrom: "SD1 · Smoke Detector" }, { id: "a2" }];
    expect(assetFindingOwner({ key: "tabs.assets.validation.noName", assetId: "a1" }, assets)).toBe("SD1 · Smoke Detector");
    expect(assetFindingOwner({ key: "tabs.assets.validation.notLinkedToDFD", assetId: "a1" }, assets)).toBe("SD1 · Smoke Detector");
    expect(assetFindingOwner({ key: "tabs.assets.validation.unratedImpact", assetId: "a1" }, assets)).toBeUndefined();
    expect(assetFindingOwner({ key: "tabs.assets.validation.noSecurityGoal", assetId: "a1" }, assets)).toBeUndefined();
    expect(assetFindingOwner({ key: "tabs.assets.validation.noName", assetId: "a2" }, assets)).toBeUndefined();
    // goal findings: the component's goals (locked) are the component's, an added goal the machine's
    const goalsOf = (id: string) => (id === "a1" ? ["C"] : undefined);
    const desc = "tabs.assets.validation.noSecurityGoalDescription";
    expect(assetFindingOwner({ key: desc, assetId: "a1", goal: "C" }, assets, goalsOf)).toBe("SD1 · Smoke Detector");
    expect(assetFindingOwner({ key: desc, assetId: "a1", goal: "A" }, assets, goalsOf)).toBeUndefined();
    expect(assetFindingOwner({ key: "tabs.assets.validation.goalWithoutThreat", assetId: "a1", goal: "C" }, assets, goalsOf)).toBe("SD1 · Smoke Detector");
    expect(assetFindingOwner({ key: "tabs.assets.validation.goalRationaleMissing", assetId: "a1", goal: "C" }, assets, goalsOf)).toBeUndefined();
  });

  it("signal, not analysis (4a-4): only what a new component revision alone can close carries the component's chip", () => {
    const assets = [{ id: "a1", importedFrom: "SD1 · Smoke Detector" }, { id: "m1" }, { id: "m2" }];
    const ctx = { assets, componentGoalsOf: (id: string) => (id === "a1" ? ["C"] : undefined) };
    // a goal the machine added (A) that no threat violates: the component has no threats for it
    expect(assetFindingView({ key: "tabs.assets.validation.goalWithoutThreat", assetId: "a1", goal: "A" }, ctx)).toEqual({
      owner: "SD1 · Smoke Detector",
      key: "tabs.assets.validation.goalAddedNoComponentThreat",
    });
    // a machine asset tied only to the component's assets, not to a DFD element: its own text
    // naming both ways out, but the MACHINE's finding — it can link the asset itself
    const notLinked = { key: "tabs.assets.validation.notLinkedToDFD", assetId: "m1" };
    expect(assetFindingView(notLinked, { ...ctx, relations: [{ sourceAssetId: "m1", targetAssetId: "a1" }] })).toEqual({
      key: "tabs.assets.validation.linkedOnlyToComponent",
      component: "SD1 · Smoke Detector",
    });
    // related to a machine asset as well, or to nothing: the machine's own finding
    expect(assetFindingView(notLinked, { ...ctx, relations: [{ sourceAssetId: "m1", targetAssetId: "a1" }, { sourceAssetId: "m2", targetAssetId: "m1" }] }).owner).toBeUndefined();
    expect(assetFindingView(notLinked, ctx)).toEqual({ key: "tabs.assets.validation.notLinkedToDFD" });
  });
});
