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

import type { SimpleGitOptions } from "simple-git";

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
