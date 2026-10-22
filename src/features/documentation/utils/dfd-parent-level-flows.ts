// ==================== DFD PARENT-LEVEL FLOWS ====================
// Leveled-DFD Phase 7c (leveled-dfd-multi-diagram-design.md §6.5, Phase 7):
// the data flows analysed on a parent level, listed explicitly at the end of
// the DFD chapter — their threats refer to a multiprocess instead of its
// parts and are provisional. Same reasons as the threats tab's banner.
// Undefined for a classic DFD and when every flow is resolved.

import type { DFDConnection, DFDElement, DFDPage } from "../../dfd/models/dfd-types";
import type { DocLanguage } from "../models/doc-types";
// Deep imports: the DFD barrel pulls UI components; these modules are pure.
import { isLeveled } from "../../dfd/services/build-dfd-graph";
import { analyseLeveled } from "../../dfd/services/leveled/leveled-analysis";
import { parentLevelFlowsFrom } from "../../dfd/services/leveled/parent-level-flows";
import type { FallbackReason } from "../../dfd/services/leveled/effective-model";

export interface ParentLevelFlowRow {
  flow: string;
  from: string;
  to: string;
  reason: string;
}

export interface DfdParentLevelFlows {
  title: string;
  intro: string;
  rows: ParentLevelFlowRow[];
}

const TEXT: Record<DocLanguage, { title: string; intro: string; reason: Record<FallbackReason, string> }> = {
  en: {
    title: "Data flows analysed on a parent level",
    intro:
      "These data flows are analysed with a multiprocess as endpoint instead of one of its parts. Their threats are provisional; drawing the flows on the child page refines them.",
    reason: {
      ambiguous: "drawn to different parts — analysed at their common parent",
      dangling: "an endpoint has no definition",
      unresolved: "not drawn on the child page of the multiprocess",
    },
  },
  de: {
    title: "Auf Elternebene analysierte Datenflüsse",
    intro:
      "Diese Datenflüsse werden mit einem Multiprozess als Endpunkt analysiert statt mit einem seiner Teile. Ihre Bedrohungen sind vorläufig; werden die Flüsse auf der Unterseite gezeichnet, werden sie verfeinert.",
    reason: {
      ambiguous: "zu verschiedenen Teilen gezeichnet — beim gemeinsamen Elternelement analysiert",
      dangling: "ein Endpunkt hat keine Definition",
      unresolved: "nicht auf der Unterseite des Multiprozesses gezeichnet",
    },
  },
};

export function dfdParentLevelFlowsOf(
  dfd:
    | {
        xml?: string;
        pages?: readonly DFDPage[];
        elements?: readonly DFDElement[];
        connections?: readonly DFDConnection[];
      }
    | null
    | undefined,
  lang: DocLanguage,
): DfdParentLevelFlows | undefined {
  if (!dfd?.pages || dfd.pages.length < 2 || !isLeveled(dfd.xml)) return undefined;
  let flows;
  try {
    flows = parentLevelFlowsFrom(
      analyseLeveled({
        xml: dfd.xml,
        pages: dfd.pages,
        elements: dfd.elements ?? [],
        connections: dfd.connections ?? [],
      }),
    );
  } catch {
    return undefined; // unreadable XML: the DFD chapter shows no analysis
  }
  if (flows.length === 0) return undefined;
  const text = TEXT[lang];
  return {
    title: text.title,
    intro: text.intro,
    rows: flows.map((f) => ({ flow: f.label, from: f.from, to: f.to, reason: text.reason[f.reason] })),
  };
}
