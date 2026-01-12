// ==================== BASE DOCUMENT GENERATOR ====================
// Abstract base class for document generators
// Location: features/documentation/utils/generators/base-generator.ts

import type {
  DocConfiguration,
  DocProjectData,
  DocLanguage,
  DocChapterId,
  DocDFDElement,
  DocDFDConnection,
  DocDFDElementType,
} from "../../models/doc-types";
import {
  getChapterTitle,
  isChapterVisible,
  formatDocDate,
  getClassificationText,
  getCriticalityText,
  getSecurityLevelText,
  getTrustLevelText,
  getDFDElementTypeText,
} from "../../models/doc-types";
import {
  replacePlaceholders,
  processConditionals,
  truncateText,
  formatSecurityGoals,
  formatMitigations,
  getYesNoText,
} from "../templates";
// NOTE: Adjust import path based on your project structure:
// - Relative: "../../../../shared/utils/tag-categories"
// - Alias: "@/shared/utils/tag-categories" or "@shared/utils/tag-categories"
// - Barrel: "shared" (if shared/index.ts exports it)
import {
  TAG_CATEGORIES,
  getRegulationTags,
} from "../../../../shared/utils/tag-categories";

// ==================== TYPES ====================

export type TranslationFn = (key: string, defaultValue?: string) => string;

export interface GenerationContext {
  project: DocProjectData;
  config: DocConfiguration;
  lang: DocLanguage;
  t: TranslationFn;
}

export interface ChapterContent {
  id: DocChapterId;
  title: string;
  content: string;
  hasContent: boolean;
}

export interface DocumentGeneratorResult {
  content: string;
  format: string;
  filename: string;
}

// ==================== ABSTRACT BASE CLASS ====================

