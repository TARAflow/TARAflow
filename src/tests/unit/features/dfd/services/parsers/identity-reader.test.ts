// Leveled-DFD Phase 1.2 — lazy identity attributes (design §5.2).
import { describe, it, expect } from "vitest";
import {
  collectCellIdentities,
  identityOf,
} from "features/dfd/services/parsers/identity-reader";
import { parseXmlString } from "features/dfd/services/parsers/xml-parser";

const model = (objects: string) =>
  parseXmlString(
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${objects}</root></mxGraphModel>`,
  );

const obj = (id: string, attrs = "") =>
  `<object label="X" type="process" id="${id}" ${attrs}><mxCell vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell></object>`;

describe("collectCellIdentities", () => {
  it("lists nothing for plain definitions (tfId = cell id)", () => {
    const ids = collectCellIdentities(model(obj("a") + obj("b")));
    expect(ids.size).toBe(0);
    expect(identityOf(ids, "a")).toEqual({ tfId: "a", role: "definition" });
  });

  it("reads a context copy", () => {
    const ids = collectCellIdentities(
      model(obj("sen_mp2", 'tfRole="ref" tfId="mp2"')),
    );
    expect(identityOf(ids, "sen_mp2")).toEqual({ tfId: "mp2", role: "ref" });
  });

  it("reads a definition with an explicit tfId", () => {
    const ids = collectCellIdentities(model(obj("new_cell", 'tfId="mp2"')));
    expect(identityOf(ids, "new_cell")).toEqual({
      tfId: "mp2",
      role: "definition",
    });
  });

  it("does not list a definition whose tfId equals its cell id", () => {
    const ids = collectCellIdentities(model(obj("a", 'tfId="a"')));
    expect(ids.size).toBe(0);
  });

  it("treats a ref without tfId as a plain definition (never guessed into a merge)", () => {
    const ids = collectCellIdentities(
      model(obj("c", 'tfRole="ref"') + obj("d", 'tfRole="ref" tfId="  "')),
    );
    expect(identityOf(ids, "c")).toEqual({ tfId: "c", role: "definition" });
    expect(identityOf(ids, "d")).toEqual({ tfId: "d", role: "definition" });
  });

  it("ignores unknown tfRole values", () => {
    const ids = collectCellIdentities(
      model(obj("e", 'tfRole="copy" tfId="mp1"')),
    );
    expect(identityOf(ids, "e")).toEqual({ tfId: "mp1", role: "definition" });
  });

  it("maps cells it does not know (e.g. bare mxCells) to themselves", () => {
    const ids = collectCellIdentities(model(""));
    expect(identityOf(ids, "edge-7")).toEqual({
      tfId: "edge-7",
      role: "definition",
    });
  });
});
