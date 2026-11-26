// Catalogue divergence design, phase A: the stamp of the threat catalogue
// version per STRIDE method.
import { describe, it, expect } from "vitest";
import {
  THREAT_CATALOG_VERSION,
  isCatalogOutdated,
  outdatedCatalog,
  stampCatalog,
} from "features/threats/services/threat-catalog-version";
import { storedCatalogVersion, UNSTAMPED_CATALOG_VERSION } from "shared";
import { parseAndRepair } from "app/services/migration-service";
import { loadProjectFixture } from "../../../../fixtures/load-fixture";

describe("threat catalogue version", () => {
  it("a file without a stamp counts as version 1 (before 0.20)", () => {
    expect(UNSTAMPED_CATALOG_VERSION).toBe(1);
    expect(storedCatalogVersion(null, "per-element")).toBe(1);
    expect(storedCatalogVersion({}, "per-interaction")).toBe(1);
    expect(storedCatalogVersion({ catalogStamp: { "per-element": 3 } }, "per-interaction")).toBe(1);
  });

  it("is outdated only below the current version", () => {
    expect(isCatalogOutdated({ catalogStamp: { "per-element": THREAT_CATALOG_VERSION } }, "per-element")).toBe(false);
    expect(isCatalogOutdated({ catalogStamp: { "per-element": THREAT_CATALOG_VERSION - 1 } }, "per-element")).toBe(true);
    // 0.20 does not change the catalogue: no file is outdated yet
    expect(isCatalogOutdated(null, "per-element")).toBe(THREAT_CATALOG_VERSION > 1);
  });

  it("stamping one method keeps the other's stamp", () => {
    expect(stampCatalog({ "per-interaction": 0 }, "per-element")).toEqual({
      "per-interaction": 0,
      "per-element": THREAT_CATALOG_VERSION,
    });
    expect(stampCatalog(undefined, "per-interaction")).toEqual({ "per-interaction": THREAT_CATALOG_VERSION });
  });

  it("survives loading (migrations and repair keep it; none writes it)", () => {
    const raw = loadProjectFixture("Simple_Test_Project.tara.json") as unknown as Record<string, any>;
    expect(parseAndRepair(structuredClone(raw))!.threats!.catalogStamp).toBeUndefined();
    raw.threats.catalogStamp = { "per-element": 1, "per-interaction": 1 };
    expect(parseAndRepair(raw)!.threats!.catalogStamp).toEqual({ "per-element": 1, "per-interaction": 1 });
  });

  it("outdatedCatalog: the oldest outdated method with generated threats; manual threats alone count not", () => {
    const tables = (source: string) => [{ trustBoundaryId: null, trustBoundaryName: "", displayIdentifier: "", threats: [{ source }] }] as never;
    const threats = (pe: string, pi: string, catalogStamp?: Record<string, number>) => ({
      perElementTables: tables(pe),
      perInteractionTables: tables(pi),
      ...(catalogStamp ? { catalogStamp } : {}),
    });
    const current = THREAT_CATALOG_VERSION;
    expect(outdatedCatalog(null)).toBeNull();
    expect(outdatedCatalog(threats("generated", "generated", { "per-element": current, "per-interaction": current }))).toBeNull();
    expect(outdatedCatalog(threats("generated", "manual", { "per-element": current - 1, "per-interaction": current - 2 }))).toEqual({
      stored: current - 1,
      current,
    });
    expect(outdatedCatalog(threats("generated", "generated", { "per-element": current - 1, "per-interaction": current - 2 }))).toEqual({
      stored: current - 2,
      current,
    });
  });
});
