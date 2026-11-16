// LazyTooltip: renders only the child until first hover/focus, then behaves
// like MUI's Tooltip. Guards the Risk tab performance fix (≈1000 tooltips).

import { afterEach, describe, it, expect, vi } from "vitest";
import React from "react";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { LazyTooltip } from "shared";

describe("LazyTooltip", () => {
  afterEach(cleanup);

  it("mounts no tooltip until the child is hovered", () => {
    render(
      <LazyTooltip title="Full threat text">
        <span>T-1</span>
      </LazyTooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on the first hover and closes on leave", async () => {
    // (MUI keeps the popper mounted for its exit transition in jsdom, so the
    // close is checked through onClose rather than through the DOM.)
    const onClose = vi.fn();
    render(
      <LazyTooltip title="Full threat text" onClose={onClose}>
        <span>T-1</span>
      </LazyTooltip>,
    );
    fireEvent.mouseOver(screen.getByText("T-1"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Full threat text");

    fireEvent.mouseLeave(screen.getByText("T-1"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens on focus (keyboard)", async () => {
    render(
      <LazyTooltip title="Edit">
        <button>✎</button>
      </LazyTooltip>,
    );
    fireEvent.focus(screen.getByRole("button"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Edit");
  });

  it("keeps keyboard focus on the child when focus arms it", async () => {
    render(
      <LazyTooltip title="Edit">
        <button>✎</button>
      </LazyTooltip>,
    );
    const before = screen.getByRole("button");
    await act(async () => {
      before.focus();
    });
    await screen.findByRole("tooltip");
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });

  it("forwards the child's own ref after arming", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <LazyTooltip title="Edit">
        <button ref={ref}>✎</button>
      </LazyTooltip>,
    );
    fireEvent.mouseOver(screen.getByRole("button"));
    expect(ref.current).toBe(screen.getByRole("button"));
  });

  it("exposes a string title as aria-label before any hover, like MUI", () => {
    render(
      <LazyTooltip title="Edit">
        <button>✎</button>
      </LazyTooltip>,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("keeps the child's own handlers", () => {
    const onMouseOver = vi.fn();
    render(
      <LazyTooltip title="x">
        <span onMouseOver={onMouseOver}>child</span>
      </LazyTooltip>,
    );
    fireEvent.mouseOver(screen.getByText("child"));
    expect(onMouseOver).toHaveBeenCalledTimes(1);
  });

  it("an empty title never opens", () => {
    render(
      <LazyTooltip title="">
        <span>child</span>
      </LazyTooltip>,
    );
    fireEvent.mouseOver(screen.getByText("child"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // Manual test 2026-11-15: tooltips in the Risk tab stayed open — after a
  // quick pass (the re-mounted node never saw the pointer enter) and over a
  // dialog opened by a click on the row.
  describe("closes without a mouseleave", () => {
    const setup = () => {
      const onClose = vi.fn();
      render(
        <div>
          <LazyTooltip title="Full threat text" onClose={onClose}>
            <span>T-1</span>
          </LazyTooltip>
          <span>elsewhere</span>
        </div>,
      );
      fireEvent.mouseOver(screen.getByText("T-1"));
      return onClose;
    };

    it("on a pointer press anywhere (a click that opens a dialog)", async () => {
      const onClose = setup();
      expect(await screen.findByRole("tooltip")).toBeTruthy();
      fireEvent.pointerDown(screen.getByText("T-1"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("on a pointer move outside the child", async () => {
      const onClose = setup();
      expect(await screen.findByRole("tooltip")).toBeTruthy();
      fireEvent.mouseMove(screen.getByText("elsewhere"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("not while the pointer moves on the child or the tooltip", async () => {
      const onClose = setup();
      const tip = await screen.findByRole("tooltip");
      fireEvent.mouseMove(screen.getByText("T-1"));
      fireEvent.mouseMove(tip);
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

