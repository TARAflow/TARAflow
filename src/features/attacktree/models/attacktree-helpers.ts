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
          enabled: sg.level !== "none",
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
          mitigation: (threat.proposedMitigations ?? [])
            .map((m) => m.id ?? m.notes ?? "")
            .filter(Boolean)
            .join(", "),
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
          mitigation: (threat.proposedMitigations ?? [])
            .map((m) => m.id ?? m.notes ?? "")
            .filter(Boolean)
            .join(", "),
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
 * Extract mitigation references from project.
 *
 * The Risk tab is the single source of truth for verification: each
 * Risk.selectedMitigations[] entry carries the lifecycle status (open …
 * verified) and any linked Jira/ADO ticket. We mirror that here (read-only)
 * so the attack-tree table can show verification per M-xxx without owning or
 * duplicating the state.
 *
 * Discovery order per mitigation id:
 *   1. Risk.selectedMitigations → status + ticket + resolved text (SSoT)
 *   2. Threat.proposedMitigations → text only, status stays undefined
 *      (referenced in a threat but not yet tracked in any risk)
 *
 * Undefined status = "referenced but not tracked" and the table renders it
 * as such, rather than implying it's open/unverified.
 */
export function extractMitigationReferences(
  project: Project,
): MitigationReference[] {
  // Keyed by UPPERCASE id so lookups are case-insensitive, but we keep the
  // first-seen original id casing for display.
  const byId: { [key: string]: MitigationReference } = {};
  const order: string[] = [];

  function upsert(
    rawId: string | undefined,
    patch: Partial<MitigationReference>,
  ): void {
    if (!rawId) return;
    // Ids may still arrive comma/semicolon-separated from free-text fields.
    const parts = rawId.split(/[,;]/).map(function (m) {
      return m.trim();
    });
    parts.forEach(function (mid) {
      if (!mid) return;
      const key = mid.toUpperCase();
      if (!byId[key]) {
        byId[key] = { id: mid };
        order.push(key);
      }
      const existing = byId[key];
      // Only fill fields that aren't already set — the SSoT (risks) is
      // processed first, so it wins over the threat-based fallback.
      if (
        existing.description === undefined &&
        patch.description !== undefined
      ) {
        existing.description = patch.description;
      }
      if (existing.status === undefined && patch.status !== undefined) {
        existing.status = patch.status;
      }
      if (existing.ticketId === undefined && patch.ticketId !== undefined) {
        existing.ticketId = patch.ticketId;
      }
      if (existing.ticketUrl === undefined && patch.ticketUrl !== undefined) {
        existing.ticketUrl = patch.ticketUrl;
      }
    });
  }

  // ── 1. SSoT: Risk.selectedMitigations (status + ticket + text) ────────────
  if (project.risks && project.risks.risks) {
    project.risks.risks.forEach(function (risk) {
      (risk.selectedMitigations ?? []).forEach(function (sm) {
        // Resolve display text from the risk's proposedMitigations drafts,
        // which are already populated from the threat catalog at sync time.
        const draft = (risk.proposedMitigations ?? []).find(function (d) {
          return d.id === sm.id;
        });
        const text = draft
          ? draft.isCustom
            ? draft.notes
            : draft.text
          : sm.notes;

        upsert(sm.id ?? sm.notes, {
          description: text,
          status: sm.status,
          ticketId: sm.ticketId,
          ticketUrl: sm.ticketUrl,
        });
      });
    });
  }

  // ── 2. Fallback: Threat.proposedMitigations (text only, no status) ────────
  function fromThreatTables(
    tables:
      | {
          threats: Array<{
            proposedMitigations?: Array<{
              id?: string;
              text?: string;
              notes?: string;
              isCustom?: boolean;
            }>;
          }>;
        }[]
      | undefined,
  ): void {
    if (!tables) return;
    tables.forEach(function (table) {
      table.threats.forEach(function (threat) {
        (threat.proposedMitigations ?? []).forEach(function (m) {
          const text = m.isCustom ? m.notes : m.text;
          upsert(m.id ?? m.notes, { description: text });
        });
      });
    });
  }

  if (project.threats) {
    fromThreatTables(project.threats.perElementTables);
    fromThreatTables(project.threats.perInteractionTables);
  }

  return order.map(function (key) {
    return byId[key];
  });
}
