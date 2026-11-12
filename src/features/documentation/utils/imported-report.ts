// ==================== IMPORTED COMPONENTS IN THE REPORT — TEXTS ====================
// Multi-project TARA 6a-1 / 6a-1b: the texts every report format shares —
// the text generators (base-generator.ts) and the PDF (pdfmake-converter.ts)
// — so the PDF cannot lag behind (review 2026-11-11: it did). In the
// document language through the translate function.

import type { ReportSection } from "./report-section";
import { residualCauseText } from "./residual-note";
import type {
  DocComponentAt,
  DocComputedValues,
  DocImportedComponent,
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

// ==================== CHAPTER "IMPORTED COMPONENTS" (6a-2) ====================

/**
 * The chapter's introduction, with the TARAflow rule by which a component's
 * measure — and with it a residual risk — does not count (I7): a reader of
 * the report does not know it otherwise (review 2026-11-11).
 */
export function importedComponentsIntro(t: TranslateFn): string[] {
  return [
    t(
      "tabs.doc.imported.chapterIntro",
      "This TARA imports the analyses of the components below instead of analysing them again: their DFD, threats, attack trees, measures, assets and assumptions of use, pinned to a commit of the component's repository. This TARA rates what depends on its context — impact, context factors, the window of opportunity of attack paths, and the assumptions of use per instance.",
    ),
    t(
      "tabs.doc.imported.creditRule",
      "A measure of a component counts in this TARA only while the component has implemented it and every assumption of use it relies on is fulfilled in the instance, with this TARA's evidence for it implemented. Otherwise the measure is \"unclear\" (not implemented yet, an assumption still open, evidence not implemented yet) or \"not effective\" (an assumption not fulfilled or invalid in the component, or marked not effective here). A risk whose residual relies on such a measure is reported with its value before treatment: the residual is not credited.",
    ),
  ];
}

const date = (iso: string) => (iso && !Number.isNaN(Date.parse(iso)) ? iso.slice(0, 10) : iso);

/** One section per component; one sub-section per instance. */
export function importedComponentsReportSections(components: readonly DocImportedComponent[] | undefined, t: TranslateFn): ReportSection[] {
  const T = (key: string, d: string) => t(`tabs.doc.imported.${key}`, d);
  return (components ?? []).map((c) => {
    const facts: [string, string][] = [];
    const add = (label: string, value: string | undefined) => {
      if (value) facts.push([label, value]);
    };
    add(T("version", "Version"), c.version);
    add(T("responsible", "Responsible"), c.responsible);
    add(T("tags", "Tags"), c.tags.join(", "));
    add(T("safety", "Safety-relevant"), c.safetyRelevant ? T("yes", "yes") : undefined);
    add(T("repository", "Repository"), c.origin.repoUrl ?? (c.origin.sameRepo ? T("sameRepo", "the repository of this TARA") : undefined));
    add(T("file", "File"), c.origin.path);
    add(T("ref", "Branch / tag"), [c.origin.branch, c.at.tag].filter(Boolean).join(" · ") || undefined);
    add(T("commit", "Commit"), c.at.unpinned ? T("unpinned", "not pinned") : c.at.commit);
    add(T("importedAt", "Imported on"), date(c.origin.importedAt));
    add(T("lastUpdate", "Last update"), c.origin.lastUpdateAt ? date(c.origin.lastUpdateAt) : undefined);
    add(
      T("methodology", "Methodology"),
      c.methodologyMatches === undefined
        ? undefined
        : c.methodologyMatches
          ? T("methodologySame", "same likelihood method and factor scales as this TARA — the component's factor values are taken over")
          : T("methodologyDiffers", "differs from this TARA — the component's factor values are not taken over"),
    );
    for (const b of c.sourceBindings) {
      add(T("source", "Source"), `${b.repoUrl} (${b.refType} ${b.refLabel}${b.commit ? ` · ${b.commit.slice(0, 8)}` : ""})`);
    }
    const status = (s: string) => T(`aou.${s}`, s.replace(/_/g, " "));
    const children: ReportSection[] = c.instances.map((i) => {
      const iFacts: [string, string][] = [];
      if (i.quantity > 1) iFacts.push([T("quantityLabel", "Quantity"), fill(T("quantity", "×{{n}} identical units"), { n: String(i.quantity) })]);
      for (const m of i.eeMapping) iFacts.push([T("eeMapping", "External entity"), `${m.componentEe} → ${m.machineElement}`]);
      for (const m of i.measures) {
        iFacts.push([
          m.effectiveness === "not_effective" ? T("notEffective", "Not effective here") : T("unclear", "Unclear here"),
          `${m.label}${m.reasons.length > 0 ? ` — ${m.reasons.map((r) => residualCauseText(r, t)).join("; ")}` : ""}`,
        ]);
      }
      return {
        title: i.quantity > 1 ? `${i.prefix} ×${i.quantity}` : i.prefix,
        paragraphs: [],
        facts: iFacts,
        ...(i.assumptions.length > 0
          ? {
              table: {
                headers: [T("colAssumption", "Assumption of use"), T("colText", "Text"), T("colStatus", "Status in this TARA")],
                rows: i.assumptions.map((a) => [a.displayId, a.text, `${status(a.status)}${a.rationale ? ` — ${a.rationale}` : ""}`]),
              },
            }
          : {}),
      };
    });
    return {
      title: componentAtLabel(c.componentName, c.at, t),
      paragraphs: c.description ? [c.description] : [],
      facts,
      children,
    };
  });
}

