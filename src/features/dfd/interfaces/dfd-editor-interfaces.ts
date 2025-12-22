// ==================== DFD EDITOR INTERFACES ====================
// Dependency Inversion: Define abstractions that the hook depends on
// These interfaces enable testing and swapping implementations

import { DFDProjectData, DFDStats, DFDData } from "../models/dfd-types";
import { ValidationResult } from "../services/dfd-validator";
import type { PhaseStatusMap } from "shared";

// ==================== XML SOURCE INTERFACE ====================
// Strategy Pattern: Different ways to retrieve XML from Draw.io

/**
 * Interface for XML retrieval strategies
 * Implementations can get XML from different sources (controller, localStorage, etc.)
 */
export interface IXmlSource {
  /** Unique identifier for this source */
  readonly name: string;
  /** Priority for source selection (higher = try first) */
  readonly priority: number;
  /** Check if this source is currently available */
  isAvailable(): boolean;
  /** Get XML from this source, returns null if not found */
  getXml(): string | null;
}

// ==================== XML SOURCE MANAGER INTERFACE ====================

/**
 * Manages multiple XML sources and retrieves from the best available
 */
export interface IXmlSourceManager {
  /** Register a new XML source */
  registerSource(source: IXmlSource): void;
  /** Remove a source by name */
  removeSource(name: string): void;
  /** Get XML from the highest priority available source */
  getXml(): string | null;
  /** Get the name of the source that provided the XML */
  getActiveSourceName(): string | null;
}

// ==================== DRAWIO BRIDGE INTERFACE ====================

/**
 * Interface for Draw.io iframe communication
 * Abstracts the postMessage API
 */
export interface IDrawioBridge {
  /** Check if the bridge is ready (iframe loaded) */
  isReady(): boolean;
  /** Send an action to Draw.io (zoom, undo, redo, etc.) */
  sendAction(action: string): void;
  /** Load XML into Draw.io */
  loadXml(xml: string): Promise<void>;
  /** Export diagram as image */
  exportImage(): void;
  /** Set callback for when image export is ready */
  onImageReady(callback: (imageSrc: string) => void): void;
  /** Set callback for diagram changes */
  onDiagramChange(callback: () => void): void;
  /** Get current XML from controller (if available) */
  getCurrentXml(): string | null;
  /** Cleanup resources */
  dispose(): void;
}

// ==================== AUTO NUMBERING INTERFACE ====================

/**
 * Interface for auto-numbering service
 */
export interface IAutoNumbering {
  /** Apply auto-numbering to XML, returns modified XML */
  autoNumber(xml: string): string;
}

// ==================== DFD SERVICE INTERFACE ====================

/**
 * Interface for DFD business logic service
 */
export interface IDFDService {
  /** Load DFD data for editing */
  loadDFDForEditing(project: DFDProjectData): {
    success: boolean;
    hasData: boolean;
    stats?: DFDStats;
    error?: string;
  };
  /** Save DFD data */
  saveDFD(project: DFDProjectData): {
    success: boolean;
    dfd: DFDData;
    phaseStatus: PhaseStatusMap;
    lastModified: string;
    validation: ValidationResult;
    error?: string;
  };
  /** Validate current state without saving */
  validateCurrentState(projectId: string): ValidationResult;
  /** Get current stats */
  getCurrentStats(projectId: string): DFDStats;
  /** Clear data for project switch */
  clearForProjectSwitch(projectId: string): void;
}

// ==================== STORAGE ADAPTER INTERFACE ====================

/**
 * Interface for DFD storage operations
 */
export interface IDFDStorageAdapter {
  /** Sync from legacy localStorage keys */
  syncFromLegacy(): void;
  /** Get XML from storage */
  getXml(): string | null;
  /** Load DFD data to localStorage */
  loadToLocalStorage(dfd: DFDData | null): void;
  /** Clear localStorage */
  clearLocalStorage(): void;
}

// ==================== FACTORY INTERFACES ====================

/**
 * Factory for creating Draw.io bridge instances
 */
export interface IDrawioBridgeFactory {
  create(
    iframe: HTMLIFrameElement,
    projectId: string,
    projectName: string
  ): IDrawioBridge;
}

/**
 * Factory for creating storage adapters
 */
export interface IStorageAdapterFactory {
  create(projectId: string): IDFDStorageAdapter;
}

// ==================== EDITOR STATE ====================

/**
 * Immutable state object for the DFD editor
 */
export interface DFDEditorState {
  readonly isLoading: boolean;
  readonly isDirty: boolean;
  readonly validation: ValidationResult | null;
  readonly stats: DFDStats | null;
  readonly previewImage: string | null;
  readonly isInitialized: boolean;
  readonly currentProjectId: string | null;
}

/**
 * Initial state factory
 */
export const createInitialEditorState = (): DFDEditorState => ({
  isLoading: true,
  isDirty: false,
  validation: null,
  stats: null,
  previewImage: null,
  isInitialized: false,
  currentProjectId: null,
});

// ==================== EDITOR ACTIONS ====================

/**
 * Action types for state reducer
 */
export type DFDEditorAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_VALIDATION'; payload: ValidationResult | null }
  | { type: 'SET_STATS'; payload: DFDStats | null }
  | { type: 'SET_PREVIEW_IMAGE'; payload: string | null }
  | { type: 'SET_INITIALIZED'; payload: { isInitialized: boolean; projectId: string | null } }
  | { type: 'RESET_FOR_PROJECT_CHANGE' }
  | { type: 'SAVE_SUCCESS'; payload: { validation: ValidationResult } }
  | { type: 'VALIDATION_COMPLETE'; payload: { validation: ValidationResult; stats: DFDStats } };

/**
 * Reducer for editor state
 */
export function dfdEditorReducer(
  state: DFDEditorState,
  action: DFDEditorAction
): DFDEditorState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_DIRTY':
      return { ...state, isDirty: action.payload };
    case 'SET_VALIDATION':
      return { ...state, validation: action.payload };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_PREVIEW_IMAGE':
      return { ...state, previewImage: action.payload };
    case 'SET_INITIALIZED':
      return {
        ...state,
        isInitialized: action.payload.isInitialized,
        currentProjectId: action.payload.projectId,
        isLoading: false,
        isDirty: false,
      };
    case 'RESET_FOR_PROJECT_CHANGE':
      return {
        ...createInitialEditorState(),
        isLoading: true,
      };
    case 'SAVE_SUCCESS':
      return {
        ...state,
        isDirty: false,
        validation: action.payload.validation,
      };
    case 'VALIDATION_COMPLETE':
      return {
        ...state,
        validation: action.payload.validation,
        stats: action.payload.stats,
      };
    default:
      return state;
  }
}