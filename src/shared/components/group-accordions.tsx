// ==================== GROUP ACCORDIONS ====================
// One accordion per group with label and count, collapsible, the content
// rendered only while open (review finding: one generic group accordion
// instead of three copies). Used by the asset, threat and risk tables of a
// leveled DFD (Phase 6, D20) — the features supply the groups, the content
// and all texts; this component only lays them out.
//
// Summary rows: one group (e.g. "Top level") can show a row per other group
// with its figures and a link that opens that group and scrolls to it.

import React from "react";
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

export interface GroupAccordionSection {
  key: string;
  label: React.ReactNode;
  /** Shown as a chip in the header. */
  count: number;
  /** Caption between label and count (e.g. what a group means). */
  hint?: React.ReactNode;
  /** The content; called only while the group is open. */
  render: () => React.ReactNode;
}

export interface GroupSummaryRow {
  /** Key of the group the row stands for (opened by the link). */
  key: string;
  label: React.ReactNode;
  /** Figures of the group (counts, chips, progress). */
  figures: React.ReactNode;
}

export interface GroupAccordionsProps {
  sections: readonly GroupAccordionSection[];
  /** data-testid / DOM id prefix: `${prefix}-${key}`, `${prefix}-summaries`, `${prefix}-summary-${key}`. */
  testIdPrefix: string;
  summaries?: {
    /** Key of the group that shows the rows. */
    inGroup: string;
    rows: readonly GroupSummaryRow[];
    /** Text of the link that opens a group. */
    openLabel: string;
  };
  /** Opens this group from outside (e.g. "Show in table"); a new object per request. */
  openRequest?: { readonly key: string } | null;
}

export const GroupAccordions: React.FC<GroupAccordionsProps> = ({
  sections,
  testIdPrefix,
  summaries,
  openRequest,
}) => {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const domId = (key: string) => `${testIdPrefix}-${key}`;

  React.useEffect(() => {
    if (!openRequest) return;
    const key = openRequest.key;
    setCollapsed((c) => (c[key] ? { ...c, [key]: false } : c));
  }, [openRequest]);

  const openGroup = (key: string) => {
    setCollapsed((c) => ({ ...c, [key]: false }));
    requestAnimationFrame(() =>
      document.getElementById(domId(key))?.scrollIntoView?.({ block: "start", behavior: "smooth" }),
    );
  };

  return (
    <>
      {sections.map((section) => {
        const open = !collapsed[section.key];
        const rows = summaries?.inGroup === section.key ? summaries.rows : [];
        return (
          <Accordion
            key={section.key}
            id={domId(section.key)}
            expanded={open}
            onChange={(_, expanded) => setCollapsed((c) => ({ ...c, [section.key]: !expanded }))}
            disableGutters
            data-testid={domId(section.key)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {section.label}
              </Typography>
              {section.hint && (
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  {section.hint}
                </Typography>
              )}
              <Chip size="small" label={section.count} sx={{ mr: 1 }} />
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {rows.length > 0 && (
                <Box sx={{ px: 2, py: 1 }} data-testid={`${testIdPrefix}-summaries`}>
                  {rows.map((row) => (
                    <Stack
                      key={row.key}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ py: 0.25 }}
                      data-testid={`${testIdPrefix}-summary-${row.key}`}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 160 }}>
                        {row.label}
                      </Typography>
                      {row.figures}
                      <Link component="button" variant="body2" onClick={() => openGroup(row.key)}>
                        {summaries!.openLabel}
                      </Link>
                    </Stack>
                  ))}
                </Box>
              )}
              {open && section.render()}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </>
  );
};

export default GroupAccordions;
