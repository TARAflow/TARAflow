// ==================== AUDIT GIT ADAPTERS (renderer) ====================
// Binds the injected GitRunner used by audit-repo-locator and
// audit-repo-attributes to the ONE main-process GitService, via IPC.
//
// "ONE GIT PATH": these read-only checks (rev-parse, check-attr) run in an
// arbitrary directory that they name themselves, so they go through a dedicated
// main handler `git:rawInDir(dir, args)` — NOT a second `execFile("git")` in the
// renderer, and NOT a bound-repo call. All git execution stays in main.
//
// The bound GitService (commit/branch/push/status on the *current* repo) is a
// separate concern, selected via `git:setRepoPath`.

import type { GitRunner } from "./audit-repo-locator";
import type { FileIO } from "./audit-repo-attributes";

/**
 * A GitRunner backed by `window.git.rawInDir`. Structurally compatible with the
 * GitRunner interface of both audit-repo-locator and audit-repo-attributes, so
 * the same adapter drives repo discovery AND the .gitattributes check.
 *
 * Never throws: transport/availability problems surface as a non-zero `code`,
 * matching how the pure modules interpret git failures.
 */
export function createIpcGitRunner(): GitRunner {
  return async (args, cwd) => {
    if (!window.git?.rawInDir) {
      return { stdout: "", stderr: "Git API not available", code: 127 };
    }
    const res = await window.git.rawInDir(cwd, args);
    if (res.success && res.data) {
      return res.data;
    }
    return { stdout: "", stderr: res.error ?? "ipc error", code: 1 };
  };
}

/**
 * A FileIO backed by `window.electron.file.readText`/`writeText`. Used by the
 * .gitattributes guard (audit-repo-attributes). A MISSING file surfaces as
 * `null` (main returns { success:true, data:null } on ENOENT), matching the
 * `FileIO.read: Promise<string | null>` contract so the guard knows to create
 * the file. A real read/write failure throws.
 */
export function createIpcFileIO(): FileIO {
  return {
    async read(path) {
      const api = window.electron?.file;
      if (!api?.readText) throw new Error("File API not available");
      const res = await api.readText(path);
      if (!res.success) throw new Error(res.error ?? "read failed");
      return res.data ?? null;
    },
    async write(path, content) {
      const api = window.electron?.file;
      if (!api?.writeText) throw new Error("File API not available");
      const res = await api.writeText(path, content);
      if (!res.success) throw new Error(res.error ?? "write failed");
    },
  };
}
