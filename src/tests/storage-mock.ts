interface StorageResult {
  key: string;
  value: string;
  shared: boolean;
}

interface ListResult {
  keys: string[];
  prefix?: string;
  shared: boolean;
}

interface DeleteResult {
  key: string;
  deleted: boolean;
  shared: boolean;
}

class StorageMock {
  private data: Map<string, string> = new Map();

  async get(key: string, shared: boolean = false): Promise<StorageResult | null> {
    const value = this.data.get(key);
    if (!value) {
      throw new Error(`Key "${key}" not found`);
    }
    return {
      key,
      value,
      shared
    };
  }

  async set(key: string, value: string, shared: boolean = false): Promise<StorageResult | null> {
    this.data.set(key, value);
    return {
      key,
      value,
      shared
    };
  }

  async delete(key: string, shared: boolean = false): Promise<DeleteResult | null> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return {
      key,
      deleted: existed,
      shared
    };
  }

  async list(prefix: string = '', shared: boolean = false): Promise<ListResult | null> {
    const keys = Array.from(this.data.keys()).filter(key => key.startsWith(prefix));
    return {
      keys,
      prefix,
      shared
    };
  }
}

export function initializeStorageMock(): void {
  if (typeof window !== 'undefined' && !(window as any).storage) {
    console.log('🔧 Initializing storage mock for local development');
    (window as any).storage = new StorageMock();
  }
}

initializeStorageMock();