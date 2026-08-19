// electron/services/update/release-source.ts
// ==================== UPDATE — RELEASE SOURCE (PORT + ADAPTER) ====================
// The single seam to the outside world: fetching releases from GitHub.
// The pure core depends only on the ReleaseSource PORT; the real adapter
// and an injectable fetch keep everything unit-testable without network.

/** One GitHub release, mapped to camelCase — the API's snake_case never
 *  leaks past this boundary. Internal to the update feature (the renderer
 *  never sees this; it only sees UpdateCheckResult). */
export interface GithubRelease {
  tagName: string;
  name: string | null;
  body: string | null;
  htmlUrl: string;
  publishedAt: string | null;
  draft: boolean;
  prerelease: boolean;
}

/** Port: anything that can list releases. Ordering is NOT assumed — the
 *  core selects the highest by SemVer, not by position. */
export interface ReleaseSource {
  listReleases(): Promise<GithubRelease[]>;
}

/** Minimal fetch shape we depend on — satisfied by Node 24's global fetch
 *  and trivially faked in tests. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

interface RawGithubRelease {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asStringOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

function mapRelease(raw: RawGithubRelease): GithubRelease {
  return {
    tagName: asString(raw.tag_name),
    name: asStringOrNull(raw.name),
    body: asStringOrNull(raw.body),
    htmlUrl: asString(raw.html_url),
    publishedAt: asStringOrNull(raw.published_at),
    draft: raw.draft === true,
    prerelease: raw.prerelease === true,
  };
}

export interface GitHubReleaseSourceOptions {
  owner: string;
  repo: string;
  /** Defaults to the global fetch (Node 24). Injected in tests. */
  fetchImpl?: FetchLike;
  /** How many releases to request (default 30). */
  perPage?: number;
}

/** Real adapter: GitHub REST v3 `/releases` (which INCLUDES pre-releases,
 *  unlike `/releases/latest`, and carries release notes in `body`). Throws
 *  on a non-2xx status or a non-array body; the core turns that throw into
 *  an `error` result, so the caller never has to try/catch. */
export class GitHubReleaseSource implements ReleaseSource {
  constructor(private readonly options: GitHubReleaseSourceOptions) {}

  async listReleases(): Promise<GithubRelease[]> {
    const { owner, repo, perPage = 30 } = this.options;
    const fetchImpl = this.options.fetchImpl ?? (globalThis.fetch as FetchLike);
    const url =
      `https://api.github.com/repos/${owner}/${repo}/releases` +
      `?per_page=${perPage}`;

    const res = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
        // GitHub requires a User-Agent on every request.
        "User-Agent": "TARAflow",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API request failed with status ${res.status}`);
    }

    const body = await res.json();
    if (!Array.isArray(body)) {
      throw new Error("Unexpected GitHub API response (expected an array)");
    }

    return body.map((entry) => mapRelease(entry as RawGithubRelease));
  }
}
