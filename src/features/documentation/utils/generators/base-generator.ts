// ==================== BASE DOCUMENT GENERATOR ====================
// Abstract base class for document generators
// Location: features/documentation/utils/generators/base-generator.ts

import { isIsoReport, isoRiskLabel } from "../iso-risk-label";
import { itemDefinitionIntro, itemDefinitionReportSections } from "../item-definition-report";
import type { ReportSection } from "../report-section";
import {
  goalsClaimsIntro,
  goalsClaimsOfRisk,
  goalsClaimsReportSections,
  verificationStatusLabel,
  verificationStatusSentence,
} from "../cybersecurity-concept-report";
import { groupIsoScenarios } from "../../../risks/models/iso-scenarios";
import { controlLabels } from "../control-text";
import { isStrideMethodDisabled } from "../stride-method-scope";
import {
  attackTreeReportSections,
  attackTreesIntro,
  type AttackTreeReportSection,
} from "../attack-tree-report";
import {
  isoScenarioSummary,
  isoScenarioTitle,
  resolveAttackPathChain,
} from "../iso-scenario-text";
import { isoFeasibilityFromFactors } from "../../../risks/models/iso-risk-matrix";
import {
  treatmentFallbackLabel,
  treatmentI18nKey,
  treatmentVocabulary,
} from "../../../risks/models/risk-treatment-vocabulary";
import { dfdPageSectionsOf, noDfdImageText } from "../dfd-page-sections";
import { dfdParentLevelFlowsOf } from "../dfd-parent-level-flows";
import { reportGroupsOf } from "../dfd-report-groups";
import {
  riskGroupSummary,
  riskStatsTable,
  threatElementType,
  threatGroupSummary,
  threatStatsTable,
  type StatsTable,
} from "../threat-risk-stats";
import { dfdItemRefOfThreat } from "../../../../shared/models/dfd-table-groups";
import { impactAggregationSentence } from "../impact-aggregation-text";
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
import type { Iso21434Feasibility as Iso21434FeasibilityLevel } from "../../../risks/models/iso21434-core";
import { assetImpactResolver } from "../../../assets/services/asset-impact-resolver";
import { buildSecurityGoalDocRows } from "../security-goal-doc-rows";
import { dfdStatsTable } from "../dfd-stats-table";
import {
  methodologyContent,
  type MethodologySection,
} from "../methodology-sections";
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
import { formatRiskLabel } from "../../../../shared/models/risk-label";

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

// ==================== ISO 21434 FEASIBILITY (TRACEABILITY MATRIX) ====================

/**
 * Resolve a risk's five ISO 21434 Annex G.2 factor ratings (if all five are
 * rated) into an attack potential + feasibility band. Returns null when any
 * factor is unrated — that null IS the "AF-" coverage gap the traceability
 * matrix (§6) is meant to surface, not an error to paper over.
 */
function resolveIso21434Feasibility(
  factorRatings: { factorId: string; value: number }[],
): { attackPotential: number; feasibility: Iso21434FeasibilityLevel } | null {
  return isoFeasibilityFromFactors(factorRatings);
}

/**
 * Resolve a risk's attack feasibility from its attack tree — the ISO source of
 * truth for feasibility (feasibility is tree-derived, ISO 15.7/15.8). ISO risks
 * do NOT carry the five Annex G.2 factors on `risk.factorRatings`; those live on
 * the attack-tree leaves and are aggregated into `tree.pathAnalysis`.
 *
 * A risk points at exactly one tree + one path (`risk.attackTreeAssessment`), so
 * we take that path's own feasibility — it is the path the risk was raised for.
 * If the path can't be found or carries no evaluation we fall back to the
 * scenario-level aggregate (cheapest / MAX-feasibility path, 15.8 NOTE 2).
 *
 * Returns null when no tree feasibility resolves at all — that null IS the "AF-"
 * coverage gap the traceability matrix (§6) surfaces, not an error to paper over.
 */
