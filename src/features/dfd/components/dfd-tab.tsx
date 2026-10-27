// ==================== DFD TAB (REFACTORED) ====================
// Single Responsibility: View/UI only - delegates all logic to hooks
// NO business logic, NO data transformation, just rendering and event delegation

import { A2AOpsProvider } from "../contexts/a2a-ops-context";
import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, CircularProgress } from "@mui/material";
import { AssetGroup } from "shared";
import type {
  DFDViewMode,
  AssetRelation,
  DFDElementType,
} from "../models/dfd-types";

import type { DFDAsset } from "../models/dfd-asset-types";
import type { ControlInstance } from "shared/models/control-instance";
import type { SecurityDrift } from "app/hooks/use-security-drift";

import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";

// Hooks
import { useDFDEditor } from "../hooks/use-dfd-editor";
import { useDFDUIState } from "../hooks/use-dfd-ui-state";
import { useDFDExportImport } from "../hooks/use-dfd-export-import";
import { useAssetAssignment } from "../hooks/use-asset-assignment";
import { useDFDData } from "../hooks/use-dfd-data";
import { useDFDPersistence } from "../hooks/use-dfd-persistence";
import { useDrawioOverlay } from "../hooks/use-drawio-overlay";
import { useCellIdentity } from "../hooks/use-cell-identity";
import { useLeveledDfd } from "../hooks/use-leveled-dfd";
import type { InsertCandidate, CellRef } from "../services/leveled";

// Components
import DFDPreviewDialog from "./dfd-preview-dialog";
import DFDNotificationsPanel from "./dfd-notification-panel";
import DFDDescriptionView from "./dfd-description-view";
import {
  AssetGraphView,
  assetGraphSourceFromDfd,
  withRegistryAssets,
  type AssetGraphHazards,
  type AssetGraphRegistry,
} from "../asset-graph";
import { DFDToolbar } from "./dfd-toolbar";
import { AssetAssignmentDialog } from "./asset-assignment-dialog";
import { DFDDetailsPanel } from "./dfd-details-panel";
import { DFDConfigDialog } from "./dfd-config-dialog";
import {
  IdentityReviewDialog,
  IdentityReviewHints,
} from "./identity-review-dialog";
import { OrphanPageDialog } from "./child-page-ui";
import { InsertContextDialog } from "./insert-context-dialog";
import { LostDefinitionDialog } from "./lost-definition-dialog";
import type { AvailableAsset } from "./forms/asset-relation-selector";
import type { AssetUsageLookup } from "shared";
import type { AssetFocusRequest, AssetVisibility } from "./dfd-asset-panel";
import type {
  DFDAutoNumberingConfig,
  DFDProjectData,
  DFDUpdateResult,
} from "../models/dfd-types";
import { DEFAULT_AUTONUMBERING_CONFIG } from "../models/dfd-types";

// ==================== CONSTANTS ====================
// "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1&libraries=1";
const DRAWIO_BASE_URL = "https://embed.diagrams.net/?embed=1&spin=1&proto=json&plugins=1&configure=1&modified=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1";

// ==================== DFD TAB PROPS ====================

