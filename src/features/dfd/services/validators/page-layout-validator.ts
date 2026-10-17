// ==================== PAGE LAYOUT VALIDATOR ====================
// Phase 0 guard of the leveled-DFD design
// (leveled-dfd-multi-diagram-design.md §13).
//
// Turns an unsupported draw.io page layout (pages not adopted into the page
// tree yet, or a compressed page) into validation errors for the DFD
// notification panel. Adopted multi-page DFDs are supported (Phase 2c-2). The layout
// itself is detected by the shared, pure inspectDrawioPages().

import type { DrawioPageLayout } from "shared";
import type { ValidationFinding } from "../../models/dfd-types";
import { ValidationMessages } from "./validator-utils";

function formatPageNames(names: string[]): string {
  return names.map((n) => (n === "" ? "—" : n)).join(", ");
}

/**
 * Validation errors for an unsupported page layout. Empty for a supported
 * layout (single uncompressed page, bare <mxGraphModel>, or several adopted
 * uncompressed pages).
 */
export function validatePageLayout(
  layout: DrawioPageLayout,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  if (layout.unadoptedPageNames.length > 0) {
    findings.push({
      key: ValidationMessages.MULTI_PAGE_NOT_SUPPORTED,
      params: {
        count: layout.pageCount,
        pages: formatPageNames(layout.unadoptedPageNames),
      },
    });
  }

  if (layout.compressedPageNames.length > 0) {
    findings.push({
      key: ValidationMessages.COMPRESSED_PAGE_NOT_SUPPORTED,
      params: { pages: formatPageNames(layout.compressedPageNames) },
    });
  }

  return findings;
}
