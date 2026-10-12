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
//
// Read-only: nothing here writes the project (phase 3 adds the edit mode).

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
} from "@mui/icons-material";
import { select, zoom, zoomIdentity, type ZoomBehavior } from "d3";
import type { AssetGroup } from "shared";
import { getAssetGroupColor } from "../models/dfd-formatters";
import {
  ALL_LAYERS,
  ASSET_GRAPH_PRESETS,
  ASSET_GRAPH_PRESET_ORDER,
  presetOfLayers,
  type AssetGraphPresetId,
} from "./asset-graph-layers";
import { buildAssetGraph, DEFAULT_FOCUS_DEPTH } from "./build-asset-graph";
import {
  ANCHOR_LANE,
  LANE_HEIGHT,
  NODE_SPACING,
  NODE_RADIUS,
  layoutAssetGraph,
  type Point,
} from "./layout-asset-graph";
import type { AssetGraphSource, AssetGraphViewKind } from "./asset-graph-types";
import { AssetGraphInspector } from "./asset-graph-inspector";
import { ConnectChooser, type ConnectChoice, type ConnectRequest } from "./asset-graph-connect";
import { useA2AOps } from "../contexts/a2a-ops-context";
import {
  classifyA2ATargets,
  ConfirmAssetDeleteDialog,
  type A2ATargetClass,
  type AssetUsageLookup,
} from "shared";
import {
  assetVisibility,
  invalidLinks,
  relationTypesIn,
  searchAssets,
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
  readonly darkMode?: boolean;
}

interface ViewState {
  view: AssetGraphViewKind;
  layers: AssetGroup[];
  focusAssetId: string | null;
  depth: number;
  showAnchors: boolean;
  /** Shown relation types; null = all (FR-V10). */
  relationTypes: string[] | null;
}

