// Guard of the field purpose register (model-field-purpose-and-rating-
// context-design.md §7, phase 1; roadmap-to-1.0.md rule 3.3): no input field
// of an asset or a DFD element without a declared purpose (P2).
//
//   G-1  every property of a registered interface has an entry, and every
//        entry names an existing property (the interfaces are read from the
//        source with the TypeScript parser — a new field fails here)
//   G-2  calculation: every `readBy` file exists, is no plumbing, and reads
//        the field (property access or a quoted name — JSON catalogues too);
//        via BLACK_BOX_FIELDS: the field is a black-box field and the file
//        reads that map
//   G-3  documentation: the report renders it — the field layout of its
//        element type or a model coverage field; for an asset only the
//        description
//   G-4  context: every factor id exists
//   G-5  pending: only the fields of 0.20 (frozen list below) — it may
//        shrink, never grow; a new field needs a real purpose
//   G-6  a retired asset field is neither in the type nor in the register
//
// When it fails for a new field: give it a purpose in
// shared/models/field-purpose-register.ts — calculation with its readers,
// documentation (then put it into the report), or context with its factors.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import {
  FIELD_PURPOSE_REGISTER,
  REGISTERED_ELEMENT_TYPES,
  type FieldPurpose,
  type RegisteredInterface,
} from "shared/models/field-purpose-register";
import { BLACK_BOX_FIELDS, MODEL_FIELDS } from "shared/models/property-visibility";
import { RETIRED_ASSET_FIELDS } from "shared/models/retired-asset-fields";
import { ALL_PREDEFINED_FACTORS } from "features/risks/models/risk-factor-types";
import { ELEMENT_FIELD_LAYOUT } from "features/documentation/utils/generators/property-doc-mappers";

const SRC = path.join(process.cwd(), "src");

const SOURCES: Record<RegisteredInterface, string> = {
  AssetProperties: "shared/models/asset-property-types.ts",
  ProcessProperties: "features/dfd/models/element-properties.ts",
  MultiprocessProperties: "features/dfd/models/element-properties.ts",
  ExternalEntityProperties: "features/dfd/models/element-properties.ts",
  DataStoreProperties: "features/dfd/models/element-properties.ts",
  DataFlowProperties: "features/dfd/models/element-properties.ts",
  InterfaceProperties: "features/dfd/models/element-properties.ts",
  TrustBoundaryProperties: "features/dfd/models/element-properties.ts",
  ChipBoundaryProperties: "features/dfd/models/element-properties.ts",
  PhysicalBoundaryProperties: "features/dfd/models/element-properties.ts",
};

/** The property names an interface declares (own members). */
function declaredProperties(file: string, name: string): string[] {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(SRC, file), "utf-8"), ts.ScriptTarget.Latest, true);
  const out: string[] = [];
  sf.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === name)
      for (const m of node.members) if (ts.isPropertySignature(m)) out.push(m.name.getText(sf));
  });
  return out;
}

/** Files that hold, show or ask for a value but compute nothing from it. */
const PLUMBING = [
  /models\/element-properties\.ts$/,
  /models\/asset-property-types\.ts$/,
  /element-property-defaults\.ts$/,
  /control-property-options\.ts$/,
  /\/components\/forms\//,
  /asset-property-validator\.ts$/,
  /element-property-validator\.ts$/,
  /dataflow-property-validator\.ts$/,
  /dataflow-label-property-validator\.ts$/,
  /dataflow-coverage\.ts$/,
  /\/versions\//,
  /property-doc-mappers\.ts$/,
  /field-purpose-register\.ts$/,
];

/** A read of `field`: property access, an index or a quoted name (JSON catalogues, rule tables). */
const reads = (text: string, field: string) => new RegExp(`(\\.|\\?\\.|\\[["']|["'])${field}\\b`).test(text);

/** The pending fields of 0.20 — may shrink, never grow (G-5). */
const PENDING_0_20 = new Set([
  "AssetProperties.owner",
  "AssetProperties.notes",
  "AssetProperties.dataType",
  "AssetProperties.lifecycle",
  "AssetProperties.isSafetyFunction",
  "AssetProperties.externalRefs",
  "AssetProperties.automationLevel",
  "AssetProperties.changeFrequency",
  "AssetProperties.domain",
  "AssetProperties.regulatoryReference",
  "AssetProperties.isValidatedProcess",
  "AssetProperties.validationRationale",
  "AssetProperties.exposure",
  "AssetProperties.physicalAccessControl",
  "AssetProperties.location",
  "AssetProperties.environmentalHazard",
  "AssetProperties.isUnique",
  "AssetProperties.uniquenessRationale",
  "AssetProperties.portability",
  "AssetProperties.serviceType",
  "AssetProperties.responsibility",
  "AssetProperties.responsibilityScope",
  "AssetProperties.providerName",
  "AssetProperties.slaReference",
  "AssetProperties.role",
  "AssetProperties.securityRelevant",
  "AssetProperties.isProtectionTarget",
  "AssetProperties.replacementLeadTimeNote",
  "AssetProperties.highValueRationale",
  "ProcessProperties.securityControls",
  "ExternalEntityProperties.threatProfile",
  "DataStoreProperties.accessModelSource",
  "DataFlowProperties.dataMinimization",
  "DataFlowProperties.volume",
  "DataFlowProperties.exposureLevelRationale",
  "DataFlowProperties.couplingMode",
  "DataFlowProperties.injectability",
  "DataFlowProperties.controllability",
  "DataFlowProperties.crossesSafetyBoundary",
  "DataFlowProperties.assumedTrusted",
  "DataFlowProperties.assumedTrustedRationale",
  "InterfaceProperties.connectionSpeed",
  "InterfaceProperties.exposureLevelRationale",
  "TrustBoundaryProperties.boundaryId",
  "ChipBoundaryProperties.safetyRationale",
  "ChipBoundaryProperties.notes",
]);

