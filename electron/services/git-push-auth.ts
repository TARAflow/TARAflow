// ==================== CREDENTIALS OF A PUSH, PER CALL ====================
// Roadmap-to-1.0 0.20 (review 2026-11-20, user decision: bind the field).
//
// SSH key field (audit settings, auth.sshKeyPath): it was shown, stored and
// remembered per project, but no git call read it — push used the default
// key. Now a push with auth method "ssh" and a key path runs with
//   -c core.sshCommand="ssh -i '<path>' -o IdentitiesOnly=yes -o BatchMode=yes"
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
import type { SshKeyStatus } from "./ssh-key-inspect";

export interface PushAuthInput {
  method?: "pat" | "ssh";
  /** The token of a "pat" setup (from the credential store). */
  token?: string | null;
  sshKeyPath?: string;
  /**
   * What the key path names (ssh-key-inspect.ts), when it was checked. Not
   * "ok": the key is not applied (0.20.1 — a .pub given as the key made ssh
   * fall back to a password prompt).
   */
  sshKeyStatus?: SshKeyStatus;
  /** The push URL of the remote. */
  remoteUrl?: string;
  /** The environment the push inherits (GIT_SSH_COMMAND / GIT_SSH win over the field). */
  env: NodeJS.ProcessEnv;
}

export interface PushAuth {
  /** `-c key=value` entries for this one push (simple-git `config`). */
  config: string[];
  /**
   * Why the SSH key field is not applied, if it is set but not used.
   * "environment": the user's GIT_SSH_COMMAND / GIT_SSH decide (fine); every
   * other reason is an unusable key — the push does not run with another key
   * instead (sshKeyProblem).
   */
  sshKeySkipped?: "environment" | "invalid" | Exclude<SshKeyStatus, "ok">;
}

/**
 * The message of a push refused for an unusable key (0.20.1: before, an
 * invalid path was skipped silently and the push ran with the default key).
 */
export function sshKeyProblem(reason: Exclude<PushAuth["sshKeySkipped"], "environment" | undefined>, keyPath: string): string {
  switch (reason) {
    case "missing":
      return `SSH key ${keyPath} not found — check the SSH key path in the audit settings.`;
    case "public_key":
      return `SSH key ${keyPath} is a public key (.pub) — the audit settings need the private key (the same path without .pub).`;
    case "not_a_private_key":
      return `SSH key ${keyPath} is no private key — check the SSH key path in the audit settings.`;
    case "permissions_too_open":
      return `SSH key ${keyPath} can be read by other users — ssh refuses it; make it readable by you only (chmod 600).`;
    default:
      return `SSH key path ${JSON.stringify(keyPath)} is not usable — check the audit settings.`;
  }
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
    else if (input.sshKeyStatus && input.sshKeyStatus !== "ok") sshKeySkipped = input.sshKeyStatus;
    // BatchMode (0.20.1): fail instead of asking for a password or passphrase
    // in a terminal nobody sees (git-environment.ts)
    else config.push(`core.sshCommand=ssh -i ${shellQuote(key)} -o IdentitiesOnly=yes -o BatchMode=yes`);
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
