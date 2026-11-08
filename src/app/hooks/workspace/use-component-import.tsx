// ==================== COMPONENT IMPORT (app wiring) ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §5): the
// DFD tab asks for an import (ComponentImportRunner); this hook shows the
// dialog, reads and checks the chosen file (Electron), applies the choice to
// the diagram and records the import in project.components. The import
// belongs to the project it was started in (pinned by id, like the tab
// handlers).

import React, { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import type { useToast } from "shared";
import type {
  ComponentImportRunner,
  ComponentInsertContext,
  ComponentInsertOutcome,
  ComponentMultiprocessInfo,
} from "features/dfd";
import { createIpcGitRunner } from "features/audit/services/audit-git-adapters";
import {
  ComponentImportDialog,
  type ComponentImportDialogChoice,
  type ComponentPickResult,
} from "features/components";
import type { Project } from "../../models/project-types";
import { quantityOf, withInstanceQuantity } from "../../services/component-import/instance-quantity";
import { createDefaultAssetData } from "features/assets/services/asset-factory";
import {
  componentImportAvailable,
  pickComponentFile,
  readComponentSourceFromDisk,
} from "../../services/component-import/component-source-electron";
import { isComponentCycle, type ComponentSourceOk } from "../../services/component-import/component-source";
import {
  applyComponentImport,
  candidateFrom,
  machineElementOptions,
} from "../../services/component-import/import-flow";
import { withRelevanceOverride, type RelevanceDecision } from "../../services/component-import/relevance-overrides";
import { withPathOverlay } from "../../services/component-import/path-overlays";
import { componentAttackPathGroups } from "../../utils/component-attack-trees";
import {
  componentSourceLabel,
  rememberComponentPath,
  resolveComponentPath,
} from "../../services/component-import/component-paths";

type Toast = ReturnType<typeof useToast>;

interface PendingImport {
  projectId: string;
  context: ComponentInsertContext;
  resolve: (outcome: ComponentInsertOutcome | null) => void;
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
}

export function useComponentImport({
  activeProject,
  openProjectFile,
  projectsRef,
  activeProjectRef,
  updateProject,
  toast,
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
        // The instance's assets join the store with the import (E5).
        const store = project.assets ?? createDefaultAssetData();
        const newIds = new Set(applied.assets.map((a) => a.id));
        void updateProject({
          id: project.id,
          components: applied.components,
          assets: { ...store, assets: [...store.assets.filter((a) => !newIds.has(a.id)), ...applied.assets] },
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
        quantity: quantityOf(instance),
        onSetQuantity: (n: number) => {
          const current = activeProjectRef.current;
          if (!current?.components) return;
          void updateProject({ id: current.id, components: withInstanceQuantity(current.components, instance.id, n) });
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
    [components, machineFilePath, openProjectFile, t, toast, activeProjectRef, updateProject],
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

  // ISO: the machine's window of opportunity per component attack path (patch 17).
  const setPathWindow = useCallback(
    (instanceId: string, treeKey: string, pathKey: string, window: "unlimited" | "easy" | "moderate" | "difficult" | null) => {
      const current = activeProjectRef.current;
      if (!current?.components) return;
      const next = withPathOverlay(current.components, instanceId, treeKey, pathKey, window, new Date().toISOString().slice(0, 10));
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
    setPathWindow,
    attackPathGroups,
    /** For the DFD tab; undefined outside Electron (design §2: no browser mode). */
    runner: componentImportAvailable() ? runner : undefined,
    dialog,
    componentInfoOf,
  };
}
