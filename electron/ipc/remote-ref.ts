// ==================== RESOLVE A REMOTE REF ====================
// The implementation of `git:resolveRemoteRef` (git-handlers.ts), without
// Electron so it can be tested: `git ls-remote <url> <ref>` for the Overview's
// source references ("Resolve").
//
// Manual test 2026-11-17: whether a source repository exists at all was only
// "Could not reach <host>" — for a typo in the path, a private repository
// without access and no network alike — and git could wait on a credentials
// prompt nobody sees. Now:
//   - no terminal prompt (GIT_TERMINAL_PROMPT=0; ssh in BatchMode since
//     0.20.1) and a time limit;
//   - the failure classified: not_found / no_access / offline / timeout /
//     unknown — a private repository on GitHub answers like a missing one
//     without credentials, so "not found" says "or no access";
//   - git's message without credentials of the URL (it may echo the URL).

import { simpleGit } from "simple-git";
import { userGitEnvironment, withSshBatchMode } from "../services/git-environment";
import { withoutUrlCredentials } from "../../src/shared/utils/url-credentials";

export type RemoteFailure = "not_found" | "no_access" | "offline" | "timeout" | "unknown";

/**
 * What to do about a refused SSH access (0.20.1 — ssh runs in BatchMode and
 * no longer asks): `host_key` — the host's key was never confirmed (once, in
 * a terminal); `ssh_key` — no key was accepted (a key with a passphrase has to
 * be in the ssh-agent; TARAflow asks for none).
 */
export type RemoteHint = "host_key" | "ssh_key";

export interface RemoteRefResult {
  success: boolean;
  data: { reachable: boolean; sha: string | null; failure?: RemoteFailure; hint?: RemoteHint };
  error?: string;
}

/** The hint for git's message, if it is an SSH refusal. */
export function remoteHint(message: string): RemoteHint | undefined {
  const m = message.toLowerCase();
  if (/host key verification failed|no .*host key is known|host key for .* has changed/.test(m)) return "host_key";
  if (/permission denied \(publickey/.test(m)) return "ssh_key";
  return undefined;
}

/** What git's message says went wrong (the first rule that matches). */
export function classifyRemoteError(message: string): RemoteFailure {
  const m = message.toLowerCase();
  if (/block timeout|timed? ?out/.test(m) && !/connection timed out/.test(m)) return "timeout";
  if (
    /authentication failed|permission denied|could not read username|could not read password|terminal prompts disabled|access denied|returned error: 40[13]|host key verification failed/.test(
      m,
    )
  )
    return "no_access";
  if (/repository not found|not found|does not appear to be a git repository|returned error: 404/.test(m)) return "not_found";
  if (/could not resolve host|could not resolve hostname|network is unreachable|connection refused|connection timed out|failed to connect|no route to host|unable to access/.test(m))
    return "offline";
  return "unknown";
}

/** Every URL in a message without its credentials. */
function scrub(message: string): string {
  return message.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, (url) => withoutUrlCredentials(url));
}

export async function resolveRemoteRef(repoUrl: string, refLabel: string, timeoutMs = 20_000): Promise<RemoteRefResult> {
  try {
    // The user's git environment — the fixed list of git-environment.ts
    // (decided 0.20; until then every variable was allowed) plus
    // GIT_TERMINAL_PROMPT=0 (no prompt nobody sees). The argument checks
    // stay: a URL like "--upload-pack=…" is refused.
    // ssh never asks either (BatchMode, 0.20.1 — git-environment.ts)
    const user = await withSshBatchMode(userGitEnvironment());
    const output = await simpleGit({ timeout: { block: timeoutMs }, ...user.options })
      .env(user.env)
      .listRemote([repoUrl, refLabel]);
    const line = output
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (!line) return { success: true, data: { reachable: true, sha: null } };
    return { success: true, data: { reachable: true, sha: line.split("\t")[0] } };
  } catch (err: unknown) {
    const message = scrub(String((err as { message?: string })?.message ?? err));
    const hint = remoteHint(message);
    return { success: false, data: { reachable: false, sha: null, failure: classifyRemoteError(message), ...(hint ? { hint } : {}) }, error: message };
  }
}
