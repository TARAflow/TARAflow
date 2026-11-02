// shared/models/property-visibility.ts
//
// Model coverage fields and when they are shown (model-coverage-implementation-
// plan.md §3, CM-4). One registry entry per field; every consumer — the DFD
// form, the compliance evaluator, threat generation, the closed loop and the
// report — asks the same predicate (R-3), so "shown when" has one truth.
//
//   R-1  every field starts at "not_specified"; a yes/no field is three-valued
//        (not_specified / yes / no) — an unfinished model never looks better
//        than a complete one
//   R-2  nothing is written on load: unset stays unset
//   R-3  one predicate per field, here (pure, shared: the evaluator may not
//        import features/dfd)
//   R-4  a hidden field is ignored everywhere but kept in the file (K-7):
//        readers get it as unset (readModelField, withoutHiddenFields); when
//        the driver changes back, the value returns
//
// The fields of stage 1 (§4.2) join the registry with CM-5 … CM-7. The
// guard test src/tests/unit/shared/models/property-visibility.guard.test.ts
// checks that no consumer reads a registered field around the predicate.
// Labels, help texts and values: dfd.json, tabs.dfd.modelFields.<property>
// (R-7); "not specified" uses the common key.

// ==================== CONTEXT ====================

/** What a predicate sees of an element or a flow. */
export interface VisibilityElement {
  id: string;
  /** Element type; flows are "DataFlow". */
  type: string;
  properties?: Readonly<Record<string, unknown>>;
}

/** A flow at the element and the element at its other end. */
export interface VisibilityLink {
  flow: VisibilityElement;
  /** Absent when the other end is not in the model (dangling flow). */
  other?: VisibilityElement;
}

export interface VisibilityContext {
  element: VisibilityElement;
  /** Flows into the element (none for a flow). */
  incoming: readonly VisibilityLink[];
  /** Flows out of the element (none for a flow). */
  outgoing: readonly VisibilityLink[];
  /** For a flow: its source and target. */
  endpoints?: { from?: VisibilityElement; to?: VisibilityElement };
  /** Facts about the whole model (absent when the caller has none). */
  model?: VisibilityModel;
}

/** What a predicate knows about the model beyond the element's neighbours. */
export interface VisibilityModel {
  /** Some element of the model is a Multiprocess. */
  hasMultiprocess: boolean;
  /** The component under evaluation (Compliance tab), if one is chosen. */
  componentId?: string;
}

/** Options for building the contexts of a whole model. */
export interface VisibilityOptions {
  /** The component under evaluation — its settings are asked on it (CM-6). */
  componentId?: string;
}

/** A flow as the DFD and the property view store it. */
export interface VisibilityFlowInput {
  id: string;
  from: string;
  to: string;
  properties?: Readonly<Record<string, unknown>>;
}

// ==================== REGISTRY ====================

export const NOT_SPECIFIED = "not_specified";

/** Sub-tab of the Security section an element form shows a field in (CM-5d). */
export type SecurityGroup = "login" | "authorization" | "robustness" | "sessions" | "operation";

export interface ModelField {
  /** Property key on the element (top level of `properties`). */
  property: string;
  /** Sub-tab of the form's Security section. */
  group: SecurityGroup;
  /** Element types that carry the field (R-6). */
  elementTypes: readonly string[];
  /** Values in display order; the first is "not_specified" (R-1). */
  values: readonly string[];
  /** Multi-select: the stored value is an array of `values` (without "not_specified"). */
  multiple?: boolean;
  /**
   * When the field is shown (R-3) — only asked for elements of `elementTypes`.
   * A driver that is itself a registered field is read with readModelField.
   */
  shownWhen: (context: VisibilityContext) => boolean;
  /**
   * The values that fit the element (without "not_specified"); absent = all.
   * A stored value outside them stays and is still listed by the form.
   */
  valuesFor?: (context: VisibilityContext) => readonly string[];
}

