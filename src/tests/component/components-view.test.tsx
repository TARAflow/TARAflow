// src/tests/component/components-view.test.tsx
//
// Overview, tab "Components" (user 2026-11-11): one accordion per imported
// component in a list that scrolls on its own — the first open, the others
// closed —, the component's overview read-only, its origin, the instances
// with "Show in DFD"; the tab only while something is imported.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneralTab, type ComponentOverviewItem, type GeneralTabData } from "features/overview";
import { ComponentsView } from "features/overview/components/components-view";
import { EMPTY_PROJECT_TAGS, PHASES } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.skipInterpolation
        ? ((o?.defaultValue as string | undefined) ?? k)
        : ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
afterEach(cleanup);

const item = (id: string, name: string, extra: Partial<ComponentOverviewItem> = {}): ComponentOverviewItem => ({
  importId: id,
  name,
  version: "1.0",
  description: `${name} — what it does`,
  responsible: "Platform team",
  tags: { ...EMPTY_PROJECT_TAGS, platform: ["IoT"] },
  sections: [{ id: "environment", text: "Ceiling of an office", source: "Spec · §2" }],
  functions: [{ name: "Detect smoke", lifecyclePhases: ["operation"] }],
  sourceBindings: [{ repoUrl: "https://git.example.com/fw.git", refType: "tag", refLabel: "v1.2", commit: "abcdef0123456789" }],
  origin: { sameRepo: true, path: "import-example/SmokeDetectorCase.tara.json", commit: "0123456789abcdef", importedAt: "2026-11-10T10:00:00.000Z" },
  methodologyMatches: true,
  deviations: [],
  instances: [
    { id: "i1", prefix: "SD1", multiprocessTfId: "mp-1", quantity: 1, assumptionsTotal: 2, assumptionsDecided: 1, assumptionsNotFulfilled: 0 },
    { id: "i2", prefix: "SD2", multiprocessTfId: "mp-2", quantity: 3, assumptionsTotal: 2, assumptionsDecided: 2, assumptionsNotFulfilled: 1 },
  ],
  ...extra,
});

