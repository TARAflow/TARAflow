/**
 * Schema 13, step S13-c (release plan 0.18 FX-6; model coverage plan §6, K-9):
 * an AND gate of an attack tree is one attack scenario per combination of its
 * steps — no longer one path per leaf. The path keys of those paths change,
 * and with them the ids of their threats and risks. This step carries the
 * analyst's decisions over so nothing is lost:
 *
 *   path analysis   recomputed for every tree with an AND gate
 *   assessments     (pathKey, STRIDE) of the old leaf paths → the combined
 *                   path: relevance, notes, mitigations, verifications merged;
 *                   when the old paths disagree on relevance — or one of them
 *                   has no assessment, which means "not assessed yet", never
 *                   "not relevant" — the combined one is "relevant" and the
 *                   old assessments stay: they show in the attack-tree banner
 *                   (vanished assessed path) for review
 *   risks           R-AT-<tree>-<key>-<STRIDE> → the combined path's id; one
 *                   old risk is renamed; several are merged into the one with
 *                   the highest risk before mitigation, selected mitigations
 *                   united. Every carried risk notes where it came from (audit
 *                   trail); the note asks for a review when the decisions
 *                   differ or not every step had a risk
 *   goals / claims  their risk ids follow
 *
 * Reports per file whether an analysis value changed (K-9): only files with
 * an AND gate in a tree that has a path analysis.
 *
 * The step uses the attack-tree calculator of this version; a golden test
 * (migrate_12_to_13_and_gate_golden.test.ts) pins its output, so a later
 * change of the calculator that would migrate a 0.17 file differently fails
 * there and is decided on purpose.
 */

import {
  attackTreeCalculator,
  buildThreatId,
  computePathKey,
  resolveFeasibilityConfiguration,
} from "features/attacktree";
import type { StrideCategory } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const hasAnd = (node: Any): boolean => node?.type === "AND" || (node?.children ?? []).some(hasAnd);

const riskIdOf = (threatId: string) => `R-${threatId}`;

/** The decisions of a risk that must agree before risks are merged silently. */
const decisionOf = (r: Any) =>
  JSON.stringify([r.treatment, r.moscowPriority, (r.factorRatings ?? []).map((f: Any) => [f.factorId, f.value]), (r.selectedMitigations ?? []).map((m: Any) => [m.id, m.status]).sort()]);

