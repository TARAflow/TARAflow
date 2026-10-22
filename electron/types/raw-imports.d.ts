// A file imported with the "?raw" suffix is its text (Vite / Vitest built in,
// esbuild via the rawText plugin in scripts/build-electron.mjs). Used for the
// scripts that run inside the draw.io frame (electron/drawio-scripts).
declare module "*?raw" {
  const content: string;
  export default content;
}
