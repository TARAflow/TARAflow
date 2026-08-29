// ==================== THREAT IDENTITY / REGENERATION MERGE ====================
// Pins the analyst-data-preservation contract of threat-identity.ts: a full
// regeneration must carry analyst-owned fields over from the previous set,
// matched by stable natural key, while recomputing every system-derived field.

import { describe, it, expect } from "vitest";
import type { Threat } from "../../../../../features/threats/models/threat-types";
import {
  elementThreatNaturalKey,
  interactionThreatNaturalKey,
  buildThreatIndex,
  mergeProposedMitigations,
  mergeProposedVerifications,
  mergeGeneratedThreat,
  mergeGeneratedTables,
} from "../../../../../features/threats/services/threat-identity";

// ── Builders ────────────────────────────────────────────────────────────────

function baseThreat(over: Partial<Threat> = {}): Threat {
  return {
    id: "uuid-existing-0001",
    displayId: "P1-S-1",
    trustBoundaryId: null,
    trustBoundaryName: null,
    trustBoundaryDisplayId: null,
    strideCategory: "S",
    sequenceNumber: 1,
    linkedElement: {
      elementId: "e1",
      elementName: "Auth",
      elementType: "Process",
      displayId: "P-1",
    } as any,
    dataFlow: null,
    interactionContext: undefined,
    threatDescription: "fresh threat text",
    attackDescription: "fresh attack text",
    causeDescription: "fresh cause",
    threatActor: "external",
    linkedAssetIds: [],
    source: "generated:full",
    proposedMitigations: [],
    proposedVerifications: [],
    relevance: "unrated",
    workflowStatus: "open",
    evalNote: undefined,
    isTextCustomized: false,
    created: "2026-01-01T00:00:00.000Z",
    lastModified: "2026-01-01T00:00:00.000Z",
    templateId: "T-001",
    ...over,
  } as Threat;
}

// ── Natural keys ──────────────────────────────────────────────────────────────

describe("natural keys", () => {
  it("per-element key = elementId::stride", () => {
    expect(elementThreatNaturalKey(baseThreat())).toBe("e1::S");
  });

  it("per-element key is null when no linked element", () => {
    expect(
      elementThreatNaturalKey(baseThreat({ linkedElement: null })),
    ).toBeNull();
  });

  it("per-interaction data-flow key includes direction", () => {
    const t = baseThreat({
      linkedElement: null,
      dataFlow: { connectionId: "c9" } as any,
      interactionContext: { direction: "incoming" } as any,
    });
    expect(interactionThreatNaturalKey(t)).toBe("df::c9::S::incoming");
  });

  it("per-interaction sender/receiver of one flow do NOT collide", () => {
    const inc = baseThreat({
      linkedElement: null,
      dataFlow: { connectionId: "c9" } as any,
      interactionContext: { direction: "incoming" } as any,
    });
    const out = baseThreat({
      linkedElement: null,
      dataFlow: { connectionId: "c9" } as any,
      interactionContext: { direction: "outgoing" } as any,
    });
    expect(interactionThreatNaturalKey(inc)).not.toBe(
      interactionThreatNaturalKey(out),
    );
  });

  it("per-interaction interface threat keys on elementId", () => {
    const t = baseThreat({ dataFlow: null });
    expect(interactionThreatNaturalKey(t)).toBe("el::e1::S");
  });
});

// ── Index ─────────────────────────────────────────────────────────────────────

describe("buildThreatIndex", () => {
  it("keeps the first threat on a key collision and skips null keys", () => {
    const first = baseThreat({ id: "first" });
    const dup = baseThreat({ id: "dup" });
    const nokey = baseThreat({ id: "nokey", linkedElement: null });
    const index = buildThreatIndex(
      [{ trustBoundaryId: null, trustBoundaryName: "", displayIdentifier: "", threats: [first, dup, nokey] } as any],
      elementThreatNaturalKey,
    );
    expect(index.size).toBe(1);
    expect(index.get("e1::S")?.id).toBe("first");
  });
});

// ── Mitigation / verification merge ────────────────────────────────────────────

