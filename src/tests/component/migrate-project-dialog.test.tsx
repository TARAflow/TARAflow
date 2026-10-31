// src/tests/component/migrate-project-dialog.test.tsx

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MigrateProjectDialog } from "app/components/dialogs/migrate-project-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

afterEach(cleanup);

const prompt = {
  projectName: "Smoke",
  filePath: "/p/s.tara.json",
  fromVersion: 6,
  toVersion: 8,
  backupPath: "/p/s.tara.v6.backup.json",
};

describe("MigrateProjectDialog", () => {
  it("lists one reason per step and shows the backup path", () => {
    render(<MigrateProjectDialog prompt={prompt} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("dialogs.migrateProject.reasons.v7")).toBeTruthy();
    expect(screen.getByText("dialogs.migrateProject.reasons.v8")).toBeTruthy();
    expect(screen.queryByText("dialogs.migrateProject.reasons.v6")).toBeNull();
    expect(screen.getByText("/p/s.tara.v6.backup.json")).toBeTruthy();
  });

  it("confirm and cancel call their handlers", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<MigrateProjectDialog prompt={prompt} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("dialogs.migrateProject.confirm"));
    fireEvent.click(screen.getByText("common.cancel"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("a long list of reasons scrolls; the buttons stay outside the scrolling area (0.16.1-beta)", () => {
    render(<MigrateProjectDialog prompt={{ ...prompt, fromVersion: 0, toVersion: 11 }} onConfirm={() => {}} onCancel={() => {}} />);
    const content = screen.getByTestId("migrate-project-content");
    const actions = screen.getByTestId("migrate-project-actions");
    expect(content.className).toContain("overflow-y-auto");
    expect(content.contains(screen.getByText("dialogs.migrateProject.reasons.v11"))).toBe(true);
    expect(content.contains(screen.getByText("dialogs.migrateProject.confirm"))).toBe(false);
    expect(actions.contains(screen.getByText("dialogs.migrateProject.confirm"))).toBe(true);
    expect(actions.className).toContain("flex-shrink-0");
    expect(content.parentElement!.className).toContain("max-h-[90vh]");
  });
});
