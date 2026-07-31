// ==================== generateCommitMessage — TESTS ====================
// If you use Jest with globals, delete the next import line.
import { describe, it, expect } from "vitest";
import {
  generateCommitMessage,
  type CommitMessageData,
} from "features/audit/models/audit-types";

function baseData(over: Partial<CommitMessageData> = {}): CommitMessageData {
  return {
    round: "Detail Review",
    batchSize: 3,
    affectedPhases: ["Assets", "Threats"],
    changes: [
      {
        phase: "assets",
        phaseLabel: "Assets",
        changeCount: 2,
        changes: [
          { type: "added", id: "A-1", name: "Battery ctrl", description: "" },
          { type: "modified", id: "A-2", name: "HMI", description: "" },
        ],
      },
      {
        phase: "threats",
        phaseLabel: "Threats",
        changeCount: 1,
        changes: [
          { type: "deleted", id: "T-9", name: "Old spoof", description: "" },
        ],
      },
    ],
    author: "Juergen",
    ...over,
  };
}

// Mirror of the commit-msg hook's required-trailer check.
function hasTrailer(msg: string, key: string): boolean {
  return new RegExp(`^\\s*-?\\s*${key}:\\s*.+`, "m").test(msg);
}

describe("generateCommitMessage", () => {
  it("emits a [TARA] <round> subject line", () => {
    const msg = generateCommitMessage(baseData());
    expect(msg.split("\n")[0]).toBe("[TARA] Detail Review");
  });

  it("satisfies the commit-msg hook's required hyphenated trailers", () => {
    const msg = generateCommitMessage(baseData());
    expect(hasTrailer(msg, "Affected-Phases")).toBe(true);
    expect(hasTrailer(msg, "Batch-Size")).toBe(true);
    expect(hasTrailer(msg, "Author")).toBe(true);
  });

  it("no longer emits the spaced legacy keys the hook would reject", () => {
    const msg = generateCommitMessage(baseData());
    expect(/^\s*-?\s*Affected Phases:/m.test(msg)).toBe(false);
    expect(/^\s*-?\s*Batch Size:/m.test(msg)).toBe(false);
  });

  it("includes a Project trailer with id when a project is given", () => {
    const msg = generateCommitMessage(
      baseData({ projectName: "Statron CRA", projectId: "proj_1730" }),
    );
    expect(/^Project: Statron CRA \[proj_1730\]$/m.test(msg)).toBe(true);
  });

  it("omits the id bracket when only a name is given", () => {
    const msg = generateCommitMessage(baseData({ projectName: "Statron CRA" }));
    expect(/^Project: Statron CRA$/m.test(msg)).toBe(true);
  });

  it("omits the Project trailer entirely when no project is given", () => {
    const msg = generateCommitMessage(baseData());
    expect(/^Project:/m.test(msg)).toBe(false);
  });

  it("uses Reviewed-by (not the legacy Reviewer:) and only when present", () => {
    const without = generateCommitMessage(baseData());
    expect(/^Reviewed-by:/m.test(without)).toBe(false);
    expect(/^Reviewer:/m.test(without)).toBe(false);

    const withRev = generateCommitMessage(baseData({ reviewer: "Reviewer R" }));
    expect(/^Reviewed-by: Reviewer R$/m.test(withRev)).toBe(true);
    expect(/^Reviewer:/m.test(withRev)).toBe(false);
  });

  it("keeps the trailer block contiguous as the final paragraph", () => {
    const msg = generateCommitMessage(
      baseData({ projectName: "P", reviewer: "R" }),
    );
    const lines = msg.split("\n");
    const start = lines.findIndex((l) => /^Project:/.test(l));
    // every line from the first trailer to the end is a `Key: value` trailer
    for (const l of lines.slice(start)) {
      expect(/^[A-Za-z-]+: .+/.test(l)).toBe(true);
    }
  });

  it("renders the change breakdown in the body", () => {
    const msg = generateCommitMessage(baseData());
    expect(msg).toContain("- Changes:");
    expect(msg).toContain("+ A-1: Battery ctrl");
    expect(msg).toContain("~ A-2: HMI");
    expect(msg).toContain("- T-9: Old spoof");
  });
});