// ==================== CONDITIONS ====================
// Named facts about an element that drivers and evidence rules share
// (EvidenceTarget.when): one truth for "the element authenticates", "a
// password reaches it", … The settings they read are the ones the analyst
// makes before the new fields (user 2026-11-02: a field appears only where
// the earlier settings make it meaningful).

/** External-entity types that are humans (external-entity-type-registry). */
export const HUMAN_ENTITY_TYPES = ["user", "admin_user", "operator", "maintenance", "contractor", "device_owner"] as const;

const prop = (element: VisibilityElement | undefined, key: string): unknown => element?.properties?.[key];

const isHuman = (element: VisibilityElement | undefined): boolean =>
  element?.type === "ExternalEntity" && (HUMAN_ENTITY_TYPES as readonly unknown[]).includes(prop(element, "entityType"));

const links = (c: VisibilityContext): readonly VisibilityLink[] => [...c.incoming, ...c.outgoing];

/** Flows into the element whose endpoint authentication is a password. */
const passwordFlows = (c: VisibilityContext): readonly VisibilityLink[] =>
  c.incoming.filter((l) => prop(l.flow, "endpointAuthentication") === "password");

/** The element states that it does not authenticate (an explicit "no" / "none"). */
function deniesAuthentication(c: VisibilityContext): boolean {
  if (c.element.type === "Process") return prop(c.element, "authenticationRequired") === "no";
  if (c.element.type === "Multiprocess") return prop(c.element, "boundaryAuthentication") === "none";
  return false;
}

/** The Multiprocess authenticates with passwords at its boundary. */
const boundaryPassword = (c: VisibilityContext): boolean =>
  c.element.type === "Multiprocess" && prop(c.element, "boundaryAuthentication") === "password";

export const MODEL_CONDITIONS = {
  /** Process: authenticationRequired set and not "no"; Multiprocess: boundaryAuthentication set and not "none". */
  authenticates: (c: VisibilityContext): boolean => {
    const value =
      c.element.type === "Process"
        ? prop(c.element, "authenticationRequired")
        : c.element.type === "Multiprocess"
          ? prop(c.element, "boundaryAuthentication")
          : undefined;
    return !isUnset(value) && !deniesAuthentication(c);
  },
  /** A flow connects the element to a human external entity (D-24). */
  humanUsers: (c: VisibilityContext): boolean => links(c).some((l) => isHuman(l.other)),
  /** A password reaches the element: an incoming password flow, or a Multiprocess's boundary password; never where the element states it does not authenticate. */
  passwordInUse: (c: VisibilityContext): boolean =>
    !deniesAuthentication(c) && (boundaryPassword(c) || passwordFlows(c).length > 0),
  /** Humans log in with a password: a password flow from a human, or a boundary password with human users. */
  humanPasswordUse: (c: VisibilityContext): boolean =>
    !deniesAuthentication(c) &&
    (passwordFlows(c).some((l) => isHuman(l.other)) || (boundaryPassword(c) && links(c).some((l) => isHuman(l.other)))),
  /** Permissions are granted by role (authorizationModel = rbac); never where the element states it does not authenticate. */
  roleBasedAuthorization: (c: VisibilityContext): boolean =>
    !deniesAuthentication(c) && prop(c.element, "authorizationModel") === "rbac",
  /**
   * The element stands for the component as a whole: every Multiprocess; a
   * Process when it is the component under evaluation or the model has no
   * Multiprocess (the component is drawn as processes). Settings of the whole
   * component (secure-by-default configuration, CR 7.6) are asked here — not
   * on every process inside a system.
   */
  componentLevel: (c: VisibilityContext): boolean =>
    c.element.type === "Multiprocess" ||
    (c.element.type === "Process" && (!c.model?.hasMultiprocess || c.model.componentId === c.element.id)),
  /** The element is updated: updateMechanism set and not "none" (CR 3.10). */
  updatable: (c: VisibilityContext): boolean => {
    const mechanism = prop(c.element, "updateMechanism");
    return !isUnset(mechanism) && mechanism !== "none";
  },
  /** Updates are installed automatically (F-27 updateDelivery = automatic on an updatable element). */
  automaticUpdates: (c: VisibilityContext): boolean =>
    MODEL_CONDITIONS.updatable(c) && prop(c.element, "updateDelivery") === "automatic",
  /** Software processes or devices log in with a password: a password flow from a non-human source, or a boundary password with non-human external neighbours. */
  machinePasswordUse: (c: VisibilityContext): boolean =>
    !deniesAuthentication(c) &&
    (passwordFlows(c).some((l) => !!l.other && !isHuman(l.other)) ||
      (boundaryPassword(c) && links(c).some((l) => l.other?.type === "ExternalEntity" && !isHuman(l.other)))),
} as const;

