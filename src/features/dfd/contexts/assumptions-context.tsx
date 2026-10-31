// features/dfd/contexts/assumptions-context.tsx
//
// The Item Definition's assumptions for the DFD forms (ISO/SAE 21434
// conformance plan Phase 1 stage A, A-3): a trust boundary links the
// assumptions it relies on, and "Convert to assumption" creates one from its
// free text. Provided by the DFD tab with what the app layer hands it; the
// DFD feature never imports the overview feature. Without a provider the
// forms show the free text only.

import React, { createContext, useContext } from "react";
import type { Assumption } from "shared";

export interface AssumptionsAccess {
  readonly assumptions: readonly Assumption[];
  /** Stores a new open assumption with this text and returns it. */
  readonly create: (text: string) => Assumption;
}

const AssumptionsContext = createContext<AssumptionsAccess | null>(null);

export const AssumptionsProvider: React.FC<{
  value: AssumptionsAccess | null;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <AssumptionsContext.Provider value={value}>{children}</AssumptionsContext.Provider>
);

export function useAssumptions(): AssumptionsAccess | null {
  return useContext(AssumptionsContext);
}
