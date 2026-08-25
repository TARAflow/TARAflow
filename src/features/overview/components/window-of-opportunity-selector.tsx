import React from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Tooltip } from "@mui/material";
import {
  ProjectTags,
  regulationPresetFromTags,
  WINDOW_OF_OPPORTUNITY_OPTIONS,
  type WindowOfOpportunity,
} from "shared";

// ==================== WINDOW OF OPPORTUNITY SELECTOR ====================
// Project-global EN 50742 Approach A LIKELIHOOD input (Annex B, Table B.3 —
// prEN 50742:2025 §3.3): how often and predictably an attacker gets an
// unnoticed opportunity to access the machine, not how exposed an interface
// is (that's Exposure Level, a separate per-risk factor). Feeds
// AP = EL × WoO + AC.
//
// Shared by project-info and new-project-dialog, mirroring
// SafetyAnalysisToggle: relevance is derived from tags, not passed in by the
// parent, so both consumers stay in sync automatically. Rendered side by side
// with SafetyAnalysisToggle (each 50% width) by the parent, which also reads
// the same relevance check to size the row correctly.
//
// Unlike SafetyAnalysisToggle this is not a forced/locked value — the
// analyst's assessment of physical/logical access to the machine cannot be
// inferred from tags, so it is only hidden (not defaulted) when irrelevant,
// and left unset until the analyst picks one.

interface WindowOfOpportunitySelectorProps {
  /** Regulation/domain/platform tags — used to derive EN 50742 Approach A relevance. */
  tags: ProjectTags;
  /** Current stored/draft value owned by the parent. */
  value?: WindowOfOpportunity;
  /** Edit mode renders the dropdown; display mode renders a read-only badge. */
  editing: boolean;
  onChange: (value: WindowOfOpportunity) => void;
}

export const WindowOfOpportunitySelector: React.FC<
  WindowOfOpportunitySelectorProps
> = ({ tags, value, editing, onChange }) => {
  const { t } = useTranslation();

  // Only EN 50742 Approach A consumes WoO (AP = EL × WoO + AC). Approach B and
  // every other preset ignore it — no point asking the analyst to rate it.
  const relevant = regulationPresetFromTags(tags) === "en-50742-a";
  if (!relevant) return null;

  const selected = WINDOW_OF_OPPORTUNITY_OPTIONS.find((o) => o.id === value);

  if (!editing) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("settings.windowOfOpportunity", {
            defaultValue: "Window of Opportunity",
          })}
        </label>
        <div className="flex items-center gap-2 py-2">
          {selected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
              {t(selected.nameKey, { defaultValue: selected.id })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
              {t("settings.windowOfOpportunityUnset", {
                defaultValue: "Not set",
              })}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t("settings.windowOfOpportunity", {
          defaultValue: "Window of Opportunity",
        })}
        <Tooltip
          title={t("settings.windowOfOpportunityTooltip", {
            defaultValue:
              "EN 50742 Approach A likelihood factor: how often and how predictably an attacker gets an unnoticed opportunity to access the machine — driven by how frequently it is serviced/accessed and how closely that access is supervised (Annex B, Table B.3). This is the WoO in AP = EL × WoO + AC, applied to every risk in this project; Exposure Level (a separate per-risk factor) covers which interfaces are reachable, not how often.",
          })}
          arrow
          placement="right"
        >
          <Info className="w-3.5 h-3.5 text-gray-400 cursor-help inline-block ml-1.5 align-text-top" />
        </Tooltip>
      </label>

      {/* Same border/rounded/padding as SafetyAnalysisToggle's box, stretched
          via flex-1 to the grid row's height (CSS Grid stretches items by
          default) so both frames line up regardless of content length. */}
      <div className="flex-1 flex flex-col justify-center gap-1 border border-gray-300 rounded-lg px-4 py-3">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value as WindowOfOpportunity)}
          className="w-full bg-transparent text-sm focus:outline-none"
        >
          <option value="" disabled>
            {t("settings.windowOfOpportunityPlaceholder", {
              defaultValue: "Select…",
            })}
          </option>
          {WINDOW_OF_OPPORTUNITY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {t(option.nameKey, { defaultValue: option.id })}
            </option>
          ))}
        </select>

        {!value && (
          <p className="text-xs text-amber-600">
            {t("settings.windowOfOpportunityRequired", {
              defaultValue:
                "Required for EN 50742 Approach A — likelihood cannot be computed until this is set.",
            })}
          </p>
        )}
      </div>
    </div>
  );
};