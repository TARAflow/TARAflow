// CR 1.1 RE(1), CR 1.7 (+ RE(1), RE(2)) and CR 2.1 RE(2) from the identity
// fields (model-coverage-implementation-plan.md §4.2 F-1, F-2a, F-2b, F-29;
// CM-5a, CM-5c): type A
// in both editions, decided on the element that verifies the login, with the
// same conditions that show the fields. An unset field is unknown, never met
// (R-1, R-8).
import { describe, it, expect } from "vitest";
import { EDITION_2019, EDITION_PRAA_2026, evaluateMatrix, type Edition, type ViewElement, type ViewFlow } from "features/compliance";

const operator: ViewElement = { id: "op", type: "ExternalEntity", properties: { entityType: "operator" } };
const scada: ViewElement = { id: "scada", type: "ExternalEntity", properties: { entityType: "scada_hmi" } };
const flow = (id: string, from: string, to: string, endpointAuthentication?: string): ViewFlow => ({
  id,
  from,
  to,
  properties: endpointAuthentication ? { endpointAuthentication } : {},
});

function rowStatus(edition: Edition, label: string, element: ViewElement, flows: ViewFlow[]) {
  const row = edition.rows.find((r) => r.label === label)!;
  return evaluateMatrix({
    edition: { ...edition, rows: [row] },
    view: { elements: [element, operator, scada], flows },
    scope: new Set([element.id]),
    run: "achieved",
  }).rows[0];
}
const hmi = (properties: Record<string, unknown>): ViewElement => ({ id: "p", type: "Process", properties });

describe("CR 1.1 RE(1) — individual accounts (F-1)", () => {
  const login = [flow("f", "op", "p", "password")];
  it.each([EDITION_PRAA_2026, EDITION_2019])("$id: individual met, shared gap, unset unknown", (edition) => {
    expect(rowStatus(edition, "CR 1.1 RE(1)", hmi({ authenticationRequired: "yes", userAccounts: "individual" }), login).status).toBe("met");
    expect(rowStatus(edition, "CR 1.1 RE(1)", hmi({ authenticationRequired: "yes", userAccounts: "shared" }), login).status).toBe("gap");
    expect(rowStatus(edition, "CR 1.1 RE(1)", hmi({ authenticationRequired: "yes" }), login).status).toBe("unknown");
  });

  it("a login per role or one shared login: CR 1.1 met (role-based identification is allowed), RE(1) not", () => {
    for (const userAccounts of ["per_role", "shared"]) {
      const element = hmi({ authenticationRequired: "yes", userAccounts });
      expect(rowStatus(EDITION_2019, "CR 1.1 RE(1)", element, login).status, userAccounts).toBe("gap");
      expect(rowStatus(EDITION_2019, "CR 1.1", element, login).status, userAccounts).toBe("met");
    }
  });

  it("a process serving humans that states it does not authenticate fails — a stored value does not help", () => {
    const row = rowStatus(EDITION_PRAA_2026, "CR 1.1 RE(1)", hmi({ authenticationRequired: "no", userAccounts: "individual" }), login);
    expect(row).toMatchObject({ status: "gap", failing: ["p"] });
  });

  it("authentication not decided yet: unknown; no human users: n/a", () => {
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.1 RE(1)", hmi({}), login).status).toBe("unknown");
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.1 RE(1)", hmi({ authenticationRequired: "yes" }), [flow("f", "scada", "p")]).status).toBe("n/a");
  });
});

describe("CR 1.7 — configurable password strength (F-2a)", () => {
  const login = [flow("f", "op", "p", "password")];
  it.each([EDITION_PRAA_2026, EDITION_2019])("$id: configurable policy met, fixed rules gap, unset unknown", (edition) => {
    expect(rowStatus(edition, "CR 1.7", hmi({ passwordStrength: "configurable_policy" }), login).status).toBe("met");
    expect(rowStatus(edition, "CR 1.7", hmi({ passwordStrength: "fixed_rules" }), login).status).toBe("gap");
    expect(rowStatus(edition, "CR 1.7", hmi({}), login).status).toBe("unknown");
  });

  it("no password reaches the component: n/a — also when it logs in elsewhere with one", () => {
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.7", hmi({}), [flow("f", "op", "p", "certificate")]).status).toBe("n/a");
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.7", hmi({}), [flow("f", "p", "scada", "password")]).status).toBe("n/a");
  });
});

describe("CR 1.7 RE(1) / RE(2) — password lifetime (F-2b)", () => {
  const humans = [flow("f", "op", "p", "password")];
  const machines = [flow("f", "scada", "p", "password")];
  const both = [...humans, flow("g", "scada", "p", "password")];

  it("2019 RE(1): human accounts or all; n/a without human password logins", () => {
    expect(rowStatus(EDITION_2019, "CR 1.7 RE(1)", hmi({ passwordLifetime: "human_accounts" }), humans).status).toBe("met");
    expect(rowStatus(EDITION_2019, "CR 1.7 RE(1)", hmi({ passwordLifetime: "none" }), humans).status).toBe("gap");
    expect(rowStatus(EDITION_2019, "CR 1.7 RE(1)", hmi({}), machines).status).toBe("n/a");
  });

  it("2019 RE(2): every kind of account in use — humans only: human accounts suffice; both: all accounts", () => {
    expect(rowStatus(EDITION_2019, "CR 1.7 RE(2)", hmi({ passwordLifetime: "human_accounts" }), humans).status).toBe("met");
    expect(rowStatus(EDITION_2019, "CR 1.7 RE(2)", hmi({ passwordLifetime: "human_accounts" }), both).status).toBe("gap");
    expect(rowStatus(EDITION_2019, "CR 1.7 RE(2)", hmi({ passwordLifetime: "all_accounts" }), both).status).toBe("met");
  });

  it("prAA RE(2): software processes and devices only", () => {
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.7 RE(2)", hmi({ passwordLifetime: "machine_accounts" }), machines).status).toBe("met");
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.7 RE(2)", hmi({ passwordLifetime: "human_accounts" }), machines).status).toBe("gap");
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.7 RE(2)", hmi({}), humans).status).toBe("n/a");
    expect(rowStatus(EDITION_PRAA_2026, "CR 1.7 RE(2)", hmi({}), machines).status).toBe("unknown");
  });
});

describe("CR 2.1 RE(2) — permission mapping to roles (F-29)", () => {
  const status = (properties: Record<string, unknown>) =>
    rowStatus(EDITION_PRAA_2026, "CR 2.1 RE(2)", hmi({ authenticationRequired: "yes", ...properties }), []).status;

  it("RBAC: configurable met, fixed roles gap, not stated unknown — RBAC alone no longer meets it", () => {
    expect(status({ authorizationModel: "rbac", roleMapping: "configurable" })).toBe("met");
    expect(status({ authorizationModel: "rbac", roleMapping: "fixed_roles" })).toBe("gap");
    expect(status({ authorizationModel: "rbac" })).toBe("unknown");
  });

  it("another authorization model has no roles to map: gap; none chosen yet: unknown", () => {
    expect(status({ authorizationModel: "acl", roleMapping: "configurable" })).toBe("gap");
    expect(status({})).toBe("unknown");
  });
});
