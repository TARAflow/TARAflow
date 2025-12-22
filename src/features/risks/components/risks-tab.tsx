import React from 'react';
import { useTranslation } from "react-i18next";

// ==================== RISK TAB (PHASE 4) ====================

interface RiskTabProps {}

export const RiskTab: React.FC<RiskTabProps> = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">{t("tabs.risk.title")}</h2>
      <p className="text-gray-600 mt-2">{t("tabs.risk.description")}</p>
      {/* TODO: Implement risk assessment */}
    </div>
  );
};
