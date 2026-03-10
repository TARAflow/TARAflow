// ==================== USE CONNECTION FORM HOOK ====================
// Shared state logic for DFD connection description forms (DataFlow).
// Analog to useElementForm, but for DFDConnection:
//   - properties is optional on DFDConnection
//   - description lives on DFDBaseEntity (same)
//   - no element.type (caller passes "DataFlow" explicitly)
//
// Usage:
//   const form = useConnectionForm<DataFlowProperties>(connection, onChange);
//   <input value={form.localDescription} onChange={...} onBlur={form.commitDescription} />

import { useState, useCallback, useEffect } from "react";
import type { DFDConnection } from "../models/dfd-types";

// ==================== BASE CONSTRAINT ====================
// All connection property types must have at least `notes?: string`.

interface BaseConnectionProperties {
  notes?: string;
}

// ==================== TYPES ====================

export interface UseConnectionFormResult<P extends BaseConnectionProperties> {
  /** Typed connection properties (never undefined — falls back to empty object) */
  props: P;

  /** Asset relations shorthand */
  assetRels: NonNullable<DFDConnection["assetRelations"]>;

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

export function useConnectionForm<P extends BaseConnectionProperties>(
  connection: DFDConnection,
  onChange: (updates: Partial<DFDConnection>) => void,
): UseConnectionFormResult<P> {
  // properties is optional on DFDConnection — normalise to empty object
  const props = (connection.properties ?? {}) as P;
  const assetRels = connection.assetRelations ?? [];

  // Local text state — onBlur pattern avoids excessive re-renders
  const [localDescription, setLocalDescription] = useState(
    connection.description || "",
  );
  const [localNotes, setLocalNotes] = useState(props.notes || "");

  // Sync when connection changes externally (e.g. undo, external update)
  useEffect(() => {
    setLocalDescription(connection.description || "");
  }, [connection.description]);

  useEffect(() => {
    setLocalNotes(((connection.properties ?? {}) as P).notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(connection.properties as P | undefined)?.notes]);

  // Commit helpers — called on onBlur
  const commitDescription = useCallback(() => {
    if (localDescription !== (connection.description || "")) {
      onChange({ description: localDescription || undefined });
    }
  }, [localDescription, connection.description, onChange]);

  const commitNotes = useCallback(() => {
    const current = ((connection.properties ?? {}) as P).notes;
    if (localNotes !== (current || "")) {
      onChange({
        properties: {
          ...(connection.properties ?? {}),
          notes: localNotes || undefined,
        },
      });
    }
  }, [localNotes, connection.properties, onChange]);

  // Generic property change — empty string → undefined
  const handlePropertyChange = useCallback(
    (field: keyof P, value: unknown) => {
      onChange({
        properties: {
          ...(connection.properties ?? {}),
          [field as string]: value === "" ? undefined : value,
        },
      });
    },
    [connection.properties, onChange],
  );

  return {
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