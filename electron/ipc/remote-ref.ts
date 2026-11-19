// ==================== RESOLVE A REMOTE REF ====================
// The implementation of `git:resolveRemoteRef` (git-handlers.ts), without
// Electron so it can be tested: `git ls-remote <url> <ref>` for the Overview's
// source references ("Resolve").
//
// Manual test 2026-11-17: whether a source repository exists at all was only
// "Could not reach <host>" — for a typo in the path, a private repository
// without access and no network alike — and git could wait on a credentials
// prompt nobody sees. Now:
//   - no terminal prompt (GIT_TERMINAL_PROMPT=0) and a time limit;
//   - the failure classified: not_found / no_access / offline / timeout /
//     unknown — a private repository on GitHub answers like a missing one
//     without credentials, so "not found" says "or no access";
//   - git's message without credentials of the URL (it may echo the URL).

import { simpleGit } from "simple-git";
import { withoutUrlCredentials } from "../../src/shared/utils/url-credentials";

export type RemoteFailure = "not_found" | "no_access" | "offline" | "timeout" | "unknown";

export interface RemoteRefResult {
  success: boolean;
  data: { reachable: boolean; sha: string | null; failure?: RemoteFailure };
  error?: string;
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

// simple-git also checks what the environment configures (an editor, an SSH
// command, an askpass helper, config paths, git configuration in GIT_CONFIG_*
// — e.g. url.<base>.insteadOf in company or CI setups). These are the
// categories the user's environment commonly sets; allowed, as git would
// inherit them. Other configuration through the environment (aliases,
// credential helpers, filters …) still fails here — a known limit until the
// environment of the main process's git calls is decided (roadmap 0.20).
const USER_ENVIRONMENT = {
  allowUnsafeAskPass: true,
  allowUnsafeConfigEnvCount: true,
  allowUnsafeConfigPaths: true,
  allowUnsafeDiffExternal: true,
  allowUnsafeEditor: true,
  allowUnsafeGitProxy: true,
  allowUnsafePager: true,
  allowUnsafeSshCommand: true,
  allowUnsafeTemplateDir: true,
  allowUnsafeUrlRewrite: true,
};

/** Every URL in a message without its credentials. */
function scrub(message: string): string {
  return message.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, (url) => withoutUrlCredentials(url));
}

export async function resolveRemoteRef(repoUrl: string, refLabel: string, timeoutMs = 20_000): Promise<RemoteRefResult> {
  try {
    // The user's own environment plus GIT_TERMINAL_PROMPT=0 (no prompt nobody
    // sees). simple-git 4 guards every GIT_* variable and a few others (EDITOR,
    // PAGER, …): one passed through .env() and not named in allowEnvironment
    // rejects the call — GIT_TERMINAL_PROMPT itself included, so Resolve
    // failed for everyone (review 2026-11-20). It is the user's environment on
    // their own computer, which git would inherit anyway: every variable of it
    // is allowed. The argument checks stay: a URL like "--upload-pack=…" is
    // refused.
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
    const output = await simpleGit({ timeout: { block: timeoutMs }, allowEnvironment: Object.keys(env), unsafe: USER_ENVIRONMENT })
      .env(env)
      .listRemote([repoUrl, refLabel]);
    const line = output
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0);
    if (!line) return { success: true, data: { reachable: true, sha: null } };
    return { success: true, data: { reachable: true, sha: line.split("\t")[0] } };
  } catch (err: unknown) {
    const message = scrub(String((err as { message?: string })?.message ?? err));
    return { success: false, data: { reachable: false, sha: null, failure: classifyRemoteError(message) }, error: message };
  }
}
