// The unused-channel warning names the channel in the UI language (param "channel").
import { describe, expect, it } from "vitest";
import { translateFinding } from "features/dfd/utils/translate-finding";

describe("translateFinding — channel param", () => {
  it("resolves the channel through the secure-channel option labels", () => {
    const t = (key: string, o?: Record<string, unknown>) =>
      key.endsWith(".options.ssh") ? "SSH (label)" : `${key}|${o?.channel ?? ""}|${o?.detail ?? ""}`;
    expect(
      translateFinding(t, { key: "tabs.dfd.validation.df.tls.channelUnused", params: { detail: "P-1", channel: "ssh" } }),
    ).toBe("tabs.dfd.validation.df.tls.channelUnused|SSH (label)|P-1");
  });
});
