// ==================== DFD CONSTANTS ====================
// Configuration constants for DFD elements
// NO types here - only constant data

import type {
  ExposureLevel,
  PhysicalExposureLevel,
} from "./element-properties";
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
  ChipBoundary: {
    name: "Chip Boundary",
    nameDE: "Chip Boundary",
    description: "Hardware chip boundary — MCU, SOM, FPGA, SE, HSM, DSP",
    icon: "⬡",
  },
  PhysicalBoundary: {
    name: "Physical Boundary",
    nameDE: "Physische Grenze",
    description:
      "Spatial physical access barrier — enclosure, cabinet, room, building",
    icon: "⬜",
  },
};

export const EXPOSURE_LEVEL_LABELS: Record<ExposureLevel, string> = {
  EL0: "EL0 – Internal",
  EL1: "EL1 – Physical",
  EL2: "EL2 – Local",
  EL3: "EL3 – Adjacent",
  EL4: "EL4 – Public",
};

export const EXPOSURE_LEVEL_DESCRIPTION_KEYS: Record<ExposureLevel, string> = {
  EL0: "tabs.dfd.element_description.exposure_level.el0_description",
  EL1: "tabs.dfd.element_description.exposure_level.el1_description",
  EL2: "tabs.dfd.element_description.exposure_level.el2_description",
  EL3: "tabs.dfd.element_description.exposure_level.el3_description",
  EL4: "tabs.dfd.element_description.exposure_level.el4_description",
};

// ── Physical Exposure Level (PEL) labels ──────────────────────────────────────
// Separate from EL — PEL describes physical reachability, not network exposure.

export const PHYSICAL_EXPOSURE_LEVEL_LABELS: Record<
  PhysicalExposureLevel,
  string
> = {
  PEL0: "PEL0 – Inaccessible", // No access without physical destruction
  PEL1: "PEL1 – Deep Internal", // Multiple physical barriers
  PEL2: "PEL2 – Internal", // One barrier (enclosure, lock)
  PEL3: "PEL3 – Protected", // External but behind a barrier
  PEL4: "PEL4 – Exposed", // Directly reachable — no barrier
};

export const PHYSICAL_EXPOSURE_LEVEL_DESCRIPTION_KEYS: Record<
  PhysicalExposureLevel,
  string
> = {
  PEL0: "tabs.dfd.element_description.physical_exposure_level.pel0_description",
  PEL1: "tabs.dfd.element_description.physical_exposure_level.pel1_description",
  PEL2: "tabs.dfd.element_description.physical_exposure_level.pel2_description",
  PEL3: "tabs.dfd.element_description.physical_exposure_level.pel3_description",
  PEL4: "tabs.dfd.element_description.physical_exposure_level.pel4_description",
};