/** The report shows of an asset only its description (report-chapter-data.ts). */
const ASSET_REPORT_FIELDS = ["description"];

const entries = (Object.keys(FIELD_PURPOSE_REGISTER) as RegisteredInterface[]).flatMap((iface) =>
  Object.entries(FIELD_PURPOSE_REGISTER[iface]).map(([field, entry]) => [iface, field, entry] as [RegisteredInterface, string, FieldPurpose]),
);
const BLACK_BOX = new Set(Object.values(BLACK_BOX_FIELDS).flatMap((m) => Object.values(m) as string[]));

function documented(iface: RegisteredInterface, field: string): boolean {
  if (iface === "AssetProperties") return ASSET_REPORT_FIELDS.includes(field);
  const type = REGISTERED_ELEMENT_TYPES[iface];
  const layout = ELEMENT_FIELD_LAYOUT[type];
  const inLayout =
    !!layout && [...layout.context, ...layout.security, ...layout.meta].some((f) => f === field || f.startsWith(`${field}.`));
  return inLayout || MODEL_FIELDS.some((m) => m.property === field && (m.elementTypes as readonly string[]).includes(type));
}

/** What is wrong with one entry (empty = fine). */
function problems(iface: RegisteredInterface, field: string, entry: FieldPurpose): string[] {
  const out: string[] = [];
  switch (entry.purpose) {
    case "calculation":
      if (entry.readBy.length === 0) out.push("calculation without a reader");
      for (const file of entry.readBy) {
        const full = path.join(SRC, file);
        if (!fs.existsSync(full)) {
          out.push(`reader ${file} does not exist`);
          continue;
        }
        if (PLUMBING.some((p) => p.test(file))) out.push(`reader ${file} is plumbing`);
        const text = fs.readFileSync(full, "utf-8");
        if (entry.via === "BLACK_BOX_FIELDS") {
          if (!BLACK_BOX.has(field)) out.push("not a black-box field");
          if (!text.includes("BLACK_BOX_FIELDS")) out.push(`${file} does not read BLACK_BOX_FIELDS`);
        } else if (!reads(text, field)) out.push(`${file} does not read ${field}`);
      }
      break;
    case "documentation":
      if (!documented(iface, field)) out.push("documentation, but not in the report");
      break;
    case "context":
      if (entry.factors.length === 0) out.push("context without a factor");
      for (const id of entry.factors) if (!ALL_PREDEFINED_FACTORS.some((f) => f.id === id)) out.push(`unknown factor ${id}`);
      break;
    case "pending":
      if (!PENDING_0_20.has(`${iface}.${field}`)) out.push("pending is closed for new fields — give it a purpose");
      if (!entry.note.trim()) out.push("pending without a note");
      break;
  }
  return out;
}

describe("field purpose register — the guard itself", () => {
  it("bites: an unknown reader, a reader that does not read, an undocumented field, a new pending field", () => {
    expect(problems("DataFlowProperties", "protocol", { purpose: "calculation", readBy: ["features/none.ts"] })).toHaveLength(1);
    expect(problems("DataFlowProperties", "protocol", { purpose: "calculation", readBy: ["features/compliance/services/device-category.ts"] })).toEqual([
      "features/compliance/services/device-category.ts does not read protocol",
    ]);
    expect(problems("DataFlowProperties", "protocol", { purpose: "calculation", readBy: ["features/dfd/models/element-property-defaults.ts"] })[0]).toMatch(/plumbing/);
    expect(problems("DataFlowProperties", "volume", { purpose: "documentation" })).toEqual(["documentation, but not in the report"]);
    expect(problems("DataFlowProperties", "protocol", { purpose: "pending", note: "x" })).toEqual(["pending is closed for new fields — give it a purpose"]);
    expect(problems("DataFlowProperties", "protocol", { purpose: "context", factors: ["no_such_factor"] })).toEqual(["unknown factor no_such_factor"]);
  });
});

describe.each(Object.keys(SOURCES) as RegisteredInterface[])("field purpose register — %s", (iface) => {
  it("G-1: one entry per declared property, none for a property that does not exist", () => {
    const declared = declaredProperties(SOURCES[iface], iface);
    expect(declared.length).toBeGreaterThan(0);
    expect(Object.keys(FIELD_PURPOSE_REGISTER[iface]).sort()).toEqual([...declared].sort());
  });

  it("G-2 … G-5: every entry holds what it declares", () => {
    const found = entries
      .filter(([i]) => i === iface)
      .flatMap(([i, field, entry]) => problems(i, field, entry).map((p) => `${field}: ${p}`));
    expect(found).toEqual([]);
  });
});

describe("field purpose register — retired asset fields", () => {
  it("G-6: neither in the type nor in the register", () => {
    const declared = new Set(declaredProperties(SOURCES.AssetProperties, "AssetProperties"));
    for (const field of RETIRED_ASSET_FIELDS) {
      expect(declared.has(field), field).toBe(false);
      expect(field in FIELD_PURPOSE_REGISTER.AssetProperties, field).toBe(false);
    }
  });

  it("the frozen pending list names only registered pending fields (shrinks with the register)", () => {
    const pendingNow = new Set(entries.filter(([, , e]) => e.purpose === "pending").map(([i, f]) => `${i}.${f}`));
    expect([...PENDING_0_20].filter((k) => !pendingNow.has(k))).toEqual([]);
  });
});
