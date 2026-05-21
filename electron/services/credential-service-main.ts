// ==================== CREDENTIAL SERVICE ====================
// Secure credential storage using Keytar (OS-level keychain)
// Stores: Personal Access Tokens, GPG Private Keys

import * as keytar from "keytar";

const SERVICE_NAME = "TARAFlow";

// ==================== CREDENTIAL SERVICE ====================

export class CredentialService {
  // ==================== GIT PAT ====================

  /**
   * Save Personal Access Token
   * @param account - Account identifier (e.g., "github:username" or remote URL)
   * @param token - Personal Access Token
   */
  async saveGitToken(account: string, token: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, `git:${account}`, token);
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
      return await keytar.getPassword(SERVICE_NAME, `git:${account}`);
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
      return await keytar.deletePassword(SERVICE_NAME, `git:${account}`);
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
      await keytar.setPassword(SERVICE_NAME, `gpg:${keyId}`, privateKey);
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
      return await keytar.getPassword(SERVICE_NAME, `gpg:${keyId}`);
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
      return await keytar.deletePassword(SERVICE_NAME, `gpg:${keyId}`);
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
    const key = await this.getGPGKey(keyId);
    return key !== null;
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
      await keytar.setPassword(SERVICE_NAME, `ssh:${identifier}`, keyPath);
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
      return await keytar.getPassword(SERVICE_NAME, `ssh:${identifier}`);
    } catch (error) {
      console.error("Failed to retrieve SSH key path:", error);
      return null;
    }
  }

  // ==================== JIRA ====================

  /**
   * Save Jira API Token
   * @param account - Account identifier (email address)
   * @param token - Jira API token
   */
  async saveJiraToken(account: string, token: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, `jira:${account}`, token);
    } catch (error) {
      console.error("Failed to save Jira token:", error);
      throw new Error("Failed to save Jira token securely");
    }
  }

  /**
   * Get Jira API Token
   * @param account - Account identifier (email address)
   */
  async getJiraToken(account: string): Promise<string | null> {
    try {
      return await keytar.getPassword(SERVICE_NAME, `jira:${account}`);
    } catch (error) {
      console.error("Failed to retrieve Jira token:", error);
      return null;
    }
  }

  /**
   * Delete Jira API Token
   * @param account - Account identifier (email address)
   */
  async deleteJiraToken(account: string): Promise<boolean> {
    try {
      return await keytar.deletePassword(SERVICE_NAME, `jira:${account}`);
    } catch (error) {
      console.error("Failed to delete Jira token:", error);
      return false;
    }
  }

  // ==================== UTILITY ====================

  /**
   * List all stored credentials for debugging
   * WARNING: Should only be used in development
   */
  async listAllCredentials(): Promise<string[]> {
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      return credentials.map((c) => c.account);
    } catch (error) {
      console.error("Failed to list credentials:", error);
      return [];
    }
  }

  /**
   * Clear all stored credentials
   * WARNING: Destructive operation
   */
  async clearAllCredentials(): Promise<void> {
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      for (const cred of credentials) {
        await keytar.deletePassword(SERVICE_NAME, cred.account);
      }
    } catch (error) {
      console.error("Failed to clear credentials:", error);
      throw new Error("Failed to clear credentials");
    }
  }
}

// ==================== SINGLETON INSTANCE ====================

export const credentialService = new CredentialService();