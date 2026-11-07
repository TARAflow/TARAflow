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
import type { ComponentImportRunner, ComponentInsertContext, ComponentInsertOutcome } from "features/dfd";
import {
  ComponentImportDialog,
  type ComponentImportDialogChoice,
  type ComponentPickResult,
} from "features/components";
import type { Project } from "../../models/project-types";
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

type Toast = ReturnType<typeof useToast>;

interface PendingImport {
  projectId: string;
  context: ComponentInsertContext;
  resolve: (outcome: ComponentInsertOutcome | null) => void;
}

export interface UseComponentImportInput {
  projectsRef: MutableRefObject<Project[]>;
  activeProjectRef: MutableRefObject<Project | undefined>;
  updateProject: (patch: Partial<Project> & { id: string }) => Promise<void>;
  toast: Toast;
}

export function useComponentImport({ projectsRef, activeProjectRef, updateProject, toast }: UseComponentImportInput) {
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
        void updateProject({ id: project.id, components: applied.components });
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
      onClose={() => finish(null)}
    />
  );

  return {
    /** For the DFD tab; undefined outside Electron (design §2: no browser mode). */
    runner: componentImportAvailable() ? runner : undefined,
    dialog,
  };
}
