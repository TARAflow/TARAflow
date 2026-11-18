// @vitest-environment jsdom
//
// Manual test 2026-11-17: the Verify panel lists the newest problems first,
// merges the same rule at one commit into one row, and names each group in
// words ("Errors (3)") instead of a lone "ERROR · 3" chip.

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeFinding, toResult } from "features/audit/services/verify/findings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string; count?: number }) => {
      const text = typeof options === "string" ? options : (options?.defaultValue ?? key);
      return typeof options === "object" && options?.count !== undefined ? text.replace("{{count}}", String(options.count)) : text;
    },
    i18n: { language: "en" },
  }),
}));

const result = toResult(
  [
    makeFinding("SIG_UNSIGNED", { commit: "c1aaaaaaaaaa" }),
    makeFinding("TCS_NONREPRODUCIBLE", { commit: "c1aaaaaaaaaa", context: { path: "a.tara.json" } }),
    makeFinding("TCS_NONREPRODUCIBLE", { commit: "c1aaaaaaaaaa", context: { path: "b.tara.json" } }),
    makeFinding("CMP_SNAPSHOT_HASH_MISMATCH", { commit: "c3cccccccccc", context: { path: "m.tara.json" } }),
  ],
  false,
);
vi.mock("features/audit/hooks/useAuditVerify", () => ({
  useAuditVerify: () => ({ result, loading: false, error: null, strict: false, setStrict: vi.fn(), canRun: true, run: vi.fn(), reset: vi.fn() }),
}));
vi.mock("features/audit/services/git-service-renderer", () => ({
  createGitService: () => ({ raw: async () => ({ success: true, data: "c3cccccccccc\nc2bbbbbbbbbb\nc1aaaaaaaaaa\n" }) }),
}));

import { AuditVerifyPanel } from "features/audit/components/audit-verify-panel";

describe("AuditVerifyPanel — rows", () => {
  it("a readable group heading, the newest commit first, merged rows with their files", async () => {
    render(<AuditVerifyPanel repoRoot="/r" anchor="anchor" branch="main" />);
    const group = screen.getByTestId("audit-verify-group-error");
    expect(within(group).getByText("Errors (4)")).toBeTruthy();
    await waitFor(() => expect(within(group).getAllByTestId("audit-verify-row")[0].textContent).toContain("c3cccccccc"));
    const rows = within(group).getAllByTestId("audit-verify-row");
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toContain("(2)");
    fireEvent.click(within(rows[2]).getByTestId("audit-verify-row-files"));
    expect(rows[2].textContent).toContain("a.tara.json");
    expect(rows[2].textContent).toContain("b.tara.json");
  });
});
