import React from 'react';
import { useTranslation } from "react-i18next";
import { PhaseStatus, getPhaseStatusIcon, getPhaseStatusColor } from "shared";
import { Tooltip } from "@mui/material";

// ==================== PHASE TAB COMPONENT ====================

interface PhaseTabProps {
  phaseId: number;
  label: string;
  status: PhaseStatus;
  isActive: boolean;
  onClick: () => void;
  errorCount?: number;
  warningCount?: number;
}

export const PhaseTab: React.FC<PhaseTabProps> = ({
  label,
  status,
  isActive,
  onClick,
  errorCount = 0,
  warningCount = 0,
}) => {
  const { t } = useTranslation();
  const icon = getPhaseStatusIcon(status);
  const color = getPhaseStatusColor(status);

  // Build tooltip text
  const getTooltipText = (): string => {
    const parts: string[] = [];

    if (errorCount > 0) {
      parts.push(`${errorCount} ${t("tabs.dfd.validation.errors")}`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} ${t("tabs.dfd.validation.warnings")}`);
    }

    if (parts.length === 0) {
      if (status === "complete") {
        return t("tabs.dfd.validation.valid");
      }
      return "";
    }

    return parts.join(", ");
  };

  const tooltipText = getTooltipText();

  const tabButton = (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        isActive
          ? "bg-white text-blue-600 border-t-2 border-x-2 border-blue-600"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      {label}
      <span className="flex items-center gap-1">
        <span style={{ color }}>{icon}</span>
        {/* Show badge for errors/warnings */}
        {errorCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {errorCount}
          </span>
        )}
        {errorCount === 0 && warningCount > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-yellow-500 rounded-full">
            {warningCount}
          </span>
        )}
      </span>
    </button>
  );

  // Wrap with tooltip if there's something to show
  if (tooltipText) {
    return (
      <Tooltip title={tooltipText} arrow placement="bottom">
        {tabButton}
      </Tooltip>
    );
  }

  return tabButton;
};