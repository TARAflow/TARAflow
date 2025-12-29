// ==================== DOCUMENTATION GENERATOR ====================
// Generates Markdown or AsciiDoc documents from project data
// Uses simple string template replacement

import type {
  DocConfiguration,
  DocProjectData,
  DocLanguage,
  DocChapterId,
  DocAsset,
  DocThreat,
  DocRisk,
} from "../models/doc-types";
import {
  getChapterTitle,
  isChapterVisible,
  formatDocDate,
  getClassificationText,
  CHAPTER_TITLES,
} from "../models/doc-types";
import {
  MD_TEMPLATES,
  ADOC_TEMPLATES,
  replacePlaceholders,
  escapeMarkdownTable,
  escapeAsciiDocTable,
  truncateText,
  formatSecurityGoals,
  formatMitigations,
  formatTextOrDash,
} from "./doc-templates";

// ==================== TYPES ====================

interface GenerationContext {
  project: DocProjectData;
  config: DocConfiguration;
  lang: DocLanguage;
  isMarkdown: boolean;
}

interface ChapterContent {
  id: DocChapterId;
  title: string;
  content: string;
  hasContent: boolean;
}

// ==================== MAIN GENERATOR ====================

/**
 * Generate document content from project data
 */
export function generateDocument(
  project: DocProjectData,
  config: DocConfiguration
): string {
  const ctx: GenerationContext = {
    project,
    config,
    lang: config.language,
    isMarkdown: config.format === "markdown",
  };

  const templates = ctx.isMarkdown ? MD_TEMPLATES : ADOC_TEMPLATES;
  const escape = ctx.isMarkdown ? escapeMarkdownTable : escapeAsciiDocTable;

  // Collect all chapters
  const chapters: ChapterContent[] = [];

  // Generate each chapter
  for (const chapterConfig of config.chapters) {
    const chapter = generateChapter(ctx, chapterConfig.id, templates, escape);
    chapters.push(chapter);
  }

  // Build document
  let document = "";

  // Header
  document += generateHeader(ctx, templates);

  // Table of Contents (if enabled)
  if (config.template.includeToc) {
    document += generateToc(ctx, chapters, templates);
  }

  // Chapters
  for (const chapter of chapters) {
    const chapterConfig = config.chapters.find((c) => c.id === chapter.id);
    if (chapterConfig && isChapterVisible(chapterConfig, chapter.hasContent)) {
      document += chapter.content;
    }
  }

  // Footer
  document += generateFooter(ctx, templates);

  return document;
}

// ==================== HEADER GENERATION ====================

function generateHeader(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES
): string {
  const { project, config, lang } = ctx;
  const info = project.info;

  const classificationText = config.template.classification
    ? getClassificationText(config.template.classification, lang)
    : "";

  const values = {
    projectName: info.name,
    version:
      config.template.versionMode === "custom" && config.template.customVersion
        ? config.template.customVersion
        : info.version,
    responsible: info.responsible || "-",
    created: formatDocDate(info.created, config.template.dateFormat),
    lastModified: formatDocDate(info.lastModified, config.template.dateFormat),
    organization: config.template.organizationName || "-",
    classification: classificationText
      ? ctx.isMarkdown
        ? `> **${classificationText}**`
        : `[.${config.template.classification}]\n*${classificationText}*`
      : "",
    tags: info.tags.length > 0 ? info.tags.join(", ") : undefined,
    team: info.team.length > 0 ? info.team.join(", ") : undefined,
  };

  let header = templates.header(lang);

  // Handle conditional sections
  header = processConditionals(header, values);

  return replacePlaceholders(header, values);
}

// ==================== TOC GENERATION ====================

function generateToc(
  ctx: GenerationContext,
  chapters: ChapterContent[],
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES
): string {
  const { config, lang, isMarkdown } = ctx;

  // For AsciiDoc, TOC is handled by :toc: attribute
  if (!isMarkdown) {
    return "";
  }

  const tocLines: string[] = [];
  let chapterNum = 1;

  for (const chapter of chapters) {
    const chapterConfig = config.chapters.find((c) => c.id === chapter.id);
    if (chapterConfig && isChapterVisible(chapterConfig, chapter.hasContent)) {
      const anchor = chapter.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      tocLines.push(`${chapterNum}. [${chapter.title}](#${anchor})`);
      chapterNum++;
    }
  }

  if (tocLines.length === 0) {
    return "";
  }

  return replacePlaceholders(templates.toc(lang), {
    tocContent: tocLines.join("\n"),
  });
}

