// taraflow-reporter/cli/to-doc-project-data.ts
//
// Phase 4 (TARAflow CLI Report Plan) — Project → DocProjectData mapper.
//
// The CLI builds its report data with the app's own transform
// (src/app/services/doc-transform.ts), so the CLI report and the app
// report cannot drift apart. Until 2026-11-09 this file rebuilt the
// transform with EMPTY label caches: the CLI wrote "should" where the app
// wrote "Should", lacked the impact / STRIDE / status labels and the
// active STRIDE methods, and missed complianceComponentId — found by the
// app = CLI comparison of the credited residual (multi-project TARA 3d-2a).
//
// Everything the report needs that is derived (methodology record,
// verification status, requirement matrices, the credited residual —
// docResidualView) is computed inside transformProjectToDocData.

import type { Project } from "../../src/app/models/project-types";
import { transformProjectToDocData } from "../../src/app/services/doc-transform";
import type { DocProjectData, DocLanguage } from "../../src/features/documentation/models/doc-types";

/**
 * Maps a loaded (migrated) Project to DocProjectData, in the shape the
 * generators (base-generator.ts and subclasses) expect — the app's transform.
 *
 * @param project - Fully migrated Project (see load-project.ts)
 * @param language - Document language (from --lang or
 *                   project.documentation.configuration.language)
 */
export function toDocProjectData(project: Project, language: DocLanguage): DocProjectData {
  return transformProjectToDocData(project, language);
}
