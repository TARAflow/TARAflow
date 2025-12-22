// ==================== LOCAL STORAGE MODEL ====================
// Single Responsibility: Abstraction layer for localStorage with observer pattern

export default class LocalStorageModel {
  private readonly storageKey: string;
  private repo: Storage;
  private callbacks: ((event: StorageEvent) => void)[];

  /**
   * @param storageKey - The key to use for storage.
   *                     For project-specific storage, use format: `DrawioMsg_${projectId}`
   */
  constructor(storageKey = "DrawioMsg") {
    this.storageKey = storageKey;
    this.repo = localStorage;
    this.callbacks = [];
  }

  /**
   * Get the current storage key
   */
  getStorageKey(): string {
    return this.storageKey;
  }

  /**
   * Observe changes to the storage key
   */
  observe(callback: (record: string) => void) {
    const key = this.storageKey;
    this.callbacks.push((e: StorageEvent) => {
      if (e.key !== key) {
        return;
      }
      const record = e.newValue;
      if (record) {
        callback(record);
      }
    });
  }

  /**
   * Read value from storage
   * @param key - Optional key, defaults to the instance's storageKey
   */
  read(key: string = this.storageKey): string | null {
    return this.repo.getItem(key);
  }

  /**
   * Write value to storage
   * @param value - The value to store
   * @param key - Optional key, defaults to the instance's storageKey
   */
  write(value: string, key: string = this.storageKey): void {
    const oldValue = this.read(key);
    const event = new StorageEvent("storage", {
      key: key,
      oldValue: oldValue,
      newValue: value,
    });
    this.repo.setItem(key, value);
    this.callbacks.forEach((c) => c(event));
  }

  /**
   * Remove value from storage
   * @param key - Optional key, defaults to the instance's storageKey
   */
  remove(key: string = this.storageKey): void {
    this.repo.removeItem(key);
  }

  /**
   * Clear all callbacks (useful for cleanup)
   */
  clearObservers(): void {
    this.callbacks = [];
  }
}
