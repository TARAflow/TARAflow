// ==================== DOCUMENTATION TAB ====================
// Phase 6: Documentation Generation
// Features:
// - Format selection (Markdown, AsciiDoc)
// - Language selection (EN, DE)
// - Chapter configuration
// - Live preview
// - Export/Download
// - Collapsible sidebar

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Visibility as PreviewIcon,
  Code as CodeIcon,
  Warning as WarningIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  KeyboardArrowLeft as KeyboardArrowLeftIcon,
  KeyboardArrowRight as KeyboardArrowRightIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";

import type {
  DocTabProps,
  DocData,
  DocConfiguration,
  DocFormat,
  DocLanguage,
  DocChapterId,
} from "../models/doc-types";
import {
  createDefaultDocData,
  CHAPTER_TITLES,
  isChapterVisible,
} from "../models/doc-types";
import {
  generateDocument,
  validateProjectForDoc,
  generateFilename,
} from "../services/doc-generator";
import { DocPreview } from "./doc-preview";
import { DocConfigDialog } from "./doc-config-dialog";

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
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== STATE ====================

  // Documentation data (local working copy)
  const [docData, setDocData] = useState<DocData>(() => {
    return project.documentation ?? createDefaultDocData();
  });

  // Generated content
  const [generatedContent, setGeneratedContent] = useState<string>("");

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");

  // Validation
  const validation = useMemo(() => validateProjectForDoc(project), [project]);

  // ==================== DERIVED STATE ====================

  const config = docData.configuration;

  // Check which chapters have content
  const chapterHasContent = useMemo(() => {
    const map: Record<DocChapterId, boolean> = {
      "executive-summary": true, // Always has content
      "system-overview": true, // Always has content
      dfd: project.dfd.hasDFD,
      assets: project.assets.length > 0,
      "threats-per-element": project.threatsPerElement.length > 0,
      "threats-per-interaction": project.threatsPerInteraction.length > 0,
      "risks-per-element": project.risksPerElement.length > 0,
      "risks-per-interaction": project.risksPerInteraction.length > 0,
      "accepted-risks": project.wontRisks.length > 0,
      appendix: true, // Always has content
    };
    return map;
  }, [project]);

  // ==================== EFFECTS ====================

  // Update dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync from project when it changes
  useEffect(() => {
    if (project.documentation) {
      setDocData(project.documentation);
    }
  }, [project.documentation]);

  // Auto-generate on mount and when config changes
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.format, config.language, config.chapters]);

  // ==================== HANDLERS ====================

  const handleGenerate = useCallback(() => {
    try {
      const content = generateDocument(project, config);
      setGeneratedContent(content);
      setDocData((prev) => ({
        ...prev,
        generatedContent: content,
        lastGenerated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Failed to generate document:", error);
    }
  }, [project, config]);

  const handleFormatChange = useCallback((format: DocFormat) => {
    setDocData((prev) => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        format,
      },
    }));
    setIsDirty(true);
  }, []);

  const handleLanguageChange = useCallback((language: DocLanguage) => {
    setDocData((prev) => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        language,
      },
    }));
    setIsDirty(true);
  }, []);

  const handleChapterToggle = useCallback((chapterId: DocChapterId) => {
    setDocData((prev) => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        chapters: prev.configuration.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, enabled: !ch.enabled } : ch
        ),
      },
    }));
    setIsDirty(true);
  }, []);

  const handleConfigSave = useCallback((newConfig: DocConfiguration) => {
    setDocData((prev) => ({
      ...prev,
      configuration: newConfig,
    }));
    setIsDirty(true);
    setShowConfigDialog(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!generatedContent) return;

    const filename = generateFilename(project.name, config.format);
    const blob = new Blob([generatedContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedContent, project.name, config.format]);

  const handleSave = useCallback(() => {
    const now = new Date().toISOString();
    const updatedDocData: DocData = {
      ...docData,
      generatedContent,
      lastGenerated: now,
      lastModified: now,
    };

    setDocData(updatedDocData);
    setIsDirty(false);

    onUpdate({
      documentation: updatedDocData,
      phaseStatus: project.phaseStatus,
      lastModified: now,
    });
  }, [docData, generatedContent, project.phaseStatus, onUpdate]);

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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          flexWrap: "wrap",
        }}
      >
        {/* Toggle Sidebar */}
        <Tooltip
          title={
            sidebarOpen
              ? t("tabs.doc.hideSidebar", { defaultValue: "Hide Sidebar" })
              : t("tabs.doc.showSidebar", { defaultValue: "Show Sidebar" })
          }
        >
          <IconButton
            size="small"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            color={sidebarOpen ? "primary" : "default"}
          >
            {sidebarOpen ? (
              <ChevronLeftIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* View Mode Toggle */}
        <Tooltip
          title={
            viewMode === "preview"
              ? t("tabs.doc.showSource", { defaultValue: "Show Source" })
              : t("tabs.doc.showPreview", { defaultValue: "Show Preview" })
          }
        >
          <IconButton
            size="small"
            onClick={() =>
              setViewMode(viewMode === "preview" ? "source" : "preview")
            }
            color={viewMode === "source" ? "primary" : "default"}
          >
            {viewMode === "preview" ? (
              <CodeIcon fontSize="small" />
            ) : (
              <PreviewIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        {/* Regenerate */}
        <Tooltip
          title={t("tabs.doc.regenerate", { defaultValue: "Regenerate" })}
        >
          <IconButton size="small" onClick={handleGenerate}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Settings */}
        <Tooltip
          title={t("tabs.doc.settings", {
            defaultValue: "Template Settings",
          })}
        >
          <IconButton size="small" onClick={() => setShowConfigDialog(true)}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        {/* Validation Status */}
        {validation.warnings.length > 0 && (
          <Tooltip
            title={
              <Box>
                {validation.warnings.map((w, i) => (
                  <Typography key={i} variant="body2">
                    • {w}
                  </Typography>
                ))}
              </Box>
            }
          >
            <Chip
              icon={<WarningIcon />}
              label={`${validation.warnings.length}`}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Tooltip>
        )}

        {validation.isValid && validation.warnings.length === 0 && (
          <Chip
            icon={<CheckIcon />}
            label={t("tabs.doc.ready", { defaultValue: "Ready" })}
            size="small"
            color="success"
            variant="outlined"
          />
        )}

        <Divider orientation="vertical" flexItem />

        {/* Download Button */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
          disabled={!generatedContent}
        >
          {t("tabs.doc.download", { defaultValue: "Download" })}
        </Button>

        {/* Save Button */}
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={!isDirty}
        >
          {t("common.save", { defaultValue: "Save" })}
          {isDirty && " *"}
        </Button>
      </Box>

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
                    <strong>{project.assets.length}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsThreats", { defaultValue: "Threats" })}:{" "}
                    <strong>
                      {project.threatsPerElement.length +
                        project.threatsPerInteraction.length}
                    </strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsRisks", { defaultValue: "Risks" })}:{" "}
                    <strong>
                      {project.risksPerElement.length +
                        project.risksPerInteraction.length}
                    </strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.doc.statsWont", { defaultValue: "Accepted" })}:{" "}
                    <strong>{project.wontRisks.length}</strong>
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