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
import { Typography } from "@mui/material";
import {
  GroupAccordions,
  TOP_LEVEL_GROUP,
  dfdItemRefOfThreat,
  groupsOfDfdItem,
  type DfdTableGroups,
  type GroupSummaryRow,
} from "shared";
import type { Threat, ThreatTable } from "../../models/threat-types";
import { ImportedThreatCard, type ImportedThreatSection } from "./imported-threats-section";

const NOT_IN_DFD = "__not_in_dfd__";
const STRIDE = ["S", "T", "R", "I", "D", "E"] as const;

/** Group keys of a threat (element or flow); empty if not in the DFD. */
export function threatGroups(groups: DfdTableGroups, threat: Threat): string[] {
  return groupsOfDfdItem(groups, dfdItemRefOfThreat(threat));
}

/**
 * Label of a flow end shown in a group: an end that lies in another
 * multiprocess says so ("P-3.1 (in MP-3 Controller)") — in the top level,
 * and in a multiprocess for a flow from or to another one; else the name.
 */
export function endpointLabelFor(
  groups: DfdTableGroups | undefined,
  sectionKey: string,
): ((elementId: string, name: string) => string) | undefined {
  if (!groups || !sectionKey) return undefined;
  const labels = new Map(groups.groups.map((g) => [g.key, g.label]));
  return (elementId, name) => {
    const key = groups.elementGroup[elementId];
    return key && key !== TOP_LEVEL_GROUP && key !== sectionKey
      ? `${name} (in ${labels.get(key) ?? key})`
      : name;
  };
}

export interface ThreatGroupSectionsProps {
  groups?: DfdTableGroups;
  tables: ThreatTable[];
  /** Renders one table; index = position in `tables`. */
  renderTable: (table: ThreatTable, index: number, groupKey: string) => React.ReactNode;
  /**
   * Threats of imported components, one card per instance in the group of
   * the instance's multiprocess — the same place the Risks tab lists their
   * risks (manual test 2026-11-15). Read-only — the card's info icon says so.
   */
  importedSections?: readonly ImportedThreatSection[];
}

export const ThreatGroupSections: React.FC<ThreatGroupSectionsProps> = ({
  groups,
  tables,
  renderTable,
  importedSections = [],
}) => {
  const { t } = useTranslation();
  const importedInfo = t("components.threats.groupInfo", {
    ns: "components",
    defaultValue:
      "Threats from an imported component — read-only: text, STRIDE and relevance are the component's decisions (on boundary flows the machine may override the relevance). Rate their risks in the Risk tab.",
  });
  const shownImported = importedSections.filter((x) => x.count > 0);
  const cards = (list: readonly ImportedThreatSection[]) =>
    list.map((x) => <ImportedThreatCard key={x.key} section={x} info={importedInfo} />);
  if (!groups) {
    return (
      <>
        {tables.map((table, index) => renderTable(table, index, ""))}
        {cards(shownImported)}
      </>
    );
  }
  // An instance's card goes to the group of its multiprocess (top level when
  // the multiprocess is not decomposed or not in the DFD).
  const groupOfImported = (x: ImportedThreatSection) =>
    (x.multiprocessId && groups.elementGroup[x.multiprocessId]) || TOP_LEVEL_GROUP;

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
      const imported = section.key === NOT_IN_DFD ? [] : shownImported.filter((x) => groupOfImported(x) === section.key);
      const threats = [...sectionTables.flatMap(({ table }) => table.threats), ...imported.flatMap((x) => x.threats)];
      return { ...section, sectionTables, imported, threats };
    })
    .filter((section) => section.threats.length > 0);

  const rows: GroupSummaryRow[] = sections
    .filter((s) => s.key !== TOP_LEVEL_GROUP && s.key !== NOT_IN_DFD)
    .map((s) => ({
      key: s.key,
      label: s.label,
      figures: (
        <Typography variant="body2" color="text.secondary">
          {t("tabs.threats.groups.summary", {
            defaultValue: "{{count}} threat(s) of its parts",
            count: s.threats.length,
          })}
          {" — "}
          {STRIDE.map((c) => `${c} ${s.threats.filter((x) => x.strideCategory === c).length}`).join(" · ")}
        </Typography>
      ),
    }));

  return (
    <GroupAccordions
      testIdPrefix="threat-group"
      sections={sections.map((section) => ({
        key: section.key,
        label: section.label,
        count: section.threats.length,
        render: () => (
          <>
            {section.sectionTables.map(({ table, index }) => renderTable(table, index, section.key))}
            {cards(section.imported)}
          </>
        ),
      }))}
      summaries={{
        inGroup: TOP_LEVEL_GROUP,
        rows,
        openLabel: t("tabs.threats.groups.details", { defaultValue: "Details" }),
      }}
    />
  );
};

export default ThreatGroupSections;
