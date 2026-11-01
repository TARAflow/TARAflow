// ==================== ITEM DEFINITION TEXT ====================
// The Definition sub-tab speaks ISO/SAE 21434 ("item", clause numbers) only
// in ISO projects; elsewhere it is the system definition — for the CRA the
// intended purpose and the product description. Neutral texts live under
// "itemDefinition.neutral.*"; a key without a neutral variant keeps its text.

import { useTranslation } from "react-i18next";

export function useItemDefinitionText(neutral: boolean) {
  const { t, i18n } = useTranslation();
  return (key: string, defaultValue: string): string => {
    const neutralKey = `itemDefinition.neutral.${key}`;
    if (neutral && i18n?.exists?.(neutralKey)) return t(neutralKey);
    return t(`itemDefinition.${key}`, { defaultValue });
  };
}
