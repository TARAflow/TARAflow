// ============ Interaction selector — specificity over general (regression) ============
// Mirror of the per-element specificity guard, for findInteractionTemplate.
// Pins: a context-matching embedded interaction template wins over the context-free
// general one for the same (strideCategory, perspective). general = fallback.
//
// Also documents the protocol-vocabulary gap (Commit 2 bridge): the DataFlow
// property value "modbus_rtu" does NOT match the embedded protocol templates,
// which list the abstract "modbus". Until the catalog is migrated to the
// Protocol enum values, DF-6/T wins via location=field_cable (T-006), not via
// the protocol template (T-001/T-008).
//
// Placement: src/tests/unit/features/threats/services/

import { describe, it, expect } from "vitest";
import {
  findInteractionTemplate,
  getApplicableInteractionTemplates,
} from "../../../../../features/threats/services/threat-catalog-service";
import type { ThreatProjectData } from "features/threats";

const project = { info: { tags: {} } } as unknown as ThreatProjectData;

// DF-6 (Process 14 → Sensor 206) real properties.
const df6 = {
  protocol: "modbus_rtu",
  location: "field_cable",
  accessMode: "read_write",
  redundancy: "none",
};

describe("findInteractionTemplate — specificity beats general", () => {
  it("DF-6 Tampering/receiver → embedded T-006 via location=field_cable (not general)", () => {
    const t = findInteractionTemplate("T", "receiver", project, df6);
    expect(t?.domain).toBe("embedded");
    expect(t?.id).toBe("T-006");
  });

  it("general remains the fallback when no embedded context matches", () => {
    // No embedded-gating props set → only general (context:{}) applies.
    const t = findInteractionTemplate("T", "receiver", project, {});
    expect(t?.domain).toBe("general");
  });

  it("perspective is respected (sender vs receiver are disjoint)", () => {
    const recv = findInteractionTemplate("T", "receiver", project, df6);
    const send = findInteractionTemplate("T", "sender", project, df6);
    // receiver picks a receiver-perspective template; sender a sender one.
    expect(recv?.perspective ?? "receiver").not.toBe("sender");
    // sender side for DF-6: no embedded sender T template matches these props
    // except shared_memory ones (not set) → general sender fallback.
    expect(send?.domain).toBe("general");
  });

  // ── Commit 2 bridge: documents the protocol-vocabulary mismatch ──
  it("DOC: modbus_rtu does NOT match the abstract 'modbus' protocol templates (pre-migration)", () => {
    const applicable = getApplicableInteractionTemplates(
      "T",
      "receiver",
      project,
      df6,
    );
    const protocolGated = applicable.filter(
      (t) => Array.isArray((t.context as any).protocol),
    );
    // Pre-migration: the protocol-gated embedded templates (T-001, T-008) are
    // NOT in the applicable set, because their context lists "modbus" while the
    // property is "modbus_rtu". After Commit 2 this expectation flips.
    expect(protocolGated.map((t) => t.id)).not.toContain("T-008");
    expect(protocolGated.map((t) => t.id)).not.toContain("T-001");
  });
});
