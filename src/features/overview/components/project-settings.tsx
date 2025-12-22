import React from "react";
import { useTranslation } from "react-i18next";
import type { ProjectSettingsData } from "../models/overview-types";

// ==================== PROJECT SETTINGS ====================
// Displays and allows editing of project settings
//
// Pure UI component - type imported from models

interface ProjectSettingsProps {
  /** Current settings */
  settings: ProjectSettingsData;
  /** Callback when settings change */
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
      <div className="space-y-3">
        {/* Strict Mode */}
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.strictMode}
            onChange={(e) => handleChange("strictMode", e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <span className="text-sm text-gray-700">
              {t("settings.strictMode")}
            </span>
            <p className="text-xs text-gray-500">
              {t("settings.strictModeDescription")}
            </p>
          </div>
        </label>

        {/* Auto Save */}
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => handleChange("autoSave", e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <span className="text-sm text-gray-700">
              {t("settings.autoSave")}
            </span>
            <p className="text-xs text-gray-500">
              {t("settings.autoSaveDescription")}
            </p>
          </div>
        </label>

        {/* Auto Save Interval (shown only when autoSave is enabled) */}
        {settings.autoSave && (
          <div className="ml-7">
            <label className="block text-sm text-gray-700 mb-1">
              {t("settings.autoSaveInterval")}
            </label>
            <select
              aria-label={t("settings.autoSaveInterval")}
              id="auto-save-interval"
              value={settings.autoSaveInterval || 30}
              onChange={(e) =>
                handleChange("autoSaveInterval", parseInt(e.target.value))
              }
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
  );
};
