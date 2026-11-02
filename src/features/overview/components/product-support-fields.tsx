import React from "react";
import { useTranslation } from "react-i18next";
import type { ProductSupport } from "../models/overview-types";

// ==================== PRODUCT SUPPORT FIELDS ====================
// Support data of the product (model coverage plan F-28, CM-7b): model
// designation, where vulnerabilities are reported, end of the support period.
// The CRA (Annex II) and ETSI EN 303 645 (5.2-1, 5.3-13, 5.3-16) ask the
// manufacturer to state them; the report header shows what is set. Part of
// the Overview's project information, edited with it.

const INPUT =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";

/** The value without empty entries; undefined when nothing is left. */
function cleaned(value: ProductSupport): ProductSupport | undefined {
  const entries = Object.entries(value).filter(([, v]) => typeof v === "string" && v.trim() !== "");
  return entries.length > 0 ? (Object.fromEntries(entries) as ProductSupport) : undefined;
}

export const ProductSupportFields: React.FC<{
  value: ProductSupport | undefined;
  editing: boolean;
  onChange: (value: ProductSupport | undefined) => void;
}> = ({ value, editing, onChange }) => {
  const { t } = useTranslation();
  const set = (patch: Partial<ProductSupport>) => onChange(cleaned({ ...value, ...patch }));
  const field = (key: keyof ProductSupport, label: string, placeholder: string, type: "text" | "date" = "text") => (
    <div>
      <label htmlFor={`product-support-${key}`} className={LABEL}>
        {label}
      </label>
      {editing ? (
        <input
          id={`product-support-${key}`}
          type={type}
          value={value?.[key] ?? ""}
          onChange={(e) => set({ [key]: e.target.value })}
          placeholder={placeholder}
          className={INPUT}
        />
      ) : (
        <p className="text-gray-900 py-2" data-testid={`product-support-${key}`}>
          {value?.[key] || "-"}
        </p>
      )}
    </div>
  );

  return (
    <div className="mt-6 pt-4 border-t border-gray-200" data-testid="product-support">
      <h4 className="text-sm font-semibold text-gray-900">{t("projectInfo.productSupport.title", { defaultValue: "Product support" })}</h4>
      <p className="text-xs text-gray-500 mb-3">
        {t("projectInfo.productSupport.hint", {
          defaultValue: "What the manufacturer states for the product (CRA Annex II, ETSI EN 303 645 5.2-1, 5.3-13, 5.3-16). Shown in the report header.",
        })}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {field(
          "modelDesignation",
          t("projectInfo.productSupport.modelDesignation", { defaultValue: "Model designation" }),
          t("projectInfo.productSupport.modelDesignationPlaceholder", { defaultValue: "e.g. PSC-200 rev. B" }),
        )}
        {field(
          "securityContact",
          t("projectInfo.productSupport.securityContact", { defaultValue: "Vulnerability contact" }),
          t("projectInfo.productSupport.securityContactPlaceholder", { defaultValue: "e.g. psirt@example.com" }),
        )}
        {field("supportEnd", t("projectInfo.productSupport.supportEnd", { defaultValue: "Security updates until" }), "", "date")}
      </div>
    </div>
  );
};
