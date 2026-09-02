import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import type { SourceBinding } from "shared";
import { useSourceBindings } from "../hooks/use-source-bindings";
import {
  SOURCE_REF_TYPE_OPTIONS,
  isSourceBindingComplete,
  looksLikeLocalPath,
} from "../utils/source-binding-utils";
import {
  resolveSourceBinding,
  extractRepoHost,
} from "../services/source-binding-service";
import { NetworkConsentDialog } from "./network-consent-dialog";

// ==================== SOURCE BINDINGS SECTION ====================
// Phase 1 fields (repo URL, ref type, ref label) plus Phase 2 resolution
// (implementation plan §5): a "Resolve" action per row that calls
// `git ls-remote` via source-binding-service, gated by a one-per-host-
// per-session consent dialog. Resolution persists immediately on success
// (it's a factual outcome, not a draft edit) — it works from the read-only
// view, independent of the row-editing (isEditing) flow below, which still
// only covers the three static fields. No "detect from local checkout…"
// affordance yet (plan §3.3) — separate concern, not part of this patch.
//
// Reused for both scopes (plan §3.5/§4) via scopeLabel/scopeDescriptionKey:
// project-level ("Project source reference", wired in general-tab.tsx) and,
// later, element-level ("Implementation source reference").

interface SourceBindingsSectionProps {
  bindings: SourceBinding[];
  scopeLabel: string;
  scopeDescriptionKey: string;
  onUpdate: (bindings: SourceBinding[]) => void;
}

interface PendingConsent {
  host: string;
  resolve: (allowed: boolean) => void;
}

