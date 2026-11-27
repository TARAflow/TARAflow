// ==================== CHECK OF THE SSH KEY PATH ====================
// 0.20.1 (user 2026-11-27): the audit settings took the public key (….pub)
// as the SSH key. The path is checked in the main process
// (file:inspectSshKey) — this hook asks, 300 ms after the last keystroke, and
// gets a classification only, never key content.
import { useEffect, useState } from "react";

/** The main process's classification (electron/services/ssh-key-inspect.ts). */
export interface SshKeyCheck {
  status: "ok" | "missing" | "public_key" | "not_a_private_key" | "permissions_too_open";
  keyType?: "rsa" | "ed25519" | "ecdsa" | "dsa" | "sk" | "other";
  privateKeyPath?: string;
}

export function useSshKeyCheck(path: string | undefined, enabled: boolean, delayMs = 300): SshKeyCheck | null {
  const [check, setCheck] = useState<SshKeyCheck | null>(null);
  useEffect(() => {
    const inspect = window.electron?.file?.inspectSshKey;
    const value = path?.trim();
    if (!enabled || !value || !inspect) {
      setCheck(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void inspect(value).then((r) => {
        if (alive) setCheck(r.success && r.data ? r.data : null);
      });
    }, delayMs);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [path, enabled, delayMs]);
  return check;
}
