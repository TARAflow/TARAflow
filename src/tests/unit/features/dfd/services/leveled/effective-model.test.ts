// Leveled-DFD Phase 2a — leaves and flow endpoint stitching
// (design §6.1, §6.2, §6.5).
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
  analysePageGeometry,
  buildEffectiveModel,
  buildPageTree,
  computeHomePages,
} from "features/dfd/services/leveled";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
  ref,
} from "../../../../../fixtures/leveled-dfd-xml";

function effective(xml: string, pages?: readonly DFDPage[]) {
  const parse = dfdParser.parse(xml, pages);
  const homePages = computeHomePages(parse.occurrences);
  const tree = buildPageTree({
    parsedPages: parse.pages,
    persistedPages: pages,
    elements: parse.elements,
    occurrences: parse.occurrences,
    homePages,
  });
  return buildEffectiveModel({
    elements: parse.elements,
    connections: parse.connections,
    occurrences: parse.occurrences,
    tree,
    homePages,
  });
}

const flowOf = (model: ReturnType<typeof effective>, tfId: string) =>
  model.flows.find((f) => f.tfId === tfId)!;

describe("buildEffectiveModel — the leveled excerpt", () => {
  const model = effective(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED_PAGES);

  it("replaces decomposed multiprocesses by their parts", () => {
    expect(model.elements.map((e) => e.tfId)).toEqual(["sen_p2", "ctl_p5"]);
    expect(Object.fromEntries(model.containmentParent)).toEqual({
      sen_p2: "mp1",
      ctl_p5: "mp2",
    });
  });

  it("stitches DF-7 to the deepest drawn endpoint on each side", () => {
    expect(flowOf(model, "df7")).toEqual({
      tfId: "df7",
      from: "sen_p2",
      to: "ctl_p5",
      state: "resolved",
    });
    expect(model.findings).toEqual([]);
  });

  it("does not depend on page order", () => {
    const reversed = effective(
      mxfile(CONTROLLER, SENSOR, SYSTEM),
      LEVELED_PAGES,
    );
    expect(reversed.flows).toEqual(model.flows);
  });
});

describe("buildEffectiveModel — classic single page", () => {
  it("keeps every element a leaf and every flow as drawn", () => {
    const model = effective(mxfile(SYSTEM));
    expect(model.elements.map((e) => e.tfId)).toEqual(["mp1", "mp2"]);
    expect(model.flows).toEqual([
      { tfId: "df7", from: "mp1", to: "mp2", state: "resolved" },
    ]);
    expect(model.containmentParent.size).toBe(0);
  });
});

describe("buildEffectiveModel — fallbacks are reported, never guessed", () => {
  it("unresolved: the flow is never drawn below a decomposed MP", () => {
    const controllerWithoutFlow = page(
      "ctl",
      "Controller Module",
      node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300),
    );
    const pages = LEVELED_PAGES.map((p) =>
      p.pageId === "ctl" ? { ...p, links: [ref("ctl_mp1", "mp1")] } : p,
    );
    const model = effective(
      mxfile(SYSTEM, SENSOR, controllerWithoutFlow),
      pages,
    );
    expect(flowOf(model, "df7")).toEqual({
      tfId: "df7",
      from: "sen_p2",
      to: "mp2",
      state: "fallback",
      fallbackReason: "unresolved",
      fallbackReasons: ["unresolved"],
    });
    expect(model.findings).toEqual([
      {
        code: "BAL_UNRESOLVED_ENDPOINT",
        tfId: "df7",
        side: "target",
        element: "mp2",
      },
    ]);
  });

  it("ambiguous: two siblings drawn as source fall back to their common parent", () => {
    // A second occurrence of DF-7 on Sensor Module, from P-3 instead of P-2.
    const sensorTwice = SENSOR.replace(
      "</root>",
      node("sen_p3", "process", "Check Sensor", "P-3", 10) +
        flow("sen_df7b", "stream sensor data", "DF-7", "sen_p3", "sen_mp2") +
        "</root>",
    );
    const pages = LEVELED_PAGES.map((p) =>
      p.pageId === "sen"
        ? { ...p, links: [...(p.links ?? []), ref("sen_df7b", "df7")] }
        : p,
    );
    const model = effective(mxfile(SYSTEM, sensorTwice, CONTROLLER), pages);
    expect(flowOf(model, "df7")).toMatchObject({
      from: "mp1",
      to: "ctl_p5",
      state: "fallback",
      fallbackReason: "ambiguous",
    });
    expect(model.findings).toEqual([
      {
        code: "BAL_DUPLICATE_OCCURRENCE",
        tfId: "df7",
        pageId: "sen",
        cellIds: ["sen_df7", "sen_df7b"],
      },
      {
        code: "BAL_AMBIGUOUS_ENDPOINT",
        tfId: "df7",
        side: "source",
        candidates: ["mp1", "sen_p2", "sen_p3"],
      },
    ]);
  });

  it("ambiguous without common ancestor: keeps the endpoint its definition draws", () => {
    // Sensor Module draws DF-7 from an external entity — not part of MP-1.
    const sensorFromEe = SENSOR.replace(
      'source="sen_p2" target="sen_mp2"',
      'source="sen_ee" target="sen_mp2"',
    ).replace(
      "</root>",
      node("sen_ee", "externalentity", "Debugger", "EE-1", 10) + "</root>",
    );
    expect(sensorFromEe).not.toBe(SENSOR);
    const model = effective(
      mxfile(SYSTEM, sensorFromEe, CONTROLLER),
      LEVELED_PAGES,
    );
    expect(flowOf(model, "df7")).toMatchObject({
      from: "mp1",
      state: "fallback",
      fallbackReason: "ambiguous",
    });
  });

  it("dangling: an endpoint without definition", () => {
    const pages = [{ ...LEVELED_PAGES[1], decomposes: undefined }];
    const model = effective(mxfile(SENSOR), pages);
    expect(flowOf(model, "df7")).toMatchObject({
      from: "sen_p2",
      to: "mp2",
      state: "fallback",
      fallbackReason: "dangling",
    });
    expect(model.elements.find((e) => e.tfId === "mp2")).toMatchObject({
      provenance: "dangling",
    });
    expect(model.findings).toContainEqual({
      code: "BAL_DANGLING_REF",
      kind: "element",
      tfId: "mp2",
    });
  });
});

