import { describe, it, expect } from "vitest";
// NOTE: align relative paths with the sibling tests in this folder.
import { dfdChangeDetector } from "../../../../../features/dfd/utils/dfd-change-detector";
import type {
  DFDElement,
  DFDConnection,
} from "features/dfd";

/**
 * Level 1b — Identity. A rename / renumber / retype keeps the topology but the
 * threat layer mirrors element identity (threat ids encode the displayId,
 * linkedElement mirrors name/type). The detector must force a rebuild so the
 * reused graph doesn't keep stale names; pure property edits must still take
 * the cheap (no-rebuild) path.
 */

function el(over: Partial<DFDElement> = {}): DFDElement {
  return {
    id: "e1",
    type: "Process",
    name: "Auth",
    displayId: "P-1",
    position: { x: 0, y: 0 },
    size: { width: 80, height: 40 },
    ...over,
  } as DFDElement;
}

function conn(over: Partial<DFDConnection> = {}): DFDConnection {
  return {
    id: "c1",
    from: "e1",
    to: "e2",
    label: "cmd",
    name: "cmd",
    displayId: "DF-1",
    ...over,
  } as DFDConnection;
}

describe("DFDChangeDetector — identity level", () => {
  it("no change → no rebuild", () => {
    const r = dfdChangeDetector.detect([el()], [conn()], [el()], [conn()]);
    expect(r.level).toBe("none");
    expect(r.requiresRebuild).toBe(false);
  });

  it("element name change → identity rebuild", () => {
    const r = dfdChangeDetector.detect(
      [el({ name: "Old" })],
      [conn()],
      [el({ name: "New" })],
      [conn()],
    );
    expect(r.level).toBe("identity");
    expect(r.requiresRebuild).toBe(true);
  });

  it("element displayId change (renumber) → identity rebuild", () => {
    const r = dfdChangeDetector.detect(
      [el({ displayId: "P-1" })],
      [conn()],
      [el({ displayId: "P-2" })],
      [conn()],
    );
    expect(r.level).toBe("identity");
    expect(r.requiresRebuild).toBe(true);
  });

  it("element type change → identity rebuild", () => {
    const r = dfdChangeDetector.detect(
      [el({ type: "Process" })],
      [conn()],
      [el({ type: "DataStore" })],
      [conn()],
    );
    expect(r.level).toBe("identity");
    expect(r.requiresRebuild).toBe(true);
  });

  it("connection label change → identity rebuild", () => {
    const r = dfdChangeDetector.detect(
      [el()],
      [conn({ name: "cmd" })],
      [el()],
      [conn({ name: "status" })],
    );
    expect(r.level).toBe("identity");
    expect(r.requiresRebuild).toBe(true);
  });

  it("connection displayId change → identity rebuild", () => {
    const r = dfdChangeDetector.detect(
      [el()],
      [conn({ displayId: "DF-1" })],
      [el()],
      [conn({ displayId: "DF-2" })],
    );
    expect(r.level).toBe("identity");
    expect(r.requiresRebuild).toBe(true);
  });

  it("preserves existing behavior: added element → structural", () => {
    const r = dfdChangeDetector.detect(
      [el()],
      [conn()],
      [el(), el({ id: "e2", displayId: "P-2" })],
      [conn()],
    );
    expect(r.level).toBe("structural");
    expect(r.requiresRebuild).toBe(true);
  });

  it("preserves existing behavior: geometry move → geometry", () => {
    const r = dfdChangeDetector.detect(
      [el({ position: { x: 0, y: 0 } })],
      [conn()],
      [el({ position: { x: 120, y: 0 } })],
      [conn()],
    );
    expect(r.level).toBe("geometry");
    expect(r.requiresRebuild).toBe(true);
  });
});
