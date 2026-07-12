// tests/unit/features/attacktree/hooks/use-attacktree-data.test.tsx
//
// useAttackTreeData.createTree is the exact seam where the template bug lived:
// AttackTreeCreateDialog called onCreate(anchor, templateId), but the hook's
// signature only took (anchor) — so templateId was silently dropped by JS and
// every tree came out empty. TypeScript could not catch it: passing an extra
// argument to a narrower function type is legal at the call site.
//
// The signature is therefore pinned at the hook boundary, not just in
// attacktree-operations (which was always correct).

import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAttackTreeData } from "features/attacktree/hooks/use-attacktree-data";
import type { AttackTreeAnchor } from "features/attacktree/models/attacktree-types";
import { makeProjectData } from "../attacktree-factory";

const ASSET_ANCHOR: AttackTreeAnchor = {
  type: "asset",
  assetId: "A-001",
  assetName: "Config Database",
  securityGoal: "C",
};

function setup() {
  const onUpdate = vi.fn();
  const project = makeProjectData();
  const view = renderHook(() => useAttackTreeData(project, onUpdate));
  return { ...view, onUpdate, project };
}

describe("useAttackTreeData — createTree", () => {
  it("starts with no trees", () => {
    const { result } = setup();

    expect(result.current.hasTrees).toBe(false);
    expect(result.current.selectedTreeId).toBeNull();
  });

  it("creates an empty tree when no template is given", () => {
    const { result } = setup();

    act(() => {
      result.current.createTree(ASSET_ANCHOR);
    });

    expect(result.current.attackTreeData.trees).toHaveLength(1);
    expect(result.current.selectedTreeId).toBe(
      result.current.attackTreeData.trees[0].id,
    );
  });

  it("REGRESSION: createTree(anchor, templateId) actually uses the template", () => {
    const { result } = setup();

    act(() => {
      result.current.createTree(ASSET_ANCHOR);
    });
    const emptyDsl = result.current.attackTreeData.trees[0].dsl;

    act(() => {
      result.current.createTree(ASSET_ANCHOR, "template-confidentiality");
    });
    const templatedDsl = result.current.attackTreeData.trees[1].dsl;

    // Before the fix these two were byte-identical.
    expect(templatedDsl).not.toBe(emptyDsl);
    expect(templatedDsl).toContain("Unauthorized Data Access");
  });

  it("a templated tree arrives parsed, so the diagram can render immediately", () => {
    const { result } = setup();

    act(() => {
      result.current.createTree(ASSET_ANCHOR, "template-confidentiality");
    });

    const tree = result.current.attackTreeData.trees[0];
    expect(tree.ast).toBeDefined();
    expect(tree.pathAnalysis?.totalPaths).toBeGreaterThan(0);
  });

  it("falls back to an empty tree for an unknown template id rather than creating nothing", () => {
    const { result } = setup();

    act(() => {
      result.current.createTree(ASSET_ANCHOR, "template-does-not-exist");
    });

    expect(result.current.attackTreeData.trees).toHaveLength(1);
  });

  it("marks the data dirty and auto-saves through onUpdate", async () => {
    const { result, onUpdate } = setup();

    act(() => {
      result.current.createTree(ASSET_ANCHOR);
    });
    expect(result.current.isDirty).toBe(true);

    await waitFor(() => expect(onUpdate).toHaveBeenCalled(), { timeout: 3000 });

    const payload = onUpdate.mock.calls[0][0];
    expect(payload.attackTrees.trees).toHaveLength(1);
  });
});

describe("useAttackTreeData — deleteTree", () => {
  it("removes the tree and re-selects a remaining one", () => {
    const { result } = setup();

    act(() => {
      result.current.createTree(ASSET_ANCHOR);
    });
    act(() => {
      result.current.createTree(ASSET_ANCHOR);
    });
    const [first, second] = result.current.attackTreeData.trees;

    act(() => {
      result.current.deleteTree(second.id);
    });

    expect(result.current.attackTreeData.trees).toHaveLength(1);
    expect(result.current.selectedTreeId).toBe(first.id);
  });
});
