// Virtual modules provided by vite.config.ts plugins.

/** Hash of the Electron sources now (dev server); null in production. */
declare module "virtual:electron-source-hash" {
  const hash: string | null;
  export default hash;
}
