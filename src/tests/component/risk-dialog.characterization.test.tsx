// src/tests/component/risk-dialog.characterization.test.tsx
//
// Characterization of RiskDialog (MT-2): written against the single-file
// version BEFORE it was split into state hooks and one file per tab
// (features/risks/components/risk-dialog/*), and kept as the regression net
// for the split and for later changes. Renders the real dialog (MUI, jsdom).
//
// Covered: order and navigation (save on switch, counter, bounds), auto-save
// with the calculated values, factor change and reset to the derived value,
// mitigation selection with its linked verifications, treatment chips
// (accept → won't, after = before), copy Before → After, EN 50742 A mandated
// controls pre-selected, ISO mode without editable likelihood factors, the
// Goal / Claim tab only with a concept writer, the uncertain chip, OK.

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskDialog } from "features/risks/components/risk-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";
import type { AssetDataReference, ThreatReference } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

// jsdom has no scrollIntoView (the dialog scrolls the active risk into view).
Element.prototype.scrollIntoView = () => {};

afterEach(cleanup);

// ==================== FIXTURES ====================

const rating = (factorId: string, value: number, extra: Record<string, unknown> = {}) => ({
  factorId,
  value,
  weight: 1,
  ...extra,
});

/** Default configuration: skill_level, motive, opportunity, ease_of_exploit, deployment_scope + impact factors. */
const CONFIG: RiskConfiguration = {
  ...DEFAULT_CONFIGURATION,
  activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) =>
    f.factorId === "financial_damage" ? { ...f, enabled: true } : f,
  ),
};

const mk = (id: string, displayId: string, patch: Partial<Risk> = {}): Risk =>
  ({
    id,
    threatId: `t-${id}`,
    threatDisplayId: displayId,
    sourceStrideMethod: "per-element",
    threatDescription: `Threat ${displayId}`,
    strideCategory: "T",
    threatRelevance: "relevant",
    linkedAssetIds: [],
    treatment: "reduce",
    moscowPriority: "must",
    selectedMitigations: [],
    selectedVerifications: [],
    proposedMitigations: [],
    proposedVerifications: [],
    factorRatings: [
      rating("skill_level", 2),
      rating("motive", 3),
      rating("opportunity", 2),
      rating("ease_of_exploit", 3),
      rating("deployment_scope", 1),
      rating("financial_damage", 3),
    ],
    mitigatedFactorRatings: [
      rating("skill_level", 0),
      rating("motive", 0),
      rating("opportunity", 0),
      rating("ease_of_exploit", 0),
      rating("deployment_scope", 0),
      rating("financial_damage", 0),
    ],
    calculatedRiskBeforeMitigation: 0,
    calculatedRiskAfterMitigation: 0,
    ...patch,
  }) as unknown as Risk;

function open(
  risks: Risk[],
  opts: {
    initialIndex?: number;
    configuration?: RiskConfiguration;
    threats?: ThreatReference[];
    assetDataRef?: AssetDataReference;
    withConcept?: boolean;
    isoMode?: boolean;
  } = {},
) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <RiskDialog
      open
      risks={risks}
      initialIndex={opts.initialIndex ?? 0}
      configuration={opts.configuration ?? CONFIG}
      threats={opts.threats}
      assetDataRef={opts.assetDataRef}
      onSave={onSave}
      onClose={onClose}
      {...(opts.withConcept
        ? {
            concept: { goals: [], claims: [], verifications: [] } as never,
            onConceptChange: vi.fn(),
          }
        : {})}
      isoMode={opts.isoMode}
    />,
  );
  return { onSave, onClose, lastSave: () => onSave.mock.calls[onSave.mock.calls.length - 1] };
}

const tab = (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole("tab", { name }));
  });

const dialog = () => screen.getByRole("dialog");
const header = () => within(dialog()).getAllByRole("heading")[0];
const counter = () => within(dialog()).getByText(/^\d+\/\d+$/).textContent;
const navButton = (icon: "NavigateNextIcon" | "NavigateBeforeIcon") =>
  dialog().querySelector(`[data-testid="${icon}"]`)!.closest("button") as HTMLButtonElement;

async function pickOption(combobox: HTMLElement, label: RegExp | string) {
  await act(async () => {
    fireEvent.mouseDown(combobox);
  });
  const option = within(screen.getByRole("listbox")).getByText(label);
  await act(async () => {
    fireEvent.click(option);
  });
}

// ==================== ORDER / NAVIGATION ====================

