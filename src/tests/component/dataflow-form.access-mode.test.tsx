// src/tests/component/dataflow-form.access-mode.test.tsx
//
// FF-1 (release plan 0.18): the data-flow form shows the access mode (it
// drives the tampering threats of field protocols and closes M-I-007) for
// flows with a transport medium, and data minimisation only where data
// leaves the system — a flow from or to an external entity.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataFlowDescriptionForm } from "features/dfd/components/forms/dataflow-description-form";
import { ModelFieldProvider } from "features/dfd/components/forms/model-field-inputs";
import type { DFDConnection } from "features/dfd/models/dfd-types";
import type { VisibilityElement } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const flow = (properties: Record<string, unknown>, from = "scada", to = "plc") =>
  ({ id: "f1", displayId: "DF-1", name: "registers", from, to, properties }) as unknown as DFDConnection;

const ELEMENTS: VisibilityElement[] = [
  { id: "scada", type: "ExternalEntity", properties: { entityType: "external_system" } },
  { id: "plc", type: "Process", properties: {} },
  { id: "io", type: "Process", properties: {} },
];

function renderFlow(connection: DFDConnection, onChange = vi.fn()) {
  render(
    <ModelFieldProvider elements={ELEMENTS} connections={[{ id: "f1", from: connection.from as string, to: connection.to as string }]}>
      <DataFlowDescriptionForm connection={connection} onChange={onChange} />
    </ModelFieldProvider>,
  );
  return onChange;
}

describe("DataFlowDescriptionForm — access mode and data minimisation (FF-1)", () => {
  it("a Modbus TCP flow offers the access mode and stores the choice", () => {
    const onChange = renderFlow(flow({ protocol: "modbus_tcp" }));
    const field = screen.getByTestId("dataflow-access-mode");
    fireEvent.mouseDown(within(field).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "read_only" }));
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.lastCall![0];
    expect(last.properties.accessMode).toBe("read_only");
  });

  it("no access mode without a transport medium (human input) or for a hardwired signal", () => {
    renderFlow(flow({ protocol: "human_input" }));
    expect(screen.queryByTestId("dataflow-access-mode")).toBeNull();
  });

  it("data minimisation only for a flow from or to an external entity", () => {
    renderFlow(flow({ protocol: "modbus_tcp" }));
    expect(screen.getByTestId("dataflow-data-minimization")).toBeTruthy();
    cleanup();
    renderFlow(flow({ protocol: "modbus_tcp" }, "plc", "io"));
    expect(screen.queryByTestId("dataflow-data-minimization")).toBeNull();
  });
});
