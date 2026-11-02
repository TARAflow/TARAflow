// F-1 userAccounts, F-2a passwordStrength, F-2b passwordLifetime, F-29
// roleMapping (model-coverage-implementation-plan.md §4.2, CM-5a / CM-5c): each field appears
// only where the settings made before it make it meaningful (user
// 2026-11-02), offers only fitting values, and keeps its value while hidden
// (K-7).
import { describe, it, expect } from "vitest";
import {
  isFieldShown,
  MODEL_CONDITIONS,
  modelField,
  readModelField,
  visibilityContexts,
  type VisibilityElement,
  type VisibilityFlowInput,
} from "shared";

const userAccounts = modelField("userAccounts")!;
const passwordStrength = modelField("passwordStrength")!;
const passwordLifetime = modelField("passwordLifetime")!;
const roleMapping = modelField("roleMapping")!;
const defaultCredentials = modelField("defaultCredentials")!;
const authenticatorChangeable = modelField("authenticatorChangeable")!;
const loginLockout = modelField("loginLockout")!;

const operator: VisibilityElement = { id: "op", type: "ExternalEntity", properties: { entityType: "operator" } };
const scada: VisibilityElement = { id: "scada", type: "ExternalEntity", properties: { entityType: "scada_hmi" } };
const flow = (id: string, from: string, to: string, endpointAuthentication?: string): VisibilityFlowInput => ({
  id,
  from,
  to,
  properties: endpointAuthentication ? { endpointAuthentication } : {},
});

function contextOf(element: VisibilityElement, flows: VisibilityFlowInput[], others = [operator, scada]) {
  return visibilityContexts([element, ...others], flows)(element.id)!;
}
const process = (properties: Record<string, unknown>): VisibilityElement => ({ id: "p", type: "Process", properties });
const system = (properties: Record<string, unknown>): VisibilityElement => ({ id: "mp", type: "Multiprocess", properties });

describe("F-1 userAccounts: the element authenticates human users", () => {
  it("shown on a process that authenticates and has a human neighbour", () => {
    expect(isFieldShown(userAccounts, contextOf(process({ authenticationRequired: "yes" }), [flow("f", "op", "p")]))).toBe(true);
    expect(isFieldShown(userAccounts, contextOf(system({ boundaryAuthentication: "certificate" }), [flow("f", "mp", "op")]))).toBe(true);
  });

  it("hidden without authentication, with an explicit no, or without human neighbours", () => {
    expect(isFieldShown(userAccounts, contextOf(process({}), [flow("f", "op", "p")]))).toBe(false);
    expect(isFieldShown(userAccounts, contextOf(process({ authenticationRequired: "no" }), [flow("f", "op", "p")]))).toBe(false);
    expect(isFieldShown(userAccounts, contextOf(system({ boundaryAuthentication: "none" }), [flow("f", "op", "mp")]))).toBe(false);
    expect(isFieldShown(userAccounts, contextOf(process({ authenticationRequired: "yes" }), [flow("f", "scada", "p")]))).toBe(false);
  });

  it("the value is kept while hidden and returns with the driver (K-7)", () => {
    const flows = [flow("f", "op", "p")];
    expect(readModelField(userAccounts, contextOf(process({ authenticationRequired: "no", userAccounts: "individual" }), flows))).toBeUndefined();
    expect(readModelField(userAccounts, contextOf(process({ authenticationRequired: "yes", userAccounts: "individual" }), flows))).toBe("individual");
  });
});

describe("F-2a / F-2b: a password reaches the element", () => {
  it("an incoming password flow; a multiprocess's boundary password", () => {
    expect(isFieldShown(passwordStrength, contextOf(process({}), [flow("f", "op", "p", "password")]))).toBe(true);
    expect(isFieldShown(passwordStrength, contextOf(system({ boundaryAuthentication: "password" }), []))).toBe(true);
    expect(isFieldShown(passwordLifetime, contextOf(process({}), [flow("f", "op", "p", "password")]))).toBe(true);
  });

  it("hidden for other mechanisms, for an outgoing password flow, and where the element states it does not authenticate", () => {
    expect(isFieldShown(passwordStrength, contextOf(process({}), [flow("f", "op", "p", "certificate")]))).toBe(false);
    // The process logs in to another system with a password: not its password check.
    expect(isFieldShown(passwordStrength, contextOf(process({}), [flow("f", "p", "scada", "password")]))).toBe(false);
    expect(isFieldShown(passwordStrength, contextOf(process({ authenticationRequired: "no" }), [flow("f", "op", "p", "password")]))).toBe(false);
  });
});

