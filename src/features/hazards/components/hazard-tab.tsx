// features/hazards/components/hazard-tab.tsx
//
// Phase 1: Hazard identification (Bowtie). Orchestrator in the same shape as
// AssetsTab: a local working copy of HazardData, dirty tracking, a debounced
// auto-save that emits HazardUpdateResult, and toolbar + master list + Bowtie
// dialog + settings dialog wired to the tested services.
//
// Inline-created assets (Bowtie quick-capture) are buffered here and emitted in
// the update result's createdAssets; the app layer folds them into dfd.assets.
// Until the persist/sync round-trip completes, they are also merged into the
// `assets` passed to table/dialog so ids stay collision-free and names resolve.

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "@mui/material";

import type {
  AssetReference,
  CreatedAsset,
  HazardItem,
  HazardItemId,
} from "shared";
import type { HazardProjectData, HazardUpdateResult } from "../models/hazard-tab-types";
import {
  createEmptyHazardData,
  DEFAULT_HAZARD_CONFIGURATION,
  type HazardConfiguration,
  type HazardData,
} from "../models/hazard-data-types";
import { hazardService } from "../services/hazard-service";
import { hazardValidator, type HazardValidation } from "../services/hazard-validator";

import { HazardToolbar } from "./hazard-toolbar";
import { HazardTable } from "./hazard-table";
import { HazardDialog } from "./hazard-dialog";
import { HazardConfigDialog } from "./hazard-config-dialog";

// ==================== PROPS ====================

export interface HazardTabProps {
  project: HazardProjectData;
  onUpdate: (updates: HazardUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

function seedToRef(a: CreatedAsset): AssetReference {
  return {
    id: a.id,
    name: a.name,
    assetGroup: a.assetGroup,
    hasSafetyAnnotation: false,
  };
}

// ==================== COMPONENT ====================

export const HazardsTab: React.FC<HazardTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t } = useTranslation();

  // Assets created in the Bowtie but not yet folded back via persist + sync.
  const [pendingCreatedAssets, setPendingCreatedAssets] = useState<
    CreatedAsset[]
  >([]);

  const assets = useMemo<AssetReference[]>(
    () => [
      ...(project.assetDataRef?.assets ?? []),
      ...pendingCreatedAssets.map(seedToRef),
    ],
    [project.assetDataRef, pendingCreatedAssets],
  );

  // ── State ────────────────────────────────────────────────────────────────
  const [hazardData, setHazardData] = useState<HazardData>(
    () => project.hazards ?? createEmptyHazardData(),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [validation, setValidation] = useState<HazardValidation | null>(() =>
    project.hazards ? hazardValidator.validate(project.hazards, assets) : null,
  );

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingHazardId, setEditingHazardId] = useState<HazardItemId | null>(
    null,
  );

