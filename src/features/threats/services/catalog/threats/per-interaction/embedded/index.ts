// ==================== EMBEDDED INTERACTION TEMPLATES INDEX ====================
import spoofing from "./threats-spoofing.json";
import tampering from "./threats-tampering.json";
import repudiation from "./threats-repudiation.json";
import information from "./threats-information.json";
import denial from "./threats-denial.json";
import elevation from "./threats-elevation.json";

export const EMBEDDED_INTERACTION_TEMPLATES = [
  ...((spoofing as any).interactionTemplates ?? []),
  ...((tampering as any).interactionTemplates ?? []),
  ...((repudiation as any).interactionTemplates ?? []),
  ...((information as any).interactionTemplates ?? []),
  ...((denial as any).interactionTemplates ?? []),
  ...((elevation as any).interactionTemplates ?? []),
];