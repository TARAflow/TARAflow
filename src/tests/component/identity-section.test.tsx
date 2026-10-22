// src/tests/component/identity-section.test.tsx
//
// Leveled-DFD Phase 5g (leveled-dfd-multi-diagram-design.md §5.2, §12):
// identity of the selected cell in the details panel and its actions.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentitySection } from "features/dfd/components/identity-section";
import type { IdentityInfo } from "features/dfd/services/leveled";
import type { LeveledActionError } from "features/dfd/models/leveled-errors";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const COPY: IdentityInfo = {
  tfId: "mp2",
  kind: "element",
  role: "ref",
  dangling: false,
  definition: { pageId: "sys", cellId: "mp2", pageName: "Top", role: "definition" },
  occurrences: [
    { pageId: "sys", cellId: "mp2", pageName: "Top", role: "definition" },
    { pageId: "sen", cellId: "sen_mp2", pageName: "Sensor Module", role: "ref" },
  ],
  canMakeDefinition: true,
  canPromote: false,
  contextCopyCandidates: [],
};

const handlers = () => ({
  onGoTo: vi.fn(),
  onMakeDefinition: vi.fn(async (): Promise<LeveledActionError | null> => null),
  onPromote: vi.fn(async (): Promise<LeveledActionError | null> => null),
  onLinkAsContextCopy: vi.fn(async (_tfId: string): Promise<LeveledActionError | null> => null),
});

describe("IdentitySection", () => {
  it("shows a context copy with its definition and goes there", () => {
    const h = handlers();
    render(<IdentitySection info={COPY} {...h} />);
    expect(screen.getByTestId("identity-role").textContent).toBe("Context copy");
    expect(screen.getByText(/Defined on page "Top"/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("identity-goto-definition"));
    expect(h.onGoTo).toHaveBeenCalledWith(COPY.definition);
  });

  it("lists the occurrences, each one opens its page", () => {
    const h = handlers();
    render(<IdentitySection info={COPY} {...h} />);
    fireEvent.click(within(screen.getByTestId("identity-occurrences")).getByText("Sensor Module"));
    expect(h.onGoTo).toHaveBeenCalledWith(COPY.occurrences[1]);
  });

  it("makes the copy the definition and shows a refusal", async () => {
    const h = { ...handlers(), onMakeDefinition: vi.fn(async (): Promise<LeveledActionError | null> => "DUPLICATE_DEFINITIONS") };
    render(<IdentitySection info={COPY} {...h} />);
    fireEvent.click(screen.getByTestId("identity-make-definition"));
    expect((await screen.findByTestId("identity-error")).textContent).toContain("DUPLICATE_DEFINITIONS");
  });

  it("offers the promotion of a dangling copy", () => {
    const h = handlers();
    render(
      <IdentitySection
        info={{ ...COPY, dangling: true, definition: undefined, canMakeDefinition: false, canPromote: true }}
        {...h}
      />,
    );
    expect(screen.getByText(/definition was deleted/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("identity-promote"));
    expect(h.onPromote).toHaveBeenCalled();
  });

  it("makes a plain cell a context copy of the chosen element", async () => {
    const h = handlers();
    const plain: IdentityInfo = {
      ...COPY,
      tfId: "ctl_x",
      role: "definition",
      definition: { pageId: "ctl", cellId: "ctl_x", pageName: "Controller", role: "definition" },
      occurrences: [{ pageId: "ctl", cellId: "ctl_x", pageName: "Controller", role: "definition" }],
      canMakeDefinition: false,
      contextCopyCandidates: [{ tfId: "sen_p2", label: "P-2 Sample Smoke Sensor" }],
    };
    render(<IdentitySection info={plain} {...h} />);
    expect(screen.getByTestId("identity-role").textContent).toBe("Definition");
    expect((screen.getByTestId("identity-make-copy") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "P-2 Sample Smoke Sensor" }));
    expect(screen.getByText(/threats become orphans/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("identity-make-copy"));
    await vi.waitFor(() => expect(h.onLinkAsContextCopy).toHaveBeenCalledWith("sen_p2"));
  });

  it("asks before a definition moves the element into a multiprocess", async () => {
    const h = handlers();
    const becomesPartOf = { element: "MP-2 Controller", container: "MP-1 Sensor Module" };
    render(<IdentitySection info={COPY} becomesPartOf={becomesPartOf} {...h} />);
    fireEvent.click(screen.getByTestId("identity-make-definition"));
    expect(screen.getByText(/MP-2 Controller then becomes part of MP-1 Sensor Module/)).toBeTruthy();
    expect(h.onMakeDefinition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(h.onMakeDefinition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("identity-make-definition"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await vi.waitFor(() => expect(h.onMakeDefinition).toHaveBeenCalledTimes(1));
  });

  it("makes the definition without asking when it stays on the highest page", async () => {
    const h = handlers();
    render(<IdentitySection info={COPY} {...h} />);
    fireEvent.click(screen.getByTestId("identity-make-definition"));
    await vi.waitFor(() => expect(h.onMakeDefinition).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
