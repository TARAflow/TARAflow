import { describe, it, expect } from "vitest";
import {
  validateAuditMessage,
  REQUIRED_TARA_TRAILERS,
} from "audit/services/verify/message";
import { checkMessageSchema } from "audit/services/verify/checks/message-schema";

const good = [
  "[TARA] Detail Review", "", "- Changes:", "",
  "Affected-Phases: Risk", "Batch-Size: 3", "Author: X", "Date: 2026-01-01T00:00:00Z",
].join("\n");

describe("validateAuditMessage (shared predicate)", () => {
  it("accepts a well-formed [TARA] round", () => {
    expect(validateAuditMessage(good)).toEqual([]);
  });
  it("accepts an audit: infra commit (exempt)", () => {
    expect(validateAuditMessage("audit: configure repository")).toEqual([]);
  });
  it("flags a non-schema subject", () => {
    expect(validateAuditMessage("random commit")).toEqual([{ kind: "bad-subject", subject: "random commit" }]);
  });
  it("flags missing trailers", () => {
    const msg = ["[TARA] Initial", "", "body", "", "Author: X"].join("\n");
    const p = validateAuditMessage(msg);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kind: "missing-trailers" });
    expect((p[0] as any).missing).toEqual(["Affected-Phases", "Batch-Size", "Date"]);
  });
  it("REQUIRED_TARA_TRAILERS is the 4-key set", () => {
    expect([...REQUIRED_TARA_TRAILERS]).toEqual(["Affected-Phases","Batch-Size","Author","Date"]);
  });
});

describe("checkMessageSchema uses the shared predicate", () => {
  it("maps problems to per-commit findings", async () => {
    const findings = await checkMessageSchema({
      history: [
        { hash: "aaa", message: good },                 // ok → no finding
        { hash: "bbb", message: "nope" },               // bad-subject
        { hash: "ccc", message: "[TARA] X\n\nb\n\nAuthor: Y" }, // missing trailers
      ],
    } as any);
    expect(findings.map((f: any) => f.commit)).toEqual(["bbb", "ccc"]);
    expect(findings.every((f: any) => f.id === "MSG_SCHEMA")).toBe(true);
  });
});
