// The file dialog of "Open project" starts in the open project's folder;
// without an open project the main process starts it at home (user
// 2026-11-14: it always opened in the same place).
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenProjectDialog } from "app/components/dialogs/open-project-dialog";

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({ t: (k: string, opt?: { defaultValue?: string }) => opt?.defaultValue ?? k, i18n: { language: "en" } }),
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
afterEach(() => {
  cleanup();
  delete (window as Any).electron;
});

function open(defaultDir?: string) {
  const openDialog = vi.fn().mockResolvedValue({ success: false, error: "Open canceled" });
  (window as Any).electron = { file: { openDialog } };
  render(
    <OpenProjectDialog recentProjects={[]} onOpen={() => {}} onOpenFile={() => {}} onClose={() => {}} {...(defaultDir ? { defaultDir } : {})} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Browse File/ }));
  return openDialog;
}

describe("Open project: where the file dialog starts", () => {
  it("in the folder of the open project", () => {
    expect(open("/home/me/examples/import-example")).toHaveBeenCalledWith("/home/me/examples/import-example");
  });
  it("without an open project: no folder — the main process uses home", () => {
    expect(open()).toHaveBeenCalledWith(undefined);
  });
});
