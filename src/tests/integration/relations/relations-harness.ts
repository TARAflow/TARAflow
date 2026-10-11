// src/tests/integration/relations/relations-harness.ts
//
// Drives the REAL write and load chain the relation dialogs trigger, without
// a browser:
//
//   dialog/selector onChange
//     → DFD tab handler (same body as dfd-tab.handleAssetChange /
//       use-dfd-editor.updateElementDescription / updateConnectionDescription)
//     → useDFDPersistence.scheduleSave(base => useDFDData.updateX(…, base))
//     → onUpdate → buildDfdUpdatePatch            (WorkspaceLayout.handleDFDUpdate)
//     → mergeProjectPatch                         (useProjectManager.updateProject)
//     → serialiseProject                          (save)
//     → parseAndRepair → commitLoadedProject      (open)
//
// The hooks are the production hooks (renderHook); only the three short
// handler bodies are restated, because they live inside components.

import { act, renderHook } from "@testing-library/react";
import { useDFDData } from "features/dfd/hooks/use-dfd-data";
import { useDFDPersistence } from "features/dfd/hooks/use-dfd-persistence";
import type {
  DFDConnection,
  DFDElement,
  DFDProjectData,
  DFDUpdateResult,
} from "features/dfd/models/dfd-types";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";
import type { Project } from "app/models/project-types";
import { buildDfdUpdatePatch } from "app/services/dfd-update-patch";
import {
  commitLoadedProject,
  mergeProjectPatch,
} from "app/services/project-commit";
import { serialiseProject } from "app/services/prepare-for-disk";
import { parseAndRepair } from "app/services/migration-service";

/** What WorkspaceLayout hands to the DFD tab. */
function dfdTabProject(p: Project): DFDProjectData {
  return {
    id: p.id,
    name: p.info?.name ?? "",
    dfd: p.dfd ?? null,
    knownAssets: p.assets?.assets?.map((a) => ({ id: a.id, name: a.name })) ?? [],
    phaseStatus: p.phaseStatus,
    settings: p.settings,
    lastModified: p.info?.lastModified ?? "",
  } as DFDProjectData;
}

export function openProject(fileText: string): Project {
  const parsed = parseAndRepair(JSON.parse(fileText));
  if (!parsed) throw new Error("project could not be parsed");
  return commitLoadedProject(parsed);
}

export class RelationSession {
  project: Project;
  private hook;
  private tick = 0;

  constructor(project: Project) {
    this.project = project;
    const onUpdate = (updates: DFDUpdateResult) => {
      this.project = mergeProjectPatch(
        this.project,
        buildDfdUpdatePatch(this.project, updates),
        this.now(),
      );
    };
    this.hook = renderHook(
      ({ p }) => ({
        data: useDFDData(p),
        persistence: useDFDPersistence(p, { onUpdate, debounceDelay: 0 }),
      }),
      { initialProps: { p: dfdTabProject(project) } },
    );
  }

  private now(): string {
    // strictly increasing, so lastModified ordering is deterministic
    this.tick += 1;
    return new Date(Date.UTC(2026, 9, 3, 12, 0, this.tick)).toISOString();
  }

  private sync(): void {
    this.hook.rerender({ p: dfdTabProject(this.project) });
  }

  asset(id: string): DFDAsset {
    const a = this.project.dfd?.assets.find((x) => x.id === id);
    if (!a) throw new Error(`asset ${id} not on the DFD mirror`);
    return a;
  }

  /** AssetDescriptionForm → dfd-tab.handleAssetChange (side panel). */
  changeAsset(assetId: string, changes: Partial<DFDAsset>): void {
    const { data, persistence } = this.hook.result.current;
    act(() => {
      persistence.scheduleSave((base) => {
        const dfd = data.updateAsset(assetId, changes, base);
        return {
          dfd,
          phaseStatus: this.project.phaseStatus,
          lastModified: dfd.lastModified ?? this.now(),
        };
      });
    });
    this.sync();
  }

  /** AssetToAssetSelector.onChange → AssetDescriptionForm.handleA2AChange. */
  setA2A(assetId: string, relations: unknown[]): void {
    this.changeAsset(assetId, {
      ...this.asset(assetId),
      assetRelations: relations,
    } as unknown as Partial<DFDAsset>);
  }

  /** AssetRelationSelector.onChange → use-dfd-editor.updateElementDescription. */
  setElementRelations(elementId: string, relations: unknown[]): void {
    const { data, persistence } = this.hook.result.current;
    act(() => {
      persistence.scheduleSave((base) => {
        const dfd = data.updateElement(
          elementId,
          { assetRelations: relations } as Partial<DFDElement>,
          base,
        );
        return {
          dfd,
          phaseStatus: this.project.phaseStatus,
          lastModified: dfd.lastModified!,
        };
      });
    });
    this.sync();
  }

  /** Same for a DataFlow → use-dfd-editor.updateConnectionDescription. */
  setConnectionRelations(connectionId: string, relations: unknown[]): void {
    const { data, persistence } = this.hook.result.current;
    act(() => {
      persistence.scheduleSave((base) => {
        const dfd = data.updateConnection(
          connectionId,
          { assetRelations: relations } as Partial<DFDConnection>,
          base,
        );
        return {
          dfd,
          phaseStatus: this.project.phaseStatus,
          lastModified: dfd.lastModified!,
        };
      });
    });
    this.sync();
  }

  save(): string {
    return serialiseProject(this.project);
  }

  /** Save, close, open — a fresh session on the written file. */
  reopen(): RelationSession {
    const text = this.save();
    this.close();
    return new RelationSession(openProject(text));
  }

  close(): void {
    this.hook.unmount();
  }
}
