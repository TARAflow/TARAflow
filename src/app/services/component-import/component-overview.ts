// ==================== COMPONENT OVERVIEW ====================
// The machine's Overview, tab "Components" (user 2026-11-11): per imported
// component its overview at the imported commit (snapshot.about, patch 69),
// where it comes from, whether the methodology matches, and its instances
// with their assumptions of use. Pure; the drift status is added by the
// caller (it lives in the app, not in the project file).

import type { ComponentOverviewItem } from "features/overview";
import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import { instanceAssumptions } from "./assumption-status";
import { quantityOf } from "./instance-quantity";
import { projectMethodologyFingerprint } from "./snapshot-builder";
import { withoutUrlCredentials } from "shared/utils/url-credentials";

const sourceText = (s: { document: string; section?: string; version?: string } | undefined) =>
  s ? [s.document, s.section, s.version].filter(Boolean).join(" · ") : undefined;

export function componentOverviewItems(project: Pick<Project, "components" | "risks">): ComponentOverviewItem[] {
  const components = project.components;
  if (!components) return [];
  const own = projectMethodologyFingerprint(project)?.hash;
  return components.imports.map((imported) => {
    const snapshot = imported.snapshot as ComponentSnapshot;
    const about = snapshot.about;
    const theirs = imported.methodology?.hash;
    const source = imported.source;
    return {
      importId: imported.id,
      name: imported.name,
      ...(snapshot.component?.version ? { version: snapshot.component.version } : {}),
      ...(about?.description ? { description: about.description } : {}),
      ...(about?.responsible ? { responsible: about.responsible } : {}),
      ...(about?.tags ? { tags: about.tags } : {}),
      ...(about?.safetyRelevant ? { safetyRelevant: true } : {}),
      sections: Object.entries(about?.sections ?? {}).map(([id, s]) => ({
        id,
        ...(s?.text ? { text: s.text } : {}),
        ...(s?.source ? { source: sourceText(s.source) } : {}),
      })),
      functions: (about?.functions ?? []).map((f) => ({ name: f.name, ...(f.description ? { description: f.description } : {}), lifecyclePhases: [...f.lifecyclePhases] })),
      sourceBindings: (about?.sourceBindings ?? []).map((b) => ({
        // a snapshot taken before patch 72 may still carry credentials: never shown
        repoUrl: withoutUrlCredentials(b.repoUrl),
        refType: b.refType,
        refLabel: b.refLabel,
        ...(b.resolvedCommitSha ? { commit: b.resolvedCommitSha } : {}),
      })),
      origin: {
        ...(source.repoUrl ? { repoUrl: withoutUrlCredentials(source.repoUrl) } : {}),
        ...(source.sameRepo ? { sameRepo: true } : {}),
        ...(source.path ? { path: source.path } : {}),
        ...(source.branch ? { branch: source.branch } : {}),
        ...(source.tag ? { tag: source.tag } : {}),
        ...(source.commitSha ? { commit: source.commitSha } : {}),
        ...(source.unpinned ? { unpinned: true } : {}),
        importedAt: imported.importedAt,
        ...(imported.lastUpdate ? { lastUpdateAt: imported.lastUpdate.at } : {}),
      },
      ...(own && theirs ? { methodologyMatches: own === theirs } : {}),
      ...(about ? {} : { aboutMissing: true }),
      instances: components.instances
        .filter((i) => i.importId === imported.id)
        .map((instance) => {
          const assumptions = instanceAssumptions(instance, imported);
          return {
            id: instance.id,
            prefix: instance.prefix,
            multiprocessTfId: instance.multiprocessTfId,
            quantity: quantityOf(instance),
            assumptionsTotal: assumptions.length,
            assumptionsDecided: assumptions.filter((a) => a.status !== "open").length,
            assumptionsNotFulfilled: assumptions.filter((a) => a.status === "not_fulfilled").length,
          };
        }),
    };
  });
}
