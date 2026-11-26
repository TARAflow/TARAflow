// ==================== CREDENTIALS OF A PUSH, PER CALL ====================
// Roadmap-to-1.0 0.20 (review 2026-11-20, user decision: bind the field).
//
// SSH key field (audit settings, auth.sshKeyPath): it was shown, stored and
// remembered per project, but no git call read it — push used the default
// key. Now a push with auth method "ssh" and a key path runs with
//   -c core.sshCommand="ssh -i '<path>' -o IdentitiesOnly=yes"
// for that one call. The user's environment wins: with GIT_SSH_COMMAND or
// GIT_SSH set (git-environment.ts passes them), the field is not applied —
// git would prefer GIT_SSH_COMMAND anyway, and GIT_SSH must not be silently
// overridden.
//
// Personal access token (found with patch 07): push wrote the token into the
// remote URL (`remote set-url origin https://<token>@…`) and never restored
// it — the token stayed in .git/config. Now it goes into one call only, as
//   -c http.extraHeader="Authorization: Basic base64(<token>:)"
// — the same credentials the URL carried (user = token, no password), never
// stored. A remote URL that still carries credentials from an earlier push is
// cleaned before the push (storedUrlRepair).
//
// Pure: no Electron, no keytar, no git — tested in git-push-auth.test.ts.

import { hasUrlCredentials, withoutUrlCredentials } from "../../src/shared/utils/url-credentials";

export interface PushAuthInput {
  method?: "pat" | "ssh";
  /** The token of a "pat" setup (from the credential store). */
  token?: string | null;
  sshKeyPath?: string;
  /** The push URL of the remote. */
  remoteUrl?: string;
  /** The environment the push inherits (GIT_SSH_COMMAND / GIT_SSH win over the field). */
  env: NodeJS.ProcessEnv;
}

export interface PushAuth {
  /** `-c key=value` entries for this one push (simple-git `config`). */
  config: string[];
  /** Why the SSH key field is not applied, if it is set but not used. */
  sshKeySkipped?: "environment" | "invalid";
}

/** A path as one word for the shell git runs core.sshCommand with. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const isHttp = (url: string | undefined) => !!url && /^https?:\/\//i.test(url.trim());

export function pushAuthConfig(input: PushAuthInput): PushAuth {
  const config: string[] = [];
  let sshKeySkipped: PushAuth["sshKeySkipped"];

  if (input.method === "pat" && input.token && isHttp(input.remoteUrl)) {
    const basic = Buffer.from(`${input.token}:`, "utf8").toString("base64");
    config.push(`http.extraHeader=Authorization: Basic ${basic}`);
  }

  const key = input.sshKeyPath?.trim();
  if (input.method === "ssh" && key) {
    if (input.env.GIT_SSH_COMMAND || input.env.GIT_SSH) sshKeySkipped = "environment";
    else if (/[\0\r\n]/.test(key)) sshKeySkipped = "invalid";
    else config.push(`core.sshCommand=ssh -i ${shellQuote(key)} -o IdentitiesOnly=yes`);
  }

  return { config, ...(sshKeySkipped ? { sshKeySkipped } : {}) };
}

/**
 * The remote URL without the credentials an earlier push stored in it, or
 * null when it carries none (nothing to repair).
 */
export function storedUrlRepair(url: string | undefined): string | null {
  if (!url || !hasUrlCredentials(url)) return null;
  return withoutUrlCredentials(url);
}
