// ==================== STRATEGY FACTORY ====================
// Creates the UnifiedStrategy instance.
// detectStrategy() and computeAssetCoverage() removed — no longer needed.
// forceClassicMode is passed directly via ThreatConfiguration.

import { UnifiedStrategy } from "./unified-strategy";
import type { IGeneratorStrategy } from "../../models/strategy-types";

export function createStrategy(): IGeneratorStrategy {
  return new UnifiedStrategy();
}