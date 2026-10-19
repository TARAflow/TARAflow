// ==================== THREAT GROUP SECTIONS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6, D20): the
// threat tables grouped in one accordion per top-level decomposed
// multiprocess plus "Top level". Inside each group the trust-boundary
// tables stay as they are, filtered to the group's threats; the original
// table index is kept, so editing and deleting work unchanged. A flow
// threat between two groups appears in both. Threats whose element or flow
// is no longer in the DFD get a group of their own.
// Without groups (classic DFD, no decomposed MP) the tables render as
// before.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Typography,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { TOP_LEVEL_GROUP, groupsOfDfdItem, type DfdTableGroups } from "shared";
import type { Threat, ThreatTable } from "../../models/threat-types";

const NOT_IN_DFD = "__not_in_dfd__";

/** Group keys of a threat (element or flow); empty if not in the DFD. */
export function threatGroups(groups: DfdTableGroups, threat: Threat): string[] {
  return groupsOfDfdItem(groups, {
    elementId: threat.linkedElement?.elementId,
    connectionId: threat.dataFlow?.connectionId,
  });
}

export interface ThreatGroupSectionsProps {
  groups?: DfdTableGroups;
  tables: ThreatTable[];
  /** Renders one table; index = position in `tables`. */
  renderTable: (table: ThreatTable, index: number, groupKey: string) => React.ReactNode;
}

export const ThreatGroupSections: React.FC<ThreatGroupSectionsProps> = ({
  groups,
  tables,
  renderTable,
}) => {
  const { t } = useTranslation();
  if (!groups) return <>{tables.map((table, index) => renderTable(table, index, ""))}</>;

  const sections = [
    ...groups.groups.map((g) => ({
      key: g.key,
      label:
        g.key === TOP_LEVEL_GROUP
          ? t("tabs.threats.groups.topLevel", { defaultValue: "Top level" })
          : g.label,
    })),
    {
      key: NOT_IN_DFD,
      label: t("tabs.threats.groups.notInDfd", { defaultValue: "Not in the DFD" }),
    },
  ]
    .map((section) => {
      const inGroup = (threat: Threat) => {
        const keys = threatGroups(groups, threat);
        return section.key === NOT_IN_DFD ? keys.length === 0 : keys.includes(section.key);
      };
      const sectionTables = tables
        .map((table, index) => ({ table: { ...table, threats: table.threats.filter(inGroup) }, index }))
        .filter(({ table }) => table.threats.length > 0);
      const count = sectionTables.reduce((sum, { table }) => sum + table.threats.length, 0);
      return { ...section, sectionTables, count };
    })
    .filter((section) => section.count > 0);

  return (
    <>
      {sections.map((section) => (
        <Accordion
          key={section.key}
          defaultExpanded
          disableGutters
          data-testid={`threat-group-${section.key}`}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {section.label}
            </Typography>
            <Chip size="small" label={section.count} sx={{ mr: 1 }} />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {section.sectionTables.map(({ table, index }) => renderTable(table, index, section.key))}
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
};

export default ThreatGroupSections;