describe("RiskDialog — order and navigation", () => {
  const three = () => [mk("r-b", "P2-T-1"), mk("r-c", "P10-T-1"), mk("r-a", "P1-T-1")];

  it("opens the requested risk, the list in display-id order", () => {
    open(three(), { initialIndex: 0 }); // r-b → position 2 of P1, P2, P10
    expect(header().textContent).toContain("P2-T-1");
    expect(counter()).toBe("2/3");
    const ids = within(document.querySelector("ul") as HTMLElement)
      .getAllByText(/^P\d+-T-1$/)
      .map((e) => e.textContent);
    expect(ids).toEqual(["P1-T-1", "P2-T-1", "P10-T-1"]);
  });

  it("saves the current risk on next / previous and moves", async () => {
    const { onSave } = open(three(), { initialIndex: 0 });
    onSave.mockClear();
    await act(async () => {
      fireEvent.click(navButton("NavigateNextIcon"));
    });
    expect(onSave.mock.calls[0][0]).toBe("r-b");
    expect(counter()).toBe("3/3");
    expect(header().textContent).toContain("P10-T-1");
    expect(navButton("NavigateNextIcon").disabled).toBe(true);
  });

  it("previous is disabled on the first risk", () => {
    open(three(), { initialIndex: 2 }); // r-a = P1
    expect(counter()).toBe("1/3");
    expect(navButton("NavigateBeforeIcon").disabled).toBe(true);
  });

  it("a click in the side list switches the risk and saves the previous one", async () => {
    const { onSave } = open(three(), { initialIndex: 0 });
    onSave.mockClear();
    const list = document.querySelector("ul") as HTMLElement;
    await act(async () => {
      fireEvent.click(within(list).getByText("P1-T-1"));
    });
    expect(onSave.mock.calls[0][0]).toBe("r-b");
    expect(header().textContent).toContain("P1-T-1");
  });

  it("OK closes the dialog", () => {
    const { onClose } = open(three());
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ==================== AUTO-SAVE / FACTORS ====================

describe("RiskDialog — auto-save and factors", () => {
  it("auto-saves on open with the calculated values", () => {
    const r = mk("r1", "P1-T-1");
    const { onSave } = open([r]);
    expect(onSave).toHaveBeenCalled();
    const [id, patch] = onSave.mock.calls[0];
    const expected = calculateRiskValues(r.factorRatings, CONFIG);
    expect(id).toBe("r1");
    expect(patch.calculatedRiskBeforeMitigation).toBe(expected.risk);
    expect(patch.calculatedImpact).toBe(expected.impact);
    expect(patch.calculatedLikelihood).toBe(expected.likelihood);
    expect(patch.treatment).toBe("reduce");
    expect(patch.factorRatings).toEqual(r.factorRatings);
  });

  it("a changed factor is saved with the recalculated risk", async () => {
    const r = mk("r1", "P1-T-1");
    const { lastSave } = open([r]);
    const before = lastSave()[1].calculatedRiskBeforeMitigation;
    const combos = within(dialog()).getAllByRole("combobox");
    await pickOption(combos[0], "Not rated");
    const patch = lastSave()[1];
    expect(patch.factorRatings.find((f: { value: number }) => f.value === 0)).toBeDefined();
    expect(patch.calculatedRiskBeforeMitigation).not.toBe(before);
  });

  it("reset returns an overridden factor to its derived value", async () => {
    const r = mk("r1", "P1-T-1", {
      factorRatings: [
        rating("skill_level", 2),
        rating("motive", 3),
        rating("opportunity", 2),
        rating("ease_of_exploit", 3),
        rating("deployment_scope", 1),
        rating("financial_damage", 1, { derivedValue: 3, source: "manual" }),
      ],
    } as Partial<Risk>);
    const { lastSave } = open([r]);
    const reset = dialog().querySelector('[data-testid="RefreshIcon"]')!.closest("button")!;
    await act(async () => {
      fireEvent.click(reset);
    });
    const fd = lastSave()[1].factorRatings.find((f: { factorId: string }) => f.factorId === "financial_damage");
    expect(fd.value).toBe(3);
    expect(fd.source).toBe("derived");
  });

  it("copy from Before puts the before ratings into After", async () => {
    const r = mk("r1", "P1-T-1");
    const { lastSave } = open([r]);
    await tab("Risk After");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy from Before/ }));
    });
    const patch = lastSave()[1];
    expect(patch.mitigatedFactorRatings).toEqual(r.factorRatings);
    expect(patch.calculatedRiskAfterMitigation).toBe(patch.calculatedRiskBeforeMitigation);
  });
});

// ==================== MITIGATIONS / TREATMENT ====================

