// ==================== WHY A ROW HAS ITS STATUS ====================
// 0.19 i18n follow-up: the evaluators' reasons ("no applicable Process in the
// component", "risks without SRSL", an edition's void reason) were English
// sentences, shown as such in the tab and in German reports. They are codes
// with values now; the tab (UI language) and the report (document language)
// turn them into text through `t`. `reasoning` keeps the English text for
// what reads it unchanged (statement rows carry the user's own reasoning).

/** The English text per code — the default of its key `reason.<code>` (compliance namespace). */
export const REASON_TEXTS = {
  // the matrix (evaluate-matrix)
  externalWithoutView: "evaluated from the risks and the project data",
  srslNotReached: "no risk reaches SRSL {{srsl}}",
  srslUnrated: "applies from SRSL {{srsl}} — risks not rated yet",
  notNeeded: "no {{types}} in the component needs it",
  preconditionUnset: "the precondition depends on unset properties",
  standIn: "no {{types}} modelled — a multiprocess without child page may contain one",
  noApplicable: "no applicable {{types}} in the component",
  deviceCategory: "the component is not {{categories}}",
  // EN 50742 A (evaluate-en50742)
  mandatedMissing: "mandated control missing or not done",
  risksUnratedRate: "risks without SRSL — rate EL, attacker capability and severity",
  noMandateClause: "no risk mandates the clause at its SRSL",
  noMandateMeasure: "no risk mandates a protection measure",
  nameInInformation: "name these risks in the information for use",
  risksUnrated: "risks without SRSL",
  noRemaining: "no remaining requirement",
  noHazardData: "no hazard data imported",
  hazardsUnlinked: "hazards without a contributing input: {{list}}",
  noSafetyFunction: "no safety-function asset (asset with a physical impact)",
  safetyFunctionsWithoutRisks: "safety functions without risks: {{list}}",
  notSetYet: "not set yet: {{items}}",
  exposedWithoutSrsl: "on a path to a safety function, exposed, no risk with SRSL",
  srslOrElUnrated: "SRSL or EL not rated yet",
  safetyFunctionsUnlinked: "safety functions without DFD elements: {{list}}",
  noExposedInterface: "no interface above EL0 on a path to a safety function",
  noElRatedInterface: "no EL-rated interface yet: {{list}}",
  srslZeroExposed: "SRSL 0 on an interface above EL0",
  noSrsl: "no SRSL determined",
} as const;

export type RowReasonCode = keyof typeof REASON_TEXTS | "void";

/** Project data a row lacks ("not set yet: …"), key `reasonItem.<item>`. */
export const REASON_ITEMS = {
  windowOfOpportunity: "window of opportunity",
  systemBoundary: "system boundary",
  operationalEnvironment: "operational environment",
} as const;

/** An edition's reason for a void row (EditionRow.void) → its text key `voidReason.<key>` (FX-22). */
export const VOID_REASONS: Readonly<Record<string, { key: string; text: string }>> = {
  "void in prAA": {
    key: "voidInPraa",
    text: "The CRA edition (EN IEC 62443-4-2/prAA) declares this requirement void — it does not apply to the component.",
  },
  "no component requirement": {
    key: "noComponentRequirement",
    text: "The standard sets no component requirement under this number — the topic is left to the system (IEC 62443-3-3).",
  },
  "no component requirement (SR 2.3 is system level)": {
    key: "noComponentRequirementSr23",
    text: "The standard sets no component requirement under this number — SR 2.3 is a system requirement (IEC 62443-3-3).",
  },
  "no component requirement (emergency power, system level)": {
    key: "noComponentRequirementPower",
    text: "The standard sets no component requirement under this number — emergency power is a matter of the system (IEC 62443-3-3).",
  },
};

export interface RowReason {
  code: RowReasonCode;
  /** Data filled in as is (SRSL, names, device categories; the edition's void text). */
  values?: Record<string, string>;
  /** Element types, named in the reader's language ({{types}}). */
  types?: string[];
  /** Project data items ({{items}}). */
  items?: (keyof typeof REASON_ITEMS)[];
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => values[k] ?? "");

/** The English text and the code — evaluators return both. */
export function because(
  code: keyof typeof REASON_TEXTS,
  extra: Omit<RowReason, "code"> = {},
): { reasoning: string; reason: RowReason } {
  const reason: RowReason = { code, ...extra };
  return { reasoning: reasonText(reason, (_k, d) => d), reason };
}

type TranslateFn = (key: string, defaultValue: string) => string;

/**
 * The reason in a language: `t` resolves keys of the compliance namespace
 * (`reason.*`, `reasonItem.*`, `voidReason.*`); `typeName` names an element
 * type (default: as is).
 */
export function reasonText(reason: RowReason, t: TranslateFn, typeName: (type: string) => string = (x) => x): string {
  if (reason.code === "void") {
    const edition = reason.values?.edition ?? "";
    const known = VOID_REASONS[edition];
    return known ? t(`voidReason.${known.key}`, known.text) : edition;
  }
  const values: Record<string, string> = {
    ...reason.values,
    ...(reason.types ? { types: reason.types.map(typeName).join(" / ") } : {}),
    ...(reason.items ? { items: reason.items.map((i) => t(`reasonItem.${i}`, REASON_ITEMS[i])).join(", ") } : {}),
  };
  return fill(t(`reason.${reason.code}`, REASON_TEXTS[reason.code]), values);
}
