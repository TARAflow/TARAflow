// ==================== DOCUMENTATION PREVIEW ====================
// Renders Markdown or AsciiDoc content for preview
// Uses simple HTML rendering for both formats
// Note: For production, consider adding react-markdown or asciidoctor.js

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Paper } from "@mui/material";
import type { DocFormat, DocLanguage } from "../models/doc-types";

// ==================== TYPES ====================

interface DocPreviewProps {
  content: string;
  format: DocFormat;
  language: DocLanguage;
}

// ==================== COMPONENT ====================

export const DocPreview: React.FC<DocPreviewProps> = ({
  content,
  format,
  language,
}) => {
  const { t } = useTranslation();

  // Convert content to HTML for preview
  const htmlContent = useMemo(() => {
    if (!content) return "";

    // HTML and PDF already contain HTML - use directly
    if (format === "html" || format === "pdf") {
      return content;
    }

    // Convert Markdown and AsciiDoc to HTML
    if (format === "markdown") {
      return convertMarkdownToHtml(content);
    } else if (format === "asciidoc") {
      return convertAsciiDocToHtml(content);
    }

    // Fallback
    return content;
  }, [content, format]);

  if (!content) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "text.secondary",
        }}
      >
        <Typography>
          {t("tabs.doc.noContent", {
            defaultValue: "No content generated yet",
          })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        overflow: "auto",
        backgroundColor: "#fff",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 900,
          mx: "auto",
          my: 3,
          p: 4,
          minHeight: "calc(100% - 48px)",
        }}
      >
        <Box
          className="doc-preview"
          sx={{
            fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            lineHeight: 1.6,
            color: "#333",

            // Headers
            "& h1": {
              fontSize: "2rem",
              fontWeight: 500,
              borderBottom: "2px solid #1976d2",
              paddingBottom: "0.5rem",
              marginBottom: "1.5rem",
              marginTop: 0,
            },
            "& h2": {
              fontSize: "1.5rem",
              fontWeight: 500,
              borderBottom: "1px solid #e0e0e0",
              paddingBottom: "0.3rem",
              marginTop: "2rem",
              marginBottom: "1rem",
            },
            "& h3": {
              fontSize: "1.25rem",
              fontWeight: 500,
              marginTop: "1.5rem",
              marginBottom: "0.75rem",
            },
            "& h4": {
              fontSize: "1.1rem",
              fontWeight: 500,
              marginTop: "1rem",
              marginBottom: "0.5rem",
            },

            // Paragraphs
            "& p": {
              marginTop: 0,
              marginBottom: "1rem",
            },

            // Blockquotes
            "& blockquote": {
              borderLeft: "4px solid #1976d2",
              margin: "1rem 0",
              padding: "0.5rem 1rem",
              backgroundColor: "#f5f5f5",
              "& p": {
                marginBottom: 0,
              },
            },

            // Tables
            "& table": {
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
            },
            "& th, & td": {
              border: "1px solid #e0e0e0",
              padding: "0.5rem 0.75rem",
              textAlign: "left",
            },
            "& th": {
              backgroundColor: "#f5f5f5",
              fontWeight: 600,
            },
            "& tr:nth-of-type(even)": {
              backgroundColor: "#fafafa",
            },

            // Lists
            "& ul, & ol": {
              marginTop: 0,
              marginBottom: "1rem",
              paddingLeft: "2rem",
            },
            "& li": {
              marginBottom: "0.25rem",
            },

            // Code
            "& code": {
              backgroundColor: "#f5f5f5",
              padding: "0.1rem 0.3rem",
              borderRadius: "3px",
              fontFamily: "monospace",
              fontSize: "0.9em",
            },
            "& pre": {
              backgroundColor: "#f5f5f5",
              padding: "1rem",
              borderRadius: "4px",
              overflow: "auto",
              "& code": {
                backgroundColor: "transparent",
                padding: 0,
              },
            },

            // Horizontal rule
            "& hr": {
              border: "none",
              borderTop: "1px solid #e0e0e0",
              margin: "2rem 0",
            },

            // Images
            "& img": {
              maxWidth: "100%",
              height: "auto",
              display: "block",
              margin: "1rem auto",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
            },

            // Links
            "& a": {
              color: "#1976d2",
              textDecoration: "none",
              "&:hover": {
                textDecoration: "underline",
              },
            },

            // Internal anchor links in tables
            "& td a[href^='#']": {
              color: "#1976d2",
              fontWeight: 500,
            },

            // Strong/Bold
            "& strong, & b": {
              fontWeight: 600,
            },

            // Emphasis/Italic
            "& em, & i": {
              fontStyle: "italic",
            },

            // Warning boxes (for AsciiDoc)
            "& .warning": {
              backgroundColor: "#fff3e0",
              borderLeft: "4px solid #ff9800",
              padding: "1rem",
              marginBottom: "1rem",
            },

            // Classification badge
            "& .classification": {
              display: "inline-block",
              padding: "0.25rem 0.75rem",
              backgroundColor: "#1976d2",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.8rem",
              borderRadius: "4px",
              marginBottom: "1rem",
            },
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </Paper>
    </Box>
  );
};

