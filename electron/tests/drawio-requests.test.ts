import { describe, expect, it } from "vitest";
import { blockDiagnostics, withoutReferrer } from "../drawio-requests";

describe("withoutReferrer", () => {
  it("drops Referer and Origin in any case, keeps the rest", () => {
    expect(
      withoutReferrer({
        Referer: "http://localhost:5173/",
        origin: "http://localhost:5173",
        "User-Agent": "ua",
        Accept: "text/html",
      }),
    ).toEqual({ "User-Agent": "ua", Accept: "text/html" });
  });
});

describe("blockDiagnostics", () => {
  it("keeps only the headers that explain a block", () => {
    expect(
      blockDiagnostics({
        Server: ["cloudflare"],
        "CF-Ray": ["a495307a4aa0b86b-ZRH"],
        "Set-Cookie": ["x=1"],
      }),
    ).toEqual({ server: "cloudflare", "cf-ray": "a495307a4aa0b86b-ZRH" });
  });
});
