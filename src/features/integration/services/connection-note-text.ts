// ==================== CONNECTION NOTE TEXT ====================
// The connection test's note in the UI language (integration.connection.*),
// the English sentence of the adapter as the fallback.

import type { TFunction } from "i18next";
import { connectionNoteEnglish, type ConnectionNote } from "../adapters/adapter-support";

export function connectionNoteText(note: ConnectionNote, t: TFunction | ((key: string, options?: Record<string, unknown>) => string)): string {
  const defaultValue = connectionNoteEnglish(note);
  const tr = t as (key: string, options?: Record<string, unknown>) => string;
  switch (note.code) {
    case "connected":
      return tr(`integration.connection.connected.${note.unit}`, { account: note.account, count: note.count, defaultValue });
    case "authFailed":
      return tr(`integration.connection.authFailed.${note.hint}`, { defaultValue });
    case "connectionFailed":
      return tr("integration.connection.connectionFailed", { detail: note.detail, defaultValue });
    case "listFailed":
      return tr(`integration.connection.listFailed.${note.unit}`, { status: note.status, defaultValue });
  }
}
