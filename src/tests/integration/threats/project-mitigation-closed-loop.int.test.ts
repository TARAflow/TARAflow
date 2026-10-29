// Custom mitigation catalog design CM-4 — integration test.
//
// A self-defined threat with a project mitigation M-C-nnn reaches the closed
// loop end to end, on the SmokeDetector fixture's DFD, through the REAL
// services (no mocks):
//
//   project catalog ──setProjectMitigations──► catalog / texts
//   manual threat + risk selecting M-C-001 ──deriveControlInstances──► SHOULD
//   SHOULD × DFD ──computeSecurityDrifts──► missing / aligned
//   threat × DFD ──computeAllMitigationCoverage──► "already implemented"

import { afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import "i18n/services/i18n";
import {
  getAllMitigations,
  resolveMitigationDrafts,
  setProjectMitigations,
} from "features/threats/services/threat-catalog-service";
import { addProjectMitigation, projectEffect } from "features/threats/services/project-mitigations";
import { DEFAULT_THREAT_CONFIGURATION, createEmptyThreat } from "features/threats/models/threat-types";
import { deriveControlInstances } from "app/hooks/use-control-instance-derivation";
import { computeSecurityDrifts } from "app/hooks/use-security-drift";
import { computeAllMitigationCoverage } from "shared/utils/mitigation-coverage";
import { projectMitigationUsage } from "app/services/project-mitigation-usage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const fixture: Any = JSON.parse(
  readFileSync(path.join(__dirname, "../../fixtures/SmokeDetector.tara.json"), "utf-8"),
);

afterEach(() => setProjectMitigations(undefined));

describe("project mitigation in the closed loop (SmokeDetector)", () => {
  // "Sensor Communication Controller" — inputValidation "basic" in the fixture
  const element = fixture.dfd.elements.find((e: Any) => e.id === "P-10");

  const setup = (inputValidation: string) => {
    const { configuration } = addProjectMitigation(DEFAULT_THREAT_CONFIGURATION, {
      text: "Reject malformed loop telegrams",
      strideCategory: "T",
      affectsProperties: [projectEffect({ targetType: "Process", property: "inputValidation" }, "strict")],
    });
    setProjectMitigations(configuration.customMitigations);

    const threat = {
      ...createEmptyThreat("manual-1", "T", null, "No Trust Boundary", "UB"),
      displayId: "P2-T-9",
      source: "manual",
      linkedElement: { elementId: element.id, elementName: element.name, elementType: "Process" },
      proposedMitigations: [{ id: "M-C-001" }],
    };
    const threats: Any = {
      configuration,
      perElementTables: [{ trustBoundaryId: null, trustBoundaryName: "", displayIdentifier: "[UB]", threats: [threat] }],
      perInteractionTables: [],
    };
    const risks: Any = {
      risks: [{ id: "r-1", threatId: threat.id, threatDisplayId: threat.displayId, treatment: "reduce", selectedMitigations: [{ id: "M-C-001", status: "open" }] }],
    };
    const dfd: Any = {
      ...fixture.dfd,
      elements: fixture.dfd.elements.map((e: Any) =>
        e.id === element.id ? { ...e, properties: { ...e.properties, inputValidation } } : e,
      ),
    };
    return { threat, threats, risks, dfd };
  };

  it("the project mitigation resolves like a catalog entry", () => {
    const { threat } = setup("basic");
    expect(resolveMitigationDrafts(threat.proposedMitigations)).toEqual([
      { id: "M-C-001", text: "Reject malformed loop telegrams", notes: undefined, isCustom: false },
    ]);
  });

  it("not set in the DFD: SHOULD missing, drift missing, not covered", () => {
    const { threat, threats, risks, dfd } = setup("none");
    const instances = deriveControlInstances(threats, risks, dfd, getAllMitigations());
    expect(instances).toEqual([
      expect.objectContaining({ elementId: "P-10", property: "inputValidation", expectedValue: "strict", status: "missing", coversMitigationIds: ["M-C-001"], coversRiskIds: ["r-1"] }),
    ]);
    expect(computeSecurityDrifts(instances, dfd).map((d) => [d.status, d.currentValue])).toEqual([["missing", "none"]]);
    expect(computeAllMitigationCoverage(["M-C-001"], threat, dfd, getAllMitigations()).get("M-C-001")?.fullyImplemented).toBe(false);
  });

  it("another value already set (the fixture's 'basic'): today a 'conflict' — to be reviewed in the closed-loop step", () => {
    const { threats, risks, dfd } = setup("basic");
    const instances = deriveControlInstances(threats, risks, dfd, getAllMitigations());
    expect(computeSecurityDrifts(instances, dfd).map((d) => [d.status, d.currentValue])).toEqual([["conflict", "basic"]]);
  });

  it("set in the DFD: implemented, aligned, covered", () => {
    const { threat, threats, risks, dfd } = setup("strict");
    const instances = deriveControlInstances(threats, risks, dfd, getAllMitigations());
    expect(instances.map((i) => i.status)).toEqual(["implemented"]);
    expect(computeSecurityDrifts(instances, dfd).map((d) => d.status)).toEqual(["aligned"]);
    expect(computeAllMitigationCoverage(["M-C-001"], threat, dfd, getAllMitigations()).get("M-C-001")?.fullyImplemented).toBe(true);
  });

  it("the project knows where it is used", () => {
    const { threats, risks } = setup("basic");
    expect(projectMitigationUsage({ threats, risks, attackTrees: null }, "M-C-001")).toEqual({
      threats: ["P2-T-9"],
      risks: ["P2-T-9"],
      attackTrees: [],
    });
  });
});
