// ==================== DRAWIO TYPES ====================
// Shared types for draw.io communication.
// No dependencies on other TARAflow modules — safe to import anywhere.

export interface DrawioViewport {
  translate: { x: number; y: number };
  scale: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface DrawioExportResult {
  xml: string;
  translate: { x: number; y: number };
  scale: number;
  scrollLeft: number;
  scrollTop: number;
}