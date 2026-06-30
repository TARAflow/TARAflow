// ============ Protocol vocabulary migration (Commit 2a) ============
// After migrating template protocol lists from abstract names ("modbus") to
// Protocol enum values ("modbus_rtu"/"modbus_tcp"/...), a DataFlow with
// protocol="modbus_rtu" now matches the protocol-gated embedded templates.
//
// DF-6 (modbus_rtu, accessMode=read_write, location=field_cable) → receiver/T:
//   embedded T-008 wins: context {protocol, accessMode} = specificity 2,
//   beating embedded T-006 (location only, specificity 1).
//
// modbus_sec must NOT match the embedded "no authentication" templates — it is
// the secure variant (the mitigation outcome).
//
// NB: Template IDs are NOT globally unique — they repeat across domains
// (general T-001 with context:{} AND embedded T-001 with protocol context).
// Any ID-based assertion MUST also discriminate by domain, otherwise the
// context-free general fallback is wrongly counted.
//
// Placement: src/tests/unit/features/threats/services/

import { describe, it, expect } from "vitest";
import {
  findInteractionTemplate,
  getApplicableInteractionTemplates,
} from "../../../../../features/threats/services/threat-catalog-service";
import type { ThreatProjectData } from "features/threats";

const project = { info: { tags: {} } } as unknown as ThreatProjectData;

const df6 = {
  protocol: "modbus_rtu",
  location: "field_cable",
  accessMode: "read_write",
  redundancy: "none",
};

// Embedded protocol-gated templates only — excludes the general fallback
// (context:{}) which always applies and is not the subject of these assertions.
const embeddedProtocolGatedIds = (
  applicable: ReturnType<typeof getApplicableInteractionTemplates>,
) =>
  applicable
    .filter(
      (t) =>
        t.domain === "embedded" && Array.isArray((t.context as any).protocol),
    )
    .map((t) => t.id);

describe("protocol vocabulary migration — modbus_rtu matches OT templates", () => {
  it("DF-6 Tampering/receiver → embedded T-008 (protocol+accessMode, specificity 2)", () => {
    const t = findInteractionTemplate("T", "receiver", project, df6);
    expect(t?.domain).toBe("embedded");
    expect(t?.id).toBe("T-008");
  });

  it("modbus_rtu now appears in the embedded protocol-gated set", () => {
    const ids = embeddedProtocolGatedIds(
      getApplicableInteractionTemplates("T", "receiver", project, df6),
    );
    expect(ids).toContain("T-008"); // protocol + accessMode
    expect(ids).toContain("T-001"); // embedded protocol only
  });

  it("modbus_sec must NOT match the embedded 'no authentication' OT templates", () => {
    const ids = embeddedProtocolGatedIds(
      getApplicableInteractionTemplates("T", "receiver", project, {
        ...df6,
        protocol: "modbus_sec",
      }),
    );
    expect(ids).not.toContain("T-008");
    expect(ids).not.toContain("T-001");
  });

  it("read-only OT flow does NOT match T-008 (accessMode gate), but T-001 still applies", () => {
    const ids = embeddedProtocolGatedIds(
      getApplicableInteractionTemplates("T", "receiver", project, {
        ...df6,
        accessMode: "read_only",
      }),
    );
    expect(ids).not.toContain("T-008");
    expect(ids).toContain("T-001");
  });
});