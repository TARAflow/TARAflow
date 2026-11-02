// src/tests/component/product-support-fields.test.tsx
//
// Product support data in the Overview (model coverage plan F-28, CM-7b):
// edited with the project information, saved into info.productSupport;
// cleared fields leave no empty entries.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectInfo } from "features/overview/components/project-info";
import type { ProjectInfoData } from "features/overview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const info = (productSupport?: ProjectInfoData["productSupport"]): ProjectInfoData => ({
  name: "Pump Station",
  description: "",
  version: "1.0",
  responsible: "R",
  created: "2026-10-01T00:00:00.000Z",
  lastModified: "2026-10-01T00:00:00.000Z",
  tags: { domain: [], platform: [], regulation: [], custom: [] },
  team: [],
  isHighImpact: false,
  ...(productSupport ? { productSupport } : {}),
});

describe("Overview — product support (F-28)", () => {
  it("shows what is stated, '-' for the rest", () => {
    render(<ProjectInfo info={info({ securityContact: "psirt@example.com" })} onUpdate={() => {}} />);
    expect(screen.getByTestId("product-support-securityContact").textContent).toBe("psirt@example.com");
    expect(screen.getByTestId("product-support-modelDesignation").textContent).toBe("-");
  });

  it("edited with the project information and saved into info.productSupport", () => {
    const onUpdate = vi.fn();
    render(<ProjectInfo info={info()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("common.edit"));
    fireEvent.change(screen.getByLabelText("Model designation"), { target: { value: "PSC-200" } });
    fireEvent.change(screen.getByLabelText("Security updates until"), { target: { value: "2032-12-31" } });
    fireEvent.click(screen.getByText("common.save"));
    expect(onUpdate.mock.calls[0][0].productSupport).toEqual({ modelDesignation: "PSC-200", supportEnd: "2032-12-31" });
  });

  it("clearing every field removes the entry", () => {
    const onUpdate = vi.fn();
    render(<ProjectInfo info={info({ modelDesignation: "PSC-200" })} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("common.edit"));
    fireEvent.change(screen.getByLabelText("Model designation"), { target: { value: "" } });
    fireEvent.click(screen.getByText("common.save"));
    expect("productSupport" in onUpdate.mock.calls[0][0]).toBe(false);
  });
});
