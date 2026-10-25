// ==================== ATTACK TREES IN THE REPORT ====================
// Conformance plan F5: content of the "attack-trees" chapter — one section
// per tree with its anchor, the tree structure (AND/OR gates, leaf ratings)
// and the attack paths (attack potential, feasibility, relevance decision).
// Format-neutral; the generators and the pdfmake converter only lay it out.
//
// The structure is parsed from the tree's DSL, not read from the stored
// `ast`: the DSL is what the analyst edits and what the path analysis ran
// on, a stored ast can lag behind it (plan F7). The paths come from the
// stored path analysis — the same paths the risks and threats refer to.

// Deep paths: the generation path imports no feature barrel (depcruise-doc).
import { parseAttackTree } from "../../attacktree/services/attacktree-parser";
import {
  bandAttackPotential,
  bandProbability,
  computeAttackPotential,
} from "../../attacktree/services/attacktree-feasibility";
import { attackPathDisplayId } from "../../attacktree/services/attacktree-threat-generator";
import { resolveFeasibilityConfiguration } from "../../attacktree/models/attacktree-types";
import type { AttackTree, AttackTreeNode } from "../../attacktree/models/attacktree-types";
import type { FeasibilityConfiguration } from "../../attacktree/models/attacktree-feasibility-types";
import type { DocProjectData } from "../models/doc-types";

type TranslateFn = (key: string, defaultValue?: string) => string;

const K = "tabs.doc.attackTrees";

export interface AttackTreeOutlineItem {
  /** 0 = root goal. */
  depth: number;
  text: string;
}

export interface AttackTreeReportSection {
  /** "AT-2 <tree title>" */
  title: string;
  /** Label / value lines under the title (description, anchor, feasibility). */
  facts: [string, string][];
  outlineTitle: string;
  outline: AttackTreeOutlineItem[];
  pathsTitle: string;
  headers: string[];
  rows: string[][];
}

const FEASIBILITY_FALLBACK: Record<string, string> = {
  "very-low": "Very low",
  low: "Low",
  medium: "Medium",
  high: "High",
};

const RELEVANCE_FALLBACK: Record<string, string> = {
  relevant: "relevant",
  not_relevant: "not relevant",
  uncertain: "uncertain",
  unrated: "unrated",
};

export const attackTreesIntro = (t: TranslateFn): string =>
  t(
    `${K}.intro`,
    "One section per attack tree: its anchor, the tree structure with the AND/OR gates and the leaf ratings, and the attack paths derived from it with attack potential, attack feasibility and the analyst's relevance decision.",
  );

const feasibilityLabel = (level: string | undefined, t: TranslateFn): string =>
  level ? t(`tabs.doc.traceability.feasibility.${level}`, FEASIBILITY_FALLBACK[level] ?? level) : "–";

/** Rating of a leaf as stated in the DSL — attack potential (with its band) or the legacy values. */
function leafRating(node: AttackTreeNode, config: FeasibilityConfiguration, t: TranslateFn): string {
  const e = node.evaluation;
  const parts: string[] = [];
  if (e?.attackPotential) {
    const potential = computeAttackPotential(e.attackPotential, config);
    const level = bandAttackPotential(potential, config);
    parts.push(`${t(`${K}.potentialShort`, "AP")} ${potential} (${feasibilityLabel(level, t)})`);
  } else if (e?.extended) {
    parts.push(`f ${e.extended.feasibility} · b ${e.extended.benefits} · i ${e.extended.impact}`);
  } else if (e?.simple) {
    const level = bandProbability(e.simple.probability, config);
    parts.push(`p ${e.simple.probability} · i ${e.simple.impact} (${feasibilityLabel(level, t)})`);
  }
  if (e?.benefit) parts.push(`${t(`${K}.benefit`, "benefit")} ${e.benefit}`);
  return parts.join(" · ");
}

