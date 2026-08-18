// ==================== USE ELEMENT FORM HOOK ====================
// Shared state logic for all DFD element description forms.
//
// Responsibilities:
//   - Tab navigation (General / Asset)
//   - Local state for text fields with onBlur sync pattern
//   - Generic handlePropertyChange for element properties
//   - Sync effects when element prop changes externally
//
// Usage:
//   const form = useElementForm<InterfaceProperties>(element, onChange);
//   <input value={form.localDescription} onChange={...} onBlur={form.commitDescription} />

import { useState, useCallback, useEffect } from "react";
import type { DFDElement } from "../models/dfd-types";

// ==================== BASE CONSTRAINT ====================
// All element property types must have at least `notes?: string`.
// This is the minimal contract useElementForm relies on.

interface BaseElementProperties {
  notes?: string;
  description?: string;
}

// ==================== TYPES ====================

export interface UseElementFormResult<P extends BaseElementProperties> {
  /** Currently active tab index (0 = General, 1 = Asset) */
  activeTab: number;
  setActiveTab: (tab: number) => void;

  /** Typed element properties */
  props: P;

  /** Asset relations shorthand */
  assetRels: NonNullable<DFDElement["assetRelations"]>;

  /** Local controlled state for description (onBlur-synced) */
  localDescription: string;
  setLocalDescription: (v: string) => void;
  commitDescription: () => void;

  /** Local controlled state for notes (onBlur-synced) */
  localNotes: string;
  setLocalNotes: (v: string) => void;
  commitNotes: () => void;

  /**
   * Generic property change handler.
   * Empty string → undefined to keep the model clean.
   */
  handlePropertyChange: (field: keyof P, value: unknown) => void;
}

// ==================== HOOK ====================

export function useElementForm<P extends BaseElementProperties>(
  element: DFDElement,
  onChange: (updates: Partial<DFDElement>) => void,
): UseElementFormResult<P> {
  const props = element.properties as P;
  const assetRels = element.assetRelations ?? [];

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Local text state — onBlur pattern avoids excessive re-renders
  const [localDescription, setLocalDescription] = useState(
    props.description || "",
  );
  const [localNotes, setLocalNotes] = useState(props.notes || "");

  // Sync when element changes externally (e.g. undo, external update)
  useEffect(() => {
    setLocalDescription((element.properties as P).description || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(element.properties as P).description]);

  useEffect(() => {
    setLocalNotes((element.properties as P).notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(element.properties as P).notes]);

  // Commit helpers — called on onBlur
  // NOTE: description is stored in properties.description, not on a top-level
  // element.description — that field does not exist in the persisted schema
  // (verified against real project data: DFDElement's only top-level keys are
  // assetRelations/displayId/id/name/position/properties/size/type). An
  // earlier version of this hook wrote to element.description directly,
  // which was silently lost on save/reload.
  //
  // The element property UNION (ProcessProperties | ... ) does not declare
  // `description` (unlike `notes`, which is inline on every member — hence
  // commitNotes needs no cast). The merged literal is therefore cast to the
  // union to suppress the excess-property check. This mirrors the existing
  // read-site casts (e.g. dfd-description-view.tsx). The type-honest
  // alternative is to declare `description?: string` on the properties union
  // in dfd-types.ts, which makes this cast unnecessary.
  const commitDescription = useCallback(() => {
    const current = (element.properties as P).description;
    if (localDescription !== (current || "")) {
      onChange({
        properties: {
          ...element.properties,
          description: localDescription || undefined,
        } as DFDElement["properties"],
      });
    }
  }, [localDescription, element.properties, onChange]);

  const commitNotes = useCallback(() => {
    const current = (element.properties as P).notes;
    if (localNotes !== (current || "")) {
      onChange({
        properties: {
          ...element.properties,
          notes: localNotes || undefined,
        },
      });
    }
  }, [localNotes, element.properties, onChange]);

  // Generic property change — empty string → undefined
  const handlePropertyChange = useCallback(
    (field: keyof P, value: unknown) => {
      onChange({
        properties: {
          ...element.properties,
          [field as string]: value === "" ? undefined : value,
        },
      });
    },
    [element.properties, onChange],
  );

  return {
    activeTab,
    setActiveTab,
    props,
    assetRels,
    localDescription,
    setLocalDescription,
    commitDescription,
    localNotes,
    setLocalNotes,
    commitNotes,
    handlePropertyChange,
  };
}