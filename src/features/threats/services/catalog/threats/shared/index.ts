// ==================== SHARED THREAT TEMPLATES INDEX ====================
// Method-agnostic templates: Interface, PhysicalBoundary, gap detection.
// Loaded in both per-element and per-interaction generators.

import threatsGap from "./threats-gap.json";
import threatsInterface from "./threats-interface.json";
import threatsPhysical from "./threats-physical.json";

export const SHARED_ELEMENT_TEMPLATES = [
  ...((threatsGap as any).elementTemplates ?? []),
  ...((threatsInterface as any).elementTemplates ?? []),
  ...((threatsPhysical as any).elementTemplates ?? []),
];

export const SHARED_INTERACTION_TEMPLATES = [
  ...((threatsInterface as any).interactionTemplates ?? []),
  ...((threatsPhysical as any).interactionTemplates ?? []),
];