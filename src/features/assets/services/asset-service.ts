// ==================== ASSET SERVICE ====================
// Business logic for Asset operations
// NO dependency on app - uses AssetProjectData from asset-types

import { PhaseStatus, PhaseStatusMap } from "shared";
import {
  Asset,
  AssetData,
  AssetProjectData,
  AssetValidation,
  AssetConfiguration,
  DFDElementLink,
  ImpactRating,
  calculateOverallImpact,
  createEmptyAsset,
  createDefaultAssetData,
  generateNextAssetId,
  renumberAssets,
  parseAssetId,
  migrateAssetConfiguration,
  PREDEFINED_IMPACT_CRITERIA,
} from "../models/asset-types";

// ==================== RESULT TYPES ====================

export interface AssetSaveResult {
  success: boolean;
  assets: AssetData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
  validation: AssetValidation;
  error?: string;
}

export interface AssetLoadResult {
  success: boolean;
  hasData: boolean;
  assetCount?: number;
  error?: string;
}

export interface DFDAssetParseResult {
  assets: ParsedDFDAsset[];
  warnings: string[];
}

export interface ParsedDFDAsset {
  id: string;
  label: string;
  elementId: string;
  position: { x: number; y: number };
}

// ==================== ASSET SERVICE ====================

class AssetService {
  // ==================== LOAD OPERATIONS ====================

  /**
   * Load asset data from project
   */
  loadAssets(project: AssetProjectData): AssetLoadResult {
    try {
      const hasData = Boolean(
        project.assets && project.assets.assets.length > 0
      );

      return {
        success: true,
        hasData,
        assetCount: project.assets?.assets.length ?? 0,
      };
    } catch (error) {
      return {
        success: false,
        hasData: false,
        error: error instanceof Error ? error.message : "Failed to load assets",
      };
    }
  }

  // ==================== SAVE OPERATIONS ====================

  /**
   * Save asset data
   */
  saveAssets(project: AssetProjectData, assetData: AssetData): AssetSaveResult {
    try {
      // Ensure configuration is migrated
      const migratedConfig = migrateAssetConfiguration(assetData.configuration);
      const dataWithMigratedConfig = {
        ...assetData,
        configuration: migratedConfig,
      };

      // Validate
      const validation = this.validate(dataWithMigratedConfig);

      // Determine phase status
      const phaseStatus = this.determinePhaseStatus(validation);
      const lastModified = new Date().toISOString();

      // Update phase status map
      const updatedPhaseStatus: PhaseStatusMap = {
        ...project.phaseStatus,
        2: phaseStatus, // Phase 2 = Assets
      };

      // Update asset data
      const updatedAssetData: AssetData = {
        ...dataWithMigratedConfig,
        validation,
        lastModified,
      };

      return {
        success: true,
        assets: updatedAssetData,
        phaseStatus: updatedPhaseStatus,
        lastModified,
        validation,
      };
    } catch (error) {
      return {
        success: false,
        assets: assetData,
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
        validation: {
          isComplete: false,
          errors: [error instanceof Error ? error.message : "Save failed"],
          warnings: [],
          lastValidated: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : "Failed to save assets",
      };
    }
  }

  // ==================== VALIDATION ====================

  /**
   * Validate asset data
   */
  validate(assetData: AssetData): AssetValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check: At least 1 asset required
    if (assetData.assets.length === 0) {
      errors.push("validation.assets.noAssets");
    }

    // Check each asset
    assetData.assets.forEach((asset) => {
      // Name required
      if (!asset.name.trim()) {
        errors.push(`validation.assets.noName:${asset.id}`);
      }

      // At least one security goal must be enabled
      const hasSecurityGoal = asset.securityGoals.some((sg) => sg.enabled);
      if (!hasSecurityGoal) {
        errors.push(`validation.assets.noSecurityGoal:${asset.id}`);
      }

      // Security goals with enabled flag should have description
      asset.securityGoals
        .filter((sg) => sg.enabled && !sg.formalDescription.trim())
        .forEach((sg) => {
          warnings.push(
            `validation.assets.noSecurityGoalDescription:${asset.id}:${sg.type}`
          );
        });

      // Check if linked to DFD
      if (asset.linkedDFDElements.length === 0) {
        warnings.push(`validation.assets.notLinkedToDFD:${asset.id}`);
      }

      // Check if all impact criteria are rated
      const unratedCriteria = asset.impactRatings.filter((r) => r.value === 0);
      if (unratedCriteria.length > 0) {
        warnings.push(`validation.assets.unratedImpact:${asset.id}`);
      }
    });

    // Check for assets in DFD that are not in asset list
    // (This would require DFD XML parsing - handled separately)

    const isComplete = errors.length === 0 && assetData.assets.length > 0;

    return {
      isComplete,
      errors,
      warnings,
      lastValidated: new Date().toISOString(),
    };
  }

