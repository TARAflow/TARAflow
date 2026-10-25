// features/hazards/services/importer/hazard-bridge.ts
//
// Layer 2: SafetyHazard[] -> native graph model (HazardItem + edges).
//
// Targets come from the imported "affected persons" (AC). Each distinct role
// (Bediener, Service-personal, …) becomes ONE deduplicated Human asset, and
// every hazard endangers the role(s) it lists — with the marker-mapped severity
// living STRUCTURED on the endangers edge (per target), as the model intends.
// Hazards without an affected person stay target-less (incomplete) for the
// analyst to wire up in the bowtie.
//
// Pure except for the injected asset-minting primitive; no React, no I/O.

import type {
  SafetyHazard,
  HazardSeverity,
  LegacyHazardSeverity,
} from "../models/safety-hazard-types";
import type { HazardImportWarning } from "./safety-hazard-importer";
import type {
  HazardItem,
  HazardItemId,
  HazardRelation,
  ContributesToRelation,
  EndangersRelation,
  HumanHarmSeverity,
  CreatedAsset,
  PhysicalHazardPotential,
} from "shared";

/**
 * Legacy intermediate scale -> human-harm scale (HI-1a, unchanged mapping).
 * "negligible" has no human-harm peer; it maps to the lowest level.
 * "critical" (severe, irreversible) maps conservatively to irreversible_major.
 */
const SEVERITY_TO_HUMAN: Record<LegacyHazardSeverity, HumanHarmSeverity> = {
  negligible: "reversible_minor",
  marginal: "reversible_minor",
  critical: "irreversible_major",
  catastrophic: "fatal",
};

/** Canonical values pass through (HI-1); legacy values map as before (HI-1a). */
function toHumanSeverity(s: HazardSeverity): HumanHarmSeverity {
  return s in SEVERITY_TO_HUMAN ? SEVERITY_TO_HUMAN[s as LegacyHazardSeverity] : (s as HumanHarmSeverity);
}

/**
 * The customer's rating kept with the item (HI-4): probability and RPN are no
 * Hazard Item fields, so they go into importMeta under fixed keys — after the
 * import it stays traceable how the source rated the hazard.
 */
function withImportedRating(h: SafetyHazard): Record<string, string> | undefined {
  const meta: Record<string, string> = { ...(h.importMeta ?? {}) };
  if (h.probability) meta.probability = h.probability;
  if (h.notes?.trim()) meta.residualRisk = h.notes.trim();
  if (typeof h.rpn === "number") meta.rpn = String(h.rpn);
  return Object.keys(meta).length > 0 ? meta : undefined;
}

export function shortLabel(text: string, max = 60): string {
  let s = text.split(/[(\n;]/)[0].trim();
  if (!s) s = text.trim();
  if (s.length > max) s = s.slice(0, max).trim() + "…";
  return s;
}

/** Normalize a role for de-duplication (case/whitespace-insensitive). */
function normRole(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface BridgeOptions {
  makeHazardItemId: () => HazardItemId;
  /** Existing assets (project + pending) for Human-target dedup and id minting. */
  existingAssets: {
    id: string;
    displayId?: string;
    name: string;
    assetGroup: string;
  }[];
  /** Mint a new Human protection-target asset (wraps the shared asset-creation primitive). */
  mintHumanAsset: (name: string, existingIds: string[]) => CreatedAsset;
  defaultHazardDistance?: number;
}

export interface BridgeOutput {
  items: HazardItem[];
  relations: HazardRelation[];
  /** Human protection-target assets newly created during the bridge (fold into dfd.assets). */
  createdAssets: CreatedAsset[];
  warnings: HazardImportWarning[];
}

export function bridgeSafetyHazards(
  hazards: SafetyHazard[],
  opts: BridgeOptions,
): BridgeOutput {
  const items: HazardItem[] = [];
  const relations: HazardRelation[] = [];
  const createdAssets: CreatedAsset[] = [];
  const warnings: HazardImportWarning[] = [];
  const distance = opts.defaultHazardDistance ?? 1;

  // role -> Human asset id. Seeded from existing human assets, grows as we mint.
  const roleToId = new Map<string, string>();
  for (const a of opts.existingAssets) {
    if (a.assetGroup === "human") roleToId.set(normRole(a.name), a.id);
  }
  const allIds = opts.existingAssets.map((a) => a.displayId ?? a.id);

  const targetFor = (role: string): string => {
    const key = normRole(role);
    const existing = roleToId.get(key);
    if (existing) return existing;
    const created = opts.mintHumanAsset(role, allIds);
    roleToId.set(key, created.id);
    allIds.push(created.displayId);
    createdAssets.push(created);
    return created.id;
  };

  hazards.forEach((h) => {
    const id = opts.makeHazardItemId();

    items.push({
      id,
      label: shortLabel(h.description),
      description: h.description,
      hazardType: h.hazardCategory,
      physicalHazardPotential: h.physicalHazardPotential as
        | PhysicalHazardPotential
        | undefined,
      combinationType: "ANY",
      source: "imported",
      externalRef: h.originalId ?? h.id,
      // The source's residual-risk note is import metadata, not the analyst's
      // rationale; its label comes from i18n (HI-6, no text in stored data).
      importMeta: withImportedRating(h),
    });

    // endangers — one per affected-person role, severity structured on the edge;
    // none without a severity (HI-11): the importer already warned per row.
    const severity = h.severity;
    const roles = h.affectedPersons ?? [];
    if (severity) {
      for (const role of roles) {
        const endangers: EndangersRelation = {
          type: "endangers",
          from: id,
          to: targetFor(role),
          impact: { target: "human", severity: toHumanSeverity(severity) },
          // No rationale text: the edge's provenance says it was derived, and
          // stored data carries no hard-coded wording (HI-6 class, user).
          provenance: "derived",
        };
        relations.push(endangers);
      }
      if (roles.length === 0) {
        warnings.push({
          message: `"${h.id}": no affected person — assign a protection target in the bowtie`,
          severity: "info",
        });
      }
    }

    // contributes_to from affectedAssets (usually none on these sheets).
    for (const assetId of h.affectedAssets ?? []) {
      relations.push({
        type: "contributes_to",
        from: assetId,
        to: id,
        relevance: "indirect",
        hazardDistance: distance,
        provenance: "derived",
      } as ContributesToRelation);
    }
  });

  return { items, relations, createdAssets, warnings };
}