// ============ AUDIT VERIFICATION — COMMIT MESSAGE HELPERS (pure) ============
// Parse exactly what the commit-flow WRITES (audit-types.generateCommitMessage):
// a `[TARA] <round>` subject, a human body, and a trailing block of
// `Key: value` git trailers. Infra commits use an `audit:` subject and are
// exempt from the round schema. Pure — no git, no I/O.

export interface ParsedMessage {
  subject: string;
  /** Trailer key -> values (a key may repeat, e.g. multiple Reviewed-by). */
  trailers: Record<string, string[]>;
}

const TRAILER_RE = /^([A-Za-z][A-Za-z0-9-]*):[ \t]+(.*)$/;

/**
 * Parse a commit message. Trailers are taken from the LAST contiguous block of
 * trailer-shaped lines at the end of the message (git-trailer semantics), so a
 * body line that happens to contain a colon is not mistaken for a trailer.
 */
export function parseCommitMessage(message: string): ParsedMessage {
  const lines = message.split(/\r?\n/);
  const subject = lines[0] ?? "";

  // Collect the trailing trailer block (scan up from the end).
  const block: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === "") {
      if (block.length) break; // reached the blank line above the trailer block
      continue; // skip trailing blank lines
    }
    if (TRAILER_RE.test(line)) block.unshift(line);
    else break; // a non-trailer line ends the block
  }

  const trailers: Record<string, string[]> = {};
  for (const line of block) {
    const m = TRAILER_RE.exec(line);
    if (m) (trailers[m[1]] ??= []).push(m[2].trim());
  }

  return { subject, trailers };
}

/** Is this an `audit:` infra commit (exempt from the round schema)? */
export function isAuditSubject(subject: string): boolean {
  return /^audit:\s/.test(subject);
}

/** The `<round>` from a `[TARA] <round>` subject, or null if not that shape. */
export function taraRound(subject: string): string | null {
  const m = /^\[TARA\]\s+(.+?)\s*$/.exec(subject);
  return m ? m[1] : null;
}
