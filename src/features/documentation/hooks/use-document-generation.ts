// ==================== DOCUMENT GENERATION HOOK ====================
// Custom hook for documentation generation logic
// Extracted from DocTab for better separation of concerns

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type {
  DocData,
  DocConfiguration,
  DocFormat,
  DocLanguage,
  DocChapterId,
} from "../models/doc-types";
import { createDefaultDocData, isChapterVisible } from "../models/doc-types";
import {
  generateDocument,
  validateProjectForDoc,
  getMimeType,
} from "../utils/doc-generator";
import { isRegulationTag, flattenProjectTags } from "shared";
import {
  createProjectWithPng,
  createPdfBlob,
  downloadBlob,
} from "../utils/pdf-helpers";

import type { DocTabProps } from "../models/doc-types";

// ==================== TYPES ====================

export interface UseDocumentGenerationProps {
  project: DocTabProps["project"];
  onUpdate: DocTabProps["onUpdate"];
  onDirtyChange?: DocTabProps["onDirtyChange"];
}

export interface UseDocumentGenerationReturn {
  // State
  docData: DocData;
  config: DocConfiguration;
  generatedContent: string;
  generatedFilename: string;
  isDirty: boolean;
  sidebarOpen: boolean;
  showConfigDialog: boolean;
  viewMode: "preview" | "source";
  
  // Computed values
  validation: ReturnType<typeof validateProjectForDoc>;
  chapterHasContent: Record<DocChapterId, boolean>;
  projectStats: {
    assets: number;
    threats: number;
    risks: number;
    wont: number;
  };
  
  // Handlers
  handleGenerate: () => void;
  handleFormatChange: (format: DocFormat) => void;
  handleLanguageChange: (language: DocLanguage) => void;
  handleChapterToggle: (chapterId: DocChapterId) => void;
  handleConfigSave: (newConfig: DocConfiguration) => void;
  handleDownload: () => Promise<void>;
  handleSave: () => void;
  setSidebarOpen: (open: boolean) => void;
  setShowConfigDialog: (show: boolean) => void;
  setViewMode: (mode: "preview" | "source") => void;
}

// ==================== HOOK ====================

