import { contextBridge, ipcRenderer, webFrame } from "electron";
import { type AuditConfig } from "audit/models/audit-types";
import { type UpdateCheckOptions } from "shared/models/update-types";

console.log("=== PRELOAD LOADED ===");

// ==================== DISABLE BROWSER ZOOM ====================

// Disable pinch-to-zoom
webFrame.setVisualZoomLevelLimits(1, 1);

// Lock zoom level to 0 (100%)
webFrame.setZoomLevel(0);

console.log("Browser zoom disabled, draw.io can handle its own zoom");

// ==================== EXPOSE ELECTRON APIs ====================

// NOTE: window.electron carries only shell / oauth / file / metadata — exactly
// the shape declared in global.d.ts. Git and credentials moved to their own
// bridges below (window.git / window.credentials) so they match the renderer
// services (git-service-renderer.ts, credential-service-renderer.ts). Before
// this fix they were partly under window.electron and window.credentials was
// missing entirely, so every renderer git/credential call failed silently.
contextBridge.exposeInMainWorld("electron", {
  // Shell API (für externe Links)
  shell: {
    openExternal: (url: string) =>
      ipcRenderer.invoke("shell:openExternal", url),
  },

  // OAuth API (für Deep Link Callbacks)
  oauth: {
    onCallback: (callback: (data: any) => void) => {
      ipcRenderer.on("oauth-callback", (_, data) => callback(data));
    },
    removeCallback: () => {
      ipcRenderer.removeAllListeners("oauth-callback");
    },
  },

  // File I/O API
  file: {
    saveDialog: (defaultName: string) =>
      ipcRenderer.invoke("file:saveDialog", defaultName),
    openDialog: () => ipcRenderer.invoke("file:openDialog"),
    // Generic file picker (SSH keys, allowed_signers pubkeys) — NOT the project
    // dialog: no tara.json filter, showHiddenFiles for ~/.ssh.
    pickFile: (options?: {
      title?: string;
      defaultPath?: string;
      buttonLabel?: string;
      filters?: { name: string; extensions: string[] }[];
    }) => ipcRenderer.invoke("file:pickFile", options),
    writeProject: (filePath: string, projectData: string) =>
      ipcRenderer.invoke("file:writeProject", filePath, projectData),
    readProject: (filePath: string) =>
      ipcRenderer.invoke("file:readProject", filePath),
    // Generic text I/O (audit feature: .gitattributes, allowed_signers, hooks)
    readText: (filePath: string) =>
      ipcRenderer.invoke("file:readText", filePath),
    writeText: (filePath: string, content: string) =>
      ipcRenderer.invoke("file:writeText", filePath, content),
    makeExecutable: (filePath: string) =>
      ipcRenderer.invoke("file:makeExecutable", filePath),
  },

  // Metadata API (Recent Projects)
  metadata: {
    getRecentProjects: () => ipcRenderer.invoke("metadata:getRecentProjects"),
    saveRecentProjects: (metadata: any[]) =>
      ipcRenderer.invoke("metadata:saveRecentProjects", metadata),
    removeProject: (projectId: string) =>
      ipcRenderer.invoke("metadata:removeProject", projectId),
  },
});

// ==================== GIT API (window.git) ====================
// Full surface, matching global.d.ts and git-service-renderer.ts, backed 1:1
// by the git:* ipcMain handlers in main.ts.
contextBridge.exposeInMainWorld("git", {
  // Repository
  isRepository: () => ipcRenderer.invoke("git:isRepository"),
  initRepository: () => ipcRenderer.invoke("git:initRepository"),

  // Status
  getStatus: () => ipcRenderer.invoke("git:getStatus"),
  isClean: () => ipcRenderer.invoke("git:isClean"),

  // Commit
  stage: (relPaths: string[]) => ipcRenderer.invoke("git:stage", relPaths),
  commit: (
    message: string,
    config: AuditConfig,
    signCommit: boolean,
    relPaths: string[],
  ) => ipcRenderer.invoke("git:commit", message, config, signCommit, relPaths),

  // Branches
  getBranches: () => ipcRenderer.invoke("git:getBranches"),
  getCurrentBranch: () => ipcRenderer.invoke("git:getCurrentBranch"),
  createBranch: (name: string, checkout: boolean) =>
    ipcRenderer.invoke("git:createBranch", name, checkout),
  checkoutBranch: (name: string) =>
    ipcRenderer.invoke("git:checkoutBranch", name),
  branchExists: (name: string) => ipcRenderer.invoke("git:branchExists", name),

  // Remote
  addRemote: (name: string, url: string) =>
    ipcRenderer.invoke("git:addRemote", name, url),
  getRemotes: () => ipcRenderer.invoke("git:getRemotes"),
  remoteExists: (name: string) => ipcRenderer.invoke("git:remoteExists", name),
  push: (remote: string, branch: string, config: any) =>
    ipcRenderer.invoke("git:push", remote, branch, config),

  // Log
  getLog: (maxCount: number) => ipcRenderer.invoke("git:getLog", maxCount),
  getLatestCommit: () => ipcRenderer.invoke("git:getLatestCommit"),

  // Diff
  getDiff: (filePath?: string) => ipcRenderer.invoke("git:getDiff", filePath),

  // Raw
  raw: (command: string[]) => ipcRenderer.invoke("git:raw", command),
  rawInDir: (dir: string, args: string[]) =>
    ipcRenderer.invoke("git:rawInDir", dir, args),

  setRepoPath: (root: string) => ipcRenderer.invoke("git:setRepoPath", root),
});

