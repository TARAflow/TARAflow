import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Autocomplete, Chip, TextField } from "@mui/material";
import { LIFECYCLE_PHASES, type ItemFunction, type LifecyclePhase } from "shared";
import type { ItemModelItem } from "../models/overview-types";
import { CARD, EditButtons } from "./item-section-card";

// ==================== ITEM FUNCTIONS CARD ====================
// The item's functions over its lifecycle (RQ-09-01 b, NOTE 2; conformance
// plan Phase 1 stage A, A-2, decision 24): name, short description, the
// lifecycle phases it is active in (production, operation, maintenance,
// decommissioning) and, optionally, the function asset it corresponds to.

interface ItemFunctionsCardProps {
  functions: readonly ItemFunction[];
  /** Assets of the groups function / process — the candidates for the link. */
  functionAssets: readonly ItemModelItem[];
  onSave: (functions: ItemFunction[]) => void;
}

const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

let seq = 0;
const newId = () => `fn-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const ItemFunctionsCard: React.FC<ItemFunctionsCardProps> = ({ functions, functionAssets, onSave }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ItemFunction[]>([]);
  const assetById = new Map(functionAssets.map((a) => [a.id, a]));
  const phaseLabel = (p: LifecyclePhase) => t(`itemDefinition.lifecycle.${p}`, { defaultValue: p });

  const start = () => {
    setDraft(functions.map((f) => ({ ...f, lifecyclePhases: [...f.lifecyclePhases] })));
    setEditing(true);
  };
  const save = () => {
    onSave(
      draft
        .filter((f) => f.name.trim())
        .map((f) => ({
          id: f.id,
          name: f.name.trim(),
          ...(f.description?.trim() ? { description: f.description.trim() } : {}),
          lifecyclePhases: LIFECYCLE_PHASES.filter((p) => f.lifecyclePhases.includes(p)),
          ...(f.functionAssetId ? { functionAssetId: f.functionAssetId } : {}),
        })),
    );
    setEditing(false);
  };
  const patch = (id: string, change: Partial<ItemFunction>) =>
    setDraft((d) => d.map((f) => (f.id === id ? { ...f, ...change } : f)));

  return (
    <div className={CARD} data-testid="item-definition-functions">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("itemDefinition.functions.title", { defaultValue: "Functions over the lifecycle" })}
        </h3>
        <EditButtons editing={editing} onEdit={start} onCancel={() => setEditing(false)} onSave={save} />
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {t("itemDefinition.functions.hint", {
          defaultValue: "The item's functions and the lifecycle phases they are active in (ISO/SAE 21434 9.3 b).",
        })}
      </p>

      {!editing && functions.length === 0 && <p className="text-gray-500">-</p>}
      {!editing && functions.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {functions.map((f) => (
              <tr key={f.id} className="border-t border-gray-100 align-top">
                <td className="py-2 pr-3 font-medium text-gray-900">{f.name}</td>
                <td className="py-2 pr-3 text-gray-700">{f.description || ""}</td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {f.lifecyclePhases.map((p) => (
                      <Chip key={p} size="small" label={phaseLabel(p)} />
                    ))}
                  </div>
                </td>
                <td className="py-2 text-gray-700">
                  {f.functionAssetId
                    ? assetById.get(f.functionAssetId)?.label ??
                      t("itemDefinition.modelRefs.missing", {
                        defaultValue: "removed ({{id}})",
                        id: f.functionAssetId,
                      })
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="space-y-4">
          {draft.map((f, i) => (
            <div key={f.id} className="border border-gray-200 rounded-lg p-3 space-y-2" data-testid={`item-function-${i}`}>
              <div className="flex gap-2">
                <input
                  value={f.name}
                  onChange={(e) => patch(f.id, { name: e.target.value })}
                  placeholder={t("itemDefinition.functions.name", { defaultValue: "Function" })}
                  aria-label={t("itemDefinition.functions.name", { defaultValue: "Function" })}
                  className={INPUT}
                />
                <button
                  onClick={() => setDraft((d) => d.filter((x) => x.id !== f.id))}
                  aria-label={t("itemDefinition.functions.remove", { defaultValue: "Remove function" })}
                  className="px-2 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                value={f.description ?? ""}
                onChange={(e) => patch(f.id, { description: e.target.value })}
                placeholder={t("itemDefinition.functions.description", { defaultValue: "Short description" })}
                aria-label={t("itemDefinition.functions.description", { defaultValue: "Short description" })}
                className={INPUT}
              />
              <div className="flex flex-wrap gap-3 text-sm">
                {LIFECYCLE_PHASES.map((p) => (
                  <label key={p} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={f.lifecyclePhases.includes(p)}
                      onChange={(e) =>
                        patch(f.id, {
                          lifecyclePhases: e.target.checked
                            ? [...f.lifecyclePhases, p]
                            : f.lifecyclePhases.filter((x) => x !== p),
                        })
                      }
                    />
                    {phaseLabel(p)}
                  </label>
                ))}
              </div>
              <Autocomplete
                size="small"
                options={[...functionAssets]}
                getOptionLabel={(o) => o.label}
                value={f.functionAssetId ? assetById.get(f.functionAssetId) ?? null : null}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, v) => patch(f.id, { functionAssetId: v?.id })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("itemDefinition.functions.asset", { defaultValue: "Function asset (optional)" })}
                  />
                )}
              />
            </div>
          ))}
          <button
            onClick={() =>
              setDraft((d) => [...d, { id: newId(), name: "", lifecyclePhases: ["operation"] }])
            }
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            data-testid="item-function-add"
          >
            <Plus className="w-4 h-4" />
            {t("itemDefinition.functions.add", { defaultValue: "Add function" })}
          </button>
        </div>
      )}
    </div>
  );
};
