// ==================== DIFF SERVICE ====================
// Change detection and diff generation for all TARA phases
// Compares current project state with last commit state
//
// Rework (2026-08): a phase that goes from null -> populated (or the reverse)
// is now a real, committable change. Previously every entity phase
// (assets/threats/risks/attack-trees) bailed out with an empty list when one
// side was null ("Entire phase added or deleted" -> returned nothing), so the
// very first time a phase was filled in it was invisible to the commit gate.
// The fix: never early-return on a one-sided null; treat the missing side as an
// empty collection so the existing added/deleted/modified passes emit one
// granular ChangeItem per entity — which also makes the commit message concrete
// (it lists what was added/changed/removed, not just "something changed").
//
// Asset detail was also thin: security-goal changes keyed on a non-existent
// `enabled` flag (goals express activation via `level !== "none"`), and the
// asset<->DFD relations (`linkedDFDElements`, the asset-side mirror of a flow's
// `assetRelations`) were not compared at all. Both are covered now.

import type { Project } from "app";
import type {
  PhaseChanges,
  ChangeItem,
  ChangeDetail,
  CommitMessageData,
} from "../models/audit-types";
import type { AssetData, Asset } from "features/assets";
import type { DFDData } from "features/dfd";
import type { ThreatData, Threat } from "features/threats";
import type { RiskData, Risk } from "features/risks";
import type { AttackTreeData, AttackTree } from "features/attacktree";

// ==================== DIFF SERVICE ====================

export class DiffService {
  /**
   * Detect all changes between current and previous project state
   */
  detectChanges(
    currentProject: Project,
    previousProject: Project | null,
  ): PhaseChanges[] {
    const changes: PhaseChanges[] = [];

    // DFD Changes
    const dfdChanges = this.compareDFD(
      currentProject.dfd,
      previousProject?.dfd ?? null,
    );
    if (dfdChanges.length > 0) {
      changes.push({
        phase: "dfd",
        phaseLabel: "DFD",
        changeCount: dfdChanges.length,
        changes: dfdChanges,
      });
    }

    // Asset Changes
    const assetChanges = this.compareAssets(
      currentProject.assets,
      previousProject?.assets ?? null,
    );
    if (assetChanges.length > 0) {
      changes.push({
        phase: "assets",
        phaseLabel: "Assets",
        changeCount: assetChanges.length,
        changes: assetChanges,
      });
    }

    // Threat Changes
    const threatChanges = this.compareThreats(
      currentProject.threats,
      previousProject?.threats ?? null,
    );
    if (threatChanges.length > 0) {
      changes.push({
        phase: "threats",
        phaseLabel: "Threats",
        changeCount: threatChanges.length,
        changes: threatChanges,
      });
    }

    // Risk Changes
    const riskChanges = this.compareRisks(
      currentProject.risks,
      previousProject?.risks ?? null,
    );
    if (riskChanges.length > 0) {
      changes.push({
        phase: "risks",
        phaseLabel: "Risks",
        changeCount: riskChanges.length,
        changes: riskChanges,
      });
    }

    // Attack Tree Changes
    const attackTreeChanges = this.compareAttackTrees(
      currentProject.attackTrees,
      previousProject?.attackTrees ?? null,
    );
    if (attackTreeChanges.length > 0) {
      changes.push({
        phase: "attacktrees",
        phaseLabel: "Attack Trees",
        changeCount: attackTreeChanges.length,
        changes: attackTreeChanges,
      });
    }

    return changes;
  }

  /**
   * Generate commit message data from changes
   */
  generateCommitMessageData(
    changes: PhaseChanges[],
    roundName: string,
    author: string,
    opts?: { reviewer?: string; projectName?: string; projectId?: string },
  ): CommitMessageData {
    const totalChanges = changes.reduce((sum, p) => sum + p.changeCount, 0);
    return {
      round: roundName,
      projectName: opts?.projectName,
      projectId: opts?.projectId,
      batchSize: totalChanges,
      affectedPhases: changes.map((p) => p.phaseLabel),
      changes,
      author,
      reviewer: opts?.reviewer,
    };
  }

