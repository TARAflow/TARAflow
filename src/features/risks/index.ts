// ==================== RISK FEATURE EXPORTS ====================
// Public API for the Risk Assessment feature (Phase 4)

// ==================== MODELS ====================
export * from "./models/risk-types";

// ==================== SERVICES ====================
export { riskService } from "./services/risk-service";

// ==================== COMPONENTS ====================
export { RisksTab } from "./components/risks-tab";
export { RiskTableView } from "./components/risk-table-view";
export { RiskConfigDialog } from "./components/risk-config-dialog";
export { RiskMatrix } from "./components/risk-matrix";
export { WontRiskTable } from "./components/wont-risk-table";

// ==================== DEFAULT EXPORT ====================
export { RisksTab as default } from "./components/risks-tab";