  // Config dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [tempConfig, setTempConfig] = useState<HazardConfiguration | null>(
    null,
  );

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Re-sync from project when it changes upstream.
  useEffect(() => {
    if (project.hazards) {
      setHazardData(project.hazards);
      setValidation(hazardValidator.validate(project.hazards, assets));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.hazards]);

  // Once newly created assets have arrived in the synced project assets, drop
  // them from the pending buffer to avoid showing them twice.
  useEffect(() => {
    if (pendingCreatedAssets.length === 0) return;
    const synced = new Set(
      (project.assetDataRef?.assets ?? []).map((a) => a.id),
    );
    const stillPending = pendingCreatedAssets.filter((a) => !synced.has(a.id));
    if (stillPending.length !== pendingCreatedAssets.length) {
      setPendingCreatedAssets(stillPending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.assetDataRef]);

  // Debounced auto-save.
  useEffect(() => {
    if (!isDirty) return;
    const timeoutId = setTimeout(() => {
      const stamped = hazardService.toUpdateResult(hazardData);
      const result: HazardUpdateResult = {
        hazards: stamped.hazards,
        lastModified: stamped.lastModified,
        createdAssets: pendingCreatedAssets.length
          ? pendingCreatedAssets
          : undefined,
      };
      setHazardData(result.hazards);
      setValidation(hazardValidator.validate(result.hazards, assets));
      setIsDirty(false);
      onUpdate(result);
    }, 1000);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, hazardData, pendingCreatedAssets, onUpdate]);

  const markDirty = useCallback(() => {
    setIsDirty((prev) => (prev ? prev : true));
  }, []);

  // ── Hazard handlers ────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    setEditingHazardId(null);
    setShowDialog(true);
  }, []);

  const handleEdit = useCallback((hazard: HazardItem) => {
    setEditingHazardId(hazard.id);
    setShowDialog(true);
  }, []);

  const handleSaveHazard = useCallback(
    (data: HazardData, createdAssets: CreatedAsset[]) => {
      setHazardData(data);
      setValidation(hazardValidator.validate(data, assets));
      if (createdAssets.length) {
        setPendingCreatedAssets((prev) => [...prev, ...createdAssets]);
      }
      setShowDialog(false);
      setEditingHazardId(null);
      markDirty();
    },
    [assets, markDirty],
  );

  const handleCloseDialog = useCallback(() => {
    setShowDialog(false);
    setEditingHazardId(null);
  }, []);

  const handleDeleteHazard = useCallback(
    (id: HazardItemId) => {
      const refs = hazardService.getReferencingRelations(hazardData, id);
      if (refs.length > 0) {
        const ok = window.confirm(
          t("tabs.hazards.deleteConfirm", {
            count: refs.length,
            defaultValue: `This hazard has ${refs.length} linked edge(s). Delete anyway?`,
          }),
        );
        if (!ok) return;
      }
      const updated = hazardService.deleteHazard(hazardData, id);
      setHazardData(updated);
      setValidation(hazardValidator.validate(updated, assets));
      markDirty();
    },
    [hazardData, assets, markDirty, t],
  );

  const handleQuickAdd = useCallback(
    (label: string) => {
      const item = hazardService.createHazardItem(hazardData, {
        label,
        combinationType: hazardData.configuration?.defaultCombinationType,
      });
      const updated = hazardService.addHazard(hazardData, item);
      setHazardData(updated);
      setValidation(hazardValidator.validate(updated, assets));
      markDirty();
    },
    [hazardData, assets, markDirty],
  );

  // ── Config handlers ──────────────────────────────────────────────────────

  const handleOpenConfig = useCallback(() => {
    setTempConfig({
      ...(hazardData.configuration ?? DEFAULT_HAZARD_CONFIGURATION),
    });
    setShowConfigDialog(true);
  }, [hazardData.configuration]);

  const handleConfigChange = useCallback((config: HazardConfiguration) => {
    setTempConfig(config);
  }, []);

  const handleSaveConfig = useCallback(() => {
    if (!tempConfig) return;
    setHazardData((d) => ({ ...d, configuration: tempConfig }));
    setShowConfigDialog(false);
    setTempConfig(null);
    markDirty();
  }, [tempConfig, markDirty]);

  const handleCloseConfig = useCallback(() => {
    setTempConfig(null);
    setShowConfigDialog(false);
  }, []);

  // ── Proceed ────────────────────────────────────────────────────────────────

  const handleProceed = useCallback(() => {
    onPhaseComplete?.();
  }, [onPhaseComplete]);

  // ==================== RENDER ====================

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <HazardToolbar
        isDirty={isDirty}
        validation={validation}
        hazardCount={hazardData.hazards.length}
        onAdd={handleAdd}
        onOpenConfig={handleOpenConfig}
        onProceed={handleProceed}
      />

      <Box sx={{ flexGrow: 1, overflow: "auto", p: 2, minHeight: 0 }}>
        <HazardTable
          data={hazardData}
          assets={assets}
          onEdit={handleEdit}
          onDelete={handleDeleteHazard}
          onQuickAdd={handleQuickAdd}
        />
      </Box>

      {showDialog && (
        <HazardDialog
          open={showDialog}
          data={hazardData}
          hazardId={editingHazardId}
          assets={assets}
          onSave={handleSaveHazard}
          onClose={handleCloseDialog}
        />
      )}

      <HazardConfigDialog
        open={showConfigDialog}
        configuration={
          tempConfig ?? hazardData.configuration ?? DEFAULT_HAZARD_CONFIGURATION
        }
        onChange={handleConfigChange}
        onSave={handleSaveConfig}
        onClose={handleCloseConfig}
      />
    </Box>
  );
};

export default HazardsTab;