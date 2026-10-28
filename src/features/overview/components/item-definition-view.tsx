import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X } from "lucide-react";

// ==================== ITEM DEFINITION VIEW ====================
// The "Definition" sub-tab of the Overview (ISO/SAE 21434 9.3, RQ-09-01/02;
// conformance plan Phase 1 stage A, decisions 8 and 24). Every preset sees it;
// the preset only decides which sections are mandatory (findings, A-4).
//
// "Purpose and functions" is the former project description: stored in
// info.description, edited here. The further sections (boundary,
// architecture, environment, constraints), the function list and the
// assumptions follow with A-2 / A-3.

interface ItemDefinitionViewProps {
  description: string;
  onDescriptionChange: (description: string) => void;
}

const CARD = "bg-white rounded-lg border border-gray-200 p-6 mb-6";

export const ItemDefinitionView: React.FC<ItemDefinitionViewProps> = ({
  description,
  onDescriptionChange,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);

  const start = () => {
    setDraft(description);
    setEditing(true);
  };
  const save = () => {
    onDescriptionChange(draft);
    setEditing(false);
  };

  return (
    <div data-testid="item-definition-view">
      <p className="text-sm text-gray-600 mb-4">
        {t("itemDefinition.intro", {
          defaultValue:
            "What is analysed: the item (ISO/SAE 21434 9.3), its boundary, functions, preliminary architecture and operational environment. Describe it here or refer to the architecture document it comes from.",
        })}
      </p>

      <div className={CARD} data-testid="item-definition-purpose">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            {t("itemDefinition.purpose.title", { defaultValue: "Purpose and functions" })}
          </h3>
          {!editing ? (
            <button
              onClick={start}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              {t("common.edit", { defaultValue: "Edit" })}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={save}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                {t("common.save", { defaultValue: "Save" })}
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {t("itemDefinition.purpose.hint", {
            defaultValue: "What the item is for and what it does — the former project description.",
          })}
        </p>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            aria-label={t("itemDefinition.purpose.title", { defaultValue: "Purpose and functions" })}
            placeholder={t("itemDefinition.purpose.placeholder", {
              defaultValue: "Describe the item's purpose and its main functions...",
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
        ) : (
          <p className="text-gray-900 whitespace-pre-wrap">{description || "-"}</p>
        )}
      </div>
    </div>
  );
};
