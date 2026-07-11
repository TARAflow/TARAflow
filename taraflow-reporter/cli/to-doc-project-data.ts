// taraflow-reporter/cli/to-doc-project-data.ts
//
// Phase 4 (TARAflow CLI Report Plan) — Project → DocProjectData mapper.
//
// The hook (use-document-generation.ts, UI-only) already builds
// DocProjectData while assembling the tabs; there's no existing
// standalone transform the CLI could reuse. This mapper reproduces
// exactly what the plan prescribes for Phase 4.
//
// Verified against the real Simple_Test_Project_tara.json (schemaVersion 3):
//   - Project top-level keys match 1:1 the fields repairProject() in
//     migration-service.ts returns.
//   - documentation.configuration.format is "strictdoc" in the sample —
//     exactly the default Phase 5 should pull from the project.
//   - dfd.thumbnail is already a base64 SVG (see plan note: no headless
//     draw.io needed).

import type { Project } from "../../src/app/models/project-types";
import type {
  DocProjectData,
  DocComputedValues,
  DocLanguage,
} from "../../src/features/documentation/models/doc-types";

/**
 * Builds an empty DocComputedValues instance.
 *
 * IMPORTANT (plan gotcha): `computed` must not be `undefined` — the
 * generators access it via `project.computed.impactLabels.get(...)`.
 * Empty maps are sufficient because every call site in the generator has
 * a `?? fallback` afterwards (verified in base-generator.ts, e.g.
 * `project.computed.riskBeforeLabels.get(risk.id) ?? risk.calculatedRiskBeforeMitigation.toString()`).
 */
function createEmptyComputedValues(language: DocLanguage): DocComputedValues {
  return {
    activeStrideMethods: [],
    language,
    impactLabels: new Map(),
    riskBeforeLabels: new Map(),
    riskAfterLabels: new Map(),
    strideNames: new Map(),
    moscowLabels: new Map(),
    statusLabels: new Map(),
  };
}

/**
 * Maps a loaded (migrated) Project to DocProjectData, in the shape the
 * generators (base-generator.ts and subclasses) expect.
 *
 * @param project - Fully migrated Project (see load-project.ts)
 * @param language - Document language (from --lang or
 *                   project.documentation.configuration.language)
 */
export function toDocProjectData(
  project: Project,
  language: DocLanguage,
): DocProjectData {
  return {
    id: project.id,
    name: project.info.name,
    phaseStatus: project.phaseStatus,
    lastModified: project.info.lastModified,

    info: project.info as DocProjectData["info"],
    dfd: project.dfd as DocProjectData["dfd"],
    assets: project.assets as DocProjectData["assets"],
    threats: project.threats as DocProjectData["threats"],
    risks: project.risks as DocProjectData["risks"],

    // Plural → singular! (see plan gotcha)
    attackTree: project.attackTrees as DocProjectData["attackTree"],

    computed: createEmptyComputedValues(language),

    documentation: project.documentation as DocProjectData["documentation"],
  };
}
