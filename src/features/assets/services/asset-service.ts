// ==================== ASSET SERVICE ====================
// Orchestration layer — coordinates CRUD, config, save/load, and phase status.
// Business logic lives in dedicated utils/services; this class only delegates.
//
// Dependencies (all via Dependency Inversion — no direct model logic):
//   asset-factory           → object creation
//   asset-impact-calculator → impact calculation
//   asset-migration         → schema migration on load
//   asset-validator         → validation + phase status
//   asset-sync.service      → DFD synchronisation (separate concern)

import type { PhaseStatusMap } from "shared";
import type {
  Asset,
  AssetData,
  AssetProjectData,
  AssetValidation,
  AssetConfiguration,
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
} from "../models/asset-types";
import type { ImpactRating } from "../models/asset-impact-types";
import { PREDEFINED_IMPACT_CRITERIA } from "../models/asset-impact-types";

import {
  createEmptyAsset,
  createDefaultAssetData,
  generateNextAssetId,
  renumberAssets,
} from "./asset-factory";
import {
  calculateOverallImpact,
  recalculateAllImpacts,
} from "./asset-impact-calculator";
import {
  deriveAggregatedImpact,
  overallImpactToBusinessLevel,
  type PhysicalImpactLevel,
} from "./asset-physical-impact-deriver";
import { applyHVAToAsset } from "./asset-hva-deriver";
import { migrateAssetConfiguration } from "./asset-migration";
import { validateAssetData, derivePhaseStatus } from "./asset-validator";
import { syncFromDFD, getAssetsMissingInDFD } from "./asset-sync-service";
export type { DFDAssetSyncResult } from "./asset-sync-service";

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

// ==================== ASSET SERVICE ====================

class AssetService {
  // ── Load ────────────────────────────────────────────────────────────────

  loadAssets(project: AssetProjectData): AssetLoadResult {
    try {
      return {
        success: true,
        hasData: Boolean(project.assets?.assets.length),
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

  // ── Save ────────────────────────────────────────────────────────────────

  saveAssets(project: AssetProjectData, assetData: AssetData): AssetSaveResult {
    try {
      const migrated = {
        ...assetData,
        configuration: migrateAssetConfiguration(assetData.configuration),
      };

      const validation = validateAssetData(migrated);
      const phaseStatus = derivePhaseStatus(validation);
      const lastModified = new Date().toISOString();

      return {
        success: true,
        assets: { ...migrated, lastModified },
        phaseStatus: { ...project.phaseStatus, 2: phaseStatus },
        lastModified,
        validation,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Save failed";
      return {
        success: false,
        assets: assetData,
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
        validation: {
          isComplete: false,
          errors: [msg],
          warnings: [],
          lastValidated: new Date().toISOString(),
        },
        error: msg,
      };
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  createAsset(assetData: AssetData): Asset {
    const id = generateNextAssetId(assetData.assets);
    return createEmptyAsset(id, assetData.configuration);
  }

  addAsset(assetData: AssetData, asset: Asset): AssetData {
    return {
      ...assetData,
      assets: [...assetData.assets, asset],
      lastModified: new Date().toISOString(),
    };
  }

  updateAsset(assetData: AssetData, updated: Asset): AssetData {
    const { configuration } = assetData;

    // Step 1 — recalculate overall business impact
    const overallImpact = calculateOverallImpact(
      updated.impactRatings,
      configuration.calculationMethod,
      configuration.roundingMethod,
      configuration.impactCriteria,
    );

    // Step 2 — derive HVA from replacementLeadTime + vendorDependency + spareAvailability
    // (only runs for infrastructure/physical; respects manual override)
    const withHVA = applyHVAToAsset({ ...updated, overallImpact });

    // Step 3 — re-derive aggregatedImpact with updated HVA and current physicalImpact
    // undefined if no safety annotations — aggregation handles it correctly
    const physicalLevel = withHVA.physicalImpact as
      | PhysicalImpactLevel
      | undefined;
    const physicalDirect = withHVA.linkedDFDElements.some(
      (l) =>
        l.safety?.relevance === "direct" &&
        (l.safety.impact === "fatality" ||
          l.safety.impact === "irreversible_injury"),
    );
    const aggregated = deriveAggregatedImpact(
      physicalLevel,
      physicalDirect,
      overallImpactToBusinessLevel(overallImpact),
      withHVA.properties?.isHighValueAsset,
      withHVA.properties?.assetDestructionImpact,
    );

    const withImpact: Asset = {
      ...withHVA,
      aggregatedImpact: aggregated,
      lastModified: new Date().toISOString(),
    };

    return {
      ...assetData,
      assets: assetData.assets.map((a) =>
        a.id === withImpact.id ? withImpact : a,
      ),
      lastModified: new Date().toISOString(),
    };
  }

  deleteAsset(assetData: AssetData, assetId: string): AssetData {
    return {
      ...assetData,
      // No renumbering — DFD-sourced assets have stable IDs (DA-001 etc.)
      assets: assetData.assets.filter((a) => a.id !== assetId),
      lastModified: new Date().toISOString(),
    };
  }

  // ── Configuration ───────────────────────────────────────────────────────

  updateConfiguration(
    assetData: AssetData,
    configuration: AssetConfiguration,
  ): AssetData {
    const migratedConfig = migrateAssetConfiguration(configuration);

    const updatedAssets = assetData.assets.map((asset) => {
      // Align impact ratings to new criteria set — keep existing values, drop removed
      const newRatings: ImpactRating[] = migratedConfig.impactCriteria.map(
        (criterion) => {
          const existing = asset.impactRatings.find(
            (r) => r.criterionId === criterion.id, // bug fix: was using criterionId as string
          );
          return existing ?? { criterionId: criterion.id, value: 0 };
        },
      );

      return {
        ...asset,
        impactRatings: newRatings,
        overallImpact: calculateOverallImpact(
          newRatings,
          migratedConfig.calculationMethod,
          migratedConfig.roundingMethod,
          migratedConfig.impactCriteria, // pass weights
        ),
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

  // ── DFD Sync (delegated) ────────────────────────────────────────────────

  syncFromDFD(
    assetData: AssetData,
    dfdAssets: AssetDFDAsset[],
    dfdElements: AssetDFDElement[],
    dfdConnections: AssetDFDConnection[],
  ) {
    return syncFromDFD(assetData, dfdAssets, dfdElements, dfdConnections);
  }

  getAssetsMissingInDFD(assetData: AssetData, dfdAssets: AssetDFDAsset[]) {
    return getAssetsMissingInDFD(assetData, dfdAssets);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  initializeAssetData(): AssetData {
    return createDefaultAssetData();
  }

  recalculateAllImpacts(assetData: AssetData): AssetData {
    return recalculateAllImpacts(assetData);
  }

  getImpactCriterion(id: string) {
    return PREDEFINED_IMPACT_CRITERIA.find((c) => c.id === id);
  }

  /**
   * Validate asset data and return AssetValidation.
   * Delegates to asset-validator — exposed on the service so components
   * don't need to import from the service layer directly.
   */
  validate(assetData: AssetData): AssetValidation {
    return validateAssetData(assetData);
  }
}

export const assetService = new AssetService();
export default assetService;