// tests/unit/shared/utils/control-applicability.test.ts
//
// Closed-loop review CL-1b (finding 6): a mitigation's Interface controls must
// fit the interface type — debug-interface controls do not reach WLAN.

import { describe, it, expect } from "vitest";
import "i18n/services/i18n";
import { mitigationFitsInterface } from "shared/utils/control-applicability";
import {
  hasServiceLayerControl,
  isInterfaceControlKeyApplicable,
} from "shared/models/interface-capability-registry";
import { INTERFACE_TYPE_META, isControlApplicable } from "features/dfd/models/interface-type-registry";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { computeAllMitigationCoverage } from "shared/utils/mitigation-coverage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const effectsOf = (id: string) => getAllMitigations().find((m) => m.id === id)!.affectsProperties;

describe("interface applicability in the shared registry", () => {
  it("hasServiceLayer reproduces the former group rule (not hmi, not io) for every type", () => {
    for (const [type, meta] of Object.entries(INTERFACE_TYPE_META)) {
      expect([type, hasServiceLayerControl(type as never)]).toEqual([type, meta.group !== "hmi" && meta.group !== "io"]);
    }
  });

  it("the string-keyed check agrees with the forms' rule for all six keys", () => {
    const keys = ["physicalAccessProtection", "signalProtection", "debugProtection", "linkAuthentication", "serviceAccessPolicy", "monitoringControl"];
    for (const type of Object.keys(INTERFACE_TYPE_META)) {
      for (const key of keys) {
        expect([type, key, isInterfaceControlKeyApplicable(type, key)]).toEqual([type, key, isControlApplicable(type as never, key as never)]);
      }
    }
    expect(isInterfaceControlKeyApplicable(undefined, "debugProtection")).toBe(true);
    expect(isInterfaceControlKeyApplicable("wifi", "abuseProtection")).toBe(true);
  });
});

describe("mitigationFitsInterface", () => {
  it("debug controls (M-E-006, both effects) fit JTAG, not WLAN or RS-485", () => {
    expect(mitigationFitsInterface(effectsOf("M-E-006"), { type: "jtag" })).toBe(true);
    expect(mitigationFitsInterface(effectsOf("M-E-006"), { type: "wifi" })).toBe(false);
    expect(mitigationFitsInterface(effectsOf("M-E-006"), { type: "rs485" })).toBe(false);
  });

  it("no type chosen yet, or no Interface control: fits", () => {
    expect(mitigationFitsInterface(effectsOf("M-E-006"), {})).toBe(true);
    expect(mitigationFitsInterface([{ targetType: "Interface", property: "operationalState" }], { type: "wifi" })).toBe(true);
  });

  it("the closed loop and the coverage skip WLAN, keep JTAG", () => {
    const threat = (id: string, el: string): Any => ({ id, linkedElement: { elementId: el, elementType: "Interface" } });
    const threats: Any = { perElementTables: [{ threats: [threat("t-wifi", "if-wifi"), threat("t-jtag", "if-jtag")] }], perInteractionTables: [] };
    const risks: Any = {
      risks: ["t-wifi", "t-jtag"].map((t) => ({ id: `r-${t}`, threatId: t, treatment: "reduce", selectedMitigations: [{ id: "M-E-006", status: "open" }] })),
    };
    const dfd: Any = {
      elements: [
        { id: "if-wifi", properties: { type: "wifi" } },
        { id: "if-jtag", properties: { type: "jtag" } },
      ],
      connections: [],
    };
    const instances = deriveControlInstances(threats, risks, dfd, getAllMitigations());
    expect([...new Set(instances.map((i) => i.elementId))]).toEqual(["if-jtag"]);
    expect(computeAllMitigationCoverage(["M-E-006"], threat("t-wifi", "if-wifi"), dfd, getAllMitigations()).get("M-E-006")).toBeNull();
    expect(computeAllMitigationCoverage(["M-E-006"], threat("t-jtag", "if-jtag"), dfd, getAllMitigations()).get("M-E-006")).not.toBeNull();
  });
});
