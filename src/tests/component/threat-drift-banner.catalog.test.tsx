// Catalogue divergence phase A: the drift banner names an outdated threat
// catalogue — also when the drift itself is empty (same keys, other content) —
// and offers the regeneration (with its preview), not the drift review.
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThreatDriftBanner } from "features/threats/components/shared/threat-drift-banner";
import { NO_DRIFT } from "features/threats/services/threat-generation-drift";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown>) =>
      String(o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
  }),
}));

describe("ThreatDriftBanner — threat catalogue", () => {
  it("names the stored and the current version and offers the regeneration", () => {
    const onRegenerate = vi.fn();
    const onReview = vi.fn();
    render(
      <ThreatDriftBanner
        drift={NO_DRIFT}
        catalog={{ stored: 1, current: 2 }}
        onReview={onReview}
        onRegenerate={onRegenerate}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/generated with threat catalogue v1, current is v2/)).toBeTruthy();
    fireEvent.click(screen.getByText("Regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onReview).not.toHaveBeenCalled();
  });

  it("without a catalogue difference it says nothing about the catalogue", () => {
    render(
      <ThreatDriftBanner
        drift={{ obsolete: [], addedCount: 2 }}
        catalog={null}
        onReview={() => {}}
        onRegenerate={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByText(/threat catalogue/)).toBeNull();
    expect(screen.getByText(/2 threats would be added/)).toBeTruthy();
  });
});
