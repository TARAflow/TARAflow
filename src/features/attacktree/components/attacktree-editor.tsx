// ==================== ATTACK TREE EDITOR (CodeMirror 6) ====================
// CodeMirror 6 Editor with DSL syntax highlighting
// Replaces Monaco Editor for better React integration and smaller bundle size

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, IconButton, Tooltip, Collapse, Divider } from "@mui/material";
import {
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage, indentUnit } from "@codemirror/language";
import { linter, Diagnostic } from "@codemirror/lint";
import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";

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

// ==================== CUSTOM LANGUAGE DEFINITION ====================

/**
 * Attack Tree DSL Language Definition for CodeMirror
 *
 * Syntax:
 * Node Name [Refs];TYPE evaluation @goal [Mitigations]
 */
const attackTreeLanguage = StreamLanguage.define({
  token(stream, state) {
    // Comments
    if (stream.match(/^#.*/)) {
      return "comment";
    }

    // Node types: ;ROOT, ;OR, ;AND
    if (stream.match(/;(ROOT|OR|AND)\b/)) {
      return "keyword";
    }

    // References: [A-001], [T-001], [DS-01]
    if (stream.match(/\[[A-Z][A-Z0-9-]*\]/)) {
      return "variableName";
    }

    // Mitigations: [M-001] or [M-001,M-002]
    if (stream.match(/\[M-[0-9]+(?:,\s*M-[0-9]+)*\]/)) {
      return "string";
    }

    // Attack Goals: @disclosure, @manipulation, etc.
    if (stream.match(/@[a-z-]+/)) {
      return "attributeName";
    }

    // Simple Evaluation: p=0.5, i=3
    if (stream.match(/p=[\d.]+/)) {
      return "number";
    }
    if (stream.match(/i=\d+/)) {
      return "number";
    }

    // Extended Evaluation: 0.8,0.9,4
    if (stream.match(/\d+\.?\d*,\d+\.?\d*,\d+/)) {
      return "number";
    }

    // Operators
    if (stream.match(/[,;]/)) {
      return "punctuation";
    }

    // Advance one character
    stream.next();
    return null;
  },
});

// ==================== SMART ENTER (keep tab-indentation) ====================

/**
 * The Attack Tree DSL uses leading tab characters to encode tree depth
 * (see level detection in attacktree-parser.ts, regex: ^\t star-slash).
 *
 * CodeMirror 6 does not insert tabs on Tab by default (Tab moves focus for
 * accessibility) and has no auto-indent for this custom StreamLanguage, so
 * without this command every new line lands at indent level 0 - colliding
 * with ROOT - and gets rejected by the parser as "Node has no parent".
 *
 * This keeps Enter simple and predictable: the new line gets the same
 * number of leading tabs as the line the cursor was on. Users can then
 * press Tab to go one level deeper, or Shift+Tab to go shallower.
 */
function insertNewlineKeepIndent(view: EditorView): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const indent = /^\t*/.exec(line.text)?.[0] ?? "";
    const insert = "\n" + indent;
    const newPos = range.from + insert.length;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(newPos),
    };
  });
  view.dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input" }));
  return true;
}

// ==================== LINTER (Error Markers) ====================

/**
 * Convert ValidationErrors to CodeMirror Diagnostics
 */
function createLinter(validationErrors: ValidationError[]) {
  return linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const doc = view.state.doc;
    const { t } = useTranslation();

    validationErrors.forEach((error) => {
      // Get line position
      const lineNumber = Math.max(1, Math.min(error.line, doc.lines));
      const line = doc.line(lineNumber);

      // Calculate positions
      const from = line.from + (error.column ? error.column - 1 : 0);
      const to = Math.min(from + 50, line.to); // Highlight up to 50 chars

      diagnostics.push({
        from,
        to,
        severity: error.severity,
        message: t(error.messageKey, { ns: "attacktree", ...error.params }),
      });
    });

    return diagnostics;
  });
}

// ==================== THEME / STYLING ====================

/**
 * Custom theme for Attack Tree DSL
 */
const attackTreeTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
    padding: "8px 0",
  },
  ".cm-gutters": {
    backgroundColor: "#fafafa",
    borderRight: "1px solid #e0e0e0",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e3f2fd",
  },
  ".cm-activeLine": {
    backgroundColor: "#f5f5f5",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#bbdefb !important",
  },
  // Error/Warning underlines
  ".cm-diagnostic-error": {
    borderBottom: "2px wavy #d32f2f",
  },
  ".cm-diagnostic-warning": {
    borderBottom: "2px wavy #ed6c02",
  },
  ".cm-diagnostic-info": {
    borderBottom: "1px dotted #0288d1",
  },
});

/**
 * Syntax highlighting styles
 */
const syntaxHighlighting = EditorView.baseTheme({
  ".cm-comment": { color: "#6a9955", fontStyle: "italic" },
  ".cm-keyword": { color: "#0000ff", fontWeight: "bold" },
  ".cm-variableName": { color: "#267f99" },
  ".cm-string": { color: "#a31515" },
  ".cm-number": { color: "#098658" },
  ".cm-attributeName": { color: "#9c27b0", fontWeight: "bold" },
  ".cm-punctuation": { color: "#000000" },
});