describe("RiskDialog — mitigations and treatment", () => {
  it("selecting a catalog mitigation also selects its verifications; deselecting removes them", async () => {
    const entry = getAllMitigations().find((m) => (m.verifications?.length ?? 0) > 0)!;
    expect(entry).toBeDefined();
    const r = mk("r1", "P1-T-1", { proposedMitigations: [{ id: entry.id }] } as Partial<Risk>);
    const { lastSave } = open([r]);
    await tab("Mitigations");
    const box = within(dialog()).getAllByRole("checkbox")[0];
    await act(async () => {
      fireEvent.click(box);
    });
    let patch = lastSave()[1];
    expect(patch.selectedMitigations.map((m: { id: string }) => m.id)).toEqual([entry.id]);
    expect(patch.selectedVerifications).toEqual(expect.arrayContaining(entry.verifications!));
    await act(async () => {
      fireEvent.click(within(dialog()).getAllByRole("checkbox")[0]);
    });
    patch = lastSave()[1];
    expect(patch.selectedMitigations).toEqual([]);
    expect(patch.selectedVerifications).toEqual([]);
  });

  it("treatment accept: priority won't, after = before, the note shown", async () => {
    const r = mk("r1", "P1-T-1");
    const { lastSave } = open([r]);
    await tab("Mitigations");
    await act(async () => {
      fireEvent.click(within(dialog()).getByText("Accept"));
    });
    const patch = lastSave()[1];
    expect(patch.treatment).toBe("accept");
    expect(patch.moscowPriority).toBe("wont");
    expect(patch.mitigatedFactorRatings).toEqual(r.factorRatings);
    expect(within(dialog()).getByText(/Risk is accepted/)).toBeTruthy();
  });

  it("back from accept to reduce: won't becomes should", async () => {
    const r = mk("r1", "P1-T-1", { treatment: "accept", moscowPriority: "wont" } as Partial<Risk>);
    const { lastSave } = open([r]);
    await tab("Mitigations");
    await act(async () => {
      fireEvent.click(within(dialog()).getByText("Reduce"));
    });
    expect(lastSave()[1].treatment).toBe("reduce");
    expect(lastSave()[1].moscowPriority).toBe("should");
  });
});

// ==================== METHODS ====================

describe("RiskDialog — methods", () => {
  it("EN 50742 A: the mandated 7.4.3 controls of an interface threat are pre-selected", () => {
    const config: RiskConfiguration = {
      ...CONFIG,
      likelihoodMethod: "en-50742-a",
      windowOfOpportunity: "limited",
      activeFactors: CONFIG.activeFactors.map((f) =>
        ["exposure_level", "attacker_capability"].includes(f.factorId) ? { ...f, enabled: true } : f,
      ),
    } as RiskConfiguration;
    const r = mk("r1", "IF1-T-1", {
      linkedAssetIds: ["a1"],
      factorRatings: [
        ...mk("x", "x").factorRatings,
        rating("exposure_level", 5, { source: "manual" }),
        rating("attacker_capability", 4),
      ],
    } as Partial<Risk>);
    const threat = {
      id: "t-r1",
      displayId: "IF1-T-1",
      strideCategory: "T",
      linkedElement: { elementId: "if1", elementType: "Interface", elementName: "Port" },
      linkedAssetIds: ["a1"],
    } as unknown as ThreatReference;
    const assetDataRef = {
      assets: [{ id: "a1", name: "Drive", assetGroup: "function", physicalImpact: "fatal" }],
    } as unknown as AssetDataReference;
    const { onSave } = open([r], { configuration: config, threats: [threat], assetDataRef });
    const last = onSave.mock.calls[onSave.mock.calls.length - 1][1];
    expect(last.calculatedSrsl).toBeTruthy();
    expect(last.selectedMitigations.some((m: { id: string }) => m.id.startsWith("en50742-7.4.3.4"))).toBe(true);
  });

  it("ISO/SAE 21434: no editable likelihood factors on the risk", () => {
    const config: RiskConfiguration = { ...CONFIG, likelihoodMethod: "iso-21434" };
    open([mk("r1", "P1-T-1")], { configuration: config, isoMode: true });
    expect(within(dialog()).queryByText(/Skill Level/)).toBeNull();
  });

  it("the standard method shows the likelihood factors", () => {
    open([mk("r1", "P1-T-1")]);
    expect(within(dialog()).getAllByText(/Skill Level/).length).toBeGreaterThan(0);
  });
});

// ==================== TABS / CHIPS ====================

describe("RiskDialog — tabs and chips", () => {
  it("the Goal / Claim tab only with a concept writer", () => {
    open([mk("r1", "P1-T-1")]);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Risk Before", "Mitigations", "Risk After"]);
    cleanup();
    open([mk("r1", "P1-T-1")], { withConcept: true });
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("an uncertain threat shows the chip in the header", () => {
    open([mk("r1", "P1-T-1", { threatRelevance: "uncertain" } as Partial<Risk>)]);
    expect(within(header()).getByText("Uncertain")).toBeTruthy();
  });

  it("switching the risk returns to the first tab", async () => {
    open([mk("r1", "P1-T-1"), mk("r2", "P2-T-1")]);
    await tab("Risk After");
    expect(screen.getByRole("tab", { name: "Risk After" }).getAttribute("aria-selected")).toBe("true");
    await act(async () => {
      fireEvent.click(navButton("NavigateNextIcon"));
    });
    expect(screen.getByRole("tab", { name: "Risk Before" }).getAttribute("aria-selected")).toBe("true");
  });
});
