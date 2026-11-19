// ==================== COMPONENT STRUCTURE FINDINGS ====================
// Manual test 2026-11-17: the machine showed "Interface SDC1:IF-2 is not
// crossed by any data flow" and "SDC1:DS-2 unconnected" — findings on the
// imported component's own elements, on pages the machine cannot edit. They
// are the component team's to fix (the component's TARA has them too), and
// the interface one is wrong here anyway: the flow that crosses the JTAG
// interface in the component is a boundary flow, defined on the machine's
// page, so the component's page no longer shows it. As with the duplicate id
// labels (patch 119), the machine leaves these structure findings out for
// elements the component owns. The multiprocess and the external entities
// are the machine's — their findings stay.

import type { DFDElement, ValidationFinding } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";
import { isComponentInstanceTfId } from "../leveled/component-tf-id";

const STRUCTURE_KEYS = new Set<string>([
  ValidationMessages.INTERFACE_UNUSED,
  ValidationMessages.UNCONNECTED_ELEMENT,
  ValidationMessages.ELEMENT_DEFAULT_NAME,
]);
const MACHINE_TYPES = new Set(["Multiprocess", "ExternalEntity"]);

export function withoutComponentStructureFindings(
  findings: ValidationFinding[],
  elements: readonly DFDElement[],
): ValidationFinding[] {
  const componentOwned = new Set(
    elements.filter((e) => isComponentInstanceTfId(e.id) && !MACHINE_TYPES.has(e.type)).map((e) => e.id),
  );
  if (componentOwned.size === 0) return findings;
  return findings.filter((f) => !(f.elementId && componentOwned.has(f.elementId) && STRUCTURE_KEYS.has(f.key)));
}