export const useDocumentGeneration = ({
  project,
  onUpdate,
  onDirtyChange,
}: UseDocumentGenerationProps): UseDocumentGenerationReturn => {
  const { t } = useTranslation();

  // ==================== TRANSLATION WRAPPER ====================
  const translateFn = useCallback(
    (key: string, defaultValue?: string): string => {
      return t(key, { defaultValue: defaultValue ?? key });
    },
    [t]
  );

  // ==================== STATE ====================

  // Documentation data (local working copy)
  const [docData, setDocData] = useState<DocData>(() => {
    return project.documentation ?? createDefaultDocData();
  });

  // Generated content
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [generatedFilename, setGeneratedFilename] = useState<string>("");

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");

  // ==================== COMPUTED VALUES ====================

  const config = docData.configuration;

  // Validation
  const validation = useMemo(() => validateProjectForDoc(project), [project]);

  // Check which chapters have content
  const chapterHasContent = useMemo(() => {
    // Helper functions for counting
    const getAssetCount = () => project.assets?.assets?.length ?? 0;
    const getThreatsCount = () => {
      const perElement =
        project.threats?.perElementTables?.flatMap((t: any) => t.threats) ?? [];
      const perInteraction =
        project.threats?.perInteractionTables?.flatMap((t: any) => t.threats) ?? [];
      return {
        perElement: perElement.length,
        perInteraction: perInteraction.length,
      };
    };
    const getRisksCount = () => {
      const allRisks = project.risks?.risks ?? [];
      const perElement = allRisks.filter(
        (r: any) =>
          r.sourceStrideMethod === "per-element" && r.moscowPriority !== "wont",
      );
      const perInteraction = allRisks.filter(
        (r: any) =>
          r.sourceStrideMethod === "per-interaction" &&
          r.moscowPriority !== "wont",
      );
      const wont = allRisks.filter((r: any) => r.moscowPriority === "wont");
      return {
        perElement: perElement.length,
        perInteraction: perInteraction.length,
        wont: wont.length,
      };
    };

    const threats = getThreatsCount();
    const risks = getRisksCount();

    const map: Record<DocChapterId, boolean> = {
      "executive-summary": true, // Always has content
      "applicable-regulations": flattenProjectTags(project.info.tags).some(
        (tag: string) => isRegulationTag(tag),
      ),
      "system-overview": true, // Always has content
      dfd: project.dfd != null,
      "dfd-descriptions":
        (project.dfd?.elements?.length ?? 0) > 0 ||
        (project.dfd?.connections?.length ?? 0) > 0,
      assets: getAssetCount() > 0,
      "asset-element-relations": (project.assets?.assets ?? []).some(
        (asset: any) =>
          asset.linkedDFDElements && asset.linkedDFDElements.length > 0,
      ),
      "threats-per-element": threats.perElement > 0,
      "threats-per-interaction": threats.perInteraction > 0,
      "risks-per-element": risks.perElement > 0,
      "risks-per-interaction": risks.perInteraction > 0,
      "accepted-risks": risks.wont > 0,
      "attack-trees": (project.attackTree?.trees?.length ?? 0) > 0,
      appendix: true, // Always has content
    };
    return map;
  }, [project]);

  // Calculate statistics for display
  const projectStats = useMemo(() => {
    const assetCount = project.assets?.assets?.length ?? 0;

    const perElementThreats =
      project.threats?.perElementTables?.flatMap((t: any) => t.threats) ?? [];
    const perInteractionThreats =
      project.threats?.perInteractionTables?.flatMap((t: any) => t.threats) ?? [];
    const threatCount = perElementThreats.length + perInteractionThreats.length;

    const allRisks = project.risks?.risks ?? [];
    const activeRisks = allRisks.filter((r: any) => r.moscowPriority !== "wont");
    const wontRisks = allRisks.filter((r: any) => r.moscowPriority === "wont");

    return {
      assets: assetCount,
      threats: threatCount,
      risks: activeRisks.length,
      wont: wontRisks.length,
    };
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
      const result = generateDocument(project, config, translateFn);
      setGeneratedContent(result.content);
      setGeneratedFilename(result.filename);
      setDocData((prev) => ({
        ...prev,
        generatedContent: result.content,
        lastGenerated: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Failed to generate document:", error);
    }
  }, [project, config, translateFn]);

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

  const handleDownload = useCallback(async () => {
    if (!generatedContent) return;

    const filename =
      generatedFilename ||
      `document.${
        config.format === "markdown"
          ? "md"
          : config.format === "asciidoc"
            ? "adoc"
            : config.format === "strictdoc"
              ? "sdoc"
              : config.format
      }`;

    let blob: Blob;

    if (config.format === "pdf") {
      try {
        // Step 1: Convert SVG to PNG
        const projectWithPng = await createProjectWithPng(project);

        // Step 2: Generate PDF
        const tWrapper = (key: string, defaultValue?: string) =>
          t(key, { defaultValue });
        blob = await createPdfBlob(projectWithPng, config, tWrapper);
      } catch (error) {
        console.error("PDF generation failed:", error);
        alert(`PDF generation failed. Saving as HTML instead.`);
        blob = new Blob([generatedContent], { type: "text/html" });
      }
    } else {
      const mimeType = getMimeType(config.format);
      blob = new Blob([generatedContent], { type: mimeType });
    }

    // Download
    downloadBlob(blob, filename);
  }, [generatedContent, generatedFilename, config, project, t]);

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

  // ==================== RETURN ====================

  return {
    // State
    docData,
    config,
    generatedContent,
    generatedFilename,
    isDirty,
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
    handleSave,
    setSidebarOpen,
    setShowConfigDialog,
    setViewMode,
  };
};

export default useDocumentGeneration;