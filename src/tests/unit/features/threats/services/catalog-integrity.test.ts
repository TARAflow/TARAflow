// tests/unit/features/threats/services/catalog-integrity.test.ts
//
// C — catalog integrity. Reads the catalog + i18n JSON files directly as the
// source of truth (via import.meta.glob), independent of how the service
// aggregates them. Guards two failure classes we hit by hand:
//   1. A template references a mitigation/verification ID that does not exist.
//   2. A template (or referenced mitigation/verification) is missing its de/en
//      text — exactly the D-005 / T-009 gap.
//
// SCOPE: per-element + per-interaction (where our work lives and the text paths
// are known). The shared/ templates (gap/interface/physical) are intentionally
// out of scope here — broaden the globs once their text paths are confirmed.
//
// ⚠ WIRING: import.meta.glob patterns are root-absolute (/src/...). Adjust the
// prefixes if your source root or locale layout differs. eager:true returns the
// parsed JSON modules synchronously (Vite/Vitest feature).

import { describe, it, expect } from "vitest";

//const glob = (import.meta as any).glob;

// ── catalog definitions (source of truth for IDs and references) ────────────
const elementDefs = import.meta.glob(
  "/src/features/threats/services/catalog/threats/per-element/**/threats-*.json",
  { eager: true },
);
const interactionDefs = import.meta.glob(
  "/src/features/threats/services/catalog/threats/per-interaction/**/threats-*.json",
  { eager: true },
);
const mitigationDefs = import.meta.glob(
  "/src/features/threats/services/catalog/mitigations/mitigations-*.json",
  { eager: true },
);
const verificationDefs = import.meta.glob(
  "/src/features/threats/services/catalog/verifications/verifications-*.json",
  { eager: true },
);

// ── i18n text (one set of import.meta.globs per locale — paths must be literal) ─────────
const elementTextEn = import.meta.glob(
  "/src/i18n/locales/en/threats/per-element/**/threats-*.json",
  { eager: true },
);
const elementTextDe = import.meta.glob(
  "/src/i18n/locales/de/threats/per-element/**/threats-*.json",
  { eager: true },
);
const interactionTextEn = import.meta.glob(
  "/src/i18n/locales/en/threats/per-interaction/**/threats-*.json",
  { eager: true },
);
const interactionTextDe = import.meta.glob(
  "/src/i18n/locales/de/threats/per-interaction/**/threats-*.json",
  { eager: true },
);
const mitigationTextEn = import.meta.glob(
  "/src/i18n/locales/en/mitigations/mitigations-*.json",
  { eager: true },
);
const mitigationTextDe = import.meta.glob(
  "/src/i18n/locales/de/mitigations/mitigations-*.json",
  { eager: true },
);
const verificationTextEn = import.meta.glob(
  "/src/i18n/locales/en/verifications/verifications-*.json",
  { eager: true },
);
const verificationTextDe = import.meta.glob(
  "/src/i18n/locales/de/verifications/verifications-*.json",
  { eager: true },
);

// ── helpers ─────────────────────────────────────────────────────────────────
type Glob = Record<string, unknown>;
const val = (m: unknown): any => (m as any)?.default ?? m;

interface TemplateDef {
  id: string;
  mitigations?: string[];
  verifications?: string[];
}

/** Templates from catalog definition files ({ elementTemplates | interactionTemplates }). */
function templates(glob: Glob): TemplateDef[] {
  const out: TemplateDef[] = [];
  for (const m of Object.values(glob)) {
    const j = val(m);
    out.push(...(j.elementTemplates ?? j.interactionTemplates ?? []));
  }
  return out;
}

/** Defined entry IDs from mitigation/verification definition files. */
function defIds(glob: Glob, key: "mitigations" | "verifications"): Set<string> {
  const ids = new Set<string>();
  for (const m of Object.values(glob)) {
    for (const e of val(m)[key] ?? []) ids.add(e.id);
  }
  return ids;
}

/** Threat-text IDs: text files are nested { "<domain>": { "<ID>": {...} } }. */
function threatTextIds(glob: Glob): Set<string> {
  const ids = new Set<string>();
  for (const m of Object.values(glob)) {
    const j = val(m);
    for (const domain of Object.keys(j)) {
      for (const id of Object.keys(j[domain] ?? {})) ids.add(id);
    }
  }
  return ids;
}