// ==================== CHAPTER GENERATION ====================

function generateChapter(
  ctx: GenerationContext,
  chapterId: DocChapterId,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  escape: (text: string) => string
): ChapterContent {
  const { lang } = ctx;
  const chapterConfig = ctx.config.chapters.find((c) => c.id === chapterId);
  const title = getChapterTitle(
    chapterId,
    lang,
    chapterConfig?.customTitle,
    chapterConfig?.customTitleDE
  );

  switch (chapterId) {
    case "executive-summary":
      return generateExecutiveSummary(ctx, templates, title);
    case "system-overview":
      return generateSystemOverview(ctx, templates, title);
    case "dfd":
      return generateDFDChapter(ctx, templates, title);
    case "assets":
      return generateAssetsChapter(ctx, templates, escape, title);
    case "threats-per-element":
      return generateThreatsChapter(
        ctx,
        templates,
        escape,
        title,
        "per-element"
      );
    case "threats-per-interaction":
      return generateThreatsChapter(
        ctx,
        templates,
        escape,
        title,
        "per-interaction"
      );
    case "risks-per-element":
      return generateRisksChapter(ctx, templates, escape, title, "per-element");
    case "risks-per-interaction":
      return generateRisksChapter(
        ctx,
        templates,
        escape,
        title,
        "per-interaction"
      );
    case "accepted-risks":
      return generateAcceptedRisksChapter(ctx, templates, escape, title);
    case "appendix":
      return generateAppendix(ctx, templates, title);
    default:
      return { id: chapterId, title, content: "", hasContent: false };
  }
}

// ==================== EXECUTIVE SUMMARY ====================

function generateExecutiveSummary(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  title: string
): ChapterContent {
  const { project, lang } = ctx;

  const threatCount =
    project.threatsPerElement.length + project.threatsPerInteraction.length;
  const riskCount =
    project.risksPerElement.length + project.risksPerInteraction.length;
  const criticalRiskCount = [
    ...project.risksPerElement,
    ...project.risksPerInteraction,
  ].filter((r) => r.riskBeforeMitigation >= 3.5).length;

  const values = {
    projectName: project.info.name,
    description: project.info.description || "-",
    assetCount: project.assets.length,
    threatCount,
    riskCount,
    wontRiskCount: project.wontRisks.length,
    criticalRiskCount,
  };

  const content = replacePlaceholders(templates.executiveSummary(lang), values);

  return {
    id: "executive-summary",
    title,
    content,
    hasContent: true,
  };
}

// ==================== SYSTEM OVERVIEW ====================

function generateSystemOverview(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  title: string
): ChapterContent {
  const { project, lang } = ctx;
  const info = project.info;

  const values = {
    description: info.description || "-",
    responsible: info.responsible || "-",
    team: info.team.length > 0 ? info.team.join(", ") : undefined,
    tags: info.tags.length > 0 ? info.tags.join(", ") : undefined,
  };

  let content = templates.systemOverview(lang);
  content = processConditionals(content, values);
  content = replacePlaceholders(content, values);

  return {
    id: "system-overview",
    title,
    content,
    hasContent: true,
  };
}

// ==================== DFD CHAPTER ====================

function generateDFDChapter(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  title: string
): ChapterContent {
  const { project, lang } = ctx;
  const dfd = project.dfd;

  if (!dfd.hasDFD) {
    return {
      id: "dfd",
      title,
      content: "",
      hasContent: false,
    };
  }

  const values = {
    imagePath: dfd.imagePath || "./images/dfd.png",
    externalEntities: dfd.stats?.externalEntities ?? 0,
    processes: dfd.stats?.processes ?? 0,
    dataStores: dfd.stats?.dataStores ?? 0,
    dataFlows: dfd.stats?.dataFlows ?? 0,
    trustBoundaries: dfd.stats?.trustBoundaries ?? 0,
    totalElements: dfd.stats?.totalElements ?? 0,
  };

  const content = replacePlaceholders(templates.dfd(lang), values);

  return {
    id: "dfd",
    title,
    content,
    hasContent: true,
  };
}

