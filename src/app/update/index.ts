// src/app/update/index.ts
// ==================== UPDATES FEATURE — PUBLIC API ====================


export { UpdateNotifier } from "./update-notifier";

export { useUpdateCheck } from "./use-update-check";
export type { UseUpdateCheck } from "./use-update-check";

export { shouldSurface } from "./should-surface";
export type { UpdateTrigger } from "./should-surface";

export {
  loadUpdatePreferences,
  saveUpdatePreferences,
  DEFAULT_UPDATE_PREFERENCES,
} from "./update-preferences";
export type { UpdatePreferences, PreferenceStore } from "./update-preferences";


