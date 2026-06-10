// ==================== DOCUMENT PREVIEW CONVERTERS ====================
// HTML conversion utilities for document format previews.
// Location: features/documentation/utils/doc-preview-converters.ts
//
// Each converter takes raw format content and returns an HTML string
// suitable for dangerouslySetInnerHTML rendering.
//
// Converters are intentionally lightweight — no external dependencies.
// For production-quality rendering consider:
//   Markdown  → react-markdown + remark-gfm
//   AsciiDoc  → asciidoctor.js
//   StrictDoc → server-side strictdoc export endpoint

const DOC_TABLE_STYLE = `<style>
table.doc-table { border-collapse: collapse; width: 100%; margin: 1em 0; }
table.doc-table th, table.doc-table td {
  border: 1px solid #cbd5e1; padding: 6px 10px;
  text-align: left; vertical-align: top;
}
table.doc-table th { background: #f1f5f9; font-weight: 600; }
table.doc-table tr:nth-child(even) td { background: #f8fafc; }
</style>`;

/**
 * Split a pipe-delimited table row, keeping empty interior cells.
 * Markdown rows have a trailing pipe (stripTrailing = true); AsciiDoc rows don't.
 */
function splitTableRow(line: string, stripTrailing: boolean): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (stripTrailing && s.endsWith("|")) s = s.slice(0, -1);
  // Split on unescaped pipes, then unescape \| → | (full-text cells may contain pipes).
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

// ==================== MARKDOWN ====================

export function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first (but preserve our own tags)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore anchor tags that were escaped (from threat table)
  html = html.replace(/&lt;a id="([^"]+)"&gt;&lt;\/a&gt;/g, '<a id="$1"></a>');

  // Restore intentional <br> line breaks (e.g. multi-line table cells)
  html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br>");

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");
  html = html.replace(/^\*\*\*+$/gm, "<hr>");

  // Bold and Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links (including internal anchor links)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Tables
  html = convertMarkdownTables(html);

  // Lists (unordered)
  html = convertMarkdownLists(html);

  // Paragraphs
  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<")) return block;
      if (block.match(/^\|/)) return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");

  return DOC_TABLE_STYLE + html;
}

function convertMarkdownTables(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
    } else {
      if (inTable) {
        result.push(convertMarkdownTableRows(tableRows));
        inTable = false;
        tableRows = [];
      }
      result.push(line);
    }
  }

  if (inTable) {
    result.push(convertMarkdownTableRows(tableRows));
  }

  return result.join("\n");
}

function convertMarkdownTableRows(rows: string[]): string {
  if (rows.length < 2) return rows.join("\n");

  let html = '<table class="doc-table">\n<thead>\n<tr>\n';
  for (const cell of splitTableRow(rows[0], true)) {
    html += `<th>${cell}</th>\n`;
  }
  html += "</tr>\n</thead>\n<tbody>\n";

  // rows[1] is the separator (|---|---|) → skip, start at 2.
  for (let i = 2; i < rows.length; i++) {
    html += "<tr>\n";
    for (const cell of splitTableRow(rows[i], true)) {
      html += `<td>${cell}</td>\n`;
    }
    html += "</tr>\n";
  }

  html += "</tbody>\n</table>";
  return html;
}

function convertMarkdownLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*] (.+)$/);
    if (bulletMatch) {
      if (!inList) {
        result.push("<ul>");
        inList = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
    } else {
      if (inList) {
        result.push("</ul>");
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) result.push("</ul>");

  return result.join("\n");
}

// ==================== ASCIIDOC ====================

export function convertAsciiDocToHtml(asciidoc: string): string {
  let html = asciidoc;

  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Classification badge — before bold/italic
  html = html.replace(
    /^\[\.(public|internal|confidential|restricted)\]\n\*(.+)\*$/gm,
    '<span class="classification">$2</span>',
  );

  // Anchors and cross-references
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<a id="$1"></a>');
  html = html.replace(
    /&lt;&lt;([^,&]+),([^&]+)&gt;&gt;/g,
    '<a href="#$1">$2</a>',
  );
  html = html.replace(/&lt;&lt;([^&]+)&gt;&gt;/g, '<a href="#$1">$1</a>');

  // Restore intentional <br> line breaks (e.g. multi-line table cells)
  html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br>");

  // Document title and section headers
  html = html.replace(/^= (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^==== (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^=== (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^== (.+)$/gm, "<h2>$1</h2>");

  // Skip AsciiDoc attribute lines (:toc:, :sectnums: etc.)
  html = html.replace(/^:.+$/gm, "");

  // Lists — must run BEFORE bold/italic, otherwise the leading "* " / "** "
  // bullet markers get consumed by the *bold* regex.
  html = convertAsciiDocLists(html);

  // Bold and Italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Monospace
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Admonitions
  html = html.replace(
    /^WARNING: (.+)$/gm,
    '<div class="warning"><strong>⚠️ Warning:</strong> $1</div>',
  );

  // Images
  html = html.replace(
    /^image::([^\[]+)\[([^\]]*)\]/gm,
    '<img src="$1" alt="$2" />',
  );

  // Horizontal rule
  html = html.replace(/^'''$/gm, "<hr>");

  // Tables
  html = convertAsciiDocTables(html);

  // Lead paragraph
  html = html.replace(
    /^\[\.lead\]\n(.+)$/gm,
    '<p class="lead"><em>$1</em></p>',
  );

  // Paragraphs
  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<")) return block;
      if (block.startsWith("|===")) return block;
      if (block.startsWith("[")) return block;
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");

  return DOC_TABLE_STYLE + html;
}

function convertAsciiDocLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let depth = 0; // number of currently open <ul> levels (0 = not in a list)

  const closeTo = (target: number) => {
    while (depth > target) {
      result.push("</ul>");
      depth--;
    }
  };

  for (const line of lines) {
    // Nesting level = count of leading asterisks ("*" = 1, "**" = 2, …),
    // followed by whitespace. A "*" with no space (e.g. *bold*) is NOT a bullet.
    const m = line.match(/^(\*+)\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      while (depth < level) {
        result.push("<ul>");
        depth++;
      }
      closeTo(level);
      result.push(`<li>${m[2]}</li>`);
    } else {
      closeTo(0);
      result.push(line);
    }
  }

  closeTo(0);
  return result.join("\n");
}

function convertAsciiDocTables(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let hasHeader = false;

  for (const line of lines) {
    if (line.includes("[cols=") && line.includes('options="header"')) {
      hasHeader = true;
      continue;
    }
    if (line.includes("[cols=")) {
      hasHeader = true;
      continue;
    }
    if (line.trim() === "|===") {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      } else {
        result.push(convertAsciiDocTableRows(tableRows, hasHeader));
        inTable = false;
        tableRows = [];
        hasHeader = false;
      }
      continue;
    }
    if (inTable) {
      if (line.trim()) tableRows.push(line);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function convertAsciiDocTableRows(rows: string[], hasHeader: boolean): string {
  if (rows.length === 0) return "";

  let html = '<table class="doc-table">\n';
  let bodyOpen = false;

  rows.forEach((line, idx) => {
    const isHeader = hasHeader && idx === 0;
    const cells = splitTableRow(line, false);

    if (isHeader) {
      html += "<thead>\n" + renderTableRow(cells, true) + "</thead>\n";
    } else {
      if (!bodyOpen) {
        html += "<tbody>\n";
        bodyOpen = true;
      }
      html += renderTableRow(cells, false);
    }
  });

  if (bodyOpen) html += "</tbody>\n";
  html += "</table>";
  return html;
}

function renderTableRow(cells: string[], isHeader: boolean): string {
  const tag = isHeader ? "th" : "td";
  let html = "<tr>\n";
  for (const cell of cells) {
    html += `<${tag}>${cell}</${tag}>\n`;
  }
  html += "</tr>\n";
  return html;
}

// ==================== STRICTDOC ====================
//
// StrictDoc .sdoc is a structural format — not rendered by a browser natively.
// This converter produces a readable HTML representation that mirrors how
// StrictDoc itself renders documents: sections as collapsible headings,
// [REQUIREMENT] nodes as styled cards with their fields, [FREETEXT] blocks
// as prose, and RST list-tables as HTML tables.
//
// The converter is intentionally a preview — it does not implement the full
// StrictDoc grammar (no GRAMMAR block rendering, no relation graph, no TOC).

export function convertStrictDocToHtml(sdoc: string): string {
  const lines = sdoc.split("\n");
  const output: string[] = [];

  // Parser state
  let i = 0;

  // Skip the GRAMMAR block entirely — it's tooling metadata, not content.
  // Also skip the DOCUMENT block header line but extract the TITLE.
  let documentTitle = "";

  while (i < lines.length) {
    const line = lines[i];

    // ---- [DOCUMENT] block ----
    if (line.trim() === "[DOCUMENT]") {
      i++;
      while (i < lines.length && !isBlockStart(lines[i])) {
        const titleMatch = lines[i].match(/^TITLE:\s*(.+)$/);
        if (titleMatch) documentTitle = esc(titleMatch[1].trim());
        // VERSION, DATE etc. are silently consumed
        i++;
      }
      if (documentTitle) {
        output.push(`<h1 class="sdoc-doc-title">${documentTitle}</h1>`);
      }
      continue;
    }

    // ---- [GRAMMAR] block — skip entirely ----
    if (line.trim() === "[GRAMMAR]") {
      i++;
      // Skip until the next top-level block tag or EOF
      while (i < lines.length && !isBlockStart(lines[i])) {
        i++;
      }
      continue;
    }

    // ---- [SECTION] ----
    if (line.trim() === "[SECTION]") {
      i++;
      let sectionTitle = "";
      while (i < lines.length && !isBlockStart(lines[i])) {
        const m = lines[i].match(/^TITLE:\s*(.+)$/);
        if (m) sectionTitle = esc(m[1].trim());
        i++;
      }
      // Derive an anchor id from the "displayId: ..." title prefix so the
      // element overview can link to it (#element-<displayId>).
      const anchorId = sectionTitle.includes(":")
        ? "element-" + sectionTitle.split(":")[0].trim()
        : "";
      output.push(
        `<h2 class="sdoc-section"${anchorId ? ` id="${anchorId}"` : ""}>${sectionTitle}</h2>`,
      );
      continue;
    }

    // ---- [/SECTION] — structural close, no visual output ----
    if (line.trim() === "[/SECTION]") {
      i++;
      continue;
    }

    // ---- [FREETEXT] ... [/FREETEXT] ----
    if (line.trim() === "[FREETEXT]") {
      i++;
      const freetextLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "[/FREETEXT]") {
        freetextLines.push(lines[i]);
        i++;
      }
      i++; // consume [/FREETEXT]
      output.push(convertFreetextBlock(freetextLines));
      continue;
    }

    // ---- [REQUIREMENT] ----
    if (line.trim() === "[REQUIREMENT]") {
      i++;
      const fields: Array<{ key: string; value: string }> = [];
      const relationLines: string[] = [];
      let inRelations = false;

      while (i < lines.length && !isBlockStart(lines[i])) {
        const fieldLine = lines[i];

        // RELATIONS block starts with "RELATIONS:"
        if (fieldLine.trim() === "RELATIONS:") {
          inRelations = true;
          i++;
          continue;
        }
        if (inRelations) {
          if (fieldLine.match(/^- TYPE:/) || fieldLine.match(/^  VALUE:/)) {
            relationLines.push(fieldLine.trim());
          } else if (fieldLine.trim() === "") {
            inRelations = false;
          }
          i++;
          continue;
        }

        const m = fieldLine.match(/^([A-Z_]+):\s*(.+)$/);
        if (m) {
          fields.push({ key: m[1].trim(), value: esc(m[2].trim()) });
        }
        i++;
      }

      output.push(renderRequirementCard(fields, relationLines));
      continue;
    }

    // ---- [TEXT] — treated like a lightweight FREETEXT ----
    if (line.trim() === "[TEXT]") {
      i++;
      const textLines: string[] = [];
      while (i < lines.length && !isBlockStart(lines[i])) {
        textLines.push(lines[i]);
        i++;
      }
      output.push(convertFreetextBlock(textLines));
      continue;
    }

    // ---- Comment lines (// ...) — skip ----
    if (line.trim().startsWith("//")) {
      i++;
      continue;
    }

    // ---- Empty line or unknown — skip ----
    i++;
  }

  return output.join("\n");
}

// ---- Helpers ----

/** Returns true if the line starts a new top-level sdoc block. */
function isBlockStart(line: string): boolean {
  return /^\[(DOCUMENT|GRAMMAR|SECTION|\/SECTION|FREETEXT|\/FREETEXT|REQUIREMENT|TEXT)\]/.test(
    line.trim(),
  );
}

/** Escape HTML entities for safe insertion. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert a [FREETEXT] body to HTML.
 * Handles:
 *   - RST list-table (.. list-table::) → <table>
 *   - RST image directive (.. image::)  → <img>
 *   - Markdown-style bold (**text**)    → <strong>
 *   - Bullet lists (- item)             → <ul>
 *   - Plain paragraphs
 */
function convertFreetextBlock(lines: string[]): string {
  if (lines.length === 0) return "";

  // Join and work line by line for RST blocks
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // RST list-table directive
    if (line.trim().startsWith(".. list-table::")) {
      const { html, consumed } = convertRstListTable(lines, i);
      output.push(html);
      i += consumed;
      continue;
    }

    // RST image directive
    if (line.trim().startsWith(".. image::")) {
      const m = line.trim().match(/\.\. image::\s*(.+)/);
      if (m) {
        // Look ahead for :alt: option
        let alt = "";
        let j = i + 1;
        while (j < lines.length && lines[j].match(/^\s+:/)) {
          const altM = lines[j].match(/^\s+:alt:\s*(.+)/);
          if (altM) alt = esc(altM[1].trim());
          j++;
        }
        output.push(`<img src="${esc(m[1].trim())}" alt="${alt}" />`);
        i = j;
      } else {
        i++;
      }
      continue;
    }

    // Collect a paragraph or list block
    const blockLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].trim().startsWith(".. ") &&
      lines[i].trim() !== ""
    ) {
      blockLines.push(lines[i]);
      i++;
    }

    if (blockLines.length > 0) {
      output.push(convertFreetextParagraph(blockLines));
    } else {
      i++; // skip blank line
    }
  }

  return `<div class="sdoc-freetext">${output.join("\n")}</div>`;
}

/**
 * Convert a block of non-directive freetext lines to HTML.
 * Handles bullet lists and plain paragraphs with inline markup.
 */
function convertFreetextParagraph(lines: string[]): string {
  // Check if it's a bullet list
  const isList = lines.some((l) => l.match(/^[-*]\s+/));
  if (isList) {
    const items = lines
      .filter((l) => l.match(/^[-*]\s+/))
      .map((l) => `<li>${inlineMarkup(l.replace(/^[-*]\s+/, ""))}</li>`);
    return `<ul>${items.join("")}</ul>`;
  }

  const text = lines.map(inlineMarkup).join("<br>");
  return `<p>${text}</p>`;
}

/** Apply inline markup: [text](url), **bold**, *italic*, `code`. */
function inlineMarkup(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/**
 * Convert an RST list-table block to an HTML table.
 *
 * RST list-table format:
 *   .. list-table::
 *      :header-rows: 1
 *      :widths: 10 20 70
 *
 *      * - Col A
 *        - Col B
 *      * - Cell 1
 *        - Cell 2
 *
 * Returns { html, consumed } where consumed = number of lines processed.
 */
function convertRstListTable(
  lines: string[],
  start: number,
): { html: string; consumed: number } {
  let i = start + 1; // skip the ".. list-table::" line
  let headerRows = 0;

  // Parse options (lines starting with whitespace + ":")
  while (i < lines.length && lines[i].match(/^\s+:/)) {
    const m = lines[i].match(/^\s+:header-rows:\s*(\d+)/);
    if (m) headerRows = parseInt(m[1], 10);
    i++;
  }

  // Skip blank line after options
  while (i < lines.length && lines[i].trim() === "") i++;

  // Parse rows: each row starts with "   * -"
  const rows: string[][] = [];
  let currentRow: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // New row
    if (line.match(/^\s+\*\s+-\s*/)) {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [inlineMarkup(esc(line.replace(/^\s+\*\s+-\s*/, "").trim()))];
      i++;
      continue;
    }
    // Continuation cell in same row
    if (line.match(/^\s+-\s+/)) {
      currentRow.push(inlineMarkup(esc(line.replace(/^\s+-\s+/, "").trim())));
      i++;
      continue;
    }
    // Empty line or non-indented line = end of table
    if (line.trim() === "" || !line.match(/^\s/)) break;

    i++;
  }

  if (currentRow.length > 0) rows.push(currentRow);

  // Render HTML table
  let html = '<table class="sdoc-table">\n';
  rows.forEach((row, idx) => {
    const isHeader = idx < headerRows;
    const tag = isHeader ? "th" : "td";
    if (isHeader && idx === 0) html += "<thead>\n";
    if (!isHeader && idx === headerRows) html += "<tbody>\n";
    html += "<tr>" + row.map((cell) => `<${tag}>${cell}</${tag}>`).join("") + "</tr>\n";
    if (isHeader && idx === headerRows - 1) html += "</thead>\n";
  });
  if (rows.length > headerRows) html += "</tbody>\n";
  html += "</table>";

  return { html, consumed: i - start };
}

/**
 * Render a [REQUIREMENT] node as an HTML card.
 * UID and TITLE form the card header; other fields are listed in a grid;
 * STATEMENT gets prominent display; parent RELATIONS are shown as badges.
 */
function renderRequirementCard(
  fields: Array<{ key: string; value: string }>,
  relationLines: string[],
): string {
  const get = (key: string) => fields.find((f) => f.key === key)?.value ?? "";

  const uid = get("UID");
  const title = get("TITLE");
  const statement = get("STATEMENT");
  const status = get("STATUS");
  const priority = get("PRIORITY");
  const stride = get("STRIDE");
  const riskBefore = get("RISK_BEFORE") || get("RISIKO_VORHER");
  const riskAfter = get("RISK_AFTER") || get("RISIKO_NACHHER");
  const mitigation = get("MITIGATION");
  const verification = get("VERIFICATION") || get("VERIFIKATION");
  const justification = get("JUSTIFICATION") || get("BEGRUENDUNG");

  // Parent relations from RELATIONS block
  const parents: string[] = [];
  for (let i = 0; i < relationLines.length; i++) {
    if (
      relationLines[i].startsWith("- TYPE: Parent") &&
      i + 1 < relationLines.length
    ) {
      const valM = relationLines[i + 1].match(/VALUE:\s*(.+)/);
      if (valM) parents.push(esc(valM[1].trim()));
    }
  }

  // Badge colour per STRIDE category
  const strideBadgeColor: Record<string, string> = {
    S: "#1976d2",
    T: "#d32f2f",
    R: "#7b1fa2",
    I: "#0288d1",
    D: "#e64a19",
    E: "#388e3c",
  };
  const strideColor = strideBadgeColor[stride] ?? "#555";

  // Status colour
  const statusColor: Record<string, string> = {
    Open: "#e65100",
    Offen: "#e65100",
    "In Progress": "#f57c00",
    "In Bearbeitung": "#f57c00",
    Completed: "#2e7d32",
    Abgeschlossen: "#2e7d32",
    Accepted: "#546e7a",
    Akzeptiert: "#546e7a",
  };
  const statusColor_ = statusColor[status] ?? "#555";

  // Priority colour (MoSCoW)
  const priorityColor: Record<string, string> = {
    Must: "#c62828",
    Should: "#ef6c00",
    Could: "#1565c0",
    Wont: "#546e7a",
  };
  const priorityColor_ = priorityColor[priority] ?? "#555";

  // Risk colour
  const riskColor = (r: string) =>
    ({ Critical: "#c62828", Kritisch: "#c62828", High: "#d84315", Hoch: "#d84315", Medium: "#f57c00", Mittel: "#f57c00" })[r] ?? "#555";

  const badge = (text: string, color: string) =>
    text
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;background:${color};color:#fff;font-size:0.75rem;font-weight:600;margin-right:4px">${text}</span>`
      : "";

  const fieldRow = (label: string, value: string) =>
    value
      ? `<tr><td style="color:#666;font-size:0.8rem;padding:3px 8px 3px 0;white-space:nowrap;vertical-align:top">${label}</td><td style="font-size:0.85rem;padding:3px 0">${value}</td></tr>`
      : "";

  const parentBadges = parents
    .map(
      (p) =>
        `<a href="#req-${p}" style="display:inline-block;padding:2px 8px;border-radius:3px;background:#e3f2fd;color:#1565c0;font-size:0.75rem;font-weight:500;margin-right:4px;text-decoration:none">⬆ ${p}</a>`,
    )
    .join("");

  return `
<div id="req-${uid}" style="border:1px solid #e0e0e0;border-left:4px solid ${strideColor || "#1976d2"};border-radius:4px;padding:12px 16px;margin:12px 0;background:#fafafa">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
    <span style="font-family:monospace;font-size:0.85rem;font-weight:700;color:#333">${uid}</span>
    ${stride ? badge(stride, strideColor) : ""}
    ${status ? badge(status, statusColor_) : ""}
    ${priority ? badge(priority, priorityColor_) : ""}
    ${riskBefore ? badge(`Before: ${riskBefore}`, riskColor(riskBefore)) : ""}
    ${riskAfter ? badge(`After: ${riskAfter}`, riskColor(riskAfter)) : ""}
  </div>
  ${title ? `<div style="font-weight:600;margin-bottom:8px;font-size:0.95rem">${title}</div>` : ""}
  ${statement ? `<div style="margin-bottom:10px;font-size:0.9rem;line-height:1.5">${statement}</div>` : ""}
  ${
    mitigation || verification || justification
      ? `<table style="width:100%;border-collapse:collapse;margin-top:4px">
          ${fieldRow("Mitigation", mitigation)}
          ${fieldRow("Verification", verification)}
          ${fieldRow("Justification", justification)}
        </table>`
      : ""
  }
  ${parentBadges ? `<div style="margin-top:8px">${parentBadges}</div>` : ""}
</div>`;
}