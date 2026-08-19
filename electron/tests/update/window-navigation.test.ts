// electron/tests/update/window-navigation.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  makeIsInternalUrl,
  shouldOpenExternally,
  hardenWindowNavigation,
} from "../../window-navigation";
import type { WebContents } from "electron";

describe("makeIsInternalUrl", () => {
  it("dev: only the dev-server origin is internal", () => {
    const isInternal = makeIsInternalUrl(false);
    expect(isInternal("http://localhost:5173/")).toBe(true);
    expect(isInternal("http://localhost:5173/anything")).toBe(true);
    expect(isInternal("https://github.com/x")).toBe(false);
    expect(isInternal("file:///app/dist/index.html")).toBe(false);
  });

  it("packaged: only file:// is internal", () => {
    const isInternal = makeIsInternalUrl(true);
    expect(isInternal("file:///app/dist/index.html")).toBe(true);
    expect(isInternal("https://github.com/x")).toBe(false);
    expect(isInternal("http://localhost:5173/")).toBe(false);
  });
});

describe("shouldOpenExternally", () => {
  const isInternal = makeIsInternalUrl(false);
  it("is true for external http(s)", () => {
    expect(shouldOpenExternally("https://github.com/x", isInternal)).toBe(true);
    expect(shouldOpenExternally("http://example.com", isInternal)).toBe(true);
  });
  it("is false for internal, non-http, or junk", () => {
    expect(shouldOpenExternally("http://localhost:5173/", isInternal)).toBe(
      false,
    );
    expect(shouldOpenExternally("mailto:a@b.com", isInternal)).toBe(false);
    expect(shouldOpenExternally("about:blank", isInternal)).toBe(false);
    expect(shouldOpenExternally("garbage", isInternal)).toBe(false);
  });
});

function fakeContents() {
  let openHandler:
    | ((d: { url: string }) => { action: string })
    | undefined;
  let navHandler:
    | ((e: { preventDefault(): void }, url: string) => void)
    | undefined;
  return {
    setWindowOpenHandler: (h: (d: { url: string }) => { action: string }) => {
      openHandler = h;
    },
    on: (
      evt: string,
      l: (e: { preventDefault(): void }, url: string) => void,
    ) => {
      if (evt === "will-navigate") navHandler = l;
    },
    fireOpen: (url: string) => openHandler!({ url }),
    fireNavigate: (url: string) => {
      const e = { preventDefault: vi.fn() };
      navHandler!(e, url);
      return e;
    },
  };
}

describe("hardenWindowNavigation", () => {
  it("denies popups and opens external ones in the browser", () => {
    const shell = { openExternal: vi.fn(async () => {}) };
    const c = fakeContents();
    hardenWindowNavigation(
      c as unknown as WebContents,
      makeIsInternalUrl(false),
      shell,
    );

    expect(c.fireOpen("https://github.com/x")).toEqual({ action: "deny" });
    expect(shell.openExternal).toHaveBeenCalledWith("https://github.com/x");

    shell.openExternal.mockClear();
    // internal popup target → still denied, but NOT launched in the browser
    expect(c.fireOpen("http://localhost:5173/")).toEqual({ action: "deny" });
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it("lets internal navigation through but blocks + externalizes foreign nav", () => {
    const shell = { openExternal: vi.fn(async () => {}) };
    const c = fakeContents();
    hardenWindowNavigation(
      c as unknown as WebContents,
      makeIsInternalUrl(false),
      shell,
    );

    const internal = c.fireNavigate("http://localhost:5173/route");
    expect(internal.preventDefault).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();

    const external = c.fireNavigate("https://evil.example/x");
    expect(external.preventDefault).toHaveBeenCalled();
    expect(shell.openExternal).toHaveBeenCalledWith("https://evil.example/x");
  });
});
