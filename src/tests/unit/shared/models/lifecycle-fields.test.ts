// F-27 updateDelivery, F-27b updateDefaults, F-25a secureByDefault, F-25b
// securityConfigReporting (model-coverage-implementation-plan.md §4.2, CM-6):
// shown only where the earlier settings make them meaningful (user
// 2026-11-02) — an update delivery only for an element that is updated, the
// automatic-update defaults only with automatic delivery, the component's
// configuration settings only on the element that stands for the component.
import { describe, it, expect } from "vitest";
import { isFieldShown, modelField, visibilityContexts, type VisibilityElement } from "shared";

const updateDelivery = modelField("updateDelivery")!;
const updateDefaults = modelField("updateDefaults")!;
const secureByDefault = modelField("secureByDefault")!;
const securityConfigReporting = modelField("securityConfigReporting")!;

const process = (id: string, properties: Record<string, unknown> = {}): VisibilityElement => ({ id, type: "Process", properties });
const system = (id: string, properties: Record<string, unknown> = {}): VisibilityElement => ({ id, type: "Multiprocess", properties });
const contextOf = (element: VisibilityElement, others: VisibilityElement[] = [], componentId?: string) =>
  visibilityContexts([element, ...others], [], { componentId })(element.id)!;

describe("F-27 updateDelivery", () => {
  it("shown when the element is updated; hidden without an update mechanism or with none", () => {
    expect(isFieldShown(updateDelivery, contextOf(system("mp", { updateMechanism: "signed_ota" })))).toBe(true);
    expect(isFieldShown(updateDelivery, contextOf(process("p", { updateMechanism: "signed_local" })))).toBe(true);
    expect(isFieldShown(updateDelivery, contextOf(system("mp")))).toBe(false);
    expect(isFieldShown(updateDelivery, contextOf(system("mp", { updateMechanism: "none" })))).toBe(false);
  });

  it("a mechanism with physical access offers manual only or notification", () => {
    expect(updateDelivery.valuesFor!(contextOf(system("mp", { updateMechanism: "manual_local" })))).toEqual(["manual_only", "notification"]);
    expect(updateDelivery.valuesFor!(contextOf(system("mp", { updateMechanism: "signed_ota" })))).toEqual([
      "manual_only",
      "notification",
      "on_request_or_scheduled",
      "automatic",
    ]);
  });
});

describe("F-27b updateDefaults", () => {
  it("only with automatic delivery on an updated element — a stored automatic delivery without mechanism shows nothing", () => {
    expect(isFieldShown(updateDefaults, contextOf(system("mp", { updateMechanism: "signed_ota", updateDelivery: "automatic" })))).toBe(true);
    expect(isFieldShown(updateDefaults, contextOf(system("mp", { updateMechanism: "signed_ota", updateDelivery: "notification" })))).toBe(false);
    expect(isFieldShown(updateDefaults, contextOf(system("mp", { updateMechanism: "none", updateDelivery: "automatic" })))).toBe(false);
  });

  it("is a multi-select", () => {
    expect(updateDefaults.multiple).toBe(true);
  });
});

describe("F-25a / F-25b on the element that stands for the component", () => {
  it("every multiprocess", () => {
    for (const field of [secureByDefault, securityConfigReporting]) expect(isFieldShown(field, contextOf(system("mp")))).toBe(true);
  });

  it("a process when the model has no multiprocess, or when it is the component under evaluation", () => {
    expect(isFieldShown(secureByDefault, contextOf(process("p"), [process("q")]))).toBe(true);
    expect(isFieldShown(secureByDefault, contextOf(process("p"), [system("mp")]))).toBe(false);
    expect(isFieldShown(secureByDefault, contextOf(process("p"), [system("mp")], "p"))).toBe(true);
  });
});
