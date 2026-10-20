// src/tests/component/group-accordions.test.tsx
//
// The generic group accordion of the asset, threat and risk tables
// (review finding: one component instead of three copies).
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GroupAccordions, type GroupAccordionSection } from "shared";

afterEach(cleanup);

const sections: GroupAccordionSection[] = [
  { key: "top", label: "Top level", count: 2, render: () => <div data-testid="content-top">top</div> },
  { key: "mp1", label: "MP-1", count: 3, hint: "a hint", render: () => <div data-testid="content-mp1">mp1</div> },
];

describe("GroupAccordions", () => {
  it("shows label, count and hint per group, and the content while open", () => {
    render(<GroupAccordions testIdPrefix="g" sections={sections} />);
    const mp1 = screen.getByTestId("g-mp1");
    expect(within(mp1).getByText("MP-1")).toBeTruthy();
    expect(within(mp1).getByText("3")).toBeTruthy();
    expect(within(mp1).getByText("a hint")).toBeTruthy();
    expect(screen.getByTestId("content-mp1")).toBeTruthy();
    // Collapsed: the content is not rendered.
    fireEvent.click(within(mp1).getByText("MP-1"));
    expect(screen.queryByTestId("content-mp1")).toBeNull();
  });

  it("shows summary rows in one group; the link opens the other group", () => {
    render(
      <GroupAccordions
        testIdPrefix="g"
        sections={sections}
        summaries={{ inGroup: "top", openLabel: "Details", rows: [{ key: "mp1", label: "MP-1", figures: <span>3 items</span> }] }}
      />,
    );
    fireEvent.click(within(screen.getByTestId("g-mp1")).getByText("MP-1"));
    expect(screen.queryByTestId("content-mp1")).toBeNull();
    const row = within(screen.getByTestId("g-summaries")).getByTestId("g-summary-mp1");
    expect(row.textContent).toContain("3 items");
    fireEvent.click(within(row).getByText("Details"));
    expect(screen.getByTestId("content-mp1")).toBeTruthy();
  });

  it("opens a group on request from outside", () => {
    const { rerender } = render(<GroupAccordions testIdPrefix="g" sections={sections} />);
    fireEvent.click(within(screen.getByTestId("g-mp1")).getByText("MP-1"));
    expect(screen.queryByTestId("content-mp1")).toBeNull();
    rerender(<GroupAccordions testIdPrefix="g" sections={sections} openRequest={{ key: "mp1" }} />);
    expect(screen.getByTestId("content-mp1")).toBeTruthy();
  });
});
