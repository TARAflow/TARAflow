// tests/unit/i18n/threat-template-texts.test.ts
//
// Every built-in threat template must have threat / attack / cause texts in
// EN and DE under `${template.domain}.${template.id}` of its namespace.
//
// The generator looks texts up by the template's `domain`. Two embedded
// data-flow templates carried domain "dataflow" / "physical" although their
// texts live in the "embedded" group — the lookup missed, logged
// "missingKey … __MISSING__" and silently fell back to general.<id>, i.e. the
// text of a DIFFERENT template (a DataStore DoS text on a data flow).
// They only became reachable once per-element data flows passed their
// properties (field_cable / redundancy context).

import { describe, it, expect } from "vitest";
import {
  ALL_ELEMENT_TEMPLATES,
  ALL_INTERACTION_TEMPLATES,
} from "features/threats/services/catalog/threats/index";
import {
  ELEMENT_THREAT_TEXTS as EN_ELEMENT,
  INTERACTION_THREAT_TEXTS as EN_INTERACTION,
} from "i18n/locales/en/threats/index";
import {
  ELEMENT_THREAT_TEXTS as DE_ELEMENT,
  INTERACTION_THREAT_TEXTS as DE_INTERACTION,
} from "i18n/locales/de/threats/index";

type Texts = Record<string, Record<string, Record<string, string>>>;
const FIELDS = ["threat", "attack", "cause"] as const;

function missing(templates: any[], texts: Texts): string[] {
  const out: string[] = [];
  for (const t of templates) {
    if (t.isCustom) continue;
    const domain = t.domain ?? "general";
    for (const f of FIELDS) {
      if (!texts[domain]?.[t.id]?.[f]) out.push(`${domain}.${t.id}.${f}`);
    }
  }
  return [...new Set(out)].sort();
}

describe("threat template texts are complete", () => {
  it.each([
    ["element / en", ALL_ELEMENT_TEMPLATES, EN_ELEMENT],
    ["element / de", ALL_ELEMENT_TEMPLATES, DE_ELEMENT],
    ["interaction / en", ALL_INTERACTION_TEMPLATES, EN_INTERACTION],
    ["interaction / de", ALL_INTERACTION_TEMPLATES, DE_INTERACTION],
  ])("%s", (_label, templates, texts) => {
    expect(missing(templates as any[], texts as unknown as Texts)).toEqual([]);
  });
});
