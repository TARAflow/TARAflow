// ==================== COMPONENT IMPORT (app wiring) ====================
// Multi-project TARA (doc/Done/multi-project-tara-design.md v3, §5): the
// DFD tab asks for an import (ComponentImportRunner); this hook shows the
// dialog, reads and checks the chosen file (Electron), applies the choice to
// the diagram and records the import in project.components. The import
// belongs to the project it was started in (pinned by id, like the tab
// handlers).

import React, { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { useToast } from "shared";
import { sortA2ARelations } from "shared";
import type {
  ComponentImportRunner,
  ComponentInsertContext,
  ComponentInsertOutcome,
  ComponentMultiprocessInfo,
  ComponentCopyOptions,
} from "features/dfd";
import { createIpcGitRunner } from "features/audit/services/audit-git-adapters";
import {
  ComponentImportDialog,
  ComponentAssumptionsChecklist,
  ComponentUpdateDialog,
  type ComponentImportDialogChoice,
  type ComponentPickResult,
  type ComponentUpdateChoice,
} from "features/components";
import type { Project } from "../../models/project-types";
import { instanceLabel, quantityOf, withInstanceQuantity } from "../../services/component-import/instance-quantity";
import { copyInstanceRatings, copySourcesOf } from "../../services/component-import/copy-ratings";
import { assumptionGaps, instanceAssumptions, projectMeasureOptions, withAssumptionStatus } from "../../services/component-import/assumption-status";
import { buildAssetDataReference } from "../../utils/build-asset-data-reference";
import { buildAssetHazardLinks } from "../../utils/build-asset-hazard-links";
import { recalculateRiskValues } from "features/risks";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import {
  componentImportAvailable,
  pickComponentFile,
  readComponentSourceFromDisk,
  readNewerComponentStateOnDisk,
} from "../../services/component-import/component-source-electron";
import { applyComponentUpdate } from "../../services/component-import/component-update";
import { reviewItemLabel, updateInputOf, updateOutcomeOf, updatePreview } from "../../services/component-import/update-preview";
import { openReviews, withReviewConfirmed } from "../../services/component-import/update-inventory";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import { isComponentCycle, type ComponentSourceOk } from "../../services/component-import/component-source";
import {
  applyComponentImport,
  candidateFrom,
  machineElementOptions,
} from "../../services/component-import/import-flow";
import { withRelevanceOverride, type RelevanceDecision } from "../../services/component-import/relevance-overrides";
import { withMeasureOverride } from "../../services/component-import/measure-overrides";
import { withCitedClaim } from "../../services/component-import/cited-claims";
import type { ComponentDrift } from "./use-component-drift";
import { updateTargetOf, type ComponentDriftStatus } from "../../services/component-import/component-drift";
import { withPathOverlay } from "../../services/component-import/path-overlays";
import { componentAttackPathGroups } from "../../utils/component-attack-trees";
import {
  componentSourceLabel,
  rememberComponentPath,
  resolveComponentPath,
} from "../../services/component-import/component-paths";

type Toast = ReturnType<typeof useToast>;

interface PendingUpdate {
  projectId: string;
  importId: string;
  next: ComponentSourceOk;
  /** The project with the DFD as the editor holds it right now (the runner's context). */
  base: Project;
  resolve: (outcome: ComponentInsertOutcome | null) => void;
}

interface PendingImport {
  projectId: string;
  context: ComponentInsertContext;
  resolve: (outcome: ComponentInsertOutcome | null) => void;
}

/** The drift status in words (phase 5a). */
/** The drift status in words — the details panel and the Overview's "Components". */
export function driftView(status: ComponentDriftStatus, t: (key: string, options?: Record<string, unknown>) => string) {
  // This TARAflow reads the imported state differently (review 2026-11-09) — said, not hidden.
  const builder = status.kind !== "unreachable" && status.builderChanged
    ? ` · ${t("components.drift.builderChanged", { defaultValue: "this TARAflow reads it differently — refresh the stored state" })}`
    : "";
  if (status.kind === "up_to_date") {
    // An unpinned import committed by now (review 2026-11-13): refreshing pins it.
    const committed = status.committedAs
      ? ` · ${t("components.drift.committed", {
          where: status.committedAs.tag ?? status.committedAs.commitSha.slice(0, 8),
          defaultValue: "committed by now ({{where}}) — refresh the stored state to pin the import to it",
        })}`
      : "";
    return { kind: status.kind, text: t("components.drift.upToDate", { defaultValue: "Up to date" }) + builder + committed };
  }
  if (status.kind === "newer_available") {
    const where = status.tag ?? (status.commitSha ? status.commitSha.slice(0, 8) : "");
    return {
      kind: status.kind,
      text: t("components.drift.newer", { where, defaultValue: "Newer state available ({{where}}) — the update follows as an explicit step" }) + builder,
    };
  }
  if (status.kind === "diverged") {
    const where = status.tag ?? status.commitSha.slice(0, 8);
    return {
      kind: status.kind,
      text:
        t("components.drift.diverged", {
          where,
          defaultValue: "Another state on a separate branch ({{where}}) — neither newer nor older; check with the component team",
        }) + builder,
    };
  }
  return {
    kind: status.kind,
    text: t(`components.drift.unreachable.${status.reason}`, { defaultValue: `Source not reachable (${status.reason})` }),
  };
}

export interface UseComponentImportInput {
  /** The active project — for the details of its imported multiprocesses. */
  activeProject?: Project;
  /** Opens a project file as a further project ("Open component TARA"). */
  openProjectFile?: (filePath: string) => Promise<void>;
  projectsRef: MutableRefObject<Project[]>;
  activeProjectRef: MutableRefObject<Project | undefined>;
  updateProject: (patch: Partial<Project> & { id: string }) => Promise<void>;
  toast: Toast;
  /** The drift status per import (phase 5a), for the details of an imported multiprocess. */
  drift?: ComponentDrift;
}

export function useComponentImport({
  activeProject,
  openProjectFile,
  projectsRef,
  activeProjectRef,
  updateProject,
  toast,
  drift,
}: UseComponentImportInput) {
  const { t } = useTranslation("components");
  const [pending, setPending] = useState<PendingImport | null>(null);
  const resultRef = useRef<ComponentSourceOk | null>(null);

  const runner: ComponentImportRunner = useCallback(
    (context) =>
      new Promise((resolve) => {
        const projectId = activeProjectRef.current?.id;
        if (!projectId) return resolve(null);
        resultRef.current = null;
        setPending({ projectId, context, resolve });
      }),
    [activeProjectRef],
  );

  const finish = useCallback((outcome: ComponentInsertOutcome | null) => {
    setPending((p) => {
      p?.resolve(outcome);
      return null;
    });
    resultRef.current = null;
  }, []);

  const onPickFile = useCallback(async (): Promise<ComponentPickResult> => {
    const project = projectsRef.current.find((p) => p.id === pending?.projectId);
    if (!project) return { ok: false, error: "failed" };
    const path = await pickComponentFile(t("components.import.pickTitle", { defaultValue: "Choose the component TARA" }));
    if (!path) return null;
    const result = await readComponentSourceFromDisk(path, project.filePath);
    if (!result.ok) return { ok: false, error: result.error, ...(result.detail ? { detail: result.detail } : {}) };
    if (isComponentCycle(project.id, result.snapshot)) return { ok: false, error: "cycle" };
    if (!result.snapshot.dfd?.xml) return { ok: false, error: "no_dfd" };
    resultRef.current = result;
    // For "Open component TARA" — on this machine only, never in the file.
    rememberComponentPath(result.snapshot.component.projectId, path);
    return { ok: true, candidate: candidateFrom(result, project) };
  }, [pending?.projectId, projectsRef, t]);

  const onConfirm = useCallback(
    (choice: ComponentImportDialogChoice) => {
      const result = resultRef.current;
      const project = projectsRef.current.find((p) => p.id === pending?.projectId);
      if (!pending || !result || !project) return finish(null);
      try {
        const applied = applyComponentImport({
          context: pending.context,
          machine: project,
          result,
          choice,
          ids: { importId: crypto.randomUUID(), instanceId: crypto.randomUUID() },
          importedAt: new Date().toISOString(),
        });
        // The instance's assets join the store with the import (E5), and the
        // component's relations between them (phase 4a-3, read-only here).
        const store = project.assets ?? createDefaultAssetData();
        const newIds = new Set(applied.assets.map((a) => a.id));
        const newRelationIds = new Set(applied.relations.map((r) => r.id));
        const relations = sortA2ARelations([...(store.relations ?? []).filter((r) => !newRelationIds.has(r.id)), ...applied.relations]);
        void updateProject({
          id: project.id,
          components: applied.components,
          assets: {
            ...store,
            assets: [...store.assets.filter((a) => !newIds.has(a.id)), ...applied.assets],
            ...(relations.length > 0 ? { relations } : {}),
          },
        });
        finish(applied.outcome);
      } catch (err) {
        toast.error(
          t("components.import.applyFailed", {
            defaultValue: "The component could not be imported: {{message}}",
            message: err instanceof Error ? err.message : String(err),
          }),
        );
        finish(null);
      }
    },
    [finish, pending, projectsRef, t, toast, updateProject],
  );

  // Imported already, same installation context: one more unit of an
  // existing instance (I5) — no DFD change, the dialog closes.
  const onIncreaseQuantity = useCallback(
    (instanceId: string) => {
      const project = projectsRef.current.find((p) => p.id === pending?.projectId);
      const instance = project?.components?.instances.find((i) => i.id === instanceId);
      if (!project?.components || !instance) return;
      void updateProject({
        id: project.id,
        components: withInstanceQuantity(project.components, instanceId, quantityOf(instance) + 1),
      });
    },
    [pending?.projectId, projectsRef, updateProject],
  );

  const machineElements = useMemo(
    () => (pending ? machineElementOptions(pending.context) : []),
    [pending],
  );

  const dialog = (
    <ComponentImportDialog
      open={!!pending}
      machineElements={machineElements}
      onPickFile={onPickFile}
      onConfirm={onConfirm}
      onIncreaseQuantity={onIncreaseQuantity}
      onClose={() => finish(null)}
    />
  );

  // ── Update to a newer component state (phase 5c-2) ────────────────────
  // Runs through the DFD tab's runner path like the import: the DFD outcome
  // is committed and loaded into draw.io there; the other stores are written
  // here. The project before the update is kept for "discard update" until
  // the project is saved (then the update is in the file; its rollback is
  // git revert, decided 2026-11-09).
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [applied, setApplied] = useState<{ projectId: string; before: Project } | null>(null);
  const sawUnsaved = useRef(false);
  const withContext = (project: Project, context: ComponentInsertContext): Project =>
    ({
      ...project,
      dfd: { ...(project.dfd ?? {}), xml: context.xml, pages: context.pages, elements: context.elements, connections: context.connections, assets: context.assets },
    }) as Project;
  const outcomeOfDfd = (p: Project): ComponentInsertOutcome =>
    ({
      xml: p.dfd?.xml ?? "",
      pages: p.dfd?.pages ?? [],
      elements: p.dfd?.elements ?? [],
      connections: p.dfd?.connections ?? [],
      assets: p.dfd?.assets ?? [],
    }) as ComponentInsertOutcome;
  const storesOf = (p: Project) => ({
    components: p.components,
    assets: p.assets,
    risks: p.risks,
    threats: p.threats,
    hazards: p.hazards,
    cybersecurityConcept: p.cybersecurityConcept,
  });

  const updateRunnerFor = useCallback(
    (importId: string): ComponentImportRunner =>
      (context) =>
        new Promise((resolve) => {
          void (async () => {
            const project = activeProjectRef.current;
            const imported = project?.components?.imports.find((i) => i.id === importId);
            // a newer state, or the imported commit again when only the builder changed (refresh)
            const target = imported ? updateTargetOf(imported, drift?.drift.get(importId)) : undefined;
            if (!project || !imported || !target) return resolve(null);
            const next = await readNewerComponentStateOnDisk(imported, project.filePath, target.status);
            if (!next.ok) {
              toast.error(t("components.update.readFailed", { reason: next.error, defaultValue: "The newer state could not be read ({{reason}})." }));
              return resolve(null);
            }
            setPendingUpdate({ projectId: project.id, importId, next, base: withContext(project, context), resolve });
          })();
        }),
    [activeProjectRef, drift, t, toast],
  );
  const finishUpdate = useCallback((outcome: ComponentInsertOutcome | null) => {
    setPendingUpdate((p) => {
      p?.resolve(outcome);
      return null;
    });
  }, []);
  const outcomeOf = useCallback(
    (choice: ComponentUpdateChoice) => {
      if (!pendingUpdate) return { review: 0, dropped: [], tickets: [] };
      try {
        return updateOutcomeOf(applyComponentUpdate(updateInputOf(pendingUpdate.base, pendingUpdate.importId, pendingUpdate.next, choice, "preview")));
      } catch {
        return { review: 0, dropped: [], tickets: [] };
      }
    },
    [pendingUpdate],
  );
  const onApplyUpdate = useCallback(
    (choice: ComponentUpdateChoice) => {
      const p = pendingUpdate;
      if (!p) return;
      try {
        const result = applyComponentUpdate(updateInputOf(p.base, p.importId, p.next, choice, new Date().toISOString()));
        sawUnsaved.current = false;
        setApplied({ projectId: p.projectId, before: p.base });
        void updateProject({ id: p.projectId, ...storesOf(result.project) });
        // the drift check re-runs by itself: the import's content hash changed
        finishUpdate(outcomeOfDfd(result.project));
      } catch (err) {
        toast.error(t("components.update.failed", { defaultValue: "The update could not be applied: {{detail}}", detail: err instanceof Error ? err.message : String(err) }));
        finishUpdate(null);
      }
    },
    [pendingUpdate, updateProject, finishUpdate, toast, t],
  );
  const discardRunner: ComponentImportRunner = useCallback(
    () =>
      new Promise((resolve) => {
        const before = applied?.before;
        if (!before) return resolve(null);
        // the whole project as before — not each change undone one by one (review 2026-11-10)
        void updateProject({ id: before.id, ...storesOf(before) });
        setApplied(null);
        resolve(outcomeOfDfd(before));
      }),
    [applied, updateProject],
  );
  // Saved: the update is in the file — no app-side discard any more (git revert from here).
  const unsaved = activeProject?.hasUnsavedChanges;
  React.useEffect(() => {
    if (!applied || activeProject?.id !== applied.projectId) return;
    if (unsaved) sawUnsaved.current = true;
    else if (unsaved === false && sawUnsaved.current) setApplied(null);
  }, [applied, activeProject?.id, unsaved]);

  const preview = useMemo(
    () => (pendingUpdate ? updatePreview(pendingUpdate.base, pendingUpdate.importId, pendingUpdate.next) : null),
    [pendingUpdate],
  );
  const updateDialog = pendingUpdate && preview ? (
    <ComponentUpdateDialog
      open
      preview={preview}
      outcomeOf={outcomeOf}
      onApply={onApplyUpdate}
      onClose={() => finishUpdate(null)}
    />
  ) : null;

  // Details of an imported multiprocess, with "Open component TARA".
  const components = activeProject?.components;
  const machineFilePath = activeProject?.filePath;
  const componentInfoOf = useCallback(
    (tfId: string): ComponentMultiprocessInfo | undefined => {
      const instance = components?.instances.find((i) => i.multiprocessTfId === tfId);
      const imported = instance && components?.imports.find((i) => i.id === instance.importId);
      if (!instance || !imported) return undefined;
      return {
        name: imported.name,
        prefix: instance.prefix,
        source: componentSourceLabel(imported.source),
        // the tab "Component" counts them and opens first while any is open
        openAssumptions: assumptionGaps(instance, imported, activeProjectRef.current?.risks?.risks).open.length,
        // update (5c-2): offered for a newer state; discard while the update is not saved
        ...(() => {
          // update to a newer state, or refresh the stored state of the same commit (builder changed)
          const target = updateTargetOf(imported, drift?.drift.get(imported.id));
          return target && componentImportAvailable() ? { updateRunner: updateRunnerFor(imported.id), ...(target.refresh ? { updateIsRefresh: true } : {}) } : {};
        })(),
        ...(applied && applied.projectId === activeProjectRef.current?.id ? { discardRunner } : {}),
        // decisions to review after an update (derived from reviewBasis)
        reviews: openReviews(instance, imported.snapshot as ComponentSnapshot).map((r) => ({
          key: `${r.kind}|${r.key}`,
          text: t(`components.reviews.kind.${r.kind}`, {
            item: reviewItemLabel(imported.snapshot as ComponentSnapshot, r.kind, r.key),
            defaultValue: `${r.kind}: {{item}}`,
          }),
          onConfirm: () => {
            const current = activeProjectRef.current;
            if (!current?.components) return;
            void updateProject({
              id: current.id,
              components: {
                ...current.components,
                instances: current.components.instances.map((i) => (i.id === instance.id ? withReviewConfirmed(i, r.kind, r.key) : i)),
              },
            });
          },
        })),
        ...(drift && componentImportAvailable()
          ? {
              ...(drift.drift.get(imported.id) ? { drift: driftView(drift.drift.get(imported.id)!, t) } : {}),
              driftChecking: drift.checking,
              onCheckDrift: drift.recheck,
            }
          : {}),
        quantity: quantityOf(instance),
        onSetQuantity: (n: number) => {
          const current = activeProjectRef.current;
          if (!current?.components) return;
          void updateProject({ id: current.id, components: withInstanceQuantity(current.components, instance.id, n) });
        },
        // The assumptions of use of this instance (phase 3b, §7.6).
        renderExtra: () => (
          <ComponentAssumptionsChecklist
            prefix={instance.prefix}
            assumptions={instanceAssumptions(instance, imported)}
            measures={activeProjectRef.current ? projectMeasureOptions(activeProjectRef.current) : []}
            onChange={(assumptionId, decision) => {
              const current = activeProjectRef.current;
              if (!current?.components) return;
              void updateProject({ id: current.id, components: withAssumptionStatus(current.components, instance.id, assumptionId, decision) });
            }}
          />
        ),
        // Copy the ratings of another instance of the same import, once (I5).
        copySources: copySourcesOf(components!, instance.id).map((i) => ({ id: i.id, label: instanceLabel(i, imported.name) })),
        onCopyRatings: (sourceId: string, options: ComponentCopyOptions) => {
          const current = activeProjectRef.current;
          if (!current?.components) return;
          const config = current.risks?.configuration;
          const store = current.assets;
          const assetRef =
            store && store.assets.length > 0
              ? buildAssetDataReference(
                  store.assets,
                  buildAssetHazardLinks(current.hazards ?? null),
                  store.configuration?.impactScale ?? "4-level",
                  store.configuration?.impactCriteria,
                )
              : undefined;
          const result = copyInstanceRatings(current, sourceId, instance.id, options, (risk) =>
            config ? recalculateRiskValues(risk, config, assetRef) : risk,
          );
          void updateProject({
            id: current.id,
            components: result.components,
            ...(result.risks && current.risks ? { risks: { ...current.risks, risks: result.risks } } : {}),
            ...(result.assets ? { assets: result.assets } : {}),
          });
          const c = result.counts;
          toast.success(
            t("components.copy.done", {
              factors: c.factors,
              overrides: c.relevanceOverrides,
              measures: c.measureOverrides,
              claims: c.citedClaims,
              assumptions: c.assumptions,
              windows: c.pathOverlays,
              impact: c.assetRatings,
              defaultValue: "Copied: {{factors}} factor rating(s), {{overrides}} relevance override(s), {{measures}} measure(s) marked not effective here, {{claims}} cited claim(s), {{windows}} window(s) of opportunity, {{assumptions}} assumption status(es), {{impact}} asset impact rating(s).",
            }),
          );
        },
        ...(openProjectFile && componentImportAvailable()
          ? {
              onOpen: () => {
                void (async () => {
                  const path = await resolveComponentPath(imported.componentId, imported.source, machineFilePath, createIpcGitRunner());
                  if (path) await openProjectFile(path);
                  else
                    toast.warning(
                      t("components.details.pathUnknown", {
                        defaultValue: "Where the component TARA lies on this computer is not known — open it via File → Open.",
                      }),
                    );
                })();
              },
            }
          : {}),
      };
    },
    [components, machineFilePath, openProjectFile, t, toast, activeProjectRef, updateProject, drift, updateRunnerFor, applied, discardRunner],
  );

  // Relevance override on an imported boundary-flow threat (I3) — written
  // into the instance; the audit diff detects it with the instance.
  const overrideRelevance = useCallback(
    (instanceId: string, threatKey: string, decision: RelevanceDecision | null) => {
      const current = activeProjectRef.current;
      if (!current?.components) return;
      const components = withRelevanceOverride(current.components, instanceId, threatKey, decision, new Date().toISOString().slice(0, 10));
      void updateProject({ id: current.id, components });
    },
    [activeProjectRef, updateProject],
  );

  // "Not effective here" on a component measure (phase 3d-2b, I7 (5)) —
  // written into the instance; the audit diff detects it with the instance.
  const overrideMeasure = useCallback(
    (instanceId: string, measureId: string, rationale: string | null) => {
      const current = activeProjectRef.current;
      if (!current?.components) return;
      const components = withMeasureOverride(current.components, instanceId, measureId, rationale, new Date().toISOString().slice(0, 10));
      void updateProject({ id: current.id, components });
    },
    [activeProjectRef, updateProject],
  );

  // Cite / withdraw a supporting claim of a component for matrix rows (phase 4c).
  const citeClaim = useCallback(
    (key: string, requirements: readonly string[], cite: boolean) => {
      const current = activeProjectRef.current;
      if (!current?.components) return;
      const [instanceId, claimId] = key.split("|");
      const components = withCitedClaim(current.components, instanceId, claimId, requirements, cite, new Date().toISOString().slice(0, 10));
      void updateProject({ id: current.id, components });
    },
    [activeProjectRef, updateProject],
  );

  // ISO: the machine's window of opportunity per component attack path (patch 17).
  const setPathWindow = useCallback(
    (instanceId: string, treeKey: string, pathKey: string, window: "unlimited" | "easy" | "moderate" | "difficult" | null, leafId?: string) => {
      const current = activeProjectRef.current;
      if (!current?.components) return;
      const next = withPathOverlay(current.components, instanceId, treeKey, pathKey, window, new Date().toISOString().slice(0, 10), leafId);
      void updateProject({ id: current.id, components: next });
    },
    [activeProjectRef, updateProject],
  );
  // Feasibility with the machine's methodology (its attack-tree configuration).
  const attackTrees = activeProject?.attackTrees ?? null;
  const attackPathGroups = useMemo(
    () => (components ? componentAttackPathGroups({ components, attackTrees }) : []),
    [components, attackTrees],
  );

  return {
    overrideRelevance,
    overrideMeasure,
    citeClaim,
    setPathWindow,
    attackPathGroups,
    /** For the DFD tab; undefined outside Electron (design §2: no browser mode). */
    runner: componentImportAvailable() ? runner : undefined,
    dialog: (
      <>
        {dialog}
        {updateDialog}
      </>
    ),
    componentInfoOf,
    /**
     * The update of an import for a start outside the DFD tab (Overview, 6d):
     * its runner and whether it refreshes the stored state; undefined when
     * there is nothing to update (or outside Electron).
     */
    updateActionOf: (importId: string): { runner: ComponentImportRunner; refresh: boolean } | undefined => {
      const imported = activeProject?.components?.imports.find((i) => i.id === importId);
      const target = imported ? updateTargetOf(imported, drift?.drift.get(importId)) : undefined;
      return target && componentImportAvailable() ? { runner: updateRunnerFor(importId), refresh: target.refresh } : undefined;
    },
  };
}
