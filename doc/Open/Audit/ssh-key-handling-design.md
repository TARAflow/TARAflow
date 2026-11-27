# SSH key handling — design note

**Status:** steps 1 and 2 in 0.20.1, step 3 in 0.21 (user 2026-11-27) · roadmap §3.2, decision R-12

## Trigger

A real case (2026-11-27):

- The audit settings accepted the **public** key (`….pub`) as the SSH key path. With
  `-i <file>.pub -o IdentitiesOnly=yes`, ssh had no usable identity and fell back to a
  password prompt.
- *Resolve* of a source reference to Azure DevOps over SSH asked for a password in the
  terminal that had started TARAflow. The UI waited until the 20 s timeout.

## Findings (code at `e8978114`)

1. `GIT_TERMINAL_PROMPT=0` (`electron/services/git-environment.ts`) stops git's own prompts
   only. ssh reads its password, passphrase and host-key questions from the **controlling
   terminal**. This hangs every git call of the main process that reaches a remote over SSH,
   as long as TARAflow was started from a terminal:
   - push (`git-service-main.ts`)
   - Resolve (`electron/ipc/remote-ref.ts`, `ls-remote`)
   - the component fetch (`git-fixed-ops.ts`, `fetchTags`)

   The free-argument channels (`git:rawInDir`, `git:raw`) cannot reach a remote
   (`git-arg-policy.ts`).
2. The SSH key field of the audit settings (`audit-config-dialog.tsx`) takes any path. There
   is no check for existence, `.pub`, file type or permissions. The placeholder
   `~/.ssh/id_ed25519` does not say that a *private* key is meant.
3. Resolve uses no configured key. `CredentialRef.sshKeyPath` (`source-binding-types.ts`)
   exists, but nothing reads it, and the audit key does not apply to Resolve.

## Step 1 — ssh never asks (0.20.1)

The three remote calls run ssh with `-o BatchMode=yes`. ssh then fails at once (*Permission
denied (publickey)*, *Host key verification failed*) instead of asking.

**Only where the user has no ssh setup of their own.** git chooses its ssh in this order:

1. `GIT_SSH_COMMAND`
2. `GIT_SSH`
3. `core.sshCommand` (git configuration, also set through `GIT_CONFIG_*`)

So the variable also beats a `core.sshCommand`. The brief proposed `GIT_SSH_COMMAND="ssh -o
BatchMode=yes"` whenever neither variable is set. That would silently override a
`core.sshCommand` in `~/.gitconfig`, for example the OpenSSH path on Windows or an `-i`.
Therefore:

- `withSshBatchMode(user, dir)` looks up `core.sshCommand` with `git config --get`. It uses
  the same environment, in the repository of the call (or the home directory for
  `ls-remote`). It sets `GIT_SSH_COMMAND = "ssh -o BatchMode=yes"` only when none of the
  three is set.
- A setup of the user's own stays untouched, without BatchMode. Their command decides.
- **Push with the audit key:** the key's `core.sshCommand` (passed with `-c`) carries
  `-o BatchMode=yes` itself. The environment then gets no `GIT_SSH_COMMAND`, because it would
  override the key.

**What the user sees.** Resolve passes a hint code with `no_access`:

- `host_key`: the host's key was never confirmed. Connect once in a terminal
  (`ssh -T git@<host>`).
- `ssh_key`: no key was accepted. TARAflow asks for no passphrase, so a key with a passphrase
  has to be loaded into the ssh-agent (`ssh-add`), and its public key stored at the host.

A failed push or fetch shows git's message as before. It now arrives at once instead of after
a timeout.

## Step 2 — check the audit key path (0.20.1)

`file:inspectSshKey(path)` runs in the main process. It reads only the first bytes of the
file and never runs `ssh-keygen`, because that may ask for a passphrase. The renderer gets a
classification only, never key content:

| Result | When |
|---|---|
| `ok` | a `-----BEGIN … PRIVATE KEY-----` header (OpenSSH, RSA, EC, PKCS#8) |
| `missing` | no such file |
| `public_key` | the first line starts with `ssh-`, `ecdsa-sha2-` or `sk-`, or the name ends in `.pub` |
| `not_a_private_key` | anything else |
| `permissions_too_open` | POSIX only: group or others may read it; ssh refuses such a key |

The result also reports the key type when known (from the first line of the `.pub` next to
the key), for the Azure DevOps hint of step 3.

**In the dialog:**

- Checked on input and after *Browse*.
- For `public_key` with the private key beside it, one click offers "Use `<path without
  .pub>` instead?".
- The other results show a field error.
- Help text: "Path to the **private** key (not .pub)", with a neutral placeholder.

**At push time:** `pushAuthConfig` applies an unusable key as little as it applies an
`invalid` one today. The reason reaches the UI (`public_key`, `missing`). There is no silent
fallback to the default key.

**Not for the signing key.** For SSH signing, git explicitly allows a public key in
`user.signingkey`; the private key is then in the agent. At most it gets a hint: "the private
key has to be in the ssh-agent".

## Step 3 — where Resolve takes its credentials from (0.21, R-12)

- **(b) now:** the source reference dialog and a `no_access` say "Resolve uses your SSH setup
  (`~/.ssh/config`, ssh-agent); the audit key is not used here".
  - With it, a `no_access` on `ssh.dev.azure.com` / `vs-ssh.visualstudio.com` hints that
    Azure DevOps takes RSA keys only, that keys expire after a year and are uploaded per
    organisation.
  - It names the key type when step 2 knows it.
- **(a) later:** a per-host key, machine-local (like the audit's `auth.sshKeyPath`, never in
  the project file), wired to `CredentialRef.sshKeyPath`, with the checks of steps 1 and 2.
  This comes once several hosts or keys come up in practice.

## Tests

- **Step 1:**
  - `withSshBatchModeIf` / `withSshBatchMode`: BatchMode only without a setup of the user's
    own. The lookup is checked through the environment's and the repository's git
    configuration.
  - `remoteHint`.
  - `pushAuthConfig`: the key command carries BatchMode.
  - End to end with a fake `ssh` first on `PATH`: Resolve and `fetchTags` run it with
    BatchMode, and the refusal comes back as `no_access` with its hint. The user's own
    `GIT_SSH_COMMAND` runs without BatchMode. POSIX only.
- **Step 2:** the classification for every case of the table (permissions POSIX only); the
  push reason; the dialog's offer of the private key.
