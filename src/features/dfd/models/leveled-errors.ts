// ==================== LEVELED ACTION ERRORS ====================
// Review finding 2: what a leveled-DFD action (child page, context copy,
// identity, adoption, lost definition) reports to the UI is a code, never
// a text. The dialogs translate it (tabs.dfd.leveledErrors.<CODE>);
// technical draw.io details go to the log only.

import type { LinkEditRefusal } from "../services/leveled/identity-links";
import type { AdoptionApplyResult } from "../services/leveled/adoption";

/** Why the adoption of pages was refused (5b). */
type AdoptionRefusal = Extract<AdoptionApplyResult, { ok: false }>["reason"];

export type LeveledActionError =
  /** The action needs the draw.io plugin, a saved diagram or a child page. */
  | "NOT_AVAILABLE"
  /** Nothing to do for this cell / page (e.g. the element is already there). */
  | "NOT_POSSIBLE"
  /** draw.io refused or failed (details in the log). */
  | "DRAWIO_FAILED"
  /** draw.io copied nothing (details in the log). */
  | "NOTHING_COPIED"
  /** draw.io did not delete the page (details in the log). */
  | "PAGE_NOT_DELETED"
  /** The changed page tree could not be saved. */
  | "SAVE_FAILED"
  /** The review the dialog shows is gone (saved meanwhile). */
  | "NO_REVIEW"
  | AdoptionRefusal
  | LinkEditRefusal;

// Record over the union: a code added to the type without an entry here is
// a compile error, so the list below (and the i18n test) stays complete.
const CODES: Record<LeveledActionError, true> = {
  NOT_AVAILABLE: true,
  NOT_POSSIBLE: true,
  DRAWIO_FAILED: true,
  NOTHING_COPIED: true,
  PAGE_NOT_DELETED: true,
  SAVE_FAILED: true,
  NO_REVIEW: true,
  INVALID_DEFINITION: true,
  PAGE_NOT_PLACED: true,
  CELL_NOT_FOUND: true,
  NOT_A_CONTEXT_COPY: true,
  NOT_DANGLING: true,
  NO_DEFINITION: true,
  DUPLICATE_DEFINITIONS: true,
  PAGE_NOT_IN_TREE: true,
  NOT_A_PLAIN_CELL: true,
  SAME_IDENTITY: true,
  TYPE_MISMATCH: true,
};

/** Every code — the i18n completeness test walks this list. */
export const LEVELED_ACTION_ERRORS = Object.keys(CODES) as LeveledActionError[];

/** The i18n key of a code. */
export const leveledErrorKey = (code: LeveledActionError): string => `tabs.dfd.leveledErrors.${code}`;