describe("mergeProposedMitigations", () => {
  it("carries analyst notes onto catalogue entries but recomputes derived flags", () => {
    const existing = [
      { id: "M-S-001", notes: "analyst note", alreadyImplemented: false },
    ];
    const fresh = [
      {
        id: "M-S-001",
        alreadyImplemented: true,
        implementedByProperty: "implementedControls.linkAuthentication",
        implementedByValue: "certificate",
      },
    ];
    const merged = mergeProposedMitigations(existing, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].notes).toBe("analyst note");
    // Derived flags come from fresh (close-loop drift detection).
    expect(merged[0].alreadyImplemented).toBe(true);
    expect(merged[0].implementedByValue).toBe("certificate");
  });

  it("appends custom (no-id) analyst entries unchanged", () => {
    const existing = [{ notes: "custom analyst mitigation" }];
    const fresh = [{ id: "M-S-001" }];
    const merged = mergeProposedMitigations(existing, fresh);
    expect(merged).toHaveLength(2);
    expect(merged[1].notes).toBe("custom analyst mitigation");
    expect(merged[1].id).toBeUndefined();
  });

  it("does not clobber a fresh note with an absent analyst note", () => {
    const merged = mergeProposedMitigations(
      [{ id: "M-S-001" }],
      [{ id: "M-S-001", notes: "fresh note" }],
    );
    expect(merged[0].notes).toBe("fresh note");
  });
});

describe("mergeProposedVerifications", () => {
  it("carries notes and appends custom entries", () => {
    const merged = mergeProposedVerifications(
      [{ id: "V-S-001", notes: "keep me" }, { notes: "custom" }],
      [{ id: "V-S-001" }],
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].notes).toBe("keep me");
    expect(merged[1].notes).toBe("custom");
  });
});

// ── Threat-level merge ─────────────────────────────────────────────────────────

describe("mergeGeneratedThreat", () => {
  it("returns fresh unchanged when there is no predecessor", () => {
    const fresh = baseThreat();
    expect(mergeGeneratedThreat(undefined, fresh)).toBe(fresh);
  });

  it("preserves relevance, workflow, evalNote and threatActor", () => {
    const existing = baseThreat({
      relevance: "not_relevant",
      workflowStatus: "reviewed",
      evalNote: "ruled out — internal only",
      threatActor: "insider" as any,
    });
    const fresh = baseThreat({ relevance: "unrated", workflowStatus: "open" });
    const merged = mergeGeneratedThreat(existing, fresh);
    expect(merged.relevance).toBe("not_relevant");
    expect(merged.workflowStatus).toBe("reviewed");
    expect(merged.evalNote).toBe("ruled out — internal only");
    expect(merged.threatActor).toBe("insider");
  });

  it("recomputes system-derived fields from fresh", () => {
    const existing = baseThreat({
      id: "OLD-S-1",
      linkedAssetIds: ["A-stale"],
      templateId: "T-old",
      causeDescription: "stale cause",
    });
    const fresh = baseThreat({
      id: "P2-S-1",
      linkedAssetIds: ["A-current"],
      templateId: "T-001",
      causeDescription: "fresh cause",
    });
    const merged = mergeGeneratedThreat(existing, fresh);
    expect(merged.id).toBe("P2-S-1");
    expect(merged.linkedAssetIds).toEqual(["A-current"]);
    expect(merged.templateId).toBe("T-001");
    expect(merged.causeDescription).toBe("fresh cause");
  });

  it("keeps analyst-customised text only when isTextCustomized is set", () => {
    const customised = mergeGeneratedThreat(
      baseThreat({ isTextCustomized: true, threatDescription: "analyst wording" }),
      baseThreat({ threatDescription: "fresh template wording" }),
    );
    expect(customised.threatDescription).toBe("analyst wording");

    const notCustomised = mergeGeneratedThreat(
      baseThreat({ isTextCustomized: false, threatDescription: "old template" }),
      baseThreat({ threatDescription: "fresh template wording" }),
    );
    expect(notCustomised.threatDescription).toBe("fresh template wording");
  });

  it("preserves created and lastModified (no regeneration churn)", () => {
    const existing = baseThreat({
      created: "2025-06-01T10:00:00.000Z",
      lastModified: "2025-06-02T11:00:00.000Z",
    });
    const fresh = baseThreat({
      created: "2026-08-28T00:00:00.000Z",
      lastModified: "2026-08-28T00:00:00.000Z",
    });
    const merged = mergeGeneratedThreat(existing, fresh);
    expect(merged.created).toBe("2025-06-01T10:00:00.000Z");
    expect(merged.lastModified).toBe("2025-06-02T11:00:00.000Z");
  });
});

