// src/tests/component/child-page-ui.test.tsx
//
// Leveled-DFD Phase 5e (leveled-dfd-multi-diagram-design.md §5.2, §12):
// question after a multiprocess with a child page was deleted, and the
// child-page section of a multiprocess in the details panel.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildPageSection, OrphanPageDialog } from "features/dfd/components/child-page-ui";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

describe("OrphanPageDialog", () => {
  const orphans = [
    { pageId: "gw", name: "Gateway", decomposes: "mp" },
    { pageId: "x", name: "Other", decomposes: "mx" },
  ];

  it("asks about the first page and deletes it on request", () => {
    const onResolve = vi.fn(async () => null);
    render(<OrphanPageDialog orphans={orphans} onResolve={onResolve} />);
    expect(screen.getByText(/page "Gateway" was deleted/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("orphan-delete"));
    expect(onResolve).toHaveBeenCalledWith("gw", true);
  });

  it("stays open and shows the error when draw.io did not delete the page", async () => {
    const onResolve = vi.fn(async () => "page not removed: gw");
    render(<OrphanPageDialog orphans={orphans} onResolve={onResolve} />);
    fireEvent.click(screen.getByTestId("orphan-delete"));
    expect((await screen.findByTestId("orphan-error")).textContent).toContain("page not removed: gw");
    expect(screen.getByTestId("orphan-page-dialog")).toBeTruthy();
  });

  it("keeps the page", () => {
    const onResolve = vi.fn(async () => null);
    render(<OrphanPageDialog orphans={orphans} onResolve={onResolve} />);
    fireEvent.click(screen.getByTestId("orphan-keep"));
    expect(onResolve).toHaveBeenCalledWith("gw", false);
  });

  it("renders nothing without orphan pages", () => {
    const { container } = render(<OrphanPageDialog orphans={[]} onResolve={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("ChildPageSection", () => {
  it("names the child page", () => {
    render(<ChildPageSection info={{ pageName: "Gateway" }} />);
    expect(screen.getByText(/Detailed on page "Gateway"/)).toBeTruthy();
    expect(screen.queryByTestId("child-page-create")).toBeNull();
  });

  it("opens the child page with a button — a double-click in draw.io edits the label", () => {
    const onOpen = vi.fn();
    render(<ChildPageSection info={{ pageName: "Gateway", onOpen }} />);
    expect(screen.getByTestId("child-page-section").textContent).not.toContain("double-click");
    fireEvent.click(screen.getByTestId("child-page-open"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("has no open button without the draw.io plugin", () => {
    render(<ChildPageSection info={{ pageName: "Gateway" }} />);
    expect(screen.queryByTestId("child-page-open")).toBeNull();
  });

  it("offers to create a child page", () => {
    const onCreate = vi.fn();
    render(<ChildPageSection info={{ onCreate }} />);
    fireEvent.click(screen.getByTestId("child-page-create"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("only informs without the draw.io plugin", () => {
    render(<ChildPageSection info={{}} />);
    expect(screen.getByText(/No child page/)).toBeTruthy();
    expect(screen.queryByTestId("child-page-create")).toBeNull();
  });

  it("syncs the context and reports the result", async () => {
    const onSyncContext = vi.fn(async () => 3);
    render(<ChildPageSection info={{ pageName: "Gateway", onSyncContext }} />);
    fireEvent.click(screen.getByTestId("child-page-sync"));
    expect((await screen.findByTestId("child-page-sync-result")).textContent).toBe(
      "3 context copies added.",
    );
  });

  it("says when the context is complete, and shows an error", async () => {
    const results: (number | string)[] = [0, "busy"];
    const onSyncContext = vi.fn(async () => results.shift()!);
    render(<ChildPageSection info={{ pageName: "Gateway", onSyncContext }} />);
    fireEvent.click(screen.getByTestId("child-page-sync"));
    expect((await screen.findByTestId("child-page-sync-result")).textContent).toMatch(/already shows/);
    fireEvent.click(screen.getByTestId("child-page-sync"));
    await vi.waitFor(() =>
      expect(screen.getByTestId("child-page-sync-result").textContent).toMatch(/busy/),
    );
  });
});
