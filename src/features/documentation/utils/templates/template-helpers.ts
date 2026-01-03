// ==================== TEMPLATE HELPERS ====================
// Shared utilities for all document generators
// Location: features/documentation/utils/templates/template-helpers.ts

import type { DocLanguage } from "../../models/doc-types";

// ==================== PLACEHOLDER REPLACEMENT ====================

/**
 * Replace all placeholders in a template string
 * Format: {{placeholder}}
 */
export function replacePlaceholders(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = new RegExp(`{{${key}}}`, "g");
    result = result.replace(placeholder, String(value ?? ""));
  }
  return result;
}

/**
 * Process conditional sections in templates
 * Format: {{#variable}}content{{/variable}}
 */
export function processConditionals(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  let result = template;

  // Find all conditional blocks
  const regex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

  result = result.replace(regex, (_match, key, content) => {
    const value = values[key];
    // Show content only if value exists and is truthy
    if (value !== undefined && value !== null && value !== "") {
      return content;
    }
    return "";
  });

  return result;
}

// ==================== TEXT ESCAPING ====================

/**
 * Escape special characters for Markdown tables
 */
export function escapeMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .replace(/\r/g, "");
}

/**
 * Escape special characters for AsciiDoc tables
 */
export function escapeAsciidoc(text: string): string {
  if (!text) return "";
  return text
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " +\n")
    .replace(/\r/g, "");
}

// ==================== TEXT FORMATTING ====================

/**
 * Truncate text with ellipsis for table cells
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Format text with fallback to "-" if empty
 */
export function formatTextOrDash(text: string | undefined | null): string {
  if (!text || text.trim() === "") return "-";
  return text;
}

/**
 * Format security goals as comma-separated string
 */
export function formatSecurityGoals(
  goals: Array<{ type: string; description: string }>
): string {
  if (!goals || goals.length === 0) return "-";
  return goals.map((g) => g.type).join(", ");
}

/**
 * Format mitigations as joined string
 */
export function formatMitigations(mitigations: string[]): string {
  if (!mitigations || mitigations.length === 0) return "-";
  return mitigations.join("; ");
}

// ==================== TAG FORMATTING ====================

/**
 * Format tags grouped by category for Markdown
 */
export function formatTagsGroupedMarkdown(
  tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>
): string {
  if (tagsByCategory.length === 0) return "-";
  return tagsByCategory
    .map(({ categoryLabel, tags }) => `**${categoryLabel}**: ${tags.join(", ")}`)
    .join("\n\n");
}

/**
 * Format tags grouped by category for AsciiDoc
 */
export function formatTagsGroupedAsciidoc(
  tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>
): string {
  if (tagsByCategory.length === 0) return "-";
  return tagsByCategory
    .map(({ categoryLabel, tags }) => `*${categoryLabel}*: ${tags.join(", ")}`)
    .join("\n\n");
}

// ==================== LABEL HELPERS ====================

/**
 * Get Yes/No text
 */
export function getYesNoText(value: boolean, language: DocLanguage): string {
  if (value) {
    return language === "de" ? "Ja" : "Yes";
  }
  return language === "de" ? "Nein" : "No";
}
