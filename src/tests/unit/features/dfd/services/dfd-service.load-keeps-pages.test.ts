// Loading a leveled DFD into the editor kept only some of its fields: it
// replaced project.dfd by a new object without `pages` (and the thumbnail…).
// The object is the DFD tab's project — its validation then ran against no
// page tree and offered "Adopt pages" for every page, and the save refused,
// so the tab stayed on that state (2026-11-14: after every project switch
// back to a machine with an imported component).
import { describe, expect, it } from "vitest";
import { dfdService } from "features/dfd/services/dfd-service";
import { CONTROLLER, LEVELED_PAGES, SENSOR, SYSTEM, mxfile } from "../../../../fixtures/leveled-dfd-xml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const project = (): Any => ({
  id: "machine",
  name: "Machine",
  phaseStatus: {},
  lastModified: "",
  knownAssets: [],
  dfd: {
    xml: mxfile(SYSTEM, SENSOR, CONTROLLER),
    pages: LEVELED_PAGES,
    thumbnail: "data:image/svg+xml;base64,AAAA",
    elements: [],
    connections: [],
    assets: [],
  },
});

describe("loadDFDForEditing", () => {
  it("keeps the page tree and the other fields of dfd; the validation sees the pages adopted", () => {
    const p = project();
    const loaded = dfdService.loadDFDForEditing(p);
    expect(loaded.success).toBe(true);
    expect(p.dfd.pages).toEqual(LEVELED_PAGES);
    expect(p.dfd.thumbnail).toBe("data:image/svg+xml;base64,AAAA");
    const keys = dfdService.validateCurrentState(p).errors.map((e: Any) => e.key);
    expect(keys).not.toContain("dfdValidation.leveled.ID_ADOPTION_PENDING");
  });
});
