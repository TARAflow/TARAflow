// ==================== AUDIT PROTECTION CHECK ====================
// The LOCALLY verifiable half of protected-branch enforcement — no host API,
// no token. Given the raw output of three git commands over the audit line
// (anchor..HEAD), it reports what git alone can prove:
//   - every commit is signed AND authorized (%G? == "G")
//   - the history is linear (no merge commits)
//   - the audit-root tag exists and points at the expected anchor
//
// What it CANNOT prove locally (force-push blocked, server-side "require signed
// commits", who may push) is the checklist's job — see audit-protection-
// checklist.ts. This split is deliberate: warn on what's provable, guide on the
// rest, never pretend to have checked a server policy we can't see.
//
// Pure: the caller runs git and feeds the strings in, so this is unit-testable
// without a repo.

export interface ProtectionCheckInput {
  /** `git log --format="%H %G?" <anchor>..HEAD` — one "hash sig" per line. */
  signatureLog: string;
  /** `git log --merges --format=%H <anchor>..HEAD` — one merge hash per line. */
  mergeLog: string;
  /** Rev the `audit-root` tag points to, or null if the tag does not exist. */
  anchorTagTarget: string | null;
  /** The bootstrap commit (first add of .tara/allowed_signers) = the anchor. */
  expectedAnchor: string;
}

export interface ProtectionCheckResult {
  /** Commits on the audit line whose %G? != "G" (unsigned or unauthorized). */
  allSigned: { ok: boolean; unsigned: string[] };
  /** Merge commits found on the audit line (violate ff-only). */
  linearHistory: { ok: boolean; merges: string[] };
  anchorTag: "ok" | "missing" | "moved";
  /** True iff every locally-checkable signal passes. Drives the auto-warn. */
  localOk: boolean;
}

const nonEmptyLines = (s: string): string[] =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export function checkProtection(
  input: ProtectionCheckInput,
): ProtectionCheckResult {
  // Only "G" (good signature by an authorized key) passes. U/N/E/B/X/Y/R all
  // mean not-fully-verified → list the commit as unsigned/unauthorized.
  const unsigned = nonEmptyLines(input.signatureLog)
    .map((line) => {
      const sp = line.lastIndexOf(" ");
      return sp < 0
        ? { hash: line, sig: "" }
        : { hash: line.slice(0, sp), sig: line.slice(sp + 1) };
    })
    .filter((c) => c.sig !== "G")
    .map((c) => c.hash);

  const merges = nonEmptyLines(input.mergeLog);

  const anchorTag: ProtectionCheckResult["anchorTag"] =
    input.anchorTagTarget === null
      ? "missing"
      : input.anchorTagTarget === input.expectedAnchor
        ? "ok"
        : "moved";

  const allSigned = { ok: unsigned.length === 0, unsigned };
  const linearHistory = { ok: merges.length === 0, merges };
  const localOk = allSigned.ok && linearHistory.ok && anchorTag === "ok";

  return { allSigned, linearHistory, anchorTag, localOk };
}
