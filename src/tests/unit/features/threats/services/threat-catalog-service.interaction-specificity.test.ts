// ============ Interaction selector — specificity over general (regression) ============
// Mirror of the per-element specificity guard, for findInteractionTemplate.
// Pins: a context-matching embedded interaction template wins over the context-free
// general one for the same (strideCategory, perspective). general = fallback.
//
// NOTE: The DF-6 winner (modbus_rtu read-write field flow) and the protocol-
// vocabulary behaviour are pinned in threat-catalog-service.protocol-migration.test.ts.
// This file keeps only the protocol-independent specificity/perspective guards
// to avoid duplicate (and divergent) assertions.
//
// Placement: src/tests/unit/features/threats/services/

import { describe, it, expect } from "vitest";
import { findInteractionTemplate } from "../../../../../features/threats/services/threat-catalog-service";
import type { ThreatProjectData } from "features/threats";

const project = { info: { tags: {} } } as unknown as ThreatProjectData;

describe("findInteractionTemplate — specificity beats general", () => {
  it("general remains the fallback when no embedded context matches", () => {
    // No embedded-gating props set → only general (context:{}) applies.
    const t = findInteractionTemplate("T", "receiver", project, {});
    expect(t?.domain).toBe("general");
  });

  it("perspective is respected (sender vs receiver are disjoint)", () => {
    const df6 = {
      protocol: "modbus_rtu",
      location: "field_cable",
      accessMode: "read_write",
      redundancy: "none",
    };
    const recv = findInteractionTemplate("T", "receiver", project, df6);
    const send = findInteractionTemplate("T", "sender", project, df6);
    expect(recv?.perspective ?? "receiver").not.toBe("sender");
    // No embedded sender T template matches these props (shared_memory ones not
    // set) → general sender fallback.
    expect(send?.domain).toBe("general");
  });
});