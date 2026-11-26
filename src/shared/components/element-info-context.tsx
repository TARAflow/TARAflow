// shared/components/element-info-context.tsx
//
// The DFD analysis graph for the element info buttons in the threat tables and
// the threat and risk dialogs. Provided by the Threats and Risks tabs; absent =
// no buttons.

import React, { createContext, useContext } from "react";
import type { DFDGraphReference } from "../models/dfd-reference-types";

const ElementInfoContext = createContext<DFDGraphReference | null>(null);

export const ElementInfoProvider: React.FC<{ graph: DFDGraphReference | null | undefined; children: React.ReactNode }> = ({
  graph,
  children,
}) => <ElementInfoContext.Provider value={graph ?? null}>{children}</ElementInfoContext.Provider>;

export function useElementInfoGraph(): DFDGraphReference | null {
  return useContext(ElementInfoContext);
}