  // ==================== DFD COMPARISON ====================

  private compareDFD(
    current: DFDData | null,
    previous: DFDData | null,
  ): ChangeItem[] {
    const changes: ChangeItem[] = [];

    if (!current && !previous) return changes;

    // New DFD created
    if (current && !previous) {
      changes.push({
        type: "added",
        id: "DFD",
        name: "Data Flow Diagram",
        description: "DFD created",
        details: [
          {
            field: "elements",
            fieldLabel: "Elements",
            oldValue: 0,
            newValue: current.elements.length,
            valueType: "number",
          },
          {
            field: "connections",
            fieldLabel: "Data Flows",
            oldValue: 0,
            newValue: current.connections.length,
            valueType: "number",
          },
        ],
      });
      return changes;
    }

    // DFD deleted
    if (!current && previous) {
      changes.push({
        type: "deleted",
        id: "DFD",
        name: "Data Flow Diagram",
        description: "DFD deleted",
      });
      return changes;
    }

    // DFD modified
    if (current && previous) {
      const details: ChangeDetail[] = [];

      // Check element count
      if (current.elements.length !== previous.elements.length) {
        details.push({
          field: "elements",
          fieldLabel: "Elements",
          oldValue: previous.elements.length,
          newValue: current.elements.length,
          valueType: "number",
        });
      }

      // Check connection count
      if (current.connections.length !== previous.connections.length) {
        details.push({
          field: "connections",
          fieldLabel: "Data Flows",
          oldValue: previous.connections.length,
          newValue: current.connections.length,
          valueType: "number",
        });
      }

      // Check XML changes
      if (current.xml !== previous.xml) {
        details.push({
          field: "diagram",
          fieldLabel: "Diagram Structure",
          oldValue: "Modified",
          newValue: "Modified",
          valueType: "string",
        });
      }

      if (details.length > 0) {
        changes.push({
          type: "modified",
          id: "DFD",
          name: "Data Flow Diagram",
          description: "DFD modified",
          details,
        });
      }
    }

    return changes;
  }

  // ==================== ASSET COMPARISON ====================

  private compareAssets(
    current: AssetData | null,
    previous: AssetData | null,
  ): ChangeItem[] {
    const changes: ChangeItem[] = [];

    if (!current && !previous) return changes;

    // A one-sided null is a real change: the whole phase was added (previous
    // null) or removed (current null). Treat the missing side as empty so the
    // added/deleted passes below emit one granular item per asset — instead of
    // the old silent early-return that made a first population uncommittable.
    const currentAssets = new Map(
      (current?.assets ?? []).map((a) => [a.id, a]),
    );
    const previousAssets = new Map(
      (previous?.assets ?? []).map((a) => [a.id, a]),
    );

    // Find added assets
    Array.from(currentAssets.entries()).forEach(([id, asset]) => {
      if (!previousAssets.has(id)) {
        const linkCount = asset.linkedDFDElements?.length ?? 0;
        const details: ChangeDetail[] = [
          {
            field: "overallImpact",
            fieldLabel: "Overall Impact",
            oldValue: 0,
            newValue: asset.overallImpact,
            valueType: "number",
          },
        ];
        // Report the asset<->DFD relations the new asset carries, so the commit
        // message states that relations were added (not just the bare asset).
        if (linkCount > 0) {
          details.push({
            field: "linkedDFDElements",
            fieldLabel: "Linked DFD Elements",
            oldValue: 0,
            newValue: linkCount,
            valueType: "number",
          });
        }
        changes.push({
          type: "added",
          id: asset.id,
          name: asset.name || asset.id,
          description: `Asset added: ${asset.properties?.description || "No description"}`,
          details,
        });
      }
    });

    // Find deleted assets
    Array.from(previousAssets.entries()).forEach(([id, asset]) => {
      if (!currentAssets.has(id)) {
        changes.push({
          type: "deleted",
          id: asset.id,
          name: asset.name || asset.id,
          description: `Asset deleted: ${asset.properties?.description || "No description"}`,
        });
      }
    });

    // Find modified assets
    Array.from(currentAssets.entries()).forEach(([id, currentAsset]) => {
      const previousAsset = previousAssets.get(id);
      if (!previousAsset) return;

      const details = this.compareAssetDetails(currentAsset, previousAsset);
      if (details.length > 0) {
        changes.push({
          type: "modified",
          id: currentAsset.id,
          name: currentAsset.name || currentAsset.id,
          description: `Asset modified: ${details.length} field(s) changed`,
          details,
        });
      }
    });

    return changes;
  }

