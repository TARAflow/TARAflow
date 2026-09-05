// ==================== BASE DOCUMENT GENERATOR ====================
// Abstract base class for document generators
// Location: features/documentation/utils/generators/base-generator.ts

import type {
  DocConfiguration,
  DocProjectData,
  DocLanguage,
  DocChapterId,
} from "../../models/doc-types";
import {
  getChapterTitle,
  isChapterVisible,
  formatDocDate,
  getClassificationText,
  getCriticalityText,
} from "../../models/doc-types";
import type {
  DFDElement,
  DFDConnection,
  DFDElementType,
} from "../../../dfd/models/dfd-types";
import type { Asset } from "features/assets";
import { deriveImplementationProgress } from "../../../risks/models/risk-mitigation-types";
import {
  en50742LevelFromRating,
  mandatedRequirementsForThreat,
} from "../../../risks/models/en50742-approach-a-core";
import type { SrslAnchorType } from "../../../risks/models/en50742-approach-a-core";
import {
  getSecurityLevelText,
  getTrustLevelText,
  getDFDElementTypeText,
  getDFDElementTypePluralText,
} from "../../../dfd/models/dfd-formatters";
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
import { flattenProjectTags } from "../../../../shared/models/project-tags";
import {
  getElementSecurityLevel,
  getElementTrustLevel,
  isElementAuthenticationRequired,
  isElementEncryptionRequired,
  getElementSecurityNotes,
  getConnectionSecurityLevel,
  isConnectionAuthenticationRequired,
  isConnectionEncryptionRequired,
  getConnectionSecurityNotes,
  getElementPropertiesGrouped,
  getConnectionPropertiesGrouped,
  formatElementAssetRelations,
  formatConnectionAssetRelations,
  getAssetIdList,
  getRelationTypeLabel,
  type PropertyGroup,
  type PropertyEntry,
} from "./property-doc-mappers";

