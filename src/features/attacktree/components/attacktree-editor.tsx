// ==================== ATTACK TREE EDITOR ====================
// Monaco Editor with DSL syntax highlighting

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, IconButton, Tooltip, Collapse, Divider } from "@mui/material";
import {
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import Editor, { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

import {
  AttackTreeConfiguration,
  ValidationError,
} from "../models/attacktree-types";

// ==================== TYPES ====================

interface AttackTreeEditorProps {
  dsl: string;
  configuration: AttackTreeConfiguration;
  validation: ValidationError[];
  collapsed: boolean;
  onDslChange: (dsl: string) => void;
  onToggleCollapse: () => void;
}

// ==================== COMPONENT ====================

export const AttackTreeEditor: React.FC<AttackTreeEditorProps> = ({
  dsl,
  configuration,
  validation,
  collapsed,
  onDslChange,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);

  const [showValidation, setShowValidation] = useState(true);

  // Setup Monaco Editor
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom language
    monaco.languages.register({ id: "attacktree" });

    // Define tokens
    monaco.languages.setMonarchTokensProvider("attacktree", {
      tokenizer: {
        root: [
          // Comments
          [/#.*$/, "comment"],

          // Node types
          [/;(ROOT|OR|AND)\b/, "keyword"],

          // References [A001], [T-001], [DS-01]
          [/\[[A-Z][A-Z0-9-]*\]/, "type"],

          // Mitigations [M-001]
          [/\[M-[0-9]+(?:,\s*M-[0-9]+)*\]/, "string"],

          // Evaluation (p=0.5,i=3 or 0.8,0.9,3)
          [/p=[\d.]+/, "number"],
          [/i=\d+/, "number"],
          [/[\d.]+,[\d.]+,\d+/, "number"],

          // Operators
          [/[,;]/, "delimiter"],
        ],
      },
    });

    // Define theme
    monaco.editor.defineTheme("attacktree-theme", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "0000FF", fontStyle: "bold" },
        { token: "type", foreground: "267F99" },
        { token: "string", foreground: "A31515" },
        { token: "number", foreground: "098658" },
        { token: "delimiter", foreground: "000000" },
      ],
      colors: {
        "editor.foreground": "#000000",
        "editor.background": "#FFFFFF",
      },
    });

    monaco.editor.setTheme("attacktree-theme");

    // Set editor options
    editor.updateOptions({
      fontSize: configuration.fontSize,
      lineNumbers: configuration.showLineNumbers ? "on" : "off",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      tabSize: 1, // Tabs for indentation
      insertSpaces: false,
    });
  };

  // Update editor when configuration changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: configuration.fontSize,
        lineNumbers: configuration.showLineNumbers ? "on" : "off",
      });
    }
  }, [configuration.fontSize, configuration.showLineNumbers]);

  // Update markers when validation changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const markers = validation.map((error) => ({
          severity:
            error.severity === "error"
              ? monacoRef.current.MarkerSeverity.Error
              : error.severity === "warning"
              ? monacoRef.current.MarkerSeverity.Warning
              : monacoRef.current.MarkerSeverity.Info,
          startLineNumber: error.line,
          startColumn: error.column || 1,
          endLineNumber: error.line,
          endColumn: error.column ? error.column + 10 : 100,
          message: error.message,
        }));

        monacoRef.current.editor.setModelMarkers(model, "attacktree", markers);
      }
    }
  }, [validation]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onDslChange(value);
    }
  };

  // Group validation by severity
  const errors = validation.filter((v) => v.severity === "error");
  const warnings = validation.filter((v) => v.severity === "warning");
  const infos = validation.filter((v) => v.severity === "info");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        borderRight: collapsed ? "none" : "1px solid",
        borderColor: "divider",
        transition: "width 0.3s",
        width: collapsed ? "auto" : "100%",
      }}
    >
      {/* Collapse/Expand Button */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          right: collapsed ? 8 : 8,
          zIndex: 10,
        }}
      >
        <Tooltip
          title={
            collapsed
              ? t("common.expand", { defaultValue: "Expand" })
              : t("common.collapse", { defaultValue: "Collapse" })
          }
        >
          <IconButton onClick={onToggleCollapse} size="small">
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Editor or Collapsed State */}
      <Collapse in={!collapsed} orientation="horizontal" sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Editor */}
          <Box sx={{ flexGrow: 1, position: "relative" }}>
            <Editor
              height="100%"
              language="attacktree"
              value={dsl}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                automaticLayout: true,
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                },
              }}
            />
          </Box>

          {/* Validation Panel */}
          {validation.length > 0 && (
            <>
              <Divider />
              <Box
                sx={{
                  maxHeight: 150,
                  overflowY: "auto",
                  backgroundColor: "grey.50",
                  p: 1,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 1,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowValidation(!showValidation)}
                >
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {errors.length > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "error.main",
                        }}
                      >
                        <ErrorIcon fontSize="small" />
                        <span>{errors.length}</span>
                      </Box>
                    )}
                    {warnings.length > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "warning.main",
                        }}
                      >
                        <WarningIcon fontSize="small" />
                        <span>{warnings.length}</span>
                      </Box>
                    )}
                    {infos.length > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          color: "info.main",
                        }}
                      >
                        <InfoIcon fontSize="small" />
                        <span>{infos.length}</span>
                      </Box>
                    )}
                  </Box>
                </Box>

                <Collapse in={showValidation}>
                  <Box sx={{ fontSize: "0.875rem" }}>
                    {validation.map((error, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: "flex",
                          gap: 1,
                          py: 0.5,
                          color:
                            error.severity === "error"
                              ? "error.main"
                              : error.severity === "warning"
                              ? "warning.main"
                              : "info.main",
                        }}
                      >
                        <span>[Line {error.line}]</span>
                        <span>{error.message}</span>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

export default AttackTreeEditor;