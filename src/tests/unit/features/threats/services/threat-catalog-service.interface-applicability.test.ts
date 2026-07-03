// src/tests/unit/features/threats/services/threat-catalog-service.interface-applicability.test.ts
//
// Module 2 companion to stride-modifier.interface.test.ts (Module 1). Covers
// template SELECTION for the interface domain:
//
//  1. D-006 / D-009 specificity split — wireless + touchscreen resolve to the
//     reduced D-009 (redundancy only), everything cabled falls back to D-006
//     (adds ESD/overcurrent, which is meaningless without a cable).
//
//  2. E-004 carries the full elevation mitigation union after E-004/E-005 were
//     merged. Rationale: the two former templates described distinct attack
//     vectors (privilege escalation vs. unsigned-firmware injection) but shared
//     one treatment path; the catalog selects exactly ONE template per
//     (element, strideCategory) — via specificity-sort + [0], never a merge —
//     so two same-specificity siblings meant one live threat and one dead one.
//
//  3. An interface-domain collision guard: no two interface-domain templates
//     may share strideCategory + elementTypes + context shape, because such
//     siblings are mutually unreachable under the [0] selection. This is what
//     would have caught the original E-004/E-005 duplication automatically.
//     (A catalog-wide version reveals ~19 such pairs in other domains whose
//     status is unverified — see the note on that test below.)

import { describe, it, expect } from "vitest";
import {
  findElementTemplate,
  getAllElementTemplates,
} from "features/threats/services/threat-catalog-service";
import type { ThreatProjectData } from "features/threats/models/threat-types";

// matchesContext reads project.info?.tags for project-level keys; the
// interface templates under test use only the element-level `interfaceType`
// key or no context at all. A truthy stub is required so context filtering
// runs (passing no project skips filtering entirely).
const project = {} as unknown as ThreatProjectData;

describe("D-006 / D-009 — interface DoS specificity split", () => {
  it.each(["wifi", "bluetooth", "nfc", "touchscreen"])(
    "%s → D-009 (redundancy only, no ESD/overcurrent)",
    (type) => {
      const t = findElementTemplate("D", "Interface", project, { type });
      expect(t?.id).toBe("D-009");
      expect(t?.mitigations).toEqual(["M-IF-D-002"]);
    },
  );

  it.each(["uart", "ethernet", "usb", "rs485", "can", "custom"])(
    "%s → D-006 fallback (ESD/overcurrent + redundancy)",
    (type) => {
      const t = findElementTemplate("D", "Interface", project, { type });
      expect(t?.id).toBe("D-006");
      expect(t?.mitigations).toEqual(["M-IF-D-001", "M-IF-D-002"]);
    },
  );

  it("resolves for PhysicalInterface elementType too", () => {
    expect(
      findElementTemplate("D", "PhysicalInterface", project, {
        type: "bluetooth",
      })?.id,
    ).toBe("D-009");
    expect(
      findElementTemplate("D", "PhysicalInterface", project, { type: "uart" })
        ?.id,
    ).toBe("D-006");
  });
});

describe("E-004 — merged elevation template", () => {
  it("carries both debug-access and firmware-integrity mitigations", () => {
    const t = findElementTemplate("E", "Interface", project, { type: "jtag" });
    expect(t?.id).toBe("E-004");
    expect(t?.mitigations).toEqual([
      "M-E-006",
      "M-IF-E-001",
      "M-IF-E-002",
      "M-IF-E-003",
    ]);
    expect(t?.verifications).toEqual(["V-E-004", "V-IF-E-001", "V-IF-E-002"]);
  });

  it("E-005 no longer exists in the interface domain", () => {
    // NB: a DISTINCT E-005 exists in the embedded domain
    // (per-element/embedded/threats-elevation.json — "Secure boot bypass on
    // embedded system"). That one is legitimate and unrelated; only the
    // interface-domain E-005 was merged away. Scope the check by domain.
    const all = getAllElementTemplates();
    const interfaceE005 = all.find(
      (t) => t.id === "E-005" && t.domain === "interface",
    );
    expect(interfaceE005).toBeUndefined();
  });

  it("resolves the same E-004 for any interface type (not interfaceType-gated)", () => {
    // Unsigned OTA firmware injection over WiFi/Ethernet is as real as over a
    // UART bootloader, so E is intentionally not gated by type.
    const wifi = findElementTemplate("E", "Interface", project, {
      type: "wifi",
    });
    const jtag = findElementTemplate("E", "Interface", project, {
      type: "jtag",
    });
    expect(wifi?.id).toBe("E-004");
    expect(jtag?.id).toBe("E-004");
  });
});

describe("interface domain — no mutually-unreachable sibling templates", () => {
  // Regression guard for the E-004/E-005 bug: two element templates with the
  // same strideCategory + identical elementTypes + equally-specific context
  // are indistinguishable to findElementTemplate's specificity sort — the
  // first declared wins, the second is permanently unreachable via [0].
  //
  // SCOPE: interface domain ONLY, deliberately. A catalog-WIDE version of this
  // check reveals ~19 same-specificity sibling pairs across the other domains
  // (embedded, general, ...) — e.g. S-002/S-003/S-004 all at
  // [S|Multiprocess,Process|{}], T-001/T-002 at [T|...], etc. Under the current
  // findElementTemplate [0]-selection those later siblings are unreachable, but
  // whether that is a latent catalog bug or an intentional pattern consumed via
  // a path not audited here (custom templates, per-interaction, a merge step)
  // has NOT been verified. Asserting on them would encode an unproven
  // architectural claim, so this test stays scoped to the domain we actually
  // fixed. The catalog-wide finding is flagged for separate investigation
  // (see handover doc, "PhysicalInterface / sibling-templates" open points).
  it("no two interface-domain templates collide on strideCategory + elementTypes + context", () => {
    const interfaceTemplates = getAllElementTemplates().filter(
      (t) => t.domain === "interface",
    );
    const seen = new Map<string, string>();
    const collisions: string[] = [];

    for (const t of interfaceTemplates) {
      const types = [...t.elementTypes].sort().join(",");
      const ctxRecord = (t.context ?? {}) as unknown as Record<string, unknown>;
      const ctx = JSON.stringify(
        Object.keys(ctxRecord)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = ctxRecord[k];
            return acc;
          }, {}),
      );
      const sig = `${t.strideCategory}|${types}|${ctx}`;
      const prev = seen.get(sig);
      if (prev) {
        collisions.push(`${prev} <-> ${t.id}  [${sig}]`);
      } else {
        seen.set(sig, t.id);
      }
    }

    expect(collisions).toEqual([]);
  });
});