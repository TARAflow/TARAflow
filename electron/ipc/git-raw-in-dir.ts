// ==================== RAW GIT IN A DIRECTORY ====================
// The implementation of `git:rawInDir` (git-handlers.ts), without Electron so
// it can be tested. Contract (shared with git-reader-exec.ts): never throws;
// returns stdout, stderr and the REAL exit code.
//
// simple-git treats a non-zero exit WITHOUT stderr output as success — but
// that is exactly how `merge-base --is-ancestor`, `rev-parse --verify
// --quiet` or `cat-file -e` say "no". The drift check of imported components
// took a newer commit for an older one and reported "up to date" (manual
// test 2026-11-16). The errors plugin turns every non-zero exit into an
// error; the exit code and the output are kept from the result itself.

import { simpleGit, type SimpleGitOptions } from "simple-git";
import { refuseGitArgs } from "./git-arg-policy";

export interface RawGitResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * The renderer's channel (git:rawInDir): READ-ONLY git calls only
 * (git-arg-policy.ts — roadmap 0.20). A refused call is answered like a git
 * failure (code 128, the reason in stderr), never run. No user environment
 * and no allowUnsafe* option: the arguments come from the renderer.
 */
export async function rawGitInDir(dir: string, args: string[]): Promise<RawGitResult> {
  const refused = refuseGitArgs(args);
  if (refused) return { stdout: "", stderr: `refused: ${refused}`, code: 128 };
  return runGitInDir(dir, args);
}

/**
 * Runs git in `dir` with the real exit code; never throws. For the main
 * process's own calls with FIXED arguments (git-fixed-ops.ts) — they may pass
 * the user's git environment and the simple-git options it needs.
 */
export async function runGitInDir(
  dir: string,
  args: string[],
  environment?: { env: Record<string, string>; options: Partial<SimpleGitOptions> },
): Promise<RawGitResult> {
  let exit: { code: number; stdout: string; stderr: string } | undefined;
  try {
    const git = simpleGit(dir, {
      ...environment?.options,
      errors(error, result) {
        if (result.exitCode !== 0) {
          exit = {
            code: result.exitCode,
            stdout: Buffer.concat(result.stdOut).toString(),
            stderr: Buffer.concat(result.stdErr).toString(),
          };
          return error ?? new Error(exit.stderr || `git exited with code ${exit.code}`);
        }
        return error;
      },
    });
    const env = environment && Object.keys(environment.env).length > 0 ? environment.env : undefined;
    const stdout = await (env ? git.env(env) : git).raw(args);
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { git?: { stdout?: string }; message?: string; exitCode?: number };
    return {
      stdout: exit?.stdout ?? e?.git?.stdout ?? "",
      stderr: exit?.stderr || String(e?.message ?? err),
      // the real exit code; 128 when git could not even run (no repo dir, no git)
      code: exit?.code ?? (typeof e?.exitCode === "number" ? e.exitCode : 128),
    };
  }
}