// ==================== MARKDOWN TO HTML CONVERTER ====================

function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first (but preserve our own tags)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore anchor tags that were escaped (from threat table)
  // Pattern: &lt;a id="..."&gt;&lt;/a&gt;
  html = html.replace(/&lt;a id="([^"]+)"&gt;&lt;\/a&gt;/g, '<a id="$1"></a>');

  // Headers (must be done before other replacements)
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

  // Paragraphs - wrap remaining text blocks
  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("<")) return block; // Already HTML
      if (block.match(/^\|/)) return block; // Table
      return `<p>${block.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n\n");

  return html;
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
        result.push(convertTableRows(tableRows));
        inTable = false;
        tableRows = [];
      }
      result.push(line);
    }
  }

  if (inTable) {
    result.push(convertTableRows(tableRows));
  }

  return result.join("\n");
}

function convertTableRows(rows: string[]): string {
  if (rows.length < 2) return rows.join("\n");

  let html = "<table>\n<thead>\n<tr>\n";

  // Header row
  const headerCells = rows[0]
    .split("|")
    .filter((c) => c.trim())
    .map((c) => c.trim());
  for (const cell of headerCells) {
    html += `<th>${cell}</th>\n`;
  }
  html += "</tr>\n</thead>\n<tbody>\n";

  // Skip separator row (row[1]), process data rows
  for (let i = 2; i < rows.length; i++) {
    const cells = rows[i]
      .split("|")
      .filter((c) => c.trim())
      .map((c) => c.trim());
    html += "<tr>\n";
    for (const cell of cells) {
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

  if (inList) {
    result.push("</ul>");
  }

  return result.join("\n");
}

// ==================== ASCIIDOC TO HTML CONVERTER ====================

function convertAsciiDocToHtml(asciidoc: string): string {
  let html = asciidoc;

  // Escape HTML entities first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Classification - MUST come before Bold/Italic
  html = html.replace(
    /^\[\.(public|internal|confidential|restricted)\]\n\*(.+)\*$/gm,
    '<span class="classification">$2</span>'
  );

  // AsciiDoc anchors: [[id]]text -> <a id="id"></a>text
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<a id="$1"></a>');

  // AsciiDoc cross-references with custom text: <<id,text>> -> <a href="#id">text</a>
  // After escaping, << becomes &lt;&lt; and >> becomes &gt;&gt;
  html = html.replace(
    /&lt;&lt;([^,&]+),([^&]+)&gt;&gt;/g,
    '<a href="#$1">$2</a>'
  );

  // AsciiDoc cross-references without custom text: <<id>> -> <a href="#id">id</a>
  html = html.replace(/&lt;&lt;([^&]+)&gt;&gt;/g, '<a href="#$1">$1</a>');

  // Document title (= Title)
  html = html.replace(/^= (.+)$/gm, "<h1>$1</h1>");

  // Section headers
  html = html.replace(/^==== (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^=== (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^== (.+)$/gm, "<h2>$1</h2>");

  // Attributes (skip them for preview)
  html = html.replace(/^:.+$/gm, "");

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
    '<div class="warning"><strong>⚠️ Warning:</strong> $1</div>'
  );

  // Images
  html = html.replace(
    /^image::([^\[]+)\[([^\]]*)\]/gm,
    '<img src="$1" alt="$2" />'
  );

  // Horizontal rule
  html = html.replace(/^'''$/gm, "<hr>");

  // Lists
  html = convertAsciiDocLists(html);

  // Tables
  html = convertAsciiDocTables(html);

  // Lead paragraph
  html = html.replace(
    /^\[\.lead\]\n(.+)$/gm,
    '<p class="lead"><em>$1</em></p>'
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

  return html;
}

function convertAsciiDocLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const bulletMatch = line.match(/^\* (.+)$/);
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

  if (inList) {
    result.push("</ul>");
  }

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
      hasHeader = true; // Assume header if cols defined
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
      if (line.trim()) {
        tableRows.push(line);
      }
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function convertAsciiDocTableRows(rows: string[], hasHeader: boolean): string {
  if (rows.length === 0) return "";

  let html = "<table>\n";
  let isHeader = hasHeader;
  let currentRow: string[] = [];

  for (const line of rows) {
    const cells = line.split("|").filter((c) => c.trim());
    if (cells.length > 0) {
      if (currentRow.length > 0 && line.startsWith("|")) {
        // New row starts
        html += renderTableRow(currentRow, isHeader);
        if (isHeader) {
          html += "</thead>\n<tbody>\n";
          isHeader = false;
        }
        currentRow = cells.map((c) => c.trim());
      } else {
        currentRow.push(...cells.map((c) => c.trim()));
      }
    }
  }

  if (currentRow.length > 0) {
    if (isHeader) {
      html += "<thead>\n";
    }
    html += renderTableRow(currentRow, isHeader);
    if (isHeader) {
      html += "</thead>\n<tbody>\n";
    }
  }

  html += "</tbody>\n</table>";
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

export default DocPreview;