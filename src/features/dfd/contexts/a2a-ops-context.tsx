// features/dfd/contexts/a2a-ops-context.tsx
//
// Where the asset forms send asset-to-asset relation operations. Provided by
// the DFD tab (→ useDFDPersistence.commitA2AOps → app layer → relations
// service). Without a provider the forms offer no A2A editing.

import React, { createContext, useContext } from "react";
import type { A2AOp } from "shared";

export type CommitA2AOps = (ops: A2AOp[]) => void;

const A2AOpsContext = createContext<CommitA2AOps | null>(null);

export const A2AOpsProvider: React.FC<{
  commit: CommitA2AOps;
  children: React.ReactNode;
}> = ({ commit, children }) => (
  <A2AOpsContext.Provider value={commit}>{children}</A2AOpsContext.Provider>
);

export function useA2AOps(): CommitA2AOps | null {
  return useContext(A2AOpsContext);
}