  private compareAssetDetails(current: Asset, previous: Asset): ChangeDetail[] {
    const details: ChangeDetail[] = [];

    // Name
    if (current.name !== previous.name) {
      details.push({
        field: "name",
        fieldLabel: "Name",
        oldValue: previous.name,
        newValue: current.name,
        valueType: "string",
      });
    }

    // Description
    if (current.properties?.description !== previous.properties?.description) {
      details.push({
        field: "description",
        fieldLabel: "Description",
        oldValue: previous.properties?.description,
        newValue: current.properties?.description,
        valueType: "string",
      });
    }

    // Protection need (protection-relevant, distinct from the impact ratings)
    if (current.properties?.protectionNeed !== previous.properties?.protectionNeed) {
      details.push({
        field: "protectionNeed",
        fieldLabel: "Protection Need",
        oldValue: previous.properties?.protectionNeed,
        newValue: current.properties?.protectionNeed,
        valueType: "string",
      });
    }

    // Overall Impact
    if (current.overallImpact !== previous.overallImpact) {
      details.push({
        field: "overallImpact",
        fieldLabel: "Overall Impact",
        oldValue: previous.overallImpact,
        newValue: current.overallImpact,
        valueType: "number",
      });
    }

    // Impact Ratings (per-criterion value changes)
    const impactChanges = this.compareImpactRatings(
      current.impactRatings ?? [],
      previous.impactRatings ?? [],
    );
    if (impactChanges.length > 0) {
      details.push({
        field: "impactRatings",
        fieldLabel: "Impact Ratings",
        oldValue: impactChanges
          .map((c) => `${c.fieldLabel}:${c.oldValue}`)
          .join(", "),
        newValue: impactChanges
          .map((c) => `${c.fieldLabel}:${c.newValue}`)
          .join(", "),
        valueType: "string",
      });
    }

    // Security Goals (level and/or formal-description changes per goal type).
    // NOTE: goals express "active" via `level !== "none"`, NOT an `enabled`
    // flag — the previous implementation counted a field that never exists, so
    // security-goal changes were never detected.
    const goalChanges = this.compareSecurityGoals(
      current.securityGoals ?? [],
      previous.securityGoals ?? [],
    );
    if (goalChanges.length > 0) {
      details.push({
        field: "securityGoals",
        fieldLabel: "Security Goals",
        oldValue: goalChanges.map((g) => `${g.type}:${g.from}`).join(", "),
        newValue: goalChanges.map((g) => `${g.type}:${g.to}`).join(", "),
        valueType: "string",
      });
    }

    // Linked DFD elements = the asset side of an asset<->DFD relation (mirror of
    // a flow's `assetRelations`). Comparing here means adding/removing a link on
    // an existing asset is a committable change on its own.
    const link = this.compareLinkedElements(
      current.linkedDFDElements,
      previous.linkedDFDElements,
    );
    if (link.added > 0 || link.removed > 0) {
      details.push({
        field: "linkedDFDElements",
        fieldLabel: "Linked DFD Elements",
        oldValue: previous.linkedDFDElements?.length ?? 0,
        newValue: current.linkedDFDElements?.length ?? 0,
        valueType: "number",
      });
    }

    return details;
  }

