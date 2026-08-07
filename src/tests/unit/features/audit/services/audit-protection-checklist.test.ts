// src/tests/unit/features/audit/services/audit-protection-checklist.test.ts
import { describe, it, expect } from "vitest";
import { buildProtectionChecklist } from "features/audit/services/audit-protection-checklist";
import { parseRemote } from "features/audit/services/audit-git-host";
import type { ProtectionCheckResult } from "features/audit/services/audit-protection-check";

const ANCHOR = "9456a26670931b4538b8c9c5e867fa899f0f35c1";

const okResult: ProtectionCheckResult = {
  allSigned: { ok: true, unsigned: [] },
  linearHistory: { ok: true, merges: [] },
  anchorTag: "ok",
  localOk: true,
};

const build = (remoteUrl: string, result: ProtectionCheckResult) =>
  buildProtectionChecklist({
    remote: parseRemote(remoteUrl),
    result,
    branch: "audit",
    anchor: ANCHOR,
  });

describe("buildProtectionChecklist", () => {
  it("renders GitHub-specific guidance + a deep-link to branch settings", () => {
    const md = build("git@github.com:acme/widget.git", okResult);
    expect(md).toContain("Require signed commits");
    expect(md).toContain("Require linear history");
    expect(md).toContain("https://github.com/acme/widget/settings/branches");
    expect(md).toContain("audit-root");
  });

  it("uses GitLab wording + push-rule for unsigned commits", () => {
    const md = build("git@gitlab.com:group/widget.git", okResult);
    expect(md).toContain("Reject unsigned commits");
    expect(md).toContain("Protected branches");
    expect(md).toContain("/-/settings/repository");
  });

  it("falls back to host-neutral guidance for unknown hosts", () => {
    const md = build("git@git.corp.internal:team/widget.git", okResult);
    expect(md).toContain("signed commits");
    expect(md).toContain("linear");
    // no deep-link line when the host is unknown
    expect(md).not.toContain("Settings: http");
  });

  it("always carries the out-of-band anchor hash (Phase 4 pins it)", () => {
    const md = build("git@github.com:acme/widget.git", okResult);
    expect(md).toContain("Out-of-band anchor");
    expect(md).toContain(ANCHOR);
  });

  it("lists the offending commits when local checks fail", () => {
    const md = build("git@github.com:acme/widget.git", {
      allSigned: { ok: false, unsigned: ["bad1", "bad2"] },
      linearHistory: { ok: false, merges: ["merge1"] },
      anchorTag: "missing",
      localOk: false,
    });
    expect(md).toContain("⚠️");
    expect(md).toContain("bad1");
    expect(md).toContain("bad2");
    expect(md).toContain("merge1");
    // missing tag → the fix command carries the anchor
    expect(md).toContain(`git tag -s audit-root ${ANCHOR}`);
  });

  it("marks all-good checks with the success glyph", () => {
    const md = build("git@github.com:acme/widget.git", okResult);
    expect(md).toContain("✅ **All commits signed");
    expect(md).toContain("✅ **Linear history");
  });
});
