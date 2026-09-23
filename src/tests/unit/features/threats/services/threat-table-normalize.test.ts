// src/tests/unit/features/threats/services/threat-table-normalize.test.ts
//
// Legacy element-keyed tables ({ elementId, elementName, threats }) rendered
// as untitled accordions sharing the React key "none-undefined" and survived
// every regeneration. normalizeThreatTables dissolves them into the table of
// the threat's own trust boundary, aligns manual threats with their table and
// makes manual labels unique. Shapes mirror the Nussbaum DataTrack project.

import { describe, it, expect } from "vitest";
import type { Threat, ThreatTable } from "features/threats/models/threat-types";
import { normalizeThreatTables } from "features/threats/services/threat-table-normalize";
import { applyLegacyMigrations } from "app/services/migration-service";

const MDTB = { id: "tb-md", name: "Mobile Device [MDTB]", display: "MDTB" };
const AZURE = { id: "tb-az", name: "Azure VNet/Tenant [TB-2]", display: "TB-2" };

function threat(
  id: string,
  displayId: string,
  tb: typeof MDTB,
  over: Partial<Threat> = {},
): Threat {
  return {
    id,
    displayId,
    strideCategory: "I",
    sequenceNumber: Number(displayId.split("-").pop()),
    trustBoundaryId: tb.id,
    trustBoundaryName: tb.name,
    trustBoundaryDisplayId: tb.display,
    linkedElement: null,
    dataFlow: null,
    threatDescription: displayId,
    attackDescription: "",
    causeDescription: "",
    linkedAssetIds: [],
    source: "generated:cianaaa",
    proposedMitigations: [],
    proposedVerifications: [],
    relevance: "unrated",
    ...over,
  } as Threat;
}

function tbTable(tb: typeof MDTB, threats: Threat[]): ThreatTable {
  return {
    trustBoundaryId: tb.id,
    trustBoundaryName: tb.name,
    displayIdentifier: `[${tb.display}]`,
    threats,
  };
}

/** The legacy shape: keyed by element, no boundary fields, no title. */
function legacyElementTable(threats: Threat[]): ThreatTable {
  return {
    elementId: "ds-4",
    elementDisplayId: "DS-4",
    elementName: "Inspector Cache",
    threats,
  } as unknown as ThreatTable;
}

describe("normalizeThreatTables", () => {
  it("moves threats of a legacy element table into their boundary table", () => {
    const tables = [
      tbTable(MDTB, [threat("g", "DS4-I-1", MDTB)]),
      legacyElementTable([threat("m", "DS4-T-1", MDTB, { source: "manual", strideCategory: "T" })]),
    ];

    const out = normalizeThreatTables(tables);

    expect(out).toHaveLength(1);
    expect(out[0].displayIdentifier).toBe("[MDTB]");
    expect(out[0].threats.map((t) => t.id)).toEqual(["g", "m"]);
  });

  it("re-numbers a moved manual threat that collides with a generated label", () => {
    const tables = [
      tbTable(MDTB, [threat("g", "DS4-I-1", MDTB)]),
      legacyElementTable([threat("m", "DS4-I-1", MDTB, { source: "manual" })]),
    ];

    const labels = normalizeThreatTables(tables)[0].threats.map((t) => t.displayId);

    expect(labels).toEqual(["DS4-I-1", "DS4-I-2"]);
  });

  it("keeps a threat whose boundary has no table in a TITLED carried-over table", () => {
    const tables = [
      tbTable(MDTB, [threat("g", "DS4-I-1", MDTB)]),
      legacyElementTable([threat("m", "P9-S-1", AZURE, { source: "manual" })]),
    ];

    const out = normalizeThreatTables(tables);

    expect(out).toHaveLength(2);
    expect(out[1].displayIdentifier).toBe("[TB-2]");
    expect(out[1].trustBoundaryId).toBe(AZURE.id);
    expect(out[1].threats[0].id).toBe("m");
  });

  it("aligns a manual threat's boundary fields with the table it sits in", () => {
    // P-13 lives in the Azure boundary; the manual threat claimed MDTB.
    const tables = [
      tbTable(AZURE, [
        threat("g", "P13-I-1", AZURE),
        threat("m", "P13-S-1", MDTB, { source: "manual", strideCategory: "S" }),
      ]),
    ];

    const moved = normalizeThreatTables(tables)[0].threats[1];

    expect(moved.trustBoundaryId).toBe(AZURE.id);
    expect(moved.trustBoundaryName).toBe(AZURE.name);
    expect(moved.trustBoundaryDisplayId).toBe("TB-2");
  });

  it("returns the same array for already clean tables (idempotent, no churn)", () => {
    const tables = [
      tbTable(MDTB, [threat("g", "DS4-I-1", MDTB), threat("m", "DS4-I-2", MDTB, { source: "manual" })]),
    ];

    expect(normalizeThreatTables(tables)).toBe(tables);
  });
});

describe("applyLegacyMigrations — repairs threat tables on load", () => {
  it("dissolves legacy tables and is a no-op on the repaired result", () => {
    const raw = {
      threats: {
        perElementTables: [
          tbTable(MDTB, [threat("g", "DS4-I-1", MDTB)]),
          legacyElementTable([threat("m", "DS4-I-1", MDTB, { source: "manual" })]),
        ],
        perInteractionTables: [],
      },
    };

    const out = applyLegacyMigrations(raw);

    expect(out.threats.perElementTables).toHaveLength(1);
    expect(applyLegacyMigrations(out).threats).toBe(out.threats);
  });
});
