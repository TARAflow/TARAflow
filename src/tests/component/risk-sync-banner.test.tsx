// src/tests/component/risk-sync-banner.test.tsx
//
// Manual test 2026-11-15: the Risks tab showed a collapsed "n notifications
// need your attention" box also when nothing was to do (the results of the
// last sync stayed in it), the sync action hidden inside. Now like the
// Threats and Assets tabs: a warning only where something is to do, the
// sync action visible; results are a dismissible information.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskSyncBanner } from "features/risks/components/risk-sync-banner";
import type { RiskSyncStatus } from "features/risks/services/risk-sync-service";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const status = (over: Partial<RiskSyncStatus> = {}) =>
  ({
    newThreats: 0,
    orphanedRisks: 0,
    changedDescriptions: 0,
    changedMitigations: 0,
    uncertainRisks: 0,
    changedExposureLevels: 0,
    changedLinkedAssets: 0,
    changedDisplayIds: 0,
    needsSync: false,
    ...over,
  }) as unknown as RiskSyncStatus;

describe("RiskSyncBanner", () => {
  it("nothing to do, nothing shown", () => {
    const { container } = render(<RiskSyncBanner syncWarnings={[]} needsSync={false} isSyncing={false} syncStatus={status()} onSync={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("out of sync: a warning with the summary and the sync action visible at once", () => {
    const onSync = vi.fn();
    render(<RiskSyncBanner syncWarnings={[]} needsSync isSyncing={false} syncStatus={status({ newThreats: 1 })} onSync={onSync} />);
    const banner = screen.getByTestId("risk-sync-banner");
    expect(banner.textContent).toContain("1 new");
    fireEvent.click(within(banner).getByText("Sync Now"));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("the results of the last sync are an information, dismissible — no warning", () => {
    const onDismiss = vi.fn();
    render(
      <RiskSyncBanner
        syncWarnings={["Added 1 new risk(s) for new threats."]}
        onDismissNotices={onDismiss}
        needsSync={false}
        isSyncing={false}
        syncStatus={status()}
        onSync={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("risk-sync-banner")).toBeNull();
    const notices = screen.getByTestId("risk-sync-notices");
    expect(notices.className).toContain("Info");
    fireEvent.click(within(notices).getByRole("button"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("risks on uncertain threats: a warning (confirm them in the Threats tab)", () => {
    render(<RiskSyncBanner syncWarnings={[]} needsSync={false} isSyncing={false} syncStatus={status({ uncertainRisks: 2 })} onSync={vi.fn()} />);
    expect(screen.getByTestId("risk-uncertain-banner").textContent).toContain("2 risk(s)");
  });
});
