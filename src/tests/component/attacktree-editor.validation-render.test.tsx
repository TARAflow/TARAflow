// src/tests/component/attacktree-editor.validation-render.test.tsx
//
// Regression cover for a class of bug that unit tests structurally CANNOT
// catch: the data was always correct, but a React.memo comparator decided the
// component didn't need to re-render, so the validation panel froze on a stale
// state until the next keystroke changed `dsl`.
//
// The invariant, in one line:
//   Same dsl + different validation MUST still update the panel.
//
// `dsl` staying equal across the rerender is the whole point — that is exactly
// the situation the debounced re-parse produces (use-attacktree-editor parses
// 500ms AFTER the dsl change, so the new validation always arrives on a later
// render where dsl is already unchanged). A test that also varies `dsl` would
// pass even with the bug present and prove nothing.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttackTreeEditor } from "features/attacktree/components/attacktree-editor";
import type {
  AttackTreeConfiguration,
  ValidationError,
} from "features/attacktree/models/attacktree-types";

// i18n: render the key itself so assertions don't depend on the catalog.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

// CodeMirror is irrelevant here and heavy to mount — stub it to a plain
// textarea so the test exercises the panel, not the editor widget.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="dsl" readOnly value={value} />
  ),
}));

const configuration = {
  evaluationMethod: "extended",
  showLineNumbers: true,
  fontSize: 14,
} as unknown as AttackTreeConfiguration;

function gateError(): ValidationError {
  // Mirrors exactly what attacktree-parser.ts emits for an under-filled gate.
  return {
    line: 11,
    type: "logic",
    severity: "error",
    messageKey: "tabs.attacktree.validation.parser.gateMinChildren",
    params: { type: "OR", name: "Transport Layer", count: 1 },
    context: "Data Tampering > Transport Layer",
  };
}

const DSL = "Data Tampering [DA-001];ROOT\n\tTransport Layer;OR\n";

function renderEditor(validation: ValidationError[]) {
  return render(
    <AttackTreeEditor
      dsl={DSL}
      configuration={configuration}
      validation={validation}
      collapsed={false}
      onDslChange={() => {}}
      onToggleCollapse={() => {}}
    />,
  );
}

const ERROR_KEY = "tabs.attacktree.validation.parser.gateMinChildren";

describe("AttackTreeEditor — validation panel reacts without a dsl change", () => {
  it("shows a newly arrived error while dsl stays identical", () => {
    const { rerender } = renderEditor([]);
    expect(screen.queryByText(ERROR_KEY)).not.toBeInTheDocument();

    // Same dsl, validation arrives late (the debounced parse landed).
    rerender(
      <AttackTreeEditor
        dsl={DSL}
        configuration={configuration}
        validation={[gateError()]}
        collapsed={false}
        onDslChange={() => {}}
        onToggleCollapse={() => {}}
      />,
    );

    expect(screen.getByText(ERROR_KEY)).toBeInTheDocument();
  });

  it("clears a resolved error while dsl stays identical", () => {
    const { rerender } = renderEditor([gateError()]);
    expect(screen.getByText(ERROR_KEY)).toBeInTheDocument();

    rerender(
      <AttackTreeEditor
        dsl={DSL}
        configuration={configuration}
        validation={[]}
        collapsed={false}
        onDslChange={() => {}}
        onToggleCollapse={() => {}}
      />,
    );

    // Panel is gated on validation.length > 0 — it disappears entirely.
    expect(screen.queryByText(ERROR_KEY)).not.toBeInTheDocument();
  });

  it("reflects a changed error set of the same length", () => {
    // Guards against a comparator that only compares lengths: one error
    // replaced by a different one is still a change the panel must show.
    const other: ValidationError = {
      ...gateError(),
      line: 4,
      messageKey: "tabs.attacktree.validation.parser.unknownGoal",
      params: { goal: "nonsense" },
    };

    const { rerender } = renderEditor([gateError()]);
    expect(screen.getByText(ERROR_KEY)).toBeInTheDocument();

    rerender(
      <AttackTreeEditor
        dsl={DSL}
        configuration={configuration}
        validation={[other]}
        collapsed={false}
        onDslChange={() => {}}
        onToggleCollapse={() => {}}
      />,
    );

    expect(screen.queryByText(ERROR_KEY)).not.toBeInTheDocument();
    expect(
      screen.getByText("tabs.attacktree.validation.parser.unknownGoal"),
    ).toBeInTheDocument();
  });
});