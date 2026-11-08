// ==================== COMPONENT IMPORT DIALOG — TYPES ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §5): what
// the import dialog shows and returns. Plain data — the app layer reads the
// component file, checks it and applies the choice; this feature only asks.

import type { ComponentSource } from "shared";

/** A component TARA that was read and checked, as the dialog shows it. */
export interface ComponentImportCandidate {
  name: string;
  source: ComponentSource;
  /** The component's external entities — each one is mapped to a machine element. */
  externalEntities: { id: string; label: string }[];
  /** Flows from an EE to a boundary element — will not resolve (design §17 I2). */
  unresolvableFlows: string[];
  /**
   * The component is imported already (one state per component, E12): the
   * dialog asks first — a further instance (other installation context) or
   * a higher quantity of an existing one (same context, I5).
   */
  existing?: {
    sameState: boolean;
    label: string;
    instances: { id: string; label: string; quantity: number }[];
  };
  defaultPrefix: string;
  /** Prefixes of the instances already in the machine (must stay unique). */
  usedPrefixes: string[];
}

/** A machine element on the page shown that an EE can stand for. */
export interface MachineElementOption {
  id: string;
  label: string;
}

export type ComponentPickError =
  | "not_found"
  | "invalid"
  | "schema_too_new"
  | "not_deterministic"
  | "cycle"
  | "no_dfd"
  | "failed";

/** Result of choosing a file; null = cancelled. */
export type ComponentPickResult =
  | { ok: true; candidate: ComponentImportCandidate }
  | { ok: false; error: ComponentPickError; detail?: string }
  | null;

/** The analyst's choice. */
export interface ComponentImportDialogChoice {
  prefix: string;
  /** Name of the multiprocess. */
  name: string;
  /** Component EE id → machine element id; undefined = take over as a new element. */
  eeMapping: Record<string, string | undefined>;
  /** Identical units in the same installation context (I5); 1 = one unit. */
  quantity: number;
}