function outlineOf(
  root: AttackTreeNode,
  config: FeasibilityConfiguration,
  t: TranslateFn,
): AttackTreeOutlineItem[] {
  const out: AttackTreeOutlineItem[] = [];
  const walk = (node: AttackTreeNode, depth: number) => {
    let text = node.name;
    if (node.type === "AND" || node.type === "OR") text += ` (${node.type})`;
    if (node.type === "LEAF") {
      const rating = leafRating(node, config, t);
      if (rating) text += ` — ${rating}`;
    }
    if (node.mitigations.length > 0) text += ` [${node.mitigations.join(", ")}]`;
    out.push({ depth, text });
    node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return out;
}

/** The structure as the DSL states it; the stored ast only if the DSL does not parse. */
function structureOf(tree: AttackTree): AttackTreeNode | undefined {
  const parsed = parseAttackTree(tree.dsl ?? "", tree.configuration?.evaluationMethod ?? "simple");
  return parsed.success && parsed.ast ? parsed.ast : tree.ast;
}

function anchorText(
  tree: AttackTree,
  assets: NonNullable<DocProjectData["assets"]>["assets"],
  t: TranslateFn,
): string | undefined {
  const a = tree.anchor;
  if (!a) return undefined;
  if (a.type === "asset") {
    const asset = assets.find((x) => x.id === a.assetId);
    const assetLabel = asset
      ? `${asset.displayId ?? asset.id} ${asset.name}`
      : [a.assetDisplayId, a.assetName].filter(Boolean).join(" ");
    const goal = a.securityGoal
      ? t(`tabs.doc.methodology.goalName.${a.securityGoal}`, a.securityGoal)
      : undefined;
    return [assetLabel || undefined, goal].filter(Boolean).join(" × ");
  }
  if (a.type === "threat") return [a.threatDisplayId, a.threatTitle].filter(Boolean).join(" ");
  if (a.type === "risk") return a.riskDisplayId;
  return t(`${K}.standalone`, "standalone");
}

/** "path-12" → 12; unnumbered ids last. */
const pathNo = (id: string | undefined): number => {
  const m = /(\d+)\s*$/.exec(id ?? "");
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/** One report section per tree, numbered like the attack-path threats (AT-<n>). */
export function attackTreeReportSections(
  project: Pick<DocProjectData, "attackTree" | "assets">,
  t: TranslateFn,
): AttackTreeReportSection[] {
  const trees = project.attackTree?.trees ?? [];
  const config = resolveFeasibilityConfiguration(project.attackTree?.configuration);
  const assets = project.assets?.assets ?? [];

  return trees.map((tree, index) => {
    const number = index + 1;
    const facts: [string, string][] = [];
    if (tree.description?.trim()) facts.push([t(`${K}.description`, "Description"), tree.description.trim()]);
    const anchor = anchorText(tree, assets, t);
    if (anchor) facts.push([t(`${K}.anchor`, "Anchor"), anchor]);
    const aggregated = tree.pathAnalysis?.aggregatedFeasibility;
    if (aggregated) {
      facts.push([t(`${K}.scenarioFeasibility`, "Attack feasibility (scenario)"), feasibilityLabel(aggregated, t)]);
    }

    const root = structureOf(tree);
    const assessments = tree.pathAssessments ?? [];
    const relevanceOf = (pathKey: string) => {
      const own = assessments.filter((a) => a.pathKey === pathKey);
      const label = (r: string) => t(`${K}.relevance.${r}`, RELEVANCE_FALLBACK[r] ?? r);
      if (own.length === 0) return label("unrated");
      return own
        .map((a) => (own.length > 1 ? `${label(a.relevance)} (${a.strideCategory})` : label(a.relevance)))
        .join(", ");
    };

    return {
      title: `AT-${number} ${tree.customTitle || tree.name}`,
      facts,
      outlineTitle: t(`${K}.structure`, "Structure"),
      outline: root ? outlineOf(root, config, t) : [],
      pathsTitle: t(`${K}.paths`, "Attack paths"),
      headers: [
        t(`${K}.colPath`, "Path"),
        t(`${K}.colChain`, "Attack path"),
        t(`${K}.colPotential`, "Attack potential"),
        t(`${K}.colFeasibility`, "Attack feasibility"),
        t(`${K}.colRelevance`, "Relevance"),
      ],
      // In path-number order (the stored analysis is sorted by risk).
      rows: [...(tree.pathAnalysis?.paths ?? [])]
        .sort((a, b) => pathNo(a.id) - pathNo(b.id))
        .map((p) => [
          attackPathDisplayId(number, p),
          p.path.join(" → "),
          p.attackPotential != null ? String(p.attackPotential) : "–",
          feasibilityLabel(p.feasibilityLevel, t),
          relevanceOf(p.pathKey),
        ]),
    };
  });
}
