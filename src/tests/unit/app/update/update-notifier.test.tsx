// src/tests/unit/app/update/update-notifier.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { UpdateCheckResult } from "shared/models/update-types";

const check = vi.fn(async () => {});
const dismiss = vi.fn();
let currentResult: UpdateCheckResult | null = null;

vi.mock("app/update/use-update-check", () => ({
  useUpdateCheck: () => ({
    checking: false,
    result: currentResult,
    check,
    dismiss,
  }),
}));
vi.mock("app/services/storage-service", () => ({
  storageService: {
    get: async () => ({ success: false }),
    set: async () => ({ success: true }),
  },
}));
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="md">{children}</div>
  ),
}));
vi.mock("remark-gfm", () => ({ default: () => undefined }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
}));

import { UpdateNotifier } from "app/update/update-notifier";

const available: UpdateCheckResult = {
  status: "update-available",
  currentVersion: "0.8.0",
  latestVersion: "0.9.0",
  releaseName: "0.9.0 — big",
  releaseNotes: "## notes",
  releaseUrl: "https://example/rel",
  publishedAt: "2026-08-18T00:00:00Z",
};

let menuCb: (() => void) | undefined;
const openExternal = vi.fn(async () => {});

beforeEach(() => {
  check.mockClear();
  dismiss.mockClear();
  openExternal.mockClear();
  currentResult = null;
  menuCb = undefined;
  (window as unknown as { updates: unknown }).updates = {
    onMenuCheck: (cb: () => void) => {
      menuCb = cb;
      return () => {};
    },
  };
  (window as unknown as { electron: unknown }).electron = {
    shell: { openExternal },
  };
});

describe("UpdateNotifier", () => {
  it("fires the silent startup check on mount", () => {
    render(<UpdateNotifier />);
    expect(check).toHaveBeenCalledWith("startup");
  });

  it("renders nothing when there is no result", () => {
    const { container } = render(<UpdateNotifier />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the update snackbar, opens details with notes, and opens the release page", async () => {
    currentResult = available;
    render(<UpdateNotifier />);

    expect(screen.getByText(/update\.available/)).toBeTruthy();

    fireEvent.click(screen.getByText("update.details"));
    await waitFor(() => expect(screen.getByTestId("md")).toBeTruthy());
    expect(screen.getByText("## notes")).toBeTruthy();

    fireEvent.click(screen.getByText("update.openReleasePage"));
    expect(openExternal).toHaveBeenCalledWith("https://example/rel");
  });

  it("runs a manual check when the Help menu fires", () => {
    render(<UpdateNotifier />);
    check.mockClear();
    menuCb?.();
    expect(check).toHaveBeenCalledWith("manual");
  });
});
