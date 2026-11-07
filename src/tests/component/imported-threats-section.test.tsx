// src/tests/component/imported-threats-section.test.tsx
// Multi-project TARA, patch 14: the Threats tab shows the threats of
// imported components read-only, grouped per instance.
// Manual test 2026-11-07: only the active method's threats; a row opens the
// threat read-only.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportedThreatsSection } from "features/threats/components/shared/imported-threats-section";

vi.mock("react-i18next", async (o) => ({
  ...(await o<object>()),
  useTranslation: () => ({
    t: (k: string, opt?: Record<string, unknown>) =>
      ((opt?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(opt?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const threat = (id: string, displayId: string, relevance: string) =>
  ({
    id,
    displayId,
    strideCategory: "T",
    linkedElement: { elementId: "e", elementName: "Sensor Controller", elementType: "Process", displayId: "SD1:P-3" },
    threatDescription: "Tamper with the sensor values",
    attackDescription: "",
    relevance,
  }) as never;

describe("ImportedThreatsSection", () => {
  it("nothing without imported threats", () => {
    const { container } = render(<ImportedThreatsSection groups={[]} />);
    expect(container.textContent).toBe("");
  });

  it("one group per instance with the component's decisions, read-only", () => {
    render(
      <ImportedThreatsSection
        groups={[
          { key: "i1", label: "SD1 · Smoke Detector", threats: [threat("a", "SD1:P3-T-1", "relevant"), threat("b", "SD1:P3-T-2", "not_relevant")] },
          { key: "i2", label: "SD2 · Smoke Detector", threats: [threat("c", "SD2:P3-T-1", "unrated")] },
        ]}
      />,
    );
    const section = screen.getByTestId("imported-threats-section");
    expect(section.textContent).toContain("Threats from imported components (3) — read-only");
    fireEvent.click(screen.getByText(/Threats from imported components/));
    expect(screen.getByTestId("imported-threats-i1").textContent).toContain("SD1:P3-T-1");
    expect(screen.getByTestId("imported-threats-i1").textContent).toContain("not_relevant");
    expect(screen.getByTestId("imported-threats-i2").textContent).toContain("SD2 · Smoke Detector");
    expect(section.querySelector("button[aria-label='delete']")).toBeNull();
  });

  it("boundary-flow threats can be overridden with a rationale; internal ones cannot", async () => {
    const onOverride = vi.fn();
    const boundary = threat("b1", "SD1:DF7-T-1", "not_relevant");
    const internal = threat("i1", "SD1:P3-T-1", "relevant");
    render(
      <ImportedThreatsSection
        groups={[{ key: "inst", label: "SD1 · Smoke Detector", threats: [boundary, internal], rows: [
          { threat: boundary, threatKey: "kb", componentRelevance: "not_relevant", boundary: true },
          { threat: internal, threatKey: "ki", componentRelevance: "relevant", boundary: false },
        ] }]}
        onOverrideRelevance={onOverride}
      />,
    );
    fireEvent.click(screen.getByText(/Threats from imported components/));
    expect(screen.queryByTestId("imported-threat-edit-ki")).toBeNull();
    fireEvent.click(screen.getByTestId("imported-threat-edit-kb"));
    const save = screen.getByTestId("imported-threat-override-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("imported-threat-override-rationale"), { target: { value: "Runs over the plant network" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onOverride).toHaveBeenCalledWith("inst", "kb", { relevance: "relevant", rationale: "Runs over the plant network", componentRelevance: "not_relevant" });
  });

  it("an override shows beside the component's decision, can be removed, and is marked to review when stale", () => {
    const onOverride = vi.fn();
    const boundary = threat("b1", "SD1:DF7-T-1", "relevant");
    render(
      <ImportedThreatsSection
        groups={[{ key: "inst", label: "SD1", threats: [boundary], rows: [
          { threat: boundary, threatKey: "kb", componentRelevance: "not_relevant", boundary: true, override: { relevance: "relevant", rationale: "network", date: "d" }, stale: true },
        ] }]}
        onOverrideRelevance={onOverride}
      />,
    );
    fireEvent.click(screen.getByText(/Threats from imported components/));
    expect(screen.getByTestId("imported-threat-override-kb").textContent).toContain("machine: relevant");
    expect(screen.getByTestId("imported-threat-kb").textContent).toContain("to review");
    fireEvent.click(screen.getByTestId("imported-threat-edit-kb"));
    fireEvent.click(screen.getByTestId("imported-threat-override-remove"));
    expect(onOverride).toHaveBeenCalledWith("inst", "kb", null);
  });

  it("shows only the active method's threats, with that count", () => {
    const el = threat("e1", "SD1:P3-T-1", "relevant");
    const ia = threat("x1", "SD1:DF7-I-1", "relevant");
    const rows = [
      { threat: el, threatKey: "e1", componentRelevance: "relevant", boundary: false, method: "per-element" },
      { threat: ia, threatKey: "x1", componentRelevance: "relevant", boundary: false, method: "per-interaction" },
    ] as never;
    const groups = [{ key: "inst", label: "SD1", threats: [el, ia], rows }];
    const { rerender } = render(<ImportedThreatsSection groups={groups} method="per-element" />);
    expect(screen.getByTestId("imported-threats-section").textContent).toContain("(1)");
    fireEvent.click(screen.getByText(/Threats from imported components/));
    expect(screen.queryByTestId("imported-threat-e1")).not.toBeNull();
    expect(screen.queryByTestId("imported-threat-x1")).toBeNull();
    rerender(<ImportedThreatsSection groups={groups} method="per-interaction" />);
    expect(screen.queryByTestId("imported-threat-x1")).not.toBeNull();
    expect(screen.queryByTestId("imported-threat-e1")).toBeNull();
    rerender(<ImportedThreatsSection groups={groups} />);
    expect(screen.getByTestId("imported-threats-section").textContent).toContain("(2)");
  });

  it("a row opens the threat with the group's shown threats; the override button does not", () => {
    const onOpen = vi.fn();
    const a = threat("a", "SD1:P3-T-1", "relevant");
    const b = threat("b", "SD1:P3-T-2", "relevant");
    render(
      <ImportedThreatsSection
        groups={[{ key: "inst", label: "SD1 · Smoke Detector", threats: [a, b], rows: [
          { threat: a, threatKey: "ka", componentRelevance: "relevant", boundary: false },
          { threat: b, threatKey: "kb", componentRelevance: "relevant", boundary: true },
        ] }]}
        onOverrideRelevance={vi.fn()}
        onOpenThreat={onOpen}
      />,
    );
    fireEvent.click(screen.getByText(/Threats from imported components/));
    fireEvent.click(screen.getByTestId("imported-threat-kb"));
    expect(onOpen).toHaveBeenCalledWith({ key: "inst", label: "SD1 · Smoke Detector" }, [a, b], 1);
    onOpen.mockClear();
    fireEvent.click(screen.getByTestId("imported-threat-edit-kb"));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId("imported-threat-override-dialog")).toBeTruthy();
  });
});
