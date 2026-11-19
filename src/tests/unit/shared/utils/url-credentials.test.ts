// Review 2026-11-11: credentials in a repository URL never travel with a
// project file — the component import copies URLs into every machine.

import { describe, expect, it } from "vitest";
import { hasUrlCredentials, withoutUrlCredentials } from "shared/utils/url-credentials";

describe("withoutUrlCredentials", () => {
  it.each([
    ["https://user:token@git.example.com/org/repo.git", "https://git.example.com/org/repo.git"],
    ["https://ghp_abc123@github.com/org/repo.git", "https://github.com/org/repo.git"],
    ["http://u:p@host:8080/r", "http://host:8080/r"],
    ["git://u@host/r", "git://host/r"],
    ["ssh://git:secret@host/r.git", "ssh://git@host/r.git"],
    ["ssh://git@host/r.git", "ssh://git@host/r.git"],
    ["git@github.com:org/repo.git", "git@github.com:org/repo.git"],
    ["https://github.com/org/repo.git", "https://github.com/org/repo.git"],
    // an @ in the path is not a user part
    ["https://host/org/repo@v1", "https://host/org/repo@v1"],
  ])("%s → %s", (url, expected) => {
    expect(withoutUrlCredentials(url)).toBe(expected);
  });

  it("hasUrlCredentials: only what would be dropped", () => {
    expect(hasUrlCredentials("https://user:token@host/r")).toBe(true);
    expect(hasUrlCredentials("ssh://git:secret@host/r")).toBe(true);
    expect(hasUrlCredentials("ssh://git@host/r")).toBe(false);
    expect(hasUrlCredentials("git@host:org/r.git")).toBe(false);
    expect(hasUrlCredentials(" https://host/r ")).toBe(false);
    expect(hasUrlCredentials("")).toBe(false);
  });
});
