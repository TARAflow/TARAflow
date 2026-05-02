// ==================== STRATEGY FACTORY ====================
// Auto-detects the appropriate strategy and creates an instance.
 
import { flattenProjectTags } from "shared";
import { ClassicStrategy } from "./classic-strategy";
import { HybridStrategy } from "./hybrid-strategy";
import { RelationStrategy } from "./relation-strategy";
import type {
  ThreatProjectData,
  DFDElementReference,
  ElementTemplate,
  InteractionTemplate,
} from "../../models/threat-types";
import type { IGeneratorStrategy, StrategyType } from "../../models/strategy-types";
 
export function detectStrategy(project: ThreatProjectData): StrategyType {
  // Manual override takes precedence
  if (project.threats?.configuration?.strategyOverride) {
    return project.threats.configuration.strategyOverride;
  }
 
  const assetCoverage = computeAssetCoverage(project);
  const hasTags = hasAnyProjectTag(project);
 
  if (assetCoverage >= 1.0) return "RelationStrategy";
  if (assetCoverage > 0 || hasTags) return "HybridStrategy";
  return "ClassicStrategy";
}
 
export function createStrategy(type: StrategyType): IGeneratorStrategy {
  switch (type) {
    case "ClassicStrategy":  return new ClassicStrategy();
    case "HybridStrategy":   return new HybridStrategy();
    case "RelationStrategy": return new RelationStrategy();
    default:                 return new ClassicStrategy();
  }
}
 
/**
 * Ratio of elements with at least one asset relation.
 * 0.0 = no elements have assets
 * 1.0 = all elements have assets
 */
function computeAssetCoverage(project: ThreatProjectData): number {
  const elements = project.dfdElements ?? [];
  if (elements.length === 0) return 0;
 
  const withAssets = elements.filter(
    (e) => (e as any).assetRelations?.length > 0,
  ).length;
 
  return withAssets / elements.length;
}
 
function hasAnyProjectTag(project: ThreatProjectData): boolean {
  const tags = project.info?.tags;
  if (!tags) return false;
  return flattenProjectTags(tags).length > 0;
}