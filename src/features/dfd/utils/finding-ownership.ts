// ==================== FINDING OWNERSHIP ====================
// Multi-project TARA, phase 4a (design §8.1, review 2026-11-09): a finding on
// a part of an imported component can only be fixed in the component's TARA
// — the machine shows it, marked with its owner. Generic: the app layer
// knows which cells belong to which component and passes `FindingOwnerOf`;
// this file only knows which findings are about STRUCTURE.
//
// A boundary flow (component element ↔ machine element) belongs to the
// machine as a connection, but its properties come read-only from the
// component. So on a boundary flow a structural finding (endpoints, the
// connection itself, the leveled DFD's identity / page checks) is the
// machine's to fix, any other (properties, label, protocol, TLS …) the
// component's — otherwise the analyst looks for a field they cannot change.

import { ValidationMessages } from "../services/validators/validator-utils";

/** Who owns a finding, for its chip: a short label and a tooltip. */
export interface FindingOwner {
  label: string;
  tooltip: string;
}

/** cell id (+ finding key, absent for property suggestions) → owner; undefined = the machine's own. */
export type FindingOwnerOf = (elementId: string, findingKey?: string) => FindingOwner | undefined;

const STRUCTURAL = new Set<string>([
  ValidationMessages.UNCONNECTED_ELEMENT,
  ValidationMessages.UNCONNECTED_DATAFLOW,
  ValidationMessages.INVALID_DATAFLOW_SOURCE,
  ValidationMessages.INVALID_DATAFLOW_TARGET,
  ValidationMessages.CHIPBOUNDARY_INVALID_CONNECTION,
  ValidationMessages.PHYSICALBOUNDARY_INVALID_CONNECTION,
  ValidationMessages.SENSOR_INVALID_CONNECTION,
  ValidationMessages.ACTUATOR_INVALID_CONNECTION,
  ValidationMessages.TRANSDUCER_EE_NOT_PHYSICAL,
  ValidationMessages.TRANSDUCER_PHYSICAL_MEDIUM_INVALID_ENDPOINT,
]);

/** A finding about the structure (connection, endpoints, leveled identity) — not about property values or labels. */
export function isStructuralFinding(key: string): boolean {
  return STRUCTURAL.has(key) || key.startsWith("dfdValidation.leveled.");
}
