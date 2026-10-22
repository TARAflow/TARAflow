// src/tests/component/dataflow-form.leveling.test.tsx
//
// Leveled-DFD Phase 4b (leveled-dfd-multi-diagram-design.md §6.4): the
// data-flow form offers `refines` and `abstract` only in a leveled DFD.
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataFlowDescriptionForm } from "features/dfd/components/forms/dataflow-description-form";
import type { DFDConnection } from "features/dfd/models/dfd-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const connection = {
  id: "f2",
  displayId: "DF-1.2",
  name: "extra channel",
  from: "e",
  to: "q",
  properties: {},
} as unknown as DFDConnection;

const candidates = [
  { tfId: "f1", label: "DF-1 data" },
  { tfId: "f2", label: "DF-1.2 extra channel" },
];

describe("DataFlowDescriptionForm — leveling", () => {
  it("is hidden on a single page (no candidates)", () => {
    render(
      <DataFlowDescriptionForm connection={connection} onChange={() => {}} />,
    );
    expect(screen.queryByTestId("dataflow-abstract")).toBeNull();
    expect(screen.queryByText("Leveling")).toBeNull();
  });

  it("offers the other flows as refines target and writes the choice", () => {
    const onChange = vi.fn();
    render(
      <DataFlowDescriptionForm
        connection={connection}
        onChange={onChange}
        refinementCandidates={candidates}
      />,
    );
    expect(screen.getByText("Leveling")).toBeTruthy();

    fireEvent.mouseDown(
      within(screen.getByTestId("dataflow-refines")).getByRole("combobox"),
    );
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["— none —", "DF-1 data"]); // not itself
    fireEvent.click(screen.getByRole("option", { name: "DF-1 data" }));

    const last = onChange.mock.calls.at(-1)![0] as Partial<DFDConnection>;
    expect(last.properties).toMatchObject({ refines: "f1" });
  });

  it("marks the flow abstract", () => {
    const onChange = vi.fn();
    render(
      <DataFlowDescriptionForm
        connection={connection}
        onChange={onChange}
        refinementCandidates={candidates}
      />,
    );
    fireEvent.click(
      within(screen.getByTestId("dataflow-abstract")).getByRole("checkbox"),
    );
    const last = onChange.mock.calls.at(-1)![0] as Partial<DFDConnection>;
    expect(last.properties).toMatchObject({ abstract: true });
  });
});