export const SourceBindingsSection: React.FC<SourceBindingsSectionProps> = ({
  bindings,
  scopeLabel,
  scopeDescriptionKey,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const {
    isEditing,
    draft,
    startEdit,
    cancelEdit,
    addRow,
    updateRow,
    removeRow,
    setIsEditing,
  } = useSourceBindings(bindings);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveErrors, setResolveErrors] = useState<Record<string, string>>(
    {},
  );
  const [pendingConsent, setPendingConsent] =
    useState<PendingConsent | null>(null);

  const handleEdit = () => startEdit(bindings);
  const handleCancel = () => cancelEdit(bindings);
  const handleSave = () => {
    onUpdate(draft);
    setIsEditing(false);
  };

  const requestConsent = (host: string): Promise<boolean> =>
    new Promise((resolvePromise) => {
      setPendingConsent({ host, resolve: resolvePromise });
    });

  const handleConsentAllow = () => {
    pendingConsent?.resolve(true);
    setPendingConsent(null);
  };

  const handleConsentDeny = () => {
    pendingConsent?.resolve(false);
    setPendingConsent(null);
  };

  const handleResolve = async (row: SourceBinding) => {
    setResolvingId(row.id);
    setResolveErrors((errs) => {
      const next = { ...errs };
      delete next[row.id];
      return next;
    });

    const result = await resolveSourceBinding(row, requestConsent);

    setResolvingId(null);

    if (!result.success || !result.reachable) {
      const message =
        result.error === "consent_denied"
          ? t("sourceBinding.resolveError.consentDenied", {
              defaultValue: "Network access was not allowed.",
            })
          : t("sourceBinding.resolveError.unreachable", {
              defaultValue: `Could not reach ${extractRepoHost(row.repoUrl)}.`,
            });
      setResolveErrors((errs) => ({ ...errs, [row.id]: message }));
      return;
    }

    if (result.sha === null || result.sha === undefined) {
      setResolveErrors((errs) => ({
        ...errs,
        [row.id]: t("sourceBinding.resolveError.refNotFound", {
          defaultValue: `Reached the repository, but "${row.refLabel}" was not found there.`,
        }),
      }));
      return;
    }

    onUpdate(
      bindings.map((b) =>
        b.id === row.id
          ? {
              ...b,
              resolvedCommitSha: result.sha as string,
              resolvedAt: new Date().toISOString(),
            }
          : b,
      ),
    );
  };

  const rows = isEditing ? draft : bindings;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{scopeLabel}</h3>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {t("common.edit")}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {t("common.save")}
            </button>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">{t(scopeDescriptionKey)}</p>

      {rows.length === 0 && !isEditing && (
        <p className="text-sm text-gray-400 py-2">
          {t("sourceBinding.empty", {
            defaultValue: "No source references recorded.",
          })}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-12 gap-3 items-start border border-gray-200 rounded-lg p-3"
          >
            {/* Repo URL */}
            <div className="col-span-5">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t("sourceBinding.repoUrl", {
                  defaultValue: "Repository URL",
                })}
              </label>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={row.repoUrl}
                    onChange={(e) =>
                      updateRow(row.id, { repoUrl: e.target.value })
                    }
                    placeholder="https://github.com/org/repo.git"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {looksLikeLocalPath(row.repoUrl) && (
                    <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      {t("sourceBinding.localPathWarning", {
                        defaultValue:
                          "This looks like a local path — only the remote URL is stored.",
                      })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-900 break-all">
                  {row.repoUrl || "-"}
                </p>
              )}
            </div>

            {/* Ref type */}
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t("sourceBinding.refType.label", {
                  defaultValue: "Ref type",
                })}
              </label>
              {isEditing ? (
                <select
                  value={row.refType}
                  onChange={(e) =>
                    updateRow(row.id, {
                      refType: e.target.value as SourceBinding["refType"],
                    })
                  }
                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {SOURCE_REF_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {t(opt.nameKey, { defaultValue: opt.id })}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-900">
                  {t(
                    SOURCE_REF_TYPE_OPTIONS.find((o) => o.id === row.refType)
                      ?.nameKey ?? row.refType,
                    { defaultValue: row.refType },
                  )}
                </p>
              )}
            </div>

            {/* Ref label */}
            <div className="col-span-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t("sourceBinding.refLabel", { defaultValue: "Ref label" })}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={row.refLabel}
                  onChange={(e) =>
                    updateRow(row.id, { refLabel: e.target.value })
                  }
                  placeholder={t("sourceBinding.refLabelPlaceholder", {
                    defaultValue: "main, v2.3.1…",
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <p className="text-sm text-gray-900">{row.refLabel || "-"}</p>
              )}
            </div>

            {/* Remove row */}
            {isEditing && (
              <div className="col-span-1 flex justify-end pt-5">
                <button
                  onClick={() => removeRow(row.id)}
                  aria-label={t("common.remove", { defaultValue: "Remove" })}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Resolution status + action — read-only view only; editing a
                row's fields and resolving it are separate actions. */}
            {!isEditing && isSourceBindingComplete(row) && (
              <div className="col-span-12 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs">
                  {row.resolvedCommitSha ? (
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("sourceBinding.resolvedAs", {
                        defaultValue: `Resolved to ${row.resolvedCommitSha.slice(0, 7)}`,
                      })}
                      {row.resolvedAt && (
                        <span className="text-gray-400">
                          {" "}
                          ·{" "}
                          {new Date(row.resolvedAt).toLocaleString(
                            undefined,
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      {t("sourceBinding.notResolvedYet", {
                        defaultValue: "Not yet resolved to a commit.",
                      })}
                    </span>
                  )}
                  {resolveErrors[row.id] && (
                    <p className="flex items-center gap-1 text-red-600 mt-1">
                      <AlertTriangle className="w-3 h-3" />
                      {resolveErrors[row.id]}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleResolve(row)}
                  disabled={resolvingId === row.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${resolvingId === row.id ? "animate-spin" : ""}`}
                  />
                  {resolvingId === row.id
                    ? t("sourceBinding.resolving", {
                        defaultValue: "Resolving…",
                      })
                    : row.resolvedCommitSha
                      ? t("sourceBinding.reResolve", {
                          defaultValue: "Re-resolve",
                        })
                      : t("sourceBinding.resolve", { defaultValue: "Resolve" })}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <button
          onClick={addRow}
          className="mt-3 flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("sourceBinding.addReference", { defaultValue: "Add reference" })}
        </button>
      )}

      {pendingConsent && (
        <NetworkConsentDialog
          host={pendingConsent.host}
          onAllow={handleConsentAllow}
          onDeny={handleConsentDeny}
        />
      )}
    </div>
  );
};
