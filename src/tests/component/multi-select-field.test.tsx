// src/tests/component/multi-select-field.test.tsx
//
// The multi-select control field (release plan 0.18 MS-1): measures combine;
// "none" replaces the others and any measure removes "none"; a stored value
// outside the offered ones stays visible.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiSelectField } from "features/dfd/components/forms/multi-select-field";

afterEach(cleanup);

function renderField(value: unknown, options = ["none", "cable_duct", "tamper_seal"]) {
  const onChange = vi.fn();
  render(<MultiSelectField label="Path" options={options} value={value} onChange={onChange} optionLabel={(v) => v} testId="f" />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  return onChange;
}

describe("MultiSelectField", () => {
  it("a second measure is added to the first", () => {
    const onChange = renderField(["cable_duct"]);
    fireEvent.click(screen.getByRole("option", { name: "tamper_seal" }));
    expect(onChange).toHaveBeenCalledWith(["cable_duct", "tamper_seal"]);
  });

  it("none replaces the measures; a measure replaces none", () => {
    const onChange = renderField(["cable_duct"]);
    fireEvent.click(screen.getByRole("option", { name: "none" }));
    expect(onChange).toHaveBeenLastCalledWith(["none"]);
    cleanup();
    const again = renderField(["none"]);
    fireEvent.click(screen.getByRole("option", { name: "cable_duct" }));
    expect(again).toHaveBeenLastCalledWith(["cable_duct"]);
  });

  it("unticking the last measure clears the field; a single value of an older file shows as ticked", () => {
    const onChange = renderField("cable_duct");
    fireEvent.click(screen.getByRole("option", { name: "cable_duct" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("a stored value the element does not offer any more stays visible", () => {
    renderField(["av_software"], ["none", "code_signing"]);
    expect(screen.getAllByRole("option").map((o) => o.getAttribute("data-value"))).toEqual(["none", "code_signing", "av_software"]);
  });
});
