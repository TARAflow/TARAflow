// features/compliance/components/compliance-frame.tsx
//
// The Compliance frame (model-coverage-implementation-plan.md §2.2, CM-2):
// one sub-tab per active standard (K-1 — with both 62443 tags the CRA and the
// classic edition side by side). Each sub-tab is the matrix of one edition;
// only the selected one is evaluated. The last selected sub-tab is a
// per-viewer convenience (localStorage), never project data. With a single
// standard there is no sub-tab bar.

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Tab, Tabs } from "@mui/material";
import type { AnyEdition, EditionId } from "../models/compliance-types";
import type { ComplianceResult } from "../models/evaluation-types";
import type { StandardModule } from "../services/standard-registry";
import { ComplianceTab, type ComplianceTabProps } from "./compliance-tab";

const SUB_TAB_KEY = "taraflow.compliance.subTab";

function storedSubTab(): string | null {
  try {
    return localStorage.getItem(SUB_TAB_KEY);
  } catch {
    return null;
  }
}

function storeSubTab(id: EditionId): void {
  try {
    localStorage.setItem(SUB_TAB_KEY, id);
  } catch {
    // no storage (e.g. private mode): the first sub-tab opens next time
  }
}

export interface ComplianceFrameProps extends Omit<ComplianceTabProps, "edition" | "header" | "achieved" | "planned"> {
  /** The active standards in registry order (activeStandards); at least one. */
  standards: readonly StandardModule[];
  /** Achieved and planned run of one edition — called for the selected sub-tab only. */
  evaluate: (edition: AnyEdition) => { achieved: ComplianceResult; planned: ComplianceResult };
}

export const ComplianceFrame: React.FC<ComplianceFrameProps> = ({ standards, evaluate, ...tabProps }) => {
  const { t } = useTranslation("compliance");
  const [selectedId, setSelectedId] = useState<string | null>(storedSubTab);
  // A stored sub-tab whose tag was removed falls back to the first standard.
  const selected = standards.find((s) => s.id === selectedId) ?? standards[0];
  const result = useMemo(() => (selected ? evaluate(selected.edition) : undefined), [evaluate, selected]);
  if (!selected || !result) return null;

  const select = (id: EditionId) => {
    setSelectedId(id);
    storeSubTab(id);
  };

  return (
    <Box data-testid="compliance-frame">
      {standards.length > 1 && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
          <Tabs
            value={selected.id}
            onChange={(_, id: EditionId) => select(id)}
            aria-label={t("compliance.standards", { defaultValue: "Standards" })}
          >
            {standards.map((s) => (
              <Tab key={s.id} value={s.id} label={s.label} data-testid={`compliance-subtab-${s.id}`} />
            ))}
          </Tabs>
        </Box>
      )}
      {/* key: filter, open dialogs and the like belong to one standard. */}
      <ComplianceTab key={selected.id} {...tabProps} edition={selected.edition} header={selected.header} achieved={result.achieved} planned={result.planned} />
    </Box>
  );
};
