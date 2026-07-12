// tests/unit/features/attacktree/models/attacktree-helpers.test.ts
//
// extractMitigationReferences is the adapter that mirrors mitigation
// verification into the Attack Tree tab. The Risk tab owns the truth
// (Risk.selectedMitigations[].status / .ticketId); the attack tree only
// displays it. Two ways this breaks SILENTLY:
//
//   (1) precedence: if the threat-based fallback overwrites the risk-derived
//       status, every M-xxx shows as untracked even though it's verified.
//   (2) absence: a project without risks must still resolve mitigations
//       (just without status) rather than throwing.
//
// Before the fix, `description` was hardcoded to undefined and status did not
// exist at all — the table could only ever render the bare id ("M-002").

import { describe, it, expect } from "vitest";
import { extractMitigationReferences } from "features/attacktree/models/attacktree-helpers";
import type { Project } from "app/models/project-types";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures — shaped like the slices of Project that the helper actually reads.
// Cast at the boundary: building a full Project here would test nothing extra.
// ──────────────────────────────────────────────────────────────────────────

interface ProjectSlice {
  risks?: { risks: any[] } | null;
  threats?: {
    perElementTables?: any[];
    perInteractionTables?: any[];
  } | null;
}

function makeProject(slice: ProjectSlice): Project {
  return slice as unknown as Project;
}

function riskWith(selected: any[], proposed: any[] = []) {
  return {
    id: "R-001",
    threatId: "T-001",
    selectedMitigations: selected,
    proposedMitigations: proposed,
  };
}

function threatTableWith(proposed: any[]) {
  return {
    threats: [{ id: "T-001", proposedMitigations: proposed }],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// (1) Mirroring from the Risk tab (SSoT)
// ──────────────────────────────────────────────────────────────────────────

describe("extractMitigationReferences — mirrors verification from risks", () => {
  it("carries status, ticket and resolved text from Risk.selectedMitigations", () => {
    const project = makeProject({
      risks: {
        risks: [
          riskWith(
            [
              {
                id: "M-001",
                status: "verified",
                ticketId: "SCRUM-42",
                ticketUrl: "https://jira.example/browse/SCRUM-42",
              },
            ],
            [{ id: "M-001", text: "Enable mutual TLS" }],
          ),
        ],
      },
    });

    const [m] = extractMitigationReferences(project);

    expect(m.id).toBe("M-001");
    expect(m.status).toBe("verified");
    expect(m.ticketId).toBe("SCRUM-42");
    expect(m.ticketUrl).toBe("https://jira.example/browse/SCRUM-42");
    expect(m.description).toBe("Enable mutual TLS");
  });

  it("uses the analyst's notes as text for a custom mitigation", () => {
    const project = makeProject({
      risks: {
        risks: [
          riskWith(
            [{ id: "M-CUSTOM", status: "in_progress" }],
            [{ id: "M-CUSTOM", isCustom: true, notes: "Ship a hardened image" }],
          ),
        ],
      },
    });

    const [m] = extractMitigationReferences(project);

    expect(m.description).toBe("Ship a hardened image");
    expect(m.status).toBe("in_progress");
  });

  it("REGRESSION: risk-derived status wins over the threat-only fallback", () => {
    // Same M-001 appears in both places. If the threat pass overwrote the risk
    // pass, status would come back undefined and the table would render the
    // mitigation as "not tracked" despite being verified.
    const project = makeProject({
      risks: {
        risks: [
          riskWith(
            [{ id: "M-001", status: "verified", ticketId: "SCRUM-1" }],
            [{ id: "M-001", text: "From risk" }],
          ),
        ],
      },
      threats: {
        perElementTables: [
          threatTableWith([{ id: "M-001", text: "From threat" }]),
        ],
      },
    });

    const refs = extractMitigationReferences(project);

    expect(refs).toHaveLength(1); // not duplicated
    expect(refs[0].status).toBe("verified");
    expect(refs[0].ticketId).toBe("SCRUM-1");
    expect(refs[0].description).toBe("From risk");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (2) Fallback + robustness
// ──────────────────────────────────────────────────────────────────────────

describe("extractMitigationReferences — fallback and edge cases", () => {
  it("resolves threat-only mitigations with text but NO status", () => {
    // "Referenced in a threat but not yet tracked in any risk." The table must
    // be able to tell this apart from 'open' — hence undefined, not a default.
    const project = makeProject({
      threats: {
        perElementTables: [
          threatTableWith([{ id: "M-009", text: "Rate limiting" }]),
        ],
      },
    });

    const [m] = extractMitigationReferences(project);

    expect(m.id).toBe("M-009");
    expect(m.description).toBe("Rate limiting");
    expect(m.status).toBeUndefined();
  });

  it("does not throw when the project has no risks and no threats", () => {
    expect(extractMitigationReferences(makeProject({}))).toEqual([]);
    expect(
      extractMitigationReferences(makeProject({ risks: null, threats: null })),
    ).toEqual([]);
  });

  it("deduplicates the same mitigation id across several risks", () => {
    const project = makeProject({
      risks: {
        risks: [
          riskWith([{ id: "M-001", status: "verified" }]),
          riskWith([{ id: "M-001", status: "open" }]),
        ],
      },
    });

    const refs = extractMitigationReferences(project);

    expect(refs).toHaveLength(1);
    // First writer wins — deterministic, and avoids a later 'open' masking a
    // 'verified' (or vice versa) depending on risk ordering.
    expect(refs[0].status).toBe("verified");
  });

  it("treats mitigation ids case-insensitively but keeps the original casing", () => {
    const project = makeProject({
      risks: {
        risks: [
          riskWith([{ id: "M-001", status: "verified" }]),
          riskWith([{ id: "m-001", status: "open" }]),
        ],
      },
    });

    const refs = extractMitigationReferences(project);

    expect(refs).toHaveLength(1);
    expect(refs[0].id).toBe("M-001");
  });

  it("splits comma/semicolon separated ids coming from free-text fields", () => {
    const project = makeProject({
      threats: {
        perElementTables: [
          threatTableWith([{ id: "M-001, M-002", text: "Combined" }]),
        ],
      },
    });

    const refs = extractMitigationReferences(project);

    expect(refs.map((m) => m.id)).toEqual(["M-001", "M-002"]);
  });

  it("reads per-interaction threat tables as well as per-element", () => {
    const project = makeProject({
      threats: {
        perInteractionTables: [
          threatTableWith([{ id: "M-100", text: "Interaction mitigation" }]),
        ],
      },
    });

    const refs = extractMitigationReferences(project);

    expect(refs.map((m) => m.id)).toEqual(["M-100"]);
  });
});
