import React from "react";
import { useTranslation } from "react-i18next";
import type { MethodologySummary } from "../models/overview-types";
import { CARD } from "./item-section-card";

// ==================== METHODOLOGY VIEW ====================
// The method the project applies, read-only (ISO/SAE 21434 conformance plan
// Phase 1 "Overview rework", A-4): derived from the configuration by the app
// layer (methodology record, 0b), labelled with the report's methodology
// texts. Scales, matrix and acceptance criteria are edited in the Risk tab's
// configuration dialog (decision 2026-10-16).

interface MethodologyViewProps {
  summary: MethodologySummary;
  onOpenRiskTab?: () => void;
}

const M = "tabs.doc.methodology";

export const MethodologyView: React.FC<MethodologyViewProps> = ({ summary, onOpenRiskTab }) => {
  const { t } = useTranslation();
  const rows: [string, React.ReactNode][] = [
    [t("tabs.doc.methodology.overview", { defaultValue: "Method" }), t(summary.presetNameKey, { defaultValue: summary.presetNameKey })],
    [
      t(`${M}.impactScale`, { defaultValue: "Impact scale" }),
      <>
        {t(`${M}.scale.${summary.impactScale}`, { defaultValue: summary.impactScale })}
        {!summary.impactScaleConforms && summary.requiredImpactScale && (
          <span className="ml-2 text-amber-700" data-testid="methodology-scale-warning">
            {t(`${M}.scaleNotConforming`, {
              defaultValue: "The preset requires the {{scale}} scale.",
              scale: t(`${M}.scale.${summary.requiredImpactScale}`, { defaultValue: summary.requiredImpactScale }),
            })}
          </span>
        )}
      </>,
    ],
    [t(`${M}.impactCategories`, { defaultValue: "Impact categories" }), summary.impactCriteriaIds.join(", ") || "-"],
    [
      t(`${M}.impactAggregation`, { defaultValue: "Impact aggregation" }),
      t(`${M}.aggregation.${summary.impactAggregation}`, { defaultValue: summary.impactAggregation }),
    ],
    [
      t(`${M}.likelihood`, { defaultValue: "Likelihood" }),
      t(`${M}.likelihoodMethod.${summary.likelihoodMethod}`, { defaultValue: summary.likelihoodMethod }),
    ],
    [
      t(`${M}.feasibilityMethod`, { defaultValue: "Attack feasibility" }),
      `${t(`${M}.feasibility.${summary.feasibilityMethod}`, { defaultValue: summary.feasibilityMethod })} · ${t(
        `${M}.likelihoodModel.${summary.likelihoodModel}`,
        { defaultValue: summary.likelihoodModel },
      )}`,
    ],
    ...(summary.riskMatrix
      ? ([[t(`${M}.riskMatrix`, { defaultValue: "Risk value" }), "1–5"]] as [string, React.ReactNode][])
      : []),
    [t(`${M}.treatment`, { defaultValue: "Risk treatment" }), summary.treatmentOptions.join(" · ")],
    [
      t(`${M}.properties`, { defaultValue: "Cybersecurity properties" }),
      summary.securityProperties.map((p) => t(`${M}.goalName.${p}`, { defaultValue: p })).join(", "),
    ],
    ...(summary.calcStamps
      ? ([
          [t(`${M}.stampRisk`, { defaultValue: "Calculation (risk)" }), summary.calcStamps.risk],
          [t(`${M}.stampPath`, { defaultValue: "Calculation (attack path)" }), summary.calcStamps.path],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className={CARD} data-testid="methodology-view">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("overviewViews.methodologyTitle", { defaultValue: "Methodology (read-only)" })}
        </h3>
        {onOpenRiskTab && (
          <button
            onClick={onOpenRiskTab}
            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            data-testid="methodology-open-risk"
          >
            {t("overviewViews.openRiskConfiguration", { defaultValue: "Change in the Risk tab" })}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        {t("overviewViews.methodologyHint", {
          defaultValue:
            "Derived from the project's configuration — the same record the report's methodology chapter uses. Scales, matrix and acceptance criteria are set in the Risk tab's configuration.",
        })}
      </p>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value], i) => (
          <React.Fragment key={i}>
            <dt className="text-gray-600">{label}</dt>
            <dd className="text-gray-900">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
};
