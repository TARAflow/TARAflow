// ==================== UPDATE PREVIEW ====================
// Multi-project TARA phase 5c-2: what the update dialog shows, and its
// choice turned into the update's input. Pure. The numbers the dialog shows
// come from a dry run of applyComponentUpdate with the current choice —
// the very function "Apply" runs, so preview and result cannot differ.

import { parseDfd } from "features/dfd";
import { TAKE_OVER, type ComponentUpdateChoice, type ComponentUpdateOutcome, type ComponentUpdatePreview, type UpdateChangeKind } from "features/components";
import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import type { ComponentSourceOk } from "./component-source";
import { machineElementOptions } from "./import-flow";
import { componentSourceLabel } from "./component-paths";
import { instanceLabel } from "./instance-quantity";
import { pairingCandidates, type ComponentUpdateInput, type ComponentUpdatePairing, type ComponentUpdateResult } from "./component-update";
import { snapshotDelta } from "./update-inventory";

type NewState = Pick<ComponentSourceOk, "snapshot" | "contentHash" | "source" | "methodology">;

const threatLabel = (s: ComponentSnapshot, id: string) => {
  const t = [...(s.threats?.perElementTables ?? []), ...(s.threats?.perInteractionTables ?? [])].flatMap((x) => x.threats).find((x) => x.id === id);
  return t ? `${t.strideCategory} · ${t.threatDescription || t.templateId || id}` : id;
};
const pathLabel = (s: ComponentSnapshot, key: string) => {
  const [tree, pathKey] = key.split("|");
  const name = (s.attackTrees?.trees ?? []).find((t) => t.id === tree)?.name;
  return `${name ?? tree} · ${pathKey}`;
};
const flowLabel = (s: ComponentSnapshot, id: string) => {
  const c = (s.dfd?.connections ?? []).find((x) => x.id === id);
  return c ? `${c.displayId ? `${c.displayId} ` : ""}${c.name}` : id;
};

/** The page an instance's multiprocess sits on — where its new EEs can be mapped to. */
function parentPageOf(project: Project, multiprocessTfId: string): string {
  const dfd = project.dfd;
  if (!dfd?.xml) return "";
  const parse = parseDfd(dfd.xml, dfd.pages);
  return parse.occurrences.find((o) => o.tfId === multiprocessTfId && o.role === "definition")?.pageId ?? parse.pages[0]?.pageId ?? "";
}

export function updatePreview(project: Project, importId: string, next: NewState): ComponentUpdatePreview {
  const imported = project.components!.imports.find((i) => i.id === importId)!;
  const oldSnap = imported.snapshot as ComponentSnapshot;
  const delta = snapshotDelta(oldSnap, next.snapshot);
  const instances = project.components!.instances.filter((i) => i.importId === importId);
  const changes: ComponentUpdatePreview["changes"] = (
    ["elements", "flows", "threats", "paths", "measures", "assumptions", "claims", "assets", "relations"] as UpdateChangeKind[]
  ).map((kind) => ({ kind, added: delta[kind].added.length, removed: delta[kind].removed.length }));
  const dfd = project.dfd;
  return {
    component: imported.name,
    from: componentSourceLabel(imported.source),
    to: componentSourceLabel(next.source),
    changes,
    newEes: delta.newEes.map((eeId) => ({
      eeId,
      name: (next.snapshot.dfd?.elements ?? []).find((e) => e.id === eeId)?.name ?? eeId,
      instances: instances.map((i) => ({
        instanceId: i.id,
        label: instanceLabel(i, imported.name),
        options: dfd?.xml
          ? machineElementOptions({
              xml: dfd.xml,
              pages: dfd.pages ?? [],
              pageId: parentPageOf(project, i.multiprocessTfId),
              elements: (dfd.elements ?? []) as never,
              connections: (dfd.connections ?? []) as never,
              assets: [],
            })
          : [],
      })),
    })),
    candidates: pairingCandidates(oldSnap, next.snapshot).map((c) => ({
      key: `${c.kind}|${c.from}|${c.to}`,
      kind: c.kind,
      from: c.from,
      fromLabel: c.kind === "threat" ? threatLabel(oldSnap, c.from) : c.kind === "path" ? pathLabel(oldSnap, c.from) : flowLabel(oldSnap, c.from),
      toLabel: c.kind === "threat" ? threatLabel(next.snapshot, c.to) : c.kind === "path" ? pathLabel(next.snapshot, c.to) : flowLabel(next.snapshot, c.to),
      reason: c.reason,
    })),
    ...(imported.source.tagPattern ? { tagPattern: imported.source.tagPattern } : {}),
  };
}

