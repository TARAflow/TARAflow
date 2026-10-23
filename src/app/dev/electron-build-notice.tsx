// src/app/dev/electron-build-notice.tsx
// ==================== ELECTRON BUILD NOTICE (dev) ====================
// The renderer reloads on every change, the Electron part (main, preload,
// draw.io scripts) only with `npm run dev:electron`. When its sources
// changed since the running Electron part was built, IPC calls and the
// draw.io plugin are out of date — this banner says so instead of letting
// the change look broken.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Snackbar } from "@mui/material";
import { isElectronBuildOutdated } from "./electron-build-check";

interface ElectronBuildNoticeProps {
  /** The hash of the Electron sources now (null: no check, e.g. production). */
  sourceHash: string | null;
  /** Updates of sourceHash while the app runs. */
  subscribe?: (listener: (hash: string | null) => void) => () => void;
}

export function ElectronBuildNotice({ sourceHash, subscribe }: ElectronBuildNoticeProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(sourceHash);
  const [running, setRunning] = useState<string | null | undefined>(undefined);

  useEffect(() => subscribe?.(setCurrent), [subscribe]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api || sourceHash === null) return;
    if (!api.getElectronBuildInfo) {
      setRunning(null);
      return;
    }
    api
      .getElectronBuildInfo()
      .then((info) => setRunning(info?.hash ?? null))
      .catch(() => setRunning(null));
  }, [sourceHash]);

  if (!isElectronBuildOutdated(running, current)) return null;
  return (
    <Snackbar open anchorOrigin={{ vertical: "top", horizontal: "center" }}>
      <Alert severity="warning" variant="filled" data-testid="electron-build-outdated">
        {t("devBuild.electronOutdated", {
          defaultValue:
            "The Electron part is older than its sources (electron/ changed). Quit the app and restart npm run dev:electron.",
        })}
      </Alert>
    </Snackbar>
  );
}