export type ModelConditionId = keyof typeof MODEL_CONDITIONS;

export const MODEL_CONDITION_IDS = Object.keys(MODEL_CONDITIONS) as ModelConditionId[];

// ==================== FIELDS ====================
// Stage 1 (model-coverage-implementation-plan.md §4.2). Values as const
// arrays: element-properties.ts derives its types from them (one source).

/**
 * F-1 — how human users log in: an account per person, one login per role
 * (operator / maintenance / admin — usual in industrial devices) or one
 * shared login. CR 1.1 allows role- or group-based identification; CR 1.1
 * RE(1) asks for unique identification of every human user.
 */
export const USER_ACCOUNTS_VALUES = ["not_specified", "individual", "per_role", "shared"] as const;

/** F-2a — CR 1.7: password strength rules. */
export const PASSWORD_STRENGTH_VALUES = ["not_specified", "none", "fixed_rules", "configurable_policy"] as const;

/**
 * F-2b — CR 1.7 RE(1) / RE(2): which accounts have password lifetime limits
 * (2019 RE(1): lifetime and reuse for human users; RE(2): for all users;
 * prAA: RE(1) void, RE(2) software processes and devices).
 */
export const PASSWORD_LIFETIME_VALUES = ["not_specified", "none", "human_accounts", "machine_accounts", "all_accounts"] as const;

/**
 * F-3 — CR 1.5 items a / b: how the first authenticators come into being —
 * none pre-installed (set at commissioning), unique per device (random, not
 * derived from serial number or MAC), a default whose change is enforced at
 * first use, or one universal default for every device.
 */
export const DEFAULT_CREDENTIALS_VALUES = ["not_specified", "none_preinstalled", "unique_per_device", "change_enforced", "universal"] as const;

/** F-3b — CR 1.5 item c: the authenticators can be changed / refreshed. */
export const AUTHENTICATOR_CHANGEABLE_VALUES = ["not_specified", "yes", "no"] as const;

/**
 * F-27 — prAA CR 3.10 RE(2): how updates reach the element — manual only,
 * notification of an available update, on request or scheduled, automatic.
 */
export const UPDATE_DELIVERY_VALUES = ["not_specified", "manual_only", "notification", "on_request_or_scheduled", "automatic"] as const;

/** F-27b — CRA Annex I (2)(c), EN 303 645 5.3-6: automatic updates on by default, can be switched off, postponed. */
export const UPDATE_DEFAULTS_VALUES = ["not_specified", "enabled_by_default", "user_can_disable", "user_can_postpone"] as const;

/** F-25a — CR 7.6 a): the component is configured to its secure-by-default network and security settings. */
export const SECURE_BY_DEFAULT_VALUES = ["not_specified", "yes", "no"] as const;

/** F-25b — CR 7.6 b) / RE(1): an interface to the deployed settings; machine-readable report. */
export const SECURITY_CONFIG_REPORTING_VALUES = ["not_specified", "none", "readable_interface", "machine_readable"] as const;

/** Update mechanisms that need physical access — they cannot fetch or install on their own. */
const LOCAL_UPDATE_MECHANISMS: readonly unknown[] = ["manual_local", "signed_local"];

