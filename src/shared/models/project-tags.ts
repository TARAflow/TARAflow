// ==================== PROJECT TAGS ====================
// Shared type for project tag categorization.
// Used by: features/overview, features/threats, app/services

import {
  TAG_CATEGORIES,
  getTagCategory,
  type TagCategoryKey,
} from "../utils/tag-categories";

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
  const trimmed = tagName.trim();
  if (!trimmed) return tags;
  if (flattenProjectTags(tags).includes(trimmed)) return tags;

  const cat = categoryOverride
    ? TAG_CATEGORIES.find((c) => c.key === categoryOverride)
    : getTagCategory(trimmed, {});

  const bucket = (cat?.key ?? "custom") as keyof ProjectTags;
  return { ...tags, [bucket]: [...(tags[bucket] as string[]), trimmed] };
}

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