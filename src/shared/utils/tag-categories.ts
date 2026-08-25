// ==================== TAG CATEGORIES ====================
// Shared tag definitions for project categorization
// Used by: project-info.tsx, new-project-dialog.tsx, doc-generator

export type TagCategoryKey = "domain" | "platform" | "regulation";

export interface TagDefinition {
  name: string;
  tooltipKey?: string; // i18n key for tooltip (primarily for regulations)
  docDescriptionKey?: string; // i18n key for documentation description (longer text)
}

export interface TagCategory {
  key: TagCategoryKey;
  labelKey: string;
  bgColor: string;
  textColor: string;
  tags: TagDefinition[];
}

// ==================== TAG CATEGORIES DEFINITION ====================

export const TAG_CATEGORIES: TagCategory[] = [
  {
    key: "domain",
    labelKey: "projectInfo.tagCategories.domain",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    tags: [
      { name: "Aerospace", tooltipKey: "tags.tooltips.aerospace" },
      { name: "Automotive", tooltipKey: "tags.tooltips.automotive" },
      { name: "Aviation", tooltipKey: "tags.tooltips.aviation" },
      { name: "Consumer", tooltipKey: "tags.tooltips.consumer" },
      { name: "Energy", tooltipKey: "tags.tooltips.energy" },
      { name: "Finance", tooltipKey: "tags.tooltips.finance" },
      { name: "Industrial", tooltipKey: "tags.tooltips.industrial" },
      { name: "Medical", tooltipKey: "tags.tooltips.medical" },
      { name: "Military", tooltipKey: "tags.tooltips.military" },
      { name: "Pharma", tooltipKey: "tags.tooltips.pharma" },
      { name: "Public Sector", tooltipKey: "tags.tooltips.public_sector" },
      { name: "Railway", tooltipKey: "tags.tooltips.railway" },
      { name: "Telecom", tooltipKey: "tags.tooltips.telecom" },
      { name: "Transportation", tooltipKey: "tags.tooltips.transportation" },
      { name: "Water", tooltipKey: "tags.tooltips.water" },
    ],
  },
  {
    key: "platform",
    labelKey: "projectInfo.tagCategories.platform",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    tags: [
      { name: "Web", tooltipKey: "tags.tooltips.web" },
      { name: "Mobile", tooltipKey: "tags.tooltips.mobile" },
      { name: "Desktop", tooltipKey: "tags.tooltips.desktop" },
      { name: "Cloud", tooltipKey: "tags.tooltips.cloud" },
      { name: "Backend", tooltipKey: "tags.tooltips.backend" },
      { name: "Embedded", tooltipKey: "tags.tooltips.embedded" },
      { name: "OT", tooltipKey: "tags.tooltips.ot" },
      { name: "IoT", tooltipKey: "tags.tooltips.iot" },
      { name: "AI", tooltipKey: "tags.tooltips.ai" },
    ],
  },
  {
    key: "regulation",
    labelKey: "projectInfo.tagCategories.regulation",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    tags: [
      // Generic EU Regulations
      {
        name: "CRA",
        tooltipKey: "tags.tooltips.cra",
        docDescriptionKey: "tags.docDescriptions.cra",
      },
      {
        name: "NIS2",
        tooltipKey: "tags.tooltips.nis2",
        docDescriptionKey: "tags.docDescriptions.nis2",
      },
      {
        name: "GDPR",
        tooltipKey: "tags.tooltips.gdpr",
        docDescriptionKey: "tags.docDescriptions.gdpr",
      },
      {
        name: "AI Act",
        tooltipKey: "tags.tooltips.aiAct",
        docDescriptionKey: "tags.docDescriptions.aiAct",
      },
      // Industrial
      {
        name: "IEC 62443",
        tooltipKey: "tags.tooltips.iec62443",
        docDescriptionKey: "tags.docDescriptions.iec62443",
      },
      {
        name: "EN 18031",
        tooltipKey: "tags.tooltips.en18031",
        docDescriptionKey: "tags.docDescriptions.en18031",
      },
      // Medical
      {
        name: "IEC 81001",
        tooltipKey: "tags.tooltips.iec81001",
        docDescriptionKey: "tags.docDescriptions.iec81001",
      },
      {
        name: "IEC TR 60601",
        tooltipKey: "tags.tooltips.iecTr60601",
        docDescriptionKey: "tags.docDescriptions.iecTr60601",
      },
      // Automotive
      {
        name: "ISO 21434",
        tooltipKey: "tags.tooltips.iso21434",
        docDescriptionKey: "tags.docDescriptions.iso21434",
      },
      // Railway
      {
        name: "CLC/TS 50701",
        tooltipKey: "tags.tooltips.clcTs50701",
        docDescriptionKey: "tags.docDescriptions.clcTs50701",
      },
      {
        name: "IEC 63452",
        tooltipKey: "tags.tooltips.iec63452",
        docDescriptionKey: "tags.docDescriptions.iec63452",
      },
      // IT Security
      {
        name: "ISO 27001",
        tooltipKey: "tags.tooltips.iso27001",
        docDescriptionKey: "tags.docDescriptions.iso27001",
      },
      {
        name: "ETSI TVRA",
        tooltipKey: "tags.tooltips.etsiTvra",
        docDescriptionKey: "tags.docDescriptions.etsiTvra",
      },
      // Cloud
      {
        name: "ISO 27017",
        tooltipKey: "tags.tooltips.iso27017",
        docDescriptionKey: "tags.docDescriptions.iso27017",
      },
      // IoT
      {
        name: "ETSI EN 303 645",
        tooltipKey: "tags.tooltips.etsiEn303645",
        docDescriptionKey: "tags.docDescriptions.etsiEn303645",
      },
      {
        name: "EN 17927",
        tooltipKey: "tags.tooltips.en17927",
        docDescriptionKey: "tags.docDescriptions.en17927",
      },
      // Energy
      {
        name: "IEC 62351",
        tooltipKey: "tags.tooltips.iec62351",
        docDescriptionKey: "tags.docDescriptions.iec62351",
      },
      // Machinery — Approach A (risk-derived: AP = EL×WoO+AC) and Approach B
      // (Clause 8 fixed IEC 62443-3-3/-4-2 subset) are separate conformance
      // claims (prEN 50742:2025 Clause 4.1, mutually exclusive — see
      // tagConflicts.en50742Approach). Only Approach A selects the
      // `en-50742-a` likelihood preset and therefore locks factors in
      // risk-config-dialog / asset-config-dialog; Approach B has no risk
      // method impact (compliance-subset only). Both still require the
      // Hazard tab (requiresHazardAnalysis).
      {
        name: "EN 50742 A",
        tooltipKey: "tags.tooltips.en50742A",
        docDescriptionKey: "tags.docDescriptions.en50742A",
      },
      {
        name: "EN 50742 B",
        tooltipKey: "tags.tooltips.en50742B",
        docDescriptionKey: "tags.docDescriptions.en50742B",
      },
    ],
  },
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Get all tag names from all categories
 */
export const getAllPredefinedTagNames = (): string[] => {
  return TAG_CATEGORIES.flatMap((cat) => cat.tags.map((t) => t.name));
};

/**
 * Check if a tag name is predefined
 */
export const isPredefinedTag = (tagName: string): boolean => {
  return getAllPredefinedTagNames().includes(tagName);
};

/**
 * Get category for a tag (checks predefined first, then custom assignment)
 */
export const getTagCategory = (
  tagName: string,
  customTagCategories: Record<string, TagCategoryKey>
): TagCategory | null => {
  // Check predefined tags
  const predefinedCategory = TAG_CATEGORIES.find((cat) =>
    cat.tags.some((t) => t.name === tagName)
  );
  if (predefinedCategory) return predefinedCategory;

  // Check custom tag assignment
  const customCategoryKey = customTagCategories[tagName];
  if (customCategoryKey) {
    return TAG_CATEGORIES.find((cat) => cat.key === customCategoryKey) || null;
  }

  return null;
};

/**
 * Get tag definition (includes tooltip if available)
 */
export const getTagDefinition = (tagName: string): TagDefinition | null => {
  for (const category of TAG_CATEGORIES) {
    const tagDef = category.tags.find((t) => t.name === tagName);
    if (tagDef) return tagDef;
  }
  return null;
};

/**
 * Get styling for a tag based on its category
 */
export const getTagStyles = (
  tagName: string,
  customTagCategories: Record<string, TagCategoryKey>
): { bg: string; text: string } => {
  const category = getTagCategory(tagName, customTagCategories);
  if (!category) {
    return { bg: "bg-gray-100", text: "text-gray-700" };
  }
  return { bg: category.bgColor, text: category.textColor };
};

/**
 * Get tags grouped by category
 */
export const getTagsByCategory = (
  tags: string[],
  customTagCategories: Record<string, TagCategoryKey>
): { category: TagCategory; tags: string[] }[] => {
  const result: { category: TagCategory; tags: string[] }[] = [];

  TAG_CATEGORIES.forEach((category) => {
    const categoryTags = tags.filter((tag) => {
      const tagCat = getTagCategory(tag, customTagCategories);
      return tagCat?.key === category.key;
    });
    if (categoryTags.length > 0) {
      result.push({ category, tags: categoryTags });
    }
  });

  return result;
};

/**
 * Get available predefined tags for a category (not yet selected)
 */
export const getAvailablePredefinedTags = (
  category: TagCategory,
  selectedTags: string[]
): TagDefinition[] => {
  return category.tags.filter((t) => !selectedTags.includes(t.name));
};

// ==================== REGULATION-SPECIFIC HELPERS ====================

/**
 * Get all regulation tag names
 */
export const getRegulationTagNames = (): string[] => {
  const regulationCategory = TAG_CATEGORIES.find((c) => c.key === "regulation");
  return regulationCategory?.tags.map((t) => t.name) ?? [];
};

/**
 * Check if a tag is a regulation tag
 */
export const isRegulationTag = (tagName: string): boolean => {
  return getRegulationTagNames().includes(tagName);
};

/**
 * Get regulation tags from a list of tag names
 * Returns full TagDefinition objects for matching tags
 */
export const getRegulationTags = (tagNames: string[]): TagDefinition[] => {
  const regulationCategory = TAG_CATEGORIES.find((c) => c.key === "regulation");
  if (!regulationCategory) return [];

  return regulationCategory.tags.filter((tagDef) =>
    tagNames.includes(tagDef.name),
  );
};