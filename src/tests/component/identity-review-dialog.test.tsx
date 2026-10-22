// src/tests/component/identity-review-dialog.test.tsx
//
// Leveled-DFD Phase 5b (leveled-dfd-multi-diagram-design.md §11.2.1, §5.2):
// one dialog for the adoption of unadopted pages and for pasted copies.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IdentityReviewDialog,
  IdentityReviewHints,
} from "features/dfd/components/identity-review-dialog";
import {
  reviewAdoption,
  reviewCopyAssignments,
  type AdoptionDecisions,
  type CellRef,
} from "features/dfd/services/leveled";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
} from "../fixtures/leveled-dfd-xml";
import type { LeveledActionError } from "features/dfd/models/leveled-errors";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);

const handlers = () => ({
  onClose: vi.fn(),
  onApplyAdoption: vi.fn(async (_decisions: AdoptionDecisions): Promise<LeveledActionError | null> => null),
  onApplyAssignment: vi.fn(async (_copies: readonly CellRef[]): Promise<LeveledActionError | null> => null),
  onDismissAssignment: vi.fn(),
});

describe("IdentityReviewDialog — adoption", () => {
  const review = reviewAdoption(XML, undefined)!;

  it("shows the proposed page tree and the groups", () => {
    render(<IdentityReviewDialog review={review} {...handlers()} />);
    expect(screen.getByText("Adopt pages")).toBeTruthy();
    expect(within(screen.getByTestId("adoption-page-sys")).getByText("— top level —")).toBeTruthy();
    expect(within(screen.getByTestId("adoption-page-sen")).getByText("proposed")).toBeTruthy();
    for (const g of review.proposal.groups) {
      expect(screen.getByTestId(`adoption-group-${g.key}`)).toBeTruthy();
    }
  });

  it("hands over the analyst's decisions", async () => {
    const h = handlers();
    render(<IdentityReviewDialog review={review} {...h} />);
    const mp2 = review.proposal.groups.find((g) => g.displayId === "MP-2")!;
    fireEvent.click(screen.getByRole("checkbox", { name: "MP-2" }));
    fireEvent.click(screen.getByTestId("identity-review-apply"));
    await vi.waitFor(() => expect(h.onApplyAdoption).toHaveBeenCalled());
    expect(h.onApplyAdoption.mock.calls[0][0]).toEqual({
      reject: [mp2.key],
      definition: {},
      decomposes: {},
    });
  });

  it("shows an error returned by the apply step", async () => {
    const h = {
      ...handlers(),
      onApplyAdoption: vi.fn(async (): Promise<LeveledActionError | null> => "SAVE_FAILED"),
    };
    render(<IdentityReviewDialog review={review} {...h} />);
    fireEvent.click(screen.getByTestId("identity-review-apply"));
    expect(await screen.findByText(/SAVE_FAILED/)).toBeTruthy();
  });
});

