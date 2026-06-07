// features/hazards/index.ts
//
// Public surface of the Hazard feature slice. Additive: keep the existing
// hazard-data-types export (Project.hazards depends on it) and add the new
// model + service layer. The HazardsTab component export is added next step.

export * from "./models/hazard-data-types";
export * from "./models/hazard-tab-types";

export * from "./services/severity-scale-service";
export * from "./services/eligible-assets-service";
export * from "./services/hazard-relation-service";
export * from "./services/hazard-validator";
export * from "./services/hazard-service";

export { HazardsTab } from "./components/hazard-tab";
export type { HazardTabProps } from "./components/hazard-tab";
