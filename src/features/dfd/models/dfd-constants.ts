// ==================== DFD CONSTANTS ====================
// Configuration constants for DFD elements
// NO types here - only constant data

import type { DFDElementType } from "./dfd-element-types";

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
