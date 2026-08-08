// ==================== AUDIT PROTECTION CHECKLIST ====================
// Turns a host + the local check result into a single markdown document: what
// git already PROVED locally (signed / linear / anchor tag), and what only the
// SERVER can enforce (block force-push, require signed commits, tag-protect the
// anchor) — the latter as host-specific guidance with a deep-link. Also carries
// the anchor commit hash so it can be pinned out-of-band in Phase 4.
//
// Pure: (host, remoteInfo, checkResult, anchor) → string. No git, no network.

import type { GitHost, RemoteInfo } from "./audit-git-host";
import type { ProtectionCheckResult } from "./audit-protection-check";

export interface ChecklistInput {
  remote: RemoteInfo;
  result: ProtectionCheckResult;
  /** The audit branch these settings apply to (e.g. "audit" or "main"). */
  branch: string;
  /** Bootstrap commit = the out-of-band anchor to pin in Phase 4. */
  anchor: string;
}

/** Deep-link to the branch-protection settings page, or null if unknown. */
function settingsUrl(remote: RemoteInfo): string | null {
  if (!remote.webUrl) return null;
  switch (remote.host) {
    case "github":
      return `${remote.webUrl}/settings/branches`;
    case "gitlab":
      return `${remote.webUrl}/-/settings/repository`; // "Protected branches"
    case "bitbucket":
      return `${remote.webUrl}/admin/branch-permissions`;
    case "azure":
      // Azure: Project Settings → Repositories → Policies (no stable deep-link
      // from the repo URL); point at the repo and describe the path.
      return remote.webUrl;
    default:
      return null;
  }
}

/** Host-specific names for the four server-side settings. */
function serverGuidance(host: GitHost, branch: string): string[] {
  switch (host) {
    case "github":
      return [
        `Add a **branch protection rule** for \`${branch}\`.`,
        "Enable **Require signed commits**.",
        "Enable **Require linear history**.",
        "Enable **Do not allow bypassing the above settings** and **Restrict who can push** / disallow force pushes.",
        "Under **Tags**, add a protection rule for `audit-root`.",
        "Add `/.tara/ @your-maintainer-team` to **`.github/CODEOWNERS`** and enable **Require review from Code Owners** so only maintainers can change the signer manifest.",
      ];
    case "gitlab":
      return [
        `Under **Settings → Repository → Protected branches**, protect \`${branch}\` (Allowed to push: *No one* or maintainers only, **Allowed to force push: off**).`,
        "Under **Settings → Repository → Push rules**, enable **Reject unsigned commits**.",
        "Keep merges fast-forward only (**Settings → Merge requests → Fast-forward merge**) to preserve linear history.",
        "Under **Settings → Repository → Protected tags**, protect `audit-root`.",
        "Add `/.tara/ @maintainers` to **`CODEOWNERS`** and require **Code Owner approval** on the protected branch so only maintainers can change the signer manifest.",
      ];
    case "bitbucket":
      return [
        `Add **Branch permissions** for \`${branch}\`: prevent deletion and **prevent rewriting history (no force push)**.`,
        "Require commits to be **verified / signed** (Premium: Require signed commits merge check).",
        "Enforce a **fast-forward-only / no-merge-commit** strategy to keep history linear.",
        "Add branch/tag permissions covering `audit-root`.",
        "Restrict who can modify `.tara/` (Code Owners / default reviewers on that path) so only maintainers can change the signer manifest.",
      ];
    case "azure":
      return [
        `Project Settings → **Repositories → Policies** for \`${branch}\`.`,
        "Enable **Require signed commits** (commit-signing policy).",
        "Set the merge policy to **Rebase / fast-forward only** (no merge commits) for linear history.",
        "Restrict **Force push / Bypass**; limit who can push.",
        "Protect the `audit-root` tag via tag-level permissions.",
        "Add a **Required reviewers** policy on the `.tara/` path so only maintainers can change the signer manifest.",
      ];
    default:
      return [
        `On your host, protect the \`${branch}\` branch so that: force-pushes are blocked, only trusted maintainers can push.`,
        "Require **signed commits** to be enforced server-side.",
        "Keep history **linear** (fast-forward / rebase only, no merge commits).",
        "Protect the `audit-root` **tag** so the anchor can't be moved.",
        "Restrict changes to the `.tara/` path (path-based review / code-owners) so only maintainers can change the signer manifest.",
      ];
  }
}

const mark = (ok: boolean) => (ok ? "✅" : "⚠️");

/** Build the full markdown document. */
export function buildProtectionChecklist(input: ChecklistInput): string {
  const { remote, result, branch, anchor } = input;
  const lines: string[] = [];

  lines.push(`# Audit trail protection — \`${branch}\``);
  lines.push("");

  // ── Locally verified (git proved this, no server needed) ──
  lines.push("## Verified locally");
  lines.push("");
  lines.push(
    `- ${mark(result.allSigned.ok)} **All commits signed & authorized**` +
      (result.allSigned.ok
        ? ""
        : ` — ${result.allSigned.unsigned.length} not verified:\n` +
          result.allSigned.unsigned.map((h) => `    - \`${h}\``).join("\n")),
  );
  lines.push(
    `- ${mark(result.linearHistory.ok)} **Linear history (no merge commits)**` +
      (result.linearHistory.ok
        ? ""
        : ` — merge commits found:\n` +
          result.linearHistory.merges.map((h) => `    - \`${h}\``).join("\n")),
  );
  const anchorOk = result.anchorTag === "ok";
  lines.push(
    `- ${mark(anchorOk)} **Anchor tag \`audit-root\`** — ${
      result.anchorTag === "ok"
        ? "present and points at the anchor"
        : result.anchorTag === "missing"
          ? "missing (run `git tag -s audit-root " + anchor + "`)"
          : "points at the WRONG commit — investigate before trusting the trail"
    }`,
  );
  lines.push("");

  // ── Server-side (only the host can enforce — guidance) ──
  lines.push("## Configure on your host");
  lines.push("");
  lines.push(
    "These cannot be verified locally — set them on the remote so history can't be rewritten:",
  );
  lines.push("");
  for (const step of serverGuidance(remote.host, branch)) {
    lines.push(`- [ ] ${step}`);
  }
  const url = settingsUrl(remote);
  if (url) {
    lines.push("");
    lines.push(`Settings: ${url}`);
  }
  lines.push("");

  // ── Out-of-band anchor (Phase 4 pins this) ──
  lines.push("## Out-of-band anchor");
  lines.push("");
  lines.push(
    "Record this commit as the audit root in a place OUTSIDE the repository " +
      "(CI config, auditor record). The verifier trusts it as the root of the chain:",
  );
  lines.push("");
  lines.push(`    ${anchor}`);
  lines.push("");

  return lines.join("\n");
}
