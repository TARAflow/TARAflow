// The description of a DFD element or flow — counted by the DFD's
// completeness — is editable above every element and flow form and saved
// when the field is left.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordDescriptionField } from "features/dfd/components/forms/record-description-field";
import { DFDElementForm } from "features/dfd/components/dfd-element-form";
import type { DFDElement } from "features/dfd/models/dfd-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const field = () => screen.getByTestId("record-description") as HTMLTextAreaElement;

describe("RecordDescriptionField", () => {
  it("saves a changed description when the field is left, trimmed", () => {
    const onCommit = vi.fn();
    render(<RecordDescriptionField recordId="p1" value="Old" onCommit={onCommit} />);
    fireEvent.change(field(), { target: { value: "  Detects smoke.  " } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledWith("Detects smoke.");
  });

  it("emptied: undefined; unchanged: nothing", () => {
    const onCommit = vi.fn();
    render(<RecordDescriptionField recordId="p1" value="Old" onCommit={onCommit} />);
    fireEvent.blur(field());
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: "   " } });
    fireEvent.blur(field());
    expect(onCommit).toHaveBeenCalledWith(undefined);
  });

  it("shows the next record's description", () => {
    const { rerender } = render(<RecordDescriptionField recordId="p1" value="One" onCommit={vi.fn()} />);
    rerender(<RecordDescriptionField recordId="p2" value="Two" onCommit={vi.fn()} />);
    expect(field().value).toBe("Two");
  });
});

describe("DFDElementForm", () => {
  it("has the description above the type form and writes it as the record's description", () => {
    const onChange = vi.fn();
    const element = {
      id: "tb",
      displayId: "TB-1",
      name: "Board",
      type: "TrustBoundary",
      properties: {},
      position: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
    } as unknown as DFDElement;
    render(<DFDElementForm element={element} onChange={onChange} />);
    fireEvent.change(field(), { target: { value: "Board boundary." } });
    fireEvent.blur(field());
    expect(onChange).toHaveBeenCalledWith({ description: "Board boundary." });
  });
});
