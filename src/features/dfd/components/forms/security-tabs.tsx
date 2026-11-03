// ==================== SECURITY SUB-TABS ====================
// The Security section of the Process and Multiprocess forms in light
// sub-tabs per category (user 2026-11-02; model-coverage-implementation-
// plan.md CM-5d): login & accounts · authorization · robustness · sessions &
// traceability · operation (· inside and safety on the Multiprocess). A tab names how
// many of its shown fields are still open; a tab without a field that fits
// the element is left out. The chosen tab is kept per element type while the
// app runs, so moving from element to element stays on the same category.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Grid, Tab, Tabs } from "@mui/material";
import type { SecurityGroup } from "shared";

export type SecurityTabId = SecurityGroup | "safety";

/** One field of the section. */
export interface SecurityEntry {
  key: string;
  group: SecurityTabId;
  /** Fits the element (the form's own condition or the field's predicate). */
  visible: boolean;
  /** Has a value; a checkbox counts as set. */
  set: boolean;
  /** Grid item(s) of the field. */
  node: React.ReactNode;
}

const TAB_ORDER: readonly SecurityTabId[] = ["login", "authorization", "robustness", "sessions", "operation", "inside", "safety"];

const TAB_DEFAULT: Record<SecurityTabId, string> = {
  login: "Login & accounts",
  authorization: "Authorization",
  robustness: "Robustness",
  sessions: "Sessions & traceability",
  operation: "Operation",
  inside: "Inside (black box)",
  safety: "Safety",
};

/** Last chosen tab per form (element type), for this run of the app. */
const lastTab = new Map<string, SecurityTabId>();

export const SecurityTabs: React.FC<{
  /** Form key, e.g. "process" — the chosen tab is kept per key. */
  formKey: string;
  entries: readonly SecurityEntry[];
}> = ({ formKey, entries }) => {
  const { t } = useTranslation();
  const tabs = TAB_ORDER.map((id) => {
    const shown = entries.filter((e) => e.group === id && e.visible);
    return { id, shown, open: shown.filter((e) => !e.set).length };
  }).filter((tab) => tab.shown.length > 0);
  const [chosen, setChosen] = useState<SecurityTabId | undefined>(() => lastTab.get(formKey));
  const active = tabs.find((tab) => tab.id === chosen) ?? tabs[0];
  if (!active) return null;

  const choose = (id: SecurityTabId) => {
    setChosen(id);
    lastTab.set(formKey, id);
  };

  return (
    <Box data-testid="security-tabs">
      <Tabs
        value={active.id}
        onChange={(_, id: SecurityTabId) => choose(id)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ minHeight: 32, mb: 1.5, "& .MuiTab-root": { minHeight: 32, py: 0.5, px: 1.5, textTransform: "none", fontSize: "0.8rem" } }}
      >
        {tabs.map((tab) => {
          const label = t(`tabs.dfd.element_description.securityTabs.${tab.id}`, { defaultValue: TAB_DEFAULT[tab.id] });
          return (
            <Tab
              key={tab.id}
              value={tab.id}
              label={tab.open > 0 ? `${label} (${tab.open})` : label}
              data-testid={`security-tab-${tab.id}`}
            />
          );
        })}
      </Tabs>
      <Grid container rowSpacing={2} columnSpacing={2}>
        {active.shown.map((entry) => (
          <React.Fragment key={entry.key}>{entry.node}</React.Fragment>
        ))}
      </Grid>
    </Box>
  );
};
