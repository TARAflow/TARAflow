// ==================== EN 50742 VIEW ====================
// What the EN 50742 Approach A rows read outside the element properties
// (en-50742-rq-coverage.md §9.1, model coverage plan §8.1, CM-12): the risks
// with their SRSL and mandated controls, the safety functions, the exposed
// interfaces, hazards, WoO and the system definition. Plain data — the app
// layer builds it from the project (build-en50742-view.ts), so the compliance
// feature keeps importing `shared` only.

/** SRSL 0 … 3 (Table B.6). */
export type SrslLevel = 0 | 1 | 2 | 3;

/** A selected mandated control `en50742-<clause>` on a risk. */
export interface MandatedControl {
  clause: string;
  /** In a done status (DONE_MITIGATION_STATUSES) — what the achieved run counts. */
  done: boolean;
  /** Selected and not rejected — what the planned run counts. */
  planned: boolean;
}

export interface En50742Risk {
  id: string;
  /** "T-012" — how the tab and the report name the risk. */
  label: string;
  /** The Interface / DataFlow the threat is anchored to (the EL anchor). */
  anchorId?: string;
  /** Safety-function assets the risk is linked to. */
  safetyFunctionIds: readonly string[];
  /**
   * The SRSL of the risk; null = the gate applies (EL-bearing anchor) but it
   * is not rated yet (EL, AC or severity missing); undefined = no SRSL (the
   * anchor carries no EL — R = I × L only).
   */
  srsl: SrslLevel | null | undefined;
  /** The anchor's EL is above EL0; undefined = EL not rated. */
  exposed?: boolean;
  /** Clauses mandated at its SRSL for its anchor and STRIDE (design §11.4). */
  mandated: readonly string[];
  /** Several clauses mandated (Interface × T): one of them done suffices. */
  anyOfMandated: boolean;
  controls: readonly MandatedControl[];
  /** Treatment "accept": the remaining risk is passed on in the information for use. */
  accepted: boolean;
  /** MoSCoW "won't" with a justification — the threat is out (elimination rationale). */
  excluded: boolean;
}

export interface En50742View {
  /** project.info.windowOfOpportunity; absent = not set. */
  windowOfOpportunity?: string;
  /** Item definition sections with text (`boundary`, `environment`). */
  systemDefinition: { boundary: boolean; environment: boolean };
  /** Number of hazards and the labels of in-scope ones without a contributes_to input. */
  hazards: { total: number; unlinked: readonly string[] };
  /** Assets with a physical impact — the safety functions (design §2). */
  safetyFunctions: readonly En50742SafetyFunction[];
  /**
   * On a path to a safety function (CM-12b): interfaces and flows with an EL
   * above EL0, and Interfaces whose EL is unset.
   */
  interfaces: { exposed: readonly string[]; unrated: readonly string[] };
  risks: readonly En50742Risk[];
}

export interface En50742SafetyFunction {
  id: string;
  name: string;
  /** The asset names DFD elements — without them no path can be found. */
  linked: boolean;
  /** Interface elements on a path to it (backwards along the flows, CM-12b). */
  interfaces: readonly string[];
}

/** The `srsl` header (coverage §9.3): highest SRSL per safety function, its interfaces, WoO. */
export interface SrslSummary {
  windowOfOpportunity?: string;
  safetyFunctions: { id: string; name: string; srsl: SrslLevel | null; interfaces: readonly string[] }[];
}
