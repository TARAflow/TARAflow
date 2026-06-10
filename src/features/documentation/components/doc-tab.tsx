// ==================== DOCUMENTATION TAB ====================
// Phase 6: Documentation Generation
// Refactored version using useDocumentGeneration hook and DocToolbar component
//
// Features:
// - Format selection (Markdown, AsciiDoc, HTML, PDF)
// - Language selection (EN, DE)
// - Chapter configuration
// - Live preview
// - Export/Download
// - Collapsible sidebar

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from "@mui/material";

import type { DocTabProps, DocFormat, DocLanguage } from "../models/doc-types";
import { CHAPTER_TITLES, isChapterVisible } from "../models/doc-types";
import { DocPreview } from "./doc-preview";
import { DocConfigDialog } from "./doc-config-dialog";
import { DocToolbar } from "./doc-toolbar";
import { useDocumentGeneration } from "../hooks/use-document-generation";

// ==================== CONSTANTS ====================

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 0;

// ==================== COMPONENT ====================

export const DocTab: React.FC<DocTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t } = useTranslation();

  // ==================== HOOK ====================

  const {
    // State
    config,
    generatedContent,
    sidebarOpen,
    showConfigDialog,
    viewMode,

    // Computed values
    validation,
    chapterHasContent,
    projectStats,

    // Handlers
    handleGenerate,
    handleFormatChange,
    handleLanguageChange,
    handleChapterToggle,
    handleConfigSave,
    handleDownload,
    setSidebarOpen,
    setShowConfigDialog,
    setViewMode,
  } = useDocumentGeneration({
    project,
    onUpdate,
    onDirtyChange,
  });

  // ==================== TOOLBAR ACTIONS ====================

  const handleSidebarToggle = () => setSidebarOpen(!sidebarOpen);

  const handleViewModeToggle = () => {
    setViewMode(viewMode === "preview" ? "source" : "preview");
  };

  const handleOpenSettings = () => setShowConfigDialog(true);

  // ==================== RENDER ====================

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <DocToolbar
        sidebarOpen={sidebarOpen}
        viewMode={viewMode}
        config={config}
        generatedContent={generatedContent}
        warnings={validation.warnings}
        onSidebarToggle={handleSidebarToggle}
        onViewModeToggle={handleViewModeToggle}
        onRegenerate={handleGenerate}
        onDownload={handleDownload}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main Content */}
      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        {/* Collapsible Sidebar */}
        <Box
          sx={{
            width: sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
            minWidth: sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH,
            transition: "width 0.2s ease-in-out, min-width 0.2s ease-in-out",
            overflow: "hidden",
          }}
        >
          <Paper
            sx={{
              width: SIDEBAR_WIDTH,
              height: "100%",
              borderRadius: 0,
              borderRight: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Sidebar Content - Scrollable */}
            <Box
              sx={{
                flexGrow: 1,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Format & Language Selection */}
              <Box
                sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  {t("tabs.doc.outputSettings", {
                    defaultValue: "Output Settings",
                  })}
                </Typography>

                {/* Format Selection */}
                <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                  <InputLabel>
                    {t("tabs.doc.format", { defaultValue: "Format" })}
                  </InputLabel>
                  <Select
                    value={config.format}
                    label={t("tabs.doc.format", { defaultValue: "Format" })}
                    onChange={(e) =>
                      handleFormatChange(e.target.value as DocFormat)
                    }
                  >
                    <MenuItem value="markdown">Markdown</MenuItem>
                    <MenuItem value="asciidoc">AsciiDoc</MenuItem>
                    <MenuItem value="strictdoc">StrictDoc</MenuItem>
                    <MenuItem value="html">HTML</MenuItem>
                    <MenuItem value="pdf">PDF</MenuItem>
                  </Select>
                </FormControl>

                {/* Language Selection */}
                <FormControl size="small" fullWidth>
                  <InputLabel>
                    {t("tabs.doc.docLanguage", {
                      defaultValue: "Document Language",
                    })}
                  </InputLabel>
                  <Select
                    value={config.language}
                    label={t("tabs.doc.docLanguage", {
                      defaultValue: "Document Language",
                    })}
                    onChange={(e) =>
                      handleLanguageChange(e.target.value as DocLanguage)
                    }
                  >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="de">Deutsch</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Chapter List */}
              <Box sx={{ flexGrow: 1, overflow: "auto" }}>
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="subtitle2">
                    {t("tabs.doc.chaptersTitle", { defaultValue: "Chapters" })}
                  </Typography>
                </Box>

                <List dense sx={{ py: 0 }}>
                  {config.chapters.map((chapter) => {
                    const hasContent = chapterHasContent[chapter.id];
                    const isVisible = isChapterVisible(chapter, hasContent);
                    const title =
                      config.language === "de"
                        ? CHAPTER_TITLES[chapter.id].de
                        : CHAPTER_TITLES[chapter.id].en;

                    return (
                      <ListItem key={chapter.id} disablePadding>
                        <ListItemButton
                          dense
                          onClick={() => handleChapterToggle(chapter.id)}
                          sx={{
                            py: 0.5,
                            opacity: isVisible ? 1 : 0.5,
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Checkbox
                              edge="start"
                              checked={chapter.enabled}
                              tabIndex={-1}
                              disableRipple
                              size="small"
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={title}
                            secondary={
                              !hasContent && chapter.autoHideIfEmpty
                                ? t("tabs.doc.empty", { defaultValue: "Empty" })
                                : undefined
                            }
                            primaryTypographyProps={{
                              variant: "body2",
                              sx: {
                                textDecoration:
                                  !hasContent && chapter.autoHideIfEmpty
                                    ? "line-through"
                                    : "none",
                              },
                            }}
                            secondaryTypographyProps={{
                              variant: "caption",
                              color: "text.disabled",
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>

              {/* Stats */}
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  backgroundColor: "grey.50",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={500}
                >
                  {t("tabs.doc.stats", { defaultValue: "Statistics" })}
                </Typography>
                <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsAssets", { defaultValue: "Assets" })}:{" "}
                    <strong>{projectStats.assets}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsThreats", { defaultValue: "Threats" })}:{" "}
                    <strong>{projectStats.threats}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsRisks", { defaultValue: "Risks" })}:{" "}
                    <strong>{projectStats.risks}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsWont", { defaultValue: "Accepted" })}:{" "}
                    <strong>{projectStats.wont}</strong>
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Preview/Source Area */}
        <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
          {viewMode === "preview" ? (
            <DocPreview
              content={generatedContent}
              format={config.format}
              language={config.language}
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                overflow: "auto",
                p: 2,
                backgroundColor: "grey.900",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  color: "#e0e0e0",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {generatedContent}
              </pre>
            </Box>
          )}
        </Box>
      </Box>

      {/* Config Dialog */}
      {showConfigDialog && (
        <DocConfigDialog
          open={showConfigDialog}
          configuration={config}
          onSave={handleConfigSave}
          onClose={() => setShowConfigDialog(false)}
        />
      )}
    </Box>
  );
};

export default DocTab;