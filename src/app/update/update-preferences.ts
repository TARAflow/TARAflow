// src/app/update/update-preferences.ts
// ==================== UPDATE — RENDERER PREFERENCES ====================
// The user's includePrereleases choice, persisted in localStorage via an
// injected store (defaults come from the caller, not this module, so the
// unit tests stay free of the storageService import graph). Same hybrid
// pattern as repo-discovery: a small durable renderer preference.

import type { UpdateCheckOptions } from "shared/models/update-types";

const PREFS_KEY = "taraflow_update_preferences";

/** Only the bits of the check options the user controls via the checkbox. */
export type UpdatePreferences = Pick<UpdateCheckOptions, "includePrereleases">;

export const DEFAULT_UPDATE_PREFERENCES: UpdatePreferences = {
  includePrereleases: true,
};

/** Minimal storage surface we depend on (satisfied by storageService). */
export interface PreferenceStore {
  get<T>(key: string): Promise<{ success: boolean; data?: T }>;
  set<T>(key: string, value: T): Promise<unknown>;
}

export async function loadUpdatePreferences(
  store: PreferenceStore,
): Promise<UpdatePreferences> {
  const res = await store.get<UpdatePreferences>(PREFS_KEY);
  if (
    res.success &&
    res.data &&
    typeof res.data.includePrereleases === "boolean"
  ) {
    return { includePrereleases: res.data.includePrereleases };
  }
  return { ...DEFAULT_UPDATE_PREFERENCES };
}

export async function saveUpdatePreferences(
  prefs: UpdatePreferences,
  store: PreferenceStore,
): Promise<void> {
  await store.set(PREFS_KEY, prefs);
}
