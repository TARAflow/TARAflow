// ==================== COMPONENT DRIFT (hook) ====================
// Multi-project TARA phase 5a (design §9.1): the drift status per import —
// kept in the app, never in the project file (it describes the component's
// repository, not the analysis). Checked locally when a project with
// imports is opened (no network: `git fetch` only on request), and again on
// request. Electron only (design §2).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../../models/project-types";
import type { ComponentDriftStatus } from "../../services/component-import/component-drift";
import { componentImportAvailable, checkComponentDriftOnDisk } from "../../services/component-import/component-source-electron";

export interface ComponentDrift {
  /** Import id → status; absent = not checked (yet). */
  drift: ReadonlyMap<string, ComponentDriftStatus>;
  checking: boolean;
  /** Checks every import again; fetch = `git fetch` first (network, on request only). */
  recheck: (fetch: boolean) => void;
}

export function useComponentDrift(project: Pick<Project, "id" | "components" | "filePath"> | null | undefined): ComponentDrift {
  const [drift, setDrift] = useState<ReadonlyMap<string, ComponentDriftStatus>>(new Map());
  const [checking, setChecking] = useState(false);
  const run = useRef(0);
  const imports = project?.components?.imports;
  const filePath = project?.filePath;
  // Re-check when the imported states change (an update), not on every edit.
  const key = useMemo(() => (imports ?? []).map((i) => `${i.id}:${i.contentHash}`).join("|"), [imports]);

  const check = useCallback(
    async (fetch: boolean) => {
      const list = imports ?? [];
      if (list.length === 0 || !componentImportAvailable()) {
        setDrift(new Map());
        return;
      }
      const mine = ++run.current;
      setChecking(true);
      const entries = await Promise.all(
        list.map(async (i) => {
          try {
            return [i.id, await checkComponentDriftOnDisk(i, filePath, { fetch })] as const;
          } catch (err) {
            return [i.id, { kind: "unreachable", reason: "unreadable", detail: String(err) } as ComponentDriftStatus] as const;
          }
        }),
      );
      if (mine !== run.current) return; // a newer check (other project) won
      setDrift(new Map(entries));
      setChecking(false);
    },
    [imports, filePath],
  );

  useEffect(() => {
    void check(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- by the imported states and project only
  }, [project?.id, key, filePath]);

  return { drift, checking, recheck: (fetch) => void check(fetch) };
}
