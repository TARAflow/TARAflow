// src/tests/component/project-info-rating-loss.test.tsx
//
// Saving a tag change that deletes risk ratings asks first (user 2026-11-21).

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectInfo } from "features/overview/components/project-info";
import type { ProjectInfoData, RatingLoss } from "features/overview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      String((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const info = {
  name: "Machine",
  description: "",
  version: "1",
  team: [],
  created: "2026-11-01T00:00:00.000Z",
  lastModified: "2026-11-01T00:00:00.000Z",
  tags: { domain: [], platform: [], custom: [], regulation: ["ETSI TVRA", "EN 50742 A"] },
} as unknown as ProjectInfoData;

const LOSS: RatingLoss = {
  factors: [{ id: "attacker_capability", name: "Attacker Capability" }],
  ratings: 3,
  risks: 2,
};

/** Edit, remove EN 50742 A, save. */
function removeA() {
  fireEvent.click(screen.getByText("common.edit"));
  const pill = Array.from(document.querySelectorAll<HTMLElement>("span.rounded-full")).find((p) => p.textContent?.includes("EN 50742 A"));
  fireEvent.click(pill!.querySelector("button")!);
  fireEvent.click(screen.getByText("common.save"));
}

describe("ProjectInfo — tag change that deletes ratings", () => {
  it("asks; cancel keeps the project unchanged", () => {
    const onUpdate = vi.fn();
    const ratingLossOf = vi.fn(() => LOSS);
    render(<ProjectInfo info={info} onUpdate={onUpdate} ratingLossOf={ratingLossOf} />);
    removeA();
    expect(ratingLossOf).toHaveBeenCalledWith(expect.objectContaining({ regulation: ["ETSI TVRA"] }));
    const dialog = screen.getByTestId("rating-loss-dialog");
    expect(dialog.textContent).toContain("3 ratings on 2 risks");
    expect(dialog.textContent).toContain("Attacker Capability");
    expect(dialog.textContent).toContain("restored from the repository");
    fireEvent.click(screen.getByText("common.cancel", { selector: "[data-testid='rating-loss-dialog'] *" }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("confirm saves", () => {
    const onUpdate = vi.fn();
    render(<ProjectInfo info={info} onUpdate={onUpdate} ratingLossOf={() => LOSS} />);
    removeA();
    fireEvent.click(screen.getByText("Change tags and delete ratings"));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ tags: expect.objectContaining({ regulation: ["ETSI TVRA"] }) }));
  });

  it("no loss, or the tags unchanged: saved without asking", () => {
    const onUpdate = vi.fn();
    const ratingLossOf = vi.fn(() => undefined);
    render(<ProjectInfo info={info} onUpdate={onUpdate} ratingLossOf={ratingLossOf} />);
    removeA();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("rating-loss-dialog")).toBeNull();

    cleanup();
    const unchanged = vi.fn(() => LOSS);
    const onUpdate2 = vi.fn();
    render(<ProjectInfo info={info} onUpdate={onUpdate2} ratingLossOf={unchanged} />);
    fireEvent.click(screen.getByText("common.edit"));
    fireEvent.click(screen.getByText("common.save"));
    expect(unchanged).not.toHaveBeenCalled();
    expect(onUpdate2).toHaveBeenCalledTimes(1);
  });
});
