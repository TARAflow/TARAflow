// ==================== COMPONENT PATHS ====================
// Multi-project TARA (design v3 §6.1, §8.2): where the component TARA of an
// import lies on this machine — for "Open component TARA". Nothing path-like
// enters the project file: a component in the machine's own repository is
// found from the repository root + its path in the repository (sameRepo);
// any other one by the local path remembered at import, in localStorage
// only (same hybrid as repo discovery).

import type { ComponentSource } from "shared";
import type { ComponentGitRunner } from "./component-source";

const KEY = "taraflow.componentPaths";

function read(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Remembers the local path of a component TARA (on this machine only). */
export function rememberComponentPath(componentId: string, path: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [componentId]: path }));
  } catch {
    // storage full / unavailable: "Open" then asks nothing and is not offered
  }
}

export function rememberedComponentPath(componentId: string): string | undefined {
  return read()[componentId];
}

function dirOf(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : ".";
}

/**
 * The local path of a component TARA: in the machine's repository from its
 * root and the path in the repository, otherwise the remembered path.
 */
export async function resolveComponentPath(
  componentId: string,
  source: ComponentSource,
  machineFilePath: string | undefined,
  git: ComponentGitRunner,
): Promise<string | undefined> {
  if (source.sameRepo && source.path && machineFilePath) {
    const top = await git(["rev-parse", "--show-toplevel"], dirOf(machineFilePath));
    if (top.code === 0 && top.stdout.trim()) {
      const root = top.stdout.trim().replace(/[\\/]+$/, "");
      const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/";
      return `${root}${sep}${source.path.split("/").join(sep)}`;
    }
  }
  return rememberedComponentPath(componentId);
}

/** "tag sd/v1 · commit 01234567", or the unpinned reason. */
export function componentSourceLabel(source: ComponentSource): string {
  if (source.unpinned) return `unpinned (${source.unpinned})`;
  return [source.tag ? `tag ${source.tag}` : null, source.commitSha ? `commit ${source.commitSha.slice(0, 8)}` : null]
    .filter(Boolean)
    .join(" · ");
}
