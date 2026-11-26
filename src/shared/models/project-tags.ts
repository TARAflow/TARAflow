// ==================== PROJECT TAGS ====================
// Shared type for project tag categorization.
// Used by: features/overview, features/threats, app/services

import {
  TAG_CATEGORIES,
  getTagCategory,
  type TagCategoryKey,
} from "../utils/tag-categories";
import {
  isBareEn50742Tag,
  isEn50742ApproachBTag,
  methodTagOf,
  methodTagsExclude,
} from "../services/tag-validator";

// ==================== TYPE ====================

export interface ProjectTags {
  domain:     string[];   // Industrial, Medical, Automotive...
  platform:   string[];   // Embedded, OT, Cloud, Web...
  regulation: string[];   // IEC 62443, CRA, ISO 21434...
  custom:     string[];   // Free tags — no category validation
}

// ==================== CONSTANTS ====================

export const EMPTY_PROJECT_TAGS: ProjectTags = {
  domain:     [],
  platform:   [],
  regulation: [],
  custom:     [],
};

// ==================== MIGRATION ====================

/**
 * Migrate legacy string[] to ProjectTags with correct categorization.
 * Uses TAG_CATEGORIES to place each tag in the correct bucket.
 * Idempotent — safe to call on already-migrated data.
 */
export function migrateProjectTags(
  raw: string[] | ProjectTags,
  customTagCategories: Record<string, TagCategoryKey> = {},
): ProjectTags {
  if (!Array.isArray(raw)) return raw; // Already ProjectTags

  const result: ProjectTags = { ...EMPTY_PROJECT_TAGS };
  for (const tag of raw) {
    const cat = getTagCategory(tag, customTagCategories);
    const bucket = (cat?.key ?? "custom") as keyof ProjectTags;
    (result[bucket] as string[]).push(tag);
  }
  return result;
}

// ==================== HELPERS ====================

/**
 * Add a tag to the correct bucket based on TAG_CATEGORIES.
 * categoryOverride: used for custom tags where auto-detection fails.
 * Prevents duplicates across all buckets.
 */
export function addTagToProject(
  tags: ProjectTags,
  tagName: string,
  categoryOverride?: TagCategoryKey,
): ProjectTags {
  return addTagWithOutcome(tags, tagName, categoryOverride).tags;
}

/** What adding a tag did — the editor says it when a tag was replaced or refused. */
export interface TagAddOutcome {
  tags: ProjectTags;
  /** The tag as stored (an EN 50742 spelling as its catalogue tag); absent when nothing was added. */
  added?: string;
  /** Method tags the new one replaced (combinations that are excluded). */
  replaced: string[];
  /** "en50742-approach": the bare "EN 50742" — choose A or B. */
  refused?: "en50742-approach";
}

/**
 * Adds a tag. A method tag (ISO 21434, EN 50742 A / B, ETSI TVRA) goes to the
 * regulations and replaces the method tags it cannot go with (user 2026-11-21: EN 50742 A <-> B, ISO 21434 <->
 * EN 50742 A / B and ETSI TVRA — tag-validator.ts). The bare "EN 50742" is
 * refused.
 */
export function addTagWithOutcome(
  tags: ProjectTags,
  tagName: string,
  categoryOverride?: TagCategoryKey,
): TagAddOutcome {
  const typed = tagName.trim();
  if (!typed) return { tags, replaced: [] };
  if (isBareEn50742Tag(typed)) return { tags, replaced: [], refused: "en50742-approach" };

  const method = methodTagOf(typed);
  // Only the EN 50742 spellings become the catalogue tag ("EN50742_B" →
  // "EN 50742 B": A and B decide the matrices). Other method tags stay as
  // typed — "ETSI TS 102 165-1" says more than "ETSI TVRA" (review
  // 2026-11-21); methodTagOf reads them all.
  const trimmed = method === "EN 50742 A" || method === "EN 50742 B" ? method : typed;
  if (flattenProjectTags(tags).includes(trimmed)) return { tags, replaced: [] };

  // The same method in another spelling goes silently; an excluded one is named.
  const existing = method ? flattenProjectTags(tags).filter((t) => methodTagOf(t) !== null) : [];
  const sameMethod = existing.filter((t) => methodTagOf(t) === method);
  const replaced = existing.filter((t) => method && methodTagOf(t) !== method && methodTagsExclude(method, methodTagOf(t)!));
  const base = [...sameMethod, ...replaced].reduce((acc, old) => removeTagFromProject(acc, old), tags);

  const cat = method
    ? TAG_CATEGORIES.find((c) => c.key === "regulation")
    : categoryOverride
      ? TAG_CATEGORIES.find((c) => c.key === categoryOverride)
      : getTagCategory(trimmed, {});

  const bucket = (cat?.key ?? "custom") as keyof ProjectTags;
  const next = { ...base, [bucket]: [...(base[bucket] as string[]), trimmed] };
  // EN 50742 Approach B builds on IEC 62443-4-2:2019 (Table 4): its tag brings
  // the IEC 62443 tag along (user 2026-11-20) — the 62443 sub-tab shows the
  // full matrix next to B's subset, and both share their statements (K-6).
  return { tags: isEn50742ApproachBTag(trimmed) ? addTagToProject(next, IEC_62443_TAG) : next, replaced, added: trimmed };
}

/** The tag of the IEC 62443-4-2:2019 matrix (standard registry TAG_IEC_62443). */
export const IEC_62443_TAG = "IEC 62443";

/**
 * Remove a tag from whichever bucket it lives in.
 */
export function removeTagFromProject(
  tags: ProjectTags,
  tagName: string,
): ProjectTags {
  return {
    domain:     tags.domain.filter((t) => t !== tagName),
    platform:   tags.platform.filter((t) => t !== tagName),
    regulation: tags.regulation.filter((t) => t !== tagName),
    custom:     tags.custom.filter((t) => t !== tagName),
  };
}

/**
 * Flatten all buckets into a single string[].
 * Used for backwards-compat checks, search, and validation counts.
 */
export function flattenProjectTags(tags: ProjectTags): string[] {
  return [
    ...tags.domain,
    ...tags.platform,
    ...tags.regulation,
    ...tags.custom,
  ];
}

/**
 * Type guard — checks if a value is already ProjectTags (not string[]).
 */
export function isProjectTags(value: unknown): value is ProjectTags {
  return (
    typeof value === "object" &&
    value !== null &&
    "domain"     in value &&
    "platform"   in value &&
    "regulation" in value &&
    "custom"     in value
  );
}