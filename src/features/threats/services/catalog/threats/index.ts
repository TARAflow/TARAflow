// ==================== THREAT TEMPLATES ROOT INDEX ====================
// Entry point for threat-catalog-service.ts.
// Combines shared, per-element and per-interaction templates.
 
import { SHARED_ELEMENT_TEMPLATES, SHARED_INTERACTION_TEMPLATES } from "./shared/index";
import { PER_ELEMENT_DOMAIN_TEMPLATES } from "./per-element/index";
import { PER_INTERACTION_DOMAIN_TEMPLATES } from "./per-interaction/index";
 
export const ALL_ELEMENT_TEMPLATES = [
  ...SHARED_ELEMENT_TEMPLATES,
  ...PER_ELEMENT_DOMAIN_TEMPLATES,
];
 
export const ALL_INTERACTION_TEMPLATES = [
  ...SHARED_INTERACTION_TEMPLATES,
  ...PER_INTERACTION_DOMAIN_TEMPLATES,
];