describe("IdentityReviewDialog — every child page details a multiprocess", () => {
  // A new page without a proposal: "no decomposition" would make it a second
  // root page (PAGE_MULTIPLE_ROOTS), so the analyst has to choose.
  const P4 = page("p4", "Page-4", node("p4_p9", "process", "Logger", "P-9", 10));

  it("blocks Adopt until a multiprocess is chosen, offering only free ones", async () => {
    const sys = page(
      "sys",
      "System",
      node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
        node("mp3", "multiprocess", "Logger Module", "MP-3", 600),
    );
    const review = reviewAdoption(mxfile(sys, SENSOR, CONTROLLER, P4), LEVELED_PAGES)!;
    const h = handlers();
    render(<IdentityReviewDialog review={review} {...h} />);

    const apply = screen.getByTestId("identity-review-apply") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
    expect(screen.getByTestId("adoption-unplaced").textContent).toContain("Page-4");

    fireEvent.mouseDown(within(screen.getByTestId("adoption-page-p4")).getByRole("combobox"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["MP-3 Logger Module"]); // MP-1 / MP-2 have their pages
    fireEvent.click(screen.getByRole("option", { name: "MP-3 Logger Module" }));

    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    await vi.waitFor(() => expect(h.onApplyAdoption).toHaveBeenCalled());
    expect(h.onApplyAdoption.mock.calls[0][0].decomposes).toEqual({ p4: "mp3" });
  });

  it("says so when no multiprocess is left", () => {
    const review = reviewAdoption(mxfile(SYSTEM, SENSOR, CONTROLLER, P4), LEVELED_PAGES)!;
    render(<IdentityReviewDialog review={review} {...handlers()} />);
    expect(
      within(screen.getByTestId("adoption-page-p4")).getByText(/No multiprocess left to detail/),
    ).toBeTruthy();
    expect((screen.getByTestId("identity-review-apply") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("IdentityReviewDialog — assignment", () => {
  const pasted = mxfile(
    SYSTEM,
    SENSOR,
    page(
      "ctl",
      "Controller Module",
      node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
        node("ctl_paste", "process", "Sample Smoke Sensor", "P-2", 600),
    ),
  );
  const review = reviewCopyAssignments(
    { xml: pasted, pages: LEVELED_PAGES },
    { xml: XML, pages: LEVELED_PAGES },
  )!;

  it("defaults to the proposal and applies the copies", async () => {
    const h = handlers();
    render(<IdentityReviewDialog review={review} {...h} />);
    expect((screen.getByRole("radio", { name: "copy P-2" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByTestId("identity-review-apply"));
    await vi.waitFor(() => expect(h.onApplyAssignment).toHaveBeenCalled());
    expect(h.onApplyAssignment.mock.calls[0][0]).toEqual([{ pageId: "ctl", cellId: "ctl_paste" }]);
  });

  it("keeps a cell as a new element", async () => {
    const h = handlers();
    render(<IdentityReviewDialog review={review} {...h} />);
    fireEvent.click(screen.getByRole("radio", { name: "new P-2" }));
    fireEvent.click(screen.getByTestId("identity-review-apply"));
    await vi.waitFor(() => expect(h.onApplyAssignment).toHaveBeenCalled());
    expect(h.onApplyAssignment.mock.calls[0][0]).toEqual([]);
  });

  it("dismisses the hint with 'Keep all as new'", () => {
    const h = handlers();
    render(<IdentityReviewDialog review={review} {...h} />);
    fireEvent.click(screen.getByTestId("identity-review-dismiss"));
    expect(h.onDismissAssignment).toHaveBeenCalled();
  });
});

describe("IdentityReviewHints", () => {
  it("shows the adoption hint first and opens the dialog", () => {
    const onOpenAdoption = vi.fn();
    render(
      <IdentityReviewHints
        adoptionPending
        pendingCopies={2}
        onOpenAdoption={onOpenAdoption}
        onOpenAssignment={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("assignment-hint")).toBeNull();
    fireEvent.click(screen.getByText("Adopt pages…"));
    expect(onOpenAdoption).toHaveBeenCalled();
  });

  it("shows the paste hint with the count", () => {
    render(
      <IdentityReviewHints
        adoptionPending={false}
        pendingCopies={2}
        onOpenAdoption={vi.fn()}
        onOpenAssignment={vi.fn()}
      />,
    );
    expect(screen.getByText("2 pasted cell(s) look like copies of existing elements.")).toBeTruthy();
  });

  it("offers the repair of the page tree", () => {
    const onOpenAdoption = vi.fn();
    render(
      <IdentityReviewHints
        adoptionPending={false}
        pageRepair
        pendingCopies={0}
        onOpenAdoption={onOpenAdoption}
        onOpenAssignment={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Review pages…"));
    expect(onOpenAdoption).toHaveBeenCalled();
  });

  it("renders nothing without anything to review", () => {
    const { container } = render(
      <IdentityReviewHints
        adoptionPending={false}
        pendingCopies={0}
        onOpenAdoption={vi.fn()}
        onOpenAssignment={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