  private compareImpactRatings(
    current: any[],
    previous: any[],
  ): ChangeDetail[] {
    const changes: ChangeDetail[] = [];
    // Normalise missing/undefined to null so an absent criterion and an
    // explicit null don't read as a change.
    const norm = (v: any) => (v === undefined ? null : v);
    const currentMap = new Map(
      current.map((r) => [r.criterionId, norm(r.value)]),
    );
    const previousMap = new Map(
      previous.map((r) => [r.criterionId, norm(r.value)]),
    );

    const criterionIds = new Set([
      ...Array.from(currentMap.keys()),
      ...Array.from(previousMap.keys()),
    ]);

    for (const criterionId of Array.from(criterionIds)) {
      const currentValue = norm(currentMap.get(criterionId));
      const previousValue = norm(previousMap.get(criterionId));
      if (previousValue !== currentValue) {
        changes.push({
          field: `rating_${criterionId}`,
          fieldLabel: String(criterionId),
          oldValue: previousValue,
          newValue: currentValue,
          valueType: "number",
        });
      }
    }

    return changes;
  }

  private compareSecurityGoals(
    current: any[],
    previous: any[],
  ): { type: string; from: string; to: string }[] {
    const changed: { type: string; from: string; to: string }[] = [];
    const cur = new Map((current ?? []).map((g) => [g.type, g]));
    const prev = new Map((previous ?? []).map((g) => [g.type, g]));

    const types = new Set([
      ...Array.from(cur.keys()),
      ...Array.from(prev.keys()),
    ]);

    for (const type of Array.from(types)) {
      const c = cur.get(type);
      const p = prev.get(type);
      const cLevel: string = c?.level ?? "none";
      const pLevel: string = p?.level ?? "none";
      const cDesc: string = c?.formalDescription ?? "";
      const pDesc: string = p?.formalDescription ?? "";
      if (cLevel !== pLevel || cDesc !== pDesc) {
        changed.push({ type: String(type), from: pLevel, to: cLevel });
      }
    }

    return changed;
  }

  private compareLinkedElements(
    current: any[] | undefined,
    previous: any[] | undefined,
  ): { added: number; removed: number } {
    // Identity of a link = which DFD element + what relation. elementName /
    // displayId are display fields and must not drive the diff.
    const key = (l: any) => `${l.elementId}:${l.relationType}`;
    const cur = new Set((current ?? []).map(key));
    const prev = new Set((previous ?? []).map(key));
    let added = 0;
    let removed = 0;
    cur.forEach((k) => {
      if (!prev.has(k)) added++;
    });
    prev.forEach((k) => {
      if (!cur.has(k)) removed++;
    });
    return { added, removed };
  }

  // ==================== THREAT COMPARISON ====================

  private compareThreats(
    current: ThreatData | null,
    previous: ThreatData | null,
  ): ChangeItem[] {
    const changes: ChangeItem[] = [];

    if (!current && !previous) return changes;

    // One-sided null = whole phase added/removed; treat the missing side as an
    // empty threat set so first generation is committable.
    const currentThreats = current ? this.getActiveThreats(current) : [];
    const previousThreats = previous ? this.getActiveThreats(previous) : [];

    const currentMap = new Map(currentThreats.map((t) => [t.id, t]));
    const previousMap = new Map(previousThreats.map((t) => [t.id, t]));

    // Added threats
    Array.from(currentMap.entries()).forEach(([id, threat]) => {
      if (!previousMap.has(id)) {
        changes.push({
          type: "added",
          id: threat.id,
          name: `${threat.displayId} (${threat.strideCategory})`,
          description: threat.threatDescription,
        });
      }
    });

    // Deleted threats
    Array.from(previousMap.entries()).forEach(([id, threat]) => {
      if (!currentMap.has(id)) {
        changes.push({
          type: "deleted",
          id: threat.id,
          name: `${threat.displayId} (${threat.strideCategory})`,
          description: threat.threatDescription,
        });
      }
    });

    // Modified threats
    Array.from(currentMap.entries()).forEach(([id, currentThreat]) => {
      const previousThreat = previousMap.get(id);
      if (!previousThreat) return;

      const details = this.compareThreatDetails(currentThreat, previousThreat);
      if (details.length > 0) {
        changes.push({
          type: "modified",
          id: currentThreat.id,
          name: `${currentThreat.id} (${currentThreat.strideCategory})`,
          description: `Threat modified: ${details.length} field(s) changed`,
          details,
        });
      }
    });

    return changes;
  }

