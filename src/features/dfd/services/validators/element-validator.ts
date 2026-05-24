// ==================== ELEMENT VALIDATOR ====================
// Single Responsibility: Validate DFD elements

import type { DFDElement } from "../../models/dfd-types";
import { ValidationMessages, isDefaultName, validateTrustBoundaryId } from "./validator-utils";
import { validateElementProperties } from "./element-property-validator";
import type { DFDGraph } from "../../models/dfd-graph-types";
import { INTERFACE_TYPE_META } from "../../models/interface-type-registry";

/**
 * Validate all elements
 */
export function validateElements(
  elements: DFDElement[],
  errors: string[],
  warnings: string[],
  graph: DFDGraph,
): void {
  validateElementNames(elements, warnings);
  validateIdLabels(elements, warnings);
  validateTrustBoundaryIds(elements, errors);
  validateElementProperties(elements, warnings);
  validateInterfaceUsage(elements, warnings, graph);
  validateInterfacePhysicalBoundary(elements, warnings, graph);
  validateChipBoundaryDebugInterfaces(elements, warnings, graph);
  validateInterfaceConnectorTypes(elements, warnings);
}

/**
 * Validate that Interfaces have at least one dataflow passing through them.
 * Message format: KEY|displayId|elementType
 */
function validateInterfaceUsage(
  elements: DFDElement[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  const interfaces = elements.filter((e) => e.type === "Interface");

  for (const iface of interfaces) {
    let hasDataflow = false;

    if (graph) {
      hasDataflow = Array.from(graph.dataFlowAnalysis.values()).some(
        (analysis) => analysis.interfaceIds.includes(iface.id),
      );
    }

    if (!hasDataflow) {
      const displayId = iface.displayId ?? iface.name;
      warnings.push(
        `${ValidationMessages.INTERFACE_UNUSED}|${displayId}|Interface`,
      );
    }
  }
}

/**
 * Check for elements with default/placeholder names
 */
function validateElementNames(
  elements: DFDElement[],
  warnings: string[]
): void {
  const connectableTypes = [
    "Process",
    "Multiprocess",
    "DataStore",
    "ExternalEntity",
    "TrustBoundary",
    "ChipBoundary",
    "PhysicalBoundary",
  ];

  for (const element of elements) {
    if (!connectableTypes.includes(element.type)) continue;

    if (isDefaultName(element.name)) {
      warnings.push(
        `${ValidationMessages.ELEMENT_DEFAULT_NAME}:${element.name}`
      );
    }
  }
}

/**
 * Check for elements missing ID labels (displayId)
 */
function validateIdLabels(
  elements: DFDElement[],
  warnings: string[]
): void {
  const typesNeedingIds = [
    "Process",
    "Multiprocess",
    "DataStore",
    "ExternalEntity",
  ];

  for (const element of elements) {
    if (!typesNeedingIds.includes(element.type)) continue;

    const hasDisplayId = Boolean(element.displayId);
    const hasIdInName = /\[[A-Z]+-?\d+\]/i.test(element.name);

    if (!hasDisplayId && !hasIdInName) {
      warnings.push(
        `${ValidationMessages.ELEMENT_MISSING_IDLABEL}:${element.name}`
      );
    }
  }
}

/**
 * Validate Trust Boundary IDs
 * Must have [ID] suffix in name
 */
function validateTrustBoundaryIds(
  elements: DFDElement[],
  errors: string[],
): void {
  // Validate both TrustBoundary and ChipBoundary — same [ID] convention
  const boundaryElements = elements.filter(
    (e) =>
      e.type === "TrustBoundary" ||
      e.type === "ChipBoundary" ||
      e.type === "PhysicalBoundary",
  );

  for (const boundary of boundaryElements) {
    const validation = validateTrustBoundaryId(boundary.name);
    if (!validation.isValid) {
      errors.push(
        `${ValidationMessages.TRUST_BOUNDARY_MISSING_ID}:${boundary.name}`,
      );
    }
  }
}

/**
 * Validate that each Interface geometrically overlaps at least one PhysicalBoundary.
 *
 * Rationale: An Interface without a physical context has no defined reachability.
 * The PhysicalBoundary it overlaps determines whether an attacker must cross it
 * to reach the interface (interface on boundary edge) or must first open the
 * boundary (interface fully inside).
 *
 * Rule only fires when at least one PhysicalBoundary exists in the diagram —
 * in early modelling phases analysts may not have drawn PBs yet.
 *
 * Severity: WARNING — not an error, since PBs may be added iteratively.
 *
 * Message format: KEY|displayId|elementType
 */
function validateInterfacePhysicalBoundary(
  elements: DFDElement[],
  warnings: string[],
  graph?: DFDGraph,
): void {
  // Only enforce when at least one PB exists — otherwise rule has no context
  const hasPhysicalBoundaries = elements.some(
    (e) => e.type === "PhysicalBoundary",
  );
  if (!hasPhysicalBoundaries || !graph) return;

  // Debug interfaces (jtag, swd, swd_swo, jtag_trace) are exempt from this rule.
  // Their physical context is defined by ChipBoundary membership — requiring them
  // to also overlap a PhysicalBoundary would be redundant: the ChipBoundary is
  // always inside the PhysicalBoundary, and debug interfaces sit on the chip die.
  const DEBUG_INTERFACE_TYPES = new Set([
    "jtag",
    "swd",
    "swd_swo",
    "jtag_trace",
  ]);

  const interfaces = elements.filter((e) => e.type === "Interface");

  for (const iface of interfaces) {
    // Exempt debug interfaces that belong to a ChipBoundary
    const ifaceType = (iface.properties as any)?.type ?? "";
    if (DEBUG_INTERFACE_TYPES.has(ifaceType)) {
      const memberChips = graph.elementChipBoundaries?.get(iface.id) ?? [];
      if (memberChips.length > 0) continue; // Has ChipBoundary context — exempt
    }

    const memberPBs = graph.elementPhysicalBoundaries?.get(iface.id) ?? [];

    if (memberPBs.length === 0) {
      const displayId = iface.displayId ?? iface.name;
      warnings.push(
        `${ValidationMessages.INTERFACE_NO_PHYSICAL_BOUNDARY}|${displayId}|Interface`,
      );
    }
  }
}


/**
 * R-CB1: If a ChipBoundary declares a debug interface (debugInterfacePresent ≠ none),
 * an Interface element of the matching type should exist that geometrically
 * overlaps the ChipBoundary.
 *
 * This rule ensures the debug port is explicitly modelled as an attack surface
 * in the DFD, enabling correct threat generation (JTAG/SWD-specific threats).
 *
 * Severity: WARNING — not an error because:
 *   - debugInterfaceLocked:true = port is disabled in production → lower priority
 *   - Analyst may model at chip level only without separate Interface symbol
 *
 * No warning when debugInterfaceLocked is true — the threat surface is already
 * constrained by the lock, so omitting the Interface symbol is acceptable.
 */
function validateChipBoundaryDebugInterfaces(
  elements: DFDElement[],
  warnings: string[],
  graph: DFDGraph,
): void {
  const chipBoundaries = elements.filter((e) => e.type === "ChipBoundary");
  const interfaces = elements.filter((e) => e.type === "Interface");

  // Map of debug interface type aliases (ChipBoundary → Interface type)
  // jtag_trace and swd_swo are supersets of jtag/swd respectively
  const DEBUG_TO_INTERFACE_TYPES: Record<string, string[]> = {
    jtag:       ["jtag", "jtag_trace"],
    jtag_trace: ["jtag_trace", "jtag"],
    swd:        ["swd", "swd_swo"],
    swd_swo:    ["swd_swo", "swd"],
    custom:     ["custom"],
  };

  for (const chip of chipBoundaries) {
    const props = chip.properties as any;
    const debugType = props?.debugInterfacePresent;
    const isLocked = props?.debugInterfaceLocked === true;

    // No debug interface declared, or locked — no warning needed
    if (!debugType || debugType === "none" || isLocked) continue;

    // Find Interface elements that overlap this ChipBoundary
    const chipInterfaces = interfaces.filter((iface) => {
      const memberChips = graph.elementChipBoundaries?.get(iface.id) ?? [];
      return memberChips.includes(chip.id);
    });

    const acceptableTypes = DEBUG_TO_INTERFACE_TYPES[debugType] ?? [debugType];
    const hasMatchingInterface = chipInterfaces.some((iface) => {
      const ifaceType = (iface.properties as any)?.type;
      return ifaceType && acceptableTypes.includes(ifaceType);
    });

    if (!hasMatchingInterface) {
      const displayId = chip.displayId ?? chip.name;
      warnings.push(
        `${ValidationMessages.CHIPBOUNDARY_MISSING_DEBUG_INTERFACE}|${displayId}|${debugType}`,
      );
    }
  }
}


/**
 * R-IF1: connectorType must be compatible with interface type.
 * Wireless interfaces (wifi, bluetooth, nfc) have no physical connector.
 * Wired interfaces must use a connector from their validConnectors list.
 * Severity: WARNING — may be intentional but likely a modelling error.
 */
function validateInterfaceConnectorTypes(
  elements: DFDElement[],
  warnings: string[],
): void {
  const interfaces = elements.filter((e) => e.type === "Interface");

  for (const iface of interfaces) {
    const props = iface.properties as any;
    const ifaceType = props?.type;
    const connectorType = props?.connectorType;

    if (!ifaceType || !connectorType) continue;

    const meta = INTERFACE_TYPE_META[ifaceType as keyof typeof INTERFACE_TYPE_META];
    if (!meta) continue;

    const { validConnectors } = meta;

    const isInvalid =
      validConnectors.length === 0 || // wireless — no connector applicable
      !validConnectors.includes(connectorType);

    if (isInvalid) {
      const displayId = iface.displayId ?? iface.name;
      warnings.push(
        `${ValidationMessages.INTERFACE_CONNECTOR_TYPE_INVALID}|${displayId}|${ifaceType}|${connectorType}`,
      );
    }
  }
}

/**
 * Check for duplicate ID labels
 */
export function validateDuplicateIdLabels(
  elements: DFDElement[],
  warnings: string[]
): void {
  const idLabels = new Map<string, string[]>(); // id -> [element names]

  for (const element of elements) {
    if (element.displayId) {
      const id = element.displayId.toUpperCase();
      if (!idLabels.has(id)) {
        idLabels.set(id, []);
      }
      idLabels.get(id)!.push(element.name);
    }

    // Also check for [ID] in name
    const match = element.name.match(/\[([A-Z]+-?\d+)\]/i);
    if (match) {
      const id = match[1].toUpperCase();
      if (!idLabels.has(id)) {
        idLabels.set(id, []);
      }
      // Only add if not already added via displayId
      if (!element.displayId || element.displayId.toUpperCase() !== id) {
        idLabels.get(id)!.push(element.name);
      }
    }
  }

  // Report duplicates
  idLabels.forEach((names, id) => {
    if (names.length > 1) {
      warnings.push(`${ValidationMessages.DUPLICATE_IDLABEL}:${id}`);
    }
  });
}