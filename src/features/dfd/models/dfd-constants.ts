// ==================== DFD CONSTANTS ====================
// Configuration constants for DFD elements.
// NO types here — only constant data.
// NO human-readable text here — every display string goes through i18n.
// This file holds only language-free data: icons and i18n key references.

import type {
  ExposureLevel,
  PhysicalExposureLevel,
} from "./element-shared-types";
import type { DFDElementType } from "./dfd-element-types";

// ==================== DFD ELEMENT ICONS ====================
// Icons only (language-neutral glyphs). Names / plurals / descriptions live in
// i18n under `tabs.dfd.elementTypes.<Type>.{name,plural,description}` and are
// resolved via dfd-formatters (getDFDElementTypeText / …PluralText / …DescriptionText).

export const DFD_ELEMENT_CONFIG: Record<
  DFDElementType,
  { name: string; icon: string }
> = {
  ExternalEntity: {
    name: "tabs.dfd.elementTypes.ExternalEntity.name",
    icon: "▭",
  },
  Process: { name: "tabs.dfd.elementTypes.Process.name", icon: "○" },
  Multiprocess: { name: "tabs.dfd.elementTypes.Multiprocess.name", icon: "◎" },
  DataStore: { name: "tabs.dfd.elementTypes.DataStore.name", icon: "═" },
  DataFlow: { name: "tabs.dfd.elementTypes.DataFlow.name", icon: "→" },
  TrustBoundary: {
    name: "tabs.dfd.elementTypes.TrustBoundary.name",
    icon: "┌",
  },
  Interface: { name: "tabs.dfd.elementTypes.Interface.name", icon: "▢" },
  ChipBoundary: { name: "tabs.dfd.elementTypes.ChipBoundary.name", icon: "⬡" },
  PhysicalBoundary: {
    name: "tabs.dfd.elementTypes.PhysicalBoundary.name",
    icon: "⬜",
  },
  Sensor: { name: "tabs.dfd.elementTypes.Sensor.name", icon: "⬢" },
  Actuator: { name: "tabs.dfd.elementTypes.Actuator.name", icon: "⏢" },
};

// ==================== EXPOSURE LEVEL (EL) i18n KEYS ====================
// Network exposure. Label + description both resolved via i18n (no literal text).

export const EXPOSURE_LEVEL_LABEL_KEYS: Record<ExposureLevel, string> = {
  EL0: "tabs.dfd.element_description.exposure_level.el0_label",
  EL1: "tabs.dfd.element_description.exposure_level.el1_label",
  EL2: "tabs.dfd.element_description.exposure_level.el2_label",
  EL3: "tabs.dfd.element_description.exposure_level.el3_label",
  EL4: "tabs.dfd.element_description.exposure_level.el4_label",
};

export const EXPOSURE_LEVEL_DESCRIPTION_KEYS: Record<ExposureLevel, string> = {
  EL0: "tabs.dfd.element_description.exposure_level.el0_description",
  EL1: "tabs.dfd.element_description.exposure_level.el1_description",
  EL2: "tabs.dfd.element_description.exposure_level.el2_description",
  EL3: "tabs.dfd.element_description.exposure_level.el3_description",
  EL4: "tabs.dfd.element_description.exposure_level.el4_description",
};

// ── Physical Exposure Level (PEL) i18n keys ───────────────────────────────────
// Separate from EL — PEL describes physical reachability, not network exposure.

export const PHYSICAL_EXPOSURE_LEVEL_LABEL_KEYS: Record<
  PhysicalExposureLevel,
  string
> = {
  PEL0: "tabs.dfd.element_description.physical_exposure_level.pel0_label",
  PEL1: "tabs.dfd.element_description.physical_exposure_level.pel1_label",
  PEL2: "tabs.dfd.element_description.physical_exposure_level.pel2_label",
  PEL3: "tabs.dfd.element_description.physical_exposure_level.pel3_label",
  PEL4: "tabs.dfd.element_description.physical_exposure_level.pel4_label",
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