/**
 * F-29 — CR 2.1 RE(2): with role-based authorization, whether an authorised
 * role can define and change which permissions a role has, or the roles are
 * fixed in the product.
 */
export const ROLE_MAPPING_VALUES = ["not_specified", "fixed_roles", "configurable"] as const;

/** The registered fields; further stage-1 fields join with CM-5b … CM-7. */
export const MODEL_FIELDS: readonly ModelField[] = [
  {
    property: "userAccounts",
    group: "login",
    elementTypes: ["Process", "Multiprocess"],
    values: USER_ACCOUNTS_VALUES,
    // Accounts only mean something where the element authenticates human users.
    shownWhen: (c) => MODEL_CONDITIONS.authenticates(c) && MODEL_CONDITIONS.humanUsers(c),
  },
  {
    property: "passwordStrength",
    group: "login",
    elementTypes: ["Process", "Multiprocess"],
    values: PASSWORD_STRENGTH_VALUES,
    shownWhen: MODEL_CONDITIONS.passwordInUse,
  },
  {
    property: "passwordLifetime",
    group: "login",
    elementTypes: ["Process", "Multiprocess"],
    values: PASSWORD_LIFETIME_VALUES,
    shownWhen: MODEL_CONDITIONS.passwordInUse,
    // Only the kinds of accounts that log in with a password here; "all" only when both do.
    valuesFor: (c) => {
      const human = MODEL_CONDITIONS.humanPasswordUse(c);
      const machine = MODEL_CONDITIONS.machinePasswordUse(c);
      if (human && machine) return ["none", "human_accounts", "machine_accounts", "all_accounts"];
      if (human) return ["none", "human_accounts"];
      if (machine) return ["none", "machine_accounts"];
      return PASSWORD_LIFETIME_VALUES.slice(1);
    },
  },
  {
    property: "defaultCredentials",
    group: "login",
    elementTypes: ["Process", "Multiprocess"],
    values: DEFAULT_CREDENTIALS_VALUES,
    shownWhen: MODEL_CONDITIONS.authenticates,
  },
  {
    property: "authenticatorChangeable",
    group: "login",
    elementTypes: ["Process", "Multiprocess"],
    values: AUTHENTICATOR_CHANGEABLE_VALUES,
    shownWhen: MODEL_CONDITIONS.authenticates,
  },
  {
    property: "updateDelivery",
    group: "operation",
    elementTypes: ["Process", "Multiprocess"],
    values: UPDATE_DELIVERY_VALUES,
    shownWhen: MODEL_CONDITIONS.updatable,
    // A mechanism that needs physical access cannot fetch or install by itself.
    valuesFor: (c) =>
      LOCAL_UPDATE_MECHANISMS.includes(prop(c.element, "updateMechanism"))
        ? ["manual_only", "notification"]
        : UPDATE_DELIVERY_VALUES.slice(1),
  },
  {
    property: "updateDefaults",
    group: "operation",
    elementTypes: ["Process", "Multiprocess"],
    values: UPDATE_DEFAULTS_VALUES,
    multiple: true,
    shownWhen: MODEL_CONDITIONS.automaticUpdates,
  },
  {
    property: "secureByDefault",
    group: "operation",
    elementTypes: ["Process", "Multiprocess"],
    values: SECURE_BY_DEFAULT_VALUES,
    shownWhen: MODEL_CONDITIONS.componentLevel,
  },
  {
    property: "securityConfigReporting",
    group: "operation",
    elementTypes: ["Process", "Multiprocess"],
    values: SECURITY_CONFIG_REPORTING_VALUES,
    shownWhen: MODEL_CONDITIONS.componentLevel,
  },
  {
    property: "roleMapping",
    group: "authorization",
    elementTypes: ["Process", "Multiprocess"],
    values: ROLE_MAPPING_VALUES,
    shownWhen: MODEL_CONDITIONS.roleBasedAuthorization,
  },
];

