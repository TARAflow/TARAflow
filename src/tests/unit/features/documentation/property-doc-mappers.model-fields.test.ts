import { describe, it, expect, beforeAll } from "vitest";

import { getElementPropertiesGrouped } from "../../../../features/documentation/utils/generators/property-doc-mappers";
import { initI18nNode } from "../../../../../taraflow-reporter/cli/i18n-node";
import type { DFDElement } from "../../../../features/dfd/models/dfd-types";
import { visibilityContexts, type VisibilityElement, type VisibilityFlowInput } from "../../../../shared/models/property-visibility";

// Model coverage fields in the report's element table (model-coverage-
// implementation-plan.md R-4, R-7; CM-5a): listed in the security group with
// the form's labels where the predicate shows them — never where hidden,
// and not at all without the element's model.

beforeAll(async () => {
  await initI18nNode("en");
});

const operator = { id: "op", type: "ExternalEntity", properties: { entityType: "operator" } };
const process = (properties: Record<string, unknown>) =>
  ({ id: "p", type: "Process", name: "HMI", displayId: "P-1", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties }) as unknown as DFDElement;
const login: VisibilityFlowInput = { id: "f", from: "op", to: "p", properties: { endpointAuthentication: "password" } };

function security(element: DFDElement, flows: VisibilityFlowInput[] | null) {
  const context = flows ? visibilityContexts([element as unknown as VisibilityElement, operator], flows)("p") : undefined;
  const groups = getElementPropertiesGrouped(element, "en", context);
  return Object.fromEntries(groups[1].properties.map((p) => [p.label, p.value]));
}

describe("getElementPropertiesGrouped — model coverage fields", () => {
  const hmi = process({ authenticationRequired: "yes", userAccounts: "individual", passwordStrength: "configurable_policy" });

  it("shown fields with their labels and value labels; unset ones N/A", () => {
    const rows = security(hmi, [login]);
    expect(rows["User accounts"]).toBe("One account per person");
    expect(rows["Password strength rules"]).toBe("Configurable policy");
    expect(rows["Password lifetime limits"]).toBe("N/A");
  });

  it("hidden fields are left out although they are stored (R-4)", () => {
    const rows = security(hmi, [{ ...login, properties: { endpointAuthentication: "certificate" } }]);
    expect(rows["User accounts"]).toBe("One account per person");
    expect(rows).not.toHaveProperty("Password strength rules");
  });

  it("without the element's model no field is listed", () => {
    expect(security(hmi, null)).not.toHaveProperty("User accounts");
  });
});

describe("getElementPropertiesGrouped — session settings follow the form (CM-5d)", () => {
  const withSessions = process({ sessionControl: { sessionLockEnabled: true } });
  const plc = { id: "plc", type: "ExternalEntity", properties: { entityType: "plc" } };
  const rows = (flows: VisibilityFlowInput[]) => {
    const context = visibilityContexts([withSessions as unknown as VisibilityElement, operator, plc], flows)("p");
    return Object.fromEntries(getElementPropertiesGrouped(withSessions, "en", context)[1].properties.map((p) => [p.label, p.value]));
  };

  it("listed where human users reach the element", () => {
    expect(rows([{ id: "f", from: "op", to: "p" }])["Session Lock after Inactivity"]).toBe("Yes");
  });

  it("left out where only machines do — although stored", () => {
    expect(rows([{ id: "f", from: "plc", to: "p" }])).not.toHaveProperty("Session Lock after Inactivity");
  });
});
