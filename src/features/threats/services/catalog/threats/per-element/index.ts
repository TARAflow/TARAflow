
// ==================== PER-ELEMENT TEMPLATES INDEX ====================
// Aggregates all domain-specific element threat templates.
// Shared templates (interface, physical, gap) are in ../shared/index.
 
import { GENERAL_ELEMENT_TEMPLATES } from "./general/index";
import { EMBEDDED_ELEMENT_TEMPLATES } from "./embedded/index";
import { CLOUD_ELEMENT_TEMPLATES } from "./cloud/index";
import { MOBILE_ELEMENT_TEMPLATES } from "./mobile/index";
 
export const PER_ELEMENT_DOMAIN_TEMPLATES = [
  ...GENERAL_ELEMENT_TEMPLATES,
  ...EMBEDDED_ELEMENT_TEMPLATES,
  ...CLOUD_ELEMENT_TEMPLATES,
  ...MOBILE_ELEMENT_TEMPLATES,
];