import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
} from "../../../threats/services/threat-catalog-service";

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
    t: TranslationFn,
  ) {
    this.ctx = {
      project,
      config,
      lang: config.language,
      t,
    };
  }

  /** Resolve an asset id to its display name (falls back to the id). */
  protected resolveAssetName = (assetId: string): string =>
    this.ctx.project.assets?.assets?.find((a) => a.id === assetId)?.name ??
    assetId;

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
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
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
  abstract getThreatsHeaderTemplate(
    method: "per-element" | "per-interaction",
  ): string;
  abstract getThreatsTableTemplate(): string;
  abstract getThreatRowTemplate(): string;
  abstract getRisksHeaderTemplate(
    method: "per-element" | "per-interaction",
  ): string;
  abstract getRisksTableTemplate(): string;
  abstract getRiskRowTemplate(): string;
  // EN 50742 SRSL table — default empty so a format that has not implemented
  // it yet simply produces no SRSL chapter (auto-hidden). Overridden in the
  // markdown and asciidoc generators.
  protected getSRSLHeaderTemplate(): string {
    return "";
  }
  protected getSRSLTableTemplate(): string {
    return "";
  }
  protected getSRSLRowTemplate(): string {
    return "";
  }
  abstract getAcceptedRisksTemplate(): string;
  abstract getWontRiskRowTemplate(): string;
  abstract getAppendixTemplate(): string;
  abstract getFooterTemplate(): string;
  abstract getDfdElementOverviewTableTemplate(): string;
  abstract getElementOverviewRowTemplate(): string;
  abstract getDfdElementDetailedEntryTemplate(): string;
  abstract getDfdConnectionDetailedEntryTemplate(): string;
  abstract getPropertyGroupTemplate(): string;
  abstract getPropertyEntryTemplate(): string;
  abstract getAssetElementRelationsTemplate(): string;
  abstract getAssetRelationSectionTemplate(): string;
  abstract getElementRelationEntryTemplate(): string;
  abstract getNoAssetRelationsTemplate(): string;

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
      const chapterConfig = this.ctx.config.chapters.find(
        (c) => c.id === chapter.id,
      );
      if (
        chapterConfig &&
        isChapterVisible(chapterConfig, chapter.hasContent)
      ) {
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
    const chapterConfig = this.ctx.config.chapters.find(
      (c) => c.id === chapterId,
    );
    const title = getChapterTitle(
      chapterId,
      this.ctx.lang,
      chapterConfig?.customTitle,
      chapterConfig?.customTitleDE,
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
      case "asset-element-relations": // <-- ADD THIS CASE
        return this.generateAssetElementRelations(title);
      case "threats-per-element":
        return this.generateThreats(title, "per-element");
      case "threats-per-interaction":
        return this.generateThreats(title, "per-interaction");
      case "risks-per-element":
        return this.generateRisks(title, "per-element");
      case "risks-per-interaction":
        return this.generateRisks(title, "per-interaction");
      case "srsl-assessment":
        return this.generateSRSLAssessment(title);
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

    const tagsByCategory = this.getTagsGroupedByCategory(
      flattenProjectTags(info.tags),
    );
    const tagsGrouped = this.formatTagsGrouped(tagsByCategory);

    const values = {
      projectName: info.name,
      version:
        config.template.versionMode === "custom" &&
        config.template.customVersion
          ? config.template.customVersion
          : info.version,
      responsible: info.responsible || "-",
      created: formatDocDate(info.created, config.template.dateFormat),
      lastModified: formatDocDate(
        info.lastModified,
        config.template.dateFormat,
      ),
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

    // Count threats from tables
    const perElementThreats =
      project.threats?.perElementTables?.flatMap((t) => t.threats) ?? [];
    const perInteractionThreats =
      project.threats?.perInteractionTables?.flatMap((t) => t.threats) ?? [];
    const threatCount = perElementThreats.length + perInteractionThreats.length;

    // Count risks (excluding won't)
    const allRisks = project.risks?.risks ?? [];
    const activeRisks = allRisks.filter((r) => r.moscowPriority !== "wont");
    const riskCount = activeRisks.length;
    const wontRiskCount = allRisks.filter(
      (r) => r.moscowPriority === "wont",
    ).length;

    // Count critical risks (before mitigation >= 3.5)
    const criticalRiskCount = activeRisks.filter(
      (r) => r.calculatedRiskBeforeMitigation >= 3.5,
    ).length;

    const values = {
      projectName: project.info.name,
      description: project.info.description || "-",
      assetCount: project.assets?.assets?.length ?? 0,
      threatCount,
      riskCount,
      wontRiskCount,
      criticalRiskCount,
    };

    const content = replacePlaceholders(
      this.getExecutiveSummaryTemplate(),
      values,
    );

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

    const regulationTags = getRegulationTags(
      flattenProjectTags(project.info.tags),
    );

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
          : t(
              `tags.tooltips.${tagDef.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
              tagDef.name,
            );

        return replacePlaceholders(this.getRegulationEntryTemplate(), {
          regulationName: tagDef.name,
          regulationDescription: description,
        });
      })
      .join("");

    const content = replacePlaceholders(
      this.getApplicableRegulationsTemplate(),
      {
        regulationEntries,
      },
    );

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

    const tagsByCategory = this.getTagsGroupedByCategory(
      flattenProjectTags(info.tags),
    );
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

    if (!dfd) {
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
      imagePath: dfd.thumbnail || "dfd.png",
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
    const { project, t } = this.ctx;

    if (
      !project.dfd ||
      !project.dfd.elements ||
      project.dfd.elements.length === 0
    ) {
      return {
        id: "dfd-descriptions",
        title,
        content: "",
        hasContent: false,
      };
    }

    const elements = project.dfd.elements;
    const connections = project.dfd.connections ?? [];

    // Generate overview table
    const elementRows = elements
      .map((element) => {
        const values = {
          displayId: element.displayId || element.id,
          name: this.escapeTableText(element.name),
          type: getDFDElementTypeText(element.type, this.ctx.t),
          description: this.escapeTableText(
            truncateText(element.description ?? "-", 60),
          ),
          assets: this.escapeTableText(getAssetIdList(element, this.resolveAssetName)),
        };
        return replacePlaceholders(
          this.getElementOverviewRowTemplate(),
          values,
        );
      })
      .join("");

    let content = replacePlaceholders(
      this.getDfdElementOverviewTableTemplate(),
      {
        elementRows,
      },
    );

    // Group elements by type
    const elementsByType = new Map<DFDElementType, DFDElement[]>();
    elements.forEach((elem) => {
      if (!elementsByType.has(elem.type)) {
        elementsByType.set(elem.type, []);
      }
      elementsByType.get(elem.type)!.push(elem);
    });

    // Generate detailed sections for each type
    for (const [elementType, typeElements] of elementsByType) {
      // Skip DataFlow as it's handled separately
      if (elementType === "DataFlow") continue;

      const typeHeader = replacePlaceholders(
        this.getDfdElementTypeHeaderTemplate(),
        {
          elementTypeName: getDFDElementTypePluralText(elementType, t),
        },
      );
      content += typeHeader;

      for (const element of typeElements) {
        content += this.generateDfdElementDetailedEntry(element);
      }
    }

    // Data Flows section
    if (connections.length > 0) {
      content += this.getDfdDataFlowsHeaderTemplate();

      for (const connection of connections) {
        content += this.generateDfdConnectionDetailedEntry(connection);
      }
    }

    return {
      id: "dfd-descriptions",
      title,
      content,
      hasContent: true,
    };
  }

  /**
   * Generate detailed element entry with grouped properties
   */
  protected generateDfdElementDetailedEntry(element: DFDElement): string {
    const { lang } = this.ctx;

    const propertyGroups = getElementPropertiesGrouped(element, lang);
    const propertyGroupsText = this.formatPropertyGroups(propertyGroups);
    const assetRelations = formatElementAssetRelations(element, lang, this.resolveAssetName);

    const values = {
      displayId: element.displayId || element.id,
      name: this.escapeTableText(element.name),
      propertyGroups: propertyGroupsText,
      assetRelations:
        assetRelations !== "N/A"
          ? this.escapeTableText(assetRelations)
          : undefined,
    };

    let content = this.getDfdElementDetailedEntryTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  /**
   * Generate detailed connection entry with grouped properties
   */
  protected generateDfdConnectionDetailedEntry(
    connection: DFDConnection,
  ): string {
    const { lang, project } = this.ctx;

    // Lookup element names from IDs
    const fromElement =
      project.dfd?.elements?.find((e) => e.id === connection.from)?.name ||
      connection.from;
    const toElement =
      project.dfd?.elements?.find((e) => e.id === connection.to)?.name ||
      connection.to;

    const propertyGroups = getConnectionPropertiesGrouped(connection, lang);
    const propertyGroupsText = this.formatPropertyGroups(propertyGroups);
    const assetRelations = formatConnectionAssetRelations(connection, lang, this.resolveAssetName);

    const values = {
      displayId: connection.displayId || connection.id,
      fromElement: this.escapeTableText(fromElement),
      toElement: this.escapeTableText(toElement),
      label: connection.name
        ? this.escapeTableText(connection.name)
        : undefined,
      propertyGroups: propertyGroupsText,
      assetRelations:
        assetRelations !== "N/A"
          ? this.escapeTableText(assetRelations)
          : undefined,
    };

    let content = this.getDfdConnectionDetailedEntryTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  /** Properties worth showing — drops empty / "N/A" entries. */
  protected getVisibleProperties(group: PropertyGroup): PropertyEntry[] {
    return group.properties.filter(
      (p) => p.value && p.value.trim() !== "" && p.value !== "N/A",
    );
  }

  /**
   * Format property groups into template string
   */
  protected formatPropertyGroups(groups: PropertyGroup[]): string {
    return groups
      .map((group) => {
        const visible = this.getVisibleProperties(group);
        if (visible.length === 0) return ""; // skip empty group entirely

        const propertiesText = visible
          .map((prop) =>
            replacePlaceholders(this.getPropertyEntryTemplate(), {
              label: prop.label,
              value: this.escapeTableText(prop.value),
            }),
          )
          .join("");

        return replacePlaceholders(this.getPropertyGroupTemplate(), {
          groupName: group.groupName,
          properties: propertiesText,
        });
      })
      .filter(Boolean)
      .join("");
  }

  /**
   * Generate Asset-Element Relations chapter
   */
  protected generateAssetElementRelations(title: string): ChapterContent {
    const { project, t } = this.ctx;

    const assets = project.assets?.assets ?? [];

    if (assets.length === 0) {
      return {
        id: "asset-element-relations",
        title,
        content: "",
        hasContent: false,
      };
    }

    // Check if any asset has element relations
    const hasRelations = assets.some(
      (asset) => asset.linkedDFDElements && asset.linkedDFDElements.length > 0,
    );

    if (!hasRelations) {
      const content = this.getAssetElementRelationsTemplate().replace(
        "{{assetSections}}",
        this.getNoAssetRelationsTemplate(),
      );
      return {
        id: "asset-element-relations",
        title,
        content,
        hasContent: false,
      };
    }

    // Generate sections for each asset with relations
    const assetSections = assets
      .filter(
        (asset) =>
          asset.linkedDFDElements && asset.linkedDFDElements.length > 0,
      )
      .map((asset) => this.generateAssetRelationSection(asset))
      .join("");

    const content = replacePlaceholders(
      this.getAssetElementRelationsTemplate(),
      {
        assetSections,
      },
    );

    return {
      id: "asset-element-relations",
      title,
      content,
      hasContent: true,
    };
  }

  /**
   * Generate section for one asset's element relations
   */
  protected generateAssetRelationSection(asset: Asset): string {
    const { t, lang } = this.ctx;

    const elementRelations = (asset.linkedDFDElements ?? [])
      .map((elemRel) => {
        const relationTypes = elemRel.relationType
          ? getRelationTypeLabel(elemRel.relationType, lang)
          : "";

        const values = {
          elementDisplayId: elemRel.displayId,
          elementType: getDFDElementTypeText(
            elemRel.elementType as DFDElementType,
            t,
          ),
          elementName: this.escapeTableText(elemRel.elementName),
          relationTypes: this.escapeTableText(relationTypes),
          notes: elemRel.notes
            ? this.escapeTableText(elemRel.notes)
            : undefined,
        };

        let content = this.getElementRelationEntryTemplate();
        content = processConditionals(content, values);
        return replacePlaceholders(content, values);
      })
      .join("");

    const values = {
      assetId: asset.id,
      assetDisplayId: asset.displayId ?? asset.id,
      assetName: this.escapeTableText(asset.name),
      assetDescription: asset.properties?.description
        ? this.escapeTableText(asset.properties.description)
        : undefined,
      elementRelations,
    };

    let content = this.getAssetRelationSectionTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  protected generateDfdElementEntry(element: DFDElement): string {
    const { t, lang } = this.ctx;

    const values = {
      displayId: element.displayId || element.id,
      name: this.escapeTableText(element.name),
      description: this.escapeTableText(element.description ?? "-"),
      securityLevel: getSecurityLevelText(getElementSecurityLevel(element), t),
      trustLevel: getTrustLevelText(getElementTrustLevel(element), t),
      authRequired: getYesNoText(
        isElementAuthenticationRequired(element),
        lang,
      ),
      encryptionRequired: getYesNoText(
        isElementEncryptionRequired(element),
        lang,
      ),
      securityNotes: getElementSecurityNotes(element)
        ? this.escapeTableText(getElementSecurityNotes(element)!)
        : undefined,
    };

    let content = this.getDfdElementEntryTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  protected generateDfdConnectionEntry(connection: DFDConnection): string {
    const { lang, project, t } = this.ctx;

    // Lookup element names from IDs
    const fromElement =
      project.dfd?.elements?.find((e) => e.id === connection.from)?.name ||
      connection.from;
    const toElement =
      project.dfd?.elements?.find((e) => e.id === connection.to)?.name ||
      connection.to;

    const values = {
      displayId: connection.displayId || connection.id,
      fromElement: this.escapeTableText(fromElement),
      toElement: this.escapeTableText(toElement),
      label: connection.name
        ? this.escapeTableText(connection.name)
        : undefined,
      description: this.escapeTableText(connection.description ?? "-"),
      securityLevel: getSecurityLevelText(
        getConnectionSecurityLevel(connection),
        t,
      ),
      authRequired: getYesNoText(
        isConnectionAuthenticationRequired(connection),
        lang,
      ),
      encryptionRequired: getYesNoText(
        isConnectionEncryptionRequired(connection),
        lang,
      ),
      securityNotes: getConnectionSecurityNotes(connection)
        ? this.escapeTableText(getConnectionSecurityNotes(connection)!)
        : undefined,
    };

    let content = this.getDfdConnectionEntryTemplate();
    content = processConditionals(content, values);
    return replacePlaceholders(content, values);
  }

  // ==================== ASSETS ====================

  protected generateAssets(title: string): ChapterContent {
    const { project } = this.ctx;
    const assets = project.assets?.assets ?? [];

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
        // Get cached label or calculate
        const impactLabel =
          project.computed.impactLabels.get(asset.id) ??
          asset.overallImpact.toString();

        // Filter enabled goals and map to format expected by formatSecurityGoals
        const enabledGoals = asset.securityGoals
          .filter((g) => g.level !== "none")
          .map((g) => ({ type: g.type, description: g.formalDescription }));

        const values = {
          id: asset.id,
          name: this.escapeTableText(asset.name),
          description: this.escapeTableText(
            truncateText(asset.properties?.description ?? "-", 60),
          ),
          impactLabel,
          securityGoals: formatSecurityGoals(enabledGoals),
        };
        return replacePlaceholders(this.getAssetRowTemplate(), values);
      })
      .join("");

    const content = replacePlaceholders(this.getAssetsTemplate(), {
      assetRows,
    });

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
    method: "per-element" | "per-interaction",
  ): ChapterContent {
    const { project } = this.ctx;

    // Get threat tables for the method
    const tables =
      method === "per-element"
        ? (project.threats?.perElementTables ?? [])
        : (project.threats?.perInteractionTables ?? []);

    // Flatten tables to get all threats
    const threats = tables.flatMap((table) => table.threats);

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
        // Get STRIDE name from computed cache
        const strideName =
          project.computed.strideNames.get(threat.strideCategory) ??
          threat.strideCategory;

        // Get element or flow name
        const elementOrFlow =
          threat.linkedElement?.elementName ||
          threat.dataFlow?.dataFlowName ||
          "-";

        const values = {
          id: threat.displayId,
          strideCategory: threat.strideCategory,
          strideName,
          elementOrFlow: this.escapeTableText(elementOrFlow),
          trustBoundary: this.escapeTableText(threat.trustBoundaryName || "-"),
          // Full text — no truncation
          threatDescription: this.escapeTableText(
            threat.threatDescription || "-",
          ),
          attackDescription: this.escapeTableText(
            threat.attackDescription || "-",
          ),
          // Full resolved text, one entry per line. Escape each entry individually
          // so the <br> separators survive (escapeTableText must not touch them).
          mitigation: resolveMitigationDrafts(threat.proposedMitigations ?? [])
            .map((m) => (m.isCustom ? `[custom] ${m.notes ?? ""}` : m.text))
            .filter(Boolean)
            .map((s) => `• ${this.escapeTableText(s)}`)
            .join("<br>"),
          verification: resolveVerificationDrafts(
            threat.proposedVerifications ?? [],
          )
            .map((v) => (v.isCustom ? `[custom] ${v.notes ?? ""}` : v.text))
            .filter(Boolean)
            .map((s) => `• ${this.escapeTableText(s)}`)
            .join("<br>"),
        };
        return replacePlaceholders(this.getThreatRowTemplate(), values);
      })
      .join("");

    let content = this.getThreatsHeaderTemplate(method);
    content += replacePlaceholders(this.getThreatsTableTemplate(), {
      threatRows,
    });

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
    method: "per-element" | "per-interaction",
  ): ChapterContent {
    const { project } = this.ctx;

    // Filter risks by STRIDE method and exclude won't
    const allRisks = project.risks?.risks ?? [];
    const risks = allRisks.filter(
      (r) => r.sourceStrideMethod === method && r.moscowPriority !== "wont",
    );

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
        // Get cached labels
        const riskBeforeLabel =
          project.computed.riskBeforeLabels.get(risk.id) ??
          risk.calculatedRiskBeforeMitigation.toString();
        const riskAfterLabel =
          project.computed.riskAfterLabels.get(risk.id) ??
          risk.calculatedRiskAfterMitigation.toString();
        const moscowLabel =
          project.computed.moscowLabels.get(risk.moscowPriority) ??
          risk.moscowPriority;
        const implStatus = deriveImplementationProgress(
          risk.selectedMitigations,
        );
        const statusLabel = implStatus.replace(/_/g, " ");

        const values = {
          id: risk.id,
          threatId: risk.threatDisplayId,
          strideCategory: risk.strideCategory,
          threatDescription: this.escapeTableText(
            risk.threatDescription || "-",
          ),
          riskBeforeLabel,
          mitigations: this.escapeTableText(
            formatMitigations(
              risk.selectedMitigations
                .filter((m) => m.status !== "rejected")
                .map((m) => m.notes?.trim() || m.id || "")
                .filter(Boolean),
            ),
          ),
          riskAfterLabel,
          moscowLabel,
          statusLabel,
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

  // ==================== SRSL ASSESSMENT (EN 50742 A) ====================

  /**
   * EN 50742 Approach A SRSL table: one row per risk that has an exposure
   * anchor (EL > 0), showing the linked safety-function asset + severity, and
   * the attack-potential inputs EL / WoO / AC → AP → SRSL. Separate from the
   * R = L × I risk register. Only rendered for en-50742-a projects and only for
   * formats that implement the templates (else auto-hidden).
   */
  protected generateSRSLAssessment(title: string): ChapterContent {
    const { project } = this.ctx;
    const chapterId = "srsl-assessment";
    const config = project.risks?.configuration;
    const tableTemplate = this.getSRSLTableTemplate();

    if (config?.likelihoodMethod !== "en-50742-a" || !tableTemplate) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    const woo = config.windowOfOpportunity ?? "-";
    const assetsById = new Map(
      (project.assets?.assets ?? []).map((a) => [a.id, a]),
    );
    const ratingValue = (
      risk: { factorRatings?: { factorId: string; value: number }[] },
      factorId: string,
    ): number =>
      risk.factorRatings?.find((f) => f.factorId === factorId)?.value ?? 0;

    // Threat lookup for the mandated-control mapping (anchor type lives on the
    // threat, not the risk).
    const threatById = new Map(
      [
        ...(project.threats?.perElementTables?.flatMap((t) => t.threats) ?? []),
        ...(project.threats?.perInteractionTables?.flatMap((t) => t.threats) ??
          []),
      ].map((t) => [t.id, t]),
    );

    const srslRows = (project.risks?.risks ?? [])
      .filter((r) => r.moscowPriority !== "wont")
      .filter((r) => ratingValue(r, "exposure_level") > 0)
      .map((risk) => {
        const el =
          en50742LevelFromRating(
            "exposure_level",
            ratingValue(risk, "exposure_level"),
          ) ?? "-";
        const ac =
          en50742LevelFromRating(
            "attacker_capability",
            ratingValue(risk, "attacker_capability"),
          ) ?? "-";
        const linked = (risk.linkedAssetIds ?? [])
          .map((id) => assetsById.get(id))
          .filter((a): a is NonNullable<typeof a> => Boolean(a));
        const safetyAsset =
          linked.find((a) => a.physicalImpact) ?? linked[0] ?? null;

        // Mandated 7.4.3 controls (§11.4): anchor type × STRIDE × SRSL.
        const threat = threatById.get(risk.threatId);
        const et = threat?.linkedElement?.elementType;
        const anchorType: SrslAnchorType | undefined =
          et === "Interface"
            ? "Interface"
            : et === "DataFlow" || threat?.dataFlow
              ? "DataFlow"
              : undefined;
        const controls =
          anchorType && risk.calculatedSrsl
            ? mandatedRequirementsForThreat(
                anchorType,
                risk.strideCategory,
                risk.calculatedSrsl,
              )
                .map((r) => `${r.category} (${r.clause})`)
                .join("; ") || "-"
            : "-";

        const values = {
          threatId: risk.threatDisplayId,
          asset: this.escapeTableText(safetyAsset?.name ?? "-"),
          severity: safetyAsset?.physicalImpact ?? "-",
          el,
          woo,
          ac,
          ap:
            risk.calculatedApScore != null
              ? `${risk.calculatedApScore} (${risk.calculatedApBand ?? "-"})`
              : "-",
          srsl: risk.calculatedSrsl ?? "-",
          controls: this.escapeTableText(controls),
        };
        return replacePlaceholders(this.getSRSLRowTemplate(), values);
      })
      .join("");

    if (!srslRows) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    let content = this.getSRSLHeaderTemplate();
    content += replacePlaceholders(tableTemplate, { srslRows });

    return { id: chapterId, title, content, hasContent: true };
  }

  // ==================== ACCEPTED RISKS ====================

  protected generateAcceptedRisks(title: string): ChapterContent {
    const { project } = this.ctx;

    // Filter won't risks
    const allRisks = project.risks?.risks ?? [];
    const wontRisks = allRisks.filter((r) => r.moscowPriority === "wont");

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
        // Get cached label
        const riskBeforeLabel =
          project.computed.riskBeforeLabels.get(risk.id) ??
          risk.calculatedRiskBeforeMitigation.toString();

        const values = {
          id: risk.id,
          threatId: risk.threatDisplayId,
          strideCategory: risk.strideCategory,
          threatDescription: this.escapeTableText(
            risk.threatDescription || "-",
          ),
          riskBeforeLabel,
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
    tags: string[],
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
    const allCategoryTags = TAG_CATEGORIES.flatMap((c) =>
      c.tags.map((td) => td.name),
    );
    const customTags = tags.filter((tag) => !allCategoryTags.includes(tag));

    if (customTags.length > 0) {
      const customLabel = lang === "de" ? "Sonstige" : "Other";
      result.push({ categoryLabel: customLabel, tags: customTags });
    }

    return result;
  }
}