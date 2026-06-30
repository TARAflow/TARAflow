// ==================== Catalog selector — specificity over general (regression) ====================
// Pins the intended behaviour: a context-matching domain template (embedded/cloud)
// wins over the context-free general template for the same (STRIDE, elementType).
// general (context:{}, specificity 0) is the fallback when nothing else matches.
//
// Placement: src/tests/unit/features/threats/services/  (adjust import depths).
//
// These call findElementTemplate directly with a minimal project + real element
// properties — no generator, no catalog i18n needed.

import { describe, it, expect } from "vitest";
import { findElementTemplate } from "../../../../../features/threats/services/threat-catalog-service";
import type { ThreatProjectData } from "features/threats";

// Minimal project: matchesContext only reads project.info?.tags for project-level
// keys (regulation/platform/domain), none of which these element-level templates use.
const project = { info: { tags: {} } } as unknown as ThreatProjectData;

describe("findElementTemplate — specificity beats general", () => {
  it("P-2 Process technology=rtos_task → embedded T-004 (Tampering)", () => {
    const t = findElementTemplate("T", "Process", project, {
      technology: "rtos_task",
    });
    expect(t?.id).toBe("T-004");
    expect(t?.domain).toBe("embedded");
  });

  it("P-2 Process technology=rtos_task → embedded E-005 (Elevation)", () => {
    const t = findElementTemplate("E", "Process", project, {
      technology: "rtos_task",
    });
    expect(t?.id).toBe("E-005");
    expect(t?.domain).toBe("embedded");
  });

  it("DS-2 DataStore technology=flash → embedded T-005 (Tampering)", () => {
    const t = findElementTemplate("T", "DataStore", project, {
      technology: "flash",
    });
    expect(t?.id).toBe("T-005");
    expect(t?.domain).toBe("embedded");
  });

  it("DS-1 DataStore technology=cloud → general T-005 (fallback, no cloud DataStore template)", () => {
    const t = findElementTemplate("T", "DataStore", project, {
      technology: "cloud",
    });
    expect(t?.domain).toBe("general");
    expect(t?.id).toBe("T-005");
  });
});
