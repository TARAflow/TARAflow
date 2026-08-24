// electron/ipc/git-handlers.ts
// ==================== GIT SERVICE ====================

import { ipcMain } from "electron";
import simpleGit from "simple-git";
import { GitService } from "../services/git-service-main";

let gitService: GitService;

/** Exposed so audit:verify (main.ts, for now) can fall back to the bound repo. */
export function getGitService(): GitService | undefined {
  return gitService;
}

export function registerGitHandlers() {
  // Repository
  ipcMain.handle("git:isRepository", async () => {
    if (!gitService) gitService = new GitService(".");
    return await gitService.isRepository();
  });

  ipcMain.handle("git:initRepository", async () => {
    if (!gitService) gitService = new GitService(".");
    return await gitService.initRepository();
  });

  // Status
  ipcMain.handle("git:getStatus", async () => {
    return await gitService.getStatus();
  });

  ipcMain.handle("git:isClean", async () => {
    return await gitService.isClean();
  });

  // Commit
  ipcMain.handle("git:stage", (_e, relPaths) => gitService.stage(relPaths));

  ipcMain.handle("git:commit", (_e, m, cfg, sign, relPaths) =>
    gitService.commit(m, cfg, sign, relPaths),
  );

  // Branches
  ipcMain.handle("git:getBranches", async () => {
    return await gitService.getBranches();
  });

  ipcMain.handle("git:getCurrentBranch", async () => {
    return await gitService.getCurrentBranch();
  });

  ipcMain.handle("git:createBranch", async (_, name, checkout) => {
    return await gitService.createBranch(name, checkout);
  });

  ipcMain.handle("git:checkoutBranch", async (_, name) => {
    return await gitService.checkoutBranch(name);
  });

  ipcMain.handle("git:branchExists", async (_, name) => {
    return await gitService.branchExists(name);
  });

  // Remote
  ipcMain.handle("git:addRemote", async (_, name, url) => {
    return await gitService.addRemote(name, url);
  });

  ipcMain.handle("git:getRemotes", async () => {
    return await gitService.getRemotes();
  });

  ipcMain.handle("git:remoteExists", async (_, name) => {
    return await gitService.remoteExists(name);
  });

  // Push
  ipcMain.handle("git:push", async (_, remote, branch, config) => {
    return await gitService.push(remote, branch, config);
  });

  // Log
  ipcMain.handle("git:getLog", async (_, maxCount) => {
    return await gitService.getLog(maxCount);
  });

  ipcMain.handle("git:getLatestCommit", async () => {
    return await gitService.getLatestCommit();
  });

  // Diff
  ipcMain.handle("git:getDiff", async (_, filePath) => {
    return await gitService.getDiff(filePath);
  });

  // Raw
  ipcMain.handle("git:raw", async (_, command) => {
    return await gitService.raw(command);
  });

  // Raw git in an ARBITRARY directory — for repo discovery (rev-parse) and the
  // .gitattributes check (check-attr), which must run in a dir that may not be
  // the bound repo (and before any repo is selected). Uses its own
  // simpleGit(dir), but stays in the main process, so the "one git path" rule
  // (no git in the renderer) still holds. Never throws to the renderer: a
  // non-zero exit is returned as { code }.
  ipcMain.handle("git:rawInDir", async (_, dir: string, args: string[]) => {
    try {
      const stdout = await simpleGit(dir, {
        unsafe: { allowUnsafeHooksPath: true },
      }).raw(args);
      return { success: true, data: { stdout, stderr: "", code: 0 } };
    } catch (err: any) {
      // simple-git throws on non-zero exit (e.g. rev-parse outside a repo)
      return {
        success: true,
        data: {
          stdout: err?.git?.stdout ?? "",
          stderr: String(err?.message ?? err),
          code: typeof err?.exitCode === "number" ? err.exitCode : 128,
        },
      };
    }
  });

  // Rebind the bound GitService to the discovered audit repo root. Called on
  // project open (after discovery) before any stateful op (commit/branch/push).
  ipcMain.handle("git:setRepoPath", async (_, root: string) => {
    try {
      gitService = new GitService(root);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}