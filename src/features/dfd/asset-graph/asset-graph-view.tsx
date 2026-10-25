// features/dfd/asset-graph/asset-graph-view.tsx
//
// Asset graph view — third view of the DFD tab (D2), view mode (phase 2).
//
//   Context bar (FR-V14): view, preset/layers, focus + depth, anchors,
//     counters, reset, rearrange, fit, legend.
//   Canvas: lanes per layer (FR-V3), A2A edges solid with arrow + type label
//     and stepOrder badge, element anchors dashed (UX-3, FR-V7), stubs as
//     counters (FR-V4). Zoom/pan (FR-V12).
//   Selection is shared with the asset panel (FR-V8): clicking a node selects
//     the asset there; selecting in the tree highlights the node here.
//   Hazard Items (FR-V11): a lane in the side column, read-only — a click
//     opens their card, they are edited in the Hazard tab (G2).
//
// Edit mode (phase 3): asset links through the single A2A write path
// (A2AOpsContext); assets, their properties and DFD element relations
// through the DFD tab's callbacks — the graph has no write logic of its own.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Checkbox,
  Alert,
  Badge,
  Chip,
  Divider,
  InputAdornment,
  TextField,
  FormControlLabel,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CenterFocusStrong as FitIcon,
  Refresh as RearrangeIcon,
  RestartAlt as ResetIcon,
  HelpOutline as LegendIcon,
  Layers as LayersIcon,
  FilterAlt as FilterIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from "@mui/icons-material";
import { select, zoom, zoomIdentity, type ZoomBehavior } from "d3";
import { HAZARD_SEVERITY_RANK_COLOR, isContributesTo, normalizeLegacySafetyImpact, type AssetGroup } from "shared";
import type { AssetRelation } from "../models/asset-relation-types";
import { getAssetGroupColor } from "../models/dfd-formatters";
import {
  ALL_LAYERS,
  ASSET_GRAPH_PRESETS,
  ASSET_GRAPH_PRESET_ORDER,
  ORTHOGONAL_LAYERS,
  presetOfLayers,
  type AssetGraphPresetId,
} from "./asset-graph-layers";
import { ANCHOR_PREFIX, buildAssetGraph, DEFAULT_FOCUS_DEPTH, HAZARD_PREFIX } from "./build-asset-graph";
import {
  ANCHOR_LANE,
  HAZARD_LANE,
  LANE_HEIGHT,
  NODE_SPACING,
  NODE_RADIUS,
  layoutAssetGraph,
  moveNode,
  type Point,
} from "./layout-asset-graph";
import type { AssetGraphSource, AssetGraphViewKind } from "./asset-graph-types";
import { AssetGraphInspector, CARD_WIDTH } from "./asset-graph-inspector";
import { ConnectChooser, type ConnectChoice, type ConnectRequest } from "./asset-graph-connect";
import { arrowDirection, isTypingTarget, nearestInDirection } from "./asset-graph-keyboard";
import { loadPositions, savePositions } from "./asset-graph-positions-store";
import {
  EMPTY_HISTORY,
  entryForAdd,
  entryForRemove,
  entryForUpdate,
  popRedo,
  popUndo,
  pushEntry,
  resolveSteps,
  type HistoryEntry,
  type HistoryState,
} from "./asset-graph-history";
import { useA2AOps } from "../contexts/a2a-ops-context";
import {
  elementCandidates,
  elementTargetClasses,
  ElementPicker,
  linkableElements,
  withoutElementRelation,
  type ElementLinking,
} from "./asset-graph-element-link";
import { ElementAssetRelationDialog } from "../components/forms/asset-relation-selector";
import {
  classifyA2ATargets,
  ConfirmAssetDeleteDialog,
  DfdScopeFilterControls,
  NO_DFD_SCOPE_FILTER,
  pageWithSubPages,
  type A2ATargetClass,
  type AssetUsageLookup,
  type DfdScopeFilter,
  type DfdScopeIndex,
} from "shared";
import {
  assetVisibility,
  invalidLinks,
  relationTypesIn,
  searchAssets,
  sourceOnPages,
  type AssetVisibility,
} from "./asset-graph-query";

const MAX_DEPTH = 3;

export interface AssetGraphViewProps {
  readonly source: AssetGraphSource;
  /** The asset selected in the asset panel (shared selection). */
  readonly selectedAssetId: string | null;
  readonly onSelectAsset: (assetId: string) => void;
  /** Element anchor clicked: show the element in the diagram (FR-V9). */
  readonly onShowElement?: (elementId: string) => void;
  /** Request from outside to focus an asset (FR-V13). */
  readonly focusRequest?: { readonly assetId: string } | null;
  /** "Show in table" from the detail card (FR-V13, way back). */
  readonly onShowInTable?: (assetId: string) => void;
  /** "Open in Hazard tab" from a hazard's card (FR-V11d, G9). */
  readonly onOpenHazard?: (hazardId: string) => void;
  /**
   * Pixels on the right covered by the DFD tab's side panel (it overlays the
   * canvas). Detail card, legend and centring keep clear of it.
   */
  readonly rightInset?: number;
  /** Edit mode: create an asset of a group (same path as the asset panel). */
  readonly onCreateAsset?: (group: AssetGroup) => void;
  /** Edit mode: delete an asset (same path as the asset panel). */
  readonly onDeleteAsset?: (assetId: string) => void;
  /** Usage counts for the delete confirmation (FR-E8). */
  readonly assetUsage?: AssetUsageLookup;
  /** Edit mode: asset properties in the card (D9), see the inspector. */
  readonly assetEditing?: React.ComponentProps<typeof AssetGraphInspector>["assetEditing"];
  /** Edit mode: DFD element → asset relations (FR-E7), see asset-graph-element-link. */
  readonly elementLinking?: ElementLinking;
  /**
   * FR-V15: positions are remembered locally under this project id (browser
   * storage, never the project file). Without it: this session only.
   */
  readonly projectId?: string | null;
  readonly darkMode?: boolean;
  /**
   * Leveled DFD (§9, 6f): pages of the DFD for the page filter — the assets
   * of the elements on a page (with or without its sub-pages). Absent for a
   * classic DFD.
   */
  readonly pageScope?: DfdScopeIndex;
}

interface ViewState {
  view: AssetGraphViewKind;
  layers: AssetGroup[];
  focusAssetId: string | null;
  depth: number;
  /** DFD element anchors in the layer view (off by default)… */
  showAnchors: boolean;
  /** …and in the focus view (on by default, FR-V6). */
  anchorsInFocus: boolean;
  /** Hazard Items (FR-V11c); on with the protection and all presets (G3). */
  showHazards: boolean;
  /** Shown relation types; null = all (FR-V10). */
  relationTypes: string[] | null;
}

const DEFAULT_STATE: ViewState = {
  view: "layers",
  layers: [...ASSET_GRAPH_PRESETS.architecture],
  focusAssetId: null,
  depth: DEFAULT_FOCUS_DEPTH,
  showAnchors: false,
  anchorsInFocus: true,
  showHazards: false,
  relationTypes: null,
};

/** Presets that show the Hazard Items (G3). */
const HAZARD_PRESETS: readonly AssetGraphPresetId[] = ["protection", "all"];

function groupColor(group: string): { color: string; colorLight: string } {
  try {
    return getAssetGroupColor(group as AssetGroup);
  } catch {
    return { color: "#757575", colorLight: "#EEEEEE" };
  }
}

