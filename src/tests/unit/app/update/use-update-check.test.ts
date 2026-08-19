// src/tests/unit/app/update/use-update-check.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { UpdateCheckResult } from "shared/models/update-types";

// Mock the storage singleton so the hook needs neither localStorage nor the
// app graph; an empty store => the default (includePrereleases: true).
vi.mock("app/services/storage-service", () => ({
  storageService: {
    get: vi.fn(async () => ({ success: false })),
    set: vi.fn(async () => ({ success: true })),
  },
}));

import { useUpdateCheck } from "app/update/use-update-check";

const upToDate: UpdateCheckResult = {
  status: "up-to-date",
  currentVersion: "0.8.3-alpha",
};
const available: UpdateCheckResult = {
  status: "update-available",
  currentVersion: "0.8.0",
  latestVersion: "0.9.0",
  releaseName: "0.9.0",
  releaseNotes: "notes",
  releaseUrl: "https://example/x",
  publishedAt: null,
};

type BridgeFn = (opts: {
  includePrereleases: boolean;
  force?: boolean;
}) => Promise<UpdateCheckResult>;

function setBridge(impl?: BridgeFn) {
  const check = impl ? vi.fn(impl) : undefined;
  (window as unknown as { updates?: { check: BridgeFn } }).updates = check
    ? { check }
    : undefined;
  return check;
}

beforeEach(() => {
  (window as unknown as { updates?: unknown }).updates = undefined;
});

describe("useUpdateCheck", () => {
  it("startup surfaces an available update", async () => {
    setBridge(async () => available);
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("startup");
    });
    expect(result.current.result).toEqual(available);
  });

  it("startup stays silent when up-to-date", async () => {
    setBridge(async () => upToDate);
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("startup");
    });
    expect(result.current.result).toBeNull();
  });

  it("manual surfaces up-to-date too", async () => {
    setBridge(async () => upToDate);
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("manual");
    });
    expect(result.current.result).toEqual(upToDate);
  });

  it("manual forces a fresh check and passes the prerelease preference", async () => {
    const check = setBridge(async () => upToDate)!;
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("manual");
    });
    expect(check).toHaveBeenCalledWith({
      includePrereleases: true,
      force: true,
    });
  });

  it("reports an error on manual when the bridge is missing", async () => {
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("manual");
    });
    expect(result.current.result?.status).toBe("error");
  });

  it("stays silent on startup when the bridge is missing", async () => {
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("startup");
    });
    expect(result.current.result).toBeNull();
  });

  it("dismiss clears the surfaced result", async () => {
    setBridge(async () => available);
    const { result } = renderHook(() => useUpdateCheck());
    await act(async () => {
      await result.current.check("startup");
    });
    expect(result.current.result).not.toBeNull();
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.result).toBeNull();
  });
});
