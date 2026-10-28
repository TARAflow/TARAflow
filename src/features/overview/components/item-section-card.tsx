import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X } from "lucide-react";
import { Autocomplete, Chip, TextField } from "@mui/material";
import type { ItemSection, SourceRef } from "shared";
import type { ItemModelItem } from "../models/overview-types";

// ==================== ITEM SECTION CARD ====================
// One section of the Item Definition (conformance plan Phase 1 stage A, A-2):
// the analyst's text, where it comes from (document, section, version — the
// architecture document stays the master, decision "source, not copy") and
// the model items it refers to (DFD elements / flows / pages, assets), so the
// definition points at the model instead of redrawing it.

interface ItemSectionCardProps {
  title: string;
  hint: string;
  testId: string;
  /** The section's text (for "Purpose and functions": the description). */
  text: string;
  section: ItemSection | undefined;
  modelItems: readonly ItemModelItem[];
  onSave: (text: string, section: ItemSection) => void;
}

export const CARD = "bg-white rounded-lg border border-gray-200 p-6 mb-6";
const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const KIND_ORDER: ItemModelItem["kind"][] = ["element", "flow", "page", "asset"];

/** "arc42 · §3 Context · v2.1" */
export function sourceText(source: SourceRef | undefined): string {
  if (!source?.document?.trim()) return "";
  return [source.document, source.section, source.version ? `v${source.version}` : undefined]
    .filter((s) => s && s.trim())
    .join(" · ");
}

export const EditButtons: React.FC<{
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}> = ({ editing, onEdit, onCancel, onSave }) => {
  const { t } = useTranslation();
  return !editing ? (
    <button
      onClick={onEdit}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
    >
      <Edit3 className="w-4 h-4" />
      {t("common.edit", { defaultValue: "Edit" })}
    </button>
  ) : (
    <div className="flex gap-2">
      <button
        onClick={onCancel}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
        {t("common.cancel", { defaultValue: "Cancel" })}
      </button>
      <button
        onClick={onSave}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        <Save className="w-4 h-4" />
        {t("common.save", { defaultValue: "Save" })}
      </button>
    </div>
  );
};

export const ItemSectionCard: React.FC<ItemSectionCardProps> = ({
  title,
  hint,
  testId,
  text,
  section,
  modelItems,
  onSave,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [draftSource, setDraftSource] = useState<SourceRef>({ document: "" });
  const [draftRefs, setDraftRefs] = useState<string[]>([]);

  const byId = new Map(modelItems.map((m) => [m.id, m]));
  const kindLabel = (kind: ItemModelItem["kind"]) =>
    t(`itemDefinition.kinds.${kind}`, { defaultValue: kind });
  const options = [...modelItems].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  const start = () => {
    setDraftText(text);
    setDraftSource(section?.source ?? { document: "" });
    setDraftRefs(section?.modelRefs ?? []);
    setEditing(true);
  };
  const save = () => {
    const source = draftSource.document.trim()
      ? Object.fromEntries(
          Object.entries(draftSource).filter(([, v]) => typeof v !== "string" || v.trim()),
        ) as unknown as SourceRef
      : undefined;
    // The caller puts the text where it belongs (section or description).
    const next: ItemSection = {};
    if (source) next.source = source;
    if (draftRefs.length > 0) next.modelRefs = draftRefs;
    onSave(draftText, next);
    setEditing(false);
  };

  const refs = section?.modelRefs ?? [];
  const src = sourceText(section?.source);

  return (
    <div className={CARD} data-testid={testId}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <EditButtons editing={editing} onEdit={start} onCancel={() => setEditing(false)} onSave={save} />
      </div>
      <p className="text-xs text-gray-500 mb-3">{hint}</p>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={5}
            aria-label={title}
            className={`${INPUT} resize-y`}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              value={draftSource.document}
              onChange={(e) => setDraftSource((s) => ({ ...s, document: e.target.value }))}
              placeholder={t("itemDefinition.source.document", { defaultValue: "Source document (e.g. arc42)" })}
              aria-label={t("itemDefinition.source.document", { defaultValue: "Source document (e.g. arc42)" })}
              className={INPUT}
            />
            <input
              value={draftSource.section ?? ""}
              onChange={(e) => setDraftSource((s) => ({ ...s, section: e.target.value }))}
              placeholder={t("itemDefinition.source.section", { defaultValue: "Section (e.g. §3 Context)" })}
              aria-label={t("itemDefinition.source.section", { defaultValue: "Section (e.g. §3 Context)" })}
              className={INPUT}
            />
            <input
              value={draftSource.version ?? ""}
              onChange={(e) => setDraftSource((s) => ({ ...s, version: e.target.value }))}
              placeholder={t("itemDefinition.source.version", { defaultValue: "Version" })}
              aria-label={t("itemDefinition.source.version", { defaultValue: "Version" })}
              className={INPUT}
            />
          </div>
          <Autocomplete
            multiple
            size="small"
            options={options}
            groupBy={(o) => kindLabel(o.kind)}
            getOptionLabel={(o) => (o.detail ? `${o.label} (${o.detail})` : o.label)}
            value={draftRefs.map((id) => byId.get(id) ?? { id, kind: "element" as const, label: id })}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, v) => setDraftRefs(v.map((o) => o.id))}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("itemDefinition.modelRefs.label", { defaultValue: "Refers to (DFD, assets)" })}
                inputProps={{ ...params.inputProps, "data-testid": `${testId}-refs` }}
              />
            )}
          />
        </div>
      ) : (
        <>
          <p className="text-gray-900 whitespace-pre-wrap">{text || "-"}</p>
          {(src || refs.length > 0) && (
            <div className="mt-3 space-y-2 text-sm">
              {src && (
                <p className="text-gray-600" data-testid={`${testId}-source`}>
                  {t("itemDefinition.source.label", { defaultValue: "Source" })}: {src}
                </p>
              )}
              {refs.length > 0 && (
                <div className="flex flex-wrap gap-1" data-testid={`${testId}-refs-view`}>
                  {refs.map((id) => {
                    const m = byId.get(id);
                    return (
                      <Chip
                        key={id}
                        size="small"
                        label={
                          m
                            ? m.label
                            : t("itemDefinition.modelRefs.missing", { defaultValue: "removed ({{id}})", id })
                        }
                        variant={m ? "outlined" : "filled"}
                        color={m ? "default" : "warning"}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
