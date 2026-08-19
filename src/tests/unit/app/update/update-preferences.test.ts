// src/tests/unit/app/update/update-preferences.test.ts
import { describe, it, expect } from "vitest";
import {
  loadUpdatePreferences,
  saveUpdatePreferences,
  DEFAULT_UPDATE_PREFERENCES,
  type PreferenceStore,
} from "app/update/update-preferences";

function memoryStore(initial?: unknown): PreferenceStore & { last?: unknown } {
  let value = initial;
  return {
    last: undefined,
    async get<T>(_key: string) {
      return value === undefined
        ? { success: false }
        : { success: true, data: value as T };
    },
    async set<T>(_key: string, v: T) {
      value = v;
      (this as { last?: unknown }).last = v;
      return { success: true };
    },
  };
}

describe("update preferences", () => {
  it("returns the default (prereleases on) when nothing is stored", async () => {
    const prefs = await loadUpdatePreferences(memoryStore());
    expect(prefs).toEqual(DEFAULT_UPDATE_PREFERENCES);
    expect(prefs.includePrereleases).toBe(true);
  });

  it("round-trips a stored value", async () => {
    const store = memoryStore();
    await saveUpdatePreferences({ includePrereleases: false }, store);
    expect(await loadUpdatePreferences(store)).toEqual({
      includePrereleases: false,
    });
  });

  it("falls back to the default when the stored value is malformed", async () => {
    const prefs = await loadUpdatePreferences(
      memoryStore({ includePrereleases: "yes" }),
    );
    expect(prefs).toEqual(DEFAULT_UPDATE_PREFERENCES);
  });
});
