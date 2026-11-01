// The TARAflow draw.io shape libraries (features/dfd/shapes): the editable
// XML and the compressed JSON the editor loads (convert.cjs) stay in step;
// three data flow variants (curved, orthogonal, straight); id labels size
// horizontally to their text (autosize, no wrap).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

const DIR = join(process.cwd(), "src/features/dfd/shapes");
const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const xmlLib = (n: number) =>
  JSON.parse(readFileSync(join(DIR, `DFD_${n}.xml`), "utf-8").replace("<mxlibrary>", "").replace("</mxlibrary>", "")) as {
    xml: string;
    title: string;
  }[];
const jsonLib = (n: number) => JSON.parse(readFileSync(join(DIR, `DFD_${n}.json`), "utf-8")) as { xml: string; title: string }[];
const inflate = (b64: string) =>
  decodeURIComponent(inflateRawSync(Buffer.from(Buffer.from(b64, "base64").toString("binary"), "binary")).toString("utf-8"));

describe.each([1, 2])("shape library DFD_%i", (n) => {
  const entries = xmlLib(n);

  it("the JSON the editor loads is the XML, compressed (run convert.cjs after editing the XML)", () => {
    const json = jsonLib(n);
    expect(json.map((e) => e.title)).toEqual(entries.map((e) => e.title));
    json.forEach((e, i) => expect(inflate(e.xml)).toBe(unescape(entries[i].xml)));
  });

  it("three data flows: curved, orthogonal, straight", () => {
    const style = (title: string) => /type="dataflow"[^>]*>\s*<mxCell[^>]*style="([^"]*)"/.exec(unescape(entries.find((e) => e.title === title)!.xml))?.[1] ?? "";
    expect(style("Dataflow (curved)")).toContain("curved=1");
    expect(style("Dataflow (orthogonal)")).toContain("edgeStyle=orthogonalEdgeStyle");
    expect(style("Dataflow (straight)")).not.toContain("edgeStyle");
  });

  it("every element shape carries exactly one id label (boundaries and the legend none)", () => {
    const withoutId = new Set(["Trust Boundary", "Physical Boundary", "Chip Boundary", "Legend"]);
    for (const e of entries) {
      const xml = unescape(e.xml);
      expect(xml.match(/type="idlabel"/g)?.length ?? 0, e.title).toBe(withoutId.has(e.title) ? 0 : 1);
      // every attribute value closed — a broken type="…"X" hid an id label once
      expect(xml, e.title).not.toMatch(/="[^"]*"[A-Za-z]/);
    }
  });

  it("every id label sizes horizontally to its text: autosize, no word wrap", () => {
    for (const e of entries) {
      for (const m of unescape(e.xml).matchAll(/type="idlabel"[^>]*>\s*<mxCell[^>]*style="([^"]*)"/g)) {
        expect(m[1], e.title).toContain("autosize=1");
        expect(m[1], e.title).not.toContain("whiteSpace=wrap");
      }
    }
  });
});

describe("both libraries share the interface shape", () => {
  it("DFD_2's interface is DFD_1's", () => {
    const iface = (n: number) => xmlLib(n).find((e) => e.title === "Interface");
    expect(iface(2)).toEqual(iface(1));
  });
});
