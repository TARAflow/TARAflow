// ==================== ASCIIDOC DOCUMENT GENERATOR ====================
// Concrete implementation for AsciiDoc document generation
// Location: features/documentation/utils/generators/asciidoc-generator.ts

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type ChapterContent,
} from "./base-generator";
import { ADOC_TEMPLATES } from "../templates/asciidoc-templates";
import { escapeAsciidoc, formatTagsGroupedAsciidoc } from "../templates";
import { ADOC_EXTENDED_TEMPLATES } from "../templates/asciidoc-templates-extended";

export class AsciidocGenerator extends BaseDocumentGenerator {
  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
  ) {
    super(project, config, t);
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "asciidoc";
  }

  getFileExtension(): string {
    return "adoc";
  }

  // ==================== TEXT HANDLING ====================

  escapeTableText(text: string): string {
    return escapeAsciidoc(text);
  }

  formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
  ): string {
    return formatTagsGroupedAsciidoc(tagsByCategory);
  }

  formatClassification(text: string): string {
    const classification =
      this.ctx.config.template.classification || "internal";
    return `[.${classification}]\n*${text}*`;
  }

  // ==================== TOC ====================

  protected generateTocContent(_chapters: ChapterContent[]): string {
    // AsciiDoc handles TOC via :toc: attribute in header
    return "";
  }

  // ==================== TEMPLATE GETTERS ====================

  getHeaderTemplate(): string {
    return ADOC_TEMPLATES.header(this.ctx.lang);
  }

  getTocTemplate(): string {
    return ADOC_TEMPLATES.toc(this.ctx.lang);
  }

  getExecutiveSummaryTemplate(): string {
    return ADOC_TEMPLATES.executiveSummary(this.ctx.lang);
  }

  getApplicableRegulationsTemplate(): string {
    return ADOC_TEMPLATES.applicableRegulations(this.ctx.lang);
  }

  getRegulationEntryTemplate(): string {
    return ADOC_TEMPLATES.regulationEntry(this.ctx.lang);
  }

  getSystemOverviewTemplate(): string {
    return ADOC_TEMPLATES.systemOverview(this.ctx.lang);
  }

  getDfdTemplate(): string {
    return ADOC_TEMPLATES.dfd(this.ctx.lang);
  }

  getDfdDescriptionsTemplate(): string {
    return ADOC_TEMPLATES.dfdDescriptions(this.ctx.lang);
  }

  getDfdElementTypeHeaderTemplate(): string {
    return ADOC_TEMPLATES.dfdElementTypeHeader(this.ctx.lang);
  }

  getDfdElementEntryTemplate(): string {
    return ADOC_TEMPLATES.dfdElementEntry(this.ctx.lang);
  }

  getDfdDataFlowsHeaderTemplate(): string {
    return ADOC_TEMPLATES.dfdDataFlowsHeader(this.ctx.lang);
  }

  getDfdConnectionEntryTemplate(): string {
    return ADOC_TEMPLATES.dfdConnectionEntry(this.ctx.lang);
  }

  getAssetsTemplate(): string {
    return ADOC_TEMPLATES.assets(this.ctx.lang);
  }

  getAssetRowTemplate(): string {
    return ADOC_TEMPLATES.assetRow;
  }

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return ADOC_TEMPLATES.threatsHeader(this.ctx.lang, method);
  }

  getThreatsTableTemplate(): string {
    return ADOC_TEMPLATES.threatsTable(this.ctx.lang);
  }

  getThreatRowTemplate(): string {
    return ADOC_TEMPLATES.threatRow;
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return ADOC_TEMPLATES.risksHeader(this.ctx.lang, method);
  }

  getRisksTableTemplate(): string {
    return ADOC_TEMPLATES.risksTable(this.ctx.lang);
  }

  getRiskRowTemplate(): string {
    return ADOC_TEMPLATES.riskRow;
  }

  getAcceptedRisksTemplate(): string {
    return ADOC_TEMPLATES.acceptedRisks(this.ctx.lang);
  }

  getWontRiskRowTemplate(): string {
    return ADOC_TEMPLATES.wontRiskRow;
  }

  getAppendixTemplate(): string {
    return ADOC_TEMPLATES.appendix(this.ctx.lang);
  }

  getFooterTemplate(): string {
    return ADOC_TEMPLATES.footer(this.ctx.lang);
  }

  getDfdElementOverviewTableTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdElementOverviewTable(this.ctx.lang);
  }

  getElementOverviewRowTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.elementOverviewRow;
  }

  getDfdElementDetailedEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdElementDetailedEntry(this.ctx.lang);
  }

  getDfdConnectionDetailedEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdConnectionDetailedEntry(this.ctx.lang);
  }

  getPropertyGroupTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.propertyGroup(this.ctx.lang);
  }

  getPropertyEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.propertyEntry;
  }

  getAssetElementRelationsTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.assetElementRelations(this.ctx.lang);
  }

  getAssetRelationSectionTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.assetRelationSection(this.ctx.lang);
  }

  getElementRelationEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.elementRelationEntry(this.ctx.lang);
  }

  getNoAssetRelationsTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.noAssetRelations(this.ctx.lang);
  }
}
