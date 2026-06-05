// ==================== CLOUD ELEMENT TEMPLATES INDEX ====================
import spoofing from "./threats-spoofing.json";
import tampering from "./threats-tampering.json";
import repudiation from "./threats-repudiation.json";
import information from "./threats-information.json";
import denial from "./threats-denial.json";
import elevation from "./threats-elevation.json";

export const CLOUD_ELEMENT_TEMPLATES = [
  ...((spoofing as any).elementTemplates ?? []),
  ...((tampering as any).elementTemplates ?? []),
  ...((repudiation as any).elementTemplates ?? []),
  ...((information as any).elementTemplates ?? []),
  ...((denial as any).elementTemplates ?? []),
  ...((elevation as any).elementTemplates ?? []),
];