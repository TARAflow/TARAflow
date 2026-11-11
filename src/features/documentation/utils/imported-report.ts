// ==================== IMPORTED COMPONENTS IN THE REPORT — TEXTS ====================
// Multi-project TARA 6a-1 / 6a-1b: the texts every report format shares —
// the text generators (base-generator.ts) and the PDF (pdfmake-converter.ts)
// — so the PDF cannot lag behind (review 2026-11-11: it did). In the
// document language through the translate function.

import type {
  DocComponentAt,
  DocComputedValues,
  DocImportedThreat,
  DocImportedThreatGroup,
} from "../models/doc-types";

type TranslateFn = (key: string, defaultValue?: string) => string;

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => values[k] ?? "");

/** "Smoke Detector Case @ a1b2c3d4" — tag, else the short commit, else "not pinned". */
export function componentAtLabel(name: string, at: DocComponentAt, t: TranslateFn): string {
  const where = at.tag ?? (at.commit ? at.commit.slice(0, 8) : t("tabs.doc.imported.unpinned", "not pinned"));
  return `${name} @ ${where}`;
}

/** "Smoke Detector Case @ a1b2c3d4 — imported (SD1, SD2)" */
export function importedThreatGroupTitle(group: DocImportedThreatGroup, t: TranslateFn): string {
  return fill(t("tabs.doc.imported.group", "{{component}} — imported ({{instances}})"), {
    component: componentAtLabel(group.componentName, group.at, t),
    instances: group.instances.join(", "),
  });
}

export function importedThreatGroupSummary(group: DocImportedThreatGroup, t: TranslateFn): string {
  return fill(t("tabs.doc.imported.groupSummary", "{{count}} threat(s) of the component, each shown once for all its instances"), {
    count: String(group.threats.length),
  });
}

/** The lines below a threat: only the instances that differ. */
export function importedThreatDifferenceLines(threat: DocImportedThreat, t: TranslateFn): string[] {
  const relevance = (r: string) => t(`tabs.doc.imported.relevance.${r}`, r.replace(/_/g, " "));
  return threat.differences.flatMap((d) => [
    ...(d.override
      ? [
          fill(t("tabs.doc.imported.override", "{{prefix}}: relevance overridden by this TARA — {{from}} → {{to}}: {{rationale}}"), {
            prefix: d.prefix,
            from: relevance(threat.relevance),
            to: relevance(d.override.relevance),
            rationale: d.override.rationale,
          }),
        ]
      : []),
    ...(d.counterpart
      ? [fill(t("tabs.doc.imported.counterpart", "{{prefix}}: counterpart {{name}}"), { prefix: d.prefix, name: d.counterpart })]
      : []),
  ]);
}

/** The provenance of an imported risk's rating (E10); undefined for the machine's own risks. */
export function importedRiskNote(
  riskId: string,
  computed: Pick<DocComputedValues, "importedRiskNotes"> | undefined,
  t: TranslateFn,
): string | undefined {
  const note = computed?.importedRiskNotes?.get(riskId);
  if (!note) return undefined;
  const factor = (id: string) => t(`risks.factors.${id}.name`, id);
  const parts = [
    fill(t("tabs.doc.imported.riskFrom", "{{prefix}} · {{component}}"), {
      prefix: note.prefix,
      component: componentAtLabel(note.componentName, note.at, t),
    }),
  ];
  if (note.prefilled.length > 0) {
    parts.push(fill(t("tabs.doc.imported.prefilled", "from the component: {{factors}}"), { factors: note.prefilled.map(factor).join(", ") }));
  }
  for (const o of note.overridden) {
    parts.push(
      fill(t("tabs.doc.imported.overridden", "rated by this TARA: {{factor}}{{rationale}}"), {
        factor: factor(o.factorId),
        rationale: o.rationale ? ` — ${o.rationale}` : "",
      }),
    );
  }
  if (note.quantity > 1) parts.push(fill(t("tabs.doc.imported.quantity", "×{{n}} identical units"), { n: String(note.quantity) }));
  return parts.join("; ");
}