  // ==================== ASSET CRUD ====================

  /**
   * Create a new asset
   */
  createAsset(assetData: AssetData): Asset {
    const id = generateNextAssetId(assetData.assets);
    return createEmptyAsset(id, assetData.configuration);
  }

  /**
   * Add asset to data
   */
  addAsset(assetData: AssetData, asset: Asset): AssetData {
    return {
      ...assetData,
      assets: [...assetData.assets, asset],
      lastModified: new Date().toISOString(),
    };
  }

  /**
   * Update an existing asset
   */
  updateAsset(assetData: AssetData, updatedAsset: Asset): AssetData {
    const config = assetData.configuration;

    // Recalculate overall impact with rounding method
    const assetWithImpact: Asset = {
      ...updatedAsset,
      overallImpact: calculateOverallImpact(
        updatedAsset.impactRatings,
        config.calculationMethod,
        config.roundingMethod
      ),
      lastModified: new Date().toISOString(),
    };

    return {
      ...assetData,
      assets: assetData.assets.map((a) =>
        a.id === assetWithImpact.id ? assetWithImpact : a
      ),
      lastModified: new Date().toISOString(),
    };
  }

  /**
   * Delete an asset and renumber remaining
   */
  deleteAsset(assetData: AssetData, assetId: string): AssetData {
    const filteredAssets = assetData.assets.filter((a) => a.id !== assetId);
    const renumberedAssets = renumberAssets(filteredAssets);

    return {
      ...assetData,
      assets: renumberedAssets,
      lastModified: new Date().toISOString(),
    };
  }

  // ==================== CONFIGURATION ====================

  /**
   * Update asset configuration
   */
  updateConfiguration(
    assetData: AssetData,
    configuration: AssetConfiguration
  ): AssetData {
    // Ensure configuration has all required fields (migration)
    const migratedConfig = migrateAssetConfiguration(configuration);

    // When configuration changes, update all assets
    const updatedAssets = assetData.assets.map((asset) => {
      // Update impact ratings for new criteria
      const newRatings: ImpactRating[] = migratedConfig.impactCriteria.map(
        (criterionId) => {
          // Keep existing rating if criterion still exists
          const existing = asset.impactRatings.find(
            (r) => r.criterionId === criterionId
          );
          return existing ?? { criterionId, value: 0 };
        }
      );

      // Recalculate overall impact with new settings
      const overallImpact = calculateOverallImpact(
        newRatings,
        migratedConfig.calculationMethod,
        migratedConfig.roundingMethod
      );

      return {
        ...asset,
        impactRatings: newRatings,
        overallImpact,
        lastModified: new Date().toISOString(),
      };
    });

    return {
      ...assetData,
      configuration: migratedConfig,
      assets: updatedAssets,
      lastModified: new Date().toISOString(),
    };
  }

  // ==================== DFD SYNC ====================

  /**
   * Parse asset labels from DFD XML
   */
  parseAssetsFromDFD(dfdXml: string): DFDAssetParseResult {
    const assets: ParsedDFDAsset[] = [];
    const warnings: string[] = [];

    if (!dfdXml) {
      return { assets, warnings };
    }

    try {
      // Parse XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(dfdXml, "text/xml");

      // Find all asset objects: <object type="asset" ...>
      const assetElements = doc.querySelectorAll('object[type="asset"]');

      assetElements.forEach((element) => {
        const label = element.getAttribute("label") || "A-xx";
        const elementId = element.getAttribute("id") || "";

        // Get position from mxCell geometry
        const mxCell = element.querySelector("mxCell");
        const geometry = mxCell?.querySelector("mxGeometry");
        const x = parseFloat(geometry?.getAttribute("x") || "0");
        const y = parseFloat(geometry?.getAttribute("y") || "0");

        assets.push({
          id: label,
          label,
          elementId,
          position: { x, y },
        });
      });
    } catch (error) {
      warnings.push("Failed to parse DFD XML for assets");
    }

    return { assets, warnings };
  }

