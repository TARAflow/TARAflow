// ==================== RISK GROUP SECTIONS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6b, D20): the risk
// views grouped like the threats — one accordion per top-level decomposed
// multiprocess plus "Top level"; a risk follows its threat's group
// (riskGroupSections). Inside each group the trust-boundary view renders as
// before. The top level shows one summary row per multiprocess (risks of its
// parts per risk level, assessment progress, "Details" opens its group).
// Without groups (classic DFD, no decomposed MP) the view renders as before.

import React from "react";
import { useTranslation } from "react-i18next";
import { Chip, Typography } from "@mui/material";
import {
  GroupAccordions,
  TOP_LEVEL_GROUP,
  type DfdTableGroups,
  type GroupSummaryRow,
  type ThreatReference,
} from "shared";
import type { Risk } from "../models/risk-assessment-types";
import type { RiskConfiguration } from "../models/risk-config-types";
import { RISK_SCALES } from "../models/risk-scale-types";
import { RISK_NOT_IN_DFD, riskGroupSections } from "../utils/risk-groups";
import { ProgressChip } from "./shared/progress-chip";

/** Risks per level of the scale (before mitigation), highest first. */
function riskLevelCounts(risks: Risk[], configuration: RiskConfiguration) {
  const levels = RISK_SCALES[configuration.scale].levels;
  const counts = new Array(levels.length).fill(0);
  for (const r of risks) {
    const v = r.calculatedRiskBeforeMitigation;
    if (v <= 0) continue;
    const rounded = configuration.roundingMethod === "ceil" ? Math.ceil(v) : Math.round(v);
    counts[Math.min(Math.max(rounded - 1, 0), counts.length - 1)]++;
  }
  return levels
    .map((lvl, i) => ({ label: lvl.label, color: lvl.color, count: counts[i] }))
    .filter((l) => l.count > 0)
    .reverse();
}

export interface RiskGroupSectionsProps {
  groups?: DfdTableGroups;
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;
  /** Renders the trust-boundary view for the risks of one group. */
  renderView: (risks: Risk[], groupKey: string) => React.ReactNode;
}

export const RiskGroupSections: React.FC<RiskGroupSectionsProps> = ({
  groups,
  risks,
  threats,
  configuration,
  renderView,
}) => {
  const { t } = useTranslation();
  if (!groups) return <>{renderView(risks, "")}</>;

  const sections = riskGroupSections(groups, risks, threats).map((s) => ({
    ...s,
    label:
      s.key === TOP_LEVEL_GROUP
        ? t("tabs.risks.groups.topLevel", { defaultValue: "Top level" })
        : s.key === RISK_NOT_IN_DFD
          ? t("tabs.risks.groups.notInDfd", { defaultValue: "Not in the DFD" })
          : s.label,
  }));
  const rows: GroupSummaryRow[] = sections
    .filter((s) => s.key !== TOP_LEVEL_GROUP && s.key !== RISK_NOT_IN_DFD)
    .map((s) => ({
      key: s.key,
      label: s.label,
      figures: (
        <>
          <Typography variant="body2" color="text.secondary">
            {t("tabs.risks.groups.summary", {
              defaultValue: "{{count}} risk(s) of its parts",
              count: s.risks.length,
            })}
          </Typography>
          {riskLevelCounts(s.risks, configuration).map((lvl) => (
            <Chip
              key={lvl.label}
              label={`${lvl.label} ×${lvl.count}`}
              size="small"
              sx={{
                height: 18,
                fontSize: "0.65rem",
                bgcolor: `${lvl.color}20`,
                color: lvl.color,
                border: `1px solid ${lvl.color}`,
              }}
            />
          ))}
          <ProgressChip risks={s.risks} />
        </>
      ),
    }));

  return (
    <GroupAccordions
      testIdPrefix="risk-group"
      sections={sections.map((s) => ({
        key: s.key,
        label: s.label,
        count: s.risks.length,
        render: () => renderView(s.risks, s.key),
      }))}
      summaries={{
        inGroup: TOP_LEVEL_GROUP,
        rows,
        openLabel: t("tabs.risks.groups.details", { defaultValue: "Details" }),
      }}
    />
  );
};

export default RiskGroupSections;
