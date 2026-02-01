// ==================== DFD GRAPH TYPES ====================
// Analysis-only graph model derived from DFDData
// Optimized for fast threat table generation

import type {
  DFDElement,
  DFDConnection,
  DFDAsset,
  DFDElementType,
} from "./dfd-types";

// ==================== GRAPH ROOT ====================

export interface DFDGraph {
  /** Fast lookup */
  elementsById: Map<string, DFDElement>;
  connectionsById: Map<string, DFDConnection>;
  assetsById: Map<string, DFDAsset>;

  /** Graph topology */
  outgoingConnections: Map<string, string[]>; // elementId -> connectionIds
  incomingConnections: Map<string, string[]>; // elementId -> connectionIds

  /** TrustBoundary relations */
  elementTrustBoundaries: Map<string, string[]>; // elementId -> trustBoundaryIds
  trustBoundaryElements: Map<string, string[]>; // trustBoundaryId -> elementIds

  /** DataFlow semantic analysis */
  dataFlowAnalysis: Map<string, DataFlowAnalysis>;

  /** TrustBoundary hierarchy */
  trustBoundaryHierarchy: Map<string, TrustBoundaryAnalysis>;

  /** The "effective" TrustBoundary of each element (deepest nested) */
  effectiveElementTrustBoundary: Map<string, string | undefined>;
}

// ==================== DATA FLOW ANALYSIS ====================

export interface DataFlowAnalysis {
  /** Connection ID (from draw.io / internal ID) */
  connectionId: string;

  /** Source / target element IDs */
  fromElementId: string;
  toElementId: string;

  /** Element types for easier threat rules */
  fromElementType: DFDElementType;
  toElementType: DFDElementType;

  /** TrustBoundaries each element is in (all containing TBs) */
  fromTrustBoundaryIds: string[];
  toTrustBoundaryIds: string[];

  /** Flags for crossing TBs */
  crossesTrustBoundary: boolean;
  crossesMultipleTrustBoundaries: boolean;

  /** Optional: effective TB of source/target */
  fromEffectiveTrustBoundary?: string;
  toEffectiveTrustBoundary?: string;

  /** Optional: indicates whether flow passes through an Interface */
  viaInterface?: boolean;

  /** Optional: lateral/inbound/outbound/etc. */
  crossingType?: "none" | "inbound" | "outbound" | "lateral";
}

// ==================== INTERNAL HELPERS ====================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TrustBoundaryAnalysis {
  trustBoundaryId: string;
  parentTrustBoundaryId?: string;
  depth: number; // 0 = outermost
}
