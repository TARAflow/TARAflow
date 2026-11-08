// Multi-project TARA I7 (4), phase 3d-2a: in the Risk tab a residual risk
// that is not credited shows the values before treatment — matrix, columns —
// with a marker; the After tab's banner says why; the ticket keeps the target
// value and adds the note.
import React from "react";
import { cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskMatrix } from "features/risks/components/risk-matrix";
import { useRiskColumns } from "features/risks/components/shared/risk-columns";
import { UncreditedBanner, UncreditedResidualsProvider } from "features/risks/components/credited-residual-context";
import { buildTicketDescription } from "features/risks/services/ticket-text";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { ResidualBlocker } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, string>) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, k: string) => o?.[k] ?? ""),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const risk = (over: any = {}): any => ({
  id: "R-1",
  threatDisplayId: "SD1:P2-T-1",
  threatDescription: "threat",
  strideCategory: "T",
  moscowPriority: "should",
  treatment: "reduce",
  factorRatings: [],
  mitigatedFactorRatings: [],
  selectedMitigations: [],
  calculatedImpact: 0,
  calculatedLikelihood: 0,
  calculatedRiskBeforeMitigation: 9,
  calculatedRiskAfterMitigation: 2,
  isoRisk: { impact: "severe", feasibility: "high", value: 5, residual: { feasibility: "low", value: 3 } },
  ...over,
});
const blocker: ResidualBlocker = {
  measure: "M-C-012",
  context: "SD2 · Smoke Detector",
  state: "not_effective",
  causes: [{ kind: "aou_not_fulfilled", ref: "ASM-03" }],
};
const unc = new Map([["R-1", [blocker]]]);
const wrap = ({ children }: { children: React.ReactNode }) => <UncreditedResidualsProvider value={unc}>{children}</UncreditedResidualsProvider>;
const iso = { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" as const };

describe("Risk tab readers", () => {
  it("ISO matrix, After view: the risk stays in its cell before treatment", () => {
    render(<RiskMatrix risks={[risk()]} configuration={iso} />, { wrapper: wrap });
    fireEvent.click(screen.getByText("After"));
    expect(within(screen.getByTestId("iso-cell-severe-high")).getByText("SD1:P2-T-1")).toBeTruthy();
    expect(screen.queryByTestId("iso-cell-severe-low")?.textContent ?? "").not.toContain("SD1:P2-T-1");
  });

  const cell = (likelihoodMethod: string | undefined, id: string, withProvider: boolean) => {
    const cols = renderHook(
      () =>
        useRiskColumns({
          configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod } as never,
          onEdit: vi.fn(),
          onPriorityChange: vi.fn(),
          onTreatmentChange: vi.fn(),
        }),
      withProvider ? { wrapper: wrap } : undefined,
    ).result.current;
    return render(<>{cols.find((x) => x.id === id)!.renderCell(risk())}</>);
  };

  it("columns: residual before treatment with a marker; without the set the stored value", () => {
    const isoCell = cell("iso-21434", "riskAfter", true);
    expect(isoCell.container.textContent).toBe("5 · Critical");
    expect(isoCell.getByTestId("residual-not-credited")).toBeTruthy();
    cleanup();
    expect(cell(undefined, "riskAfter", true).container.textContent).toContain("9");
    cleanup();
    const plain = cell("iso-21434", "riskAfter", false);
    expect(plain.container.textContent).toBe("3 · Medium");
    expect(plain.queryByTestId("residual-not-credited")).toBeNull();
  });
});

describe("After tab banner", () => {
  it("names measure, instance, state and cause; acceptance to review for an accepted risk", () => {
    render(<UncreditedBanner risk={risk({ treatment: "accept" })} />, { wrapper: wrap });
    const banner = screen.getByTestId("residual-not-credited-banner");
    expect(banner.textContent).toContain("Not credited: M-C-012 of the component in SD2 · Smoke Detector not effective (ASM-03 not fulfilled)");
    expect(screen.getByTestId("acceptance-to-review")).toBeTruthy();
  });

  it("nothing when the residual counts", () => {
    render(<UncreditedBanner risk={risk({ id: "R-2" })} />, { wrapper: wrap });
    expect(screen.queryByTestId("residual-not-credited-banner")).toBeNull();
  });
});

describe("ticket text", () => {
  it("keeps the stored target value and adds the note", () => {
    const text = buildTicketDescription(risk(), { id: "M-1", status: "planned" } as never, "Sign frames", [blocker]);
    expect(text).toContain("Before: 9.0 | After: 2.0");
    expect(text).toContain("_Residual risk currently not credited: M-C-012 (SD2 · Smoke Detector): ASM-03 not fulfilled_");
    expect(buildTicketDescription(risk(), { id: "M-1", status: "planned" } as never, "Sign frames")).not.toContain("not credited");
  });
});