describe("F-2b passwordLifetime offers only the kinds of accounts that log in with a password here", () => {
  const values = (element: VisibilityElement, flows: VisibilityFlowInput[]) => passwordLifetime.valuesFor!(contextOf(element, flows));

  it("humans only / machines only / both", () => {
    expect(values(process({}), [flow("f", "op", "p", "password")])).toEqual(["none", "human_accounts"]);
    expect(values(process({}), [flow("f", "scada", "p", "password")])).toEqual(["none", "machine_accounts"]);
    expect(values(process({}), [flow("f1", "op", "p", "password"), flow("f2", "scada", "p", "password")])).toEqual([
      "none",
      "human_accounts",
      "machine_accounts",
      "all_accounts",
    ]);
  });

  it("a boundary password: by the kinds of external neighbours; none known → every value", () => {
    expect(values(system({ boundaryAuthentication: "password" }), [flow("f", "op", "mp")])).toEqual(["none", "human_accounts"]);
    expect(values(system({ boundaryAuthentication: "password" }), [])).toEqual(["none", "human_accounts", "machine_accounts", "all_accounts"]);
  });

  it("the conditions behind it", () => {
    const both = contextOf(process({}), [flow("f1", "op", "p", "password"), flow("f2", "scada", "p", "password")]);
    expect(MODEL_CONDITIONS.humanPasswordUse(both)).toBe(true);
    expect(MODEL_CONDITIONS.machinePasswordUse(both)).toBe(true);
    // A password from a human that reaches a process stating "no authentication" counts for nothing.
    const denied = contextOf(process({ authenticationRequired: "no" }), [flow("f", "op", "p", "password")]);
    expect(MODEL_CONDITIONS.humanPasswordUse(denied)).toBe(false);
  });
});

describe("F-29 roleMapping: role-based authorization", () => {
  it("shown with authorizationModel = rbac; hidden with other models, unset, or an element that does not authenticate", () => {
    expect(isFieldShown(roleMapping, contextOf(process({ authenticationRequired: "yes", authorizationModel: "rbac" }), []))).toBe(true);
    expect(isFieldShown(roleMapping, contextOf(system({ authorizationModel: "rbac" }), []))).toBe(true);
    expect(isFieldShown(roleMapping, contextOf(process({ authorizationModel: "acl" }), []))).toBe(false);
    expect(isFieldShown(roleMapping, contextOf(process({}), []))).toBe(false);
    expect(isFieldShown(roleMapping, contextOf(process({ authenticationRequired: "no", authorizationModel: "rbac" }), []))).toBe(false);
  });

  it("userAccounts knows the login per role of industrial devices", () => {
    expect(userAccounts.values).toEqual(["not_specified", "individual", "per_role", "shared"]);
  });
});

describe("F-3 defaultCredentials / F-3b authenticatorChangeable: the element authenticates", () => {
  it("shown with any authentication — also between machines; hidden without", () => {
    for (const field of [defaultCredentials, authenticatorChangeable]) {
      expect(isFieldShown(field, contextOf(process({ authenticationRequired: "certificate" }), [flow("f", "scada", "p")]))).toBe(true);
      expect(isFieldShown(field, contextOf(system({ boundaryAuthentication: "password" }), []))).toBe(true);
      expect(isFieldShown(field, contextOf(process({}), []))).toBe(false);
      expect(isFieldShown(field, contextOf(process({ authenticationRequired: "no" }), []))).toBe(false);
    }
  });

  it("changeable is three-valued (R-1)", () => {
    expect(authenticatorChangeable.values).toEqual(["not_specified", "yes", "no"]);
  });
});

describe("F-5 loginLockout on the verifier (CM-8b)", () => {
  it("shown where a guessable login arrives; not for certificates, outgoing logins or an element without authentication", () => {
    expect(isFieldShown(loginLockout, contextOf(process({}), [flow("f", "op", "p", "password")]))).toBe(true);
    expect(isFieldShown(loginLockout, contextOf(process({}), [flow("f", "scada", "p", "pairing")]))).toBe(true);
    expect(isFieldShown(loginLockout, contextOf(system({ boundaryAuthentication: "mfa" }), []))).toBe(true);
    expect(isFieldShown(loginLockout, contextOf(process({}), [flow("f", "op", "p", "certificate")]))).toBe(false);
    expect(isFieldShown(loginLockout, contextOf(process({}), [flow("f", "p", "scada", "password")]))).toBe(false);
    expect(isFieldShown(loginLockout, contextOf(process({ authenticationRequired: "no" }), [flow("f", "op", "p", "password")]))).toBe(false);
  });
});
