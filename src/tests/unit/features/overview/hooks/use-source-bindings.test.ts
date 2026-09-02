// src/features/overview/hooks/use-source-bindings.test.ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SourceBinding } from "shared";
import { useSourceBindings } from "features/overview/hooks/use-source-bindings";

const existing: SourceBinding = {
  id: "existing-1",
  repoUrl: "https://github.com/org/repo.git",
  refType: "tag",
  refLabel: "v1.0.0",
  driftEvents: [],
};

describe("useSourceBindings", () => {
  it("starts not editing, with draft seeded from the initial bindings", () => {
    const { result } = renderHook(() => useSourceBindings([existing]));

    expect(result.current.isEditing).toBe(false);
    expect(result.current.draft).toEqual([existing]);
  });

  it("startEdit(current) enters edit mode and seeds the draft from what's passed in", () => {
    const { result } = renderHook(() => useSourceBindings([]));

    act(() => result.current.startEdit([existing]));

    expect(result.current.isEditing).toBe(true);
    expect(result.current.draft).toEqual([existing]);
  });

  it("cancelEdit(current) exits edit mode and discards in-progress draft changes", () => {
    const { result } = renderHook(() => useSourceBindings([existing]));

    act(() => result.current.startEdit([existing]));
    act(() => result.current.addRow());
    expect(result.current.draft).toHaveLength(2);

    act(() => result.current.cancelEdit([existing]));

    expect(result.current.isEditing).toBe(false);
    expect(result.current.draft).toEqual([existing]);
  });

  it("addRow appends one empty, unresolved row to the draft", () => {
    const { result } = renderHook(() => useSourceBindings([existing]));
    act(() => result.current.startEdit([existing]));

    act(() => result.current.addRow());

    expect(result.current.draft).toHaveLength(2);
    const added = result.current.draft[1];
    expect(added.repoUrl).toBe("");
    expect(added.refLabel).toBe("");
    expect(added.refType).toBe("branch");
    expect(added.driftEvents).toEqual([]);
    expect(added.id).not.toBe(existing.id);
  });

  it("addRow twice produces two rows with distinct ids", () => {
    const { result } = renderHook(() => useSourceBindings([]));
    act(() => result.current.startEdit([]));

    act(() => result.current.addRow());
    act(() => result.current.addRow());

    const [first, second] = result.current.draft;
    expect(first.id).not.toBe(second.id);
  });

  it("updateRow patches only the matching row by id, leaving others untouched", () => {
    const other: SourceBinding = {
      id: "other-1",
      repoUrl: "https://github.com/org/other.git",
      refType: "branch",
      refLabel: "main",
      driftEvents: [],
    };
    const { result } = renderHook(() =>
      useSourceBindings([existing, other]),
    );
    act(() => result.current.startEdit([existing, other]));

    act(() =>
      result.current.updateRow(existing.id, { refLabel: "v1.0.1" }),
    );

    const updated = result.current.draft.find((r) => r.id === existing.id);
    const untouched = result.current.draft.find((r) => r.id === other.id);
    expect(updated?.refLabel).toBe("v1.0.1");
    expect(untouched).toEqual(other);
  });

  it("removeRow drops exactly the matching row", () => {
    const other: SourceBinding = {
      id: "other-1",
      repoUrl: "https://github.com/org/other.git",
      refType: "branch",
      refLabel: "main",
      driftEvents: [],
    };
    const { result } = renderHook(() =>
      useSourceBindings([existing, other]),
    );
    act(() => result.current.startEdit([existing, other]));

    act(() => result.current.removeRow(existing.id));

    expect(result.current.draft).toEqual([other]);
  });
});
