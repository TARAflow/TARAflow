// ==================== THREAT GROUP SECTIONS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md Phase 6, D20): the
// threat tables grouped in one accordion per top-level decomposed
// multiprocess plus "Top level". Every threat appears in exactly one group:
// a multiprocess shows only the threats of its parts and of the flows that
// lie entirely inside it; flows between multiprocesses (or between the top
// level and a multiprocess) are top level. Inside each group the
// trust-boundary tables stay as they are, filtered to the group's threats;
// the original table index is kept, so editing and deleting work
// unchanged. The top level shows one summary row per multiprocess (count
// per STRIDE category, "Details" opens its group) — a view, no threats of
// the multiprocess itself. Threats whose element or flow is no longer in
// the DFD get a group of their own.
// Without groups (classic DFD, no decomposed MP) the tables render as
// before.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { TOP_LEVEL_GROUP, groupsOfDfdItem, type DfdTableGroups } from "shared";
import type { Threat, ThreatTable } from "../../models/threat-types";

const NOT_IN_DFD = "__not_in_dfd__";
const STRIDE = ["S", "T", "R", "I", "D", "E"] as const;

/** Group keys of a threat (element or flow); empty if not in the DFD. */
export function threatGroups(groups: DfdTableGroups, threat: Threat): string[] {
  return groupsOfDfdItem(groups, {
    elementId: threat.linkedElement?.elementId,
    connectionId: threat.dataFlow?.connectionId,
  });
}

/**
 * Label of a flow end shown in a group: in the top level an end that lies
 * in a multiprocess says so ("P-1.1 (in MP-1 Sensor)"); elsewhere the name.
 */
export function endpointLabelFor(
  groups: DfdTableGroups | undefined,
  sectionKey: string,
): ((elementId: string, name: string) => string) | undefined {
  if (!groups || sectionKey !== TOP_LEVEL_GROUP) return undefined;
  const labels = new Map(groups.groups.map((g) => [g.key, g.label]));
  return (elementId, name) => {
    const key = groups.elementGroup[elementId];
    return key && key !== TOP_LEVEL_GROUP ? `${name} (in ${labels.get(key) ?? key})` : name;
  };
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
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
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
      const threats = sectionTables.flatMap(({ table }) => table.threats);
      return { ...section, sectionTables, threats };
    })
    .filter((section) => section.threats.length > 0);

  const domId = (key: string) => `threat-group-${key}`;
  const openGroup = (key: string) => {
    setCollapsed((c) => ({ ...c, [key]: false }));
    requestAnimationFrame(() =>
      document.getElementById(domId(key))?.scrollIntoView?.({ block: "start", behavior: "smooth" }),
    );
  };
  const summaries = sections.filter((s) => s.key !== TOP_LEVEL_GROUP && s.key !== NOT_IN_DFD);

  return (
    <>
      {sections.map((section) => (
        <Accordion
          key={section.key}
          id={domId(section.key)}
          expanded={!collapsed[section.key]}
          onChange={(_, expanded) => setCollapsed((c) => ({ ...c, [section.key]: !expanded }))}
          disableGutters
          data-testid={`threat-group-${section.key}`}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              {section.label}
            </Typography>
            <Chip size="small" label={section.threats.length} sx={{ mr: 1 }} />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {section.key === TOP_LEVEL_GROUP && summaries.length > 0 && (
              <Box sx={{ px: 2, py: 1 }} data-testid="threat-group-summaries">
                {summaries.map((s) => (
                  <Stack
                    key={s.key}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ py: 0.25 }}
                    data-testid={`threat-group-summary-${s.key}`}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 160 }}>
                      {s.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("tabs.threats.groups.summary", {
                        defaultValue: "{{count}} threat(s) of its parts",
                        count: s.threats.length,
                      })}
                      {" — "}
                      {STRIDE.map(
                        (c) => `${c} ${s.threats.filter((x) => x.strideCategory === c).length}`,
                      ).join(" · ")}
                    </Typography>
                    <Link component="button" variant="body2" onClick={() => openGroup(s.key)}>
                      {t("tabs.threats.groups.details", { defaultValue: "Details" })}
                    </Link>
                  </Stack>
                ))}
              </Box>
            )}
            {section.sectionTables.map(({ table, index }) => renderTable(table, index, section.key))}
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
};

export default ThreatGroupSections;
