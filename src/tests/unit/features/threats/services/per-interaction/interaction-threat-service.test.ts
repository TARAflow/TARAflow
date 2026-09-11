// src/tests/unit/features/threats/services/per-interaction/interaction-threat-service.test.ts
//
// Backend enforcement of RegulationPreset.disabledThreatGenerators: the
// per-interaction generator must refuse to run when the active preset (derived
// live from the project tags) disables it — so an imported or legacy project
// cannot bypass the GUI method-toggle block. See iso-21434-support-design.md
// DS-2 and regulation-preset.ts (isThreatGeneratorEnabled).

import { describe, it, expect } from "vitest";
import { interactionThreatService } from "features/threats/services/per-interaction/interaction-threat-service";
import type {
  ThreatProjectData,
  ThreatConfiguration,
} from "features/threats/models/threat-types";
import type { DFDAnalysisContext, ProjectTags } from "shared";
import { EMPTY_PROJECT_TAGS } from "shared";

const tagsWith = (regulation: string[]): ProjectTags => ({
  ...EMPTY_PROJECT_TAGS,
  regulation,
});

// Minimal projection — the guard only reads project.info?.tags and runs before
// any DFD access, so the rest is intentionally left empty (cast).
const projectWithTags = (regulation: string[]): ThreatProjectData =>
  ({
    id: "p1",
    name: "test",
    threats: null,
    phaseStatus: {},
    info: { tags: tagsWith(regulation) },
    lastModified: "2026-01-01T00:00:00.000Z",
  }) as unknown as ThreatProjectData;

const cfg = {} as ThreatConfiguration;
const dfd = {} as DFDAnalysisContext;

describe("InteractionThreatService — regulation preset guard", () => {
  it("refuses per-interaction generation under iso-21434", () => {
    const res = interactionThreatService.generateThreats(
      projectWithTags(["ISO 21434"]),
      dfd,
      cfg,
    );
    expect(res.success).toBe(false);
    expect(res.tables).toEqual([]);
    expect(res.error).toMatch(/per-interaction is disabled/i);
  });

  it("also fires via the normalized ISO21434 tag form", () => {
    const res = interactionThreatService.generateThreats(
      projectWithTags(["ISO21434"]),
      dfd,
      cfg,
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/per-interaction is disabled/i);
  });

  it("does NOT fire the preset guard for a standard project", () => {
    // Guard passes (nothing disabled); generation then fails for an unrelated
    // reason (no DFD graph in this minimal fixture) — proving the guard is
    // scoped and does not over-fire.
    const res = interactionThreatService.generateThreats(
      projectWithTags([]),
      dfd,
      cfg,
    );
    expect(res.success).toBe(false);
    expect(res.error ?? "").not.toMatch(/regulation preset/i);
  });

  it("does NOT fire for a project with no tags at all", () => {
    const project = {
      id: "p2",
      name: "no-tags",
      threats: null,
      phaseStatus: {},
      lastModified: "2026-01-01T00:00:00.000Z",
    } as unknown as ThreatProjectData;
    const res = interactionThreatService.generateThreats(project, dfd, cfg);
    expect(res.error ?? "").not.toMatch(/regulation preset/i);
  });
});
