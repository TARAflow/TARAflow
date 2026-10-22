// Leveled-DFD Phase 1.2 — lazy identity links (design §5.2).
import { describe, it, expect } from "vitest";
import {
  collectCellIdentities,
  identityOf,
} from "features/dfd/services/parsers/identity-reader";
import type { DFDCellLink } from "features/dfd/models/dfd-types";

const ref = (cellId: string, tfId: string): DFDCellLink => ({
  cellId,
  tfId,
  role: "ref",
});

describe("collectCellIdentities", () => {
  it("treats every cell as a plain definition without links", () => {
    const ids = collectCellIdentities(undefined);
    expect(ids.size).toBe(0);
    expect(identityOf(ids, "a")).toEqual({ tfId: "a", role: "definition" });
  });

  it("reads a context copy", () => {
    const ids = collectCellIdentities([ref("sen_mp2", "mp2")]);
    expect(identityOf(ids, "sen_mp2")).toEqual({ tfId: "mp2", role: "ref" });
  });

  it("reads a definition with an identity other than its cell id", () => {
    const ids = collectCellIdentities([
      { cellId: "new_cell", tfId: "mp2", role: "definition" },
    ]);
    expect(identityOf(ids, "new_cell")).toEqual({
      tfId: "mp2",
      role: "definition",
    });
  });

  it("ignores malformed links instead of guessing", () => {
    const ids = collectCellIdentities([
      ref("", "mp1"),
      ref("c", " "),
      { cellId: "e", tfId: "e", role: "definition" }, // says nothing
    ]);
    expect(ids.size).toBe(0);
  });

  it("accepts a ref whose tfId equals its own cell id (former definition after a move)", () => {
    const ids = collectCellIdentities([ref("mp2", "mp2")]);
    expect(identityOf(ids, "mp2")).toEqual({ tfId: "mp2", role: "ref" });
  });

  it("keeps the first link of a cell", () => {
    const ids = collectCellIdentities([ref("x", "mp1"), ref("x", "mp2")]);
    expect(identityOf(ids, "x")).toEqual({ tfId: "mp1", role: "ref" });
  });

  it("treats an unknown role as definition", () => {
    const ids = collectCellIdentities([
      { cellId: "f", tfId: "mp1", role: "copy" as never },
    ]);
    expect(identityOf(ids, "f")).toEqual({ tfId: "mp1", role: "definition" });
  });
});
