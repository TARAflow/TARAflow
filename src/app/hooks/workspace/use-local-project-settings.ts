// ==================== LOCAL PROJECT SETTINGS ====================
// Personal values (commit author, tracker account and connection state) live
// on this machine, not in the file (local-user-settings, user 2026-10-30):
// the tabs see the project's blocks with them filled in. A file written
// before keeps its values until the next save — adopted once on opening.
// Split out of workspace-layout.tsx (MT-1).

import { useEffect, useMemo } from "react";
import { createTicketAdapter } from "features/integration";
import {
  rememberLocalSettings,
  withLocalAudit,
  withLocalIntegration,
} from "../../services/local-user-settings";
import type { Project } from "../../models/project-types";

export function useLocalProjectSettings(
  projectId: string | undefined,
  audit: Project["audit"] | null,
  integration: Project["integration"] | null,
) {
  useEffect(() => {
    if (projectId) {
      rememberLocalSettings(projectId, audit ?? null, integration ?? null, { onlyMissing: true });
    }
    // Once per opened project — later edits go through the update handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const localAudit = useMemo(
    () => (projectId ? withLocalAudit(projectId, audit ?? null) : audit ?? null),
    [projectId, audit],
  );
  const localIntegration = useMemo(
    () => (projectId ? withLocalIntegration(projectId, integration ?? null) : integration ?? null),
    [projectId, integration],
  );

  // The issue tracker's adapter for the Risk tab (adapters design §4.3) —
  // derived from the stored connection; the main process holds the token.
  const integrationConnection = localIntegration?.connection ?? null;
  const ticketPort = useMemo(() => createTicketAdapter(integrationConnection), [integrationConnection]);

  return { localAudit, localIntegration, ticketPort };
}
