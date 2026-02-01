// ==================== DFD CONSTANTS ====================
// Configuration constants for DFD elements and assets
// NO types here - only constant data

import type { DFDElementType, AssetRelationType } from "./dfd-types";

// ==================== DFD ELEMENT CONFIGURATION ====================

/**
 * Configuration for each DFD element type
 * - English/German names
 * - Description
 * - Icon character
 */
export const DFD_ELEMENT_CONFIG: Record<
  DFDElementType,
  {
    name: string;
    nameDE: string;
    description: string;
    icon: string;
  }
> = {
  ExternalEntity: {
    name: "External Entity",
    nameDE: "Externe Entität",
    description: "User, external system or device",
    icon: "▭",
  },
  Process: {
    name: "Process",
    nameDE: "Prozess",
    description: "Processes or transforms data",
    icon: "○",
  },
  Multiprocess: {
    name: "Multiprocess",
    nameDE: "Multiprozess",
    description: "Multiple instances of a process",
    icon: "◎",
  },
  DataStore: {
    name: "Data Store",
    nameDE: "Datenspeicher",
    description: "Database, file or registry",
    icon: "═",
  },
  DataFlow: {
    name: "Data Flow",
    nameDE: "Datenfluss",
    description: "Data transfer between elements",
    icon: "→",
  },
  TrustBoundary: {
    name: "Trust Boundary",
    nameDE: "Trust Boundary",
    description: "Boundary between trust zones",
    icon: "┌",
  },
  Interface: {
    name: "Interface",
    nameDE: "Schnittstelle",
    description: "Physical/logical interface (USB, UART, Ethernet, etc.)",
    icon: "▢",
  },
};

// ==================== ASSET RELATION CONFIGURATION ====================

/**
 * Allowed asset relation types per DFD element type
 * Defines which relationship types each element can have with assets
 */
export const ALLOWED_ASSET_RELATIONS: Record<DFDElementType, AssetRelationType[]> = {
  Process: ["read", "modify", "creates", "deletes"],
  ExternalEntity: [],
  DataStore: ["stores","deletes"],
  DataFlow: ["transports"],
  Multiprocess: ["read", "modify", "creates", "deletes"],
  Interface: ["transports",  "stores"], // stores only if interface provides buffering/persistence
  TrustBoundary: [], // No asset relations for trust boundaries
};