  private getActiveThreats(threatData: ThreatData): Threat[] {
    const method = threatData.configuration.activeMethod;
    const tables =
      method === "per-element"
        ? threatData.perElementTables
        : threatData.perInteractionTables;
    return tables.flatMap((table) => table.threats);
  }

  private compareThreatDetails(
    current: Threat,
    previous: Threat,
  ): ChangeDetail[] {
    const details: ChangeDetail[] = [];

    if (current.threatDescription !== previous.threatDescription) {
      details.push({
        field: "threatDescription",
        fieldLabel: "Threat Description",
        oldValue: previous.threatDescription,
        newValue: current.threatDescription,
        valueType: "string",
      });
    }

    if (current.attackDescription !== previous.attackDescription) {
      details.push({
        field: "attackDescription",
        fieldLabel: "Attack Description",
        oldValue: previous.attackDescription,
        newValue: current.attackDescription,
        valueType: "string",
      });
    }

    const prevMit = JSON.stringify(previous.proposedMitigations ?? []);
    const currMit = JSON.stringify(current.proposedMitigations ?? []);
    if (currMit !== prevMit) {
      details.push({
        field: "proposedMitigations",
        fieldLabel: "Mitigations",
        oldValue: prevMit,
        newValue: currMit,
        valueType: "string",
      });
    }

    const prevVer = JSON.stringify(previous.proposedVerifications ?? []);
    const currVer = JSON.stringify(current.proposedVerifications ?? []);
    if (currVer !== prevVer) {
      details.push({
        field: "proposedVerifications",
        fieldLabel: "Verifications",
        oldValue: prevVer,
        newValue: currVer,
        valueType: "string",
      });
    }

    return details;
  }

  // ==================== RISK COMPARISON ====================

  private compareRisks(
    current: RiskData | null,
    previous: RiskData | null,
  ): ChangeItem[] {
    const changes: ChangeItem[] = [];

    if (!current && !previous) return changes;

    const currentMap = new Map((current?.risks ?? []).map((r) => [r.id, r]));
    const previousMap = new Map((previous?.risks ?? []).map((r) => [r.id, r]));

    // Added risks
    Array.from(currentMap.entries()).forEach(([id, risk]) => {
      if (!previousMap.has(id)) {
        changes.push({
          type: "added",
          id: risk.id,
          name: `${risk.id} (${risk.strideCategory})`,
          description: risk.threatDescription,
        });
      }
    });

    // Deleted risks
    Array.from(previousMap.entries()).forEach(([id, risk]) => {
      if (!currentMap.has(id)) {
        changes.push({
          type: "deleted",
          id: risk.id,
          name: `${risk.id} (${risk.strideCategory})`,
          description: risk.threatDescription,
        });
      }
    });

    // Modified risks
    Array.from(currentMap.entries()).forEach(([id, currentRisk]) => {
      const previousRisk = previousMap.get(id);
      if (!previousRisk) return;

      const details = this.compareRiskDetails(currentRisk, previousRisk);
      if (details.length > 0) {
        changes.push({
          type: "modified",
          id: currentRisk.id,
          name: `${currentRisk.id} (${currentRisk.strideCategory})`,
          description: `Risk modified: ${details.length} field(s) changed`,
          details,
        });
      }
    });

    return changes;
  }

