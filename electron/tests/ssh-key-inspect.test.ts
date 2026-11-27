// ==================== SSH KEY PATH CHECK — TESTS ====================
// 0.20.1 (user 2026-11-27): the public key (….pub) was accepted as the audit's
// SSH key, and ssh fell back to a password prompt. The path is classified in
// the main process; the push does not run with an unusable key.
//
// The files below are fakes: a key header and a filler line, no key material.
// The header is put together at run time so no complete header line stands
// in the source (the secret scan looks for one).
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expandHome, inspectSshKey } from "../services/ssh-key-inspect";
import { pushAuthConfig, sshKeyProblem } from "../services/git-push-auth";

const DASHES = "-".repeat(5);
const header = (kind: string) => `${DASHES}BEGIN ${kind}PRIVATE KEY${DASHES}\nAAAAfake\n`;
const posix = process.platform !== "win32";

let home = "";
const at = (name: string) => join(home, ".ssh", name);
const write = (name: string, content: string, mode = 0o600) => {
  writeFileSync(at(name), content);
  chmodSync(at(name), mode);
};

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "ssh-key-inspect-"));
  mkdirSync(join(home, ".ssh"));
  write("id_openssh", header("OPENSSH "));
  write("id_openssh.pub", "ssh-ed25519 AAAAfake someone@example\n", 0o644);
  write("id_rsa_old", header("RSA "));
  write("id_ec", header("EC "));
  write("id_pkcs8", header(""));
  write("ado", header("OPENSSH "));
  write("ado.pub", "ssh-rsa AAAAfake someone@example\n", 0o644);
  write("lonely.pub", "ssh-ed25519 AAAAfake someone@example\n", 0o644);
  write("pub_without_suffix", "ecdsa-sha2-nistp256 AAAAfake someone@example\n", 0o644);
  write("notes.txt", "just some text\n");
  write("open_key", header("OPENSSH "), 0o644);
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

const inspect = (name: string) => inspectSshKey(name.startsWith("~") ? name : at(name), { home });

describe("inspectSshKey", () => {
  it("private keys: OpenSSH, RSA, EC, PKCS#8 — ok; the type from the .pub beside it or the header", async () => {
    expect(await inspect("id_openssh")).toEqual({ status: "ok", keyType: "ed25519" });
    expect(await inspect("id_rsa_old")).toEqual({ status: "ok", keyType: "rsa" });
    expect(await inspect("id_ec")).toEqual({ status: "ok", keyType: "ecdsa" });
    expect(await inspect("id_pkcs8")).toEqual({ status: "ok" });
  });

  it("a .pub with its private key beside it: public_key, the private key offered in the form given", async () => {
    expect(await inspect("~/.ssh/ado.pub")).toEqual({ status: "public_key", keyType: "rsa", privateKeyPath: "~/.ssh/ado" });
  });

  it("a .pub without its private key, and a public key without .pub: public_key, nothing offered", async () => {
    expect(await inspect("lonely.pub")).toEqual({ status: "public_key", keyType: "ed25519" });
    expect(await inspect("pub_without_suffix")).toEqual({ status: "public_key", keyType: "ecdsa" });
  });

  it("missing file, any text file, a directory", async () => {
    expect(await inspect("nothing_here")).toEqual({ status: "missing" });
    expect(await inspect("notes.txt")).toEqual({ status: "not_a_private_key" });
    expect(await inspectSshKey(join(home, ".ssh"), { home })).toEqual({ status: "not_a_private_key" });
  });

  it.skipIf(!posix)("a private key others may read: permissions_too_open (POSIX); on Windows not checked", async () => {
    expect((await inspect("open_key")).status).toBe("permissions_too_open");
    expect((await inspectSshKey(at("open_key"), { home, platform: "win32" })).status).toBe("ok");
  });

  it("~ is the home directory", () => {
    expect(expandHome("~/.ssh/k", "/h")).toBe("/h/.ssh/k");
    expect(expandHome("/abs/k", "/h")).toBe("/abs/k");
  });
});

describe("the push with an unusable key", () => {
  it("a .pub given as the key: not applied, reason public_key, a message saying what to do", () => {
    const auth = pushAuthConfig({ method: "ssh", sshKeyPath: "~/.ssh/ado.pub", sshKeyStatus: "public_key", env: {} });
    expect(auth).toEqual({ config: [], sshKeySkipped: "public_key" });
    expect(sshKeyProblem("public_key", "~/.ssh/ado.pub")).toMatch(/public key.*private key/);
  });

  it("missing and the other reasons likewise; ok: applied", () => {
    for (const status of ["missing", "not_a_private_key", "permissions_too_open"] as const)
      expect(pushAuthConfig({ method: "ssh", sshKeyPath: "/opt/keys/k", sshKeyStatus: status, env: {} }).sshKeySkipped).toBe(status);
    expect(pushAuthConfig({ method: "ssh", sshKeyPath: "/opt/keys/k", sshKeyStatus: "ok", env: {} }).config).toHaveLength(1);
  });

  it("the user's GIT_SSH_COMMAND still wins over the check", () => {
    expect(pushAuthConfig({ method: "ssh", sshKeyPath: "/opt/keys/k.pub", sshKeyStatus: "public_key", env: { GIT_SSH_COMMAND: "ssh" } }).sshKeySkipped).toBe("environment");
  });
});
