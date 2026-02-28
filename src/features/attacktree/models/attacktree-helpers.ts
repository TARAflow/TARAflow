// ==================== ATTACK TREE HELPERS ====================
// Helper functions for extracting references in main-layout.tsx
// These are used to map Project data to AttackTreeProjectData

import type { Project } from "app/models/project-types";
import type {
  AssetReference,
  ThreatReference,
  RiskReference,
  DFDElementReference,
  MitigationReference,
} from "./attacktree-types";

/**
 * Extract asset references from project
 */
export function extractAssetReferences(project: Project): AssetReference[] {
  if (!project.assets || !project.assets.assets) {
    return [];
  }

  return project.assets.assets.map(function(asset) {
    return {
      id: asset.id,
      name: asset.name,
      securityGoals: asset.securityGoals.map(function(sg) {
        return {
          type: sg.type,
          enabled: sg.enabled,
        };
      }),
      overallImpact: asset.overallImpact,
    };
  });
}

/**
 * Extract threat references from project
 */
export function extractThreatReferencesForAttackTree(project: Project): ThreatReference[] {
  if (!project.threats) {
    return [];
  }

  const threats: ThreatReference[] = [];

  // From per-element tables
  if (project.threats.perElementTables) {
    project.threats.perElementTables.forEach(function(table) {
      table.threats.forEach(function(threat) {
        threats.push({
          id: threat.id,
          strideCategory: threat.strideCategory,
          threatDescription: threat.threatDescription || "",
          mitigation: threat.mitigation,
          linkedAssetIds: threat.linkedAssetIds,
        });
      });
    });
  }

  // From per-interaction tables
  if (project.threats.perInteractionTables) {
    project.threats.perInteractionTables.forEach(function(table) {
      table.threats.forEach(function(threat) {
        threats.push({
          id: threat.id,
          strideCategory: threat.strideCategory,
          threatDescription: threat.threatDescription || "",
          mitigation: threat.mitigation,
          linkedAssetIds: threat.linkedAssetIds,
        });
      });
    });
  }

  return threats;
}

/**
 * Extract risk references from project
 */
export function extractRiskReferences(project: Project): RiskReference[] {
  if (!project.risks || !project.risks.risks) {
    return [];
  }

  return project.risks.risks.map(function(risk) {
    return {
      id: risk.id,
      threatId: risk.threatId,
      calculatedRiskBeforeMitigation: risk.calculatedRiskBeforeMitigation,
      moscowPriority: risk.moscowPriority,
    };
  });
}

/**
 * Extract DFD element references from project
 */
export function extractDFDElementReferences(project: Project): DFDElementReference[] {
  const elements: DFDElementReference[] = [];

  // Extract from DFD elements
  if (project.dfd && project.dfd.elements) {
    project.dfd.elements.forEach(function(elem) {
      elements.push({
        id: elem.displayId || elem.id,
        type: elem.type,
        name: elem.name || elem.displayId || elem.id,
      });
    });
  }

  // Extract from DFD connections (DataFlows)
  if (project.dfd && project.dfd.connections) {
    project.dfd.connections.forEach(function(conn) {
      if (conn.displayId) {
        elements.push({
          id: conn.displayId,
          type: "DataFlow",
          name: conn.name || conn.displayId,
        });
      }
    });
  }

  return elements;
}

/**
 * Extract mitigation references from project
 */
export function extractMitigationReferences(project: Project): MitigationReference[] {
  const mitigationSet: { [key: string]: boolean } = {};
  const mitigations: MitigationReference[] = [];

  function extractFromMitigation(mitigation: string | undefined): void {
    if (!mitigation) return;

    // Mitigations may be comma-separated
    var parts = mitigation.split(/[,;]/).map(function(m) { return m.trim(); });
    parts.forEach(function(mid) {
      if (mid && !mitigationSet[mid.toUpperCase()]) {
        mitigationSet[mid.toUpperCase()] = true;
        mitigations.push({
          id: mid,
          description: undefined,
        });
      }
    });
  }

  // Extract from threats
  if (project.threats) {
    if (project.threats.perElementTables) {
      project.threats.perElementTables.forEach(function(table) {
        table.threats.forEach(function(threat) {
          extractFromMitigation(threat.mitigation);
        });
      });
    }

    if (project.threats.perInteractionTables) {
      project.threats.perInteractionTables.forEach(function(table) {
        table.threats.forEach(function(threat) {
          extractFromMitigation(threat.mitigation);
        });
      });
    }
  }

  return mitigations;
}

// ==================== USAGE EXAMPLE FOR main-layout.tsx ====================
/*

import {
  extractAssetReferences,
  extractThreatReferencesForAttackTree,
  extractRiskReferences,
  extractDFDElementReferences,
  extractMitigationReferences,
} from "features/attacktree/models/attacktree-helpers";

// In the render section:
{activePhase === 5 && activeProject && (
  <AttackTreeTab
    project={{
      id: activeProject.id,
      name: activeProject.info?.name || "",
      phaseStatus: activeProject.phaseStatus,
      isHighImpact: activeProject.info?.isHighImpact || false,
      attackTrees: activeProject.attackTrees ?? null,
      assets: extractAssetReferences(activeProject),
      threats: extractThreatReferencesForAttackTree(activeProject),
      risks: extractRiskReferences(activeProject),
      dfdElements: extractDFDElementReferences(activeProject),
      mitigations: extractMitigationReferences(activeProject),
      dfdPreviewImage: activeProject.dfd?.thumbnail,
      lastModified: activeProject.info?.lastModified || "",
    }}
    onUpdate={handleAttackTreeUpdate}
    onPhaseComplete={() => setActivePhase(6)}
  />
)}

// Handler function:
const handleAttackTreeUpdate = useCallback((updates: AttackTreeUpdateResult) => {
  if (!activeProject) return;
  
  updateProject(activeProject.id, {
    attackTrees: updates.attackTrees,
    phaseStatus: updates.phaseStatus,
    info: {
      ...activeProject.info,
      lastModified: updates.lastModified,
    },
  });
}, [activeProject, updateProject]);

*/