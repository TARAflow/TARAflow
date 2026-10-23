// Dev check: a banner when the running Electron part is older than its
// sources — instead of an app change that looks broken.
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ElectronBuildNotice } from "app/dev/electron-build-notice";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }),
}));

afterEach(() => {
  cleanup();
  delete (window as { electronAPI?: unknown }).electronAPI;
});

const withRunning = (hash: string | null) => {
  (window as { electronAPI?: unknown }).electronAPI = {
    getElectronBuildInfo: () => Promise.resolve(hash === null ? null : { hash }),
  };
};

describe("ElectronBuildNotice", () => {
  it("nothing while the running build matches the sources", async () => {
    withRunning("abc");
    render(<ElectronBuildNotice sourceHash="abc" />);
    await act(async () => {});
    expect(screen.queryByTestId("electron-build-outdated")).toBeNull();
  });

  it("the banner when an Electron source changed while the app runs", async () => {
    withRunning("abc");
    let push: (hash: string | null) => void = () => {};
    render(<ElectronBuildNotice sourceHash="abc" subscribe={(l) => ((push = l), () => {})} />);
    await act(async () => {});
    act(() => push("def"));
    expect(screen.getByTestId("electron-build-outdated").textContent).toContain("npm run dev:electron");
  });

  it("the banner for an Electron part built before the check existed", async () => {
    (window as { electronAPI?: unknown }).electronAPI = {};
    render(<ElectronBuildNotice sourceHash="abc" />);
    await act(async () => {});
    expect(screen.getByTestId("electron-build-outdated")).toBeTruthy();
  });

  it("nothing in production (no source hash) or outside Electron", async () => {
    withRunning("abc");
    render(<ElectronBuildNotice sourceHash={null} />);
    await act(async () => {});
    expect(screen.queryByTestId("electron-build-outdated")).toBeNull();
  });
});
