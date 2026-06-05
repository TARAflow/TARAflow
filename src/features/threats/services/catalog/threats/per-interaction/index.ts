
// ==================== PER-INTERACTION TEMPLATES INDEX ====================
// Aggregates all domain-specific interaction threat templates.
// Shared templates (interface, physical) are in ../shared/index.
 
import { GENERAL_INTERACTION_TEMPLATES } from "./general/index";
import { EMBEDDED_INTERACTION_TEMPLATES } from "./embedded/index";
import { CLOUD_INTERACTION_TEMPLATES } from "./cloud/index";
 
export const PER_INTERACTION_DOMAIN_TEMPLATES = [
  ...GENERAL_INTERACTION_TEMPLATES,
  ...EMBEDDED_INTERACTION_TEMPLATES,
  ...CLOUD_INTERACTION_TEMPLATES,
];