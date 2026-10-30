// @vitest-environment node
//
// The PDF (pdfmake) has the same chapters as the template formats. Found
// 2026-10-30: the CLI PDF dropped six enabled chapters — applicable
// regulations, methodology, DFD element descriptions, asset-element
// relations, attack-path threat scenarios, traceability matrix — and its
// table of contents checked outdated chapter ids. The six chapters now render
// from the same data (report-chapter-data.ts); the TOC lists exactly the
// chapters that have content.

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import path from "path";
import { loadProject } from "../../cli/load-project";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import { resolveCliChapters } from "../../cli/resolve-chapters";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import { PdfMakeConverter } from "../../../src/features/documentation/utils/generators/pdfmake-converter";
import { setProjectMitigations } from "../../../src/shared/services/project-mitigation-registry";
import { DEFAULT_DOC_CONFIGURATION, type DocConfiguration } from "../../../src/features/documentation/models/doc-types";
import type { Project } from "../../../src/app/models/project-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, "../../../src/tests/fixtures", name);
const stubT = (key: string, defaultValue?: string): string => defaultValue ?? key;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** The ISO fixture with what a 0.16 project adds: a goal, a project mitigation on a risk. */
function withConceptAndProjectMitigation(project: Project): Project {
  const p = project as Any;
  const risk = p.risks.risks[0];
  p.threats ??= { perElementTables: [], perInteractionTables: [] };
  p.threats.configuration = { ...(p.threats.configuration ?? {}) };
  p.threats.configuration.customMitigations = [
    { id: "M-C-001", text: "Own control from the project catalog", strideCategory: "S", context: {}, isCustom: true, affectsProperties: [] },
  ];
  risk.selectedMitigations = [...(risk.selectedMitigations ?? []), { id: "M-C-001", status: "open" }];
  p.cybersecurityConcept = {
    goals: [{ id: "g1", displayId: "CSG-01", statement: "Protect the lamp request", riskIds: [risk.id], assetProperties: [] }],
    claims: [],
    verifications: [],
  };
  return p;
}

async function chaptersOf(file: string, adapt: (p: Project) => Project = (p) => p) {
  const { project: loaded } = await loadProject(fixture(file));
  const project = adapt(loaded);
  setProjectMitigations(project.threats?.configuration?.customMitigations);
  const base = project.documentation?.configuration ?? DEFAULT_DOC_CONFIGURATION;
  const config: DocConfiguration = { ...base, language: "en", chapters: resolveCliChapters(base.chapters, undefined) };
  const doc = toDocProjectData(project, "en");

  const markdown = createCliGenerator(doc, { ...config, format: "markdown" }, stubT).generate().content;
  const mdChapters = markdown
    .split("\n")
    .filter((l) => l.startsWith("## ") && l !== "## Table of Contents")
    .map((l) => l.slice(3).trim());

  const def = new PdfMakeConverter(doc, { ...config, format: "pdf" }, stubT).createDocumentDefinition({});
  const content = def.content as Any[];
  const pdfChapters = content.filter((n) => n?.style === "h1" && n.tocItem !== false).map((n) => n.text as string);
  const toc = content.filter((n) => n?.style === "tocItem").map((n) => n.text as string);
  setProjectMitigations(undefined);
  return { mdChapters, pdfChapters, toc, pdfText: JSON.stringify(def) };
}

describe("PDF chapters = template chapters", () => {
  it.each(["Simple_Test_Project.tara.json", "SmokeDetector.tara.json", "cnc-ref.tara.json"])(
    "%s: same chapters in the same order; the TOC lists exactly them",
    async (file) => {
      const { mdChapters, pdfChapters, toc } = await chaptersOf(file);
      expect(pdfChapters).toEqual(mdChapters);
      expect(toc).toEqual(pdfChapters);
    },
  );

  it("ISO/SAE 21434 project: methodology, threat scenarios, traceability, goals and claims; project mitigation text", async () => {
    const { mdChapters, pdfChapters, toc, pdfText } = await chaptersOf("headlamp-iso21434.tara.json", withConceptAndProjectMitigation);
    expect(pdfChapters).toEqual(mdChapters);
    expect(toc).toEqual(pdfChapters);
    expect(pdfChapters).toEqual(
      expect.arrayContaining([
        "Applicable Regulations",
        "Methodology",
        "Threat Scenarios (Attack Path)",
        "Traceability Matrix (ISO/SAE 21434)",
        "Cybersecurity Goals and Claims",
      ]),
    );
    expect(pdfText).toContain("Own control from the project catalog");
    expect(pdfText).not.toContain("M-C-001.mitigation");
  });
});
