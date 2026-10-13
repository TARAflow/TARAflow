// ==================== DFD PAGE LAYOUT GUARD ====================
// Phase 0 of the leveled-DFD design
// (leveled-dfd-multi-diagram-design.md §13).
//
// The DFD side refuses to derive a model from a multi-page or compressed
// draw.io layout. A project file may nevertheless already carry such XML
// (written by an older version, or edited outside TARAflow), together with a
// model that was merged from all pages. Threat generation and sync must not
// run on that model — generation could replace a correct register with
// threats for duplicated elements, and sync could remove threats as orphans.
//
// Checked in the services (not only in the GUI) so no caller can bypass it,
// the same pattern as the regulation-preset generator block.

import { inspectDrawioPages, describeUnsupportedPageLayout } from "shared";
import type { ThreatProjectData } from "../models/threat-types";

/**
 * English error text if the project's DFD XML has an unsupported page
 * layout, otherwise null.
 */
export function unsupportedDfdLayoutError(
  project: Pick<ThreatProjectData, "dfdXml">,
): string | null {
  const layout = inspectDrawioPages(project.dfdXml);
  if (layout.supported) return null;
  return (
    describeUnsupportedPageLayout(layout) +
    " Threat generation and synchronisation are disabled until the DFD has a single uncompressed page."
  );
}
