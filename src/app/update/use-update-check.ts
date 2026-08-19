// src/app/update/use-update-check.ts
// ==================== UPDATE — useUpdateCheck HOOK ====================
// The renderer's single entry point. Reads the persisted preference, calls
// the window.updates bridge, and applies the surface gating. A manual check
// forces a fresh fetch (bypasses the 30-min main cache) and reports every
// state; a startup check reuses the cache and only surfaces a real update.
// Never throws: a missing bridge is silent on startup, an error on manual.

import { useCallback, useState } from "react";
import { storageService } from "app/services/storage-service";
import type { UpdateCheckResult } from "shared/models/update-types";
import { loadUpdatePreferences } from "./update-preferences";
import { shouldSurface, type UpdateTrigger } from "./should-surface";

export interface UseUpdateCheck {
  /** True while a check is in flight (drives the "Checking…" state). */
  checking: boolean;
  /** The result to show, or null when nothing should surface. */
  result: UpdateCheckResult | null;
  /** Run a check. `trigger` decides what surfaces and whether to force. */
  check: (trigger: UpdateTrigger) => Promise<void>;
  /** Clear the surfaced result (e.g. the user dismissed the snackbar). */
  dismiss: () => void;
}

export function useUpdateCheck(): UseUpdateCheck {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);

  const check = useCallback(async (trigger: UpdateTrigger) => {
    const bridge = window.updates;
    if (!bridge?.check) {
      // No bridge (e.g. browser mode): startup stays silent, manual reports.
      if (trigger === "manual") {
        setResult({
          status: "error",
          message: "Update check is unavailable.",
        });
      }
      return;
    }

    setChecking(true);
    try {
      const { includePrereleases } = await loadUpdatePreferences(
        storageService,
      );
      const res = await bridge.check({
        includePrereleases,
        force: trigger === "manual",
      });
      setResult(shouldSurface(res, trigger) ? res : null);
    } finally {
      setChecking(false);
    }
  }, []);

  const dismiss = useCallback(() => setResult(null), []);

  return { checking, result, check, dismiss };
}
