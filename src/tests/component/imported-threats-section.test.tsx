// src/tests/component/imported-threats-section.test.tsx
// Multi-project TARA, patch 14: the Threats tab shows the threats of
// imported components read-only, grouped per instance.
// Manual test 2026-11-07: only the active method's threats; a row opens the
// threat read-only. I5 (patch 31): a component with several instances shows
// each threat once with a line per instance.
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

  describe("several instances of one component (I5)", () => {
    const copy = (prefix: string, id: string, relevance: string) => threat(`${prefix}-${id}`, `${prefix}:${id}`, relevance);
    const rowsFor = (prefix: string, overrideFirst = false) => [
      { threat: copy(prefix, "DF7-T-1", "relevant"), threatKey: "k1", componentRelevance: "relevant", boundary: true, method: "per-element",
        ...(overrideFirst ? { override: { relevance: "not_relevant", rationale: "inside the cabinet", date: "d" } } : {}) },
      { threat: copy(prefix, "P3-T-1", "not_relevant"), threatKey: "k2", componentRelevance: "not_relevant", boundary: false, method: "per-element" },
    ];
    const groups = [
      { key: "i1", label: "SD1 · Smoke Detector", prefix: "SD1", componentKey: "imp", componentLabel: "Smoke Detector", threats: [], rows: rowsFor("SD1") },
      { key: "i2", label: "SD2 · Smoke Detector ×2", prefix: "SD2", componentKey: "imp", componentLabel: "Smoke Detector", threats: [], rows: rowsFor("SD2", true) },
    ] as never;

    it("each threat once, without the prefix, a line per instance with its decision", () => {
      render(<ImportedThreatsSection groups={groups} method="per-element" onOverrideRelevance={vi.fn()} />);
      expect(screen.getByTestId("imported-threats-section").textContent).toContain("(2)");
      fireEvent.click(screen.getByText(/Threats from imported components/));
      const table = screen.getByTestId("imported-component-imp");
      expect(table.textContent).toContain("instances: SD1 · Smoke Detector, SD2 · Smoke Detector ×2");
      const row = screen.getByTestId("imported-component-threat-k1");
      expect(row.textContent).toContain("DF7-T-1");
      expect(row.textContent).not.toContain("SD1:DF7-T-1");
      expect(screen.getByTestId("imported-component-threat-k1-i1").textContent).toContain("relevant");
      expect(screen.getByTestId("imported-component-threat-k1-i2").textContent).toContain("machine: not_relevant");
      // per-instance tables are not shown for such a component
      expect(screen.queryByTestId("imported-threats-i1")).toBeNull();
    });

    it("the override acts on its instance; boundary threats only", () => {
      const onOverride = vi.fn();
      render(<ImportedThreatsSection groups={groups} method="per-element" onOverrideRelevance={onOverride} />);
      fireEvent.click(screen.getByText(/Threats from imported components/));
      expect(screen.queryByTestId("imported-component-threat-edit-k2-i1")).toBeNull();
      fireEvent.click(screen.getByTestId("imported-component-threat-edit-k1-i2"));
      fireEvent.click(screen.getByTestId("imported-threat-override-remove"));
      expect(onOverride).toHaveBeenCalledWith("i2", "k1", null);
    });

    it("a click opens the threat read-only, browsing the component's threats once", () => {
      const onOpen = vi.fn();
      render(<ImportedThreatsSection groups={groups} method="per-element" onOpenThreat={onOpen} />);
      fireEvent.click(screen.getByText(/Threats from imported components/));
      fireEvent.click(screen.getByTestId("imported-component-threat-k2"));
      const [group, threats, index] = onOpen.mock.calls[0];
      expect(group).toEqual({ key: "i1", label: "SD1 · Smoke Detector" });
      expect(threats.map((t: { id: string }) => t.id)).toHaveLength(2);
      expect(threats[index].id).toBe("SD1-P3-T-1");
    });

    it("a component with one instance keeps the instance table", () => {
      render(<ImportedThreatsSection groups={[(groups as never[])[0]]} method="per-element" />);
      fireEvent.click(screen.getByText(/Threats from imported components/));
      expect(screen.getByTestId("imported-threats-i1")).toBeTruthy();
      expect(screen.queryByTestId("imported-component-imp")).toBeNull();
    });
  });
});