  private compareRiskDetails(current: Risk, previous: Risk): ChangeDetail[] {
    const details: ChangeDetail[] = [];

    if (
      current.calculatedRiskBeforeMitigation !==
      previous.calculatedRiskBeforeMitigation
    ) {
      details.push({
        field: "calculatedRiskBeforeMitigation",
        fieldLabel: "Risk Before Mitigation",
        oldValue: previous.calculatedRiskBeforeMitigation,
        newValue: current.calculatedRiskBeforeMitigation,
        valueType: "number",
      });
    }

    if (
      current.calculatedRiskAfterMitigation !==
      previous.calculatedRiskAfterMitigation
    ) {
      details.push({
        field: "calculatedRiskAfterMitigation",
        fieldLabel: "Risk After Mitigation",
        oldValue: previous.calculatedRiskAfterMitigation,
        newValue: current.calculatedRiskAfterMitigation,
        valueType: "number",
      });
    }

    if (current.moscowPriority !== previous.moscowPriority) {
      details.push({
        field: "moscowPriority",
        fieldLabel: "MoSCoW Priority",
        oldValue: previous.moscowPriority,
        newValue: current.moscowPriority,
        valueType: "string",
      });
    }

    // Implementation status is derived — compare selectedMitigations instead
    const prevImpl =
      current.selectedMitigations.length !==
        previous.selectedMitigations.length ||
      current.selectedMitigations.some(
        (m, i) => m.status !== previous.selectedMitigations[i]?.status,
      );
    if (prevImpl) {
      details.push({
        field: "selectedMitigations",
        fieldLabel: "Mitigations",
        oldValue: previous.selectedMitigations
          .map((m) => `${m.id ?? "custom"}:${m.status}`)
          .join(", "),
        newValue: current.selectedMitigations
          .map((m) => `${m.id ?? "custom"}:${m.status}`)
          .join(", "),
        valueType: "string",
      });
    }

    return details;
  }

  // ==================== ATTACK TREE COMPARISON ====================

  private compareAttackTrees(
    current: AttackTreeData | null,
    previous: AttackTreeData | null,
  ): ChangeItem[] {
    const changes: ChangeItem[] = [];

    if (!current && !previous) return changes;

    const currentMap = new Map((current?.trees ?? []).map((t) => [t.id, t]));
    const previousMap = new Map((previous?.trees ?? []).map((t) => [t.id, t]));

    // Added trees
    Array.from(currentMap.entries()).forEach(([id, tree]) => {
      if (!previousMap.has(id)) {
        changes.push({
          type: "added",
          id: tree.id,
          name: tree.name,
          description: `Attack tree added: ${tree.description || "No description"}`,
        });
      }
    });

    // Deleted trees
    Array.from(previousMap.entries()).forEach(([id, tree]) => {
      if (!currentMap.has(id)) {
        changes.push({
          type: "deleted",
          id: tree.id,
          name: tree.name,
          description: `Attack tree deleted`,
        });
      }
    });

    // Modified trees
    Array.from(currentMap.entries()).forEach(([id, currentTree]) => {
      const previousTree = previousMap.get(id);
      if (!previousTree) return;

      const details = this.compareAttackTreeDetails(currentTree, previousTree);
      if (details.length > 0) {
        changes.push({
          type: "modified",
          id: currentTree.id,
          name: currentTree.name,
          description: `Attack tree modified: ${details.length} field(s) changed`,
          details,
        });
      }
    });

    return changes;
  }

  private compareAttackTreeDetails(
    current: AttackTree,
    previous: AttackTree,
  ): ChangeDetail[] {
    const details: ChangeDetail[] = [];

    if (current.name !== previous.name) {
      details.push({
        field: "name",
        fieldLabel: "Name",
        oldValue: previous.name,
        newValue: current.name,
        valueType: "string",
      });
    }

    if (current.dsl !== previous.dsl) {
      details.push({
        field: "dsl",
        fieldLabel: "DSL Content",
        oldValue: "Modified",
        newValue: "Modified",
        valueType: "string",
      });
    }

    return details;
  }
}

// ==================== SINGLETON INSTANCE ====================

export const diffService = new DiffService();