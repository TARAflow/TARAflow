// Re-render when the open project's mitigations (M-C-nnn) change — for
// readers that memoize the catalog or its texts (custom mitigation catalog
// design CM-2).

import { useSyncExternalStore } from "react";
import {
  getMitigationCatalogVersion,
  subscribeMitigationCatalog,
} from "../../services/threat-catalog-service";

export function useMitigationCatalogVersion(): number {
  return useSyncExternalStore(subscribeMitigationCatalog, getMitigationCatalogVersion, getMitigationCatalogVersion);
}
