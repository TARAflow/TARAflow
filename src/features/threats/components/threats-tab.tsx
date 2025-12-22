import React from 'react';
import { useTranslation } from "react-i18next";

// ==================== THREATS TAB (PHASE 3) ====================

interface ThreatsTabProps {}

export const ThreatsTab: React.FC<ThreatsTabProps> = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">{t("tabs.threats.title")}</h2>
      <p className="text-gray-600 mt-2">{t("tabs.threats.description")}</p>
      {/* TODO: Implement threats table */}
    </div>
  );
};
