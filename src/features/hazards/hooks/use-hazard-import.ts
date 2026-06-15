// features/hazards/hooks/use-hazard-import.ts
//
// Seam between the import service and the Hazard tab:
//   pick file -> detect adapter
//     tabular -> readWorkbook -> requestImportProfile (dialog) -> applyImportProfile
//     structured (JSON) -> adapter.parse
//   -> bridge to HazardItem[] + HazardRelation[] + created Human assets
// The hook does not touch HazardData; the tab owns the merge.

import { useCallback } from "react";
import {
  hazardImporterRegistry,
  isProfileAdapter,
  type HazardImportWarning,
} from "../services/safety-hazard-importer";
import { applyImportProfile } from "../services/apply-import-profile";
import {
  bridgeSafetyHazards,
  type BridgeOutput,
} from "../services/hazard-bridge";
import type { HazardItemId, CreatedAsset } from "shared";
import type {
  ImportProfile,
  WorkbookPreview,
} from "../models/import-profile-types";

export interface ImportProfileRequest {
  workbook: WorkbookPreview;
  fileName: string;
  adapterLabel: string;
}

export interface HazardImportOutcome extends BridgeOutput {
  sourceFile?: string;
  adapterUsed?: string;
  cancelled?: boolean;
}

export interface UseHazardImportOptions {
  makeHazardItemId: () => HazardItemId;
  /** Existing assets (project + pending) for Human-target dedup and id minting. */
  existingAssets: { id: string; name: string; assetGroup: string }[];
  /** Mint a new Human protection-target asset (wraps the shared asset-creation primitive). */
  mintHumanAsset: (name: string, existingIds: string[]) => CreatedAsset;
  /** Show the mapping dialog for tabular files; resolve a profile or null. */
  requestImportProfile: (
    req: ImportProfileRequest,
  ) => Promise<ImportProfile | null>;
}

const ACCEPT = ".json,.csv,.xlsx,.xlsm,.xls,.ods";

export function useHazardImport({
  makeHazardItemId,
  existingAssets,
  mintHumanAsset,
  requestImportProfile,
}: UseHazardImportOptions) {
  const pickFile = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ACCEPT;
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  }, []);

  const importHazards = useCallback(async (): Promise<HazardImportOutcome> => {
    const file = await pickFile();
    if (!file) {
      return {
        items: [],
        relations: [],
        createdAssets: [],
        warnings: [],
        cancelled: true,
      };
    }

    const adapter = await hazardImporterRegistry.detect(file);
    if (!adapter)
      throw new Error(`No import adapter can handle "${file.name}"`);

    let result;
    if (isProfileAdapter(adapter)) {
      const workbook = await adapter.readWorkbook(file);
      const profile = await requestImportProfile({
        workbook,
        fileName: file.name,
        adapterLabel: adapter.label,
      });
      if (!profile) {
        return {
          items: [],
          relations: [],
          createdAssets: [],
          warnings: [],
          cancelled: true,
        };
      }
      result = applyImportProfile(workbook.sheets, profile, file.name);
    } else {
      result = await adapter.parse(file);
    }

    const bridged = bridgeSafetyHazards(result.hazards, {
      makeHazardItemId,
      existingAssets,
      mintHumanAsset,
    });

    const warnings: HazardImportWarning[] = [
      ...result.warnings,
      ...bridged.warnings,
    ];

    return {
      items: bridged.items,
      relations: bridged.relations,
      createdAssets: bridged.createdAssets,
      warnings,
      sourceFile: result.sourceFile,
      adapterUsed: result.adapterUsed,
    };
  }, [
    pickFile,
    makeHazardItemId,
    existingAssets,
    mintHumanAsset,
    requestImportProfile,
  ]);

  return { importHazards };
}