// ── Table-level merge (the generators' call) ────────────────────────────────────

describe("mergeGeneratedTables", () => {
  it("matches across renumber: fresh id changes, analyst fields survive", () => {
    // Previous set: element was P-1, analyst rated it and annotated a mitigation.
    const previous = [
      {
        trustBoundaryId: null,
        trustBoundaryName: "No Trust Boundary",
        displayIdentifier: "[UB]",
        threats: [
          baseThreat({
            id: "P1-S-1",
            relevance: "relevant",
            evalNote: "confirmed",
            proposedMitigations: [{ id: "M-S-001", notes: "wire up mTLS" }],
          }),
        ],
      } as any,
    ];
    // Fresh set after renumber P-1 → P-2: same element (e1), new display id.
    const fresh = [
      {
        trustBoundaryId: null,
        trustBoundaryName: "No Trust Boundary",
        displayIdentifier: "[UB]",
        threats: [
          baseThreat({
            id: "P2-S-1",
            relevance: "unrated",
            evalNote: undefined,
            proposedMitigations: [{ id: "M-S-001" }],
          }),
        ],
      } as any,
    ];

    const merged = mergeGeneratedTables(fresh, previous, elementThreatNaturalKey);
    const t = merged[0].threats[0];
    expect(t.id).toBe("P2-S-1"); // display id tracks renumber
    expect(t.relevance).toBe("relevant"); // analyst rating survived
    expect(t.evalNote).toBe("confirmed");
    expect(t.proposedMitigations[0].notes).toBe("wire up mTLS");
  });

  it("returns fresh tables unchanged when there is no previous set", () => {
    const fresh = [
      { trustBoundaryId: null, trustBoundaryName: "", displayIdentifier: "", threats: [baseThreat()] } as any,
    ];
    expect(mergeGeneratedTables(fresh, undefined, elementThreatNaturalKey)).toBe(fresh);
  });
});

// ── Identity preservation (Strategy A) ───────────────────────────────────────

describe("identity preservation on merge", () => {
  it("keeps the existing UUID id and takes the fresh displayId", () => {
    // Existing threat was renumbered away: its label is now P2-S-1, but its
    // stable UUID must survive a full regeneration unchanged.
    const existing = baseThreat({
      id: "uuid-STABLE-42",
      displayId: "P1-S-1",
      relevance: "relevant",
    });
    const fresh = baseThreat({
      id: "uuid-FRESH-99", // createEmptyThreat mints a new UUID every run
      displayId: "P2-S-1", // regenerated label after the renumber
    });

    const merged = mergeGeneratedThreat(existing, fresh);

    expect(merged.id).toBe("uuid-STABLE-42"); // identity preserved
    expect(merged.displayId).toBe("P2-S-1"); // label regenerated
    expect(merged.relevance).toBe("relevant"); // analyst field preserved
  });

  it("a genuinely new threat keeps its fresh UUID and label", () => {
    const fresh = baseThreat({ id: "uuid-NEW-1", displayId: "P3-S-1" });
    const merged = mergeGeneratedThreat(undefined, fresh);
    expect(merged.id).toBe("uuid-NEW-1");
    expect(merged.displayId).toBe("P3-S-1");
  });

  it("table merge preserves the prior UUID for a natural-key match", () => {
    const prior = {
      trustBoundaryId: null,
      trustBoundaryName: "",
      displayIdentifier: "",
      threats: [
        baseThreat({
          id: "uuid-PRIOR",
          displayId: "P1-S-1",
          relevance: "relevant",
        }),
      ],
    } as any;
    const regenerated = {
      trustBoundaryId: null,
      trustBoundaryName: "",
      displayIdentifier: "",
      threats: [baseThreat({ id: "uuid-REGEN", displayId: "P2-S-1" })],
    } as any;

    const [out] = mergeGeneratedTables(
      [regenerated],
      [prior],
      elementThreatNaturalKey,
    );

    expect(out.threats[0].id).toBe("uuid-PRIOR");
    expect(out.threats[0].displayId).toBe("P2-S-1");
    expect(out.threats[0].relevance).toBe("relevant");
  });
});