export function modelField(property: string, fields: readonly ModelField[] = MODEL_FIELDS): ModelField | undefined {
  return fields.find((f) => f.property === property);
}

// ==================== PREDICATES ====================

/** Unset: absent, empty, "not_specified" or an empty selection (R-1). */
export function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === NOT_SPECIFIED || (Array.isArray(value) && value.length === 0);
}

/** The field belongs to the element's type and its driver shows it. */
export function isFieldShown(field: ModelField, context: VisibilityContext): boolean {
  return field.elementTypes.includes(context.element.type) && field.shownWhen(context);
}

/** The value every consumer reads (R-4): unset while the field is hidden. */
export function readModelField(field: ModelField, context: VisibilityContext): unknown {
  return isFieldShown(field, context) ? context.element.properties?.[field.property] : undefined;
}

// ==================== WHOLE MODEL ====================

/** Context per element and flow id, for consumers that see the whole model. */
export function visibilityContexts(
  elements: readonly VisibilityElement[],
  flows: readonly VisibilityFlowInput[],
  options: VisibilityOptions = {},
): (id: string) => VisibilityContext | undefined {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const model: VisibilityModel = {
    hasMultiprocess: elements.some((e) => e.type === "Multiprocess"),
    ...(options.componentId ? { componentId: options.componentId } : {}),
  };
  const flowElement = (f: VisibilityFlowInput): VisibilityElement => ({ id: f.id, type: "DataFlow", properties: f.properties });
  const incoming = new Map<string, VisibilityLink[]>();
  const outgoing = new Map<string, VisibilityLink[]>();
  const push = (map: Map<string, VisibilityLink[]>, id: string, link: VisibilityLink) => {
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(link);
  };
  const flowsById = new Map<string, VisibilityFlowInput>();
  for (const f of flows) {
    flowsById.set(f.id, f);
    push(incoming, f.to, { flow: flowElement(f), other: byId.get(f.from) });
    push(outgoing, f.from, { flow: flowElement(f), other: byId.get(f.to) });
  }
  return (id) => {
    const element = byId.get(id);
    if (element) return { element, incoming: incoming.get(id) ?? [], outgoing: outgoing.get(id) ?? [], model };
    const flow = flowsById.get(id);
    if (!flow) return undefined;
    return { element: flowElement(flow), incoming: [], outgoing: [], endpoints: { from: byId.get(flow.from), to: byId.get(flow.to) }, model };
  };
}

/** Properties without the registered fields that are hidden; the same object when none is. */
function maskProperties(
  context: VisibilityContext,
  fields: readonly ModelField[],
): Readonly<Record<string, unknown>> | undefined {
  const properties = context.element.properties;
  if (!properties) return properties;
  const hidden = fields.filter((f) => f.property in properties && !isUnset(properties[f.property]) && !isFieldShown(f, context));
  if (hidden.length === 0) return properties;
  const masked: Record<string, unknown> = { ...properties };
  for (const f of hidden) delete masked[f.property];
  return masked;
}

/**
 * The model as every reader should see it (R-4): registered fields that are
 * hidden are removed from the copies; the stored model is not touched.
 * Elements and flows without a hidden field are returned as they are.
 */
export function withoutHiddenFields<E extends VisibilityElement, F extends VisibilityFlowInput>(
  elements: readonly E[],
  flows: readonly F[],
  fields: readonly ModelField[] = MODEL_FIELDS,
  options: VisibilityOptions = {},
): { elements: E[]; flows: F[] } {
  if (fields.length === 0) return { elements: [...elements], flows: [...flows] };
  const contextOf = visibilityContexts(elements, flows, options);
  const mask = <T extends { id: string; properties?: Readonly<Record<string, unknown>> }>(item: T): T => {
    const context = contextOf(item.id);
    if (!context) return item;
    const properties = maskProperties(context, fields);
    return properties === item.properties ? item : { ...item, properties };
  };
  return { elements: elements.map(mask), flows: flows.map(mask) };
}