describe("ComponentsView", () => {
  it("one accordion per component in its own scroll area; the first open, the next on request", () => {
    render(<ComponentsView items={[item("a", "Smoke Detector"), item("b", "Siren", { drift: { kind: "newer_available", text: "Newer state available (89abcdef)" } })]} />);
    const scroll = screen.getByTestId("components-view-scroll");
    expect(getComputedStyle(scroll).overflowY).toBe("auto");
    expect(within(scroll).getAllByTestId(/^component-overview-[ab]$/)).toHaveLength(2);
    expect(screen.getByText("Smoke Detector — what it does")).toBeVisible();
    expect(screen.getByText("Siren — what it does")).not.toBeVisible();
    expect(within(screen.getByTestId("component-overview-b")).getByTestId("component-overview-drift").textContent).toContain("Newer state");
    fireEvent.click(screen.getByText("Siren"));
    expect(screen.getByText("Siren — what it does")).toBeVisible();
  });

  it("the overview read-only: origin, sources, Item Definition, instances with Show in DFD", () => {
    const onShow = vi.fn();
    render(<ComponentsView items={[item("a", "Smoke Detector")]} onShowInDfd={onShow} />);
    expect(screen.getByTestId("component-overview-repo").textContent).toContain("this repository");
    expect(screen.getByText("01234567")).toBeTruthy();
    expect(screen.getByTestId("component-overview-source").textContent).toContain("tag v1.2 · abcdef01");
    expect(screen.getByText("Ceiling of an office")).toBeTruthy();
    expect(screen.getByText("Source: Spec · §2")).toBeTruthy();
    expect(screen.getByTestId("component-overview-instance-SD2").textContent).toContain("2 of 2 decided, 1 not fulfilled");
    expect(screen.getByTestId("component-overview-instance-SD2").textContent).toContain("SD2 ×3");
    fireEvent.click(screen.getByTestId("component-overview-show-SD2"));
    expect(onShow).toHaveBeenCalledWith("mp-2");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("an import without the overview says so", () => {
    render(<ComponentsView items={[item("a", "Smoke Detector", { aboutMissing: true, description: undefined })]} />);
    expect(screen.getByTestId("component-overview-about-missing")).toBeTruthy();
  });
});

describe("ComponentsView: check and update (6d)", () => {
  it("Check, Fetch and check, Update… — the same actions as in the DFD's component section", () => {
    const onCheck = vi.fn();
    const onUpdate = vi.fn();
    render(<ComponentsView items={[item("a", "Smoke Detector", { update: { refresh: false } })]} onCheck={onCheck} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTestId("component-overview-check"));
    fireEvent.click(screen.getByTestId("component-overview-fetch"));
    expect(onCheck.mock.calls).toEqual([[false], [true]]);
    expect(screen.getByTestId("component-overview-update").textContent).toBe("Update…");
    fireEvent.click(screen.getByTestId("component-overview-update"));
    expect(onUpdate).toHaveBeenCalledWith("a");
  });

  it("the refresh of the stored state is named so; nothing to update → no button; checking disables the check", () => {
    render(<ComponentsView items={[item("a", "Smoke Detector", { update: { refresh: true } })]} onCheck={() => {}} checking onUpdate={() => {}} />);
    expect(screen.getByTestId("component-overview-update").textContent).toBe("Refresh stored state…");
    expect((screen.getByTestId("component-overview-check") as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    render(<ComponentsView items={[item("a", "Smoke Detector")]} onUpdate={() => {}} />);
    expect(screen.queryByTestId("component-overview-update")).toBeNull();
    expect(screen.queryByTestId("component-overview-actions")).toBeNull();
  });
});

describe("Overview tab Components", () => {
  const data = {
    info: { name: "Panel", description: "x", version: "1", responsible: "JM", created: "", lastModified: "", tags: EMPTY_PROJECT_TAGS, team: [], isHighImpact: false },
    settings: {},
    phaseStatus: {},
  } as unknown as GeneralTabData;
  const tab = (components?: ComponentOverviewItem[]) =>
    render(
      <GeneralTab data={data} phases={PHASES} progressPhaseIds={[0]} getStatusIcon={() => ""} getStatusColor={() => ""} onUpdate={vi.fn()} projectId={`P-${components?.length ?? 0}`} components={components} />,
    );

  it("only while something is imported; a newer state counts on the tab", () => {
    tab();
    expect(screen.queryByTestId("overview-view-components")).toBeNull();
    cleanup();
    tab([item("a", "Smoke Detector", { drift: { kind: "newer_available", text: "newer" } })]);
    expect(screen.getByTestId("overview-view-components-badge").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("overview-view-components"));
    expect(screen.getByTestId("components-view-scroll")).toBeTruthy();
  });

  it("the last instance deleted: no items, the tab goes and the Overview falls back to Project (6d)", () => {
    const props = { data, phases: PHASES, progressPhaseIds: [0], getStatusIcon: () => "", getStatusColor: () => "", onUpdate: vi.fn(), projectId: "P-del" };
    const { rerender } = render(<GeneralTab {...props} components={[item("a", "Smoke Detector")]} />);
    fireEvent.click(screen.getByTestId("overview-view-components"));
    expect(screen.getByTestId("overview-view-components").getAttribute("aria-selected")).toBe("true");
    rerender(<GeneralTab {...props} components={[]} />);
    expect(screen.queryByTestId("overview-view-components")).toBeNull();
    expect(screen.getByTestId("overview-view-project").getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByTestId("components-view-scroll")).toBeNull();
    localStorage.removeItem("taraflow.overview.view.P-del");
  });

  it("Sources counts a stored URL with credentials (review 2026-11-11)", () => {
    render(
      <GeneralTab
        data={{ ...data, sourceBindings: [{ id: "b1", repoUrl: "https://me:tok@git.example.com/r.git", refType: "branch", refLabel: "main", driftEvents: [] }] } as GeneralTabData}
        phases={PHASES}
        progressPhaseIds={[0]}
        getStatusIcon={() => ""}
        getStatusColor={() => ""}
        onUpdate={vi.fn()}
        projectId="P-src"
      />,
    );
    expect(screen.getByTestId("overview-view-sources-badge").textContent).toBe("1");
  });

  it("the deviations for the platform team, copied as Markdown (6a-3)", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <ComponentsView
        items={[
          item("a", "Smoke Detector", {
            deviations: [{ kind: "measure_not_effective", prefix: "SD2", measure: "M-I-002 — TLS", rationale: "No TLS on the panel bus" }],
          }),
        ]}
      />,
    );
    expect(screen.getByTestId("component-overview-deviations-a").textContent).toContain("SD2: M-I-002 — TLS — No TLS on the panel bus");
    fireEvent.click(screen.getByTestId("component-overview-copy-a"));
    await screen.findByText(/Copied/);
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("## Deviations from Smoke Detector @ 01234567");
    expect(text).toContain("For: Platform team");
    expect(text).toContain("### Measures not effective here");
  });
});

