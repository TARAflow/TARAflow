// ==================== RISK DIALOG — PROPS ====================
// Split out of risk-dialog.tsx (MT-2): the props, shared by the dialog and its state hooks.

import type React from "react";
import type { Assumption, CybersecurityConcept } from "shared";
import { RiskConfiguration } from "../../models/risk-config-types";
import { Risk } from "../../models/risk-assessment-types";
import type { AssetDataReference, DFDReference, ThreatReference } from "shared";

export interface RiskDialogProps {
  open: boolean;
  /** All risks in the current accordion group */
  risks: Risk[];
  /** Index of the risk to open initially */
  initialIndex: number;
  configuration: RiskConfiguration;
  /** Threat references for display (optional — for uncertain warning) */
  threats?: ThreatReference[];
  /** Asset data for impact display and pre-fill */
  assetDataRef?: AssetDataReference;
  /** Current DFD state — used to show coverage badges on mitigations */
  dfdData?: DFDReference | null;
  onSave: (riskId: string, updates: Partial<Risk>) => void;
  onClose: () => void;
  /**
   * Goals and claims (tab "Goal / Claim", ISO 21434 plan Phase 4, decision
   * 25). Without onConceptChange the tab is not shown.
   */
  concept?: CybersecurityConcept;
  onConceptChange?: (concept: CybersecurityConcept) => void;
  /** Every risk of the register — "also on …", scenario order of the reuse list. */
  allRisks?: readonly Risk[];
  /** Item Definition assumptions a retain claim relies on. */
  assumptions?: readonly Assumption[];
  isoMode?: boolean;
  /**
   * Rendered above the risk's own mitigations — e.g. the treatment of an
   * imported component's risk (multi-project TARA, the app layer fills it;
   * this feature knows no components). Null / undefined: nothing.
   */
  extraSection?: (risk: Risk) => React.ReactNode;
}
