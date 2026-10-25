// Hazard import HI-1: the value-map editor maps each distinct value of a
// source column onto a canonical option; "—" removes the mapping.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ValueMapEditor } from "features/hazards/components/value-map-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const OPTIONS = ["reversible_minor", "irreversible_major", "fatal"] as const;
const label = (o: string) => `L:${o}`;

const pick = (value: string, optionName: string) => {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: value }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: optionName }));
};

describe("ValueMapEditor", () => {
  it("lists every value with its current mapping and the option labels", () => {
    render(
      <ValueMapEditor values={["1", "4"]} options={OPTIONS} valueMap={{ "4": "fatal" }} onChange={() => {}} optionLabel={label} />,
    );
    expect(screen.getByRole("combobox", { name: "4" }).textContent).toBe("L:fatal");
    expect(screen.getByRole("combobox", { name: "1" }).textContent).toContain("as it is");
  });

  it("choosing an option adds the mapping, choosing — removes it", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ValueMapEditor values={["1", "4"]} options={OPTIONS} valueMap={{ "4": "fatal" }} onChange={onChange} optionLabel={label} />,
    );
    pick("1", "L:reversible_minor");
    expect(onChange).toHaveBeenLastCalledWith({ "1": "reversible_minor", "4": "fatal" });

    rerender(
      <ValueMapEditor values={["1", "4"]} options={OPTIONS} valueMap={{ "4": "fatal" }} onChange={onChange} optionLabel={label} />,
    );
    pick("4", "— (as it is)");
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("renders nothing without values", () => {
    const { container } = render(
      <ValueMapEditor values={[]} options={OPTIONS} valueMap={undefined} onChange={() => {}} optionLabel={label} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
