import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";
import type { ItemFinding } from "../services/item-definition-findings";

// ==================== ITEM FINDINGS PANEL ====================
// What the Definition sub-tab still lacks (A-4), on top of the view.

const SECTION_DEFAULT: Record<string, string> = {
  functions: "Purpose and functions",
  boundary: "Item boundary",
  architecture: "Preliminary architecture",
  environment: "Operational environment",
  constraints: "Constraints and legal requirements",
};

export const ItemFindingsPanel: React.FC<{ findings: readonly ItemFinding[] }> = ({ findings }) => {
  const { t } = useTranslation();
  if (findings.length === 0) return null;
  const sectionName = (id?: string) =>
    !id
      ? ""
      : id === "functions"
        ? t("itemDefinition.purpose.title", { defaultValue: SECTION_DEFAULT.functions })
        : t(`itemDefinition.sections.${id}.title`, { defaultValue: SECTION_DEFAULT[id] ?? id });

  const text = (f: ItemFinding) => {
    switch (f.code) {
      case "ITEM_PURPOSE_MISSING":
        return t("itemDefinition.findings.purposeMissing", {
          defaultValue: "Purpose and functions are not described.",
        });
      case "ITEM_SECTION_MISSING":
        return t("itemDefinition.findings.sectionMissing", {
          defaultValue: "{{section}} is not described.",
          section: sectionName(f.section),
        });
      case "ITEM_ASSUMPTION_INVALID_IN_USE":
        return t("itemDefinition.findings.assumptionInvalidInUse", {
          defaultValue: "{{assumption}} is invalid but still relied on by {{boundaries}} — review them.",
          assumption: f.assumption,
          boundaries: (f.boundaries ?? []).join(", "),
        });
      case "ITEM_ASSUMPTION_REVIEW_DUE":
        return t("itemDefinition.findings.assumptionReviewDue", {
          defaultValue: "{{assumption}} is still open after its review date.",
          assumption: f.assumption,
        });
      case "ITEM_LINK_REMOVED":
        return t("itemDefinition.findings.linkRemoved", {
          defaultValue: "{{section}}: {{count}} link(s) to removed model items.",
          section: sectionName(f.section),
          count: f.count,
        });
    }
  };

  return (
    <ul className="mb-4 space-y-1" data-testid="item-definition-findings">
      {findings.map((f, i) => (
        <li
          key={i}
          className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
            f.severity === "warning" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"
          }`}
          data-code={f.code}
        >
          {f.severity === "warning" ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <span>
            {text(f)}
            {f.requirement && <span className="ml-1 text-xs opacity-70">({f.requirement})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
};
