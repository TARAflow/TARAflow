// Multi-project TARA I7 (4), phase 3d-2a (review 2026-11-08): the residual
// risk is credited by ONE derivation (app/services/doc-residual.ts →
// uncreditedResiduals) — the app's report transform and the CLI reporter
// must output the same: the same risk data (values before treatment where a
// component measure does not hold) and the same "not credited" note.
// (Default DOM environment: building the machine fixture parses draw.io XML.)

import { describe, it, expect } from "vitest";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import { transformProjectToDocData } from "../../../src/app/services/doc-transform";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import { PdfMakeConverter } from "../../../src/features/documentation/utils/generators/pdfmake-converter";
import { DEFAULT_DOC_CONFIGURATION } from "../../../src/features/documentation/models/doc-types";
import type { Project } from "../../../src/app/models/project-types";
import { parseAndRepair } from "../../../src/app/services/migration-service";
import { loadProjectFixture } from "../../../src/tests/fixtures/load-fixture";
import { component, machine, tid } from "../../../src/tests/fixtures/component-treatment-machine";

const stubT = (key: string, defaultValue?: string): string => defaultValue ?? key;

// A complete project (repaired fixture) carrying the machine's components, DFD and risks.
const project = (() => {
  const m = machine();
  const base = parseAndRepair(loadProjectFixture("Simple_Test_Project.tara.json")) as Project;
  return {
    ...base,
    components: m.components,
    dfd: { ...base.dfd!, elements: m.dfd!.elements, connections: m.dfd!.connections },
    risks: { ...m.risks!, risks: m.risks!.risks.map((r) => ({ ...r, calculatedRiskBeforeMitigation: 9, calculatedRiskAfterMitigation: 2 })) },
  } as Project;
})();
const blocked = project.risks!.risks.find((r) => r.threatId === tid(component.reduceThreat))!;

describe("credited residual: app report = CLI report", () => {
  const app = transformProjectToDocData(project, "en");
  const cli = toDocProjectData(project, "en");

  it("the same credited risk data and the same blockers", () => {
    expect(cli.risks).toEqual(app.risks);
    expect(cli.computed.uncreditedResiduals).toEqual(app.computed.uncreditedResiduals);
    expect([...(app.computed.uncreditedResiduals?.keys() ?? [])]).toEqual([blocked.id]);
    const r = app.risks!.risks.find((x) => x.id === blocked.id)!;
    expect(r.calculatedRiskAfterMitigation).toBe(9);
    // the project keeps its stored after-value
    expect(blocked.calculatedRiskAfterMitigation).toBe(2);
  });

  it("the same risk rows with the note, in Markdown and PDF", () => {
    const config = { ...DEFAULT_DOC_CONFIGURATION, format: "markdown" as const };
    const rows = (doc: typeof app) =>
      createCliGenerator(doc, config, stubT)
        .generate()
        .content.split("\n")
        .filter((l) => l.includes(blocked.threatDisplayId) && l.includes("|"))
        // id, threat, risk before, measures, risk after — the MoSCoW label is
        // not compared (the CLI fills no label cache, an older difference)
        .map((l) => l.split(" | ").slice(0, 5));
    const appRows = rows(app);
    expect(appRows.length).toBeGreaterThan(0);
    expect(rows(cli)).toEqual(appRows);
    expect(appRows.flat().join("\n")).toContain("Not credited: M-C-001 (SD1 · Smoke Detector): not implemented yet, ASM-01 open");
    const pdf = JSON.stringify(new PdfMakeConverter(cli, { ...DEFAULT_DOC_CONFIGURATION, format: "pdf" }, stubT).createDocumentDefinition({}));
    expect(pdf).toContain("Not credited: M-C-001 (SD1 · Smoke Detector)");
  });
});
