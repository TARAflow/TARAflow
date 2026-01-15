// ==================== GIT TYPES ====================
// Git-specific types for simple-git integration

// ==================== GIT STATUS ====================

export interface GitFileStatus {
  path: string;
  index: string; // Modified, Added, Deleted, etc.
  working_dir: string;
}

export interface GitStatus {
  not_added: string[];
  conflicted: string[];
  created: string[];
  deleted: string[];
  modified: string[];
  renamed: { from: string; to: string }[];
  files: GitFileStatus[];
  staged: string[];
  ahead: number;
  behind: number;
  current: string;
  tracking: string | null;
}

// ==================== GIT COMMIT ====================

export interface GitCommitResult {
  commit: string; // Commit hash
  summary: {
    changes: number;
    insertions: number;
    deletions: number;
  };
  branch: string;
  author: {
    name: string;
    email: string;
  };
}

// ==================== GIT BRANCH ====================

export interface GitBranchSummary {
  all: string[];
  branches: { [name: string]: GitBranchDetail };
  current: string;
  detached: boolean;
}

export interface GitBranchDetail {
  current: boolean;
  name: string;
  commit: string;
  label: string;
}

// ==================== GIT PUSH ====================

export interface GitPushResult {
  pushed: Array<{
    remote?: string;
    local?: string;
    deleted?: boolean;
    tag?: boolean;
    alreadyUpdated?: boolean;
  }>;
  branch?: {
    local: string;
    remote: string;
  };
  update?: {
    head?: {
      local: string;
      remote: string;
    };
    hash?: {
      from: string;
      to: string;
    };
  };
  repo?: string;
  ref?: {
    local: string;
  };
}

// ==================== GIT LOG ====================

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
  body?: string;
  refs?: string;
}

export interface GitLogSummary {
  all: GitLogEntry[];
  total: number;
  latest: GitLogEntry | null;
}

// ==================== GIT REMOTE ====================

export interface GitRemote {
  name: string;
  refs: {
    fetch: string;
    push: string;
  };
}

// ==================== GIT ERROR ====================

export interface GitError {
  message: string;
  code?: number;
  stack?: string;
}

// ==================== GIT OPERATION RESULT ====================

export interface GitOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}