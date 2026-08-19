// src/tests/unit/app/update/external-link.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { externalHref, openExternalHref } from "app/update/external-link";

describe("externalHref", () => {
  it("returns absolute http(s) URLs", () => {
    expect(externalHref("https://example.com/x")).toBe("https://example.com/x");
    expect(externalHref("http://example.com")).toBe("http://example.com/");
  });

  it("rejects fragments, mailto, relative paths and junk", () => {
    expect(externalHref("#section")).toBeNull();
    expect(externalHref("mailto:a@b.com")).toBeNull();
    expect(externalHref("/relative/path")).toBeNull();
    expect(externalHref("./also-relative")).toBeNull();
    expect(externalHref("javascript:alert(1)")).toBeNull();
    expect(externalHref("")).toBeNull();
    expect(externalHref(undefined)).toBeNull();
    expect(externalHref("not a url")).toBeNull();
  });
});

describe("openExternalHref", () => {
  const openExternal = vi.fn(async () => {});

  beforeEach(() => {
    openExternal.mockClear();
    (window as unknown as { electron: unknown }).electron = {
      shell: { openExternal },
    };
  });

  it("opens real external links in the shell", () => {
    openExternalHref("https://example.com/release");
    expect(openExternal).toHaveBeenCalledWith("https://example.com/release");
  });

  it("does not open fragments, mailto or relative links", () => {
    openExternalHref("#changelog");
    openExternalHref("mailto:x@y.com");
    openExternalHref("/local");
    openExternalHref(undefined);
    expect(openExternal).not.toHaveBeenCalled();
  });
});