export const AssetGraphView: React.FC<AssetGraphViewProps> = ({
  source,
  selectedAssetId,
  onSelectAsset,
  onShowElement,
  focusRequest,
  onShowInTable,
  onOpenHazard,
  onCreateAsset,
  onDeleteAsset,
  assetUsage,
  assetEditing,
  elementLinking,
  projectId,
  rightInset = 0,
  darkMode = false,
  pageScope,
}) => {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<ViewState>(DEFAULT_STATE);
  const [showLegend, setShowLegend] = useState(false);
  const [layerMenu, setLayerMenu] = useState<HTMLElement | null>(null);
  const [typeMenu, setTypeMenu] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [searchMiss, setSearchMiss] = useState(false);
  // Detail card (FR-V8): the selected link, or else the selected asset.
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // The card's asset: set by a click here, and follows the asset panel's
  // selection. Kept locally so the card works even while the panel is closed.
  const [inspectedAssetId, setInspectedAssetId] = useState<string | null>(null);
  // A Hazard Item's card (FR-V11d) — the hazard item id; wins over the asset.
  const [inspectedHazardId, setInspectedHazardId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedAssetId) return;
    setInspectedAssetId(selectedAssetId);
    setInspectedHazardId(null);
  }, [selectedAssetId]);

  // ── Edit mode (phase 3, FR-E1) ──────────────────────────────────────────
  // Writes go through the DFD tab's single write path (A2AOpsContext →
  // commitA2AOps → relations service). Without a provider: view only.
  const commitA2AOps = useA2AOps();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const editing = mode === "edit" && commitA2AOps !== null;
  // Connection being dragged from a node's handle (FR-E4).
  const [drag, setDrag] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const [connectRequest, setConnectRequest] = useState<ConnectRequest | null>(null);
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [searchHit, setSearchHit] = useState<{
    assetId: string;
    index: number;
    total: number;
    visibility: AssetVisibility;
  } | null>(null);

  /** A hazard ("hz:" id), or an asset with hazard edges (G3). */
  const hasHazardEdges = (id: string) =>
    id.startsWith(HAZARD_PREFIX)
      ? (source.hazards?.items ?? []).some((h) => HAZARD_PREFIX + h.id === id)
      : (source.hazards?.relations ?? []).some((r) => (isContributesTo(r) ? r.from : r.to) === id);

  // Focus request from outside (asset table "show in graph").
  useEffect(() => {
    if (!focusRequest) return;
    // "What hangs on this asset?" — all layers, the user narrows afterwards.
    setState((s) => ({
      ...s,
      view: "focus",
      focusAssetId: focusRequest.assetId,
      layers: [...ALL_LAYERS],
      showHazards: s.showHazards || hasHazardEdges(focusRequest.assetId),
    }));
    // …and its card is open: in the graph, the card is where it is edited.
    setSelectedEdgeId(null);
    setInspectedHazardId(null);
    setInspectedAssetId(focusRequest.assetId);
    setInspectorOpen(true);
  }, [focusRequest]);

  // ── Page filter (leveled DFD, 6f) ───────────────────────────────────────
  // Only the graph is filtered; search, cards and edits see every asset. A
  // page that is gone ends the filter.
  const [pageFilterChoice, setPageFilter] = useState<DfdScopeFilter>(NO_DFD_SCOPE_FILTER);
  const pageFilter =
    pageScope?.pages.some((p) => p.pageId === pageFilterChoice.pageId) ? pageFilterChoice : NO_DFD_SCOPE_FILTER;
  const shownSource = useMemo(() => {
    if (!pageScope || !pageFilter.pageId) return source;
    const pages = pageFilter.withSubPages ? pageWithSubPages(pageScope, pageFilter.pageId) : [pageFilter.pageId];
    return sourceOnPages(source, new Set(pages.flatMap((p) => pageScope.itemsOnPage[p] ?? [])));
  }, [source, pageScope, pageFilter.pageId, pageFilter.withSubPages]);
  const assetsOnPages = useMemo(
    () => (shownSource === source ? undefined : new Set(shownSource.assets.map((a) => a.id))),
    [shownSource, source],
  );

  const graph = useMemo(
    () =>
      buildAssetGraph(shownSource, {
        view: state.view,
        layers: state.layers,
        focusAssetId: state.focusAssetId,
        depth: state.depth,
        showAnchors: state.view === "focus" ? state.anchorsInFocus : state.showAnchors,
        showHazards: state.showHazards,
        relationTypes: state.relationTypes,
      }),
    [shownSource, state],
  );
  const availableTypes = useMemo(() => relationTypesIn(source), [source]);
  // UX-4 stage 4: invalid links get a small symbol (link and source node).
  const findings = useMemo(() => invalidLinks(source), [source]);
  const nodesWithFindings = useMemo(() => {
    const ids = new Set<string>();
    for (const r of source.relations) if (findings.has(r.id)) ids.add(r.sourceAssetId);
    return ids;
  }, [source, findings]);

  // UX-4 stage 2: assets that appear while the view is open pulse briefly.
  const knownAssetIdsRef = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const ids = new Set(source.assets.map((a) => a.id));
    const known = knownAssetIdsRef.current;
    knownAssetIdsRef.current = ids;
    if (!known) return; // first render: nothing is "new"
    const fresh = [...ids].filter((id) => !known.has(id));
    if (fresh.length === 0) return;
    setFreshIds(new Set(fresh));
    const timer = setTimeout(() => setFreshIds(new Set()), 2400);
    return () => clearTimeout(timer);
  }, [source]);

  // ── Layout: stable within the session (AR-12), remembered locally (FR-V15)
  const positionsRef = useRef<Map<string, Point>>(new Map());
  // Positions of this project from an earlier session; another project
  // starts from its own (or from the layout).
  const loadedProjectRef = useRef<string | null | undefined>(undefined);
  if (loadedProjectRef.current !== (projectId ?? null)) {
    loadedProjectRef.current = projectId ?? null;
    positionsRef.current = loadPositions(projectId);
  }
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  // FR-E2: an asset created from a lane's "+" appears where it was asked for.
  const pendingCreateRef = useRef<{ group: string; x: number; y: number } | null>(null);
  const createdIdRef = useRef<string | null>(null);
  const canCreate = editing && state.view === "layers" && !!onCreateAsset;
  const layout = useMemo(() => {
    const pending = pendingCreateRef.current;
    if (pending) {
      const fresh = graph.nodes.find(
        (n) => n.kind === "asset" && String(n.group) === pending.group && !positionsRef.current.has(n.id),
      );
      if (fresh) {
        positionsRef.current.set(fresh.id, { x: pending.x, y: pending.y });
        pendingCreateRef.current = null;
        createdIdRef.current = fresh.id;
      }
    }
    const result = layoutAssetGraph(graph, positionsRef.current, {
      extraLanes: canCreate ? state.layers : [],
    });
    for (const [id, p] of result.positions) positionsRef.current.set(id, p);
    return result;
    // layoutEpoch forces a fresh layout after "rearrange"; projectId one for
    // another project's positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layoutEpoch, canCreate, projectId]);

  // Remember positions (debounced, and once more when the view goes away) —
  // only for nodes that still exist.
  const savePositionsRef = useRef<() => void>(() => {});
  savePositionsRef.current = () => {
    const assets = new Set(source.assets.map((a) => a.id));
    const elements = new Set(source.elements.map((e) => `${ANCHOR_PREFIX}${e.id}`));
    const hazards = new Set((source.hazards?.items ?? []).map((h) => `${HAZARD_PREFIX}${h.id}`));
    savePositions(
      projectId,
      positionsRef.current,
      (id) => assets.has(id) || elements.has(id) || hazards.has(id),
    );
  };
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => savePositionsRef.current(), 500);
    return () => clearTimeout(timer);
  }, [layout, projectId, source]);
  useEffect(() => () => savePositionsRef.current(), []);

  const rearrange = useCallback(() => {
    positionsRef.current = new Map();
    setLayoutEpoch((e) => e + 1);
  }, []);

  // ── Moving a node (FR-V17): Ctrl / ⌘ + drag, horizontally only ───────────
  // While dragging, the moved x overlays the layout; on release it becomes a
  // known position (AR-12), is remembered locally (FR-V15) and the layout is
  // recomputed — every position is then known, so nothing else moves.
  const [moving, setMoving] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    x: number;
    y: number;
  } | null>(null);
  const movingRef = useRef(moving);
  movingRef.current = moving;
  // A click follows the pointer-up of a move — it must not select the node.
  const suppressClickRef = useRef(false);
  const positions = useMemo(() => {
    if (!moving) return layout.positions;
    return layout.positions.has(moving.id)
      ? new Map(layout.positions).set(moving.id, { x: moving.x, y: moving.y })
      : layout.positions;
  }, [layout, moving]);
  const sideColumnNode = (id: string) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (node?.kind === "hazard") return true;
    return node?.kind === "asset" && (ORTHOGONAL_LAYERS as readonly string[]).includes(String(node.group));
  };
  // Vertical lanes: along the lane; side column: free in x, y onto a row.
  const movedTo = (id: string, dx: number, dy: number) =>
    moveNode(layout.positions, id, dx, dy, { sideColumn: sideColumnNode(id), lanes: layout.lanes }).get(id);
  const commitMove = (id: string, to: Point) => {
    const p = layout.positions.get(id);
    if (!p || (p.x === to.x && p.y === to.y)) return;
    positionsRef.current.set(id, to);
    savePositionsRef.current();
    setLayoutEpoch((e) => e + 1);
  };
  const startMove = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    e.stopPropagation();
    e.preventDefault();
    const p = layout.positions.get(id);
    if (p) setMoving({ id, startClientX: e.clientX, startClientY: e.clientY, x: p.x, y: p.y });
  };
  useEffect(() => {
    if (!moving) return;
    const k = transform.k || 1;
    const { startClientX, startClientY, id } = moving;
    const move = (e: PointerEvent) => {
      const to = movedTo(id, (e.clientX - startClientX) / k, (e.clientY - startClientY) / k);
      if (to) setMoving((m) => (m ? { ...m, x: to.x, y: to.y } : m));
    };
    const up = () => {
      const m = movingRef.current;
      setMoving(null);
      if (m) {
        const before = layout.positions.get(m.id);
        suppressClickRef.current = m.x !== before?.x || m.y !== before?.y;
        commitMove(m.id, { x: m.x, y: m.y });
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoving(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", esc);
    };
  }, [moving !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  // FR-V17b: Ctrl / ⌘ held → the move cursor over nodes.
  const [moveKeyHeld, setMoveKeyHeld] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setMoveKeyHeld(e.ctrlKey || e.metaKey);
    const onBlur = () => setMoveKeyHeld(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
  /** Click handler guard: the click that ends a move does nothing. */
  const unlessMoved = (fn: () => void) => () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    fn();
  };

  // ── Zoom / pan (FR-V12) ─────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState({ x: 40, y: 40, k: 1 });
  useEffect(() => {
    if (!svgRef.current) return;
    const el = svgRef.current;
    const behaviour = zoom<SVGSVGElement, unknown>()
      // Explicit extent: d3's default reads svg.width.baseVal, which is not
      // available for percentage sizes in every environment.
      .extent((): [[number, number], [number, number]] => {
        const r = el.getBoundingClientRect();
        return [
          [0, 0],
          [r.width || 1, r.height || 1],
        ];
      })
      .scaleExtent([0.2, 3])
      // A drag from a connection handle is not a pan.
      .filter((e: Event & { button?: number; ctrlKey?: boolean; metaKey?: boolean; type: string }) => {
        if (dragRef.current || movingRef.current) return false;
        const target = e.target as Element | null;
        if (target?.closest?.("[data-graph-handle]")) return false;
        // Ctrl / ⌘ + drag moves a node (FR-V17), not the view (FR-V17a).
        return (!(e.ctrlKey || e.metaKey) || e.type === "wheel") && !e.button;
      })
      .on("zoom", (e) => setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k }));
    zoomRef.current = behaviour;
    const svg = select(svgRef.current);
    svg.call(behaviour).on("dblclick.zoom", null);
    svg.call(behaviour.transform, zoomIdentity.translate(40, 40));
    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  const fit = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomRef.current || positions.size === 0) return;
    const xs = [...positions.values()].map((p) => p.x);
    const ys = [...positions.values()].map((p) => p.y);
    const pad = NODE_RADIUS * 3;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const rect = svgEl.getBoundingClientRect();
    const width = Math.max(0, rect.width - rightInset);
    const height = rect.height;
    if (!width || !height) return;
    const k = Math.min(1.2, width / (maxX - minX), height / (maxY - minY));
    select(svgEl).call(
      zoomRef.current.transform,
      zoomIdentity.translate(-minX * k + (width - (maxX - minX) * k) / 2, -minY * k + (height - (maxY - minY) * k) / 2).scale(k),
    );
  }, [layout, rightInset]);

  // Centre a node, keeping the zoom level. A request for a node that is not
  // laid out yet (e.g. right after showing its layer) waits for the layout.
  const pendingCenterRef = useRef<string | null>(null);
  const centerOn = useCallback(
    (nodeId: string) => {
      const svgEl = svgRef.current;
      const p = positions.get(nodeId);
      if (!svgEl || !zoomRef.current || !p) {
        pendingCenterRef.current = nodeId;
        return;
      }
      pendingCenterRef.current = null;
      const rect = svgEl.getBoundingClientRect();
      const width = Math.max(0, rect.width - rightInset);
      const height = rect.height;
      const k = transform.k;
      select(svgEl).call(
        zoomRef.current.transform,
        zoomIdentity.translate((width || 0) / 2 - p.x * k, (height || 0) / 2 - p.y * k).scale(k),
      );
    },
    [layout, transform.k, rightInset],
  );
  useEffect(() => {
    const id = pendingCenterRef.current;
    if (id && positions.has(id)) centerOn(id);
  }, [layout, centerOn]);

  // ── Search (FR-V10, UX-6) ───────────────────────────────────────────────
  const runSearch = (direction: 1 | -1 = 1) => {
    const matches = searchAssets(source, query);
    if (matches.length === 0) {
      setSearchHit(null);
      setSearchMiss(true);
      return;
    }
    setSearchMiss(false);
    const index =
      searchHit && searchHit.total === matches.length
        ? (searchHit.index + direction + matches.length) % matches.length
        : 0;
    const hit = matches[index];
    const visibility = assetVisibility(graph, source, state, hit.id, assetsOnPages);
    setSearchHit({ assetId: hit.id, index, total: matches.length, visibility });
    if (visibility.state === "visible") {
      onSelectAsset(hit.id);
      centerOn(hit.id);
    }
  };
  // Re-evaluate the hit when the graph changes (e.g. its layer was shown).
  const hitVisibility = searchHit
    ? assetVisibility(graph, source, state, searchHit.assetId, assetsOnPages)
    : null;
  const hitAsset = searchHit ? source.assets.find((a) => a.id === searchHit.assetId) : undefined;

  const toggleType = (type: string) =>
    setState((s) => {
      const all = availableTypes.map((x) => x.type);
      const current = s.relationTypes ?? all;
      const next = current.includes(type)
        ? current.filter((x) => x !== type)
        : [...current, type];
      return { ...s, relationTypes: next.length === all.length ? null : next };
    });

  // Navigate from the detail card: select, and make the asset visible first
  // if it is not (its layer, or the focus moves to it).
  const goToAsset = (assetId: string) => {
    setSelectedEdgeId(null);
    setInspectedHazardId(null);
    setInspectedAssetId(assetId);
    onSelectAsset(assetId);
    const v = assetVisibility(graph, source, state, assetId, assetsOnPages);
    if (v.state === "outsidePage") {
      setPageFilter(NO_DFD_SCOPE_FILTER);
      pendingCenterRef.current = assetId;
    } else if (v.state === "hiddenLayer") {
      showLayer(v.layer);
      pendingCenterRef.current = assetId;
    } else if (v.state === "outsideFocus") {
      focusOn(assetId);
      pendingCenterRef.current = assetId;
    } else {
      centerOn(assetId);
    }
  };
  const selectedEdge = selectedEdgeId
    ? graph.edges.find((e) => e.id === selectedEdgeId) ?? null
    : null;

  // ── Connect by dragging (FR-E4, FR-E5) ──────────────────────────────────
  const toGraph = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      return {
        x: (clientX - (rect?.left ?? 0) - transform.x) / transform.k,
        y: (clientY - (rect?.top ?? 0) - transform.y) / transform.k,
      };
    },
    [transform],
  );
  // While dragging: every shown asset classified against the source.
  const linkable = useMemo(
    () => (elementLinking ? linkableElements(elementLinking) : []),
    [elementLinking],
  );
  const elementOfAnchor = (nodeId: string) =>
    nodeId.startsWith(ANCHOR_PREFIX)
      ? linkable.find((x) => x.id === nodeId.slice(ANCHOR_PREFIX.length))
      : undefined;
  const targetClasses = useMemo(() => {
    if (!drag) return null;
    const shownAssets = graph.nodes
      .filter((n) => n.kind === "asset")
      .map((n) => ({ id: n.id, assetGroup: String((n as { group: string }).group) }));
    // From a DFD element anchor (FR-E7): the element rules decide.
    const element = elementOfAnchor(drag.sourceId);
    if (element) {
      const cls = elementTargetClasses(element.type, shownAssets);
      return new Map([...cls].map(([id, c]) => [id, { targetClass: c as A2ATargetClass }]));
    }
    const src = source.assets.find((a) => a.id === drag.sourceId);
    if (!src) return null;
    const shown = graph.nodes.filter((n) => n.kind === "asset").map((n) => ({
      id: n.id,
      assetGroup: (n as { group: string }).group as AssetGroup,
    }));
    return classifyA2ATargets({ id: src.id, assetGroup: src.assetGroup as AssetGroup }, shown);
  }, [drag?.sourceId, graph, source, linkable]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = toGraph(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d));
    };
    // Released anywhere but on a node: nothing happens.
    const up = () => setDrag(null);
    // NFR-4: Esc cancels a running drag.
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", esc);
    };
  }, [drag !== null, toGraph]); // eslint-disable-line react-hooks/exhaustive-deps

  const startConnect = (assetId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectNotice(null);
    const p = positions.get(assetId);
    setDrag({ sourceId: assetId, x: p?.x ?? 0, y: p?.y ?? 0 });
  };
  const dropOn = (assetId: string, e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    setDrag(null);
    if (assetId === d.sourceId) return;
    const cls = targetClasses?.get(assetId)?.targetClass ?? "invalid";
    const element = elementOfAnchor(d.sourceId);
    if (element) {
      const target = source.assets.find((x) => x.id === assetId);
      if (cls === "invalid") {
        setConnectNotice(
          t("tabs.dfd.assetGraph.elementLink.none", {
            defaultValue: "A {{type}} cannot relate to a {{group}} asset ({{element}} – {{asset}}).",
            type: elementTypeName(element.type),
            group: groupLabel(String(target?.assetGroup)),
            element: element.displayId,
            asset: target?.displayId ?? "",
          }),
        );
        return;
      }
      setElementDialog({ elementId: element.id, assetId });
      return;
    }
    if (cls === "invalid") {
      const a = source.assets.find((x) => x.id === d.sourceId);
      const b = source.assets.find((x) => x.id === assetId);
      setConnectNotice(
        t("tabs.dfd.assetGraph.connect.none", {
          defaultValue: "No relation is allowed between {{a}} and {{b}} ({{ga}} – {{gb}}).",
          a: a?.displayId ?? "",
          b: b?.displayId ?? "",
          ga: groupLabel(String(a?.assetGroup)),
          gb: groupLabel(String(b?.assetGroup)),
        }),
      );
      return;
    }
    setConnectRequest({
      sourceId: d.sourceId,
      targetId: assetId,
      anchor: { left: e.clientX, top: e.clientY },
    });
  };
  // ── Undo / redo of link changes (FR-E9) ───────────────────────────────
  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const run = (entry: HistoryEntry) => {
    const { ops } = resolveSteps(entry.redo, source.relations);
    if (ops.length === 0) return;
    commitA2AOps?.(ops);
    setHistory((h) => pushEntry(h, entry));
  };
  const replay = (direction: "undo" | "redo") => {
    const { entry, next } = direction === "undo" ? popUndo(history) : popRedo(history);
    if (!entry) return;
    const { ops, complete } = resolveSteps(direction === "undo" ? entry.undo : entry.redo, source.relations);
    if (ops.length > 0) commitA2AOps?.(ops);
    setHistory(next);
    setHistoryNotice(
      complete
        ? null
        : t("tabs.dfd.assetGraph.history.partial", {
            defaultValue: "Only partly possible — a link was changed elsewhere in the meantime.",
          }),
    );
  };
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        replay("undo");
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        replay("redo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // re-bound each render: replay reads the current links and history

  // ── Keyboard (NFR-4) ────────────────────────────────────────────────────
  // Nodes are in the tab order; arrows move to the nearest node in that
  // direction; a focused asset is selected like a click. Enter focuses the
  // asset (an element anchor: shows the element), Delete removes the focused
  // link or asset in edit mode (an asset with confirmation), Esc closes the
  // card and the chooser. Links take focus on click (tabIndex -1).
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const focusNodeElement = (id: string) => {
    const nodes = svgRef.current?.querySelectorAll<SVGGElement>("[data-node-id]") ?? [];
    for (const el of nodes) {
      if (el.dataset.nodeId === id) {
        el.focus();
        return;
      }
    }
  };
  const ensureVisible = (id: string) => {
    const p = positions.get(id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!p || !rect || !rect.width) return;
    const x = p.x * transform.k + transform.x;
    const y = p.y * transform.k + transform.y;
    const margin = NODE_RADIUS * 2;
    if (x < margin || y < margin || x > rect.width - rightInset - margin || y > rect.height - margin) centerOn(id);
  };
  const selectAssetNode = (id: string) => {
    setSelectedEdgeId(null);
    setInspectedHazardId(null);
    setInspectedAssetId(id);
    setInspectorOpen(true);
    onSelectAsset(id);
  };
  /** A hazard node: its read-only card (FR-V11d); the asset panel is not touched. */
  const selectHazardNode = (hazardId: string) => {
    setSelectedEdgeId(null);
    setInspectedHazardId(hazardId);
    setInspectorOpen(true);
  };
  const onCanvasKeyDown = (e: React.KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;
    const target = e.target as Element;
    const nodeId = target.closest?.("[data-node-id]")?.getAttribute("data-node-id") ?? null;
    const edgeId = target.closest?.("[data-edge-id]")?.getAttribute("data-edge-id") ?? null;
    const node = nodeId ? graph.nodes.find((n) => n.id === nodeId) : undefined;

    // FR-V17e: Ctrl / ⌘ + Shift + arrows move the focused node — ←/→ by a
    // third of the spacing, ↑/↓ a row (side column only).
    const moveStep: Record<string, [number, number]> = {
      ArrowLeft: [-NODE_SPACING / 3, 0],
      ArrowRight: [NODE_SPACING / 3, 0],
      ArrowUp: [0, -LANE_HEIGHT],
      ArrowDown: [0, LANE_HEIGHT],
    };
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && moveStep[e.key]) {
      const id = nodeId ?? focusedNodeId;
      if (!id) return;
      e.preventDefault();
      const to = movedTo(id, ...moveStep[e.key]);
      if (to) commitMove(id, to);
      return;
    }

    const direction = arrowDirection(e.key);
    if (direction) {
      const ids = graph.nodes.map((n) => n.id);
      if (ids.length === 0) return;
      const from = nodeId ?? focusedNodeId;
      const next = from ? nearestInDirection(positions, from, direction, ids) : ids[0];
      e.preventDefault();
      if (next) {
        focusNodeElement(next);
        ensureVisible(next);
      }
      return;
    }
    if (e.key === "Enter" && node) {
      e.preventDefault();
      if (node.kind === "anchor") onShowElement?.(node.elementId);
      else {
        focusOn(node.id);
        pendingCenterRef.current = node.id;
      }
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && editing) {
      const edge = graph.edges.find((x) => x.id === (edgeId ?? (inspectorOpen ? selectedEdgeId : null)));
      if (edge) {
        e.preventDefault();
        removeEdge(edge);
      } else if (node?.kind === "asset" && onDeleteAsset) {
        e.preventDefault();
        setConfirmDeleteId(node.id);
      }
      return;
    }
    if (e.key === "Escape") {
      setConnectRequest(null);
      setConnectNotice(null);
      setElementPicker(null);
      setSelectedEdgeId(null);
      setInspectorOpen(false);
    }
  };

  const choose = (choice: ConnectChoice) => {
    setConnectRequest(null);
    run(entryForAdd(choice));
    // FR-E11: the focus stays on the source.
    onSelectAsset(choice.sourceAssetId);
  };
  const updateLink = (relationId: string, attributes: Record<string, unknown>) => {
    const rel = source.relations.find((r) => r.id === relationId);
    if (rel) run(entryForUpdate(rel, attributes));
  };
  const deleteLink = (relationId: string) => {
    const rel = source.relations.find((r) => r.id === relationId);
    if (rel) run(entryForRemove(rel));
    setSelectedEdgeId(null);
    setInspectorOpen(false);
  };
  /** Delete key on a link: an asset link, or a DFD element relation (FR-E7). */
  const removeEdge = (edge: { id: string; kind: string; source: string; target: string; relationType: string }) => {
    if (edge.kind === "a2a") {
      deleteLink(edge.id);
      return;
    }
    const el = elementOfAnchor(edge.source);
    if (!el || !elementLinking) return;
    writeElementRelations(el.id, withoutElementRelation(el.relations, edge.target, edge.relationType));
    setSelectedEdgeId(null);
    setInspectorOpen(false);
  };

  // The asset just created from a lane: select it so it can be named in the
  // asset panel (the name is required, FR-E2).
  useEffect(() => {
    const id = createdIdRef.current;
    if (!id) return;
    createdIdRef.current = null;
    setInspectedAssetId(id);
    setInspectorOpen(true);
    onSelectAsset(id);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  const createIn = (lane: { id: string; y: number; x?: number }) => {
    if (!onCreateAsset) return;
    // Next free place at the end of the lane.
    const xs = graph.nodes
      .filter((n) => n.kind === "asset" && String(n.group) === lane.id)
      .map((n) => positions.get(n.id)?.x)
      .filter((x): x is number => x !== undefined);
    const x = xs.length > 0 ? Math.max(...xs) + NODE_SPACING : lane.x ?? 0;
    pendingCreateRef.current = { group: lane.id, x, y: lane.y };
    onCreateAsset(lane.id as AssetGroup);
  };

  // FR-E8: delete an asset after the usual confirmation with its usage.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // FR-E7: element → asset relation being edited, and the element picker.
  const [elementDialog, setElementDialog] = useState<{ elementId: string; assetId: string } | null>(null);
  const [elementPicker, setElementPicker] = useState<{ assetId: string; anchor: HTMLElement } | null>(null);
  const canLinkElements = editing && !!elementLinking;
  const elementTypeName = (type: string) =>
    t(`tabs.dfd.elementTypes.${type}.name`, { defaultValue: type });
  const writeElementRelations = (elementId: string, relations: AssetRelation[]) => {
    elementLinking?.onChange(elementId, relations);
  };

  // FR-E11 / UX-4 stage 2: a link that appears while the view is open pulses.
  const knownLinkIdsRef = useRef<Set<string> | null>(null);
  const [freshLinkIds, setFreshLinkIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const ids = new Set(source.relations.map((r) => r.id));
    const known = knownLinkIdsRef.current;
    knownLinkIdsRef.current = ids;
    if (!known) return;
    const fresh = [...ids].filter((id) => !known.has(id));
    if (fresh.length === 0) return;
    setFreshLinkIds(new Set(fresh));
    const timer = setTimeout(() => setFreshLinkIds(new Set()), 2400);
    return () => clearTimeout(timer);
  }, [source]);

  // ── Context bar actions ─────────────────────────────────────────────────
  const preset = presetOfLayers(state.layers);
  const setPreset = (id: AssetGraphPresetId) =>
    setState((s) => ({
      ...s,
      layers: [...ASSET_GRAPH_PRESETS[id]],
      showHazards: HAZARD_PRESETS.includes(id),
    }));
  const toggleLayer = (layer: AssetGroup) =>
    setState((s) => ({
      ...s,
      layers: s.layers.includes(layer)
        ? s.layers.filter((l) => l !== layer)
        : [...s.layers, layer],
    }));
  const showLayer = (layer: string) =>
    setState((s) =>
      s.layers.includes(layer as AssetGroup)
        ? s
        : { ...s, layers: [...s.layers, layer as AssetGroup] },
    );
  const focusOn = (assetId: string) =>
    setState((s) => ({
      ...s,
      view: "focus",
      focusAssetId: assetId,
      // G3: hazards on when the focus has hazard edges (or is a hazard).
      showHazards: s.showHazards || hasHazardEdges(assetId),
      // Entering the focus view from the layer view shows all layers; moving
      // the focus within it keeps the user's layer choice.
      layers: s.view === "focus" ? s.layers : [...ALL_LAYERS],
    }));
  const reset = () => {
    setState(DEFAULT_STATE);
    setSearchHit(null);
    setSearchMiss(false);
    setQuery("");
  };

  const groupLabel = (g: string) => t(`assets.groups.${g}`, { defaultValue: g });
  // Labels: asset links under assets.relations.a2a.<type>; DFD element →
  // asset relations under assets.relations.element.<group>.<type> (the
  // target asset's group). Looked up with exists() so an unknown type falls
  // back to its key quietly instead of logging a missing key per render.
  const has = (key: string) => (i18n?.exists ? i18n.exists(key) : true);
  const plain = (type: string) => type.replace(/_/g, " ");
  const typeLabel = (type: string) => {
    const key = `assets.relations.a2a.${type}`;
    return has(key) ? t(key, { defaultValue: plain(type) }) : plain(type);
  };
  const elementTypeLabel = (type: string, group?: string) => {
    for (const g of group ? [group, ...ALL_LAYERS] : ALL_LAYERS) {
      const key = `assets.relations.element.${g}.${type}`;
      if (i18n?.exists?.(key)) return t(key);
    }
    return plain(type);
  };
  const groupOfAsset = (id: string) =>
    source.assets.find((a) => a.id === id)?.assetGroup as string | undefined;
  // Severity of an endangers edge: canonical labels (G7; S-classes under
  // iso-21434 follow with ISO Phase 1H).
  const severityLabel = (severity: string) => {
    const canonical = normalizeLegacySafetyImpact(severity) ?? severity;
    return t(`tabs.hazards.severity.${canonical}`, { defaultValue: plain(canonical) });
  };
  const edgeLabel = (e: { kind: string; relationType: string; target: string; severity?: string }) =>
    e.kind === "anchor"
      ? elementTypeLabel(e.relationType, groupOfAsset(e.target))
      : e.kind === "endangers"
        ? e.severity
          ? severityLabel(e.severity)
          : ""
        : e.kind === "contributes_to"
          ? ""
          : typeLabel(e.relationType);

  // The focus: an asset, or a hazard ("hz:" id, FR-V11b).
  const focusNode = (() => {
    const id = state.focusAssetId;
    if (!id) return undefined;
    if (id.startsWith(HAZARD_PREFIX)) {
      const h = source.hazards?.items.find((x) => HAZARD_PREFIX + x.id === id);
      return h ? { displayId: h.externalRef || "", name: h.label } : undefined;
    }
    return source.assets.find((a) => a.id === id);
  })();

  const c = graph.counts;
  const countsText = t("tabs.dfd.assetGraph.counts", {
    defaultValue:
      "{{visible}} of {{total}} assets visible · {{hiddenLayers}} in hidden layers · {{outsideFocus}} outside focus · {{filtered}} links filtered",
    visible: c.assetsVisible,
    total: c.assetsTotal,
    hiddenLayers: c.assetsInHiddenLayers,
    outsideFocus: c.assetsOutsideFocus,
    filtered: c.edgesHiddenByFilter,
  });
  const hazardCountsText =
    state.showHazards && c.hazardsTotal > 0
      ? t("tabs.dfd.assetGraph.hazard.counts", {
          defaultValue: "{{visible}} of {{total}} hazards",
          visible: c.hazardsVisible,
          total: c.hazardsTotal,
        })
      : "";
  const hazardStroke = "#ed6c02";

  const fg = darkMode ? "#eee" : "#222";
  /** FR-V4: a node's links into hidden layers, as clickable counters. */
  const stubBadges = (nodeId: string, left: number, top: number) =>
    (graph.stubs[nodeId] ?? []).map((s, i) => (
      <g
        key={s.layer}
        transform={`translate(${left},${top + i * 18})`}
        onClick={(ev) => {
          ev.stopPropagation();
          showLayer(s.layer);
        }}
        data-testid={`asset-graph-stub-${nodeId}-${s.layer}`}
      >
        <title>{t("tabs.dfd.assetGraph.stubHint", { defaultValue: "Show layer" })}</title>
        <rect height={15} width={30 + (String(s.count).length + groupLabel(s.layer).length) * 6.2} rx={7} fill={groupColor(s.layer).colorLight} stroke={groupColor(s.layer).color} />
        <text x={6} y={11} fontSize={10} fill="#333">{`${s.count} → ${groupLabel(s.layer)}`}</text>
      </g>
    ));
  const muted = darkMode ? "#999" : "#666";
  const laneFill = darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.035)";

  return (
    <Box
      data-testid="asset-graph-view"
      sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", bgcolor: darkMode ? "#1a1a1a" : "background.default" }}
    >
      {/* ── Context bar (FR-V14) ── */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ px: 1.5, py: 0.75, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
      >
        {commitA2AOps && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, v: "view" | "edit" | null) => {
              if (!v) return;
              setMode(v);
              setDrag(null);
              setConnectRequest(null);
              setConnectNotice(null);
            }}
          >
            <ToggleButton value="view" data-testid="asset-graph-mode-view">
              <Tooltip title={t("tabs.dfd.assetGraph.mode.view", { defaultValue: "View" })}>
                <ViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="edit" data-testid="asset-graph-mode-edit" color="warning">
              <Tooltip title={t("tabs.dfd.assetGraph.mode.edit", { defaultValue: "Edit" })}>
                <EditIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        {editing && (
          <>
            <Tooltip title={t("tabs.dfd.assetGraph.history.undo", { defaultValue: "Undo (Ctrl+Z)" })}>
              <span>
                <IconButton size="small" disabled={history.past.length === 0} onClick={() => replay("undo")} data-testid="asset-graph-undo">
                  <UndoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t("tabs.dfd.assetGraph.history.redo", { defaultValue: "Redo (Ctrl+Shift+Z)" })}>
              <span>
                <IconButton size="small" disabled={history.future.length === 0} onClick={() => replay("redo")} data-testid="asset-graph-redo">
                  <RedoIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}

        <ToggleButtonGroup
          size="small"
          exclusive
          value={state.view}
          onChange={(_, v: AssetGraphViewKind | null) => {
            if (!v) return;
            setState((s) => ({
              ...s,
              view: v,
              focusAssetId: v === "focus" ? s.focusAssetId ?? selectedAssetId : s.focusAssetId,
            }));
          }}
        >
          <ToggleButton value="layers" data-testid="asset-graph-view-layers">
            {t("tabs.dfd.assetGraph.view.layers", { defaultValue: "Layers" })}
          </ToggleButton>
          <ToggleButton value="focus" data-testid="asset-graph-view-focus">
            {t("tabs.dfd.assetGraph.view.focus", { defaultValue: "Focus" })}
          </ToggleButton>
        </ToggleButtonGroup>

        <Select
          size="small"
          value={preset}
          data-testid="asset-graph-preset"
          onChange={(e) => {
            const v = e.target.value as AssetGraphPresetId | "custom";
            if (v !== "custom") setPreset(v);
          }}
          sx={{ minWidth: 170 }}
        >
          {ASSET_GRAPH_PRESET_ORDER.map((id) => (
            <MenuItem key={id} value={id}>
              {t(`tabs.dfd.assetGraph.preset.${id}`, { defaultValue: id })}
            </MenuItem>
          ))}
          <MenuItem value="custom" disabled>
            {t("tabs.dfd.assetGraph.preset.custom", { defaultValue: "Custom" })}
          </MenuItem>
        </Select>
        <Tooltip title={t("tabs.dfd.assetGraph.layers", { defaultValue: "Layers" })}>
          <IconButton size="small" onClick={(e) => setLayerMenu(e.currentTarget)}>
            <LayersIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={layerMenu} open={!!layerMenu} onClose={() => setLayerMenu(null)}>
          {ALL_LAYERS.map((g) => (
            <MenuItem key={g} dense onClick={() => toggleLayer(g)}>
              <Checkbox size="small" checked={state.layers.includes(g)} sx={{ p: 0.5, mr: 1 }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: groupColor(g).color, mr: 1 }} />
              <ListItemText primary={groupLabel(g)} />
            </MenuItem>
          ))}
          {c.hazardsTotal > 0 && <Divider />}
          {c.hazardsTotal > 0 && (
            // FR-V11c: the hazard lane is chosen like a layer.
            <MenuItem
              dense
              onClick={() => setState((s) => ({ ...s, showHazards: !s.showHazards }))}
              data-testid="asset-graph-layer-hazards"
            >
              <Checkbox size="small" checked={state.showHazards} sx={{ p: 0.5, mr: 1 }} />
              <Box sx={{ width: 10, height: 10, transform: "rotate(45deg)", bgcolor: hazardStroke, mr: 1 }} />
              <ListItemText primary={t("tabs.dfd.assetGraph.hazard.lane", { defaultValue: "Hazards" })} />
            </MenuItem>
          )}
        </Menu>

        {state.view === "focus" ? (
          <>
            <Chip
              size="small"
              color={graph.focusMissing ? "default" : "primary"}
              variant="outlined"
              label={
                focusNode
                  ? `${t("tabs.dfd.assetGraph.focus", { defaultValue: "Focus" })}: ${focusNode.displayId ?? ""} ${focusNode.name ?? ""}`
                  : t("tabs.dfd.assetGraph.noFocus", { defaultValue: "Select an asset to focus" })
              }
            />
            <Select
              size="small"
              value={state.depth}
              onChange={(e) => setState((s) => ({ ...s, depth: Number(e.target.value) }))}
              data-testid="asset-graph-depth"
            >
              {Array.from({ length: MAX_DEPTH }, (_, i) => i + 1).map((d) => (
                <MenuItem key={d} value={d}>
                  {t("tabs.dfd.assetGraph.depth", { defaultValue: "Depth {{depth}}", depth: d })}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : null}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              // One choice per view: on by default in the focus view.
              checked={state.view === "focus" ? state.anchorsInFocus : state.showAnchors}
              onChange={(e) =>
                setState((s) =>
                  s.view === "focus"
                    ? { ...s, anchorsInFocus: e.target.checked }
                    : { ...s, showAnchors: e.target.checked },
                )
              }
              data-testid="asset-graph-show-anchors"
            />
          }
          label={<Typography variant="body2">{t("tabs.dfd.assetGraph.anchors", { defaultValue: "DFD elements" })}</Typography>}
        />
        {c.hazardsTotal > 0 && (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={state.showHazards}
                onChange={(e) => setState((s) => ({ ...s, showHazards: e.target.checked }))}
                inputProps={{ "aria-label": t("tabs.dfd.assetGraph.hazard.toggle", { defaultValue: "Hazards" }) }}
                data-testid="asset-graph-show-hazards"
              />
            }
            label={<Typography variant="body2">{t("tabs.dfd.assetGraph.hazard.toggle", { defaultValue: "Hazards" })}</Typography>}
          />
        )}

        <DfdScopeFilterControls
          index={pageScope}
          filter={pageFilter}
          onChange={setPageFilter}
          showParentLevel={false}
        />

        <Tooltip title={t("tabs.dfd.assetGraph.typeFilter", { defaultValue: "Relation types" })}>
          <IconButton size="small" onClick={(e) => setTypeMenu(e.currentTarget)} data-testid="asset-graph-type-filter">
            <Badge color="primary" variant="dot" invisible={state.relationTypes === null}>
              <FilterIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
        <Menu anchorEl={typeMenu} open={!!typeMenu} onClose={() => setTypeMenu(null)}>
          <MenuItem dense onClick={() => setState((s) => ({ ...s, relationTypes: null }))}>
            <Checkbox size="small" checked={state.relationTypes === null} sx={{ p: 0.5, mr: 1 }} />
            <ListItemText primary={t("tabs.dfd.assetGraph.allTypes", { defaultValue: "All types" })} />
          </MenuItem>
          <Divider />
          {availableTypes.map((x) => (
            <MenuItem key={`${x.kind}:${x.type}`} dense onClick={() => toggleType(x.type)} data-testid={`asset-graph-type-${x.type}`}>
              <Checkbox
                size="small"
                checked={state.relationTypes === null || state.relationTypes.includes(x.type)}
                sx={{ p: 0.5, mr: 1 }}
              />
              <ListItemText
                primary={`${x.kind === "anchor" ? elementTypeLabel(x.type) : typeLabel(x.type)} (${x.count})`}
                secondary={x.kind === "anchor" ? t("tabs.dfd.assetGraph.anchorType", { defaultValue: "DFD element → asset" }) : undefined}
              />
            </MenuItem>
          ))}
        </Menu>
        {state.relationTypes !== null && (
          <Chip
            size="small"
            data-testid="asset-graph-filter-chip"
            label={t("tabs.dfd.assetGraph.filterActive", {
              defaultValue: "{{count}} of {{total}} types",
              count: state.relationTypes.length,
              total: availableTypes.length,
            })}
            onDelete={() => setState((s) => ({ ...s, relationTypes: null }))}
          />
        )}

        <TextField
          size="small"
          value={query}
          placeholder={t("tabs.dfd.assetGraph.search", { defaultValue: "Find asset" })}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchHit(null);
            setSearchMiss(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch(e.shiftKey ? -1 : 1);
          }}
          inputProps={{ "data-testid": "asset-graph-search" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 170 }}
        />

        <Divider orientation="vertical" flexItem />
        <Typography variant="caption" color="text.secondary" data-testid="asset-graph-counts" sx={{ flexGrow: 1 }}>
          {countsText}
          {hazardCountsText ? ` · ${hazardCountsText}` : ""}
        </Typography>

        <Tooltip title={t("tabs.dfd.assetGraph.fit", { defaultValue: "Fit to view" })}>
          <IconButton size="small" onClick={fit}><FitIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title={t("tabs.dfd.assetGraph.rearrange", { defaultValue: "Rearrange" })}>
          <IconButton size="small" onClick={rearrange} data-testid="asset-graph-rearrange"><RearrangeIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title={t("tabs.dfd.assetGraph.legend", { defaultValue: "Legend" })}>
          <IconButton size="small" onClick={() => setShowLegend((v) => !v)}><LegendIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Button size="small" startIcon={<ResetIcon />} onClick={reset}>
          {t("tabs.dfd.assetGraph.reset", { defaultValue: "Reset" })}
        </Button>
      </Stack>

      {/* ── Canvas ── */}
      <Box
        data-testid="asset-graph-canvas-box"
        data-mode={editing ? "edit" : "view"}
        sx={{
          position: "relative",
          flexGrow: 1,
          overflow: "hidden",
          // UX-2: the edit mode is visibly different, not only a switch state.
          outline: editing ? "3px dashed" : "none",
          outlineColor: "warning.main",
          outlineOffset: "-3px",
          bgcolor: editing ? (darkMode ? "rgba(237,108,2,0.06)" : "rgba(237,108,2,0.04)") : undefined,
        }}
      >
        {editing && (
          <Chip
            size="small"
            color="warning"
            label={t("tabs.dfd.assetGraph.mode.editHint", {
              defaultValue: "Edit mode — drag from a node's handle to connect",
            })}
            sx={{ position: "absolute", left: 12, bottom: 12, zIndex: 1 }}
          />
        )}
        {historyNotice && (
          <Alert
            severity="info"
            data-testid="asset-graph-history-notice"
            onClose={() => setHistoryNotice(null)}
            sx={{ position: "absolute", top: 8, left: 8, right: rightInset + 8, zIndex: 2 }}
          >
            {historyNotice}
          </Alert>
        )}
        {connectNotice && (
          <Alert
            severity="warning"
            data-testid="asset-graph-connect-notice"
            onClose={() => setConnectNotice(null)}
            sx={{ position: "absolute", top: 8, left: 8, right: rightInset + 8, zIndex: 2 }}
          >
            {connectNotice}
          </Alert>
        )}
        {(searchMiss || (hitVisibility && hitVisibility.state !== "visible")) && (
          <Alert
            severity="info"
            data-testid="asset-graph-search-notice"
            onClose={() => {
              setSearchHit(null);
              setSearchMiss(false);
            }}
            sx={{ position: "absolute", top: 8, left: 8, right: rightInset + (inspectorOpen ? CARD_WIDTH + 24 : 8), zIndex: 1 }}
            action={
              hitAsset && hitVisibility?.state === "hiddenLayer" ? (
                <Button
                  size="small"
                  onClick={() => {
                    showLayer(hitVisibility.layer);
                    onSelectAsset(hitAsset.id);
                    pendingCenterRef.current = hitAsset.id;
                  }}
                >
                  {t("tabs.dfd.assetGraph.showLayer", {
                    defaultValue: "Show layer {{layer}}",
                    layer: groupLabel(hitVisibility.layer),
                  })}
                </Button>
              ) : hitAsset && hitVisibility?.state === "outsidePage" ? (
                <Button
                  size="small"
                  onClick={() => {
                    setPageFilter(NO_DFD_SCOPE_FILTER);
                    onSelectAsset(hitAsset.id);
                    pendingCenterRef.current = hitAsset.id;
                  }}
                >
                  {t("tabs.dfd.assetGraph.showAllPages", { defaultValue: "Show all pages" })}
                </Button>
              ) : hitAsset && hitVisibility?.state === "outsideFocus" ? (
                <Button
                  size="small"
                  onClick={() => {
                    focusOn(hitAsset.id);
                    onSelectAsset(hitAsset.id);
                    pendingCenterRef.current = hitAsset.id;
                  }}
                >
                  {t("tabs.dfd.assetGraph.focusHit", { defaultValue: "Focus on it" })}
                </Button>
              ) : undefined
            }
          >
            {searchMiss
              ? t("tabs.dfd.assetGraph.noMatch", { defaultValue: "No asset matches \"{{query}}\".", query })
              : hitVisibility?.state === "hiddenLayer"
                ? t("tabs.dfd.assetGraph.hitHiddenLayer", {
                    defaultValue: "{{asset}} is in the hidden layer {{layer}}.",
                    asset: `${hitAsset?.displayId ?? ""} ${hitAsset?.name ?? ""}`.trim(),
                    layer: groupLabel((hitVisibility as { layer: string }).layer),
                  })
                : hitVisibility?.state === "outsidePage"
                  ? t("tabs.dfd.assetGraph.hitOutsidePage", {
                      defaultValue: "{{asset}} is held by no element on the selected page.",
                      asset: `${hitAsset?.displayId ?? ""} ${hitAsset?.name ?? ""}`.trim(),
                    })
                  : t("tabs.dfd.assetGraph.hitOutsideFocus", {
                      defaultValue: "{{asset}} is outside the focus (depth {{depth}}).",
                      asset: `${hitAsset?.displayId ?? ""} ${hitAsset?.name ?? ""}`.trim(),
                      depth: state.depth,
                    })}
          </Alert>
        )}
        {graph.nodes.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ position: "absolute", top: 16, left: 16 }}>
            {state.view === "focus" && graph.focusMissing
              ? t("tabs.dfd.assetGraph.noFocus", { defaultValue: "Select an asset to focus" })
              : t("tabs.dfd.assetGraph.empty", { defaultValue: "No assets in the selected layers." })}
          </Typography>
        )}
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          data-testid="asset-graph-canvas"
          tabIndex={0}
          role="application"
          aria-label={t("tabs.dfd.assetGraph.keyboard.canvas", {
            defaultValue: "Asset graph — Tab or arrow keys: select a node · Enter: focus · Delete: remove (edit mode) · Esc: close",
          })}
          onKeyDown={onCanvasKeyDown}
          style={{ display: "block", cursor: "grab", outline: "none", fontFamily: "Roboto, Helvetica, Arial, sans-serif" }}
        >
          <defs>
            <marker id="ag-arrow" viewBox="0 -5 10 10" refX={10} refY={0} markerWidth={7} markerHeight={7} orient="auto">
              <path d="M0,-5L10,0L0,5" fill={muted} />
            </marker>
            <marker id="ag-arrow-hazard" viewBox="0 -5 10 10" refX={10} refY={0} markerWidth={7} markerHeight={7} orient="auto">
              <path d="M0,-5L10,0L0,5" fill={hazardStroke} />
            </marker>
          </defs>
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Lanes */}
            {layout.lanes.map((lane) => (
              <g key={lane.id}>
                {lane.kind !== "orthogonal" ? (
                  <rect x={-2000} y={lane.y - LANE_HEIGHT / 2 + 6} width={8000} height={LANE_HEIGHT - 12} fill={laneFill} />
                ) : null}
                <text
                  x={lane.kind === "orthogonal" ? (lane.x ?? 0) - NODE_RADIUS : -NODE_RADIUS * 2}
                  y={lane.y - LANE_HEIGHT / 2 + 20}
                  fontSize={12}
                  fill={muted}
                  textAnchor="end"
                >
                  {lane.id === ANCHOR_LANE
                    ? t("tabs.dfd.assetGraph.anchors", { defaultValue: "DFD elements" })
                    : lane.id === HAZARD_LANE
                      ? t("tabs.dfd.assetGraph.hazard.lane", { defaultValue: "Hazards" })
                      : groupLabel(lane.id)}
                </text>
                {canCreate && lane.id !== ANCHOR_LANE && lane.id !== HAZARD_LANE && (
                  <g
                    transform={`translate(${(lane.kind === "orthogonal" ? (lane.x ?? 0) - NODE_RADIUS : -NODE_RADIUS * 2) + 14},${lane.y - LANE_HEIGHT / 2 + 16})`}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      createIn(lane);
                    }}
                    data-testid={`asset-graph-create-${lane.id}`}
                  >
                    <title>
                      {t("tabs.dfd.assetGraph.create", {
                        defaultValue: "New asset in {{layer}}",
                        layer: groupLabel(lane.id),
                      })}
                    </title>
                    <circle r={9} fill={darkMode ? "#2a2a2a" : "#fff"} stroke="#ed6c02" strokeWidth={2} />
                    <text textAnchor="middle" dy={4} fontSize={14} fontWeight={700} fill="#ed6c02">+</text>
                  </g>
                )}
              </g>
            ))}

            {/* Edges */}
            {graph.edges.map((e) => {
              const a = positions.get(e.source);
              const b = positions.get(e.target);
              if (!a || !b) return null;
              // Element anchors are drawn as curves, so their dashed lines do
              // not run through the asset column above them.
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const bend = e.kind === "anchor" ? Math.min(90, len * 0.3) : 0;
              const cx = (a.x + b.x) / 2 + (-dy / len) * bend;
              const cy = (a.y + b.y) / 2 + (dx / len) * bend;
              const r = NODE_RADIUS + 2;
              const toward = (from: Point, to: { x: number; y: number }) => {
                const ux = to.x - from.x;
                const uy = to.y - from.y;
                const l = Math.hypot(ux, uy) || 1;
                return { x: from.x + (ux / l) * r, y: from.y + (uy / l) * r };
              };
              const p1 = toward(a, { x: cx, y: cy });
              const p2 = toward(b, { x: cx, y: cy });
              // Point on the curve at t = 0.5.
              const mx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
              const my = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
              const label = edgeLabel(e);
              // FR-V11a: hazard edges in the warning colour; a direct
              // contribution is drawn stronger than an indirect one.
              const hazardEdge = e.kind === "contributes_to" || e.kind === "endangers";
              const hazardWidth = e.kind === "contributes_to" && e.relevance !== "direct" ? 1.2 : 2;
              return (
                <g
                  key={e.id}
                  data-testid={`asset-graph-edge-${e.id}`}
                  data-edge-id={e.id}
                  // Takes focus on click, so Delete acts on it (NFR-4).
                  tabIndex={-1}
                  style={{ cursor: "pointer", outline: "none" }}
                  onClick={() => {
                    setSelectedEdgeId(e.id);
                    setInspectedHazardId(null);
                    setInspectorOpen(true);
                  }}
                >
                  {/* Wide invisible hit area */}
                  <path
                    d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                  />
                  {freshLinkIds.has(e.id) && (
                    <path
                      d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`}
                      fill="none"
                      stroke="#ed6c02"
                      strokeWidth={6}
                      data-testid={`asset-graph-fresh-link-${e.id}`}
                    >
                      <animate attributeName="opacity" from="0.8" to="0" dur="0.8s" repeatCount="3" />
                    </path>
                  )}
                  <path
                    d={`M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`}
                    fill="none"
                    stroke={e.id === selectedEdgeId ? (darkMode ? "#90caf9" : "#1976d2") : hazardEdge ? hazardStroke : muted}
                    strokeWidth={e.id === selectedEdgeId ? 2.6 : hazardEdge ? hazardWidth : 1.4}
                    data-fresh={freshLinkIds.has(e.id) ? "" : undefined}
                    strokeDasharray={e.kind === "anchor" || e.kind === "contributes_to" ? "5 4" : undefined}
                    markerEnd={hazardEdge ? "url(#ag-arrow-hazard)" : "url(#ag-arrow)"}
                  />
                  <text x={mx} y={my - 4} fontSize={10} fill={fg} textAnchor="middle" paintOrder="stroke" stroke={darkMode ? "#1a1a1a" : "#fafafa"} strokeWidth={3}>
                    {findings.has(e.id) ? "⚠ " : ""}
                    {label}
                  </text>
                  {findings.has(e.id) && (
                    <title>
                      {t(`tabs.dfd.assetGraph.finding.${findings.get(e.id)}`, {
                        defaultValue: "This link is not allowed for these groups (e.g. after a group change).",
                      })}
                    </title>
                  )}
                  {e.stepOrder !== undefined && (
                    <g transform={`translate(${mx + label.length * 2.8 + 10},${my - 8})`}>
                      <circle r={7} fill={muted} />
                      <text fontSize={9} fill="#fff" textAnchor="middle" dy={3}>{e.stepOrder}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Connection being dragged */}
            {drag && positions.get(drag.sourceId) && (
              <line
                x1={positions.get(drag.sourceId)!.x}
                y1={positions.get(drag.sourceId)!.y}
                x2={drag.x}
                y2={drag.y}
                stroke="#ed6c02"
                strokeWidth={2}
                strokeDasharray="6 4"
                markerEnd="url(#ag-arrow)"
                pointerEvents="none"
                data-testid="asset-graph-drag-line"
              />
            )}

            {/* Nodes */}
            {graph.nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              if (n.kind === "anchor") {
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{
                      cursor: moveKeyHeld ? "ew-resize" : onShowElement ? "pointer" : "default",
                      outline: "none",
                    }}
                    onPointerDown={(e) => startMove(n.id, e)}
                    onClick={unlessMoved(() => onShowElement?.(n.elementId))}
                    data-moving={moving?.id === n.id ? "" : undefined}
                    data-testid={`asset-graph-node-${n.id}`}
                    data-node-id={n.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.displayId} ${n.name || n.elementType}`.trim()}
                    onFocus={() => setFocusedNodeId(n.id)}
                    onBlur={() => setFocusedNodeId((f) => (f === n.id ? null : f))}
                  >
                    {(focusedNodeId === n.id || moving?.id === n.id) && (
                      <rect
                        x={-NODE_RADIUS * 1.2 - 6}
                        y={-20}
                        width={NODE_RADIUS * 2.4 + 12}
                        height={40}
                        rx={6}
                        fill="none"
                        stroke={darkMode ? "#90caf9" : "#1976d2"}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        data-testid={`asset-graph-focus-${n.id}`}
                      />
                    )}
                    <rect x={-NODE_RADIUS * 1.2} y={-14} width={NODE_RADIUS * 2.4} height={28} rx={4} fill={darkMode ? "#2a2a2a" : "#fff"} stroke={muted} strokeDasharray="4 3" />
                    <text fontSize={11} fill={fg} textAnchor="middle" dy={4}>{n.displayId}</text>
                    <text fontSize={10} fill={muted} textAnchor="middle" dy={28}>{n.name || n.elementType}</text>
                    {canLinkElements && !drag && (
                      <circle
                        cx={NODE_RADIUS * 1.2}
                        cy={0}
                        r={7}
                        fill={darkMode ? "#2a2a2a" : "#fff"}
                        stroke="#ed6c02"
                        strokeWidth={2}
                        style={{ cursor: "crosshair" }}
                        data-graph-handle=""
                        data-testid={`asset-graph-handle-${n.id}`}
                        onPointerDown={(e) => startConnect(n.id, e)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <title>
                          {t("tabs.dfd.assetGraph.elementLink.handle", {
                            defaultValue: "Drag to an asset to relate this DFD element to it",
                          })}
                        </title>
                      </circle>
                    )}
                  </g>
                );
              }
              if (n.kind === "hazard") {
                // FR-V11: a diamond in the colour of the worst severity it
                // endangers with; read-only — no handles, no drop target.
                const color = HAZARD_SEVERITY_RANK_COLOR[n.severityRank] ?? HAZARD_SEVERITY_RANK_COLOR[0];
                const selected = inspectorOpen && !selectedEdgeId && inspectedHazardId === n.hazardId;
                const r = NODE_RADIUS + 4;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: moveKeyHeld ? "move" : "pointer", outline: "none" }}
                    data-moving={moving?.id === n.id ? "" : undefined}
                    onPointerDown={(e) => startMove(n.id, e)}
                    onClick={unlessMoved(() => selectHazardNode(n.hazardId))}
                    onDoubleClick={() => focusOn(n.id)}
                    data-testid={`asset-graph-node-${n.id}`}
                    data-node-id={n.id}
                    data-severity-rank={n.severityRank}
                    tabIndex={0}
                    role="button"
                    aria-label={`${n.displayId} ${n.name} (${t("tabs.dfd.assetGraph.hazard.lane", { defaultValue: "Hazards" })})`}
                    onFocus={() => setFocusedNodeId(n.id)}
                    onBlur={() => setFocusedNodeId((f) => (f === n.id ? null : f))}
                  >
                    {(focusedNodeId === n.id || moving?.id === n.id) && (
                      <circle
                        r={NODE_RADIUS + 10}
                        fill="none"
                        stroke={darkMode ? "#90caf9" : "#1976d2"}
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        data-testid={`asset-graph-focus-${n.id}`}
                      />
                    )}
                    <path
                      d={`M0,${-r} L${r},0 L0,${r} L${-r},0 Z`}
                      fill={darkMode ? "#2a2a2a" : "#fff"}
                      stroke={selected ? (darkMode ? "#fff" : "#000") : color}
                      strokeWidth={selected ? 3.5 : 2.5}
                      strokeDasharray={n.linked ? undefined : "5 4"}
                    />
                    <path d={`M0,${-r + 6} L${r - 6},0 L0,${r - 6} L${-r + 6},0 Z`} fill={color} fillOpacity={0.25} />
                    <text fontSize={11} fontWeight={600} fill={fg} textAnchor="middle" dy={4}>
                      {n.displayId.length > 10 ? `${n.displayId.slice(0, 9)}…` : n.displayId}
                    </text>
                    <text fontSize={11} fill={fg} textAnchor="middle" dy={r + 14}>
                      {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                    </text>
                    {!n.linked && (
                      // FR-V11e: presented like a finding (UX-4).
                      <g transform={`translate(${-r * 0.75},${-r * 0.75})`} data-testid={`asset-graph-not-linked-${n.id}`}>
                        <title>
                          {t("tabs.dfd.assetGraph.hazard.notLinked", {
                            defaultValue: "Not linked — no cause and no protection target. Link them in the Hazard tab.",
                          })}
                        </title>
                        <circle r={8} fill={darkMode ? "#2a2a2a" : "#fff"} stroke="#ed6c02" />
                        <text fontSize={11} textAnchor="middle" dy={4} fill="#ed6c02">!</text>
                      </g>
                    )}
                    {stubBadges(n.id, r + 6, -r + 4)}
                  </g>
                );
              }
              const { color, colorLight } = groupColor(String(n.group));
              const selected = n.id === selectedAssetId;
              const hit = !selected && searchHit?.assetId === n.id;
              // While dragging a connection: valid / reverse-only / invalid.
              const targetClass: A2ATargetClass | null =
                drag && n.id !== drag.sourceId
                  ? targetClasses?.get(n.id)?.targetClass ?? "invalid"
                  : null;
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x},${p.y})`}
                  style={{
                    cursor: moveKeyHeld ? ((ORTHOGONAL_LAYERS as readonly string[]).includes(String(n.group)) ? "move" : "ew-resize") : "pointer",
                    opacity: targetClass === "invalid" ? 0.3 : 1,
                    outline: "none",
                  }}
                  data-target-class={targetClass ?? undefined}
                  data-moving={moving?.id === n.id ? "" : undefined}
                  onPointerDown={(e) => startMove(n.id, e)}
                  onPointerUp={(e) => dropOn(n.id, e)}
                  onClick={unlessMoved(() => selectAssetNode(n.id))}
                  onDoubleClick={() => focusOn(n.id)}
                  data-testid={`asset-graph-node-${n.id}`}
                  data-node-id={n.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.displayId} ${n.name} (${groupLabel(String(n.group))})`}
                  onFocus={() => {
                    setFocusedNodeId(n.id);
                    // Keyboard selection selects like a click (NFR-4).
                    if (n.id !== inspectedAssetId || !inspectorOpen || selectedEdgeId) selectAssetNode(n.id);
                  }}
                  onBlur={() => setFocusedNodeId((f) => (f === n.id ? null : f))}
                >
                  {(focusedNodeId === n.id || moving?.id === n.id) && (
                    <circle
                      r={NODE_RADIUS + 10}
                      fill="none"
                      stroke={darkMode ? "#90caf9" : "#1976d2"}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      data-testid={`asset-graph-focus-${n.id}`}
                    />
                  )}
                  {freshIds.has(n.id) && !selected && (
                    <circle r={NODE_RADIUS} fill="none" stroke={color} strokeWidth={2} data-testid={`asset-graph-fresh-${n.id}`}>
                      <animate attributeName="r" from={NODE_RADIUS} to={NODE_RADIUS + 16} dur="0.8s" repeatCount="3" />
                      <animate attributeName="opacity" from="0.9" to="0" dur="0.8s" repeatCount="3" />
                    </circle>
                  )}
                  {hit && (
                    <circle r={NODE_RADIUS + 7} fill="none" stroke="#f9a825" strokeWidth={3} data-testid={`asset-graph-hit-${n.id}`} />
                  )}
                  {targetClass === "valid" && (
                    <circle r={NODE_RADIUS + 6} fill="none" stroke="#2e7d32" strokeWidth={3} />
                  )}
                  {targetClass === "reverse_only" && (
                    <circle r={NODE_RADIUS + 6} fill="none" stroke="#ed6c02" strokeWidth={2.5} strokeDasharray="6 4">
                      <title>
                        {t("tabs.dfd.assetGraph.connect.reverseOnly", {
                          defaultValue: "Only the other direction is allowed",
                        })}
                      </title>
                    </circle>
                  )}
                  <circle
                    r={NODE_RADIUS}
                    fill={darkMode ? color : colorLight}
                    stroke={selected ? (darkMode ? "#fff" : "#000") : color}
                    strokeWidth={selected ? 3.5 : 2}
                  />
                  <text fontSize={12} fontWeight={600} fill={darkMode ? "#fff" : color} textAnchor="middle" dy={4}>
                    {n.displayId}
                  </text>
                  <text fontSize={11} fill={fg} textAnchor="middle" dy={NODE_RADIUS + 14}>
                    {n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}
                  </text>
                  {editing && !drag && (
                    <circle
                      cx={NODE_RADIUS}
                      cy={0}
                      r={7}
                      fill={darkMode ? "#2a2a2a" : "#fff"}
                      stroke="#ed6c02"
                      strokeWidth={2}
                      style={{ cursor: "crosshair" }}
                      data-graph-handle=""
                      data-testid={`asset-graph-handle-${n.id}`}
                      onPointerDown={(e) => startConnect(n.id, e)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <title>
                        {t("tabs.dfd.assetGraph.connect.handle", {
                          defaultValue: "Drag to another asset to connect",
                        })}
                      </title>
                    </circle>
                  )}
                  {nodesWithFindings.has(n.id) && (
                    <g transform={`translate(${-NODE_RADIUS * 0.75},${-NODE_RADIUS * 0.75})`} data-testid={`asset-graph-finding-${n.id}`}>
                      <title>
                        {t("tabs.dfd.assetGraph.findingNode", {
                          defaultValue: "Has asset links that are not allowed — see the notifications.",
                        })}
                      </title>
                      <circle r={8} fill={darkMode ? "#2a2a2a" : "#fff"} stroke="#ed6c02" />
                      <text fontSize={11} textAnchor="middle" dy={4} fill="#ed6c02">!</text>
                    </g>
                  )}
                  {stubBadges(n.id, NODE_RADIUS + 6, -NODE_RADIUS + 4)}
                </g>
              );
            })}
          </g>
        </svg>

        {confirmDeleteId && (
          <ConfirmAssetDeleteDialog
            open
            assetLabel={(() => {
              const a = source.assets.find((x) => x.id === confirmDeleteId);
              return a ? `${a.displayId ?? ""} · ${a.name ?? ""}` : "";
            })()}
            usage={assetUsage?.(confirmDeleteId) ?? null}
            onCancel={() => setConfirmDeleteId(null)}
            onConfirm={() => {
              onDeleteAsset?.(confirmDeleteId);
              setConfirmDeleteId(null);
              setInspectorOpen(false);
              setInspectedAssetId(null);
            }}
          />
        )}

        {elementPicker && (() => {
          const asset = source.assets.find((a) => a.id === elementPicker.assetId);
          return (
            <ElementPicker
              anchorEl={elementPicker.anchor}
              candidates={elementCandidates(linkable, elementPicker.assetId, String(asset?.assetGroup))}
              elementTypeName={elementTypeName}
              onPick={(elementId) => {
                setElementPicker(null);
                setElementDialog({ elementId, assetId: elementPicker.assetId });
              }}
              onClose={() => setElementPicker(null)}
            />
          );
        })()}

        {elementDialog && (() => {
          const el = linkable.find((x) => x.id === elementDialog.elementId);
          const asset = source.assets.find((a) => a.id === elementDialog.assetId);
          if (!el || !asset) return null;
          return (
            <ElementAssetRelationDialog
              open
              assetId={asset.id}
              elementType={el.type}
              relations={el.relations}
              availableAssets={source.assets.map((a) => ({
                id: a.id,
                displayId: a.displayId ?? "",
                name: a.name ?? "",
                assetGroup: a.assetGroup as AssetGroup,
              }))}
              onChange={(relations) => writeElementRelations(el.id, relations)}
              onClose={() => setElementDialog(null)}
            />
          );
        })()}

        <ConnectChooser
          request={connectRequest}
          assets={source.assets}
          relations={source.relations}
          typeLabel={typeLabel}
          onChoose={choose}
          onClose={() => setConnectRequest(null)}
        />

        {inspectorOpen && (
          <AssetGraphInspector
            source={source}
            assetId={inspectedAssetId ?? selectedAssetId}
            hazardId={inspectedHazardId}
            edge={selectedEdge}
            findingOf={(id) => findings.get(id)}
            typeLabel={typeLabel}
            edgeLabel={edgeLabel}
            elementTypeLabel={elementTypeLabel}
            groupLabel={groupLabel}
            onGoToAsset={goToAsset}
            onGoToElement={onShowElement}
            onFocus={(id) => {
              focusOn(id);
              pendingCenterRef.current = id;
            }}
            onShowInTable={onShowInTable}
            onOpenHazard={onOpenHazard}
            severityLabel={severityLabel}
            rightInset={rightInset}
            onDeleteLink={editing ? deleteLink : undefined}
            onUpdateLink={editing ? updateLink : undefined}
            assetEditing={editing ? assetEditing : undefined}
            onLinkElement={
              canLinkElements
                ? (assetId, anchor) => setElementPicker({ assetId, anchor })
                : undefined
            }
            onEditElementLink={
              canLinkElements ? (elementId, assetId) => setElementDialog({ elementId, assetId }) : undefined
            }
            onRemoveElementLink={
              canLinkElements
                ? (elementId, assetId, relationType) => {
                    const el = linkable.find((x) => x.id === elementId);
                    if (el) writeElementRelations(elementId, withoutElementRelation(el.relations, assetId, relationType));
                    setSelectedEdgeId(null);
                    setInspectorOpen(false);
                  }
                : undefined
            }
            onDeleteAsset={editing && onDeleteAsset ? (id) => setConfirmDeleteId(id) : undefined}
            onClose={() => {
              setInspectorOpen(false);
              setSelectedEdgeId(null);
              setInspectedHazardId(null);
            }}
          />
        )}

        {/* Legend (FR-V7) */}
        {showLegend && (
          <Box sx={{ position: "absolute", right: rightInset + 12, bottom: 12, p: 1.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 1, maxWidth: 280 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
              {t("tabs.dfd.assetGraph.legend", { defaultValue: "Legend" })}
            </Typography>
            {ALL_LAYERS.map((g) => (
              <Stack key={g} direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: groupColor(g).color }} />
                <Typography variant="caption">{groupLabel(g)}</Typography>
              </Stack>
            ))}
            <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
              {t("tabs.dfd.assetGraph.legendEdges", {
                defaultValue: "Solid: asset link · dashed: DFD element → asset · arrow: direction · number: step order",
              })}
            </Typography>
            {c.hazardsTotal > 0 && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.5 }} data-testid="asset-graph-legend-hazards">
                {t("tabs.dfd.assetGraph.hazard.legend", {
                  defaultValue:
                    "Diamond: hazard, coloured by the worst severity it endangers with · orange dashed: asset contributes to hazard (thicker: direct) · orange solid: hazard endangers, with the severity",
                })}
              </Typography>
            )}
            <Typography variant="caption" sx={{ display: "block", mt: 0.5 }} data-testid="asset-graph-legend-keys">
              {t("tabs.dfd.assetGraph.keyboard.legend", {
                defaultValue: "Keyboard: Tab / arrows select · Enter focuses · Delete removes (edit) · Esc closes",
              })}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
