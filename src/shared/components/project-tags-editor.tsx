import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { AlertTriangle, Settings, ShieldCheck } from "lucide-react";
import { Tooltip } from "@mui/material";
// NOTE: helpers imported from the top "shared" barrel — see the cycle note in
// safety-analysis-toggle.tsx. Consumers import this component from
// "shared/components".
import {
  ProjectTags,
  addTagToProject,
  removeTagFromProject,
  flattenProjectTags,
} from "../models/project-tags";
import { getTagWarnings, tagEffectOf } from "../services/tag-validator";

import {
  TAG_CATEGORIES,
  TagCategoryKey,
  TagCategory,
  getTagStyles,
  getTagDefinition,
  getAvailablePredefinedTags,
} from "../utils/tag-categories";

// ==================== PROJECT TAGS EDITOR ====================
// Reusable tag section shared by project-info and new-project-dialog
// (previously duplicated in both): selected tags grouped by category,
// available predefined tags, custom tag input, and tag conflict / context
// warnings. Owns only its transient input state; the tag set is owned by the
// parent and updated via onChange.

interface ProjectTagsEditorProps {
  tags: ProjectTags;
  /** Edit mode shows the editor; display mode shows read-only badges. */
  editing: boolean;
  onChange: (tags: ProjectTags) => void;
}