// ==================== COMPONENT ====================

const AttackTreeEditorComponent: React.FC<AttackTreeEditorProps> = ({
  dsl,
  configuration,
  validation,
  collapsed,
  onDslChange,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();

  // DEBUG: Log what changed
  const renderCountRef = React.useRef(0);
  const prevPropsRef = React.useRef({
    dsl,
    validation,
    collapsed,
    configuration,
  });
  React.useEffect(() => {
    renderCountRef.current++;
    const prev = prevPropsRef.current;
    const changes = [];

    if (prev.dsl !== dsl) changes.push(`dsl`);
    if (prev.validation !== validation)
      changes.push(`validation (${validation.length} errors)`);
    if (prev.collapsed !== collapsed) changes.push("collapsed");
    if (prev.configuration !== configuration) changes.push("configuration");

    prevPropsRef.current = { dsl, validation, collapsed, configuration };
  });

  // Internal editor state (prevents cursor jump)
  const [internalDsl, setInternalDsl] = React.useState(dsl);

  // Sync external changes ONLY when tree changes (not during typing)
  const prevDslRef = React.useRef(dsl);
  React.useEffect(() => {
    // Only update if DSL changed externally (e.g., tree selection)
    // Not from our own onChange
    if (dsl !== internalDsl && dsl !== prevDslRef.current) {
      setInternalDsl(dsl);
    }
    prevDslRef.current = dsl;
  }, [dsl, internalDsl]);

  // Create linter extension from validation errors
  const linterExtension = useMemo(() => {
    return createLinter(validation);
  }, [validation]);

  // Combine all extensions (TEMPORARY: without dynamic linter)
  const extensions = useMemo(() => {
    const exts = [
      attackTreeLanguage,
      attackTreeTheme,
      syntaxHighlighting,
      // linterExtension, // DISABLED FOR TESTING
      // The DSL's tree hierarchy is defined by leading TAB characters
      // (see attacktree-parser.ts). Without these three extensions, Tab
      // moves focus out of the editor instead of inserting a tab, and
      // Enter doesn't preserve indentation - so every new line lands at
      // level 0 and the parser rejects it as "Node has no parent".
      indentUnit.of("\t"),
      // Prec.highest ensures this wins over the default keymap that
      // @uiw/react-codemirror's basicSetup already binds Enter/Tab to.
      Prec.highest(
        keymap.of([
          { key: "Enter", run: insertNewlineKeepIndent },
          indentWithTab,
        ]),
      ),
    ];

    // Tab size
    exts.push(EditorView.lineWrapping);

    return exts;
  }, []); // Empty deps = nur 1x erstellt

  // Group validation by severity
  const errors = validation.filter((v) => v.severity === "error");
  const warnings = validation.filter((v) => v.severity === "warning");
  const infos = validation.filter((v) => v.severity === "info");

  const [showValidation, setShowValidation] = React.useState(true);

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
      {!collapsed && (
        <Box
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* CodeMirror Editor */}
          <Box
            sx={{
              flexGrow: 1,
              position: "relative",
              overflow: "hidden",
              "& .cm-editor": {
                height: "100%",
              },
              "& .cm-scroller": {
                overflow: "auto",
              },
            }}
          >
            <CodeMirror
              value={internalDsl}
              height="100%"
              extensions={extensions}
              onChange={(value) => {
                setInternalDsl(value);
                onDslChange(value);
              }}
              basicSetup={{
                lineNumbers: configuration.showLineNumbers,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                foldGutter: false,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: false, // We'll add this later if needed
                rectangularSelection: true,
                crosshairCursor: false,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                searchKeymap: true,
                foldKeymap: true,
                completionKeymap: false,
                lintKeymap: true,
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
                        <span>
                          {t(error.messageKey, { ns: "attacktree", ...error.params })}
                        </span>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};;

// Export with React.memo and custom comparison
export const AttackTreeEditor = React.memo(
  AttackTreeEditorComponent,
  arePropsEqual,
);

AttackTreeEditor.displayName = "AttackTreeEditor";

export default AttackTreeEditor;

// Custom comparison function for React.memo
// Only re-render if DSL or critical props change
function arePropsEqual(
  prev: AttackTreeEditorProps,
  next: AttackTreeEditorProps,
): boolean {
  // Always re-render if collapsed state changes
  if (prev.collapsed !== next.collapsed) {
    return false;
  }

  // Always re-render if DSL changes
  if (prev.dsl !== next.dsl) {
    return false;
  }

  // Re-render if line numbers setting changes
  if (
    prev.configuration.showLineNumbers !== next.configuration.showLineNumbers
  ) {
    return false;
  }

  // Re-render if font size changes
  if (prev.configuration.fontSize !== next.configuration.fontSize) {
    return false;
  }

  // Don't re-render for validation changes (handled by linter)
  // Don't re-render for callback changes

  return true;
}