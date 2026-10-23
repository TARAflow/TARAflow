import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import {
  BUILD_INFO_PATH,
  hashInputs,
  readBuildInfo,
} from "./scripts/electron-build-hash.mjs";

/**
 * Dev check (src/app/dev/electron-build-notice.tsx): the hash of the sources
 * of the last Electron build AS THEY ARE NOW. The dev server watches them
 * and pushes a new hash when one changes; production builds get null.
 */
function electronSourceHash(): Plugin {
  const ID = "virtual:electron-source-hash";
  const EVENT = "taraflow:electron-source-hash";
  let serving = false;
  const current = () => {
    const info = readBuildInfo();
    return info ? hashInputs(info.inputs) : null;
  };
  return {
    name: "taraflow-electron-source-hash",
    configResolved(config) {
      serving = config.command === "serve";
    },
    resolveId: (id) => (id === ID ? "\0" + ID : undefined),
    load: (id) =>
      id === "\0" + ID
        ? `export default ${JSON.stringify(serving ? current() : null)};`
        : undefined,
    configureServer(server) {
      const watched = () => [
        resolve(BUILD_INFO_PATH),
        ...(readBuildInfo()?.inputs ?? []).map((f: string) => resolve(f)),
      ];
      server.watcher.add(watched());
      let last = current();
      server.watcher.on("change", (file) => {
        if (!watched().includes(resolve(file))) return;
        const hash = current();
        if (hash === last) return;
        last = hash;
        server.watcher.add(watched()); // a rebuild may bring new inputs
        server.ws.send({ type: "custom", event: EVENT, data: hash });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), electronSourceHash()],
  base: "./", // for Electron - relative path
  resolve: {
    alias: {
      app: "/src/app",
      features: "/src/features",
      shared: "/src/shared",
      i18n: "/src/i18n",
      audit: "/src/features/audit",
    },
  },
  build: {
    rollupOptions: {
      external: [
        ...builtinModules, // fs, path, url, tls, http, https, etc.
        "keytar",
        "simple-git",
        "@kwsites/file-exists",
      ],
    },
  },
  optimizeDeps: {
    exclude: ["keytar", "simple-git", "@kwsites/file-exists"],
  },
});