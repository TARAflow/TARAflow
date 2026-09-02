// src/features/overview/hooks/use-source-bindings.ts
// ==================== USE SOURCE BINDINGS ====================
// Local edit-state management for a SourceBinding[] collection, mirroring
// the isEditing/editData pattern in project-info.tsx but scoped to a list
// of rows instead of a single object. Used by the project-level section
// today (general-tab.tsx); written scope-agnostically (it only ever sees
// the array it's handed) so element-level scope (Function/Process/System
// Asset, plan §3.5) can reuse it once that UI exists.

import { useState } from "react";
import type { SourceBinding } from "shared";
import { createEmptySourceBinding } from "../utils/source-binding-utils";

/**
 * Row-id generation for newly added bindings. Swap for the app's shared
 * generateId() if one exists (DriftEvent.id etc. will need the same);
 * crypto.randomUUID() is the safe default absent that.
 */
function generateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseSourceBindingsResult {
  isEditing: boolean;
  draft: SourceBinding[];
  startEdit: (current: SourceBinding[]) => void;
  cancelEdit: (current: SourceBinding[]) => void;
  addRow: () => void;
  updateRow: (id: string, patch: Partial<SourceBinding>) => void;
  removeRow: (id: string) => void;
  setIsEditing: (editing: boolean) => void;
}

export function useSourceBindings(
  initial: SourceBinding[],
): UseSourceBindingsResult {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SourceBinding[]>(initial);

  const startEdit = (current: SourceBinding[]) => {
    setDraft(current);
    setIsEditing(true);
  };

  const cancelEdit = (current: SourceBinding[]) => {
    setDraft(current);
    setIsEditing(false);
  };

  const addRow = () => {
    setDraft((rows) => [...rows, createEmptySourceBinding(generateId())]);
  };

  const updateRow = (id: string, patch: Partial<SourceBinding>) => {
    setDraft((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (id: string) => {
    setDraft((rows) => rows.filter((row) => row.id !== id));
  };

  return {
    isEditing,
    draft,
    startEdit,
    cancelEdit,
    addRow,
    updateRow,
    removeRow,
    setIsEditing,
  };
}
