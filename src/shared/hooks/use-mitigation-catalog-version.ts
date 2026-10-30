// Re-render when the open project's mitigations (M-C-nnn) change — for
// readers that memoize the catalog or its texts (custom mitigation catalog
// design CM-2; registry: shared/services/project-mitigation-registry.ts).

import { useSyncExternalStore } from "react";
import { getMitigationCatalogVersion, subscribeMitigationCatalog } from "../services/project-mitigation-registry";

export function useMitigationCatalogVersion(): number {
  return useSyncExternalStore(subscribeMitigationCatalog, getMitigationCatalogVersion, getMitigationCatalogVersion);
}
