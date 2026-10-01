// ==================== LIKELIHOOD FACTOR LEVELS ====================
//
// Level labels for the likelihood factors of the weighted-mean presets
// (risk-impact-aggregation design §7.4, Part B). Each level names the
// SITUATION it stands for — "No technical skills" instead of "High" — so the
// label reads in the direction the factor counts.
//
// Order: index 0 = value 1 = attack least likely … last = most likely. Stored
// values, the calculation and the matrix do not change; only labels do.
//
// One fitting label set per scale size (3, 4, 5 levels); a level key shared
// by several sizes has one text. i18n: risks.factorLevels.<factorId>.<key>,
// the English text below is the default (CLI, report, unlocalised builds).
//
// TVRA: the norm's level names (TVRA_FACTOR_LEVELS in etsi-tvra-core.ts),
// i18n risks.tvraLevels.<key> — see tvraLevelLabel().

import type { RiskScaleType } from "./risk-scale-types";
import { TVRA_FACTOR_LEVELS } from "./etsi-tvra-core";

type LevelSets = Record<RiskScaleType, readonly string[]>;

export const LIKELIHOOD_FACTOR_LEVELS: Record<string, LevelSets> = {
  skill_level: {
    "5-level": ["security_penetration", "network_programming", "advanced_user", "some_technical", "no_technical"],
    "4-level": ["security_penetration", "network_programming", "some_technical", "no_technical"],
    "3-level": ["expert", "some_technical", "no_technical"],
  },
  motive: {
    "5-level": ["no_reward", "low_reward", "possible_reward", "considerable_reward", "high_reward"],
    "4-level": ["no_reward", "low_reward", "possible_reward", "high_reward"],
    "3-level": ["low_or_no_reward", "possible_reward", "high_reward"],
  },
  opportunity: {
    "5-level": ["full_access", "special_access", "some_access", "little_access", "no_access"],
    "4-level": ["full_access", "special_access", "some_access", "no_access"],
    "3-level": ["special_or_full_access", "some_access", "no_access"],
  },
  size: {
    "5-level": ["developers_admins", "intranet_users", "partners", "authenticated_users", "anonymous_internet"],
    "4-level": ["developers_admins", "intranet_partners", "authenticated_users", "anonymous_internet"],
    "3-level": ["privileged_insiders", "authenticated_partners", "anonymous_internet"],
  },
  ease_of_discovery: {
    "5-level": ["practically_impossible", "difficult", "moderate", "easy", "automated_tools"],
    "4-level": ["practically_impossible", "difficult", "easy", "automated_tools"],
    "3-level": ["impossible_or_difficult", "easy", "automated_tools"],
  },
  ease_of_exploit: {
    "5-level": ["theoretical", "difficult", "moderate", "easy", "automated_tools"],
    "4-level": ["theoretical", "difficult", "easy", "automated_tools"],
    "3-level": ["theoretical_or_difficult", "easy", "automated_tools"],
  },
  awareness: {
    "5-level": ["unknown", "hidden", "specialists", "obvious", "public_knowledge"],
    "4-level": ["unknown", "hidden", "obvious", "public_knowledge"],
    "3-level": ["unknown_or_hidden", "obvious", "public_knowledge"],
  },
  intrusion_detection: {
    "5-level": ["active_detection", "logged_reviewed", "logged_occasionally", "logged_not_reviewed", "not_logged"],
    "4-level": ["active_detection", "logged_reviewed", "logged_not_reviewed", "not_logged"],
    "3-level": ["actively_detected", "logged", "not_logged"],
  },
  deployment_scope: {
    "5-level": ["single", "few_one_customer", "all_one_customer", "product_type", "supply_chain"],
    "4-level": ["single", "several_one_customer", "product_type", "supply_chain"],
    "3-level": ["single", "several_or_product_type", "supply_chain"],
  },
};

