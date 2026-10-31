// The commit lookup shared by the Audit tab and the Audit hint of the phase
// bar (user 2026-10-30): entry id → first commit that contains it.
import { describe, it, expect } from "vitest";
import { findVerificationCommits } from "features/audit/services/verification-commits";

describe("findVerificationCommits", () => {
  it("pickaxe per entry id on the project file; entries without a commit are absent", async () => {
    const calls: string[][] = [];
    const raw = async (command: string[]) => {
      calls.push(command);
      return command.includes("-Sv1") ? { success: true, data: "abc1234\ndef5678\n" } : { success: true, data: "" };
    };
    const found = await findVerificationCommits(raw, "/repo", "/repo/projects/smoke.tara.json", ["v1", "v2"]);
    expect([...found]).toEqual([["v1", "abc1234"]]);
    expect(calls[0]).toEqual(["log", "--format=%h", "--reverse", "-Sv1", "--", "projects/smoke.tara.json"]);
  });
});
