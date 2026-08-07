// ==================== AUDIT GIT HOST ====================
// Pure host detection + remote-URL parsing for the protected-branch checklist.
// No network, no API — just enough to name the host and build deep-links to the
// right settings page. `unknown` is a first-class result (self-hosted, exotic
// remotes) → the checklist falls back to host-neutral guidance.

export type GitHost = "github" | "gitlab" | "bitbucket" | "azure" | "unknown";

export interface RemoteInfo {
  host: GitHost;
  /** owner / group (may contain slashes for GitLab subgroups); null if unparsed. */
  owner: string | null;
  repo: string | null;
  /** Normalized https web URL of the repo, or null if it couldn't be parsed. */
  webUrl: string | null;
}

/** Best-effort host classification from a remote URL (SSH or HTTPS). */
export function detectGitHost(remoteUrl: string | undefined | null): GitHost {
  if (!remoteUrl) return "unknown";
  const u = remoteUrl.toLowerCase();
  if (u.includes("github.com")) return "github";
  if (u.includes("dev.azure.com") || u.includes("visualstudio.com"))
    return "azure";
  if (u.includes("bitbucket.org") || u.includes("bitbucket")) return "bitbucket";
  if (u.includes("gitlab.com") || u.includes("gitlab")) return "gitlab";
  return "unknown";
}

/**
 * Parse owner/repo + a web URL from SSH (`git@host:owner/repo.git`,
 * `ssh://git@host/owner/repo`) or HTTPS (`https://host/owner/repo.git`) remotes.
 * GitLab subgroups (owner = `group/subgroup`) are preserved. Azure's odd
 * `/_git/` path is left intact in the web URL (the checklist links it directly).
 */
export function parseRemote(remoteUrl: string | undefined | null): RemoteInfo {
  const host = detectGitHost(remoteUrl);
  if (!remoteUrl) return { host, owner: null, repo: null, webUrl: null };

  let hostName = "";
  let path = "";

  // scp-like SSH (git@host:path) — but NOT a scheme:// URL, whose ':' is a
  // port, not an scp path separator. Without this guard the scp regex grabs
  // "ssh://git@host:2222/..." and folds the port into the path.
  const scp = !remoteUrl.includes("://")
    ? remoteUrl.match(/^[^@\s]+@([^:/\s]+):(.+)$/)
    : null;
  if (scp) {
    hostName = scp[1];
    path = scp[2];
  } else {
    // scheme://[user@]host[:port]/path
    const m = remoteUrl.match(
      /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i,
    );
    if (m) {
      hostName = m[1];
      path = m[2];
    }
  }

  path = path.replace(/\.git$/i, "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  if (!hostName || parts.length === 0) {
    return { host, owner: null, repo: null, webUrl: null };
  }

  const repo = parts[parts.length - 1];
  const owner = parts.length > 1 ? parts.slice(0, -1).join("/") : null;
  const webUrl = `https://${hostName}/${parts.join("/")}`;

  return { host, owner, repo, webUrl };
}
