// utils/depcruise-doc.cjs
//
// Phase 0 (TARAflow CLI Report Plan) — guardrail for the purity boundary
// in the generation path (features/documentation/{utils,models}/**).
//
// Goal: no module in this path may import a feature barrel
// (features/*/index.ts), react, react-dom, @mui/*, draw.io, or a module
// with top-level window/document access.
//
// Starting severity was "warn" (Phase 0 must not be red); now "error"
// since Phase 1 completed with a clean graph (Phase 7 = CI guardrail).
//
// Usage:
//   npm i -D dependency-cruiser
//   npx depcruise --config utils/depcruise-doc.cjs src/features/documentation/utils
//   npx depcruise --config utils/depcruise-doc.cjs --output-type dot src/features/documentation/utils > graph.dot
//
// IMPORTANT: "import type" edges are allowed (they're erased at build
// time, no runtime code). dependency-cruiser marks them with
// dependencyType "type-only" when tsPreCompilationDeps is enabled — the
// rules below don't exclude "type-only" from being checked in general,
// the "to" condition itself filters via dependencyTypes. Verify this
// against your actual import graph (see the note below at
// KNOWN_WINDOW_COUPLED_MODULES).

const GENERATION_PATH = "^src/features/documentation/(utils|models)";

// Heuristic for modules with top-level window/document access. Path-based,
// because dependency-cruiser has no built-in "has globalThis.window in
// module scope" check. This list must be verified and extended against
// the real files (e.g. pdf-generator-renderer.ts, drawio-controller.ts)
// once the full import graph is available.
const KNOWN_WINDOW_COUPLED_MODULES =
  "pdf-generator-renderer|pdf-generator-adaptive|drawio-controller|use-document-generation";

module.exports = {
  forbidden: [
    {
      name: "no-barrel-imports-in-generation-path",
      severity: "error",
      comment:
        "The generation path must not import a feature barrel " +
        "(features/*/index.ts) — deep paths only. See Phase 1's " +
        "replacement table.",
      from: { path: GENERATION_PATH },
      to: {
        path: "^src/(features/[^/]+|shared)/index\\.(ts|tsx)$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-react-in-generation-path",
      severity: "error",
      comment: "The generation path is UI-free — no react/react-dom.",
      from: { path: GENERATION_PATH },
      to: {
        path: "^(react|react-dom)(/|$)",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-mui-in-generation-path",
      severity: "error",
      comment: "The generation path must not import @mui/*.",
      from: { path: GENERATION_PATH },
      to: {
        path: "^@mui/",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-drawio-in-generation-path",
      severity: "error",
      comment: "The generation path must not import a draw.io module.",
      from: { path: GENERATION_PATH },
      to: {
        path: "drawio",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "no-window-coupled-modules-in-generation-path",
      severity: "error",
      comment:
        "The generation path must not import modules with top-level " +
        "window/document access (renderer PDF path, hooks, drawio " +
        "controller). Exceptions: generators/index.ts (the UI barrel for " +
        "doc-generator.ts) and pdf-helpers.ts (per the plan, explicitly " +
        "UI-only, see the \"never touched\" section) are allowed to import " +
        "the PDF renderer path — that's intentional. This rule only aims " +
        "to stop OTHER modules (in particular the CLI factory) from " +
        "importing that path directly.",
      from: {
        path: GENERATION_PATH,
        pathNot: "generators/index\\.ts$|pdf-helpers\\.ts$",
      },
      to: {
        path: KNOWN_WINDOW_COUPLED_MODULES,
        dependencyTypesNot: ["type-only"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/[^/]+",
      },
    },
  },
};
