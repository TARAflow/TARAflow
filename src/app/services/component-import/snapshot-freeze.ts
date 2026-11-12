// ==================== FROZEN SNAPSHOTS (development and tests) ====================
// Multi-project TARA 6b, review 2026-11-12: an embedded component snapshot
// is hashed; code that writes into it changes the stored state under its
// hash (found by the AVE in patch 82: shared property objects, the graph
// builder writing derived values in place). Many parts read the snapshot —
// read models, delta, treatments, report. In development and in tests the
// snapshots are deep-frozen after loading, importing and updating, so a
// write throws at once with the stack of the writing place, not after the
// commit. Off in production builds — a user never sees it crash.

import type { Project } from "../../models/project-types";

/** Development build (Vite) or a test run. */
function guarded(): boolean {
  const viteDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
  const test = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || !!process.env?.VITEST);
  return viteDev || test;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** The project's embedded snapshots frozen (development / tests only); the project as it is. */
export function freezeComponentSnapshots<P extends Pick<Project, "components">>(project: P): P {
  if (!guarded()) return project;
  for (const imported of project.components?.imports ?? []) deepFreeze(imported.snapshot);
  return project;
}
