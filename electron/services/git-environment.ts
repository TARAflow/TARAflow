// ==================== THE USER'S GIT ENVIRONMENT ====================
// Roadmap-to-1.0 0.20 (review 2026-11-20): simple-git 4 removes every GIT_*
// variable (and EDITOR, PAGER, …) from the environment of a git call unless
// it is named in `allowEnvironment` — GIT_SSH_COMMAND, GIT_SSL_CAINFO,
// GIT_ASKPASS, GIT_CONFIG_* did not reach commit, push or the drift check's
// fetch, only Resolve passed them (all of them).
//
// Decided with the rawInDir hardening: the main process's git calls with
// FIXED arguments — GitService (commit, push …), Resolve (ls-remote), the
// component fetch (git:fetchTags) — get this fixed list of the user's
// variables, the ones a git setup on a company or developer machine needs:
// SSH command and askpass, CA certificates, config files and git
// configuration through the environment (url.<base>.insteadOf …). Nothing
// else (no editor, pager, exec path, template dir, proxy command). The
// read-only channels whose arguments come from the renderer (git:rawInDir,
// git:raw) get none of them.
//
// Variables outside simple-git's guard (HOME, PATH, SSH_AUTH_SOCK,
// HTTPS_PROXY …) are inherited as before. GIT_TERMINAL_PROMPT=0: nobody sees
// a prompt of a git child of the app — fail instead of waiting.
//
// ssh BatchMode (0.20.1, user 2026-11-27): GIT_TERMINAL_PROMPT stops git's own
// prompts only — ssh reads its password, passphrase and host-key questions
// from the controlling terminal. Started from a terminal, a Resolve to a host
// without a usable key asked there for a password and the app waited until
// its timeout. The calls that reach a remote (push, Resolve, the component
// fetch) therefore run ssh with -o BatchMode=yes: it fails at once
// ("Permission denied (publickey)") instead of asking. Only where nothing else
// says how to run ssh — GIT_SSH_COMMAND, GIT_SSH and core.sshCommand (git
// configuration, also through GIT_CONFIG_*) are the user's and stay as they
// are; GIT_SSH_COMMAND would override core.sshCommand, so it is only set when
// git has none (withSshBatchMode looks it up).

import os from "node:os";
import { simpleGit, type SimpleGitOptions } from "simple-git";

/** The user's git variables the fixed-argument calls inherit. */
export const GIT_ENVIRONMENT_ALLOWLIST: readonly string[] = [
  "GIT_SSH_COMMAND",
  "GIT_SSH",
  "GIT_SSH_VARIANT",
  "GIT_ASKPASS",
  "SSH_ASKPASS",
  "GIT_SSL_CAINFO",
  "GIT_SSL_CAPATH",
  "GIT_SSL_CERT",
  "GIT_SSL_KEY",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_CONFIG_NOSYSTEM",
  "GIT_CONFIG_COUNT",
];

/** GIT_CONFIG_KEY_<n> / GIT_CONFIG_VALUE_<n> go with GIT_CONFIG_COUNT. */
const CONFIG_PAIR = /^GIT_CONFIG_(KEY|VALUE)_\d+$/;

/** Guarded by simple-git without a GIT_ prefix (argv-parser's list). */
const GUARDED_PLAIN = new Set(["editor", "pager", "prefix", "visual", "ssh_askpass"]);

const allowed = (key: string) => GIT_ENVIRONMENT_ALLOWLIST.includes(key) || CONFIG_PAIR.test(key);
const guarded = (key: string) => key.toUpperCase().startsWith("GIT_") || GUARDED_PLAIN.has(key.toLowerCase());

/** simple-git's checks for the variables of the list (the user's own setup). */
const UNSAFE_FOR_LIST: NonNullable<SimpleGitOptions["unsafe"]> = {
  allowUnsafeSshCommand: true,
  allowUnsafeAskPass: true,
  allowUnsafeConfigPaths: true,
  allowUnsafeConfigEnvCount: true,
  // git configuration through the environment, e.g. url.<base>.insteadOf
  allowUnsafeUrlRewrite: true,
};

export interface UserGitEnvironment {
  env: Record<string, string>;
  options: Pick<SimpleGitOptions, "allowEnvironment" | "unsafe">;
}

/**
 * The environment of a fixed-argument git call: everything outside the guard,
 * the allowlisted git variables, GIT_TERMINAL_PROMPT=0 — and the simple-git
 * options that let exactly these through. Use as
 * `simpleGit({ ...base, ...e.options }).env(e.env)`.
 */
export function userGitEnvironment(source: NodeJS.ProcessEnv = process.env): UserGitEnvironment {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (guarded(key) && !allowed(key)) continue;
    env[key] = value;
  }
  env.GIT_TERMINAL_PROMPT = "0";
  return {
    env,
    options: {
      allowEnvironment: Object.keys(env).filter(guarded),
      unsafe: UNSAFE_FOR_LIST,
    },
  };
}

/** The ssh command of a call without an ssh setup of the user's own. */
export const SSH_BATCH_COMMAND = "ssh -o BatchMode=yes";

/**
 * The environment with GIT_SSH_COMMAND = SSH_BATCH_COMMAND — unless the user
 * runs ssh their own way: GIT_SSH_COMMAND or GIT_SSH in the environment, or
 * `configuredSshCommand` (core.sshCommand of the git configuration). Pure.
 */
export function withSshBatchModeIf(user: UserGitEnvironment, configuredSshCommand: string | null): UserGitEnvironment {
  if (user.env.GIT_SSH_COMMAND || user.env.GIT_SSH || configuredSshCommand) return user;
  const env = { ...user.env, GIT_SSH_COMMAND: SSH_BATCH_COMMAND };
  const allow = new Set([...(user.options.allowEnvironment ?? []), "GIT_SSH_COMMAND"]);
  return { env, options: { ...user.options, allowEnvironment: [...allow] } };
}

/**
 * withSshBatchModeIf with core.sshCommand looked up the way the call will see
 * it: `git config --get core.sshCommand` with the same environment, in `dir`
 * (a repository's own configuration counts) or the home directory. When the
 * lookup itself fails, the environment stays as it is.
 */
export async function withSshBatchMode(user: UserGitEnvironment, dir?: string): Promise<UserGitEnvironment> {
  if (user.env.GIT_SSH_COMMAND || user.env.GIT_SSH) return user;
  let configured: string;
  try {
    // not set: git exits 1 without output — simple-git resolves with ""
    configured = (await simpleGit(dir ?? os.homedir(), user.options).env(user.env).raw(["config", "--get", "core.sshCommand"])).trim();
  } catch {
    return user;
  }
  return withSshBatchModeIf(user, configured || null);
}
