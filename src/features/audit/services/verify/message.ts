// ============ AUDIT VERIFICATION — COMMIT MESSAGE HELPERS (pure) ============
// Parse exactly what the commit-flow WRITES (audit-types.generateCommitMessage):
// a `[TARA] <round>` subject, a human body, and a trailing block of
// `Key: value` git trailers. Infra commits use an `audit:` subject and are
// exempt from the round schema. Pure — no git, no I/O.

export interface ParsedMessage {
  subject: string;
  trailers: Record<string, string[]>;
}

const TRAILER_RE = /^([A-Za-z][A-Za-z0-9-]*):[ \t]+(.*)$/;

export function parseCommitMessage(message: string): ParsedMessage {
  const lines = message.split(/\r?\n/);
  const subject = lines[0] ?? "";
  const block: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === "") {
      if (block.length) break;
      continue;
    }
    if (TRAILER_RE.test(line)) block.unshift(line);
    else break;
  }
  const trailers: Record<string, string[]> = {};
  for (const line of block) {
    const m = TRAILER_RE.exec(line);
    if (m) (trailers[m[1]] ??= []).push(m[2].trim());
  }
  return { subject, trailers };
}

export function isAuditSubject(subject: string): boolean {
  return /^audit:\s/.test(subject);
}

export function taraRound(subject: string): string | null {
  const m = /^\[TARA\]\s+(.+?)\s*$/.exec(subject);
  return m ? m[1] : null;
}

// ── Shared audit-message schema predicate (used by the check AND the hook) ────

/** Trailers the commit-flow always emits for a [TARA] round. */
export const REQUIRED_TARA_TRAILERS = [
  "Affected-Phases",
  "Batch-Size",
  "Author",
  "Date",
] as const;

export type AuditMessageProblem =
  | { kind: "bad-subject"; subject: string }
  | { kind: "missing-trailers"; missing: string[] };

/**
 * Validate ONE commit message against the audit schema. Returns [] when the
 * message is acceptable (an `audit:` infra commit, or a `[TARA] <round>` with
 * all required trailers). Pure — the engine check maps problems to Findings
 * (with a commit hash); the commit-msg hook maps them to stderr + exit code.
 * ONE definition of "valid audit message" for both.
 */
export function validateAuditMessage(message: string): AuditMessageProblem[] {
  const { subject, trailers } = parseCommitMessage(message);
  if (isAuditSubject(subject)) return [];
  if (taraRound(subject) === null) return [{ kind: "bad-subject", subject }];
  const missing = REQUIRED_TARA_TRAILERS.filter((k) => !(k in trailers));
  return missing.length ? [{ kind: "missing-trailers", missing: [...missing] }] : [];
}
