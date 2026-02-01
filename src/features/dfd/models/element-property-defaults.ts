// ==================== ELEMENT PROPERTY DEFAULTS ====================
// Default values and heuristics for element properties
// Used by forms to auto-populate fields based on selections

import type { ProcessProperties, ExternalEntityProperties } from "./element-properties";

// ==================== PROCESS DEFAULTS ====================

/**
 * Default properties based on Process.runsAs selection
 */
export const PROCESS_RUNSAS_DEFAULTS: Record<string, Partial<ProcessProperties>> = {
  user: { privilegeLevel: "low", authenticationRequired: "optional" },
  admin_user: { privilegeLevel: "medium", authenticationRequired: "yes" },
  root: { privilegeLevel: "root", authenticationRequired: "yes" },
  system: { privilegeLevel: "high", authenticationRequired: "yes" },
  service: { privilegeLevel: "medium", authenticationRequired: "yes" },
  guest: { privilegeLevel: "low", authenticationRequired: "no" },
  anonymous: { privilegeLevel: "low", authenticationRequired: "no" },
  contractor: { privilegeLevel: "medium", authenticationRequired: "yes" },
};

/**
 * Default properties based on Process.technology selection
 */
export const PROCESS_TECH_DEFAULTS: Record<
  NonNullable<ProcessProperties["technology"]>,
  Partial<ProcessProperties>
> = {
  api: {
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  ui: {
    authenticationRequired: "yes",
    authorizationModel: "rbac",
    inputValidation: "basic",
    errorHandling: "sanitized",
  },
  microservice: {
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  batch: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  lambda: {
    authenticationRequired: "oauth",
    authorizationModel: "custom",
    inputValidation: "schema",
    errorHandling: "sanitized",
  },
  daemon: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "silent",
  },
  websocket: {
    authenticationRequired: "oauth",
    authorizationModel: "rbac",
    inputValidation: "strict",
    errorHandling: "sanitized",
  },
  event: {
    authenticationRequired: "oauth",
    authorizationModel: "custom",
    inputValidation: "none",
    errorHandling: "silent",
  },
  cli: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "basic",
    errorHandling: "verbose",
  },
  database: {
    authenticationRequired: "certificate",
    authorizationModel: "acl",
    inputValidation: "strict",
    errorHandling: "silent",
  },
  cron: {
    authenticationRequired: "no",
    authorizationModel: "none",
    inputValidation: "none",
    errorHandling: "silent",
  },
  iot: {
    authenticationRequired: "certificate",
    authorizationModel: "custom",
    inputValidation: "strict",
    errorHandling: "sanitized",
  },
};

// ==================== EXTERNAL ENTITY DEFAULTS ====================

/**
 * Default properties based on ExternalEntity.entityType selection
 */
export const EXTERNAL_ENTITY_TYPE_DEFAULTS: Record<
  string,
  Partial<ExternalEntityProperties>
> = {
  user: {
    trustLevel: "low",
    authenticationMethod: "password",
    threatActor: "curious",
  },
  admin_user: {
    trustLevel: "medium",
    authenticationMethod: "mfa",
    threatActor: "insider",
  },
  partner: {}, // No defaults
  thirdparty: {}, // No defaults
  service: {}, // No defaults
  identity_provider: {
    trustLevel: "high",
    authenticationMethod: "saml",
    threatActor: "advanced",
  },
  payment: {
    trustLevel: "medium",
    authenticationMethod: "certificate",
    threatActor: "malicious",
  },
  contractor: {}, // No defaults
  bot: {
    trustLevel: "low",
    authenticationMethod: "apikey",
    threatActor: "compromised",
  },
  webhook: {
    trustLevel: "low",
    authenticationMethod: "none",
    threatActor: "malicious",
  },
  mobile_app: {}, // No defaults
  iot: {
    trustLevel: "low",
    authenticationMethod: "certificate",
    threatActor: "compromised",
  },
};

// ==================== PROCESS PROPERTY HELPERS ====================

/**
 * Get default properties for a Process based on runsAs or technology change
 */
export function getProcessDefaults(
  current: ProcessProperties,
  updates: Partial<ProcessProperties>,
): ProcessProperties {
  let next: ProcessProperties = { ...current, ...updates };

  // Determine Defaults for runsAs or technology
  const defaults =
    (updates.runsAs && PROCESS_RUNSAS_DEFAULTS[updates.runsAs]) ||
    (updates.technology && PROCESS_TECH_DEFAULTS[updates.technology]) ||
    {};

  // Merge Defaults - only apply if field is not explicitly set in updates
  Object.entries(defaults).forEach(([key, value]) => {
    if (!(key in updates)) {
      next[key as keyof ProcessProperties] = value as any;
    }
  });

  return next;
}

/**
 * Enforce security constraints for Process properties
 * - No auth → no authorization
 * - Authorization requires authentication
 */
export function enforceProcessSecurityConstraints(
  props: ProcessProperties,
): ProcessProperties {
  const next = { ...props };

  // No auth → no authorization
  if (next.authenticationRequired === "no") {
    next.authorizationModel = "none";
  }

  // Authorization without auth is invalid
  if (
    next.authorizationModel &&
    next.authorizationModel !== "none" &&
    next.authenticationRequired === "no"
  ) {
    next.authorizationModel = "none";
  }

  return next;
}

/**
 * Enforce internet exposure security rules
 * - Exposed to internet requires stricter security
 */
export function enforceInternetExposureRules(
  props: ProcessProperties,
): ProcessProperties {
  if (!props.exposedToInternet) return props;

  return {
    ...props,
    authenticationRequired:
      props.authenticationRequired === "no"
        ? "yes"
        : props.authenticationRequired,
    inputValidation: props.inputValidation ?? "strict",
    errorHandling: props.errorHandling ?? "sanitized",
  };
}

/**
 * Normalize Process properties by applying all defaults and constraints
 */
export function normalizeProcessProperties(
  props: ProcessProperties,
): ProcessProperties {
  let next = { ...props };

  next = getProcessDefaults(next, {
    technology: next.technology,
    runsAs: next.runsAs,
  });

  next = enforceProcessSecurityConstraints(next);
  next = enforceInternetExposureRules(next);

  return next;
}

/**
 * Update Process properties with new values, applying defaults and constraints
 */
export function updateProcessProperties(
  current: ProcessProperties,
  updates: Partial<ProcessProperties>,
): ProcessProperties {
  const merged = { ...current, ...updates };
  return normalizeProcessProperties(merged);
}

// ==================== EXTERNAL ENTITY PROPERTY HELPERS ====================

/**
 * Apply default properties for ExternalEntity based on entityType
 * Only applies defaults for fields that are currently empty
 */
export function applyExternalEntityTypeDefaults(
  entityType: string,
  current: ExternalEntityProperties,
): Partial<ExternalEntityProperties> {
  const defaults = EXTERNAL_ENTITY_TYPE_DEFAULTS[entityType];
  if (!defaults) return {};

  return Object.fromEntries(
    Object.entries(defaults).filter(
      ([key, value]) =>
        current[key as keyof ExternalEntityProperties] == null &&
        value !== undefined,
    ),
  ) as Partial<ExternalEntityProperties>;
}