// ==================== CREDENTIAL SERVICE RENDERER ====================
// Renderer-side wrapper for credential operations
// Communicates with Electron main process via IPC
// This replaces the direct keytar usage in the renderer

// ==================== CREDENTIAL SERVICE RENDERER ====================

export class CredentialServiceRenderer {
  // ==================== GIT PAT ====================

  /**
   * Save Personal Access Token
   * @param account - Account identifier (e.g., "github:username" or remote URL)
   * @param token - Personal Access Token
   */
  async saveGitToken(account: string, token: string): Promise<void> {
    try {
      if (!window.credentials) {
        throw new Error(
          "Credentials API not available. Running outside Electron?"
        );
      }
      await window.credentials.saveGitToken(account, token);
    } catch (error) {
      console.error("Failed to save Git token:", error);
      throw new Error("Failed to save Git token securely");
    }
  }

  /**
   * Get Personal Access Token
   * @param account - Account identifier
   * @returns Token or null if not found
   */
  async getGitToken(account: string): Promise<string | null> {
    try {
      if (!window.credentials) {
        console.warn("Credentials API not available");
        return null;
      }
      return await window.credentials.getGitToken(account);
    } catch (error) {
      console.error("Failed to retrieve Git token:", error);
      return null;
    }
  }

  /**
   * Delete Personal Access Token
   * @param account - Account identifier
   */
  async deleteGitToken(account: string): Promise<boolean> {
    try {
      if (!window.credentials) {
        console.warn("Credentials API not available");
        return false;
      }
      return await window.credentials.deleteGitToken(account);
    } catch (error) {
      console.error("Failed to delete Git token:", error);
      return false;
    }
  }

  // ==================== GPG KEYS ====================

  /**
   * Save GPG Private Key
   * @param keyId - GPG Key ID (e.g., "ABCD1234")
   * @param privateKey - Armored private key
   */
  async saveGPGKey(keyId: string, privateKey: string): Promise<void> {
    try {
      if (!window.credentials) {
        throw new Error(
          "Credentials API not available. Running outside Electron?"
        );
      }
      await window.credentials.saveGPGKey(keyId, privateKey);
    } catch (error) {
      console.error("Failed to save GPG key:", error);
      throw new Error("Failed to save GPG key securely");
    }
  }

  /**
   * Get GPG Private Key
   * @param keyId - GPG Key ID
   * @returns Private key or null if not found
   */
  async getGPGKey(keyId: string): Promise<string | null> {
    try {
      if (!window.credentials) {
        console.warn("Credentials API not available");
        return null;
      }
      return await window.credentials.getGPGKey(keyId);
    } catch (error) {
      console.error("Failed to retrieve GPG key:", error);
      return null;
    }
  }

  /**
   * Delete GPG Private Key
   * @param keyId - GPG Key ID
   */
  async deleteGPGKey(keyId: string): Promise<boolean> {
    try {
      if (!window.credentials) {
        console.warn("Credentials API not available");
        return false;
      }
      return await window.credentials.deleteGPGKey(keyId);
    } catch (error) {
      console.error("Failed to delete GPG key:", error);
      return false;
    }
  }

  /**
   * Check if GPG key exists
   * @param keyId - GPG Key ID
   */
  async hasGPGKey(keyId: string): Promise<boolean> {
    try {
      if (!window.credentials) {
        console.warn("Credentials API not available");
        return false;
      }
      return await window.credentials.hasGPGKey(keyId);
    } catch (error) {
      console.error("Failed to check GPG key:", error);
      return false;
    }
  }

  // ==================== SSH KEYS ====================

  /**
   * Save SSH Private Key Path
   * Note: We only store the path, not the key itself (keys should stay in ~/.ssh)
   * @param identifier - SSH key identifier
   * @param keyPath - Path to private key file
   */
  async saveSSHKeyPath(identifier: string, keyPath: string): Promise<void> {
    try {
      if (!window.credentials) {
        throw new Error(
          "Credentials API not available. Running outside Electron?"
        );
      }
      await window.credentials.saveSSHKeyPath(identifier, keyPath);
    } catch (error) {
      console.error("Failed to save SSH key path:", error);
      throw new Error("Failed to save SSH key path");
    }
  }

  /**
   * Get SSH Private Key Path
   * @param identifier - SSH key identifier
   */
  async getSSHKeyPath(identifier: string): Promise<string | null> {
    try {
      if (!window.credentials) {
        console.warn("Credentials API not available");
        return null;
      }
      return await window.credentials.getSSHKeyPath(identifier);
    } catch (error) {
      console.error("Failed to retrieve SSH key path:", error);
      return null;
    }
  }

  // ==================== UTILITY ====================

  /**
   * Check if credentials API is available
   */
  isAvailable(): boolean {
    return !!window.credentials;
  }
}

// ==================== SINGLETON INSTANCE ====================

export const credentialService = new CredentialServiceRenderer();