/** The dialog's choice as the update's input. */
export function updateInputOf(project: Project, importId: string, next: NewState, choice: ComponentUpdateChoice, updatedAt: string): ComponentUpdateInput {
  const pairing: { threats: Record<string, string>; paths: Record<string, string>; flows: Record<string, string> } = { threats: {}, paths: {}, flows: {} };
  for (const key of choice.pairs) {
    const [kind, ...rest] = key.split("|");
    // path keys contain a "|" themselves: "path|tree|pathKey|tree|pathKey"
    if (kind === "path") pairing.paths[`${rest[0]}|${rest[1]}`] = `${rest[2]}|${rest[3]}`;
    else if (kind === "threat") pairing.threats[rest[0]] = rest[1];
    else if (kind === "flow") pairing.flows[rest[0]] = rest[1];
  }
  const newEeMappings = Object.fromEntries(
    Object.entries(choice.ees).map(([instanceId, ees]) => [
      instanceId,
      Object.fromEntries(Object.entries(ees).map(([ee, target]) => [ee, target === TAKE_OVER ? undefined : target])),
    ]),
  );
  const source = choice.tagPattern ? { ...next.source, tagPattern: choice.tagPattern } : next.source;
  return { project, importId, result: { ...next, source }, pairing: pairing as ComponentUpdatePairing, newEeMappings, updatedAt };
}

/** What the dialog shows for a dry run's result. */
export function updateOutcomeOf(result: ComponentUpdateResult): ComponentUpdateOutcome {
  const dropped = new Map<string, number>();
  const tickets = new Set<string>();
  let review = 0;
  for (const s of result.instances) {
    for (const d of s.decisions) {
      if (d.outcome === "review") review++;
      if (d.outcome === "orphaned") dropped.set(d.kind, (dropped.get(d.kind) ?? 0) + 1);
      for (const t of d.ticketIds ?? []) tickets.add(t);
    }
    review += s.paired.length;
  }
  return { review, dropped: [...dropped].map(([kind, count]) => ({ kind, count })), tickets: [...tickets].sort() };
}

/** The component item a review is about, in the component's words (names, display ids — data, not UI text). */
export function reviewItemLabel(snapshot: ComponentSnapshot, kind: string, key: string): string {
  switch (kind) {
    case "relevanceOverride":
      return threatLabel(snapshot, key);
    case "riskRating":
    case "riskTreatment":
    case "conceptRiskRef": {
      const [k, a, b, c] = key.split("|");
      return k === "threat" ? threatLabel(snapshot, a) : `${pathLabel(snapshot, `${a}|${b}`)} · ${c}`;
    }
    case "pathOverlay": {
      const [tree, pathKey, leaf] = key.split("|");
      return `${pathLabel(snapshot, `${tree}|${pathKey}`)}${leaf ? ` · ${leaf}` : ""}`;
    }
    case "boundaryThreat":
      return flowLabel(snapshot, key);
    case "aouStatus":
      return (snapshot.assumptions ?? []).find((a) => a.id === key)?.displayId ?? key;
    case "citedClaim":
      return (snapshot.concept?.claims ?? []).find((c) => c.id === key)?.displayId ?? key;
    case "assetRating":
    case "a2aRelation":
    case "hazardLink": {
      const a = snapshot.assets.find((x) => x.id === key);
      return a ? `${a.displayId ? `${a.displayId} ` : ""}${a.name}` : key;
    }
    case "eeMapping":
      return (snapshot.dfd?.elements ?? []).find((e) => e.id === key)?.name ?? key;
    default:
      return key;
  }
}
