import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";
import { Tooltip } from "@mui/material";
// NOTE: importing the helpers from the top "shared" barrel. If that barrel
// re-exports this component (./components), switch these to relative imports
// (e.g. "../validation/tag-validator", "../models/project-tags") to avoid a
// barrel import cycle. Consumers import this component from "shared/components".
import { ProjectTags } from "../models/project-tags";
import { requiresHazardAnalysis } from "../services/tag-validator";

// ==================== SAFETY ANALYSIS TOGGLE ====================
// Reusable safety/hazard slide switch, shared by project-info and
// new-project-dialog (previously duplicated in both).
//
// EN 50742 coupling: any EN 50742 regulation tag mandates hazard analysis, so
// the switch is forced ON and locked, and the owning `safetyRelevant` value is
// synced to true (edit mode only — display mode never mutates parent state).

interface SafetyAnalysisToggleProps {
  /** Regulation/domain/platform tags — used to derive the EN 50742 mandate. */
  tags: ProjectTags;
  /** Current stored/draft value owned by the parent. */
  safetyRelevant: boolean;
  /** Edit mode renders the switch; display mode renders a read-only badge. */
  editing: boolean;
  /** Called when the analyst toggles, and to sync the forced-on value. */
  onChange: (safetyRelevant: boolean) => void;
}

export const SafetyAnalysisToggle: React.FC<SafetyAnalysisToggleProps> = ({
  tags,
  safetyRelevant,
  editing,
  onChange,
}) => {
  const { t } = useTranslation();

  const hazardForced = requiresHazardAnalysis(tags);
  const safetyOn = hazardForced || safetyRelevant;

  // Persist the forced-on value (edit mode only — never mutate on display).
  React.useEffect(() => {
    if (editing && hazardForced && !safetyRelevant) {
      onChange(true);
    }
  }, [editing, hazardForced, safetyRelevant, onChange]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {t("settings.safety", { defaultValue: "Safety Analysis" })}
        {hazardForced && (
          <span className="ml-2 text-xs font-normal text-emerald-600">
            {t("settings.safetyLockedByEn50742", {
              defaultValue: "Required by EN 50742 — locked on",
            })}
          </span>
        )}
      </label>

      {editing ? (
        <label
          className={`flex items-center justify-between border border-gray-300 rounded-lg px-4 py-3 transition-colors ${
            hazardForced
              ? "cursor-not-allowed opacity-90"
              : "cursor-pointer hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Slide Switch */}
            <div className="relative">
              <input
                type="checkbox"
                checked={safetyOn}
                disabled={hazardForced}
                onChange={(e) => {
                  if (hazardForced) return;
                  onChange(e.target.checked);
                }}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors ${
                  safetyOn ? "bg-emerald-500" : "bg-gray-200"
                }`}
              />
              <div
                className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${
                  safetyOn ? "translate-x-5" : ""
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium transition-colors ${
                    safetyOn ? "text-emerald-600" : "text-gray-700"
                  }`}
                >
                  {safetyOn
                    ? t("settings.safetyOn", { defaultValue: "Hazard Analysis" })
                    : t("settings.safetyOff", { defaultValue: "Security Only" })}
                </span>

                {safetyOn && (
                  <AlertTriangle className="w-4 h-4 text-emerald-600" />
                )}

                <Tooltip
                  title={
                    <div className="p-1">
                      <p className="mb-2">
                        {t("settings.safetyTooltip", {
                          defaultValue:
                            "Enables the Hazard tab for safety/hazard analysis, independent of the Standard/Critical workflow.",
                        })}
                      </p>
                      <p className="text-xs opacity-80 mb-1">
                        <strong>Off:</strong> Overview → DFD → …
                      </p>
                      <p className="text-xs opacity-80">
                        <strong>On:</strong> Overview → Hazard → DFD → …
                      </p>
                    </div>
                  }
                  arrow
                  placement="right"
                >
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>

              <p className="text-xs text-gray-500 mt-0.5">
                {safetyOn
                  ? t("settings.safetyOnDescription", {
                      defaultValue:
                        "Hazard tab shown after Overview, before DFD",
                    })
                  : t("settings.safetyOffDescription", {
                      defaultValue: "No Hazard tab — security analysis only",
                    })}
              </p>
            </div>
          </div>
        </label>
      ) : (
        <div className="flex items-center gap-2 py-2">
          {safetyOn ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {t("settings.safetyOn", { defaultValue: "Hazard Analysis" })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
              {t("settings.safetyOff", { defaultValue: "Security Only" })}
            </span>
          )}
          <Tooltip
            title={safetyOn ? "Overview → Hazard → DFD → …" : "Overview → DFD → …"}
            arrow
            placement="right"
          >
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
          </Tooltip>
        </div>
      )}
    </div>
  );
};
