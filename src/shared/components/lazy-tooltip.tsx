// ==================== LAZY TOOLTIP ====================
// Drop-in for MUI's Tooltip in large tables.
//
// A MUI Tooltip is not free even while closed: every instance mounts its own
// state, effects, event wiring and styled wrappers. The Risk tab renders about
// ten per row; with 87 risks that is ~1000 instances, and they were about half
// the time it took to open the tab (measured in jsdom: risk table mount
// 2.8 s → 1.4 s).
//
// LazyTooltip renders only the child until the pointer or focus first reaches
// it, then mounts the real Tooltip already open. From then on it behaves like
// MUI's Tooltip. Same props as Tooltip.
//
// Two details keep it equivalent to MUI's Tooltip:
//   - a string title is exposed as the child's aria-label from the start, so
//     the accessible name does not depend on a hover;
//   - arming wraps the child in the Tooltip, which re-mounts its DOM node. When
//     arming came from keyboard focus, focus is put back on the new node.
//
// Closing (manual test 2026-11-15: tooltips in the Risk tab stayed open, also
// over a dialog): the re-mounted node may never see the pointer enter, so
// MUI's mouseleave never comes — after a quick pass, or when a click opens a
// dialog whose backdrop covers the row. While open, a pointer press anywhere
// and a pointer move outside the child (and outside the tooltip) close it.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Tooltip, { type TooltipProps } from "@mui/material/Tooltip";

type Handler = ((event: React.SyntheticEvent) => void) | undefined;

interface ArmableProps {
  onMouseOver?: Handler;
  onFocus?: Handler;
  onTouchStart?: Handler;
  "aria-label"?: string;
}

function chain(first: Handler, second: () => void) {
  return (event: React.SyntheticEvent) => {
    first?.(event);
    second();
  };
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as React.MutableRefObject<T | null>).current = value;
}

export const LazyTooltip: React.FC<TooltipProps> = (props) => {
  const [armed, setArmed] = useState<false | "pointer" | "focus">(false);
  const [open, setOpen] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);

  const child = props.children as React.ReactElement<ArmableProps> & {
    ref?: React.Ref<HTMLElement>;
  };
  const childRef = child.ref;
  const forkRef = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      setRef(childRef, node);
    },
    [childRef],
  );

  useEffect(() => {
    if (armed === "focus") nodeRef.current?.focus();
  }, [armed]);

  const onCloseProp = props.onClose;
  const controlled = props.open !== undefined;
  useEffect(() => {
    if (!armed || !open || controlled) return;
    const close = (event: Event) => {
      setOpen(false);
      onCloseProp?.(event as unknown as React.SyntheticEvent);
    };
    const onMove = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target && nodeRef.current?.contains(target)) return;
      if (target?.closest?.('[role="tooltip"]')) return;
      close(event);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("mousemove", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("mousemove", onMove, true);
    };
  }, [armed, open, controlled, onCloseProp]);

  if (armed) {
    return (
      <Tooltip
        {...props}
        open={props.open ?? open}
        onOpen={(event) => {
          setOpen(true);
          props.onOpen?.(event);
        }}
        onClose={(event) => {
          setOpen(false);
          props.onClose?.(event);
        }}
      >
        {React.cloneElement(child, { ref: forkRef } as Record<string, unknown>)}
      </Tooltip>
    );
  }

  const arm = (by: "pointer" | "focus") => () => {
    setArmed(by);
    setOpen(true);
  };
  const label =
    typeof props.title === "string" && props.title && !props.describeChild
      ? { "aria-label": child.props["aria-label"] ?? props.title }
      : {};
  return React.cloneElement(child, {
    ...label,
    onMouseOver: chain(child.props.onMouseOver, arm("pointer")),
    onTouchStart: chain(child.props.onTouchStart, arm("pointer")),
    onFocus: chain(child.props.onFocus, arm("focus")),
  });
};
