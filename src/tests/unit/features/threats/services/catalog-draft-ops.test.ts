// tests/unit/features/threats/services/catalog-draft-ops.test.ts
//
// Custom mitigation catalog design CM-1: catalog entries on an
// analyst-authored threat are stored as { id } (the closed loop keys on catalog
// ids); free text equal to a catalog text is offered for linking, and the
// "already implemented" flags of a kept manual threat follow the DFD.

import { describe, it, expect } from "vitest";
import "i18n/services/i18n";
import {
  addCatalogMitigation,
  addCatalogVerification,
  catalogMatchFor,
  linkDraftToCatalog,
} from "features/threats/services/catalog-draft-ops";
import { refreshImplementedFlags } from "features/threats/services/implemented-controls-mapper";
import {
  getAllMitigations,
  getLocalizedMitigation,
  getLocalizedVerification,
} from "features/threats/services/threat-catalog-service";

const withVerifications = getAllMitigations().find((m) => (m.verifications ?? []).length > 0)!;

describe("catalog entries on a threat", () => {
  it("a catalog mitigation is stored by id and brings its verifications", () => {
    const next = addCatalogMitigation([{ notes: "free" }], [], withVerifications.id);
    expect(next.mitigations).toEqual([{ notes: "free" }, { id: withVerifications.id }]);
    expect(next.verifications).toEqual(withVerifications.verifications!.map((id) => ({ id })));
  });

  it("nothing twice", () => {
    const once = addCatalogMitigation([], [], withVerifications.id);
    const twice = addCatalogMitigation(once.mitigations, once.verifications, withVerifications.id);
    expect(twice).toEqual(once);
    expect(addCatalogVerification([{ id: "V-S-001" }], "V-S-001")).toEqual([{ id: "V-S-001" }]);
  });

  it("free text equal to a catalog text (whitespace aside) is matched; other text is not", () => {
    const text = getLocalizedMitigation("M-S-001");
    expect(catalogMatchFor("mitigation", `  ${text.replace(/ /g, "  ")} `)).toBe("M-S-001");
    expect(catalogMatchFor("verification", getLocalizedVerification("V-S-001"))).toBe("V-S-001");
    expect(catalogMatchFor("mitigation", "Use a sturdy padlock")).toBeUndefined();
    expect(catalogMatchFor("mitigation", "")).toBeUndefined();
  });

  it("linking replaces the free-text entry; a duplicate just goes", () => {
    expect(linkDraftToCatalog([{ notes: "a" }, { notes: "b" }], 1, "M-S-001")).toEqual([{ notes: "a" }, { id: "M-S-001" }]);
    expect(linkDraftToCatalog([{ id: "M-S-001" }, { notes: "b" }], 1, "M-S-001")).toEqual([{ id: "M-S-001" }]);
  });
});

describe("refreshImplementedFlags (manual threats)", () => {
  const hint = { id: "M-S-001", alreadyImplemented: true, implementedByProperty: "implementedControls.linkAuthentication", implementedByValue: "pre_shared_key" };

  it("marks entries on the list, never appends", () => {
    expect(refreshImplementedFlags([{ id: "M-S-001", notes: "n" }, { notes: "free" }], [hint, { ...hint, id: "M-S-002" }])).toEqual([
      { id: "M-S-001", notes: "n", alreadyImplemented: true, implementedByProperty: hint.implementedByProperty, implementedByValue: "pre_shared_key" },
      { notes: "free" },
    ]);
  });

  it("clears the flags when the property reverted", () => {
    expect(refreshImplementedFlags([{ ...hint }], [])).toEqual([{ id: "M-S-001" }]);
  });
});
