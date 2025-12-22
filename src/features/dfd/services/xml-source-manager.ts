// ==================== XML SOURCE MANAGER ====================
// Strategy Pattern: Manages multiple XML sources with priority-based selection
// Single Responsibility: Only handles XML retrieval strategy selection

import { IXmlSource, IXmlSourceManager } from "../interfaces/dfd-editor-interfaces";

/**
 * XmlSourceManager - Manages multiple XML sources
 * 
 * Implements Strategy Pattern: Different sources can be registered,
 * and the manager selects the best available one based on priority.
 */
export class XmlSourceManager implements IXmlSourceManager {
  private sources: IXmlSource[] = [];
  private lastActiveSource: string | null = null;

  /**
   * Register a new XML source
   * Sources are automatically sorted by priority (descending)
   */
  registerSource(source: IXmlSource): void {
    // Remove existing source with same name
    this.removeSource(source.name);
    
    // Add and sort by priority (highest first)
    this.sources.push(source);
    this.sources.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a source by name
   */
  removeSource(name: string): void {
    this.sources = this.sources.filter(s => s.name !== name);
    if (this.lastActiveSource === name) {
      this.lastActiveSource = null;
    }
  }

  /**
   * Get XML from the highest priority available source
   */
  getXml(): string | null {
    for (const source of this.sources) {
      if (source.isAvailable()) {
        const xml = source.getXml();
        if (xml) {
          this.lastActiveSource = source.name;
          console.log(`[XmlSourceManager] Got XML from: ${source.name}`);
          return xml;
        }
      }
    }
    
    this.lastActiveSource = null;
    console.warn("[XmlSourceManager] No XML found in any source");
    return null;
  }

  /**
   * Get the name of the source that last provided XML
   */
  getActiveSourceName(): string | null {
    return this.lastActiveSource;
  }

  /**
   * Get list of registered source names (for debugging)
   */
  getRegisteredSources(): string[] {
    return this.sources.map(s => `${s.name} (priority: ${s.priority})`);
  }
}

// ==================== XML SOURCE IMPLEMENTATIONS ====================

/**
 * Controller-based XML source (highest priority)
 * Gets XML directly from DrawioController if available
 */
export class ControllerXmlSource implements IXmlSource {
  readonly name = "controller";
  readonly priority = 100;
  
  private getControllerXml: () => string | null;

  constructor(getControllerXml: () => string | null) {
    this.getControllerXml = getControllerXml;
  }

  isAvailable(): boolean {
    return true; // Always try, let getXml handle null
  }

  getXml(): string | null {
    return this.getControllerXml();
  }
}

/**
 * Project-specific localStorage source
 * Uses project ID in the storage key
 */
export class ProjectStorageXmlSource implements IXmlSource {
  readonly name = "projectStorage";
  readonly priority = 80;
  
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  isAvailable(): boolean {
    return Boolean(this.projectId);
  }

  getXml(): string | null {
    const key = `DrawioMsg_${this.projectId}`;
    const data = localStorage.getItem(key);
    
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      return parsed.xml || null;
    } catch (e) {
      console.error(`[ProjectStorageXmlSource] Failed to parse ${key}:`, e);
      return null;
    }
  }
}

/**
 * Legacy localStorage source (DrawioMsg)
 * Fallback for older data format
 */
export class LegacyStorageXmlSource implements IXmlSource {
  readonly name = "legacyStorage";
  readonly priority = 60;

  isAvailable(): boolean {
    return true;
  }

  getXml(): string | null {
    const data = localStorage.getItem("DrawioMsg");
    
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      return parsed.xml || null;
    } catch (e) {
      console.error("[LegacyStorageXmlSource] Failed to parse DrawioMsg:", e);
      return null;
    }
  }
}

/**
 * Dot-prefixed legacy localStorage source (.DrawioMsg)
 * Another legacy format fallback
 */
export class DotLegacyStorageXmlSource implements IXmlSource {
  readonly name = "dotLegacyStorage";
  readonly priority = 40;

  isAvailable(): boolean {
    return true;
  }

  getXml(): string | null {
    const data = localStorage.getItem(".DrawioMsg");
    
    if (!data) return null;
    
    try {
      const parsed = JSON.parse(data);
      return parsed.xml || null;
    } catch (e) {
      console.error("[DotLegacyStorageXmlSource] Failed to parse .DrawioMsg:", e);
      return null;
    }
  }
}

// ==================== FACTORY ====================

/**
 * Create a fully configured XmlSourceManager for a project
 */
export function createXmlSourceManager(
  projectId: string,
  getControllerXml?: () => string | null
): XmlSourceManager {
  const manager = new XmlSourceManager();
  
  // Register sources in order (priority handles actual order)
  if (getControllerXml) {
    manager.registerSource(new ControllerXmlSource(getControllerXml));
  }
  manager.registerSource(new ProjectStorageXmlSource(projectId));
  manager.registerSource(new LegacyStorageXmlSource());
  manager.registerSource(new DotLegacyStorageXmlSource());
  
  return manager;
}

export default XmlSourceManager;