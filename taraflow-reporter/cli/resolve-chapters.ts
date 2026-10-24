// taraflow-reporter/cli/resolve-chapters.ts
//
// The chapter list the CLI renders. Same rule as the app's Documentation tab
// (useDocumentGeneration → withDefaultChapters): a stored list from before a
// chapter existed is completed with the defaults, in canonical order, keeping
// each stored chapter's settings — otherwise the CLI report of an older
// project lacks e.g. the methodology / attack-path / traceability chapters
// the app shows (ISO/SAE 21434 conformance plan F3).
//
// `--chapters` selects from the completed list, so the newer chapters can be
// chosen too.

import {
  withDefaultChapters,
  type DocChapterConfig,
} from "../../src/features/documentation/models/doc-types";

export function resolveCliChapters(
  stored: DocChapterConfig[] | undefined,
  selected?: string[],
): DocChapterConfig[] {
  const chapters = withDefaultChapters(stored);
  return selected
    ? chapters.map((c) => ({ ...c, enabled: selected.includes(c.id) }))
    : chapters;
}