/** Flat text IDs: mitigation/verification text files are { "<ID>": {...} }. */
function flatTextIds(glob: Glob): Set<string> {
  const ids = new Set<string>();
  for (const m of Object.values(glob)) {
    for (const id of Object.keys(val(m))) ids.add(id);
  }
  return ids;
}

// ── derived sets ─────────────────────────────────────────────────────────────
const elementTemplates = templates(elementDefs);
const interactionTemplates = templates(interactionDefs);
const allTemplates = [...elementTemplates, ...interactionTemplates];

const definedMitigations = defIds(mitigationDefs, "mitigations");
const definedVerifications = defIds(verificationDefs, "verifications");

const elTextEn = threatTextIds(elementTextEn);
const elTextDe = threatTextIds(elementTextDe);
const ixTextEn = threatTextIds(interactionTextEn);
const ixTextDe = threatTextIds(interactionTextDe);

const mitTextEn = flatTextIds(mitigationTextEn);
const mitTextDe = flatTextIds(mitigationTextDe);
const verTextEn = flatTextIds(verificationTextEn);
const verTextDe = flatTextIds(verificationTextDe);

// ── sanity: globs actually resolved something ────────────────────────────────
describe("catalog integrity — fixtures loaded", () => {
  it("found element and interaction templates", () => {
    expect(elementTemplates.length).toBeGreaterThan(0);
    expect(interactionTemplates.length).toBeGreaterThan(0);
  });
  it("found mitigation and verification definitions", () => {
    expect(definedMitigations.size).toBeGreaterThan(0);
    expect(definedVerifications.size).toBeGreaterThan(0);
  });
});

// ── 1. no dangling references ─────────────────────────────────────────────────
describe("catalog integrity — referential", () => {
  it("every referenced mitigation ID is defined", () => {
    const missing: string[] = [];
    for (const t of allTemplates)
      for (const id of t.mitigations ?? [])
        if (!definedMitigations.has(id)) missing.push(`${t.id} → ${id}`);
    expect(missing).toEqual([]);
  });

  it("every referenced verification ID is defined", () => {
    const missing: string[] = [];
    for (const t of allTemplates)
      for (const id of t.verifications ?? [])
        if (!definedVerifications.has(id)) missing.push(`${t.id} → ${id}`);
    expect(missing).toEqual([]);
  });
});

// ── 2. i18n text completeness (would have caught D-005 / T-009) ──────────────
describe("catalog integrity — i18n text completeness", () => {
  it("every element template has threat text in en and de", () => {
    const missing: string[] = [];
    for (const t of elementTemplates) {
      if (!elTextEn.has(t.id)) missing.push(`en/per-element ${t.id}`);
      if (!elTextDe.has(t.id)) missing.push(`de/per-element ${t.id}`);
    }
    expect(missing).toEqual([]);
  });

  it("every interaction template has threat text in en and de", () => {
    const missing: string[] = [];
    for (const t of interactionTemplates) {
      if (!ixTextEn.has(t.id)) missing.push(`en/per-interaction ${t.id}`);
      if (!ixTextDe.has(t.id)) missing.push(`de/per-interaction ${t.id}`);
    }
    expect(missing).toEqual([]);
  });

  it("every referenced mitigation has text in en and de", () => {
    const referenced = new Set(allTemplates.flatMap((t) => t.mitigations ?? []));
    const missing: string[] = [];
    for (const id of referenced) {
      if (!mitTextEn.has(id)) missing.push(`en mitigation ${id}`);
      if (!mitTextDe.has(id)) missing.push(`de mitigation ${id}`);
    }
    expect(missing).toEqual([]);
  });

  it("every referenced verification has text in en and de", () => {
    const referenced = new Set(
      allTemplates.flatMap((t) => t.verifications ?? []),
    );
    const missing: string[] = [];
    for (const id of referenced) {
      if (!verTextEn.has(id)) missing.push(`en verification ${id}`);
      if (!verTextDe.has(id)) missing.push(`de verification ${id}`);
    }
    expect(missing).toEqual([]);
  });
});