export function migrateAndGatePaths(data: Any): { data: Any; analysisChanged: boolean } {
  const trees: Any[] = data?.attackTrees?.trees ?? [];
  if (!trees.some((t) => t?.ast && t?.pathAnalysis && hasAnd(t.ast))) return { data, analysisChanged: false };

  const config = resolveFeasibilityConfiguration(data.attackTrees.configuration);
  let risks: Any[] = [...(data.risks?.risks ?? [])];
  /** Old risk id → the risk ids that replace it. */
  const renamed = new Map<string, Set<string>>();

  const nextTrees = trees.map((tree) => {
    if (!tree?.ast || !tree.pathAnalysis || !hasAnd(tree.ast)) return tree;
    // The calculator writes risk scores into the nodes — work on a copy.
    const pathAnalysis = attackTreeCalculator.analyzeAttackPaths(structuredClone(tree.ast), tree.configuration?.evaluationMethod ?? "simple", config);
    const combined = pathAnalysis.paths.filter((p) => p.combination);

    const assessments: Any[] = tree.pathAssessments ?? [];
    const merged: Any[] = [];
    const keepOld = new Set<Any>();
    const usedOld = new Set<Any>();

    for (const path of combined) {
      const { gate, legs } = path.combination!;
      const oldKeys = new Set(legs.map((leg) => computePathKey([...gate, ...leg])));

      // Assessments, per STRIDE category.
      const olds = assessments.filter((a) => oldKeys.has(a.pathKey));
      for (const stride of new Set(olds.map((a) => a.strideCategory))) {
        const group = olds.filter((a) => a.strideCategory === stride);
        group.forEach((a) => usedOld.add(a));
        const relevances = new Set(group.map((a) => a.relevance));
        // A step without an assessment is not assessed yet — not "not relevant".
        const complete = new Set(group.map((a) => a.pathKey)).size === oldKeys.size;
        const review = relevances.size > 1 || !complete;
        if (review) group.forEach((a) => keepOld.add(a));
        const union = (key: string) => [...new Set(group.flatMap((a) => a[key] ?? []))];
        const notes = [...new Set(group.map((a) => a.evalNote?.trim()).filter(Boolean))];
        merged.push({
          pathKey: path.pathKey,
          strideCategory: stride,
          relevance: review || relevances.has("relevant") ? "relevant" : group[0].relevance,
          ...(notes.length ? { evalNote: notes.join("\n") } : {}),
          ...(union("mitigationIds").length ? { mitigationIds: union("mitigationIds") } : {}),
          ...(union("verificationIds").length ? { verificationIds: union("verificationIds") } : {}),
          lastModified: group.map((a) => a.lastModified).sort().pop(),
        });
      }

      // Risks, per STRIDE category: the risks of the old leaf paths of this combination.
      // The STRIDE category is the id's suffix — the id is the risk's identity.
      const strideOf = (r: Any) => String(r.threatId).slice(String(r.threatId).lastIndexOf("-") + 1) as StrideCategory;
      const legOf = (r: Any) =>
        typeof r.threatId === "string"
          ? [...oldKeys].find((key) => r.threatId === buildThreatId(tree.id, key, strideOf(r)))
          : undefined;
      const oldRisks = risks.filter((r) => legOf(r) !== undefined);
      for (const stride of new Set(oldRisks.map(strideOf))) {
        const group = oldRisks.filter((r) => strideOf(r) === stride);
        const base = [...group].sort((a, b) => (b.calculatedRiskBeforeMitigation ?? 0) - (a.calculatedRiskBeforeMitigation ?? 0))[0];
        const threatId = buildThreatId(tree.id, path.pathKey, stride);
        const mitigations = [...(base.selectedMitigations ?? [])];
        for (const r of group) for (const m of r.selectedMitigations ?? []) if (!mitigations.some((x) => x.id === m.id)) mitigations.push(m);
        const differ = new Set(group.map(decisionOf)).size > 1;
        const everyStep = new Set(group.map(legOf)).size === oldKeys.size;
        const note =
          `${group.length > 1 ? "Merged" : "Carried over"} from ${group.map((r) => r.threatDisplayId ?? r.id).join(", ")} ` +
          `(AND gate = one attack path, TARAflow 0.18)` +
          (differ || !everyStep ? ": review the rating and the treatment." : ".");
        const next = {
          ...base,
          id: riskIdOf(threatId),
          threatId,
          selectedMitigations: mitigations,
          riskBeforeRationale: [base.riskBeforeRationale, note].filter(Boolean).join("\n"),
        };
        risks = [...risks.filter((r) => r.id !== next.id), next];
        for (const r of group) renamed.set(r.id, new Set([...(renamed.get(r.id) ?? []), next.id]));
      }
    }

    const remaining = assessments.filter((a) => !usedOld.has(a) || keepOld.has(a));
    return { ...tree, pathAnalysis, pathAssessments: [...remaining, ...merged] };
  });

  risks = risks.filter((r) => !renamed.has(r.id) || renamed.get(r.id)!.has(r.id));
  const follow = (ids: string[] = []) => [...new Set(ids.flatMap((id) => (renamed.has(id) ? [...renamed.get(id)!] : [id])))];
  const concept = data.cybersecurityConcept;
  return {
    data: {
      ...data,
      attackTrees: { ...data.attackTrees, trees: nextTrees },
      ...(data.risks ? { risks: { ...data.risks, risks } } : {}),
      ...(concept
        ? {
            cybersecurityConcept: {
              ...concept,
              goals: (concept.goals ?? []).map((g: Any) => ({ ...g, riskIds: follow(g.riskIds) })),
              claims: (concept.claims ?? []).map((c: Any) => ({ ...c, riskIds: follow(c.riskIds) })),
            },
          }
        : {}),
    },
    analysisChanged: true,
  };
}
