// Assets outside the Asset tab are named "DA-005: sensor firmware" — the
// display id is what the analyst uses to find the asset.
import { describe, it, expect } from "vitest";
import { formatAssetLabel } from "shared";

describe("formatAssetLabel", () => {
  it("display id and name", () => {
    expect(formatAssetLabel({ displayId: "DA-005", name: "sensor firmware" })).toBe("DA-005: sensor firmware");
  });
  it("name only when there is no display id", () => {
    expect(formatAssetLabel({ name: "sensor firmware" })).toBe("sensor firmware");
  });
});
