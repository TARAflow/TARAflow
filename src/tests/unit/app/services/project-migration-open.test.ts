// src/tests/unit/app/services/project-migration-open.test.ts

import { describe, expect, it, vi } from "vitest";
import { settleMigrationOnOpen } from "app/services/project-migration-open";

const base: any = { id: "p", info: { name: "Smoke" }, filePath: "/p/s.tara.json" };
const migrated: any = {
  ...base,
  _migrated: true,
  _fromVersion: 7,
  _originalText: "ORIGINAL",
};

describe("settleMigrationOnOpen", () => {
  it("passes an up-to-date project through without writing", async () => {
    const commit = vi.fn();
    const res = await settleMigrationOnOpen(base, commit);
    expect(res).toEqual({ status: "unchanged", project: base });
    expect(commit).not.toHaveBeenCalled();
  });

  it("asks first and writes nothing when the user cancels", async () => {
    const commit = vi.fn();
    const confirm = vi.fn().mockResolvedValue(false);
    const res = await settleMigrationOnOpen(migrated, commit, confirm);
    expect(confirm).toHaveBeenCalledWith({
      projectName: "Smoke",
      filePath: "/p/s.tara.json",
      fromVersion: 7,
      toVersion: 8,
      backupPath: "/p/s.tara.v7.backup.json",
    });
    expect(res).toEqual({ status: "cancelled" });
    expect(commit).not.toHaveBeenCalled();
  });

  it("commits after consent and strips the load metadata", async () => {
    const commit = vi.fn().mockResolvedValue({ success: true });
    const res = await settleMigrationOnOpen(
      migrated,
      commit,
      vi.fn().mockResolvedValue(true),
    );
    expect(commit).toHaveBeenCalledWith("/p/s.tara.json", base, 7, "ORIGINAL");
    expect(res).toEqual({
      status: "migrated",
      project: base,
      fromVersion: 7,
      backupPath: "/p/s.tara.v7.backup.json",
    });
  });

  it("reports a failed conversion", async () => {
    const res = await settleMigrationOnOpen(
      migrated,
      vi.fn().mockResolvedValue({ success: false, error: "Backup failed" }),
    );
    expect(res).toEqual({ status: "failed", error: "Backup failed" });
  });
});
