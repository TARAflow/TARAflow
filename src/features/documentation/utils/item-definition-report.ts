// ==================== ITEM DEFINITION IN THE REPORT ====================
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-5: the work product
// WP-09-01 (item definition, RQ-09-01/02) as the chapter "item-definition".
// All presets; the chapter appears once the Item Definition holds something
// (a section, a function or an assumption). Format-neutral; the generators and
// the pdfmake converter only lay it out.
//
// Sections in the order of the Definition sub-tab: purpose and functions (the
// project description, the function table), item boundary, preliminary
// architecture, operational environment, constraints — each with its text,
// its source and the model items it refers to — then the assumptions with
// their status and the trust boundaries that rely on them. The purpose is
// repeated from the system overview so that the work product stands alone.

// Deep path: the generation path imports no barrel (depcruise-doc).
import {
  LIFECYCLE_PHASES,
  type ItemDefinition,
  type ItemSection,
  type ItemSectionId,
  type SourceRef,
} from "../../../shared/models/item-definition-types";
import type { DocProjectData } from "../models/doc-types";
import type { ReportSection } from "./report-section";

type TranslateFn = (key: string, defaultValue?: string) => string;

const K = "tabs.doc.itemDefinition";

/** A section of the chapter (generic report section). */
export type ItemDefinitionReportSection = ReportSection;

const SECTION_DEFAULTS: Record<Exclude<ItemSectionId, "functions">, string> = {
  boundary: "Item boundary",
  architecture: "Preliminary architecture",
  environment: "Operational environment",
  constraints: "Constraints and legal requirements",
};

export const itemDefinitionIntro = (t: TranslateFn): string =>
  t(
    `${K}.intro`,
    "What the analysis is about (ISO/SAE 21434 9.3): the item's purpose and functions, its boundary, its preliminary architecture and its operational environment, with the sources they come from and the assumptions the analysis relies on.",
  );

/** Something stored beyond the description? */
export function hasItemDefinitionContent(def: ItemDefinition | undefined): boolean {
  if (!def) return false;
  const sections = Object.values(def.sections ?? {}).some(
    (s) => !!(s?.text?.trim() || s?.source?.document?.trim() || s?.modelRefs?.length),
  );
  return sections || (def.functions?.length ?? 0) > 0 || (def.assumptions?.length ?? 0) > 0;
}

const paragraphs = (text: string | undefined) =>
  (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function sourceText(s: SourceRef | undefined): string {
  if (!s?.document?.trim()) return "";
  return [s.document, s.section, s.version ? `v${s.version}` : undefined]
    .filter((x) => x && x.trim())
    .join(", ");
}

/** Model item id → "EE-1 Operator" (DFD elements, flows, pages, assets). */
function modelLabels(project: Pick<DocProjectData, "dfd" | "assets">): Map<string, string> {
  const label = (displayId: string | undefined, name: string | undefined, id: string) =>
    [displayId, name].filter((s) => s && s.trim()).join(" ") || id;
  const map = new Map<string, string>();
  for (const e of project.dfd?.elements ?? []) map.set(e.id, label(e.displayId, e.name, e.id));
  for (const c of project.dfd?.connections ?? []) map.set(c.id, label(c.displayId, c.name, c.id));
  for (const p of project.dfd?.pages ?? []) map.set(p.pageId, p.name || p.pageId);
  for (const a of project.assets?.assets ?? []) map.set(a.id, label(a.displayId, a.name, a.id));
  return map;
}

export function itemDefinitionReportSections(
  project: Pick<DocProjectData, "info" | "itemDefinition" | "dfd" | "assets">,
  t: TranslateFn,
): ItemDefinitionReportSection[] {
  const def = project.itemDefinition;
  if (!hasItemDefinitionContent(def)) return [];
  const labels = modelLabels(project);
  const removed = (id: string) => `${id} (${t(`${K}.removed`, "removed")})`;
  const facts = (section: ItemSection | undefined): [string, string][] => {
    const out: [string, string][] = [];
    const src = sourceText(section?.source);
    if (src) out.push([t(`${K}.source`, "Source"), src]);
    if (section?.modelRefs?.length) {
      out.push([
        t(`${K}.refersTo`, "Refers to"),
        section.modelRefs.map((id) => labels.get(id) ?? removed(id)).join("; "),
      ]);
    }
    return out;
  };

  const sections: ItemDefinitionReportSection[] = [];

  // Purpose and functions — the description, then the function table.
  const fns = def!.functions ?? [];
  sections.push({
    title: t(`${K}.purpose`, "Purpose and functions"),
    paragraphs: paragraphs(project.info.description),
    facts: facts(def!.sections.functions),
    ...(fns.length > 0
      ? {
          table: {
            headers: [
              t(`${K}.colFunction`, "Function"),
              t(`${K}.colDescription`, "Description"),
              t(`${K}.colLifecycle`, "Lifecycle phases"),
              t(`${K}.colAsset`, "Function asset"),
            ],
            rows: fns.map((f) => [
              f.name,
              f.description ?? "",
              LIFECYCLE_PHASES.filter((p) => f.lifecyclePhases.includes(p))
                .map((p) => t(`${K}.lifecycle.${p}`, p))
                .join(", "),
              f.functionAssetId ? labels.get(f.functionAssetId) ?? removed(f.functionAssetId) : "",
            ]),
          },
        }
      : {}),
  });

  for (const id of Object.keys(SECTION_DEFAULTS) as Exclude<ItemSectionId, "functions">[]) {
    const s = def!.sections[id];
    if (!s?.text?.trim() && !s?.source?.document?.trim() && !s?.modelRefs?.length) continue;
    sections.push({
      title: t(`${K}.section.${id}`, SECTION_DEFAULTS[id]),
      paragraphs: paragraphs(s.text),
      facts: facts(s),
    });
  }

  const assumptions = def!.assumptions ?? [];
  if (assumptions.length > 0) {
    const usedBy = new Map<string, string[]>();
    for (const e of project.dfd?.elements ?? []) {
      const ids = (e.properties as { assumptionIds?: unknown } | undefined)?.assumptionIds;
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        if (typeof id === "string") usedBy.set(id, [...(usedBy.get(id) ?? []), labels.get(e.id) ?? e.id]);
      }
    }
    sections.push({
      title: t(`${K}.assumptions`, "Assumptions"),
      paragraphs: [],
      facts: [],
      table: {
        headers: [
          t(`${K}.colId`, "ID"),
          t(`${K}.colAssumption`, "Assumption"),
          t(`${K}.colStatus`, "Status"),
          t(`${K}.colOwner`, "Owner / review by"),
          t(`${K}.colUsedBy`, "Trust boundaries"),
        ],
        rows: assumptions.map((a) => [
          a.displayId,
          [a.text, sourceText(a.source) ? `(${t(`${K}.source`, "Source")}: ${sourceText(a.source)})` : ""]
            .filter(Boolean)
            .join(" "),
          t(`${K}.status.${a.status}`, a.status),
          [a.owner, a.reviewBy].filter(Boolean).join(" / "),
          (usedBy.get(a.id) ?? []).join(", "),
        ]),
      },
    });
  }
  return sections;
}
