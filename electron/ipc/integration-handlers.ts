// electron/ipc/integration-handlers.ts
// ==================== ISSUE-TRACKER CHANNEL ====================
// Issue-tracker adapters design §3.1 / §4.1 (IT-1): the renderer saves a token
// for tool + host + account, asks whether one exists, deletes it, and sends
// requests that the main process authenticates itself. No handler returns a
// token.

import { ipcMain } from "electron";
import { credentialService } from "../services/credential-service-main";
import { performIntegrationRequest, type IntegrationRequest } from "../services/integration-request";
import {
  issueTracker,
  normalizeTrackerHost,
  trackerKeychainKey,
  type IssueTrackerId,
} from "../../src/shared/models/issue-trackers";

interface TokenRef {
  tool: string;
  host: string;
  account: string;
}

/** The keychain key of a token reference, or null when it is not valid. */
function keyOf(ref: TokenRef): string | null {
  const tracker = issueTracker(ref?.tool);
  const host = normalizeTrackerHost(ref?.host);
  const account = ref?.account?.trim().toLowerCase();
  return tracker && host && account ? trackerKeychainKey(tracker.id as IssueTrackerId, host, account) : null;
}

export function registerIntegrationHandlers() {
  ipcMain.handle("integration:saveToken", async (_, ref: TokenRef & { token: string }) => {
    const key = keyOf(ref);
    if (!key || !ref.token) return { success: false, error: "invalid tracker, host or account" };
    try {
      await credentialService.saveIntegrationToken(key, ref.token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "save failed" };
    }
  });

  ipcMain.handle("integration:hasToken", async (_, ref: TokenRef) => {
    const key = keyOf(ref);
    return { success: true, hasToken: key ? (await credentialService.getIntegrationToken(key)) !== null : false };
  });

  ipcMain.handle("integration:deleteToken", async (_, ref: TokenRef) => {
    const key = keyOf(ref);
    return { success: key ? await credentialService.deleteIntegrationToken(key) : false };
  });

  ipcMain.handle("integration:request", async (_, req: IntegrationRequest) =>
    performIntegrationRequest(req, {
      getToken: (key) => credentialService.getIntegrationToken(key),
      fetch,
    }),
  );
}