  /**
   * Sync assets from DFD to asset list
   */
  syncFromDFD(
    assetData: AssetData,
    dfdXml: string
  ): { assetData: AssetData; newAssets: string[]; warnings: string[] } {
    const { assets: dfdAssets, warnings } = this.parseAssetsFromDFD(dfdXml);
    const newAssetIds: string[] = [];

    let updatedAssetData = { ...assetData };

    dfdAssets.forEach((dfdAsset) => {
      // Skip placeholder labels (A-xx)
      if (dfdAsset.label === "A-xx") {
        warnings.push(
          `Unassigned asset label found at position (${dfdAsset.position.x}, ${dfdAsset.position.y})`
        );
        return;
      }

      // Check if asset already exists
      const existingAsset = assetData.assets.find(
        (a) => a.id === dfdAsset.label
      );

      if (!existingAsset) {
        // Create new asset from DFD
        const newAsset: Asset = {
          ...createEmptyAsset(dfdAsset.label, assetData.configuration),
          id: dfdAsset.label,
          numericId: parseAssetId(dfdAsset.label),
          source: "dfd",
          syncedWithDFD: true,
          linkedDFDElements: [
            {
              elementId: dfdAsset.elementId,
              elementName: dfdAsset.label,
              elementType: "asset",
            },
          ],
        };

        updatedAssetData = this.addAsset(updatedAssetData, newAsset);
        newAssetIds.push(dfdAsset.label);
      } else {
        // Update existing asset's DFD link
        const updatedAsset: Asset = {
          ...existingAsset,
          syncedWithDFD: true,
          linkedDFDElements: [
            ...existingAsset.linkedDFDElements.filter(
              (l) => l.elementId !== dfdAsset.elementId
            ),
            {
              elementId: dfdAsset.elementId,
              elementName: dfdAsset.label,
              elementType: "asset",
            },
          ],
        };

        updatedAssetData = this.updateAsset(updatedAssetData, updatedAsset);
      }
    });

    // Check for assets not in DFD
    updatedAssetData.assets.forEach((asset) => {
      const inDFD = dfdAssets.some((d) => d.label === asset.id);
      if (!inDFD && asset.source === "dfd") {
        warnings.push(`Asset ${asset.id} not found in DFD`);
      }
    });

    return {
      assetData: updatedAssetData,
      newAssets: newAssetIds,
      warnings,
    };
  }

  /**
   * Get assets that are missing in DFD
   */
  getAssetsMissingInDFD(assetData: AssetData, dfdXml: string): Asset[] {
    const { assets: dfdAssets } = this.parseAssetsFromDFD(dfdXml);
    const dfdAssetIds = new Set(dfdAssets.map((a) => a.label));

    return assetData.assets.filter(
      (asset) => asset.source === "manual" && !dfdAssetIds.has(asset.id)
    );
  }

  // ==================== PHASE STATUS ====================

  private determinePhaseStatus(validation: AssetValidation): PhaseStatus {
    if (validation.isComplete) return "complete";
    if (validation.errors.length > 0) return "incomplete";
    return "in-progress";
  }

  // ==================== HELPERS ====================

  /**
   * Get impact criterion definition by ID
   */
  getImpactCriterion(id: string) {
    return PREDEFINED_IMPACT_CRITERIA.find((c) => c.id === id);
  }

  /**
   * Initialize asset data for a new project
   */
  initializeAssetData(): AssetData {
    return createDefaultAssetData();
  }

  /**
   * Recalculate all asset impacts (useful after config change)
   */
  recalculateAllImpacts(assetData: AssetData): AssetData {
    const config = assetData.configuration;

    const updatedAssets = assetData.assets.map((asset) => ({
      ...asset,
      overallImpact: calculateOverallImpact(
        asset.impactRatings,
        config.calculationMethod,
        config.roundingMethod
      ),
    }));

    return {
      ...assetData,
      assets: updatedAssets,
      lastModified: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const assetService = new AssetService();
export default assetService;