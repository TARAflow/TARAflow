export interface DFDAnalysisContext {
  // Elements
  isDummy(): boolean; 
  
  getElement(id: string): {
    id: string;
    type: string;
    name: string;
    displayId: string;
  } | undefined;

  // Data flows
  getDataFlows(): Iterable<{
    connectionId: string;
    fromElementId: string;
    toElementId: string;
    fromElementType: string;
    toElementType: string;
    fromTrustBoundaryIds: string[];
    toTrustBoundaryIds: string[];
    fromEffectiveTrustBoundary?: string | null;
    toEffectiveTrustBoundary?: string | null;
    crossesTrustBoundary: boolean;
    crossesMultipleTrustBoundaries: boolean;
    viaInterface: boolean;
    crossingType: "none" | "inbound" | "outbound" | "lateral";
  }>;

  // Trust boundaries
  getTrustBoundaries(): Iterable<{
    id: string;
    name: string;
    displayId: string;
  }>;

  getEffectiveTrustBoundary(elementId: string): string | undefined;
}
