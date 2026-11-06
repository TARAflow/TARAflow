// Visibility of model coverage fields (shared/models/property-visibility.ts,
// model-coverage-implementation-plan.md §3 R-1 … R-4, K-7). The mechanism is
// tested with a test registry; the real fields join with CM-5 … CM-7.
import { describe, it, expect } from "vitest";
import {
  MODEL_FIELDS,
  modelField,
  isFieldShown,
  isUnset,
  readModelField,
  visibilityContexts,
  withoutHiddenFields,
  type ModelField,
  type VisibilityContext,
} from "shared";

/** Shown on a process that has an incoming password flow — the shape of F-2a. */
const PASSWORD_RULES: ModelField = {
  property: "testPasswordRules",
  group: "login",
  elementTypes: ["Process"],
  values: ["not_specified", "none", "configurable"],
  shownWhen: (c) => c.incoming.some((l) => l.flow.properties?.endpointAuthentication === "password"),
};

const elements = [
  { id: "p1", type: "Process", properties: { testPasswordRules: "configurable" } },
  { id: "ee", type: "ExternalEntity", properties: {} },
  { id: "ds", type: "DataStore", properties: { testPasswordRules: "none" } },
];
const flows = (auth: string) => [{ id: "f1", from: "ee", to: "p1", properties: { endpointAuthentication: auth } }];
const contextOf = (auth: string, id = "p1") => visibilityContexts(elements, flows(auth))(id)!;

describe("isUnset (R-1)", () => {
  it("absent, empty, not_specified and an empty selection are unset; no and false are values", () => {
    for (const v of [undefined, null, "", "not_specified", []]) expect(isUnset(v), String(v)).toBe(true);
    for (const v of ["no", false, 0, ["x"]]) expect(isUnset(v), String(v)).toBe(false);
  });
});

describe("visibilityContexts", () => {
  it("an element sees its incoming and outgoing flows with the element at the other end", () => {
    const p1 = contextOf("password");
    expect(p1.incoming.map((l) => [l.flow.id, l.other?.id])).toEqual([["f1", "ee"]]);
    expect(p1.outgoing).toEqual([]);
    expect(contextOf("password", "ee").outgoing.map((l) => l.other?.id)).toEqual(["p1"]);
  });

  it("a flow sees its endpoints; an unknown id has no context", () => {
    const f1 = contextOf("password", "f1");
    expect(f1.element).toMatchObject({ id: "f1", type: "DataFlow" });
    expect([f1.endpoints?.from?.id, f1.endpoints?.to?.id]).toEqual(["ee", "p1"]);
    expect(visibilityContexts(elements, flows("password"))("nope")).toBeUndefined();
  });
});

describe("isFieldShown / readModelField (R-3, R-4)", () => {
  it("shown when the driver holds; then the stored value is read", () => {
    expect(isFieldShown(PASSWORD_RULES, contextOf("password"))).toBe(true);
    expect(readModelField(PASSWORD_RULES, contextOf("password"))).toBe("configurable");
  });

  it("hidden when the driver does not hold: read as unset", () => {
    expect(isFieldShown(PASSWORD_RULES, contextOf("certificate"))).toBe(false);
    expect(readModelField(PASSWORD_RULES, contextOf("certificate"))).toBeUndefined();
  });

  it("never shown on an element type that does not carry it (R-6)", () => {
    const store: VisibilityContext = { element: elements[2], incoming: contextOf("password").incoming, outgoing: [] };
    expect(isFieldShown(PASSWORD_RULES, store)).toBe(false);
  });
});

describe("withoutHiddenFields (R-4, K-7)", () => {
  it("removes a hidden field from the copy, keeps the stored model, and the value returns with the driver", () => {
    const hidden = withoutHiddenFields(elements, flows("certificate"), [PASSWORD_RULES]);
    expect(hidden.elements.find((e) => e.id === "p1")!.properties).toEqual({});
    expect(elements[0].properties).toEqual({ testPasswordRules: "configurable" });
    const shown = withoutHiddenFields(elements, flows("password"), [PASSWORD_RULES]);
    expect(shown.elements.find((e) => e.id === "p1")!.properties).toEqual({ testPasswordRules: "configurable" });
  });

  it("elements and flows without a hidden field are the same objects", () => {
    const shown = withoutHiddenFields(elements, flows("password"), [PASSWORD_RULES]);
    expect(shown.elements[0]).toBe(elements[0]);
    expect(shown.elements[1]).toBe(elements[1]);
    // The data store holds the key but does not carry the field: masked as hidden.
    expect(shown.elements[2].properties).toEqual({});
  });

  it("without registered fields nothing changes", () => {
    const f = flows("password");
    const out = withoutHiddenFields(elements, f, []);
    expect(out.elements.every((e, i) => e === elements[i])).toBe(true);
    expect(out.flows[0]).toBe(f[0]);
  });
});

describe("inside fields of a black box (D-30c)", () => {
  const els = [{ id: "mp", type: "Multiprocess", properties: { innerInputValidation: "strict" } }];
  const field = modelField("innerInputValidation", MODEL_FIELDS)!;

  it("shown on a multiprocess without child page; hidden — and read as unset — once it has one", () => {
    expect(isFieldShown(field, visibilityContexts(els, [])("mp")!)).toBe(true);
    const decomposed = visibilityContexts(els, [], { decomposed: new Set(["mp"]) })("mp")!;
    expect(isFieldShown(field, decomposed)).toBe(false);
    expect(readModelField(field, decomposed)).toBeUndefined();
    expect(withoutHiddenFields(els, [], MODEL_FIELDS, { decomposed: new Set(["mp"]) }).elements[0].properties).toEqual({});
  });

  it("only on multiprocesses, in the tab of their topic (user 2026-11-06)", () => {
    const groups = Object.fromEntries(
      MODEL_FIELDS.filter((x) => x.property.startsWith("inner")).map((f) => {
        expect(f.elementTypes).toEqual(["Multiprocess"]);
        return [f.property, f.group];
      }),
    );
    expect(groups).toEqual({
      innerInputValidation: "robustness",
      innerErrorHandling: "robustness",
      innerFailSafeOutputState: "robustness",
      innerDataClassification: "data",
      innerEncryptionAtRest: "data",
      innerIntegrityProtection: "data",
      innerDeletionMechanism: "operation",
    });
  });
});
