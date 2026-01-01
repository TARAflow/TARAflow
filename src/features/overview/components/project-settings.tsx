import React from "react";
import { useTranslation } from "react-i18next";
import type { ProjectSettingsData } from "../models/overview-types";

// ==================== PROJECT SETTINGS ====================
// Project Settings section - only Validation and Auto Saving
// Workflow/Critical System is now in Project Info

interface ProjectSettingsProps {
  settings: ProjectSettingsData;
  onUpdate: (settings: ProjectSettingsData) => void;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  const { t } = useTranslation();

  const handleChange = (
    key: keyof ProjectSettingsData,
    value: boolean | number
  ) => {
    onUpdate({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t("settings.title")}
      </h3>

      <div className="space-y-6">
        {/* ==================== VALIDATION ==================== */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {t("settings.validation", { defaultValue: "Validation" })}
          </h4>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.strictMode}
              onChange={(e) => handleChange("strictMode", e.target.checked)}
              className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">
                {t("settings.strictMode")}
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                {t("settings.strictModeDescription")}
              </p>
            </div>
          </label>
        </div>

        {/* ==================== AUTO SAVING ==================== */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {t("settings.saving", { defaultValue: "Auto Saving" })}
          </h4>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => handleChange("autoSave", e.target.checked)}
                className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700 font-medium">
                  {t("settings.autoSave")}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("settings.autoSaveDescription")}
                </p>
              </div>
            </label>

            {/* Auto Save Interval (shown only when autoSave is enabled) */}
            {settings.autoSave && (
              <div className="ml-7">
                <label className="block text-sm text-gray-700 mb-1.5">
                  {t("settings.autoSaveInterval")}
                </label>
                <select
                  aria-label={t("settings.autoSaveInterval")}
                  value={settings.autoSaveInterval || 30}
                  onChange={(e) =>
                    handleChange("autoSaveInterval", parseInt(e.target.value))
                  }
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  <option value={15}>15 {t("common.seconds")}</option>
                  <option value={30}>30 {t("common.seconds")}</option>
                  <option value={60}>60 {t("common.seconds")}</option>
                  <option value={120}>2 {t("common.minutes")}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};