export abstract class BaseDocumentGenerator {
  protected ctx: GenerationContext;

  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn
  ) {
    this.ctx = {
      project,
      config,
      lang: config.language,
      t,
    };
  }

  // ==================== ABSTRACT METHODS ====================
  // Must be implemented by concrete generators

  /** Get format name (e.g., "markdown", "asciidoc") */
  abstract getFormat(): string;

  /** Get file extension (e.g., "md", "adoc") */
  abstract getFileExtension(): string;

  /** Escape text for tables */
  abstract escapeTableText(text: string): string;

  /** Format tags grouped by category */
  abstract formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>
  ): string;

  // Template getters - must be implemented
  abstract getHeaderTemplate(): string;
  abstract getTocTemplate(): string;
  abstract getExecutiveSummaryTemplate(): string;
  abstract getApplicableRegulationsTemplate(): string;
  abstract getRegulationEntryTemplate(): string;
  abstract getSystemOverviewTemplate(): string;
  abstract getDfdTemplate(): string;
  abstract getDfdDescriptionsTemplate(): string;
  abstract getDfdElementTypeHeaderTemplate(): string;
  abstract getDfdElementEntryTemplate(): string;
  abstract getDfdDataFlowsHeaderTemplate(): string;
  abstract getDfdConnectionEntryTemplate(): string;
  abstract getAssetsTemplate(): string;
  abstract getAssetRowTemplate(): string;
  abstract getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string;
  abstract getThreatsTableTemplate(): string;
  abstract getThreatRowTemplate(): string;
  abstract getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string;
  abstract getRisksTableTemplate(): string;
  abstract getRiskRowTemplate(): string;
  abstract getAcceptedRisksTemplate(): string;
  abstract getWontRiskRowTemplate(): string;
  abstract getAppendixTemplate(): string;
  abstract getFooterTemplate(): string;

  // ==================== PUBLIC API ====================

  /**
   * Generate the complete document
   */
  generate(): DocumentGeneratorResult {
    const chapters = this.generateAllChapters();
    
    let content = "";
    content += this.generateHeader();
    content += this.generateToc(chapters);
    
    for (const chapter of chapters) {
      const chapterConfig = this.ctx.config.chapters.find((c) => c.id === chapter.id);
      if (chapterConfig && isChapterVisible(chapterConfig, chapter.hasContent)) {
        content += chapter.content;
      }
    }
    
    content += this.generateFooter();

    return {
      content,
      format: this.getFormat(),
      filename: this.generateFilename(),
    };
  }

  /**
   * Generate filename for export
   */
  generateFilename(): string {
    const sanitized = this.ctx.project.info.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const date = new Date().toISOString().split("T")[0];
    return `${sanitized}-tara-${date}.${this.getFileExtension()}`;
  }

  // ==================== CHAPTER GENERATION ====================

  protected generateAllChapters(): ChapterContent[] {
    const chapters: ChapterContent[] = [];

    for (const chapterConfig of this.ctx.config.chapters) {
      const chapter = this.generateChapter(chapterConfig.id);
      chapters.push(chapter);
    }

    return chapters;
  }

  protected generateChapter(chapterId: DocChapterId): ChapterContent {
    const chapterConfig = this.ctx.config.chapters.find((c) => c.id === chapterId);
    const title = getChapterTitle(
      chapterId,
      this.ctx.lang,
      chapterConfig?.customTitle,
      chapterConfig?.customTitleDE
    );

    switch (chapterId) {
      case "executive-summary":
        return this.generateExecutiveSummary(title);
      case "applicable-regulations":
        return this.generateApplicableRegulations(title);
      case "system-overview":
        return this.generateSystemOverview(title);
      case "dfd":
        return this.generateDfd(title);
      case "dfd-descriptions":
        return this.generateDfdDescriptions(title);
      case "assets":
        return this.generateAssets(title);
      case "threats-per-element":
        return this.generateThreats(title, "per-element");
      case "threats-per-interaction":
        return this.generateThreats(title, "per-interaction");
      case "risks-per-element":
        return this.generateRisks(title, "per-element");
      case "risks-per-interaction":
        return this.generateRisks(title, "per-interaction");
      case "accepted-risks":
        return this.generateAcceptedRisks(title);
      case "appendix":
        return this.generateAppendix(title);
      default:
        return { id: chapterId, title, content: "", hasContent: false };
    }
  }

  // ==================== HEADER & FOOTER ====================

  protected generateHeader(): string {
    const { project, config, lang, t } = this.ctx;
    const info = project.info;

    const classificationText = config.template.classification
      ? getClassificationText(config.template.classification, lang)
      : "";

    const tagsByCategory = this.getTagsGroupedByCategory(info.tags);
    const tagsGrouped = this.formatTagsGrouped(tagsByCategory);

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
        ? this.formatClassification(classificationText)
        : "",
      criticality: getCriticalityText(info.isHighImpact, lang),
      tagsGrouped,
      team: info.team.length > 0 ? info.team.join(", ") : undefined,
    };

    let header = this.getHeaderTemplate();
    header = processConditionals(header, values);
    return replacePlaceholders(header, values);
  }

  protected abstract formatClassification(text: string): string;

  protected generateToc(chapters: ChapterContent[]): string {
    if (!this.ctx.config.template.includeToc) {
      return "";
    }
    return this.generateTocContent(chapters);
  }

  protected abstract generateTocContent(chapters: ChapterContent[]): string;

  protected generateFooter(): string {
    const values = {
      footerText: this.ctx.config.template.footerText || "",
    };
    return replacePlaceholders(this.getFooterTemplate(), values);
  }

  // ==================== EXECUTIVE SUMMARY ====================

  protected generateExecutiveSummary(title: string): ChapterContent {
    const { project } = this.ctx;

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

    const content = replacePlaceholders(this.getExecutiveSummaryTemplate(), values);

    return {
      id: "executive-summary",
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== APPLICABLE REGULATIONS ====================

  protected generateApplicableRegulations(title: string): ChapterContent {
    const { project, t } = this.ctx;

    const regulationTags = getRegulationTags(project.info.tags);

    if (regulationTags.length === 0) {
      return {
        id: "applicable-regulations",
        title,
        content: "",
        hasContent: false,
      };
    }

    const regulationEntries = regulationTags
      .map((tagDef) => {
        const description = tagDef.docDescriptionKey
          ? t(tagDef.docDescriptionKey, tagDef.name)
          : t(`tags.tooltips.${tagDef.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`, tagDef.name);

        return replacePlaceholders(this.getRegulationEntryTemplate(), {
          regulationName: tagDef.name,
          regulationDescription: description,
        });
      })
      .join("");

    const content = replacePlaceholders(this.getApplicableRegulationsTemplate(), {
      regulationEntries,
    });

    return {
      id: "applicable-regulations",
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== SYSTEM OVERVIEW ====================

  protected generateSystemOverview(title: string): ChapterContent {
    const { project } = this.ctx;
    const info = project.info;

    const tagsByCategory = this.getTagsGroupedByCategory(info.tags);
    const tagsGrouped = this.formatTagsGrouped(tagsByCategory);

    const values = {
      description: info.description || "-",
      responsible: info.responsible || "-",
      team: info.team.length > 0 ? info.team.join(", ") : undefined,
      tagsGrouped,
    };

    let content = this.getSystemOverviewTemplate();
    content = processConditionals(content, values);
    content = replacePlaceholders(content, values);

    return {
      id: "system-overview",
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== DFD ====================

  protected generateDfd(title: string): ChapterContent {
    const { project } = this.ctx;
    const dfd = project.dfd;

    if (!dfd.hasDFD) {
      return {
        id: "dfd",
        title,
        content: "",
        hasContent: false,
      };
    }

    const stats = dfd.stats || {
      totalElements: 0,
      externalEntities: 0,
      processes: 0,
      dataStores: 0,
      dataFlows: 0,
      trustBoundaries: 0,
    };

    const values = {
      imagePath: dfd.imagePath || "dfd.png",
      externalEntities: stats.externalEntities,
      processes: stats.processes,
      dataStores: stats.dataStores,
      dataFlows: stats.dataFlows,
      trustBoundaries: stats.trustBoundaries,
      totalElements: stats.totalElements,
    };

    const content = replacePlaceholders(this.getDfdTemplate(), values);

    return {
      id: "dfd",
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== DFD DESCRIPTIONS ====================

  protected generateDfdDescriptions(title: string): ChapterContent {
    const { project, lang } = this.ctx;
    const dfd = project.dfd;

    // Safe access with optional chaining
    const elements = dfd.elements ?? [];
    const connections = dfd.connections ?? [];

    const hasElements = elements.length > 0;
    const hasConnections = connections.length > 0;

    if (!hasElements && !hasConnections) {
      return {
        id: "dfd-descriptions",
        title,
        content: "",
        hasContent: false,
      };
    }

    const elementTypeOrder: DocDFDElementType[] = [
      "ExternalEntity",
      "Process",
      "Multiprocess",
      "DataStore",
      "TrustBoundary",
      "PhysicalInterface",
      "Interface",
    ];

    let elementSections = "";

    for (const elementType of elementTypeOrder) {
      const elementsOfType = elements.filter((e) => e.type === elementType);

      if (elementsOfType.length === 0) continue;

      elementSections += replacePlaceholders(this.getDfdElementTypeHeaderTemplate(), {
        elementTypeName: getDFDElementTypeText(elementType, lang),
      });

      for (const element of elementsOfType) {
        elementSections += this.generateDfdElementEntry(element);
      }
    }

    if (hasConnections) {
      elementSections += this.getDfdDataFlowsHeaderTemplate();

      for (const connection of connections) {
        elementSections += this.generateDfdConnectionEntry(connection);
      }
    }

    const content = replacePlaceholders(this.getDfdDescriptionsTemplate(), {
      elementSections,
    });

    return {
      id: "dfd-descriptions",
      title,
      content,
      hasContent: true,
    };
  }

  protected generateDfdElementEntry(element: DocDFDElement): string {
    const { lang } = this.ctx;

    const values = {
      displayId: element.displayId || element.id,
      name: this.escapeTableText(element.name),
      description: this.escapeTableText(element.properties.description ?? "-"),
      securityLevel: getSecurityLevelText(
        element.properties.securityLevel ?? "none",
        lang
      ),
      trustLevel: getTrustLevelText(element.properties.trustLevel, lang),
      authRequired: getYesNoText(
        element.properties.authenticationRequired ?? false,
        lang
      ),
      encryptionRequired: getYesNoText(
        element.properties.encryptionRequired ?? false,
        lang
      ),
      securityNotes: element.properties.securityNotes
        ? this.escapeTableText(element.properties.securityNotes)
        : undefined,
    };

    let content = this.getDfdElementEntryTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  protected generateDfdConnectionEntry(connection: DocDFDConnection): string {
    const { lang } = this.ctx;

    const values = {
      displayId: connection.displayId || connection.id,
      fromElement: this.escapeTableText(connection.fromElement),
      toElement: this.escapeTableText(connection.toElement),
      label: connection.label
        ? this.escapeTableText(connection.label)
        : undefined,
      description: this.escapeTableText(
        connection.properties.description ?? "-"
      ),
      securityLevel: getSecurityLevelText(
        connection.properties.securityLevel ?? "none",
        lang
      ),
      authRequired: getYesNoText(
        connection.properties.authenticationRequired ?? false,
        lang
      ),
      encryptionRequired: getYesNoText(
        connection.properties.encryptionRequired ?? false,
        lang
      ),
      securityNotes: connection.properties.securityNotes
        ? this.escapeTableText(connection.properties.securityNotes)
        : undefined,
    };

    let content = this.getDfdConnectionEntryTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  // ==================== ASSETS ====================

  protected generateAssets(title: string): ChapterContent {
    const { project } = this.ctx;
    const assets = project.assets;

    if (assets.length === 0) {
      return {
        id: "assets",
        title,
        content: "",
        hasContent: false,
      };
    }

    const assetRows = assets
      .map((asset) => {
        const values = {
          id: asset.id,
          name: this.escapeTableText(asset.name),
          description: this.escapeTableText(truncateText(asset.description, 60)),
          impactLabel: asset.impactLabel,
          securityGoals: formatSecurityGoals(asset.securityGoals),
        };
        return replacePlaceholders(this.getAssetRowTemplate(), values);
      })
      .join("");

    const content = replacePlaceholders(this.getAssetsTemplate(), { assetRows });

    return {
      id: "assets",
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== THREATS ====================

  protected generateThreats(
    title: string,
    method: "per-element" | "per-interaction"
  ): ChapterContent {
    const { project } = this.ctx;
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

    const threatRows = threats
      .map((threat) => {
        const values = {
          id: threat.id,
          strideCategory: threat.strideCategory,
          strideName: threat.strideName,
          elementOrFlow: this.escapeTableText(truncateText(threat.elementOrFlow, 40)),
          trustBoundary: this.escapeTableText(threat.trustBoundary || "-"),
          threatDescription: this.escapeTableText(truncateText(threat.threatDescription, 80)),
          attackDescription: this.escapeTableText(truncateText(threat.attackDescription, 80)),
          mitigation: this.escapeTableText(truncateText(threat.mitigation, 80)) || "-",
          verification: this.escapeTableText(truncateText(threat.verification, 60)) || "-",
        };
        return replacePlaceholders(this.getThreatRowTemplate(), values);
      })
      .join("");

    let content = this.getThreatsHeaderTemplate(method);
    content += replacePlaceholders(this.getThreatsTableTemplate(), { threatRows });

    return {
      id: chapterId,
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== RISKS ====================

  protected generateRisks(
    title: string,
    method: "per-element" | "per-interaction"
  ): ChapterContent {
    const { project } = this.ctx;
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

    const riskRows = risks
      .map((risk) => {
        const values = {
          id: risk.id,
          threatId: risk.threatId,
          strideCategory: risk.strideCategory,
          threatDescription: this.escapeTableText(truncateText(risk.threatDescription, 60)),
          riskBeforeLabel: risk.riskBeforeLabel,
          mitigations: this.escapeTableText(
            truncateText(formatMitigations(risk.selectedMitigations), 60)
          ),
          riskAfterLabel: risk.riskAfterLabel,
          moscowLabel: risk.moscowLabel,
          statusLabel: risk.statusLabel,
        };
        return replacePlaceholders(this.getRiskRowTemplate(), values);
      })
      .join("");

    let content = this.getRisksHeaderTemplate(method);
    content += replacePlaceholders(this.getRisksTableTemplate(), { riskRows });

    return {
      id: chapterId,
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== ACCEPTED RISKS ====================

  protected generateAcceptedRisks(title: string): ChapterContent {
    const { project } = this.ctx;
    const wontRisks = project.wontRisks;

    if (wontRisks.length === 0) {
      return {
        id: "accepted-risks",
        title,
        content: "",
        hasContent: false,
      };
    }

    const wontRiskRows = wontRisks
      .map((risk) => {
        const values = {
          id: risk.id,
          threatId: risk.threatId,
          strideCategory: risk.strideCategory,
          threatDescription: this.escapeTableText(truncateText(risk.threatDescription, 60)),
          riskBeforeLabel: risk.riskBeforeLabel,
          justification: this.escapeTableText(risk.wontJustification || "-"),
        };
        return replacePlaceholders(this.getWontRiskRowTemplate(), values);
      })
      .join("");

    const content = replacePlaceholders(this.getAcceptedRisksTemplate(), {
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

  protected generateAppendix(title: string): ChapterContent {
    const { config } = this.ctx;

    const values = {
      generatedDate: formatDocDate(new Date(), config.template.dateFormat),
      format: this.getFormat() === "markdown" ? "Markdown" : "AsciiDoc",
    };

    const content = replacePlaceholders(this.getAppendixTemplate(), values);

    return {
      id: "appendix",
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== HELPERS ====================

  protected getTagsGroupedByCategory(
    tags: string[]
  ): Array<{ categoryLabel: string; tags: string[] }> {
    const { lang, t } = this.ctx;
    const result: Array<{ categoryLabel: string; tags: string[] }> = [];

    TAG_CATEGORIES.forEach((category) => {
      const categoryTags = tags.filter((tag) => {
        const tagDef = category.tags.find((td) => td.name === tag);
        return tagDef !== undefined;
      });

      if (categoryTags.length > 0) {
        const categoryLabel = t(category.labelKey, category.key);
        result.push({ categoryLabel, tags: categoryTags });
      }
    });

    // Custom tags (not in any category)
    const allCategoryTags = TAG_CATEGORIES.flatMap((c) => c.tags.map((td) => td.name));
    const customTags = tags.filter((tag) => !allCategoryTags.includes(tag));

    if (customTags.length > 0) {
      const customLabel = lang === "de" ? "Sonstige" : "Other";
      result.push({ categoryLabel: customLabel, tags: customTags });
    }

    return result;
  }
}