// utils/depcruise-features.cjs
//
// Feature independence (roadmap-to-1.0.md rule 3.4, 0.20): a feature must not
// import another feature. Logic several features need goes to src/shared/,
// wiring that reads several features' data to the app layer (src/app/).
//
// The violations of 0.20 are listed in utils/depcruise-features-baseline.json
// (generated, not hand-written) and tolerated with --ignore-known; every new
// one fails CI. The baseline only shrinks: the old violations are removed
// from 0.21 on, and depcruise-features-baseline.test.ts pins its size so a
// regenerated baseline cannot swallow new ones.
//
// Type-only imports count as well: they couple the features' models just as
// much (the app layer or shared/ is the place for a shared type).
//
// Usage:
//   npm run depcruise:features             # the CI check
//   npm run depcruise:features:baseline    # regenerate the baseline (only after removing violations)

module.exports = {
  forbidden: [
    {
      name: "no-feature-to-feature",
      severity: "error",
      comment:
        "A feature must not import another feature — shared logic belongs in " +
        "src/shared/, cross-feature wiring in the app layer (src/app/). " +
        "See doc/InProgress/Release/roadmap-to-1.0.md rule 3.4.",
      from: { path: "^src/features/([^/]+)/" },
      to: {
        path: "^src/features/([^/]+)/",
        pathNot: "^src/features/$1/",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^src/tests/" },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
