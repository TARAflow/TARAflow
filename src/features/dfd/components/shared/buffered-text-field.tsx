// ==================== BUFFERED TEXT FIELD ====================
// Drop-in replacement for a MUI <TextField> whose value lives in the parent's
// element state.
//
// Problem it solves: binding value={props.x} and writing on every keystroke via
// onChange makes the parent rebuild `element`, which fails the React.memo guard
// (prev.element === next.element) on the description forms and re-renders the
// WHOLE form per character — noticeably laggy on the larger forms.
//
// This component keeps the in-progress text in local state and only writes back
// (onCommit) when the field loses focus — the same pattern the Notes/Description
// fields already use. Swap `onChange={(e) => set(field, e.target.value)}` for
// `onCommit={(v) => set(field, v)}`; every other TextField prop is forwarded.

import React from "react";
import { TextField } from "@mui/material";

type BufferedTextFieldProps = Omit<
  React.ComponentProps<typeof TextField>,
  "value" | "onChange"
> & {
  value: string;
  /** Called with the final text when the field loses focus (and only if changed). */
  onCommit: (value: string) => void;
};

export const BufferedTextField: React.FC<BufferedTextFieldProps> = ({
  value,
  onCommit,
  ...rest
}) => {
  const [local, setLocal] = React.useState(value);
  const focusedRef = React.useRef(false);

  // Adopt external changes (e.g. cascade defaults, switching to another element)
  // only while the field is NOT being edited, so an incoming prop update never
  // clobbers what the analyst is currently typing.
  React.useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);

  return (
    <TextField
      {...rest}
      value={local}
      onFocus={(e) => {
        focusedRef.current = true;
        rest.onFocus?.(e);
      }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        focusedRef.current = false;
        if (local !== value) onCommit(local);
        rest.onBlur?.(e);
      }}
    />
  );
};

export default BufferedTextField;