// ==================== ASSETS CHAPTER ====================

function generateAssetsChapter(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  escape: (text: string) => string,
  title: string
): ChapterContent {
  const { project, lang } = ctx;
  const assets = project.assets;

  if (assets.length === 0) {
    return {
      id: "assets",
      title,
      content: "",
      hasContent: false,
    };
  }

  // Generate asset rows
  const assetRows = assets
    .map((asset) => {
      const values = {
        id: asset.id,
        name: escape(truncateText(asset.name, 50)),
        // FIX: Use "-" if description is empty
        description: escape(
          truncateText(formatTextOrDash(asset.description), 100)
        ),
        impactLabel: asset.impactLabel,
        securityGoals: formatSecurityGoals(asset.securityGoals),
      };
      return replacePlaceholders(templates.assetRow, values);
    })
    .join("");

  const content = replacePlaceholders(templates.assets(lang), { assetRows });

  return {
    id: "assets",
    title,
    content,
    hasContent: true,
  };
}

// ==================== THREATS CHAPTER ====================

function generateThreatsChapter(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  escape: (text: string) => string,
  title: string,
  method: "per-element" | "per-interaction"
): ChapterContent {
  const { project, lang } = ctx;
  const threats =
    method === "per-element"
      ? project.threatsPerElement
      : project.threatsPerInteraction;

  const chapterId: DocChapterId =
    method === "per-element"
      ? "threats-per-element"
      : "threats-per-interaction";

  if (threats.length === 0) {
    return {
      id: chapterId,
      title,
      content: "",
      hasContent: false,
    };
  }

  // Generate threat rows - STRIDE removed, Verification added
  const threatRows = threats
    .map((threat) => {
      const values = {
        id: threat.id,
        strideCategory: threat.strideCategory,
        strideName: threat.strideName,
        elementOrFlow: escape(truncateText(threat.elementOrFlow, 40)),
        trustBoundary: escape(threat.trustBoundary || "-"),
        threatDescription: escape(truncateText(threat.threatDescription, 80)),
        attackDescription: escape(truncateText(threat.attackDescription, 80)),
        mitigation: escape(truncateText(threat.mitigation, 80)) || "-",
        // FIX: Include verification in output
        verification: escape(truncateText(threat.verification, 60)) || "-",
      };
      return replacePlaceholders(templates.threatRow, values);
    })
    .join("");

  let content = templates.threatsHeader(lang, method);
  content += replacePlaceholders(templates.threatsTable(lang), { threatRows });

  return {
    id: chapterId,
    title,
    content,
    hasContent: true,
  };
}

// ==================== RISKS CHAPTER ====================

function generateRisksChapter(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  escape: (text: string) => string,
  title: string,
  method: "per-element" | "per-interaction"
): ChapterContent {
  const { project, lang } = ctx;
  const risks =
    method === "per-element"
      ? project.risksPerElement
      : project.risksPerInteraction;

  const chapterId: DocChapterId =
    method === "per-element" ? "risks-per-element" : "risks-per-interaction";

  if (risks.length === 0) {
    return {
      id: chapterId,
      title,
      content: "",
      hasContent: false,
    };
  }

  // Generate risk rows - FIX: Use threatId instead of id, STRIDE removed
  const riskRows = risks
    .map((risk) => {
      const values = {
        id: risk.id,
        // FIX: Use threatId for traceability
        threatId: risk.threatId,
        strideCategory: risk.strideCategory,
        threatDescription: escape(truncateText(risk.threatDescription, 60)),
        riskBeforeLabel: risk.riskBeforeLabel,
        mitigations: escape(
          truncateText(formatMitigations(risk.selectedMitigations), 60)
        ),
        riskAfterLabel: risk.riskAfterLabel,
        moscowLabel: risk.moscowLabel,
        statusLabel: risk.statusLabel,
      };
      return replacePlaceholders(templates.riskRow, values);
    })
    .join("");

  let content = templates.risksHeader(lang, method);
  content += replacePlaceholders(templates.risksTable(lang), { riskRows });

  return {
    id: chapterId,
    title,
    content,
    hasContent: true,
  };
}