describe("buildEffectiveModel — exclusions", () => {
  it("EE → EE is kept but excluded from threat generation", () => {
    const xml = mxfile(
      page(
        "sys",
        "System",
        node("ee4", "externalentity", "Site Wi-Fi Access Point", "EE-4", 10) +
          node("ee5", "externalentity", "Firmware Update Server", "EE-5", 300) +
          flow("df39", "relay update", "DF-39", "ee4", "ee5"),
      ),
    );
    const model = effective(xml);
    expect(flowOf(model, "df39")).toEqual({
      tfId: "df39",
      from: "ee4",
      to: "ee5",
      state: "excluded",
      excludedReason: "ee-to-ee",
    });
    expect(model.findings).toEqual([
      { code: "DFD_EE_TO_EE_FLOW", tfId: "df39" },
    ]);
  });

  it("excludeFromThreatGen on the flow excludes it", () => {
    const parse = dfdParser.parse(mxfile(SYSTEM));
    const homePages = computeHomePages(parse.occurrences);
    const model = buildEffectiveModel({
      elements: parse.elements,
      connections: parse.connections.map((c) => ({
        ...c,
        properties: { excludeFromThreatGen: true },
      })),
      occurrences: parse.occurrences,
      tree: buildPageTree({
        parsedPages: parse.pages,
        elements: parse.elements,
        occurrences: parse.occurrences,
        homePages,
      }),
      homePages,
    });
    expect(flowOf(model, "df7")).toMatchObject({
      state: "excluded",
      excludedReason: "excluded-by-property",
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 2b — interface chain (§6.2.1, D11) and boundaries (§6.3, D14)

function effective2b(xml: string, pages?: readonly DFDPage[]) {
  const parse = dfdParser.parse(xml, pages);
  const homePages = computeHomePages(parse.occurrences);
  const tree = buildPageTree({
    parsedPages: parse.pages,
    persistedPages: pages,
    elements: parse.elements,
    occurrences: parse.occurrences,
    homePages,
  });
  return buildEffectiveModel({
    elements: parse.elements,
    connections: parse.connections,
    occurrences: parse.occurrences,
    tree,
    homePages,
    pageGeometry: analysePageGeometry(parse.pageCells),
  });
}

/** A shape at x with the given type, without id label (boundaries carry [ID]). */
const shape = (
  id: string,
  type: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
) =>
  `<object label="${label}" type="${type}" id="${id}">
     <mxCell style="rounded=0;" vertex="1" parent="1">
       <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
     </mxCell>
   </object>`;

// Sensor Module with the RS-485 port on the module border, crossed by DF-7.
const SENSOR_WITH_PORT = SENSOR.replace(
  "</root>",
  shape("sen_if1", "interface", "RS-485", 300, 10, 60, 60) + "</root>",
);

describe("buildEffectiveModel — interface chain (2b)", () => {
  it("a port crossed on a child page belongs to the source side, level 1", () => {
    const model = effective2b(
      mxfile(SYSTEM, SENSOR_WITH_PORT, CONTROLLER),
      LEVELED_PAGES,
    );
    expect(flowOf(model, "df7").interfaces).toEqual([
      { tfId: "sen_if1", side: "source", level: 1 },
    ]);
  });

  it("on the root page an interface keeps today's single-page meaning (side none)", () => {
    const system = SYSTEM.replace(
      "</root>",
      shape("if0", "interface", "Bus", 200, 10, 60, 60) + "</root>",
    );
    const model = effective2b(mxfile(system));
    expect(flowOf(model, "df7").interfaces).toEqual([
      { tfId: "if0", side: "none", level: 0 },
    ]);
  });

  it("a crossing that belongs to neither side is reported, not guessed", () => {
    // Sensor Module draws DF-7 between two copies — nothing inside MP-1.
    const sensor = SENSOR_WITH_PORT.replace(
      'source="sen_p2" target="sen_mp2"',
      'source="sen_mp1x" target="sen_mp2"',
    ).replace(
      "</root>",
      node("sen_mp1x", "externalentity", "Debugger", "EE-1", 10) + "</root>",
    );
    const model = effective2b(
      mxfile(SYSTEM, sensor, CONTROLLER),
      LEVELED_PAGES,
    );
    expect(model.findings).toContainEqual({
      code: "BAL_INTERFACE_UNATTRIBUTED",
      tfId: "df7",
      interface: "sen_if1",
      pageId: "sen",
    });
    expect(flowOf(model, "df7").interfaces).toEqual([
      { tfId: "sen_if1", side: "none", level: 1 },
    ]);
  });
});

describe("buildEffectiveModel — boundaries (2b)", () => {
  // System: trust boundary SB and physical boundary CASE around MP-1.
  const system = SYSTEM.replace(
    "</root>",
    shape("sb", "trustboundary", "Sensor Board [SB]", 0, 0, 200, 100) +
      shape("case", "physicalboundary", "Case [CASE]", -10, -10, 220, 120) +
      "</root>",
  );
  // Sensor Module: the SB copy encloses P-2 but not the port on its border.
  const sensor = SENSOR_WITH_PORT.replace(
    "</root>",
    shape("sen_sb", "trustboundary", "Sensor Board [SB]", 0, 0, 200, 100) +
      "</root>",
  );
  const pages = LEVELED_PAGES.map((p) =>
    p.pageId === "sen"
      ? { ...p, links: [...(p.links ?? []), ref("sen_sb", "sb")] }
      : p,
  );
  const model = effective2b(mxfile(system, sensor, CONTROLLER), pages);
  const boundaries = (tfId: string) =>
    model.elements.find((e) => e.tfId === tfId)!.boundaries;

  it("a process inherits every boundary of its multiprocess", () => {
    expect(boundaries("sen_p2")).toEqual({
      trust: ["sb"],
      chip: [],
      physical: ["case"],
    });
  });

  it("an interface inherits physical and chip boundaries, not trust boundaries (D14)", () => {
    expect(boundaries("sen_if1")).toEqual({
      trust: [],
      chip: [],
      physical: ["case"],
    });
  });

  it("a dangling element takes the union over its copies, flagged provisional", () => {
    // Only Sensor Module left: MP-2 exists as a copy inside a wide SB copy.
    const wide = SENSOR_WITH_PORT.replace(
      "</root>",
      shape("sen_sb", "trustboundary", "Sensor Board [SB]", 0, 0, 700, 100) +
        "</root>",
    );
    const danglingModel = effective2b(mxfile(wide), [
      { ...pages[1], decomposes: undefined },
    ]);
    const mp2 = danglingModel.elements.find((e) => e.tfId === "mp2")!;
    expect(mp2.provenance).toBe("dangling");
    expect(mp2.boundaryProvenance).toBe("context-copies");
    expect(mp2.boundaries).toEqual({ trust: ["sb"], chip: [], physical: [] });
  });
});

describe("buildEffectiveModel — decomposition takes effect with the first part (D15)", () => {
  // Controller page created automatically, so far only a context copy.
  const controllerCopiesOnly = page(
    "ctl",
    "Controller Module",
    node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10),
  );
  const pages = LEVELED_PAGES.map((p) =>
    p.pageId === "ctl" ? { ...p, links: [ref("ctl_mp1", "mp1")] } : p,
  );
  const model = effective(mxfile(SYSTEM, SENSOR, controllerCopiesOnly), pages);

  it("keeps the multiprocess a leaf while its page has no part of its own", () => {
    expect(model.elements.map((e) => e.tfId)).toContain("mp2");
    expect(model.elements.map((e) => e.tfId)).not.toContain("mp1");
  });

  it("its flows end at the multiprocess, resolved — no fallback noise", () => {
    expect(flowOf(model, "df7")).toMatchObject({
      from: "sen_p2",
      to: "mp2",
      state: "resolved",
    });
    expect(
      model.findings.filter((f) => f.code === "BAL_UNRESOLVED_ENDPOINT"),
    ).toEqual([]);
  });
});
