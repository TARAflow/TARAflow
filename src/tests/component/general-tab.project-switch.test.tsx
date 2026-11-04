// @vitest-environment jsdom
//
// Regression: switching projects while the Overview is open must never write
// one project's data into another.
//
// The workspace rendered one GeneralTab instance for every project (a
// prop-only swap on a switch). An open draft — Project info in edit mode —
// survived the switch, and saving it wrote the outgoing project's name,
// version, responsible … into the incoming project. And a source binding
// resolve finished after a network round-trip with the data captured at click
// time, rolling back edits made meanwhile.
//
// GeneralTab now keys its view by project id and builds the source binding
// update from the latest data. The tests render the tab WITHOUT a key on
// purpose, with one handler per project.

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PROJECT_TAGS, PHASES, type SourceBinding } from "shared";
import type { GeneralTabData } from "features/overview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en", exists: () => false },
  }),
}));

// The source binding section, reduced to "resolve finishes later".
let finishResolve: (() => void) | null = null;
vi.mock("features/overview/components/source-bindings-section", () => ({
  SourceBindingsSection: ({ onUpdate }: { onUpdate: (b: SourceBinding[]) => void }) => (
    <button
      onClick={async () => {
        await new Promise<void>((resolve) => {
          finishResolve = resolve;
        });
        onUpdate([{ id: "SB-1" } as unknown as SourceBinding]);
      }}
    >
      resolve
    </button>
  ),
}));

import { GeneralTab } from "features/overview";

const dataFor = (name: string): GeneralTabData =>
  ({
    info: {
      name,
      description: `${name} description`,
      version: name === "Alpha" ? "1.0" : "9.9",
      responsible: name,
      created: "2026-10-27T10:00:00.000Z",
      lastModified: "2026-10-27T10:00:00.000Z",
      tags: { ...EMPTY_PROJECT_TAGS },
      team: [],
      isHighImpact: false,
    },
    settings: {},
    phaseStatus: {},
  }) as unknown as GeneralTabData;

const tab = (projectId: string, data: GeneralTabData, onUpdate: (d: GeneralTabData) => void) => (
  <GeneralTab
    data={data}
    phases={PHASES}
    progressPhaseIds={[0]}
    getStatusIcon={() => ""}
    getStatusColor={() => ""}
    onUpdate={onUpdate}
    projectId={projectId}
  />
);

afterEach(() => {
  cleanup();
  localStorage.clear();
  finishResolve = null;
});

describe("GeneralTab — project switch", () => {
  it("does not carry an open Project info draft into the next project", () => {
    const onUpdateA = vi.fn<(d: GeneralTabData) => void>();
    const onUpdateB = vi.fn<(d: GeneralTabData) => void>();

    const { rerender } = render(tab("A", dataFor("Alpha"), onUpdateA));
    fireEvent.click(screen.getByText("common.edit"));

    // Prop-only swap to B while A's draft is open.
    rerender(tab("B", dataFor("Beta"), onUpdateB));

    // A fresh view: no draft open. If one were, saving it must not rename B.
    const save = screen.queryByText("common.save");
    if (save) fireEvent.click(save);

    expect(onUpdateA).not.toHaveBeenCalled();
    for (const [d] of onUpdateB.mock.calls) {
      expect(d.info.name).toBe("Beta");
      expect(d.info.version).toBe("9.9");
    }
    expect(save).toBeNull();
  });

  it("a late source binding resolve keeps edits made meanwhile", async () => {
    const onUpdate = vi.fn<(d: GeneralTabData) => void>();

    const { rerender } = render(tab("A", dataFor("Alpha"), onUpdate));
    fireEvent.click(screen.getByTestId("overview-view-sources"));
    fireEvent.click(screen.getByText("resolve"));

    // Meanwhile the project was renamed (same project, newer data).
    const renamed = dataFor("Alpha");
    renamed.info = { ...renamed.info, name: "Alpha renamed" };
    rerender(tab("A", renamed, onUpdate));

    await act(async () => {
      finishResolve?.();
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const saved = onUpdate.mock.calls[0][0];
    expect(saved.sourceBindings?.[0]?.id).toBe("SB-1");
    expect(saved.info.name).toBe("Alpha renamed");
  });
});