/** English default texts (= en locale). */
export const LIKELIHOOD_FACTOR_LEVEL_TEXT: Record<string, Record<string, string>> = {
  skill_level: {
    security_penetration: "Security penetration skills",
    network_programming: "Network and programming skills",
    advanced_user: "Advanced computer user",
    some_technical: "Some technical skills",
    no_technical: "No technical skills",
    expert: "Expert skills (penetration, programming)",
  },
  motive: {
    no_reward: "No reward",
    low_reward: "Low reward",
    possible_reward: "Possible reward",
    considerable_reward: "Considerable reward",
    high_reward: "High reward",
    low_or_no_reward: "Low or no reward",
  },
  opportunity: {
    full_access: "Full access or expensive resources",
    special_access: "Special access or resources",
    some_access: "Some access or resources",
    little_access: "Little access or resources",
    no_access: "No access or resources",
    special_or_full_access: "Special or full access, expensive resources",
  },
  size: {
    developers_admins: "Developers, system administrators",
    intranet_users: "Intranet users",
    partners: "Partners",
    authenticated_users: "Authenticated users",
    anonymous_internet: "Anonymous internet users",
    intranet_partners: "Intranet users, partners",
    privileged_insiders: "Privileged insiders (developers, administrators)",
    authenticated_partners: "Authenticated users, partners",
  },
  ease_of_discovery: {
    practically_impossible: "Practically impossible",
    difficult: "Difficult",
    moderate: "Moderate",
    easy: "Easy",
    automated_tools: "Automated tools available",
    impossible_or_difficult: "Practically impossible or difficult",
  },
  ease_of_exploit: {
    theoretical: "Theoretical",
    difficult: "Difficult",
    moderate: "Moderate",
    easy: "Easy",
    automated_tools: "Automated tools available",
    theoretical_or_difficult: "Theoretical or difficult",
  },
  awareness: {
    unknown: "Unknown",
    hidden: "Hidden",
    specialists: "Known to specialists",
    obvious: "Obvious",
    public_knowledge: "Public knowledge",
    unknown_or_hidden: "Unknown or hidden",
  },
  intrusion_detection: {
    active_detection: "Active detection in the application",
    logged_reviewed: "Logged and reviewed",
    logged_occasionally: "Logged, reviewed occasionally",
    logged_not_reviewed: "Logged, not reviewed",
    not_logged: "Not logged",
    actively_detected: "Actively detected",
    logged: "Logged",
  },
  deployment_scope: {
    single: "Single installation",
    few_one_customer: "A few installations of one customer",
    all_one_customer: "All systems of one customer",
    product_type: "All installations of a product type",
    supply_chain: "All customers (supply chain)",
    several_one_customer: "Several systems of one customer",
    several_or_product_type: "Several systems or a whole product type",
  },
};

/** Level keys of a factor for a scale size, or undefined (no own labels). */
export function likelihoodFactorLevels(
  factorId: string,
  scale: RiskScaleType,
): readonly string[] | undefined {
  return LIKELIHOOD_FACTOR_LEVELS[factorId]?.[scale];
}

/** English default text of a level. */
export function likelihoodFactorLevelText(factorId: string, key: string): string {
  return LIKELIHOOD_FACTOR_LEVEL_TEXT[factorId]?.[key] ?? key;
}

// -------------------- TVRA --------------------

/** English default texts of the TVRA level keys (ETSI TS 102 165-1). */
export const TVRA_LEVEL_TEXT: Record<string, string> = {
  "<=1day": "≤ 1 day",
  "<=1week": "≤ 1 week",
  "<=1month": "≤ 1 month",
  "<=6months": "≤ 6 months",
  ">6months": "> 6 months",
  layman: "Layman",
  proficient: "Proficient",
  expert: "Expert",
  "multiple-experts": "Multiple experts",
  public: "Public",
  restricted: "Restricted",
  sensitive: "Sensitive",
  critical: "Critical",
  unlimited: "Unlimited",
  easy: "Easy",
  moderate: "Moderate",
  difficult: "Difficult",
  standard: "Standard",
  specialized: "Specialized",
  bespoke: "Bespoke",
  "multiple-bespoke": "Multiple bespoke",
  single: "Single",
  "moderate-multiple": "Moderate (multiple)",
  "heavy-multiple": "Heavy (multiple)",
};

/** Level keys of a TVRA factor in the norm's table order, or undefined. */
export function tvraFactorLevels(factorId: string): readonly string[] | undefined {
  return (TVRA_FACTOR_LEVELS as Record<string, readonly string[]>)[factorId];
}
