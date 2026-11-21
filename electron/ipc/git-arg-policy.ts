// ==================== GIT ARGUMENT POLICY ====================
// Roadmap-to-1.0 0.20 (review 2026-11-20): `git:rawInDir` and `git:raw` ran
// any git arguments the renderer sent. Since the component import the
// renderer shows content from other people's files — an XSS there would have
// become code execution through `-c core.hooksPath=…`, `--upload-pack=…`,
// `config core.sshCommand …` and the like. Both channels now take READ-ONLY
// git calls only; what changes a repository has its own IPC channel without
// free arguments (git-fixed-ops.ts).
//
// The rules, checked in the main process before git runs:
//   - the first argument is a read-only subcommand of the allowlist — so a
//     global option before it (-c, --config-env, -C, --git-dir, --exec-path,
//     --work-tree …) is refused;
//   - options that run a program or write a file are refused anywhere
//     (--upload-pack, --receive-pack, --exec, --output, --ext-diff,
//     --textconv, --filters, -c, --config-env, --exec-path, --git-dir,
//     --work-tree);
//   - subcommands that can also write are narrowed to their reading form:
//     `config [--get] <key>`, `remote get-url <name>`, `tag` only listing
//     (--list / -l / --points-at), `symbolic-ref` with at most one name.
// simple-git's own checks stay on top (no allowUnsafe* for these channels).
//
// Pure: no Electron, no git — tested in electron/tests/git-arg-policy.test.ts.

/** Subcommands the renderer may run through git:rawInDir / git:raw (all reading). */
export const READ_ONLY_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "rev-parse",
  "merge-base",
  "cat-file",
  "show",
  "ls-files",
  "status",
  "log",
  "rev-list",
  "symbolic-ref",
  "check-attr",
  "check-ignore",
  "tag",
  "config",
  "remote",
]);

/** Options that run a program, read another config or write a file. */
const FORBIDDEN_OPTIONS = [
  "-c",
  "--config-env",
  "--exec-path",
  "--git-dir",
  "--work-tree",
  "--upload-pack",
  "--receive-pack",
  "--exec",
  "--output",
  "--ext-diff",
  "--textconv",
  "--filters",
];

/**
 * Real git options that are a prefix of a forbidden one — they mean
 * themselves, not the forbidden option (git takes an exact name first).
 */
const EXACT_OPTIONS_THAT_ARE_PREFIXES = new Set(["--text"]);

/**
 * git's option parser accepts an unambiguous abbreviation of a long option:
 * `git cat-file --filt` acts as `--filters`, and so do `--fi`; `--te` acts as
 * `--textconv` (review 2026-11-21, git 2.39 / 2.43). Whether an abbreviation
 * is ambiguous depends on the command's other options, so there is no safe
 * minimum length: a `--` argument whose name (before "=") is a prefix of a
 * forbidden long option is refused, unless it is a real option itself.
 */
function abbreviatesForbidden(arg: string): boolean {
  if (!arg.startsWith("--")) return false;
  const name = arg.split("=", 1)[0];
  if (name.length < 3 || EXACT_OPTIONS_THAT_ARE_PREFIXES.has(name)) return false;
  return FORBIDDEN_OPTIONS.some((o) => o.startsWith("--") && o !== name && o.startsWith(name));
}

const isForbidden = (arg: string) =>
  FORBIDDEN_OPTIONS.some((o) => arg === o || arg.startsWith(`${o}=`)) ||
  abbreviatesForbidden(arg) ||
  // -c<key>=<value> written without a space
  /^-c[a-z]/i.test(arg) && arg.includes("=");

const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9-]*(\.[^\s=]+)*\.[A-Za-z][A-Za-z0-9-]*$/;

/** Why `args` may not run through a read-only channel; null when they may. */
export function refuseGitArgs(args: unknown): string | null {
  if (!Array.isArray(args) || args.length === 0) return "no git arguments";
  if (!args.every((a) => typeof a === "string")) return "git arguments must be strings";
  const [sub, ...rest] = args as string[];
  if (!READ_ONLY_SUBCOMMANDS.has(sub)) return `git ${sub} is not a read-only subcommand of the allowlist`;
  const bad = rest.find(isForbidden);
  if (bad) return `git option ${bad.split("=")[0]} is not allowed`;

  switch (sub) {
    case "config": {
      // `config <key>` or `config --get <key>` — nothing that sets, unsets or edits
      const key = rest[0] === "--get" ? rest.slice(1) : rest;
      if (key.length !== 1 || !CONFIG_KEY.test(key[0])) return "git config may only read one key (config [--get] <key>)";
      return null;
    }
    case "remote":
      if (rest.length !== 2 || rest[0] !== "get-url" || rest[1].startsWith("-")) return "git remote may only read a URL (remote get-url <name>)";
      return null;
    case "symbolic-ref": {
      const names = rest.filter((a) => !a.startsWith("-"));
      if (names.length > 1 || rest.some((a) => a.startsWith("-") && a !== "-q" && a !== "--quiet" && a !== "--short"))
        return "git symbolic-ref may only read a ref";
      return null;
    }
    case "tag": {
      // listing only: --list / -l (patterns follow), --points-at <object>, --sort=<key>
      let listing = false;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--list" || a === "-l") listing = true;
        else if (a === "--points-at") {
          listing = true;
          i++; // its object
          if (i >= rest.length) return "git tag --points-at needs an object";
        } else if (a.startsWith("--sort=")) continue;
        else if (a.startsWith("-")) return `git tag option ${a} is not allowed (listing only)`;
        else if (!listing) return "git tag may only list tags (--list, --points-at)";
      }
      if (!listing) return "git tag may only list tags (--list, --points-at)";
      return null;
    }
    default:
      return null;
  }
}