export const ProjectTagsEditor: React.FC<ProjectTagsEditorProps> = ({
  tags,
  editing,
  onChange,
}) => {
  const { t } = useTranslation();
  const [tagInput, setTagInput] = useState("");
  const [tagCategory, setTagCategory] = useState<TagCategoryKey>("domain");
  // Unique per instance so project-info and new-project-dialog (which can be
  // mounted at the same time — modal over overview) never share an input id.
  const customTagInputId = React.useId();

  // ==================== TAG HANDLERS ====================

  const addTag = (tag: string, categoryOverride?: TagCategoryKey) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    onChange(addTagToProject(tags, trimmed, categoryOverride));
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    onChange(removeTagFromProject(tags, tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput, tagCategory);
    }
  };

  // Tags grouped by category (including custom tags in their assigned category)
  const getTagsByCategory = (source: ProjectTags) =>
    TAG_CATEGORIES.map((cat) => ({
      category: cat,
      tags: source[cat.key as keyof ProjectTags] as string[],
    })).filter(({ tags }) => tags.length > 0);

  // ==================== RENDER HELPERS ====================

  // Tags that change the workflow stand out — not by colour alone:
  //   method  dark, with a cog (selects the regulation preset)
  //   matrix  outlined, with a shield (enables the requirement matrix)
  const effectText = (effect: "method" | "matrix") =>
    effect === "method"
      ? t("tags.effect.method", {
          defaultValue: "Defines the method: risk calculation, threat generation, work products and report.",
        })
      : t("tags.effect.matrix", {
          defaultValue: "Enables the requirement matrix: Compliance tab and report chapter.",
        });

  const effectClass = (effect: "method" | "matrix" | null, normal: string) =>
    effect === "method"
      ? "bg-green-700 text-white border-green-700"
      : effect === "matrix"
        ? `${normal} border-green-700`
        : `${normal} border-transparent`;

  const effectIcon = (effect: "method" | "matrix" | null) =>
    effect === "method" ? (
      <Settings className="w-3 h-3" aria-hidden data-testid="tag-effect-method" />
    ) : effect === "matrix" ? (
      <ShieldCheck className="w-3 h-3" aria-hidden data-testid="tag-effect-matrix" />
    ) : null;

  const tooltipOf = (tag: string, tooltipKey?: string) => {
    const effect = tagEffectOf(tag);
    const text = tooltipKey ? t(tooltipKey, { defaultValue: tag }) : null;
    if (!effect) return text;
    return (
      <span>
        <strong>{effectText(effect)}</strong>
        {text && (
          <>
            <br />
            {text}
          </>
        )}
      </span>
    );
  };

  const renderTagBadge = (tag: string, showRemoveButton = false) => {
    const styles = getTagStyles(tag, {});
    const tagDef = getTagDefinition(tag);
    const effect = tagEffectOf(tag);
    const tooltip = tooltipOf(tag, tagDef?.tooltipKey);

    const badge = (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border-2 ${effectClass(effect, `${styles.bg} ${styles.text}`)}`}
        data-tag-effect={effect ?? undefined}
      >
        {effectIcon(effect)}
        {tag}
        {showRemoveButton && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="hover:opacity-70"
            aria-label={t("common.remove")}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </span>
    );

    if (tooltip) {
      return (
        <Tooltip key={tag} title={tooltip} arrow placement="top">
          {badge}
        </Tooltip>
      );
    }

    return <React.Fragment key={tag}>{badge}</React.Fragment>;
  };

  const renderAvailableTagButton = (tagName: string, category: TagCategory) => {
    const tagDef = getTagDefinition(tagName);
    const effect = tagEffectOf(tagName);
    const tooltip = tooltipOf(tagName, tagDef?.tooltipKey);

    const button = (
      <button
        type="button"
        onClick={() => addTag(tagName)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs border-2 rounded-full transition-colors hover:opacity-80 ${effectClass(effect, `${category.bgColor} ${category.textColor}`)}`}
        data-tag-effect={effect ?? undefined}
      >
        + {effectIcon(effect)}
        {tagName}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip key={tagName} title={tooltip} arrow placement="top">
          {button}
        </Tooltip>
      );
    }

    return <React.Fragment key={tagName}>{button}</React.Fragment>;
  };

  // ==================== RENDER ====================

  if (!editing) {
    return (
      <div className="py-2">
        {flattenProjectTags(tags).length > 0 ? (
          <div className="space-y-2">
            {getTagsByCategory(tags).map(({ category, tags: catTags }) => (
              <div key={category.key} className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-400 self-center mr-1 min-w-[70px]">
                  {t(category.labelKey, { defaultValue: category.key })}:
                </span>
                {catTags.map((tag) => renderTagBadge(tag, false))}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm italic">
            {t("projectInfo.noTags", { defaultValue: "No tags" })}
          </p>
        )}
      </div>
    );
  }

  const warnings = getTagWarnings(tags);

  return (
    <div className="space-y-4">
      {/* Selected Tags */}
      {flattenProjectTags(tags).length > 0 && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <label className="block text-xs font-medium text-gray-500 mb-2">
            {t("projectInfo.selectedTags", { defaultValue: "Selected Tags" })}
          </label>
          <div className="space-y-2">
            {getTagsByCategory(tags).map(({ category, tags: catTags }) => (
              <div key={category.key} className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-400 self-center mr-1 min-w-[70px]">
                  {t(category.labelKey, { defaultValue: category.key })}:
                </span>
                {catTags.map((tag) => renderTagBadge(tag, true))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Tags by Category */}
      <div className="space-y-3">
        {TAG_CATEGORIES.map((category) => {
          const availableTags = getAvailablePredefinedTags(
            category,
            flattenProjectTags(tags),
          );
          if (availableTags.length === 0) return null;

          return (
            <div key={category.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t(category.labelKey, { defaultValue: category.key })}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableTags.map((tagDef) =>
                  renderAvailableTagButton(tagDef.name, category),
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend for the marked tags */}
      <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="tag-effect-legend">
        <span className="inline-flex items-center gap-1">
          <Settings className="w-3 h-3" aria-hidden />
          {t("tags.effect.legendMethod", { defaultValue: "defines the method" })}
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" aria-hidden />
          {t("tags.effect.legendMatrix", { defaultValue: "enables the requirement matrix" })}
        </span>
      </p>

      {/* Custom Tag Input */}
      <div>
        <label
          htmlFor={customTagInputId}
          className="block text-xs font-medium text-gray-500 mb-1.5"
        >
          {t("projectInfo.customTag", { defaultValue: "Custom Tag" })}
        </label>
        <div className="flex gap-2">
          <input
            id={customTagInputId}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={handleTagKeyPress}
            placeholder={t("projectInfo.customTagPlaceholder", {
              defaultValue: "Enter custom tag...",
            })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={tagCategory}
            onChange={(e) => setTagCategory(e.target.value as TagCategoryKey)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            aria-label={t("projectInfo.selectCategory", {
              defaultValue: "Select category",
            })}
          >
            {TAG_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {t(cat.labelKey, { defaultValue: cat.key })}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => addTag(tagInput, tagCategory)}
            disabled={!tagInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.add")}
          </button>
        </div>
      </div>

      {/* Tag Warnings — conflicts (red) above context hints (amber) */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => {
            const isConflict = w.kind === "mutual-exclusion";
            return (
              <p
                key={`${w.kind ?? "context"}:${w.regulation}:${
                  w.conflictsWith?.join(",") ?? ""
                }:${i}`}
                className={`text-xs flex items-center gap-1 ${
                  isConflict ? "text-red-600 font-medium" : "text-amber-600"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                {w.message}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
