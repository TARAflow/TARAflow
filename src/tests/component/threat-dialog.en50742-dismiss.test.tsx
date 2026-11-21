// src/tests/component/threat-dialog.en50742-dismiss.test.tsx
//
// EN 50742 (0.20 patch 28): "won't" in the risk no longer lifts the SRSL
// rows — a threat that does not apply is dismissed at the threat. On an
// EN 50742 relevant interface / flow that needs a reason.
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThreatEvalDialog } from "features/threats/components/shared/threat-dialog";
import { createEmptyThreat, type Threat } from "features/threats/models/threat-types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(options?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
Element.prototype.scrollIntoView = vi.fn();
afterEach(cleanup);

const onInterface = (elementId: string): Threat => ({
  ...createEmptyThreat(`t-${elementId}`, "T", null, "Machine", "MTB"),
  displayId: `${elementId}-T-1`,
  threatDescription: "Tampering via USB",
  linkedElement: { elementId, displayId: elementId, elementName: "USB", elementType: "Interface" },
  relevance: "unrated",
});

const open = (threat: Threat, relevant?: ReadonlySet<string>) => {
  const onSave = vi.fn();
  render(
    <ThreatEvalDialog
      open
      threats={[threat]}
      initialIndex={0}
      configuration={{} as never}
      onSave={onSave}
      onClose={vi.fn()}
      {...(relevant ? { en50742RelevantAnchorIds: relevant } : {})}
    />,
  );
  return onSave;
};
const dismiss = async () => {
  fireEvent.click(screen.getByText("Dismiss"));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 320));
  });
};

describe("ThreatEvalDialog — dismissing on an EN 50742 relevant anchor", () => {
  it("without a note: refused, the reason is asked for", async () => {
    const onSave = open(onInterface("if-1"), new Set(["if-1"]));
    await dismiss();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/note why it does not apply before dismissing it/)).toBeTruthy();
  });

  it("with a note: dismissed", async () => {
    const onSave = open({ ...onInterface("if-1"), evalNote: "port sealed at the factory" }, new Set(["if-1"]));
    await dismiss();
    expect(onSave).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ relevance: "not_relevant" }));
  });

  it("not a relevant anchor, or no EN 50742 project: dismissed as before", async () => {
    const onSave = open(onInterface("p-1"), new Set(["if-1"]));
    await dismiss();
    expect(onSave).toHaveBeenCalled();
    cleanup();
    const onSave2 = open(onInterface("if-1"));
    await dismiss();
    expect(onSave2).toHaveBeenCalled();
  });
});
