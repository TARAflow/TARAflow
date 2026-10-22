// Leveled-DFD Phase 7a/7b: the app's document preview converts the
// generated Markdown / AsciiDoc / StrictDoc to HTML with its own small
// converters. They render the page figures with their captions, the
// spacing between them and the nested decomposition tree.
import { describe, it, expect } from "vitest";
import {
  convertAsciiDocToHtml,
  convertMarkdownToHtml,
  convertStrictDocToHtml,
} from "features/documentation/services/doc-preview-converters";

const IMG = "data:image/svg+xml;base64,VE9Q";
const squash = (html: string) => html.replace(/\s*\n\s*/g, "");

describe("Markdown preview", () => {
  const md = [
    `![Data Flow Diagram](${IMG})`,
    "",
    '*Page "Top"*',
    "",
    "&nbsp;",
    "",
    "### Decomposition",
    "",
    "- Top — defined here: EE-1",
    "  - Sensor Head — defined here: P-1.1",
    "    - Optics — defined here: P-1.1.1",
    "  - Controller — defined here: P-3.1",
    "",
    "### DFD Statistics",
  ].join("\n");
  const html = squash(convertMarkdownToHtml(md));

  it("nests the decomposition tree by indentation", () => {
    expect(html).toContain(
      "<ul><li>Top — defined here: EE-1<ul><li>Sensor Head — defined here: P-1.1" +
        "<ul><li>Optics — defined here: P-1.1.1</li></ul></li><li>Controller — defined here: P-3.1</li></ul></li></ul>",
    );
    expect(html).not.toContain("  - ");
  });

  it("keeps the spacing paragraph and the caption", () => {
    expect(html).toContain("<p>&nbsp;</p>");
    expect(html).not.toContain("&amp;nbsp;");
    expect(html).toContain("<em>Page \"Top\"</em>");
  });
});

describe("AsciiDoc preview", () => {
  const adoc = [
    `.Page "Top"`,
    `image::${IMG}[Data Flow Diagram]`,
    "",
    "{nbsp}",
    "",
    `.Page "Optics"`,
    "_No image of this page is stored yet._",
    "",
    "* Top",
    "** Sensor Head",
  ].join("\n");
  const html = squash(convertAsciiDocToHtml(adoc));

  it("renders a titled image as a figure with caption", () => {
    expect(html).toContain(
      `<figure><img src="${IMG}" alt="Data Flow Diagram" /><figcaption>Page "Top"</figcaption></figure>`,
    );
    expect(html).not.toContain(".Page");
  });

  it("renders spacing and a block title without image", () => {
    expect(html).toContain("<p>&nbsp;</p>");
    expect(html).not.toContain("{nbsp}");
    expect(html).toContain('<p class="block-title"><em>Page "Optics"</em></p>');
  });
});

describe("StrictDoc preview", () => {
  const sdoc = [
    "[SECTION]",
    "TITLE: Data Flow Diagram",
    "",
    "[FREETEXT]",
    `.. figure:: ${IMG}`,
    "   :alt: Data Flow Diagram",
    "",
    '   Page "Top"',
    "",
    "|",
    "",
    "Decomposition:",
    "",
    "- Top — defined here: EE-1",
    "",
    "  - Sensor Head — defined here: P-1.1",
    "",
    "  - Controller",
    "[/FREETEXT]",
    "",
    "[/SECTION]",
  ].join("\n");
  const html = squash(convertStrictDocToHtml(sdoc));

  it("renders an RST figure with its caption", () => {
    expect(html).toContain(
      `<figure><img src="${IMG}" alt="Data Flow Diagram" /><figcaption>Page &quot;Top&quot;</figcaption></figure>`,
    );
    expect(html).not.toContain(":alt:");
  });

  it("renders the line block as spacing and the tree as one nested list", () => {
    expect(html).toContain("<p>&nbsp;</p>");
    expect(html).toContain(
      "<ul><li>Top — defined here: EE-1<ul><li>Sensor Head — defined here: P-1.1</li><li>Controller</li></ul></li></ul>",
    );
  });
});
