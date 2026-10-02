# Security Policy

TARAflow is a tool for security analysis — we take vulnerabilities in the
tool itself seriously. Thank you for helping keep it and its users safe.

## Supported Versions

TARAflow is in the alpha phase (`0.x`). Security fixes are made on `main`
and shipped with the next release; older releases are not patched.

| Version                  | Supported          |
| ------------------------ | ------------------ |
| latest `0.x` release     | :white_check_mark: |
| `main`                   | :white_check_mark: |
| older `0.x` releases     | :x:                |

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub:
**Security** tab → **Report a vulnerability**
(<https://github.com/TARAflow/TARAflow/security/advisories/new>)

Please include, as far as possible:

- affected version (release tag or commit) and platform (Windows, macOS, Linux)
- component (desktop app, `taraflow-report`, `taraflow-verify`, git hooks, …)
- steps to reproduce, or a proof of concept (e.g. a crafted `.tara.json`)
- impact as you see it

### What to expect

TARAflow is maintained by a small team; these are our targets, not guarantees:

- **Acknowledgement** within 7 days
- **Initial assessment** (accepted / declined, with reasoning) within 14 days
- **Status updates** at least every 14 days while a fix is in progress
- **Fix and release** depending on severity — critical issues with priority

If the report is **accepted**, we develop a fix, publish a GitHub Security
Advisory together with the release, and credit you unless you prefer
otherwise. If it is **declined**, we explain why.

We follow coordinated disclosure: please give us **90 days** from your
report before publishing details, or less if a fix has been released.
There is no bug bounty.

## Scope

In scope, for example:

- code execution, file access or path traversal via a crafted project file
  (`.tara.json`), DFD (draw.io) data, imported hazard spreadsheets or
  attack-tree DSL
- bypassing the audit trail: a commit accepted by the Audit Verification
  Engine (`taraflow-verify`, git hooks, Audit tab) although it is unsigned,
  signed by an unauthorized key, or changes the signer manifest without a
  maintainer signature
- leaking credentials or key paths (e.g. into project files or commits)
- Electron-specific issues (IPC exposure, context isolation, remote content)
- supply-chain issues in the build, including the vendored dependencies
  under `vendor/`

Out of scope:

- installers being **unsigned** — this is a documented decision; build from
  source if you need to verify the binary yourself
- vulnerabilities in your own git hosting, CI or signing setup
- **methodology findings** (a threat that should or should not be generated,
  a risk value you disagree with) — these are important, but please report
  them as a regular issue so they can be discussed openly