export interface DFDTabProps {
  project: DFDProjectData;
  /**
   * "Show in graph" from the asset table (FR-V13): a new object per request.
   * Opens the asset graph view focused on the asset and selects it in the
   * asset panel.
   */
  graphFocusRequest?: { readonly assetId: string } | null;
  /**
   * The project's Hazard Items and their edges for the asset graph (FR-V11,
   * read-only) — the DFD feature never imports the hazards feature.
   */
  hazards?: AssetGraphHazards | null;
  /**
   * The canonical asset registry for the asset graph: adds the manual assets
   * (e.g. hazard protection targets) that the dfd.assets mirror lacks.
   */
  assetRegistry?: AssetGraphRegistry | null;
  /** Label vocabulary of the preset (asset graph: S0–S3 under iso-21434). */
  labelVocabulary?: "default" | "iso-21434";
  /** "Show in table" from the asset graph (FR-V13, way back). */
  onShowInTable?: (assetId: string) => void;
  /** "Open in Hazard tab" from a hazard's card in the asset graph (G9). */
  onOpenHazard?: (hazardId: string) => void;
  onUpdate: (updates: DFDUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
  /**
   * Control gap requirements derived from selected Risk Tab mitigations.
   * Read-only — DFD Tab displays warnings, never writes back.
   * Provided by useControlInstanceDerivation in main-layout.
   */
  controlInstances?: ControlInstance[];

    /**
   * Security drift state — computed from controlInstances vs actual DFD properties.
   * Read-only — DFD Tab shows conflict warnings in DFDNotificationsPanel.
   */
  securityDrifts?: SecurityDrift[];
  /** Impact lookup for the asset delete confirm dialog (app layer). */
  assetUsage?: AssetUsageLookup;
  /**
   * Leveled DFD (5k): threats referring to an element / flow (by tfId), for
   * the question when a linked definition is lost (app layer).
   */
  threatCountOf?: (tfId: string) => number;
}

// ==================== COMPONENT ====================

export const DFDTab: React.FC<DFDTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
  controlInstances,
  securityDrifts,
  assetUsage,
  threatCountOf,
  graphFocusRequest,
  hazards,
  assetRegistry,
  labelVocabulary,
  onShowInTable,
  onOpenHazard,
}) => {
  // ==================== LOCAL UI STATE ====================

  const [showPreview, setShowPreview] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  // The selected CELL (leveled DFD 5g): page + cell id, for the identity
  // section — selectedElementId is the logical record it shows.
  const [selectedCellRef, setSelectedCellRef] = useState<CellRef | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [showAutoNumberConfig, setShowAutoNumberConfig] = useState(false);
  const [autoNumberingConfig, setAutoNumberingConfig] =
    useState<DFDAutoNumberingConfig>(
      () => project.dfd?.autoNumberingConfig ?? DEFAULT_AUTONUMBERING_CONFIG,
    );

  const [focusAssetRequest, setFocusAssetRequest] =
    useState<AssetFocusRequest | null>(null);
  /** Asset selected in the asset panel — shared with the asset graph (FR-V8). */
  const [panelAssetId, setPanelAssetId] = useState<string | null>(null);

  // ==================== UI STATE HOOK ====================

  const {
    viewMode,
    setViewMode,
    darkMode,
    toggleDarkMode,
    expandedGroups,
    toggleGroup,
    expandedElements,
    toggleElement,
    revealElement,
  } = useDFDUIState({
    projectId: project.id,
  });

  // A selection made with the mouse arrives after the button is released:
  // the plugin defers it (drawio-handlers.ts), so opening the details panel
  // never moves the diagram in the middle of a gesture.
  const handleSelectionChanged = useCallback((cells: any[]) => {
    const selectedCell = cells[0];
    // tfId: the logical record the cell shows (useDFDEditor resolves it,
    // also for context copies on other pages — leveled DFD §5.2).
    const elementId = selectedCell?.tfId || selectedCell?.xmlId || selectedCell?.id;

    if (!elementId) {
      setSelectedElementId(null);
      setSelectedCellRef(null);
      setDetailsPanelOpen(false);
      return;
    }
    setSelectedCellRef(
      selectedCell?.pageId && selectedCell?.xmlId
        ? { pageId: selectedCell.pageId, cellId: selectedCell.xmlId }
        : null,
    );

    // Kein Guard nötig — useDFDEditor stellt sicher dass das
    // Element im State ist bevor dieser Callback feuert.
    setSelectedElementId(elementId);
    setDetailsPanelOpen(true);
  }, []);

  // ==================== BUSINESS LOGIC HOOK ====================
  useEffect(() => {
    return () => console.log("❌ DFDTab UNMOUNT");
  }, []);

  // Stabilize options object — inline object literal creates new reference
  // on every render, causing useDFDEditor internals to reset.
  const editorOptions = useMemo(
    () => ({
      onUpdate,
      onDirtyChange,
      onPhaseComplete,
      darkMode,
      autoValidateInterval: 500,
      autoNumberOnSave: false,
      generateThumbnailOnSave: true,
      onSelectionChanged: handleSelectionChanged,
      autoNumberingConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [darkMode, handleSelectionChanged, autoNumberingConfig],
  );

  const editor = useDFDEditor(project, editorOptions);

  // Stabilize graphContext — new DFDGraphAnalysisContext() on every render
  // causes all consumers to remount. useMemo ensures stable reference.
  const graphContext = useMemo(
    () =>
      editor.graphContext
        ? new DFDGraphAnalysisContext(editor.graphContext)
        : null,
    [editor.graphContext],
  );

  // ==================== ASSET HOOKS ====================

  const assetAssignment = useAssetAssignment({
    iframeRef: editor.iframeRef,
  });

  // Leveled DFD: analysis and flows of a multi-page DFD (façade, finding 4).
  const selectedElement = selectedElementId
    ? editor.elements.find((e) => e.id === selectedElementId)
    : undefined;
  const leveled = useLeveledDfd(project, editor, {
    element: selectedElement,
    cellRef: selectedCellRef,
  });
  const { identityReview, childPages, lostDefinitions, insertContext } = leveled;

  const { updateElement, updateAsset, createAsset, deleteAsset, dfd } =
    useDFDData(project);
  const { scheduleSave, commitA2AOps } = useDFDPersistence(project, {
    onUpdate,
  });

  // AvailableAssets aus dfd.assets ableiten
  const availableAssets: AvailableAsset[] = useMemo(
    () =>
      (dfd?.assets ?? []).map((a) => ({
        id: a.id,
        displayId: a.displayId,
        name: a.name,
        assetGroup: a.assetGroup,
        protectionNeed: a.protectionNeed,
      })),
    [dfd?.assets],
  );

  // onCreateAsset-Callback — atomar: Asset + DFD updaten
  const handleCreateAsset = useCallback(
    (name: string, assetGroup: AssetGroup): AvailableAsset => {
      // Build on scheduleSave's `base` (the freshest known state — a pending,
      // not-yet-flushed edit if one exists, otherwise project.dfd), the same
      // way handleAssetChange and updateElementDescription do. Passing `base`
      // through to createAsset closes the race where the asset was created on
      // useDFDData's own project.dfd closure while a save was pending: the
      // Selector then immediately relates to the new asset via
      // updateElementDescription (which DOES build on `base`), and the two
      // computed on different foundations — the later wholesale replacement of
      // the pending save dropped the just-created asset, so it vanished from
      // both the DFD and the Asset tab right after the relation was added.
      //
      // scheduleSave runs its updater synchronously, so `created` is populated
      // before this callback returns and the real assetId reaches the Selector.
      let created!: DFDAsset;
      scheduleSave((base) => {
        const { newDfd, asset } = createAsset(
          name,
          assetGroup,
          undefined,
          base,
        );
        created = asset;
        return {
          dfd: newDfd,
          phaseStatus: project.phaseStatus,
          lastModified: newDfd.lastModified!,
        };
      });

      // Zurück an Selector → wird sofort als assetId der neuen Relation verwendet
      return {
        id: created.id,
        displayId: created.displayId,
        name: created.name,
        assetGroup: created.assetGroup,
        protectionNeed: created.protectionNeed,
      };
    },
    [createAsset, scheduleSave, project.phaseStatus],
  );

  // ==================== OVERLAY HOOK ==========================
  // Overlay hook — transient asset highlighting on the draw.io canvas
  // Leveled DFD: highlight every cell that shows a record, on every page.
  const cellIdentity = useCellIdentity(dfd);
  const overlay = useDrawioOverlay({
    exportXML: editor.exportXML,
    loadXMLTransient: editor.loadXMLTransient,
    cellsOf: cellIdentity.occurrencesOf,
    getCurrentPageId: editor.getCurrentPageId,
  });

  // Visibility state: per AssetGroup, which assetId is shown in the DFD (null = none)
  const [assetVisibility, setAssetVisibility] = useState<AssetVisibility>({});

  const handleAssetVisibilityChange = useCallback(
    (group: AssetGroup, assetId: string | null) => {
      const next = { ...assetVisibility, [group]: assetId };
      setAssetVisibility(next);

      // Collect ALL active assetIds across all groups — pass them together
      const activeIds = Object.values(next).filter(
        (id): id is string => id !== null,
      );

      if (activeIds.length > 0) {
        overlay.showOverlay(
          activeIds,
          dfd?.assets ?? [],
          dfd?.elements ?? [],
          dfd?.connections ?? [],
        );
      } else {
        overlay.clearOverlay();
      }
    },
    [assetVisibility, overlay, dfd],
  );

  const handleClearAllVisibility = useCallback(() => {
    setAssetVisibility({});
    overlay.clearOverlay();
  }, [overlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAssetChange = useCallback(
    (assetId: string, changes: Partial<DFDAsset>) => {
      // Route through useDFDData.updateAsset (not a plain spread) so an
      // assetGroup change gets the identity handling: the stable UUID id is
      // kept, displayId is regenerated with the new group prefix, relations are
      // preserved, and linkedElements are re-synced. base-threading is
      // preserved by passing scheduleSave's freshest `base` as the third arg.
      scheduleSave((base) => {
        const newDfd = updateAsset(assetId, changes, base);
        return {
          dfd: newDfd,
          phaseStatus: project.phaseStatus,
          lastModified: newDfd.lastModified ?? new Date().toISOString(),
        };
      });
    },
    [scheduleSave, updateAsset, project.phaseStatus],
  );

  // Create asset from the asset tree panel (group known, name defaults to empty)
  const handleCreateAssetForGroup = useCallback(
    (assetGroup: AssetGroup) => {
      // Same base-threading fix as handleCreateAsset — never build the new
      // asset on a stale project.dfd while another save is pending.
      scheduleSave((base) => {
        const { newDfd } = createAsset("", assetGroup, undefined, base);
        return {
          dfd: newDfd,
          phaseStatus: project.phaseStatus,
          lastModified: newDfd.lastModified!,
        };
      });
    },
    [createAsset, scheduleSave, project.phaseStatus],
  );

  // Delete asset and all its relations atomically
  const handleDeleteAsset = useCallback(
    (assetId: string) => {
      // Build on scheduleSave's `base` (a pending edit may be fresher than
      // project.dfd) and report the deletion upward: the app layer removes
      // the asset from every other store (asset store, hazards, risks).
      scheduleSave((base) => {
        const newDfd = deleteAsset(assetId, base);
        return {
          dfd: newDfd,
          phaseStatus: project.phaseStatus,
          lastModified: newDfd.lastModified!,
          deletedAssetIds: [assetId],
        };
      });
    },
    [deleteAsset, scheduleSave, project.phaseStatus],
  );

  // ==================== EXPORT/IMPORT HOOK ====================

  const exportImport = useDFDExportImport(
    project,
    {
      iframeRef: editor.iframeRef,
      isLoading: editor.isLoading,
      iframeKey: editor.iframeKey,
      initialize: editor.initialize,
      toggleTheme: () => {},
      loadXML: editor.loadXML,
      loadXMLTransient: () => {}, // war: async () => {}
      exportXML: () =>
        Promise.resolve({
          xml: "",
          translate: { x: 0, y: 0 },
          scale: 1,
          scrollLeft: 0,
          scrollTop: 0,
        }),
      getCurrentXML: () => null,
      exportImage: async () => null,
      sendAction: () => {},
      onImageReady: () => {},
      selectedCells: editor.selectedCells || [],
      selectCell: async () => {},
      pluginReady: false,
      setPageTabInfo: async () => {},
      syncPages: async () => ({ success: false }),
      setContextCells: async () => {},
      exportPageSvgs: async () => ({ success: false }),
    },
    {
      isDirty: editor.isDirty,
      save: editor.save,
      savePages: editor.savePages,
      scheduleSave: () => {},
      scheduleDrawioSave: () => {},
      queueA2AOps: editor.queueA2AOps,
      commitA2AOps: () => {},
      flush: editor.flushDebouncedSave,
      markDirty: () => {},
      markClean: () => {},
    },
  );

  // ==================== EFFECTS ====================

  // Listen for postMessage from draw.io plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        // Plugin Status (new!)
        if (event.data?.type === "TARAFLOW_PLUGIN_STATUS") {
          console.log("📊 [DFDTab] Plugin status:", event.data.payload);
        }

        // Plugin Loaded
        if (event.data?.type === "TARAFLOW_PLUGIN_LOADED") {
          const { plugin, version } = event.data.payload;
          console.log(`✅ [DFDTab] Plugin loaded: ${plugin} v${version}`);
        }

        // Plugin Error
        if (event.data?.type === "TARAFLOW_PLUGIN_ERROR") {
          const { plugin, error } = event.data.payload;
          console.error(`❌ [DFDTab] Plugin error: ${plugin} - ${error}`);
        }

        // Selection Changed
        if (event.data?.type === "TARAFLOW_SELECTION_CHANGED") {
          const { count, elements } = event.data.payload;
          console.log(`🎯 [DFDTab] Selection: ${count} elements`, elements);
          //setSelectedElements(elements);
        }

        // Asset Dialog (existing)
        if (event.data?.type === "TARAFLOW_OPEN_ASSET_DIALOG") {
          const { elementId, elementLabel } = event.data.payload;
          assetAssignment.openDialog(elementId, elementLabel);
        }
      } catch (error) {
        console.error("[DFDTab] Error handling message:", error);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [assetAssignment]);

  // Auto-save when switching view modes (flush debounced changes immediately)
  useEffect(() => {
    return () => {
      editor.flushDebouncedSave();
    };
  }, [viewMode, editor.flushDebouncedSave]);

  // Reinitialize iframe when switching back to draw mode
  useEffect(() => {
    if (viewMode === "draw" && !editor.isLoading) {
      const timer = setTimeout(() => {
        editor.initialize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewMode, editor.initialize, editor.isLoading]);

  // ==================== HANDLERS (Simple Delegation) ====================

  const handleSave = useCallback(async () => {
    await editor.save();
  }, [editor.save]);

  const handleExportImage = useCallback(() => {
    editor.exportImage();
    setShowPreview(true);
  }, [editor.exportImage]);

  const handleToggleDarkMode = useCallback(() => {
    toggleDarkMode();
    // Force iframe reload by incrementing key (handled in bridge hook)
    // This is safe to do - the hook manages the lifecycle
  }, [toggleDarkMode]);

  const handleViewModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: DFDViewMode | null) => {
      if (newMode !== null) {
        setViewMode(newMode);
      }
    },
    [setViewMode],
  );

  const handleAutoNumber = useCallback(async () => {
    await editor.autoNumberLabels();
  }, [editor]);

  const handleAutoNumberConfigSave = useCallback(
    (config: DFDAutoNumberingConfig) => {
      setAutoNumberingConfig(config);
      // Persist in DFD data via onUpdate
      if (project.dfd) {
        onUpdate({
          dfd: { ...project.dfd, autoNumberingConfig: config },
          phaseStatus: project.phaseStatus,
          lastModified: new Date().toISOString(),
        });
      }
    },
    [project.dfd, project.phaseStatus, onUpdate],
  );

  // Build draw.io URL with dark mode parameter
  const drawioUrl = darkMode
    ? `${DRAWIO_BASE_URL}&ui=dark`
    : `${DRAWIO_BASE_URL}&ui=atlas`;

  /**
   * Handle asset assignment save
   */
  const handleAssetSave = useCallback(
    (relations: AssetRelation[]) => {
      const elementId = assetAssignment.dialogState.elementId;
      if (!elementId) {
        console.error("[DFDTab] No element ID for asset save");
        return;
      }

      console.log("[DFDTab] Saving assets for element:", elementId, relations);

      // Update element with new asset assignments
      editor.updateElementDescription(elementId, {
        assetRelations: relations,
      });
    },
    [assetAssignment.dialogState.elementId, editor],
  );

  /**
   * Applies a single control gap suggestion from the Notifications Panel.
   * Routes to element or connection update based on isConnection flag.
   * Triggers debounced save automatically via editor hooks.
   */
  const handleApplyControlSuggestion = useCallback(
    (
      elementId: string,
      property: string,
      value: unknown,
      isConnection: boolean,
      mitigationId?: string,
      riskId?: string,
    ) => {
      // Build audit record
      const record: import("features/dfd/models/element-shared-types").SecurityControlRecord =
        {
          property,
          value,
          setBy: "apply_suggestion",
          setAt: new Date().toISOString(),
          ...(mitigationId ? { mitigationId } : {}),
          ...(riskId ? { riskId } : {}),
        };

      // Get current ownership records and append (replace existing for same property)
      const target = isConnection
        ? editor.connections.find((c) => c.id === elementId)
        : editor.elements.find((e) => e.id === elementId);

      const existingOwnership: any[] =
        (target?.properties as any)?.securityControlOwnership ?? [];

      const updatedOwnership = [
        ...existingOwnership.filter((r: any) => r.property !== property),
        record,
      ];

      const updates = {
        [property]: value,
        securityControlOwnership: updatedOwnership,
      } as any;

      if (isConnection) {
        editor.updateConnectionDescription(
          elementId,
          updates as Partial<import("../models/dfd-types").DFDConnection>,
        );
      } else {
        editor.updateElementDescription(
          elementId,
          updates as Partial<import("../models/dfd-types").DFDElement>,
        );
      }
    },
    [editor],
  );

  // Get current element's assets for dialog. The dialog target can be an
  // element OR a connection (DataFlow) — both carry assetRelations. Resolving
  // only elements left a DataFlow with an undefined type, which yields the
  // wrong allowed relations in the dialog (e.g. DataFlow→Function offered
  // "is_an" instead of the correct "invokes").
  const currentElement = project.dfd?.elements.find(
    (e) => e.id === assetAssignment.dialogState.elementId,
  );
  const currentConnection = project.dfd?.connections?.find(
    (c) => c.id === assetAssignment.dialogState.elementId,
  );
  const currentRelations =
    currentElement?.assetRelations ??
    currentConnection?.assetRelations ??
    [];
  // Connections are always DataFlows for the purpose of allowed-relation lookup.
  const currentElementType: DFDElementType | undefined =
    currentElement?.type ?? (currentConnection ? "DataFlow" : undefined);

  const selectedConnection = selectedElementId
    ? editor.connections.find((c) => c.id === selectedElementId)
    : undefined;

  // Check if connection crosses trust boundary (use pre-computed analysis!)
  const crossesTrustBoundary = selectedConnection
    ? (project.dfd?.graph?.dataFlowAnalysis.get(selectedConnection.id)
        ?.crossesTrustBoundary ?? false)
    : false;
  const { t } = useTranslation();

  // A finding leads to its place in the CURRENT view: the side panel when
  // drawing, the accordion when describing, the asset's card in the graph.
  // Each view has exactly one place to edit (side panel only in "draw").
  const describeRef = useRef<HTMLDivElement | null>(null);
  const revealInDescription = useCallback(
    (groupKey: string, id: string) => {
      revealElement(groupKey, id);
      requestAnimationFrame(() => {
        const el = Array.from(
          describeRef.current?.querySelectorAll<HTMLElement>("[data-describe-id]") ?? [],
        ).find((x) => x.dataset.describeId === id);
        el?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      });
    },
    [revealElement],
  );
  const [graphFocus, setGraphFocus] = useState<{ assetId: string } | null>(null);

  const handleNotificationNavigation = useCallback(
    (id: string) => {
      const asset = dfd?.assets?.find((a) => a.id === id || a.displayId === id);

      if (viewMode === "describe") {
        if (asset) return revealInDescription("assets", asset.id);
        const element = dfd?.elements?.find((e) => e.id === id);
        if (element) return revealInDescription(element.type, element.id);
        if (dfd?.connections?.some((c) => c.id === id)) {
          return revealInDescription("connections", id);
        }
      }

      if (viewMode === "graph" && asset) {
        setPanelAssetId(asset.id);
        setGraphFocus({ assetId: asset.id });
        return;
      }

      if (asset) {
        setViewMode("draw");
        setFocusAssetRequest({ assetId: asset.id });
        setDetailsPanelOpen(true);
        return;
      }

      // An element or flow from the graph view: show it in the diagram.
      setFocusAssetRequest(null);
      if (viewMode !== "draw") {
        setViewMode("draw");
        setTimeout(() => editor.selectCell(id), 300);
        return;
      }
      editor.selectCell(id);
    },
    [editor, dfd, viewMode, revealInDescription, setViewMode],
  );
  // ── Asset graph view (D2, phase 2) ──────────────────────────────────────
  const assetGraphSource = useMemo(
    () => ({
      ...withRegistryAssets(assetGraphSourceFromDfd(dfd), assetRegistry),
      ...(hazards ? { hazards } : {}),
    }),
    [dfd, hazards, assetRegistry],
  );

  // Asset properties in the graph's card: the same form and the same write
  // path (handleAssetChange) as the side panel (D9).
  const assetEditingForGraph = useMemo(
    () => ({
      assets: dfd?.assets ?? [],
      elements: dfd?.elements ?? [],
      connections: dfd?.connections ?? [],
      onChange: handleAssetChange,
    }),
    [dfd, handleAssetChange],
  );

  // FR-E7 / AR-6: element → asset relations from the graph go through the
  // same element/connection update as the side panel and the description
  // view (scheduleSave on the freshest base, then validation).
  const elementLinkingForGraph = useMemo(
    () => ({
      elements: dfd?.elements ?? [],
      connections: dfd?.connections ?? [],
      onChange: (elementId: string, relations: AssetRelation[]) => {
        if (dfd?.connections?.some((c) => c.id === elementId)) {
          editor.updateConnectionDescription(elementId, { assetRelations: relations });
        } else {
          editor.updateElementDescription(elementId, { assetRelations: relations });
        }
      },
    }),
    [dfd, editor],
  );

  // The graph has its own cards; the selection is only remembered so the
  // side panel shows the same asset when switching to the diagram.
  const handleGraphSelectAsset = useCallback((assetId: string) => {
    setPanelAssetId(assetId);
    setFocusAssetRequest({ assetId });
  }, []);

  // FR-V9: an element anchor leads to the element in the diagram.
  const handleGraphShowElement = useCallback(
    (elementId: string) => {
      setFocusAssetRequest(null);
      setViewMode("draw");
      // The diagram view re-initialises the bridge first (see the effect on
      // viewMode); select once that has happened.
      setTimeout(() => editor.selectCell(elementId), 300);
    },
    [editor, setViewMode],
  );

  useEffect(() => {
    if (!graphFocusRequest) return;
    setViewMode("graph");
    setFocusAssetRequest({ assetId: graphFocusRequest.assetId });
    setGraphFocus({ assetId: graphFocusRequest.assetId });
  }, [graphFocusRequest, setViewMode]);

  // ==================== RENDER ====================

  return (
    <A2AOpsProvider commit={commitA2AOps}>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <DFDToolbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isDirty={editor.isDirty}
        validation={editor.validation}
        stats={editor.stats ?? null}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onExportImage={handleExportImage}
        onRefresh={editor.validate}
        onAutoNumber={handleAutoNumber}
        onAutoNumberConfig={() => setShowAutoNumberConfig(true)}
        onExport={exportImport.downloadExport}
        onImport={exportImport.promptImport}
        onSave={handleSave}
        onInsertContext={leveled.parse && editor.pluginReady ? insertContext.open : undefined}
        onAutoNumberPage={leveled.parse ? leveled.page.autoNumberPage : undefined}
        getCurrentPageName={leveled.page.currentPageName}
        getPageNumberingBlocker={leveled.page.pageNumberingBlocker}
      />

      <IdentityReviewHints
        adoptionPending={identityReview.adoptionPending}
        pageRepair={leveled.pageRepair}
        // Context copies wait for their links (5f): not "pasted" cells.
        pendingCopies={childPages.settling ? 0 : identityReview.pendingCopies}
        onOpenAdoption={identityReview.openAdoption}
        onOpenAssignment={identityReview.openAssignment}
      />

      {/* Main Content Container with Drawer */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left: DFD Canvas (Draw/Describe Views) */}
        <Box
          sx={{
            flexGrow: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Draw Mode */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: darkMode ? "#1a1a1a" : "grey.100",
              visibility: viewMode === "draw" ? "visible" : "hidden",
              pointerEvents: viewMode === "draw" ? "auto" : "none",
            }}
          >
            {editor.isLoading && <LoadingOverlay darkMode={darkMode} />}

            {/* Overlay-Banner — shown while asset inspection is active */}
            <iframe
              key={`${project.id}-${editor.iframeKey}`}
              ref={editor.iframeRef as React.RefObject<HTMLIFrameElement>}
              src={drawioUrl}
              // diagrams.net answers 403 to a localhost Referer (dev build);
              // draw.io needs none — the bridge runs on postMessage.
              referrerPolicy="no-referrer"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: editor.isLoading ? "none" : "auto",
              }}
              title="DFD Editor"
              onLoad={editor.initialize}
            />
          </Box>

          {/* Description View */}
          <Box
            ref={describeRef}
            sx={{
              position: "absolute",
              inset: 0,
              visibility: viewMode === "describe" ? "visible" : "hidden",
              pointerEvents: viewMode === "describe" ? "auto" : "none",
              overflow: "auto",
            }}
          >
            <DFDDescriptionView
              assets={project.dfd?.assets || []}
              elements={project.dfd?.elements || []}
              connections={project.dfd?.connections || []}
              onElementUpdate={editor.updateElementDescription}
              onAssetUpdate={editor.updateAssetDescription}
              onConnectionUpdate={editor.updateConnectionDescription}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              expandedElements={expandedElements}
              onToggleElement={toggleElement}
              onCreateAsset={handleCreateAsset}
              graphContext={graphContext}
              refinementCandidates={leveled.refinementCandidates}
            />
          </Box>

          {/* Asset Graph View (D2) — stays mounted, so view, focus and
              positions survive a switch to the diagram and back (FR-V9). */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              visibility: viewMode === "graph" ? "visible" : "hidden",
              pointerEvents: viewMode === "graph" ? "auto" : "none",
            }}
          >
            <AssetGraphView
              source={assetGraphSource}
              selectedAssetId={panelAssetId}
              onSelectAsset={handleGraphSelectAsset}
              onShowElement={handleGraphShowElement}
              focusRequest={graphFocus}
              onShowInTable={onShowInTable}
              onOpenHazard={onOpenHazard}
              labelVocabulary={labelVocabulary}
              onCreateAsset={handleCreateAssetForGroup}
              assetEditing={assetEditingForGraph}
              elementLinking={elementLinkingForGraph}
              projectId={project.id}
              onDeleteAsset={handleDeleteAsset}
              assetUsage={assetUsage}
              // No side panel in the graph view — it has its own cards.
              rightInset={0}
              darkMode={darkMode}
              pageScope={leveled.pageScope}
            />
          </Box>

          {/* Right: Details Drawer — only when drawing. "Describe" edits in its
              accordions and the asset graph in its cards. */}
          {viewMode === "draw" && (
          <DFDDetailsPanel
            open={detailsPanelOpen}
            onToggle={() => setDetailsPanelOpen((prev) => !prev)}
            onClose={() => setDetailsPanelOpen(false)}
            element={selectedElement}
            connection={selectedConnection}
            onChange={(updates) => {
              if (selectedElement) {
                editor.updateElementDescription(selectedElement.id, updates);
              } else if (selectedConnection) {
                editor.updateConnectionDescription(
                  selectedConnection.id,
                  updates as Partial<
                    import("../models/dfd-types").DFDConnection
                  >,
                );
              }
            }}
            availableAssets={availableAssets}
            crossesTrustBoundary={crossesTrustBoundary}
            onCreateAsset={handleCreateAsset}
            onCreateAssetForGroup={handleCreateAssetForGroup}
            onDeleteAsset={handleDeleteAsset}
            assets={dfd?.assets ?? []}
            elements={dfd?.elements ?? []}
            connections={dfd?.connections ?? []}
            assetVisibility={assetVisibility}
            onAssetVisibilityChange={handleAssetVisibilityChange}
            onClearAllVisibility={handleClearAllVisibility}
            onAssetChange={handleAssetChange}
            graphContext={graphContext}
            refinementCandidates={leveled.refinementCandidates}
            childPage={leveled.selection.childPage}
            assetRollup={leveled.selection.assetRollup}
            identity={leveled.selection.identity}
            focusAssetRequest={focusAssetRequest}
            assetUsage={assetUsage}
            onSelectedAssetChange={setPanelAssetId}
          />
          )}
        </Box>
      </Box>

      {/* Notifications Panel — validation errors/warnings + security gaps */}
      <DFDNotificationsPanel
        validation={editor.validation}
        controlInstances={controlInstances}
        securityDrifts={securityDrifts}
        elements={project.dfd?.elements ?? []}
        connections={project.dfd?.connections ?? []}
        onApply={handleApplyControlSuggestion}
        onSelectCell={handleNotificationNavigation}
      />

      {/* Preview Dialog */}
      <DFDPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        previewImage={editor.previewImage}
        projectName={project.name}
      />

      {/* Leveled DFD: a linked definition was lost (5k) */}
      <LostDefinitionDialog
        lost={lostDefinitions.lost}
        threatCountOf={threatCountOf}
        onReattach={lostDefinitions.reattach}
        onAccept={lostDefinitions.acceptDeletion}
        onLater={lostDefinitions.postpone}
      />

      {/* Leveled DFD: insert a context copy on the current page (5h) */}
      <InsertContextDialog
        open={!!insertContext.data}
        pageName={
          insertContext.data
            ? insertContext.data.pageNames[insertContext.data.targetPage] || insertContext.data.targetPage
            : ""
        }
        candidates={insertContext.data?.candidates ?? []}
        pageNames={insertContext.data?.pageNames ?? {}}
        onInsert={(c: InsertCandidate) =>
          childPages.insertAsContext(c.kind, c.tfId, insertContext.data!.targetPage)
        }
        onClose={insertContext.close}
      />

      {/* Leveled DFD: delete the child page of a deleted multiprocess? (5e) */}
      <OrphanPageDialog
        orphans={childPages.orphanPages}
        onResolve={childPages.resolveOrphan}
      />

      {/* Leveled DFD: adoption / pasted-copy assignment (5b) */}
      <IdentityReviewDialog
        review={identityReview.review}
        onClose={identityReview.close}
        onApplyAdoption={identityReview.applyAdoption}
        onApplyAssignment={identityReview.applyAssignment}
        onDismissAssignment={identityReview.dismissAssignment}
      />

      {/* DFD Config Dialog */}
      <DFDConfigDialog
        open={showAutoNumberConfig}
        config={autoNumberingConfig}
        onSave={handleAutoNumberConfigSave}
        onClose={() => setShowAutoNumberConfig(false)}
      />

      {/* Asset Assignment Dialog */}
      <AssetAssignmentDialog
        open={assetAssignment.dialogState.open}
        onClose={assetAssignment.closeDialog}
        elementId={assetAssignment.dialogState.elementId}
        elementLabel={assetAssignment.dialogState.elementLabel}
        elementType={currentElementType}
        availableAssets={dfd?.assets ?? []}
        currentAssignments={currentRelations}
        onSave={handleAssetSave}
      />
    </Box>
    </A2AOpsProvider>
  );
}

// ==================== SUB-COMPONENTS ====================

interface LoadingOverlayProps {
  darkMode?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ darkMode }) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: darkMode ? "#1a1a1a" : "background.default",
        zIndex: 10,
      }}
    >
      <CircularProgress
        size={40}
        sx={{ color: darkMode ? "#fff" : undefined }}
      />
      <Typography sx={{ mt: 2, color: darkMode ? "#fff" : "text.secondary" }}>
        {t("tabs.dfd.loading", { defaultValue: "Loading DFD Editor..." })}
      </Typography>
    </Box>
  );
};

export default DFDTab;