// ==================== CREDENTIALS API (window.credentials) ====================
// Backed by the credentials:* ipcMain handlers. Was entirely missing before.
contextBridge.exposeInMainWorld("credentials", {
  // Git PAT
  saveGitToken: (account: string, token: string) =>
    ipcRenderer.invoke("credentials:saveGitToken", account, token),
  getGitToken: (account: string) =>
    ipcRenderer.invoke("credentials:getGitToken", account),
  deleteGitToken: (account: string) =>
    ipcRenderer.invoke("credentials:deleteGitToken", account),

  // GPG keys
  saveGPGKey: (keyId: string, privateKey: string) =>
    ipcRenderer.invoke("credentials:saveGPGKey", keyId, privateKey),
  getGPGKey: (keyId: string) =>
    ipcRenderer.invoke("credentials:getGPGKey", keyId),
  deleteGPGKey: (keyId: string) =>
    ipcRenderer.invoke("credentials:deleteGPGKey", keyId),
  hasGPGKey: (keyId: string) =>
    ipcRenderer.invoke("credentials:hasGPGKey", keyId),

  // SSH key paths
  saveSSHKeyPath: (identifier: string, keyPath: string) =>
    ipcRenderer.invoke("credentials:saveSSHKeyPath", identifier, keyPath),
  getSSHKeyPath: (identifier: string) =>
    ipcRenderer.invoke("credentials:getSSHKeyPath", identifier),
});

// ==================== AUDIT API (window.audit) ====================
contextBridge.exposeInMainWorld("audit", {
  verify: (params: unknown) => ipcRenderer.invoke("audit:verify", params),
});

// ==================== UPDATE API (window.updates) ====================
contextBridge.exposeInMainWorld("updates", {
  check: (opts: UpdateCheckOptions) =>
    ipcRenderer.invoke("update:check", opts),
});

contextBridge.exposeInMainWorld("electronAPI", {
  // DrawIO Plugin Injection
  injectDrawioPlugin: () => {
    console.log("[Preload] injectDrawioPlugin called");
    return ipcRenderer.invoke("drawio:injectPlugin");
  },

  getDrawioScroll: () => ipcRenderer.invoke("drawio:getScroll"),

  setDrawioViewport: (viewport: any) =>
    ipcRenderer.invoke("drawio:setViewport", viewport),
  selectDrawioCell: (cellId: string) =>
    ipcRenderer.invoke("drawio:selectCell", cellId),
  injectDrawioLibraries: (dfd1Xml: string, dfd2Xml: string) =>
    ipcRenderer.invoke("drawio:injectLibraries", dfd1Xml, dfd2Xml),
  jiraRequest: (config: { url: string; options: any }) =>
    ipcRenderer.invoke("jira:request", config),
  jira: {
    saveToken: (account: string, token: string) =>
      ipcRenderer.invoke("jira:saveToken", { account, token }),
    getToken: (account: string) =>
      ipcRenderer.invoke("jira:getToken", { account }),
    deleteToken: (account: string) =>
      ipcRenderer.invoke("jira:deleteToken", { account }),
  },
});

console.log(
  "Electron APIs exposed to renderer (electron, git, credentials, audit, electronAPI)",
);