import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Chip } from "@mui/material";
import { newAssumption, type Assumption, type AssumptionStatus } from "shared";
import { CARD, EditButtons, sourceText } from "./item-section-card";

// ==================== ITEM ASSUMPTIONS CARD ====================
// Assumptions on the operational environment (ISO/SAE 21434 RQ-09-02 NOTE 8;
// conformance plan Phase 1 stage A, A-3, decision 12): ASM-nn with text,
// source, owner, review date and status. Trust boundaries link them; an
// assumption marked invalid flags every boundary that relies on it (shown
// here as "used by", and in the boundary's form). Claims (Phase 4) will
// reference them too.

interface ItemAssumptionsCardProps {
  assumptions: readonly Assumption[];
  /** Highest ASM number issued so far — a number deleted in this edit is not issued again. */
  issued?: number;
  /** assumption id → labels of the boundaries that link it */
  usage: Readonly<Record<string, readonly string[]>>;
  onSave: (assumptions: Assumption[]) => void;
}

const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const STATUSES: AssumptionStatus[] = ["open", "confirmed", "invalid"];
const STATUS_COLOR: Record<AssumptionStatus, "default" | "success" | "error"> = {
  open: "default",
  confirmed: "success",
  invalid: "error",
};

export const ItemAssumptionsCard: React.FC<ItemAssumptionsCardProps> = ({ assumptions, issued = 0, usage, onSave }) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Assumption[]>([]);
  const statusLabel = (s: AssumptionStatus) => t(`itemDefinition.assumptions.status.${s}`, { defaultValue: s });

  const start = () => {
    setDraft(assumptions.map((a) => ({ ...a, source: a.source ? { ...a.source } : undefined })));
    setEditing(true);
  };
  const save = () => {
    onSave(
      draft
        .filter((a) => a.text.trim())
        .map((a) => {
          const out: Assumption = { id: a.id, displayId: a.displayId, text: a.text.trim(), status: a.status };
          if (a.source?.document?.trim()) {
            out.source = {
              document: a.source.document.trim(),
              ...(a.source.section?.trim() ? { section: a.source.section.trim() } : {}),
            };
          }
          if (a.owner?.trim()) out.owner = a.owner.trim();
          if (a.reviewBy) out.reviewBy = a.reviewBy;
          return out;
        }),
    );
    setEditing(false);
  };
  const patch = (id: string, change: Partial<Assumption>) =>
    setDraft((d) => d.map((a) => (a.id === id ? { ...a, ...change } : a)));

  return (
    <div className={CARD} data-testid="item-definition-assumptions">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("itemDefinition.assumptions.title", { defaultValue: "Assumptions" })}
        </h3>
        <EditButtons editing={editing} onEdit={start} onCancel={() => setEditing(false)} onSave={save} />
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {t("itemDefinition.assumptions.hint", {
          defaultValue:
            "What the analysis assumes about the environment (9.3, RQ-09-02 NOTE 8). Trust boundaries link them; an invalid assumption flags every boundary that relies on it.",
        })}
      </p>

      {!editing && assumptions.length === 0 && <p className="text-gray-500">-</p>}
      {!editing && assumptions.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {assumptions.map((a) => {
              const users = usage[a.id] ?? [];
              return (
                <tr key={a.id} className="border-t border-gray-100 align-top" data-testid={`assumption-${a.displayId}`}>
                  <td className="py-2 pr-3 font-medium text-gray-900 whitespace-nowrap">{a.displayId}</td>
                  <td className="py-2 pr-3 text-gray-800">
                    {a.text}
                    {sourceText(a.source) && (
                      <span className="block text-xs text-gray-500">
                        {t("itemDefinition.source.label", { defaultValue: "Source" })}: {sourceText(a.source)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Chip size="small" color={STATUS_COLOR[a.status]} label={statusLabel(a.status)} />
                  </td>
                  <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                    {[a.owner, a.reviewBy].filter(Boolean).join(" · ")}
                  </td>
                  <td
                    className={`py-2 text-xs ${a.status === "invalid" && users.length > 0 ? "text-red-700 font-medium" : "text-gray-600"}`}
                    data-testid={`assumption-usage-${a.displayId}`}
                  >
                    {users.length > 0
                      ? t("itemDefinition.assumptions.usedBy", {
                          defaultValue: "used by {{list}}",
                          list: users.join(", "),
                        })
                      : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <div className="space-y-3">
          {draft.map((a) => (
            <div key={a.id} className="border border-gray-200 rounded-lg p-3 space-y-2" data-testid={`assumption-edit-${a.displayId}`}>
              <div className="flex gap-2 items-start">
                <span className="pt-2 font-medium text-gray-900 whitespace-nowrap">{a.displayId}</span>
                <textarea
                  value={a.text}
                  rows={2}
                  onChange={(e) => patch(a.id, { text: e.target.value })}
                  aria-label={t("itemDefinition.assumptions.text", { defaultValue: "Assumption" })}
                  className={`${INPUT} resize-y`}
                />
                <button
                  onClick={() => setDraft((d) => d.filter((x) => x.id !== a.id))}
                  aria-label={t("itemDefinition.assumptions.remove", { defaultValue: "Remove assumption" })}
                  className="px-2 pt-2 text-gray-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <select
                  value={a.status}
                  onChange={(e) => patch(a.id, { status: e.target.value as AssumptionStatus })}
                  aria-label={t("itemDefinition.assumptions.statusLabel", { defaultValue: "Status" })}
                  className={INPUT}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <input
                  value={a.owner ?? ""}
                  onChange={(e) => patch(a.id, { owner: e.target.value })}
                  placeholder={t("itemDefinition.assumptions.owner", { defaultValue: "Owner" })}
                  aria-label={t("itemDefinition.assumptions.owner", { defaultValue: "Owner" })}
                  className={INPUT}
                />
                <input
                  type="date"
                  value={a.reviewBy ?? ""}
                  onChange={(e) => patch(a.id, { reviewBy: e.target.value || undefined })}
                  aria-label={t("itemDefinition.assumptions.reviewBy", { defaultValue: "Review by" })}
                  className={INPUT}
                />
                <input
                  value={a.source?.document ?? ""}
                  onChange={(e) =>
                    patch(a.id, { source: { ...(a.source ?? {}), document: e.target.value } })
                  }
                  placeholder={t("itemDefinition.source.document", { defaultValue: "Source document (e.g. arc42)" })}
                  aria-label={t("itemDefinition.source.document", { defaultValue: "Source document (e.g. arc42)" })}
                  className={INPUT}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => setDraft((d) => [...d, newAssumption(d, "", issued)])}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            data-testid="assumption-add"
          >
            <Plus className="w-4 h-4" />
            {t("itemDefinition.assumptions.add", { defaultValue: "Add assumption" })}
          </button>
        </div>
      )}
    </div>
  );
};