// ==================== ACCEPTED RISKS CHAPTER ====================

function generateAcceptedRisksChapter(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  escape: (text: string) => string,
  title: string
): ChapterContent {
  const { project, lang } = ctx;
  const wontRisks = project.wontRisks;

  if (wontRisks.length === 0) {
    return {
      id: "accepted-risks",
      title,
      content: "",
      hasContent: false,
    };
  }

  // Generate won't risk rows - FIX: Use threatId instead of id, STRIDE removed
  const wontRiskRows = wontRisks
    .map((risk) => {
      const values = {
        id: risk.id,
        // FIX: Use threatId for traceability
        threatId: risk.threatId,
        strideCategory: risk.strideCategory,
        threatDescription: escape(truncateText(risk.threatDescription, 60)),
        riskBeforeLabel: risk.riskBeforeLabel,
        justification: escape(risk.wontJustification || "-"),
      };
      return replacePlaceholders(templates.wontRiskRow, values);
    })
    .join("");

  const content = replacePlaceholders(templates.acceptedRisks(lang), {
    wontRiskRows,
  });

  return {
    id: "accepted-risks",
    title,
    content,
    hasContent: true,
  };
}

// ==================== APPENDIX ====================

function generateAppendix(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES,
  title: string
): ChapterContent {
  const { config, lang } = ctx;

  const values = {
    generatedDate: formatDocDate(new Date(), config.template.dateFormat),
    format: config.format === "markdown" ? "Markdown" : "AsciiDoc",
  };

  const content = replacePlaceholders(templates.appendix(lang), values);

  return {
    id: "appendix",
    title,
    content,
    hasContent: true,
  };
}

// ==================== FOOTER GENERATION ====================

function generateFooter(
  ctx: GenerationContext,
  templates: typeof MD_TEMPLATES | typeof ADOC_TEMPLATES
): string {
  const { config, lang } = ctx;

  const values = {
    footerText: config.template.footerText || "",
  };

  return replacePlaceholders(templates.footer(lang), values);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Process conditional sections in templates
 * Format: {{#variable}}content{{/variable}}
 */
function processConditionals(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  let result = template;

  // Find all conditional blocks
  // Using [\s\S] instead of . with s flag for ES5 compatibility
  const regex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

  result = result.replace(regex, (match, key, content) => {
    const value = values[key];
    // Show content only if value exists and is truthy
    if (value !== undefined && value !== null && value !== "") {
      return content;
    }
    return "";
  });

  return result;
}

// ==================== VALIDATION ====================

/**
 * Validate project data for documentation generation
 */
export function validateProjectForDoc(project: DocProjectData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!project.info.name) {
    errors.push("Project name is required");
  }

  // Check for empty sections (warnings)
  if (!project.dfd.hasDFD) {
    warnings.push("No DFD available");
  }

  if (project.assets.length === 0) {
    warnings.push("No assets defined");
  }

  if (
    project.threatsPerElement.length === 0 &&
    project.threatsPerInteraction.length === 0
  ) {
    warnings.push("No threats identified");
  }

  if (
    project.risksPerElement.length === 0 &&
    project.risksPerInteraction.length === 0
  ) {
    warnings.push("No risks assessed");
  }

  // Check for won't risks without justification
  const missingJustifications = project.wontRisks.filter(
    (r) => !r.wontJustification || r.wontJustification.trim() === ""
  );
  if (missingJustifications.length > 0) {
    warnings.push(
      `${missingJustifications.length} accepted risk(s) missing justification`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==================== EXPORT HELPERS ====================

/**
 * Get file extension for format
 */
export function getFileExtension(format: "markdown" | "asciidoc"): string {
  return format === "markdown" ? "md" : "adoc";
}

/**
 * Generate filename for export
 */
export function generateFilename(
  projectName: string,
  format: "markdown" | "asciidoc"
): string {
  const sanitized = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const date = new Date().toISOString().split("T")[0];
  const ext = getFileExtension(format);

  return `${sanitized}-tara-${date}.${ext}`;
}