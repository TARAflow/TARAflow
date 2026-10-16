// Leveled-DFD Phase 2a — leaves and flow endpoint stitching
// (design §6.1, §6.2, §6.5).
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import {
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
