// ==================== DOCUMENTATION PREVIEW ====================
// Renders Markdown or AsciiDoc content for preview
// Uses simple HTML rendering for both formats
// Note: For production, consider adding react-markdown or asciidoctor.js

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Paper } from "@mui/material";
import type { DocFormat, DocLanguage } from "../models/doc-types";
import {
  convertAsciiDocToHtml,
  convertMarkdownToHtml,
  convertStrictDocToHtml,
} from "../services/doc-preview-converters";

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
    switch (format) {
      case "markdown":
        return convertMarkdownToHtml(content);

      case "asciidoc":
        return convertAsciiDocToHtml(content);

      case "strictdoc":
        return convertStrictDocToHtml(content);

      default:
        //throw new Error(`Unsupported format: ${format}`);
        return content;
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

export default DocPreview;