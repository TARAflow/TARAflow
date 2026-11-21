// features/risks/components/safety-marks-context.tsx
//
// EN 50742 in the Risk register (0.20 patch 29, review 2026-11-21), for every
// reader in the tab without prop drilling:
//   srslOpen   risks whose SRSL controls are not all done — the progress
//              keeps them open whatever their treatment (the same test as
//              the Compliance matrix, from the app layer);
//   relevant   threat ids whose risk is EN 50742 relevant — the column and
//              filter "safety-relevant" (A and B alike); undefined outside an
//              EN 50742 project.
// Without a provider: nothing is marked, the progress as before.

import { createContext, useContext } from "react";

export interface SafetyMarks {
  srslOpen?: ReadonlySet<string>;
  relevantThreatIds?: ReadonlySet<string>;
}

const SafetyMarksContext = createContext<SafetyMarks>({});

export const SafetyMarksProvider = SafetyMarksContext.Provider;

export function useSafetyMarks(): SafetyMarks {
  return useContext(SafetyMarksContext);
}
