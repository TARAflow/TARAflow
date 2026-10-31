// src/tests/component/hazard-table.s0.test.tsx
//
// ISO/SAE 21434 conformance plan 1H-S (decision 13 C): the hazard table's
// "Max Severity" shows a person edge rated "none" as "None (no injury)" (S0);
// a hazard without a rated edge shows "–". Under iso-21434 (1H-S-2) the
// person severities carry their ISO 26262 class (S0–S3).

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HazardsTab } from "features/hazards";
import type { HazardItem } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

const item = (id: string, label: string) => ({ id, label, combinationType: "ANY", source: "manual" }) as HazardItem;

const project = {
  id: "p1",
  name: "Press",
  hazards: {
    hazards: [item("H1", "Pinch S0"), item("H2", "Unrated"), item("H3", "Crush")],
    relations: [
      { type: "endangers", from: "H1", to: "HU-1", impact: { target: "human", severity: "none" } },
      { type: "endangers", from: "H3", to: "HU-1", impact: { target: "human", severity: "fatal" } },
    ],
    configuration: { defaultCombinationType: "ANY", maxHops: 1, requireHazardType: false },
    lastModified: "2026-10-27T00:00:00.000Z",
  },
  phaseStatus: {},
  lastModified: "2026-10-27T00:00:00.000Z",
} as unknown as React.ComponentProps<typeof HazardsTab>["project"];

afterEach(cleanup);

describe("Hazard table — S0 (1H-S)", () => {
  it("'none' shows as 'None (no injury)'-style label, unrated as '–'", () => {
    render(<HazardsTab project={project} onUpdate={() => {}} />);
    const row = (label: string) => screen.getByText(label).closest("[role='row']") as HTMLElement;
    const cell = (label: string) => within(row(label)).getByText((_, el) => el?.getAttribute("data-field") === "_worstRank");
    expect(cell("Pinch S0").textContent).toContain("None");
    expect(cell("Unrated").textContent).toContain("–");
    expect(cell("Crush").textContent).toContain("Fatal");
  });

  it("under iso-21434 the class comes first: S0 · None, S3 · Fatal", () => {
    render(<HazardsTab project={{ ...project, labelVocabulary: "iso-21434" }} onUpdate={() => {}} />);
    const row = (label: string) => screen.getByText(label).closest("[role='row']") as HTMLElement;
    const cell = (label: string) => within(row(label)).getByText((_, el) => el?.getAttribute("data-field") === "_worstRank");
    expect(cell("Pinch S0").textContent).toContain("S0 · None");
    expect(cell("Crush").textContent).toContain("S3 · Fatal");
    expect(cell("Unrated").textContent).toContain("–");
  });
});
