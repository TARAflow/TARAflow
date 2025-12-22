import React from 'react';
import { useTranslation } from "react-i18next";

// ==================== ATTACK TREE TAB (PHASE 5) ====================

interface AttackTreeTabProps {}

export const AttackTreeTab: React.FC<AttackTreeTabProps> = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">{t("tabs.attacktree.title")}</h2>
      <p className="text-gray-600 mt-2">{t("tabs.attacktree.description")}</p>
      {/* TODO: Implement attack tree */}
    </div>
  );
};
