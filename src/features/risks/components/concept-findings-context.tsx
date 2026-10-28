// features/risks/components/concept-findings-context.tsx
//
// The goal / claim warnings per risk (ISO 21434 plan Phase 4, P4-2) for the
// risk table: a marker next to the treatment. Provided by the Risk tab;
// without a provider the tables show no marker.

import React, { createContext, useContext } from "react";
import type { ConceptFinding } from "../services/concept-findings";

const ConceptFindingsContext = createContext<ReadonlyMap<string, ConceptFinding[]> | null>(null);

export const ConceptFindingsProvider: React.FC<{
  value: ReadonlyMap<string, ConceptFinding[]> | null;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <ConceptFindingsContext.Provider value={value}>{children}</ConceptFindingsContext.Provider>
);

export function useConceptFindingsByRisk(): ReadonlyMap<string, ConceptFinding[]> | null {
  return useContext(ConceptFindingsContext);
}
