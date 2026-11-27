// ==================== WHAT KIND OF FILE AN SSH KEY PATH NAMES ====================
// 0.20.1 (user 2026-11-27, design note doc/Open/Audit/ssh-key-handling-design.md
// step 2): the audit settings took the PUBLIC key (….pub) as the SSH key —
// with `-i <file>.pub -o IdentitiesOnly=yes` ssh had no usable identity and
// fell back to a password prompt. The path is checked here, in the main
// process; the renderer gets the classification only, never key content.
//
// Reads the first bytes of the file — never runs ssh-keygen on it (it may ask
// for a passphrase). Not for the signing key: git allows a public key in
// user.signingkey (the private key in the ssh-agent).

import { open, stat } from "node:fs/promises";
import os from "node:os";

export type SshKeyStatus = "ok" | "missing" | "public_key" | "not_a_private_key" | "permissions_too_open";

export type SshKeyType = "rsa" | "ed25519" | "ecdsa" | "dsa" | "sk" | "other";

export interface SshKeyInspection {
  status: SshKeyStatus;
  /** The key type when known (the key's header, or the first word of its .pub). */
  keyType?: SshKeyType;
  /** `public_key`: the private key beside it, in the form the path was given ("~/.ssh/ado"). */
  privateKeyPath?: string;
}

const PUBLIC_LINE = /^(ssh-(rsa|ed25519|ed448|dss)|ecdsa-sha2-|sk-(ssh-ed25519|ecdsa-sha2-))\S*\s/;
const PRIVATE_HEADER = /^-----BEGIN (OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY-----/;
const HEAD_BYTES = 4096;

/** "~" and "~/…" as the home directory (ssh does the same with -i). */
export function expandHome(path: string, home = os.homedir()): string {
  if (path === "~") return home;
  if (path.startsWith("~/") || path.startsWith("~\\")) return home + path.slice(1);
  return path;
}

function typeOfPublicWord(word: string): SshKeyType {
  if (word === "ssh-rsa") return "rsa";
  if (word === "ssh-ed25519") return "ed25519";
  if (word.startsWith("ecdsa-sha2-")) return "ecdsa";
  if (word === "ssh-dss") return "dsa";
  if (word.startsWith("sk-")) return "sk";
  return "other";
}

function typeOfPrivateHeader(header: string): SshKeyType | undefined {
  if (/BEGIN RSA /.test(header)) return "rsa";
  if (/BEGIN EC /.test(header)) return "ecdsa";
  if (/BEGIN DSA /.test(header)) return "dsa";
  return undefined; // OpenSSH / PKCS#8: the type is inside the encoded body
}

/** The first line of a file, or null when it cannot be read as a regular file. */
async function firstLine(path: string): Promise<string | null> {
  let handle;
  try {
    handle = await open(path, "r");
    const buffer = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/)[0].trim();
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * What `path` names, for `-i <path>`. `platform`: the permission check is
 * POSIX only (ssh refuses a private key group or others may read).
 */
export async function inspectSshKey(
  path: string,
  options: { home?: string; platform?: NodeJS.Platform } = {},
): Promise<SshKeyInspection> {
  const given = path.trim();
  const full = expandHome(given, options.home);
  let info;
  try {
    info = await stat(full);
  } catch {
    return { status: "missing" };
  }
  if (!info.isFile()) return { status: "not_a_private_key" };

  const line = (await firstLine(full)) ?? "";
  const publicWord = PUBLIC_LINE.test(line + " ") ? line.split(/\s/)[0] : null;
  if (publicWord || /\.pub$/i.test(full)) {
    const out: SshKeyInspection = { status: "public_key", ...(publicWord ? { keyType: typeOfPublicWord(publicWord) } : {}) };
    if (/\.pub$/i.test(full)) {
      const sibling = full.slice(0, -4);
      if ((await isFile(sibling)) && PRIVATE_HEADER.test((await firstLine(sibling)) ?? "")) out.privateKeyPath = given.slice(0, -4);
    }
    return out;
  }

  if (!PRIVATE_HEADER.test(line)) return { status: "not_a_private_key" };

  const pub = await firstLine(`${full}.pub`);
  const keyType = pub && PUBLIC_LINE.test(pub + " ") ? typeOfPublicWord(pub.split(/\s/)[0]) : typeOfPrivateHeader(line);
  const platform = options.platform ?? process.platform;
  if (platform !== "win32" && (info.mode & 0o077) !== 0) return { status: "permissions_too_open", ...(keyType ? { keyType } : {}) };
  return { status: "ok", ...(keyType ? { keyType } : {}) };
}