function resolveTreeFeasibility(
  attackTree: DocProjectData["attackTree"],
  assessment: { treeId: string; pathKey: string } | undefined,
): { attackPotential: number | null; feasibility: Iso21434FeasibilityLevel } | null {
  if (!attackTree || !assessment) return null;
  const tree = attackTree.trees?.find((tr) => tr.id === assessment.treeId);
  const analysis = tree?.pathAnalysis;
  if (!analysis) return null;

  // 1. The specific path this risk was raised for (stable pathKey).
  const path = analysis.paths?.find((p) => p.pathKey === assessment.pathKey);
  if (path?.feasibilityLevel) {
    return {
      attackPotential: path.attackPotential ?? null,
      feasibility: path.feasibilityLevel,
    };
  }

  // 2. Fallback: scenario-level aggregate (easiest path / MAX across paths).
  const cheapest = analysis.cheapestPath;
  if (cheapest?.feasibilityLevel) {
    return {
      attackPotential: cheapest.attackPotential ?? null,
      feasibility: cheapest.feasibilityLevel,
    };
  }
  if (analysis.aggregatedFeasibility) {
    return { attackPotential: null, feasibility: analysis.aggregatedFeasibility };
  }
  return null;
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
  /**
   * One DFD figure in the format's syntax: the thumbnail of a classic DFD
   * ({{dfdFigures}}) or of a page section (leveled DFD, 7a); without image,
   * the note that the page has no stored image yet.
   */
  abstract formatDfdFigure(image: string | undefined, alt: string): string;
  abstract getDfdDescriptionsTemplate(): string;
  abstract getDfdElementTypeHeaderTemplate(): string;
  abstract getDfdElementEntryTemplate(): string;
  abstract getDfdDataFlowsHeaderTemplate(): string;
  /**
   * Closes what a type header or the data-flows header opened — StrictDoc's
   * [SECTION]; the other formats use headings and need nothing.
   */
  getDfdSubsectionCloseTemplate(): string {
    return "";
  }
  abstract getDfdConnectionEntryTemplate(): string;
  abstract getAssetsTemplate(): string;
  abstract getAssetRowTemplate(): string;
  abstract getThreatsHeaderTemplate(
    method: "per-element" | "per-interaction",
  ): string;
  abstract getThreatsTableTemplate(): string;
  abstract getThreatRowTemplate(): string;
  abstract getAttackPathThreatsHeaderTemplate(): string;
  abstract getAttackPathThreatRowTemplate(): string;
  abstract getRisksHeaderTemplate(
    method: "per-element" | "per-interaction",
  ): string;
  abstract getAttackPathRisksHeaderTemplate(): string;
  abstract getRisksTableTemplate(): string;
  abstract getRiskRowTemplate(): string;
  // Security-goal table (asset × active goal) appended to the assets chapter.
  // Default empty so a format that has not implemented it simply omits the
  // table, same convention as the SRSL templates below.
  protected getSecurityGoalsTemplate(): string {
    return "";
  }
  protected getSecurityGoalRowTemplate(): string {
    return "";
  }
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
  // ISO/SAE 21434 traceability matrix (§6) — default empty so a format that
  // has not implemented it yet simply produces no chapter (auto-hidden), same
  // convention as the SRSL templates above.
  protected getTraceabilityMatrixHeaderTemplate(): string {
    return "";
  }
  protected getTraceabilityMatrixTableTemplate(): string {
    return "";
  }
  protected getTraceabilityRowTemplate(): string {
    return "";
  }
  // Methodology chapter (ISO/SAE 21434 conformance plan 0d) — default empty so
  // a format that has not implemented it produces no chapter (auto-hidden).
  protected formatMethodologyChapter(_title: string, _intro: string, _body: string): string {
    return "";
  }
  protected formatMethodologySection(_section: MethodologySection): string {
    return "";
  }
  // Attack-trees chapter (plan F5) — same pattern: a format that has not
  // implemented it produces no chapter.
  protected formatAttackTreesChapter(_title: string, _intro: string, _body: string): string {
    return "";
  }
  protected formatAttackTreeSection(_section: AttackTreeReportSection): string {
    return "";
  }
  // Sectioned chapters (item definition A-5, goals / claims Phase 4) — same
  // pattern: a format that has not implemented them produces no chapter.
  protected formatSectionedChapter(_chapterId: string, _title: string, _intro: string, _body: string): string {
    return "";
  }
  protected formatReportSection(_section: ReportSection): string {
    return "";
  }
  /** A status line below the header (verification, plan Phase 4). */
  protected formatStatusNotice(_text: string, _kind: "info" | "warning"): string {
    return "";
  }
  abstract getAcceptedRisksTemplate(): string;
  abstract getWontRiskRowTemplate(): string;
  abstract getAppendixTemplate(): string;
  abstract getFooterTemplate(): string;
  abstract getDfdElementOverviewTableTemplate(): string;
  abstract getElementOverviewRowTemplate(): string;
  /** Leveled DFD (7b): one page section ({{pageTitle}}, {{pageFigure}}, {{pageTable}}). */
  abstract getDfdPageSectionTemplate(): string;
  /** Leveled DFD (7b): the element table of a page section ({{elementRows}}). */
  abstract getDfdElementOverviewPageTableTemplate(): string;
  /** Leveled DFD (7c): flows analysed on a parent level ({{title}}, {{intro}}, {{rows}}). */
  abstract getDfdParentLevelFlowsTemplate(): string;
  /** Leveled DFD (7c): one such flow ({{flow}}, {{from}}, {{to}}, {{reason}}). */
  abstract getDfdParentLevelFlowRowTemplate(): string;
  /**
   * Leveled DFD (7d): one group of a threat / risk chapter — a heading one
   * level below the chapter, its summary line and its table.
   */
  abstract formatReportGroup(title: string, body: string, summary?: string): string;
  /** The statistics table below a threat / risk chapter's intro. */
  abstract formatStatsTable(table: StatsTable): string;
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
    content += this.generateVerificationNotice();
    content += this.generateToc(chapters);

    for (const chapter of this.visibleChapters(chapters)) {
      content += this.chapterAnchor(chapter.id) + chapter.content;
    }

    content += this.generateFooter();

    return {
      content,
      format: this.getFormat(),
      filename: this.generateFilename(),
    };
  }

  /**
   * ISO/SAE 21434: the verification status up front (plan Phase 4) — the
   * document is marked, never blocked. Empty outside iso-21434.
   */
  protected generateVerificationNotice(): string {
    const verification = this.ctx.project.computed.verification;
    if (!verification) return "";
    return this.formatStatusNotice(
      `${verificationStatusLabel(this.ctx.t)}: ${verificationStatusSentence(verification, this.ctx.t)}`,
      verification.kind === "verified" ? "info" : "warning",
    );
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
      case "methodology":
        return this.generateMethodology(title);
      case "system-overview":
        return this.generateSystemOverview(title);
      case "item-definition":
        return this.generateItemDefinition(title);
      case "goals-claims":
        return this.generateGoalsClaims(title);
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
      case "threats-attack-path":
        return this.generateAttackPathThreats(title);
      case "risks-per-element":
        return this.generateRisks(title, "per-element");
      case "risks-per-interaction":
        return this.generateRisks(title, "per-interaction");
      case "risks-attack-path":
        return this.generateAttackPathRisks(title);
      case "srsl-assessment":
        return this.generateSRSLAssessment(title);
      case "accepted-risks":
        return this.generateAcceptedRisks(title);
      case "traceability-matrix":
        return this.generateTraceabilityMatrix(title);
      case "attack-trees":
        return this.generateAttackTrees(title);
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

  /**
   * The chapters the document shows, in order: enabled, and with content
   * unless the chapter is set to show when empty. The table of contents
   * lists exactly these (plan F6).
   */
  protected visibleChapters(chapters: ChapterContent[]): ChapterContent[] {
    return chapters.filter((chapter) => {
      const chapterConfig = this.ctx.config.chapters.find((c) => c.id === chapter.id);
      return !!chapterConfig && isChapterVisible(chapterConfig, chapter.hasContent);
    });
  }

  /**
   * Link target of a chapter for the table of contents: `chapter-<id>`,
   * independent of title, language and custom titles (plan F6). Empty for
   * formats whose TOC is generated by the toolchain.
   */
  protected chapterAnchor(_chapterId: string): string {
    return "";
  }

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

    // Count critical risks (before mitigation >= 3.5); ISO/SAE 21434: risk
    // value 5 ("Critical", 3a-2 / decision 23).
    const criticalRiskCount = isIsoReport(project.risks?.configuration)
      ? activeRisks.filter((r) => r.isoRisk?.value === 5).length
      : activeRisks.filter((r) => r.calculatedRiskBeforeMitigation >= 3.5).length;

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

    // Classic: the one thumbnail after the intro. Leveled DFD (7a/7b): after
    // the statistics one section per page — heading, figure, element table.
    const alt = this.ctx.lang === "de" ? "Datenflussdiagramm" : "Data Flow Diagram";
    const sections = dfdPageSectionsOf(dfd, this.ctx.lang);
    const dfdPages = (sections ?? [])
      .map((section) =>
        replacePlaceholders(this.getDfdPageSectionTemplate(), {
          pageTitle: this.escapeTableText(section.title),
          pageFigure: section.isPage ? this.formatDfdFigure(section.image, alt) : "",
          pageTable:
            section.elements.length > 0
              ? replacePlaceholders(this.getDfdElementOverviewPageTableTemplate(), {
                  elementRows: section.elements.map((e) => this.overviewRow(e)).join(""),
                })
              : "",
        }),
      )
      .join("");

    // Leveled DFD (7c): the flows analysed on a parent level, after the pages.
    const parentLevel = dfdParentLevelFlowsOf(dfd, this.ctx.lang);
    const dfdParentLevel = parentLevel
      ? replacePlaceholders(this.getDfdParentLevelFlowsTemplate(), {
          title: this.escapeTableText(parentLevel.title),
          intro: this.escapeTableText(parentLevel.intro),
          rows: parentLevel.rows
            .map((row) =>
              replacePlaceholders(this.getDfdParentLevelFlowRowTemplate(), {
                flow: this.escapeTableText(row.flow),
                from: this.escapeTableText(row.from),
                to: this.escapeTableText(row.to),
                reason: this.escapeTableText(row.reason),
              }),
            )
            .join(""),
        })
      : "";

    const values = {
      dfdFigures: sections ? "" : this.formatDfdFigure(dfd.thumbnail || "dfd.png", alt),
      dfdPages: dfdPages + dfdParentLevel,
      dfdStatsTable: this.formatStatsTable(dfdStatsTable(dfd, this.ctx.lang, this.ctx.t)),
    };

    const content = replacePlaceholders(this.getDfdTemplate(), values);

    return {
      id: "dfd",
      title,
      content,
      hasContent: true,
    };
  }

  /** One row of an element overview table (classic, or a page section). */
  protected overviewRow(element: DFDElement): string {
    return replacePlaceholders(this.getElementOverviewRowTemplate(), {
      displayId: element.displayId || element.id,
      name: this.escapeTableText(element.name),
      type: getDFDElementTypeText(element.type, this.ctx.t),
      description: this.escapeTableText(truncateText(element.description ?? "-", 60)),
      assets: this.escapeTableText(getAssetIdList(element, this.resolveAssetName)),
    });
  }

  /** Text in place of a page figure without a stored image (7a). */
  protected noDfdImage(): string {
    return noDfdImageText(this.ctx.lang);
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

    // Overview table. Leveled DFD (7b): the overview is the element table of
    // each page section in the DFD chapter — not repeated here.
    let content = dfdPageSectionsOf(project.dfd, this.ctx.lang)
      ? ""
      : replacePlaceholders(this.getDfdElementOverviewTableTemplate(), {
          elementRows: elements.map((e) => this.overviewRow(e)).join(""),
        });

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
      content += this.getDfdSubsectionCloseTemplate();
    }

    // Data Flows section
    if (connections.length > 0) {
      content += this.getDfdDataFlowsHeaderTemplate();

      for (const connection of connections) {
        content += this.generateDfdConnectionDetailedEntry(connection);
      }
      content += this.getDfdSubsectionCloseTemplate();
    }

    // The chapter frame (title, intro) — dropped in 1a64e57: the chapter had
    // no heading in any format (TOC link without target, StrictDoc's type
    // sections nested into the DFD chapter).
    return {
      id: "dfd-descriptions",
      title,
      content: replacePlaceholders(this.getDfdDescriptionsTemplate(), {
        elementSections: content,
      }),
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

    const content =
      replacePlaceholders(this.getAssetsTemplate(), {
        assetRows,
      }) + this.generateSecurityGoalTable(assets);

    return {
      id: "assets",
      title,
      content,
      hasContent: true,
    };
  }

  /**
   * Security-goal table: one row per asset × active or excluded goal with
   * level, source (the goal's state), basis (relations + level driver, or the
   * analyst's rationale) and damage-scenario consequence. Row content comes from
   * buildSecurityGoalDocRows so every format — incl. pdfmake — says the same.
   */
  protected generateSecurityGoalTable(assets: Asset[]): string {
    const tableTemplate = this.getSecurityGoalsTemplate();
    if (!tableTemplate) return "";

    const impactScale =
      this.ctx.project.assets?.configuration?.impactScale ?? "4-level";
    const rows = buildSecurityGoalDocRows(assets, impactScale, this.ctx.lang);
    if (rows.length === 0) return "";

    const goalRows = rows
      .map((row) =>
        replacePlaceholders(this.getSecurityGoalRowTemplate(), {
          asset: this.escapeTableText(row.asset),
          goal: this.escapeTableText(row.goal),
          level: this.escapeTableText(row.level),
          source: this.escapeTableText(row.source),
          basis: this.escapeTableText(row.basis),
          consequence: this.escapeTableText(row.consequence),
        }),
      )
      .join("");

    return replacePlaceholders(tableTemplate, { goalRows });
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

    // Flatten tables to get all threats — none when the preset switches the
    // method off (ISO/SAE 21434: per-interaction), even if threats are stored.
    const threats = isStrideMethodDisabled(project.info?.tags, method)
      ? []
      : tables.flatMap((table) => table.threats);

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

    const threatRow = (threat: (typeof threats)[number]) => {
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
    };
    const threatTable = (list: typeof threats) =>
      replacePlaceholders(this.getThreatsTableTemplate(), {
        threatRows: list.map(threatRow).join(""),
      });

    // Leveled DFD (7d): one table per group, as the app's accordions.
    const groups = reportGroupsOf(project.dfd, this.ctx.lang, threats, (threat) =>
      dfdItemRefOfThreat(threat),
    );
    const typeLabel = (type: string) => getDFDElementTypeText(type as DFDElementType, this.ctx.t);
    let content = this.getThreatsHeaderTemplate(method);
    content += this.formatStatsTable(threatStatsTable(threats, this.ctx.lang, typeLabel));
    content += groups
      ? groups
          .map((g) =>
            this.formatReportGroup(g.title, threatTable(g.items), threatGroupSummary(g.items, this.ctx.lang)),
          )
          .join("")
      : threatTable(threats);

    return {
      id: chapterId,
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== THREATS (ATTACK PATH) ====================

  /**
   * Attack-path threats have no per-element/per-interaction table — they are
   * carried on the risks (sourceStrideMethod === "attack-path"). Without a
   * chapter that renders them, the `threat-<id>` anchor is never emitted and
   * every #threat-<id> link (traceability matrix, risk / SRSL / won't rows)
   * that targets an attack-path threat dangles. This chapter gives those
   * threats an anchored home, reusing the existing threat row/table templates
   * so the anchor convention (and therefore the links) match exactly.
   */
  protected generateAttackPathThreats(title: string): ChapterContent {
    const { project } = this.ctx;
    const chapterId: DocChapterId = "threats-attack-path";

    const assets = project.assets?.assets ?? [];
    const assetLabel = (ids?: string[]): string => {
      const first = ids?.[0];
      const asset = first ? assets.find((a) => a.id === first) : undefined;
      if (!asset) return "-";
      const extra = (ids?.length ?? 0) > 1 ? ` (+${(ids!.length - 1)})` : "";
      return `${asset.displayId ?? asset.id} ${asset.name}${extra}`;
    };

    // One row per unique threatDisplayId; exclude won't-address risks (they are
    // reported in the accepted-risks chapter). The visible label is TS-<n>,
    // numbered by position in the full risk list so it matches the traceability
    // matrix exactly; the long threatDisplayId stays only as the anchor the
    // #threat-<id> links resolve to.
    const seen = new Set<string>();
    const rows: string[] = [];
    (project.risks?.risks ?? []).forEach((r) => {
      if (r.sourceStrideMethod !== "attack-path") return;
      if (r.moscowPriority === "wont") return;
      if (!r.threatDisplayId || seen.has(r.threatDisplayId)) return;
      seen.add(r.threatDisplayId);

      const strideCategory = r.attackTreeAssessment?.strideCategory ?? "-";
      const chain = resolveAttackPathChain(
        project.attackTree,
        r.attackTreeAssessment,
      );
      const threat = chain ? chain.join(" → ") : r.threatDescription || "-";

      const values = {
        anchor: r.threatDisplayId, // <a id="threat-{{anchor}}"> — link target
        tsId: r.threatDisplayId, // AT-<n>.<m> — same label the matrix shows
        strideCategory,
        elementOrFlow: this.escapeTableText(assetLabel(r.linkedAssetIds)),
        threatDescription: this.escapeTableText(threat),
        // ISO mode: mitigation / verification live on the risk, not the threat —
        // the ones selected on the risk of this path.
        mitigation: this.controlList(
          controlLabels(
            (r.selectedMitigations ?? []).filter((m) => m.status !== "rejected"),
            "mitigation",
          ),
        ),
        verification: this.controlList(
          controlLabels((r.selectedVerifications ?? []).map((id) => ({ id })), "verification"),
        ),
      };
      rows.push(
        replacePlaceholders(this.getAttackPathThreatRowTemplate(), values),
      );
    });

    if (rows.length === 0) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    let content = this.getAttackPathThreatsHeaderTemplate();
    content += replacePlaceholders(this.getThreatsTableTemplate(), {
      threatRows: rows.join(""),
    });

    return { id: chapterId, title, content, hasContent: true };
  }

  // ==================== RISKS ====================

  /** "• a<br>• b" with each entry escaped, "-" when empty (threat-table layout). */
  protected controlList(labels: string[]): string {
    return labels.length > 0
      ? labels.map((s) => `• ${this.escapeTableText(s)}`).join("<br>")
      : "-";
  }

  /** One row of a risk table (all risk chapters share it). */
  protected riskRow(
    risk: NonNullable<DocProjectData["risks"]>["risks"][number],
    threatDescription = risk.threatDescription || "-",
  ): string {
    const { project } = this.ctx;
    // Get cached labels
    // ISO/SAE 21434: risk value 1–5 instead of `I × L` (3a-2).
    const isoReport = project.risks?.configuration?.likelihoodMethod === "iso-21434";
    const riskBeforeLabel = isoReport
      ? isoRiskLabel(risk, this.ctx.t, false)
      : (project.computed.riskBeforeLabels.get(risk.id) ??
        risk.calculatedRiskBeforeMitigation.toString());
    const riskAfterLabel = isoReport
      ? isoRiskLabel(risk, this.ctx.t, true)
      : (project.computed.riskAfterLabels.get(risk.id) ??
        risk.calculatedRiskAfterMitigation.toString());
    const moscowLabel =
      project.computed.moscowLabels.get(risk.moscowPriority) ??
      risk.moscowPriority;
    const implStatus = deriveImplementationProgress(
      risk.selectedMitigations,
    );
    const statusLabel = implStatus.replace(/_/g, " ");

    const values = {
      id: formatRiskLabel(risk),
      threatId: risk.threatDisplayId,
      strideCategory: risk.strideCategory,
      threatDescription: this.escapeTableText(threatDescription),
      riskBeforeLabel,
      // "ID — text" per control, one per line (like the threat tables).
      mitigations: this.controlList(
        controlLabels(
          risk.selectedMitigations.filter((m) => m.status !== "rejected"),
          "mitigation",
        ),
      ),
      riskAfterLabel,
      moscowLabel,
      statusLabel,
    };
    return replacePlaceholders(this.getRiskRowTemplate(), values);
  }

  protected generateRisks(
    title: string,
    method: "per-element" | "per-interaction",
  ): ChapterContent {
    const { project } = this.ctx;

    // Filter risks by STRIDE method and exclude won't; none for a method the
    // preset switches off.
    const allRisks = isStrideMethodDisabled(project.info?.tags, method)
      ? []
      : (project.risks?.risks ?? []);
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

    const riskRow = (risk: (typeof risks)[number]) => this.riskRow(risk);
    const riskTable = (list: typeof risks) =>
      replacePlaceholders(this.getRisksTableTemplate(), {
        riskRows: list.map(riskRow).join(""),
      });

    // Leveled DFD (7d): one table per group — a risk follows its threat.
    const threatById = new Map(
      [
        ...(project.threats?.perElementTables ?? []),
        ...(project.threats?.perInteractionTables ?? []),
      ]
        .flatMap((table) => table.threats)
        .map((threat) => [threat.id, threat]),
    );
    const groups = reportGroupsOf(project.dfd, this.ctx.lang, risks, (risk) => {
      const threat = threatById.get(risk.threatId);
      return threat ? dfdItemRefOfThreat(threat) : undefined;
    });

    let content = replacePlaceholders(this.getRisksHeaderTemplate(method), {
      impactAggregation: impactAggregationSentence(
        project.risks?.configuration?.impactAggregation,
        this.ctx.lang,
      ),
    });
    const scale = {
      scale: project.risks?.configuration?.scale ?? "4-level",
      roundingMethod: project.risks?.configuration?.roundingMethod,
      iso: isIsoReport(project.risks?.configuration),
    } as const;
    const typeLabel = (type: string) => getDFDElementTypeText(type as DFDElementType, this.ctx.t);
    const riskType = (risk: (typeof risks)[number]) => {
      const threat = threatById.get(risk.threatId);
      return threat ? threatElementType(threat) : "-";
    };
    content += this.formatStatsTable(
      riskStatsTable(risks, riskType, scale, this.ctx.lang, typeLabel),
    );
    content += groups
      ? groups
          .map((g) =>
            this.formatReportGroup(g.title, riskTable(g.items), riskGroupSummary(g.items, scale, this.ctx.lang)),
          )
          .join("")
      : riskTable(risks);

    return {
      id: chapterId,
      title,
      content,
      hasContent: true,
    };
  }

  // ==================== RISKS (ATTACK PATH, ISO/SAE 21434) ====================

  /**
   * ISO/SAE 21434 (plan F4): the risk register of the attack-path risks, one
   * group per threat scenario (attack tree) as in the risk tab — the group
   * summary carries the scenario value and residual (MAX over the paths) and
   * the treatment options. Only for iso-21434 projects; other methods keep
   * their attack-path risks out of the risk chapters, as before.
   */
  protected generateAttackPathRisks(title: string): ChapterContent {
    const { project, t, lang } = this.ctx;
    const chapterId: DocChapterId = "risks-attack-path";
    const config = project.risks?.configuration;
    const risks = (project.risks?.risks ?? []).filter(
      (r) => r.sourceStrideMethod === "attack-path" && r.moscowPriority !== "wont",
    );
    if (!isIsoReport(config) || risks.length === 0) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    const pathText = (risk: (typeof risks)[number]) => {
      const chain = resolveAttackPathChain(project.attackTree, risk.attackTreeAssessment);
      return chain ? chain.join(" → ") : risk.threatDescription || "-";
    };
    const riskTable = (list: typeof risks) =>
      replacePlaceholders(this.getRisksTableTemplate(), {
        riskRows: list.map((r) => this.riskRow(r, pathText(r))).join(""),
      });

    const assetOf = (risk: (typeof risks)[number]) => risk.linkedAssetIds?.[0] ?? "-";
    const assetLabel = (id: string) => {
      const asset = project.assets?.assets?.find((a) => a.id === id);
      return asset ? `${asset.displayId ?? asset.id} ${asset.name}` : id;
    };
    const scale = {
      scale: config?.scale ?? "4-level",
      roundingMethod: config?.roundingMethod,
      iso: true,
    } as const;

    // No impact-aggregation sentence: the ISO impact is the highest rated
    // category of the damage scenario (methodology chapter), not I × L.
    let content = this.getAttackPathRisksHeaderTemplate();
    content += this.formatStatsTable(riskStatsTable(risks, assetOf, scale, lang, assetLabel, "asset"));
    content += groupIsoScenarios(risks)
      .map((sc) =>
        this.formatReportGroup(
          isoScenarioTitle(sc, project.attackTree),
          riskTable(sc.risks),
          isoScenarioSummary(sc, t, config),
        ),
      )
      .join("");

    return { id: chapterId, title, content, hasContent: true };
  }

  // ==================== ATTACK TREES ====================

  /**
   * Plan F5: one section per attack tree — anchor, structure (AND/OR gates,
   * leaf ratings) and attack paths. All presets; content in attack-tree-report.
   */
  protected generateAttackTrees(title: string): ChapterContent {
    const chapterId: DocChapterId = "attack-trees";
    const sections = attackTreeReportSections(this.ctx.project, this.ctx.t);
    if (sections.length === 0) {
      return { id: chapterId, title, content: "", hasContent: false };
    }
    const body = sections.map((s) => this.formatAttackTreeSection(s)).join("");
    const content = this.formatAttackTreesChapter(title, attackTreesIntro(this.ctx.t), body);
    return { id: chapterId, title, content, hasContent: content !== "" };
  }

  // ==================== ITEM DEFINITION (WP-09-01) ====================

  /**
   * ISO 21434 plan A-5: the item definition — purpose and functions,
   * boundary, architecture, environment, constraints, assumptions. All
   * presets, once the Item Definition holds something.
   */
  protected generateItemDefinition(title: string): ChapterContent {
    const chapterId: DocChapterId = "item-definition";
    const sections = itemDefinitionReportSections(this.ctx.project, this.ctx.t);
    if (sections.length === 0) {
      return { id: chapterId, title, content: "", hasContent: false };
    }
    const body = sections.map((s) => this.formatReportSection(s)).join("");
    const content = this.formatSectionedChapter(chapterId, title, itemDefinitionIntro(this.ctx.t), body);
    return { id: chapterId, title, content, hasContent: content !== "" };
  }

  // ==================== GOALS, CLAIMS, VERIFICATION (WP-09-03/04/05) ====================

  /** Plan Phase 4: goals, claims, verification entries; all presets. */
  protected generateGoalsClaims(title: string): ChapterContent {
    const chapterId: DocChapterId = "goals-claims";
    const sections = goalsClaimsReportSections(this.ctx.project, this.ctx.t);
    if (sections.length === 0) {
      return { id: chapterId, title, content: "", hasContent: false };
    }
    const body = sections.map((s) => this.formatReportSection(s)).join("");
    const content = this.formatSectionedChapter(chapterId, title, goalsClaimsIntro(this.ctx.t), body);
    return { id: chapterId, title, content, hasContent: content !== "" };
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
    const { project, t } = this.ctx;
    const chapterId = "srsl-assessment";
    const config = project.risks?.configuration;
    const tableTemplate = this.getSRSLTableTemplate();

    if (config?.likelihoodMethod !== "en-50742-a" || !tableTemplate) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    const woo = t(config.windowOfOpportunity ?? "-");
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
          severity: t(safetyAsset?.physicalImpact ?? "-"),
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

  // ==================== ISO 21434 TRACEABILITY MATRIX (§6) ====================

  /**
   * ISO/SAE 21434 Clause 15 traceability matrix: AS -> DS -> TS -> AF -> Risk
   * -> RT -> RR, rendered as a coverage CHECK rather than a static mapping —
   * each row states whether the damage-scenario impact and the attack-
   * feasibility rating actually resolve, or are missing, so a broken chain is
   * a reported finding instead of a silent gap (design doc §6). Only rendered
   * for iso-21434 projects, and only for formats that implement the table
   * template (else auto-hidden, same convention as the SRSL chapter).
   *
   * Scope note: DS resolution uses the asset-level impact (the resolver's
   * floor per asset-impact-resolver.ts) rather than a specific security-goal
   * override, since risks do not currently carry a stored goal reference —
   * this is the same 1:n damage-scenario gap the design doc tracks as
   * deferred (DS-1, §11-Q1), not a shortcut introduced here.
   */
  protected generateTraceabilityMatrix(title: string): ChapterContent {
    const { project, t } = this.ctx;
    const chapterId: DocChapterId = "traceability-matrix";
    const config = project.risks?.configuration;
    const tableTemplate = this.getTraceabilityMatrixTableTemplate();

    if (config?.likelihoodMethod !== "iso-21434" || !tableTemplate) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    const risks = project.risks?.risks ?? [];
    if (risks.length === 0) {
      return { id: chapterId, title, content: "", hasContent: false };
    }

    const assetsById = new Map(
      (project.assets?.assets ?? []).map((a) => [a.id, a]),
    );
    const resolvedText = t("tabs.doc.traceability.resolved", "resolved");
    const missingText = t("tabs.doc.traceability.missing", "missing");

    const traceabilityRows = risks
      .map((risk) => {
        const linkedAssets = (risk.linkedAssetIds ?? [])
          .map((id) => assetsById.get(id))
          .filter((a): a is NonNullable<typeof a> => Boolean(a));
        const primaryAsset = linkedAssets[0];

        // DS: asset-level damage-scenario impact (see scope note above).
        const resolvedImpact = primaryAsset
          ? assetImpactResolver.resolveImpactRatings(primaryAsset, undefined)
          : null;
        const impactByCategory = resolvedImpact
          ? assetImpactResolver.deriveImpactByCategory(resolvedImpact.ratings)
          : null;
        const dominantCategory = impactByCategory
          ? assetImpactResolver.findDominantCategory(impactByCategory)
          : undefined;
        const dsStatus = dominantCategory ? resolvedText : missingText;
        const dsLabel = dominantCategory
          ? t(
              `tabs.doc.traceability.category.${dominantCategory}`,
              dominantCategory,
            )
          : "-";

        // AF: ISO/IEC 18045 attack-potential feasibility. Primary source is the
        // risk's attack tree (feasibility is tree-derived, 15.7/15.8); we fall
        // back to five Annex G.2 factors rated directly on the risk, for the
        // simple/legacy case. null => neither source resolved (coverage gap).
        // attackPotential is shown only when known (audit mode); quick-mode
        // paths yield a feasibility band without a numeric potential.
        const af =
          resolveTreeFeasibility(
            project.attackTree,
            risk.attackTreeAssessment,
          ) ?? resolveIso21434Feasibility(risk.factorRatings ?? []);
        const afStatus = af ? resolvedText : missingText;
        const afFeasibilityLabel = af
          ? t(
              `tabs.doc.traceability.feasibility.${af.feasibility}`,
              af.feasibility,
            )
          : "";
        const afLabel = !af
          ? "-"
          : af.attackPotential != null
            ? `${af.attackPotential} (${afFeasibilityLabel})`
            : afFeasibilityLabel;

        const values = {
          asId: primaryAsset
            ? (primaryAsset.displayId ?? primaryAsset.id)
            : "-",
          asName: primaryAsset ? this.escapeTableText(primaryAsset.name) : "-",
          dsStatus,
          dsLabel,
          // The threat scenario's own display id (AT-<n>.<m> for attack-path
          // threats, P#-S-# for STRIDE). It doubles as the anchor target, so
          // label and #threat-<id> link stay in sync.
          tsAnchor: risk.threatDisplayId,
          tsId: risk.threatDisplayId,
          tsDescription: this.escapeTableText(risk.threatDescription || "-"),
          afStatus,
          afLabel,
          // ISO risk value 1–5 with its matrix inputs (3a-2, decision 20 E4);
          // `I × L` and its per-category split are no longer shown.
          riskBefore: this.escapeTableText(isoRiskLabel(risk, t, false)),
          // ISO 15.9 names (Avoid / Reduce / Share / Retain).
          treatment: t(
            `${treatmentI18nKey(risk.treatment, treatmentVocabulary(config))}.label`,
            treatmentFallbackLabel(risk.treatment, treatmentVocabulary(config)),
          ),
          riskAfter: this.escapeTableText(isoRiskLabel(risk, t, true)),
          // Goal / claim of the risk (plan Phase 4, decision 25).
          goalsClaims: goalsClaimsOfRisk(project.cybersecurityConcept, risk.id),
        };
        return replacePlaceholders(this.getTraceabilityRowTemplate(), values);
      })
      .join("");

    let content = this.getTraceabilityMatrixHeaderTemplate();
    content += replacePlaceholders(tableTemplate, { traceabilityRows });

    return { id: chapterId, title, content, hasContent: true };
  }

  // ==================== METHODOLOGY ====================

  /**
   * ISO/SAE 21434 methodology chapter (conformance plan 0d): rendered from the
   * methodology record the app layer derived (project.computed.methodology),
   * so it states exactly the configuration and the rules the calculation
   * applies. Only for iso-21434 projects; auto-hidden otherwise and in formats
   * that do not implement the methodology formatters.
   */
  protected generateMethodology(title: string): ChapterContent {
    const chapterId: DocChapterId = "methodology";
    const m = this.ctx.project.computed.methodology;
    if (!m || m.presetId !== "iso-21434") {
      return { id: chapterId, title, content: "", hasContent: false };
    }
    const { intro, sections } = methodologyContent(m, this.ctx.t);
    const body = sections.map((s) => this.formatMethodologySection(s)).join("");
    const content = this.formatMethodologyChapter(title, intro, body);
    return { id: chapterId, title, content, hasContent: content !== "" };
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
        // Get cached label (ISO: risk value 1–5, 3a-2)
        const riskBeforeLabel =
          project.risks?.configuration?.likelihoodMethod === "iso-21434"
            ? isoRiskLabel(risk, this.ctx.t, false)
            : (project.computed.riskBeforeLabels.get(risk.id) ??
              risk.calculatedRiskBeforeMitigation.toString());

        const values = {
          id: formatRiskLabel(risk),
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