const DEFAULT_STATE: ViewState = {
  view: "layers",
  layers: [...ASSET_GRAPH_PRESETS.architecture],
  focusAssetId: null,
  depth: DEFAULT_FOCUS_DEPTH,
  showAnchors: false,
  relationTypes: null,
};

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
  onCreateAsset,
  onDeleteAsset,
  assetUsage,
  rightInset = 0,
  darkMode = false,
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
  useEffect(() => {
    if (selectedAssetId) setInspectedAssetId(selectedAssetId);
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

  // Focus request from outside (asset table "show in graph").
  useEffect(() => {
    if (!focusRequest) return;
    // "What hangs on this asset?" — all layers, the user narrows afterwards.
    setState((s) => ({
      ...s,
      view: "focus",
      focusAssetId: focusRequest.assetId,
      layers: [...ALL_LAYERS],
    }));
    // …and its card is open: in the graph, the card is where it is edited.
    setSelectedEdgeId(null);
    setInspectedAssetId(focusRequest.assetId);
    setInspectorOpen(true);
  }, [focusRequest]);

  const graph = useMemo(
    () =>
      buildAssetGraph(source, {
        view: state.view,
        layers: state.layers,
        focusAssetId: state.focusAssetId,
        depth: state.depth,
        showAnchors: state.showAnchors,
        relationTypes: state.relationTypes,
      }),
    [source, state],
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

  // ── Layout: stable within the session (AR-12) ───────────────────────────
  const positionsRef = useRef<Map<string, Point>>(new Map());
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
    // layoutEpoch forces a fresh layout after "rearrange".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layoutEpoch, canCreate]);

  const rearrange = useCallback(() => {
    positionsRef.current = new Map();
    setLayoutEpoch((e) => e + 1);
  }, []);

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
      .filter((e: Event & { button?: number; ctrlKey?: boolean; type: string }) => {
        if (dragRef.current) return false;
        const target = e.target as Element | null;
        if (target?.closest?.("[data-graph-handle]")) return false;
        return (!e.ctrlKey || e.type === "wheel") && !e.button;
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
    if (!svgEl || !zoomRef.current || layout.positions.size === 0) return;
    const xs = [...layout.positions.values()].map((p) => p.x);
    const ys = [...layout.positions.values()].map((p) => p.y);
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
      const p = layout.positions.get(nodeId);
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
    if (id && layout.positions.has(id)) centerOn(id);
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
    const visibility = assetVisibility(graph, source, state, hit.id);
    setSearchHit({ assetId: hit.id, index, total: matches.length, visibility });
    if (visibility.state === "visible") {
      onSelectAsset(hit.id);
      centerOn(hit.id);
    }
  };
  // Re-evaluate the hit when the graph changes (e.g. its layer was shown).
  const hitVisibility = searchHit
    ? assetVisibility(graph, source, state, searchHit.assetId)
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
    setInspectedAssetId(assetId);
    onSelectAsset(assetId);
    const v = assetVisibility(graph, source, state, assetId);
    if (v.state === "hiddenLayer") {
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
  const targetClasses = useMemo(() => {
    if (!drag) return null;
    const src = source.assets.find((a) => a.id === drag.sourceId);
    if (!src) return null;
    const shown = graph.nodes.filter((n) => n.kind === "asset").map((n) => ({
      id: n.id,
      assetGroup: (n as { group: string }).group as AssetGroup,
    }));
    return classifyA2ATargets({ id: src.id, assetGroup: src.assetGroup as AssetGroup }, shown);
  }, [drag?.sourceId, graph, source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const p = toGraph(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d));
    };
    // Released anywhere but on a node: nothing happens.
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag !== null, toGraph]); // eslint-disable-line react-hooks/exhaustive-deps

  const startConnect = (assetId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectNotice(null);
    const p = layout.positions.get(assetId);
    setDrag({ sourceId: assetId, x: p?.x ?? 0, y: p?.y ?? 0 });
  };
  const dropOn = (assetId: string, e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    setDrag(null);
    if (assetId === d.sourceId) return;
    const cls = targetClasses?.get(assetId)?.targetClass ?? "invalid";
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
  const choose = (choice: ConnectChoice) => {
    setConnectRequest(null);
    commitA2AOps?.([{ kind: "add", relation: choice }]);
    // FR-E11: the focus stays on the source.
    onSelectAsset(choice.sourceAssetId);
  };
  const updateLink = (relationId: string, attributes: Record<string, unknown>) =>
    commitA2AOps?.([{ kind: "update", relationId, attributes }]);
  const deleteLink = (relationId: string) => {
    commitA2AOps?.([{ kind: "remove", relationId }]);
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
      .map((n) => layout.positions.get(n.id)?.x)
      .filter((x): x is number => x !== undefined);
    const x = xs.length > 0 ? Math.max(...xs) + NODE_SPACING : lane.x ?? 0;
    pendingCreateRef.current = { group: lane.id, x, y: lane.y };
    onCreateAsset(lane.id as AssetGroup);
  };

  // FR-E8: delete an asset after the usual confirmation with its usage.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    setState((s) => ({ ...s, layers: [...ASSET_GRAPH_PRESETS[id]] }));
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
  const edgeLabel = (e: { kind: string; relationType: string; target: string }) =>
    e.kind === "anchor"
      ? elementTypeLabel(e.relationType, groupOfAsset(e.target))
      : typeLabel(e.relationType);

  const focusNode =
    state.focusAssetId ? source.assets.find((a) => a.id === state.focusAssetId) : undefined;

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

  const fg = darkMode ? "#eee" : "#222";
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
        ) : (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={state.showAnchors}
                onChange={(e) => setState((s) => ({ ...s, showAnchors: e.target.checked }))}
              />
            }
            label={<Typography variant="body2">{t("tabs.dfd.assetGraph.anchors", { defaultValue: "DFD elements" })}</Typography>}
          />
        )}

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
            sx={{ position: "absolute", top: 8, left: 8, right: rightInset + (inspectorOpen ? 314 : 8), zIndex: 1 }}
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
        <svg ref={svgRef} width="100%" height="100%" data-testid="asset-graph-canvas" style={{ display: "block", cursor: "grab", fontFamily: "Roboto, Helvetica, Arial, sans-serif" }}>
          <defs>
            <marker id="ag-arrow" viewBox="0 -5 10 10" refX={10} refY={0} markerWidth={7} markerHeight={7} orient="auto">
              <path d="M0,-5L10,0L0,5" fill={muted} />
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
                    : groupLabel(lane.id)}
                </text>
                {canCreate && lane.id !== ANCHOR_LANE && (
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
              const a = layout.positions.get(e.source);
              const b = layout.positions.get(e.target);
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
              return (
                <g
                  key={e.id}
                  data-testid={`asset-graph-edge-${e.id}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedEdgeId(e.id);
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
                    stroke={e.id === selectedEdgeId ? (darkMode ? "#90caf9" : "#1976d2") : muted}
                    strokeWidth={e.id === selectedEdgeId ? 2.6 : 1.4}
                    data-fresh={freshLinkIds.has(e.id) ? "" : undefined}
                    strokeDasharray={e.kind === "anchor" ? "5 4" : undefined}
                    markerEnd="url(#ag-arrow)"
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
            {drag && layout.positions.get(drag.sourceId) && (
              <line
                x1={layout.positions.get(drag.sourceId)!.x}
                y1={layout.positions.get(drag.sourceId)!.y}
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
              const p = layout.positions.get(n.id);
              if (!p) return null;
              if (n.kind === "anchor") {
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    style={{ cursor: onShowElement ? "pointer" : "default" }}
                    onClick={() => onShowElement?.(n.elementId)}
                    data-testid={`asset-graph-node-${n.id}`}
                  >
                    <rect x={-NODE_RADIUS * 1.2} y={-14} width={NODE_RADIUS * 2.4} height={28} rx={4} fill={darkMode ? "#2a2a2a" : "#fff"} stroke={muted} strokeDasharray="4 3" />
                    <text fontSize={11} fill={fg} textAnchor="middle" dy={4}>{n.displayId}</text>
                    <text fontSize={10} fill={muted} textAnchor="middle" dy={28}>{n.name || n.elementType}</text>
                  </g>
                );
              }
              const { color, colorLight } = groupColor(String(n.group));
              const selected = n.id === selectedAssetId;
              const hit = !selected && searchHit?.assetId === n.id;
              const stubs = graph.stubs[n.id] ?? [];
              // While dragging a connection: valid / reverse-only / invalid.
              const targetClass: A2ATargetClass | null =
                drag && n.id !== drag.sourceId
                  ? targetClasses?.get(n.id)?.targetClass ?? "invalid"
                  : null;
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x},${p.y})`}
                  style={{ cursor: "pointer", opacity: targetClass === "invalid" ? 0.3 : 1 }}
                  data-target-class={targetClass ?? undefined}
                  onPointerUp={(e) => dropOn(n.id, e)}
                  onClick={() => {
                    setSelectedEdgeId(null);
                    setInspectedAssetId(n.id);
                    setInspectorOpen(true);
                    onSelectAsset(n.id);
                  }}
                  onDoubleClick={() => focusOn(n.id)}
                  data-testid={`asset-graph-node-${n.id}`}
                >
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
                  {stubs.map((s, i) => (
                    <g
                      key={s.layer}
                      transform={`translate(${NODE_RADIUS + 6},${-NODE_RADIUS + 4 + i * 18})`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        showLayer(s.layer);
                      }}
                      data-testid={`asset-graph-stub-${n.id}-${s.layer}`}
                    >
                      <title>{t("tabs.dfd.assetGraph.stubHint", { defaultValue: "Show layer" })}</title>
                      <rect height={15} width={30 + (String(s.count).length + groupLabel(s.layer).length) * 6.2} rx={7} fill={groupColor(s.layer).colorLight} stroke={groupColor(s.layer).color} />
                      <text x={6} y={11} fontSize={10} fill="#333">{`${s.count} → ${groupLabel(s.layer)}`}</text>
                    </g>
                  ))}
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
            rightInset={rightInset}
            onDeleteLink={editing ? deleteLink : undefined}
            onUpdateLink={editing ? updateLink : undefined}
            onDeleteAsset={editing && onDeleteAsset ? (id) => setConfirmDeleteId(id) : undefined}
            onClose={() => {
              setInspectorOpen(false);
              setSelectedEdgeId(null);
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
          </Box>
        )}
      </Box>
    </Box>
  );
};
