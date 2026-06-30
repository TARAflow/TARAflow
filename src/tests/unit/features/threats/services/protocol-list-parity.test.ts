// ============ Protocol-list parity: per-element ↔ per-interaction ============
// Invariant: the embedded protocol lists used by element templates and
// interaction templates must reference the same set of protocols. This prevents
// the two generation methods from drifting apart, which previously caused
// different coverage for the same DataFlow depending on method.
//
// Lists are read from the live catalog aggregators, so the test fails the moment
// a protocol is added to one side but not the other.
//
// Placement: src/tests/unit/features/threats/services/

import { describe, it, expect } from "vitest";
import {
  getAllElementTemplates,
  getAllInteractionTemplates,
} from "../../../../../features/threats/services/threat-catalog-service";

// Union of all protocol values used across a template set (embedded domain only —
// the only domain that gates on protocol).
function protocolUnion(
  templates: { domain?: string; context?: { protocol?: string[] } }[],
): Set<string> {
  const u = new Set<string>();
  for (const t of templates) {
    if (t.domain === "embedded" && Array.isArray(t.context?.protocol)) {
      for (const p of t.context!.protocol) u.add(p);
    }
  }
  return u;
}

describe("protocol-list parity between element and interaction catalogs", () => {
  const elementUnion = protocolUnion(getAllElementTemplates() as any);
  const interactionUnion = protocolUnion(getAllInteractionTemplates() as any);

  it("element and interaction catalogs use the same set of protocols", () => {
    expect([...elementUnion].sort()).toEqual([...interactionUnion].sort());
  });

  it("the OT-protocol family is present and excludes the secure variant", () => {
    const ot = [
      "modbus_rtu",
      "modbus_tcp",
      "profibus",
      "profinet",
      "dnp3",
      "canopen",
      "s7comm",
      "iec61850",
    ];
    for (const p of ot) {
      expect(interactionUnion.has(p)).toBe(true);
      expect(elementUnion.has(p)).toBe(true);
    }
    // modbus_sec is the secured variant — must NOT appear in any "no auth" list.
    expect(interactionUnion.has("modbus_sec")).toBe(false);
    expect(elementUnion.has("modbus_sec")).toBe(false);
  });
});
