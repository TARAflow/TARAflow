import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import { PhaseStatus, PhaseStatusMap, PhaseDefinition } from "shared";
import { type ProjectProgressData } from "../models/overview-types";

// ==================== PROJECT PROGRESS ====================
// Displays phase progress overview
//
// Pure UI component - all types imported from shared/models

interface ProjectProgressProps {
  /** Progress data */
  data: ProjectProgressData;
  /** Phase definitions (injected from app) */
  phases: PhaseDefinition[];
  /** Get status icon for a phase status */
  getStatusIcon: (status: PhaseStatus) => string;
  /** Get status color for a phase status */
  getStatusColor: (status: PhaseStatus) => string;
}

export const ProjectProgress: React.FC<ProjectProgressProps> = ({
  data,
  phases,
  getStatusIcon,
  getStatusColor,
}) => {
  const { t } = useTranslation();

  const getPhaseProgress = () => {
    const statuses = Object.values(data.phaseStatus);
    const complete = statuses.filter((s) => s === "complete").length;
    return Math.round((complete / statuses.length) * 100);
  };

  const getStatusTranslation = (status: PhaseStatus) => {
    switch (status) {
      case "not-started":
        return t("status.notStarted");
      case "in-progress":
        return t("status.inProgress");
      case "incomplete":
        return t("status.incomplete");
      case "complete":
        return t("status.complete");
      default:
        return status;
    }
  };

  const renderValidationBadge = (phaseId: number, status: PhaseStatus) => {
    const validationInfo = data.validationInfo?.[phaseId];
    const errors = validationInfo?.errors ?? 0;
    const warnings = validationInfo?.warnings ?? 0;

    if (errors > 0) {
      return (
        <div className="flex items-center gap-1 text-red-600 text-xs mt-1">
          <AlertCircle className="w-3 h-3" />
          <span>
            {errors} {t("tabs.dfd.validation.errors")}
          </span>
        </div>
      );
    }

    if (warnings > 0) {
      return (
        <div className="flex items-center gap-1 text-yellow-600 text-xs mt-1">
          <AlertTriangle className="w-3 h-3" />
          <span>
            {warnings} {t("tabs.dfd.validation.warnings")}
          </span>
        </div>
      );
    }

    if (status === "complete") {
      return (
        <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
          <CheckCircle className="w-3 h-3" />
          <span>{t("tabs.dfd.validation.valid")}</span>
        </div>
      );
    }

    return null;
  };

  const progress = getPhaseProgress();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t("phases.phaseProgress")}
      </h3>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">{t("phases.overallProgress")}</span>
          <span className="font-semibold text-gray-900">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Phase Grid */}
      <div className="grid grid-cols-6 gap-3">
        {phases.map((phase) => {
          const status = data.phaseStatus[phase.id as keyof PhaseStatusMap];
          const icon = getStatusIcon(status);
          const color = getStatusColor(status);
          const validationInfo = data.validationInfo?.[phase.id];
          const errors = validationInfo?.errors ?? 0;
          const warnings = validationInfo?.warnings ?? 0;

          // Determine border color based on validation
          let borderClass = "border-gray-200 hover:border-blue-300";
          if (errors > 0) {
            borderClass = "border-red-300 hover:border-red-400";
          } else if (warnings > 0) {
            borderClass = "border-yellow-300 hover:border-yellow-400";
          } else if (status === "complete") {
            borderClass = "border-green-300 hover:border-green-400";
          }

          return (
            <div
              key={phase.id}
              className={`border rounded-lg p-3 text-center cursor-pointer transition-colors ${borderClass}`}
            >
              <div className="text-2xl mb-1" style={{ color }}>
                {icon}
              </div>
              <div className="text-xs font-medium text-gray-600">
                {phase.shortLabel}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {getStatusTranslation(status)}
              </div>
              {renderValidationBadge(phase.id, status)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
