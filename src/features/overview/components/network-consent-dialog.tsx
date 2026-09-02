import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

// ==================== NETWORK CONSENT DIALOG ====================
// Shown once per host per Electron session, before the first
// `git ls-remote` call to that host (implementation plan §5). No existing
// shared Modal/Dialog component was visible in the uploaded files, so this
// is a minimal Tailwind overlay matching the app's existing card style
// (rounded-lg, border, white background) — swap for a shared Dialog
// component if the app already has one elsewhere.

interface NetworkConsentDialogProps {
  /** Host about to be contacted, e.g. "github.com". */
  host: string;
  onAllow: () => void;
  onDeny: () => void;
}

export const NetworkConsentDialog: React.FC<NetworkConsentDialogProps> = ({
  host,
  onAllow,
  onDeny,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-consent-title"
    >
      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-sm w-full mx-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-blue-600" />
          <h3
            id="network-consent-title"
            className="text-lg font-semibold text-gray-900"
          >
            {t("sourceBinding.consent.title", {
              defaultValue: "Allow network access?",
            })}
          </h3>
        </div>

        <p className="text-sm text-gray-600 mb-1">
          {t("sourceBinding.consent.body", {
            defaultValue:
              "TARAflow wants to contact the following host to resolve a source reference:",
          })}
        </p>
        <p className="text-sm font-mono text-gray-900 bg-gray-50 border border-gray-200 rounded px-2 py-1 mb-4 break-all">
          {host}
        </p>
        <p className="text-xs text-gray-500 mb-4">
          {t("sourceBinding.consent.scope", {
            defaultValue:
              "This asks once per host for this session — other bindings on the same host won't ask again until TARAflow restarts.",
          })}
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onDeny}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onAllow}
            autoFocus
            className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {t("sourceBinding.consent.allow", { defaultValue: "Allow" })}
          </button>
        </div>
      </div>
    </div>
  );
};
