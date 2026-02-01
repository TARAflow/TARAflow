// ==================== DFD STORAGE ADAPTER ====================
// Single Responsibility: Sync between Project JSON and localStorage for DrawIO

import { DFDData } from "../models/dfd-types";
// import { Project } from "../types/project-types";

/**
 * Storage key configuration
 */
export const DFD_STORAGE_KEYS = {
  // Project-specific keys
  getDrawioMsg: (projectId: string) => `project:${projectId}:DrawioMsg`,
  getOverviewTable: (projectId: string) => `project:${projectId}:OverviewTable`,
  getThreatTables: (projectId: string) => `project:${projectId}:ThreatTables`,
  
  // Legacy keys (used by existing DrawioController)
  LEGACY_DRAWIO_MSG: 'DrawioMsg',
  LEGACY_OVERVIEW_TABLE: 'OverviewTable',
  LEGACY_THREAT_TABLES: 'ThreatTables',
} as const;

/**
 * DFDStorageAdapter - Bridges Project JSON with DrawIO's localStorage
 * 
 * Single Responsibility: Only handles sync between storage layers
 * 
 * Flow:
 * 1. Project opens → loadToLocalStorage() → DrawIO can read from localStorage
 * 2. DrawIO saves → localStorage changes → syncFromLocalStorage() → get XML
 * 3. Project saves → getXml() → saved to Project.dfd.xml
 */
export class DFDStorageAdapter {
  private readonly projectId: string;
  private readonly keys: {
    drawioMsg: string;
    overviewTable: string;
    threatTables: string;
  };

  constructor(projectId: string) {
    this.projectId = projectId;
    this.keys = {
      drawioMsg: DFD_STORAGE_KEYS.getDrawioMsg(projectId),
      overviewTable: DFD_STORAGE_KEYS.getOverviewTable(projectId),
      threatTables: DFD_STORAGE_KEYS.getThreatTables(projectId),
    };
  }

  // ==================== LOAD: Project → localStorage ====================

  /**
   * Load DFD data from project into localStorage
   * Called when opening a project
   */
  loadToLocalStorage(dfd: DFDData | null): void {
    this.clearLocalStorage();

    if (!dfd || !dfd.xml) {
      DFDStorageAdapter.clearLegacyStorage();
    }

    if (dfd?.xml) {
      const drawioMsg = JSON.stringify({ xml: dfd.xml });
      localStorage.setItem(this.keys.drawioMsg, drawioMsg);
      localStorage.setItem(DFD_STORAGE_KEYS.LEGACY_DRAWIO_MSG, drawioMsg);
    }
  }

  // ==================== SYNC: localStorage → Project ====================

  /**
   * Get current XML from localStorage
   * Called when saving project
   */
  getXml(): string | null {
    // Try project-specific key first
    let drawioMsg = localStorage.getItem(this.keys.drawioMsg);
    
    // Fallback to legacy key
    if (!drawioMsg) {
      drawioMsg = localStorage.getItem(DFD_STORAGE_KEYS.LEGACY_DRAWIO_MSG);
    }

    if (!drawioMsg) return null;

    try {
      const parsed = JSON.parse(drawioMsg);
      return parsed.xml || null;
    } catch {
      return null;
    }
  }

  /**
   * Sync from legacy keys to project-specific keys
   * Called after DrawIO makes changes
   */
  syncFromLegacy(): void {
    const legacyMsg = localStorage.getItem(DFD_STORAGE_KEYS.LEGACY_DRAWIO_MSG);
    if (legacyMsg) {
      localStorage.setItem(this.keys.drawioMsg, legacyMsg);
    }

    const legacyOverview = localStorage.getItem(DFD_STORAGE_KEYS.LEGACY_OVERVIEW_TABLE);
    if (legacyOverview) {
      localStorage.setItem(this.keys.overviewTable, legacyOverview);
    }

    const legacyThreats = localStorage.getItem(DFD_STORAGE_KEYS.LEGACY_THREAT_TABLES);
    if (legacyThreats) {
      localStorage.setItem(this.keys.threatTables, legacyThreats);
    }
  }

  // ==================== OVERVIEW & THREAT TABLES ====================

  getOverviewTable(): unknown[] {
    const data = localStorage.getItem(this.keys.overviewTable) 
      || localStorage.getItem(DFD_STORAGE_KEYS.LEGACY_OVERVIEW_TABLE);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  getThreatTables(): unknown[][] {
    const data = localStorage.getItem(this.keys.threatTables)
      || localStorage.getItem(DFD_STORAGE_KEYS.LEGACY_THREAT_TABLES);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveOverviewTable(data: unknown[]): void {
    const json = JSON.stringify(data);
    localStorage.setItem(this.keys.overviewTable, json);
    localStorage.setItem(DFD_STORAGE_KEYS.LEGACY_OVERVIEW_TABLE, json);
  }

  saveThreatTables(data: unknown[][]): void {
    const json = JSON.stringify(data);
    localStorage.setItem(this.keys.threatTables, json);
    localStorage.setItem(DFD_STORAGE_KEYS.LEGACY_THREAT_TABLES, json);
  }

  // ==================== CLEANUP ====================

  /**
   * Clear project-specific localStorage entries
   */
  clearLocalStorage(): void {
    localStorage.removeItem(this.keys.drawioMsg);
    localStorage.removeItem(this.keys.overviewTable);
    localStorage.removeItem(this.keys.threatTables);
  }

  /**
   * Clear legacy keys (call when switching projects)
   */
  static clearLegacyStorage(): void {
    localStorage.removeItem(DFD_STORAGE_KEYS.LEGACY_DRAWIO_MSG);
    localStorage.removeItem(DFD_STORAGE_KEYS.LEGACY_OVERVIEW_TABLE);
    localStorage.removeItem(DFD_STORAGE_KEYS.LEGACY_THREAT_TABLES);
  }
}

// ==================== FACTORY ====================

export function createDFDStorageAdapter(projectId: string): DFDStorageAdapter {
  return new DFDStorageAdapter(projectId);
}