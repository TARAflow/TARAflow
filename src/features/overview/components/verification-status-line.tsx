import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { VerificationStatusView } from "../models/overview-types";

// ==================== VERIFICATION STATUS LINE ====================
// The TARA verification status in the Overview (ISO/SAE 21434 RQ-09-07, plan
// Phase 4, decision 25) — recorded in the Audit tab, shown here; same words
// as in the document.

export function verificationStatusText(
  v: VerificationStatusView,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const date = v.latest?.date ?? "";
  const reviewer = v.latest?.reviewer ?? "";
  switch (v.kind) {
    case "verified":
      return t("verificationStatus.verified", { defaultValue: "Verified on {{date}} by {{reviewer}} — state unchanged.", date, reviewer });
    case "changed":
      return t("verificationStatus.changed", {
        defaultValue: "Changed since the verification on {{date}} — verify again in the Audit tab.",
        date,
      });
    case "reconfirm":
      return t("verificationStatus.reconfirm", {
        defaultValue: "The verification on {{date}} was recorded with an earlier TARAflow version — confirm it again in the Audit tab.",
        date,
      });
    case "outdated":
      return t("verificationStatus.outdated", {
        defaultValue: "The verification on {{date}} is older than {{days}} days — verify again in the Audit tab.",
        date,
        days: v.maxAgeDays,
      });
    case "failed":
      return t("verificationStatus.failed", { defaultValue: "The verification on {{date}} did not pass.", date });
    case "none":
      return t("verificationStatus.none", { defaultValue: "Not verified yet — record the verification in the Audit tab." });
  }
}

export const VerificationStatusLine: React.FC<{ status: VerificationStatusView; onOpenAudit?: () => void }> = ({
  status,
  onOpenAudit,
}) => {
  const { t } = useTranslation();
  const ok = status.kind === "verified";
  const failed = status.kind === "failed";
  const tone = ok
    ? "bg-green-50 text-green-900 border-green-200"
    : failed
      ? "bg-red-50 text-red-900 border-red-200"
      : "bg-amber-50 text-amber-900 border-amber-200";
  const Icon = ok ? CheckCircle2 : failed ? XCircle : AlertTriangle;
  return (
    <div className={`flex items-center gap-2 border rounded-lg px-4 py-2 mb-6 text-sm ${tone}`} data-testid="verification-status" data-kind={status.kind}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        <strong>{t("verificationStatus.label", { defaultValue: "TARA verification" })}: </strong>
        {verificationStatusText(status, t)}
      </span>
      {!ok && onOpenAudit && (
        <button onClick={onOpenAudit} className="px-2 py-1 text-xs rounded hover:bg-white/60" data-testid="verification-open-audit">
          {t("verificationStatus.openAudit", { defaultValue: "Audit tab" })}
        </button>
      )}
    </div>
  );
};
