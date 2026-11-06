// src/tests/component/item-definition-neutral.test.tsx
//
// Outside ISO/SAE 21434 the Overview's Definition is the system definition:
// intro, hints and section titles come from "itemDefinition.neutral.*" (no
// "item", no clause numbers); an ISO project keeps its wording.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemDefinitionView } from "features/overview/components/item-definition-view";

// The key is the text; "exists" knows the real EN keys (common and, since
// I18N-1, the overview namespace — the app finds both through fallbackNS).
vi.mock("react-i18next", async () => {
  const common = (await import("../../i18n/locales/en/common.json")).default as Record<string, unknown>;
  const overview = (await import("../../i18n/locales/en/overview.json")).default as Record<string, unknown>;
  const has = (ns: Record<string, unknown>, k: string) =>
    k.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], ns) !== undefined;
  const exists = (k: string) => has(common, k) || has(overview, k);
  return { useTranslation: () => ({ t: (k: string) => k, i18n: { language: "en", exists } }) };
});

afterEach(cleanup);

const view = (neutral: boolean) =>
  render(
    <ItemDefinitionView description="" itemDefinition={undefined} modelItems={[]} onChange={vi.fn()} neutral={neutral} />,
  );

describe("ItemDefinitionView — system definition outside ISO/SAE 21434", () => {
  it("neutral: intro, boundary title and hints from the neutral keys", () => {
    view(true);
    expect(screen.getByText("itemDefinition.neutral.intro")).toBeTruthy();
    expect(screen.getByText("itemDefinition.neutral.sections.boundary.title")).toBeTruthy();
    expect(screen.getByText("itemDefinition.neutral.functions.hint")).toBeTruthy();
    expect(screen.getByText("itemDefinition.neutral.assumptions.hint")).toBeTruthy();
    // A key without a neutral variant keeps its text.
    expect(document.body.textContent).toContain("itemDefinition.sections.constraints.title");
  });

  it("ISO project: the ISO wording", () => {
    view(false);
    expect(screen.getByText("itemDefinition.intro")).toBeTruthy();
    expect(screen.getByText("itemDefinition.sections.boundary.title")).toBeTruthy();
    expect(screen.queryByText("itemDefinition.neutral.intro")).toBeNull();
  });
});
