// src/tests/component/parent-level-flows-banner.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md §6.5, 5j): the threats
// tab names the data flows analysed on a parent level.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParentLevelFlowsBanner } from "features/threats/components/parent-level-flows-banner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const FLOWS = [
  { tfId: "df7", label: "DF-7 stream", from: "P-2 Sensor", to: "MP-2 Controller", reason: "unresolved" as const },
  { tfId: "df9", label: "DF-9 calib", from: "MP-1 Sensor", to: "P-5 Alarm", reason: "ambiguous" as const },
];

describe("ParentLevelFlowsBanner", () => {
  it("shows the count and lists the flows on request", () => {
    render(<ParentLevelFlowsBanner flows={FLOWS} />);
    expect(screen.getByText(/^2 data flow\(s\) analysed on a parent level/)).toBeTruthy();
    fireEvent.click(screen.getByText("Show"));
    expect(screen.getByText("DF-7 stream")).toBeTruthy();
    expect(screen.getByText("(P-2 Sensor → MP-2 Controller)")).toBeTruthy();
    expect(screen.getByText("not drawn on the child page of the multiprocess")).toBeTruthy();
    expect(screen.getByText(/analysed at their common parent/)).toBeTruthy();
  });

  it("renders nothing without such flows", () => {
    const { container } = render(<ParentLevelFlowsBanner flows={[]} />);
    expect(container.innerHTML).toBe("");
    render(<ParentLevelFlowsBanner flows={undefined} />);
    expect(screen.queryByTestId("parent-level-flows-banner")).toBeNull();
  });
});
