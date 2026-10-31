// shared/services/project-mitigation-registry.ts
//
// The open project's own mitigations (M-C-nnn, custom mitigation catalog
// design CM-2) for every reader of the mitigation catalog — closed loop,
// dialogs, report — in any feature. One writer: the app layer (workspace
// layout) for the open project, the CLI before generating, tests.
//
// Writing is a plain assignment and safe during render; it does NOT notify.
// The writer calls notifyProjectMitigations() afterwards (in an effect), so no
// component is updated while another one renders (review 2026-10-30). Readers
// rendered later in the same pass already see the new entries; readers that
// memoize the catalog subscribe through useMitigationCatalogVersion.

export interface RegisteredMitigation {
  id: string;
}

const EMPTY: readonly RegisteredMitigation[] = [];
let entries: readonly RegisteredMitigation[] = EMPTY;
let version = 0;
const listeners = new Set<() => void>();

/** Register the open project's mitigations (undefined / [] = none). No notification. */
export function setProjectMitigations(next: readonly RegisteredMitigation[] | undefined): void {
  const value = next && next.length > 0 ? next : EMPTY;
  if (value === entries) return;
  entries = value;
  version += 1;
}

/** Tell subscribers that the registered mitigations may have changed. */
export function notifyProjectMitigations(): void {
  listeners.forEach((listener) => listener());
}

export function registeredProjectMitigations<T extends RegisteredMitigation>(): readonly T[] {
  return entries as readonly T[];
}

/** Changes whenever the registered project mitigations change. */
export function getMitigationCatalogVersion(): number {
  return version;
}

export function subscribeMitigationCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
