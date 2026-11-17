// @vitest-environment node
//
// The PDF generator in Node sets pdfmake's access policies (manual test
// 2026-11-17: pdfmake warned on every PDF that none was set). A report must
// not fetch a URL or read a local file a project puts into an image; only
// the generator's own font files are read.
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { generatePdfBufferNode } from "../../../src/features/documentation/utils/generators/pdf-generator-node";

const require = createRequire(import.meta.url);

describe("PDF generator (Node): pdfmake access policies", () => {
  it("no URL, no foreign file — the PDF is still written, without pdfmake's warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const buffer = await generatePdfBufferNode({ content: ["Hello"] });
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/access policy/);
    warn.mockRestore();

    const pdfmake = require("pdfmake");
    expect(pdfmake.urlAccessPolicy("https://example.com/x.png")).toBe(false);
    expect(pdfmake.localAccessPolicy("/etc/passwd")).toBe(false);
  });
});
