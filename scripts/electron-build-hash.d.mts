// Types of electron-build-hash.mjs (used by vite.config.ts and tests).
export declare const BUILD_INFO_PATH: string;
export declare function inputsOfMetafile(
  metafile: { inputs: Record<string, unknown> },
  root?: string,
): string[];
export declare function hashInputs(files: string[], root?: string): string;
export declare function readBuildInfo(
  root?: string,
): { hash: string; builtAt?: string; inputs: string[] } | null;
