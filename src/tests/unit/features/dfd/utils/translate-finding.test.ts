// tests/unit/features/dfd/utils/translate-finding.test.ts
//
// B — translate-finding resolves the new `sourceType` param to a translated
// element-type label (dfdValidation.elementTypes.*), not the raw type string.
//
// ⚠ WIRING: deep import specifiers; adjust if a barrel exists.

import { describe, it, expect } from "vitest";
import { translateFinding } from "features/dfd/utils/translate-finding";
import type { TFn } from "features/dfd/utils/translate-finding";

// Minimal `t` mock:
//  - element-type keys resolve to a marker ‹Type› so we can prove translation happened
//  - everything else interpolates {{param}} placeholders from opts
const t: TFn = (key, opts) => {
  if (key.startsWith("dfdValidation.elementTypes.")) {
    return `\u2039${key.split(".").pop()}\u203a`; // ‹Process›
  }
  let s = key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      if (k === "defaultValue") continue;
      s = s.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return s;
};

describe("translate-finding — sourceType resolution", () => {
  it("resolves sourceType to a translated element-type label", () => {
    const out = translateFinding(t, {
      key: "{{sourceName}} is a {{sourceType}}",
      params: { sourceName: "DSP buffer", sourceType: "Process" },
    });
    // translated marker, not the raw "Process"
    expect(out).toContain("\u2039Process\u203a");
    expect(out).toContain("DSP buffer");
  });

  it("leaves plain params untouched", () => {
    const out = translateFinding(t, {
      key: "store {{storeName}}",
      params: { storeName: "Shared SRAM" },
    });
    expect(out).toBe("store Shared SRAM");
  });
});
