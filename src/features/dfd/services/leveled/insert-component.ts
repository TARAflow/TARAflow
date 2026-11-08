// ==================== INSERT COMPONENT INSTANCE ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §5, §6):
// puts one instance of an imported component into the machine DFD. Pure —
// XML in, XML out; the caller saves the result at once with its records
// (persistence.commitXml) and loads it into draw.io.
//
// What it builds (leveled DFD, doc/Done/DFD/leveled-dfd-multi-diagram-design.md):
//   - a multiprocess on the parent page, linked to its child page
//   - the component's pages as child pages: its top page decomposes the new
//     multiprocess, deeper pages keep their tree
//   - every component external entity (EE) becomes a context copy of the
//     machine element it is mapped to (or of a new EE on the parent page)
//   - every component flow between an EE and the component becomes a flow
//     DEFINED on the parent page (machine element ↔ multiprocess) with its
//     occurrence on the child page (context copy ↔ inner element) — endpoint
//     stitching ("deepest wins") resolves it to the inner element, so the
//     pages balance by construction
//   - the component's outer boundaries ("shells": those every part of the
//     component is inside — trust boundaries without the interfaces, which
//     sit on their border) appear around the multiprocess on the parent page
//     as ATTACHED copies (link role "ref", attached): the machine's top page
//     shows the case and the trust zone the component brings, but they stay
//     the component's — defined on its (locked) page, removed with it
//     (user 2026-11-08). Inner boundaries (e.g. a chip that not every
//     interface is on) stay on the child page only.
//   - flows between two EEs are dropped (out of scope, DFD_EE_TO_EE_FLOW)
//   - records with the component's properties for every new tfId, so the
//     save keeps them (properties travel with the record id)
//
// Identity: every component tfId becomes a deterministic tfId of the
// instance (FNV-1a of instance id + component id) — two instances never
// collide, and an update of the same instance keeps the ids. Display ids
// keep the component's with the instance prefix ("CAM1:P-3", E9); the
// multiprocess and the boundary flows are machine elements and get the
// placeholders of the shape library (MP-xx, DF-xx) for the machine's
// numbering. Assets (patch 13, E5): the component's asset mirror becomes
// instance assets (ids per instance, prefixed display ids) and the
// elements' / flows' asset relations point to them; relations to the
// component's EEs are dropped (an EE became a machine element).
//
// Known limit (design §17 I2): a component flow between an EE and a
// boundary element (e.g. a chip boundary) cannot be stitched — boundaries
// are never inside a decomposed multiprocess — and gives
// BAL_AMBIGUOUS_ENDPOINT in the machine.

import { fnv1aHex12 } from "shared/utils/fnv1a";
import type { DFDCellLink, DFDConnection, DFDElement, DFDPage } from "../../models/dfd-types";
import type { DFDAsset } from "../../models/dfd-asset-types";
import { collectCellIdentities, identityOf, type CellIdentity } from "../parsers/identity-reader";
import { pageLink, ROOT_PAGE_NAME } from "./child-pages";
import { buildDfdGraph } from "../build-dfd-graph";

export interface ComponentDfdInput {
  xml: string;
  pages?: readonly DFDPage[];
  elements: readonly DFDElement[];
  connections: readonly DFDConnection[];
  /** The DFD asset mirror (patch 13: assets per instance, E5). */
  assets?: readonly DFDAsset[];
}

export interface InsertComponentInput {
  machine: ComponentDfdInput;
  component: ComponentDfdInput;
  /** Seed of the instance's ids — stable for the life of the instance. */
  instanceId: string;
  /** Display-id prefix, e.g. "CAM1". */
  prefix: string;
  /** Page of the machine the multiprocess goes on (pageId; "" = the first page). */
  parentPageId: string;
  multiprocess: { name: string; x: number; y: number };
  /**
   * Component EE id → machine tfId on the parent page; absent / undefined =
   * take the EE over as a new external entity on the parent page (E1).
   */
  eeMapping: Readonly<Record<string, string | undefined>>;
}

export interface InsertComponentResult {
  xml: string;
  pages: DFDPage[];
  /** New records only — to be added to the machine's elements / connections / asset mirror. */
  elements: DFDElement[];
  connections: DFDConnection[];
  /** The component's assets as instance assets (ids per instance, prefixed display ids). */
  assets: DFDAsset[];
  multiprocessTfId: string;
  /** Page id of the child page of the multiprocess. */
  childPageId: string;
  /** Component tfId → machine tfId (EEs → their mapped / new machine element). */
  idMap: Record<string, string>;
}

export class InsertComponentError extends Error {}

/**
 * The machine tfId of a component element / flow in one instance —
 * deterministic, so an update keeps it and the app can recompute it (e.g.
 * the boundary flows of an instance for CMP_FLOW_NOT_IN_COMPONENT).
 */
export function componentInstanceTfId(instanceId: string, componentTfId: string): string {
  return `cmp${fnv1aHex12(`${instanceId}|${componentTfId}`)}`;
}

/** The machine id of a component asset in one instance (patch 13, E5). */
export function instanceAssetId(instanceId: string, componentAssetId: string): string {
  return componentInstanceTfId(instanceId, `asset|${componentAssetId}`);
}

/** The tfId of an instance's multiprocess. */
export function instanceMultiprocessTfId(instanceId: string): string {
  return componentInstanceTfId(instanceId, "multiprocess");
}

const MP_STYLE = "shape=ext;double=1;rounded=1;whiteSpace=wrap;html=1;arcSize=50;margin=1;strokeWidth=2;";
const EE_STYLE = "rounded=0;whiteSpace=wrap;html=1;strokeWidth=1;";
const FLOW_STYLE = "endArrow=classic;html=1;rounded=0;enumerate=0;";
const IDLABEL_STYLE = "rounded=0;html=1;strokeColor=#0000CC;fillColor=none;autosize=1;";

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new InsertComponentError("XML could not be parsed");
  }
  return doc;
}

/** An mxfile with <diagram> pages; a bare <mxGraphModel> becomes one page. */
function asMxfile(doc: Document, fallbackPageId: string): Document {
  if (doc.documentElement.tagName === "mxfile") return doc;
  if (doc.documentElement.tagName !== "mxGraphModel") {
    throw new InsertComponentError(`unexpected root <${doc.documentElement.tagName}>`);
  }
  const wrapped = parseXml(`<mxfile><diagram id="${fallbackPageId}" name="${ROOT_PAGE_NAME}"></diagram></mxfile>`);
  wrapped.getElementsByTagName("diagram")[0].appendChild(wrapped.importNode(doc.documentElement, true));
  return wrapped;
}

function diagrams(doc: Document): Element[] {
  return Array.from(doc.getElementsByTagName("diagram"));
}

function rootOf(diagram: Element): Element {
  const root = diagram.getElementsByTagName("root")[0];
  if (!root) throw new InsertComponentError(`page "${diagram.getAttribute("name")}" has no model (compressed?)`);
  return root;
}

/** The cells of a page: <object>/<UserObject> wrappers and bare <mxCell>s with an id. */
function cellsOf(root: Element): Element[] {
  return Array.from(root.children).filter((c) => !!c.getAttribute("id"));
}

/** The mxCell carrying parent / source / target / geometry of a cell element. */
function mxCellOf(cell: Element): Element {
  return cell.tagName === "mxCell" ? cell : (cell.getElementsByTagName("mxCell")[0] ?? cell);
}

const typeOf = (cell: Element) => (cell.getAttribute("type") ?? "").toLowerCase();
const isRoot = (id: string) => id === "0" || id === "1";

function idlabelOf(root: Element, cellId: string): Element | undefined {
  return cellsOf(root).find((c) => typeOf(c) === "idlabel" && mxCellOf(c).getAttribute("parent") === cellId);
}

function el(doc: Document, xml: string): Element {
  return doc.importNode(parseXml(xml).documentElement, true) as Element;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function idlabelXml(id: string, parent: string, text: string): string {
  return `<object label="${esc(text)}" type="idlabel" id="${esc(id)}"><mxCell connectable="0" parent="${esc(parent)}" style="${IDLABEL_STYLE}" vertex="1"><mxGeometry height="18.08" relative="1" width="35" as="geometry"/></mxCell></object>`;
}

const BOUNDARY_TYPES = new Set(["TrustBoundary", "PhysicalBoundary", "ChipBoundary"]);

/**
 * The component's shells: boundaries every part of the component (not its
 * EEs, not other boundaries) is inside, by the membership the analysis uses
 * (dfd graph). An interface counts for physical and chip boundaries only —
 * on a trust boundary it is the crossing point, not a member (D14).
 */
export function shellBoundaryIds(component: ComponentDfdInput): string[] {
  const members = component.elements.filter((e) => e.type !== "ExternalEntity" && !BOUNDARY_TYPES.has(e.type));
  const boundaries = component.elements.filter((e) => BOUNDARY_TYPES.has(e.type));
  if (members.length === 0 || boundaries.length === 0) return [];
  let graph: ReturnType<typeof buildDfdGraph>;
  try {
    graph = buildDfdGraph({
      xml: component.xml,
      pages: component.pages as DFDPage[] | undefined,
      elements: component.elements as DFDElement[],
      connections: component.connections as DFDConnection[],
      assets: [],
    });
  } catch {
    return [];
  }
  const membership = (type: string, id: string): readonly string[] =>
    (type === "TrustBoundary"
      ? graph.elementTrustBoundaries.get(id)
      : type === "ChipBoundary"
        ? graph.elementChipBoundaries.get(id)
        : graph.elementPhysicalBoundaries.get(id)) ?? [];
  return boundaries
    .filter((b) =>
      members.every((m) => (b.type === "TrustBoundary" && m.type === "Interface") || membership(b.type, m.id).includes(b.id)),
    )
    .map((b) => b.id);
}

/** Puts one component instance into the machine DFD (design §5, §6). */
export function insertComponentInstance(input: InsertComponentInput): InsertComponentResult {
  const { machine, component, instanceId, prefix, multiprocess, eeMapping } = input;
  const ns = (key: string) => componentInstanceTfId(instanceId, key);

  // ---- machine document and its parent page
  const machineDoc = asMxfile(parseXml(machine.xml), "page-1");
  const machineDiagrams = diagrams(machineDoc);
  if (machineDiagrams.length === 0) throw new InsertComponentError("machine DFD has no page");
  const parentDiagram = input.parentPageId
    ? machineDiagrams.find((d) => d.getAttribute("id") === input.parentPageId)
    : machineDiagrams[0];
  if (!parentDiagram) throw new InsertComponentError(`parent page ${input.parentPageId} not found`);
  const parentPageId = parentDiagram.getAttribute("id") ?? "";
  const parentRoot = rootOf(parentDiagram);

  // dfd.pages of the machine; a classic single-page project gets its root page entry
  let pages: DFDPage[] = (machine.pages ?? []).map((p) => ({ ...p }));
  if (pages.length === 0) {
    pages = [{ pageId: parentPageId, name: ROOT_PAGE_NAME, order: 0 }];
    parentDiagram.setAttribute("name", ROOT_PAGE_NAME);
  }
  const parentPage = pages.find((p) => p.pageId === parentPageId);
  if (!parentPage) throw new InsertComponentError(`parent page ${parentPageId} missing in dfd.pages`);
  const parentIdentities = collectCellIdentities(parentPage.links);
  /** Machine tfId → its cell on the parent page (definition or copy). */
  const parentCellOf = (tfId: string): Element | undefined =>
    cellsOf(parentRoot).find((c) => identityOf(parentIdentities, c.getAttribute("id") ?? "").tfId === tfId && typeOf(c) !== "idlabel");

  // ---- component pages
  const componentDoc = asMxfile(parseXml(component.xml), "component-top");
  const componentDiagrams = diagrams(componentDoc);
  const componentPages: DFDPage[] =
    component.pages && component.pages.length > 0
      ? component.pages.map((p) => ({ ...p }))
      : [{ pageId: componentDiagrams[0]?.getAttribute("id") ?? "component-top", name: ROOT_PAGE_NAME, order: 0 }];
  const componentRootPage = componentPages.find((p) => !p.decomposes);
  if (!componentRootPage) throw new InsertComponentError("component DFD has no root page");

  const eeIds = new Set(component.elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const elementById = new Map(component.elements.map((e) => [e.id, e]));
  const connectionById = new Map(component.connections.map((c) => [c.id, c]));

  // ---- ids
  const multiprocessTfId = ns("multiprocess");
  const idMap: Record<string, string> = {};
  const newElements: DFDElement[] = [];
  const parentAdditions: string[] = [];

  // EEs → machine tfId (mapped or new element on the parent page)
  let newEeIndex = 0;
  for (const eeId of eeIds) {
    const mapped = eeMapping[eeId];
    if (mapped) {
      if (!parentCellOf(mapped)) throw new InsertComponentError(`mapped element ${mapped} is not on the parent page`);
      idMap[eeId] = mapped;
      continue;
    }
    const ee = elementById.get(eeId)!;
    const tfId = ns(`ee|${eeId}`);
    idMap[eeId] = tfId;
    const x = multiprocess.x - 240;
    const y = multiprocess.y + newEeIndex++ * 90;
    parentAdditions.push(
      `<object label="${esc(ee.name)}" type="externalentity" id="${tfId}"><mxCell parent="1" style="${EE_STYLE}" vertex="1"><mxGeometry x="${x}" y="${y}" width="120" height="50" as="geometry"/></mxCell></object>`,
      idlabelXml(`${tfId}_id`, tfId, "EE-xx"),
    );
    newElements.push({
      ...ee,
      id: tfId,
      displayId: "EE-xx",
      position: { x, y },
      size: { width: 120, height: 50 },
      assetRelations: [],
    });
  }
  const mapTf = (tfId: string) => idMap[tfId] ?? (idMap[tfId] = ns(tfId));
  const shellIds = new Set(shellBoundaryIds(component));
  /** Shell tfId → its cell on the component's root page, as the component drew it. */
  const shellCells = new Map<string, Element>();

  // ---- the multiprocess on the parent page
  const childPageId = ns(`page|${componentRootPage.pageId}`);
  parentAdditions.unshift(
    `<object label="${esc(multiprocess.name)}" type="multiprocess" id="${multiprocessTfId}" link="${pageLink(childPageId)}"><mxCell parent="1" style="${MP_STYLE}" vertex="1"><mxGeometry x="${multiprocess.x}" y="${multiprocess.y}" width="160" height="60" as="geometry"/></mxCell></object>`,
    idlabelXml(`${multiprocessTfId}_id`, multiprocessTfId, "MP-xx"),
  );
  newElements.unshift({
    id: multiprocessTfId,
    displayId: "MP-xx",
    name: multiprocess.name,
    type: "Multiprocess",
    position: { x: multiprocess.x, y: multiprocess.y },
    size: { width: 160, height: 60 },
    assetRelations: [],
    properties: {} as DFDElement["properties"],
  });

  // ---- child pages
  const newPages: DFDPage[] = [];
  const boundaryFlows = new Map<string, { flowTf: string; from: string; to: string; label: string }>();
  const siblingOrder = pages.filter((p) => p.decomposes && isOnParent(p)).length;
  function isOnParent(p: DFDPage): boolean {
    return !!parentCellOf(p.decomposes ?? "");
  }

  for (const cPage of componentPages) {
    const diagram = componentDiagrams.find((d) => (d.getAttribute("id") ?? "") === cPage.pageId) ?? (cPage === componentRootPage ? componentDiagrams[0] : undefined);
    if (!diagram) throw new InsertComponentError(`component page ${cPage.pageId} not in its XML`);
    const pageId = ns(`page|${cPage.pageId}`);
    const identities = collectCellIdentities(cPage.links);
    const copy = machineDoc.importNode(diagram, true) as Element;
    copy.setAttribute("id", pageId);
    copy.setAttribute("name", cPage === componentRootPage ? multiprocess.name : (cPage.name || diagram.getAttribute("name") || ""));
    const root = rootOf(copy);
    const links: DFDCellLink[] = [];

    // new cell id per page-local cell id
    const cellIdentity = new Map<string, CellIdentity>();
    const newCellId = new Map<string, string>();
    const dropped = new Set<string>();
    for (const cell of cellsOf(root)) {
      const id = cell.getAttribute("id")!;
      if (isRoot(id)) continue;
      const identity = identityOf(identities, id);
      cellIdentity.set(id, identity);
      const type = typeOf(cell);
      if (type === "idlabel") {
        newCellId.set(id, ns(`label|${cPage.pageId}|${id}`));
        continue;
      }
      const tf = identity.tfId;
      if (eeIds.has(tf)) {
        newCellId.set(id, ns(`eecopy|${cPage.pageId}|${id}`));
        continue;
      }
      if (type === "dataflow" || mxCellOf(cell).getAttribute("edge") === "1") {
        const conn = connectionById.get(tf);
        const fromEe = conn ? eeIds.has(conn.from) : false;
        const toEe = conn ? eeIds.has(conn.to) : false;
        if (fromEe && toEe) {
          dropped.add(id);
          continue;
        }
        if (fromEe || toEe) {
          // occurrence on the child page; the definition goes on the parent page
          newCellId.set(id, ns(`occ|${cPage.pageId}|${id}`));
          const flowTf = mapTf(tf);
          if (conn && !boundaryFlows.has(flowTf)) {
            boundaryFlows.set(flowTf, {
              flowTf,
              from: fromEe ? mapTf(conn.from) : multiprocessTfId,
              to: toEe ? mapTf(conn.to) : multiprocessTfId,
              label: conn.name,
            });
          }
          continue;
        }
      }
      if (cPage === componentRootPage && identity.role === "definition" && shellIds.has(tf)) {
        // its attached copy goes around the multiprocess on the parent page
        shellCells.set(tf, cell.cloneNode(true) as Element);
      }
      newCellId.set(id, identity.role === "definition" ? mapTf(tf) : ns(`ref|${cPage.pageId}|${id}`));
    }

    // drop EE→EE flows with their labels
    for (const cell of cellsOf(root)) {
      const id = cell.getAttribute("id")!;
      const parent = mxCellOf(cell).getAttribute("parent") ?? "";
      if (dropped.has(id) || dropped.has(parent)) root.removeChild(cell);
    }

    // rewrite ids, references, labels; collect links
    const remap = (id: string | null) => (id === null || isRoot(id) ? id : (newCellId.get(id) ?? id));
    // Pass 1: ids and references first — an idlabel follows its cell in the
    // document, so labels can only be found by the new id once all are done.
    const originalIdOf = new Map<string, string>();
    for (const cell of cellsOf(root)) {
      const id = cell.getAttribute("id")!;
      if (isRoot(id)) continue;
      const mx = mxCellOf(cell);
      for (const attr of ["parent", "source", "target"]) {
        const v = mx.getAttribute(attr);
        if (v !== null) mx.setAttribute(attr, remap(v)!);
      }
      const nid = newCellId.get(id)!;
      cell.setAttribute("id", nid);
      originalIdOf.set(nid, id);
    }
    // Pass 2: copies, links, labels.
    for (const cell of cellsOf(root)) {
      const nid = cell.getAttribute("id")!;
      if (isRoot(nid)) continue;
      const id = originalIdOf.get(nid)!;
      const mx = mxCellOf(cell);
      const type = typeOf(cell);
      if (type === "idlabel") continue;
      const identity = cellIdentity.get(id)!;
      const tf = identity.tfId;

      if (eeIds.has(tf)) {
        // context copy of the machine element: its look, the EE's place
        const target = idMap[tf];
        const machineCell = parentCellOf(target) ?? parseXml(parentAdditions.find((x) => x.includes(`id="${target}"`)) ?? "<x/>").documentElement;
        cell.setAttribute("label", machineCell.getAttribute("label") ?? "");
        cell.setAttribute("type", typeOf(machineCell) || "externalentity");
        const style = mxCellOf(machineCell).getAttribute("style");
        if (style) mx.setAttribute("style", style);
        links.push({ cellId: nid, tfId: target, role: "ref" });
        const label = idlabelOf(root, nid);
        const machineLabel = idlabelOf(parentRoot, machineCell.getAttribute("id") ?? "");
        if (label) label.setAttribute("label", machineLabel?.getAttribute("label") ?? "EE-xx");
        continue;
      }
      const conn = connectionById.get(tf);
      if (conn && (eeIds.has(conn.from) || eeIds.has(conn.to))) {
        links.push({ cellId: nid, tfId: mapTf(tf), role: "ref" });
        const label = idlabelOf(root, nid);
        if (label) label.setAttribute("label", "DF-xx");
        continue;
      }
      if (identity.role === "ref") {
        links.push({ cellId: nid, tfId: mapTf(tf), role: "ref" });
      }
      if (cell.getAttribute("link")?.startsWith("data:page/id,")) {
        const target = componentPages.find((p) => `data:page/id,${p.pageId}` === cell.getAttribute("link"));
        if (target) cell.setAttribute("link", pageLink(ns(`page|${target.pageId}`)));
      }
      // the instance prefix on the display id (E9)
      const label = idlabelOf(root, nid);
      const text = label?.getAttribute("label");
      if (label && text && !text.includes(`${prefix}:`)) {
        label.setAttribute("label", prefixDisplayLabel(text, prefix));
      }
    }

    machineDoc.documentElement.appendChild(copy);
    newPages.push({
      pageId,
      name: copy.getAttribute("name") ?? "",
      decomposes: cPage === componentRootPage ? multiprocessTfId : mapTf(cPage.decomposes!),
      order: cPage === componentRootPage ? siblingOrder : cPage.order,
      ...(links.length > 0 ? { links } : {}),
    });
  }

  // ---- parent page: multiprocess, new EEs, boundary flow definitions
  for (const flow of boundaryFlows.values()) {
    const source = flow.from === multiprocessTfId ? multiprocessTfId : (parentCellOf(flow.from)?.getAttribute("id") ?? flow.from);
    const target = flow.to === multiprocessTfId ? multiprocessTfId : (parentCellOf(flow.to)?.getAttribute("id") ?? flow.to);
    parentAdditions.push(
      `<object label="${esc(flow.label)}" type="dataflow" id="${flow.flowTf}"><mxCell edge="1" parent="1" source="${esc(source)}" target="${esc(target)}" style="${FLOW_STYLE}"><mxGeometry relative="1" as="geometry"/></mxCell></object>`,
      idlabelXml(`${flow.flowTf}_id`, flow.flowTf, "DF-xx"),
    );
  }
  for (const xml of parentAdditions) parentRoot.appendChild(el(machineDoc, xml));

  // ---- the shells around the multiprocess: attached copies, outer first,
  // behind everything; their definitions stay on the component's page
  const shellLinks: DFDCellLink[] = [];
  const area = (tf: string) => {
    const e = elementById.get(tf);
    return (e?.size?.width ?? 0) * (e?.size?.height ?? 0);
  };
  const shells = [...shellCells.keys()].sort((a, b) => area(b) - area(a));
  const layerCell = cellsOf(parentRoot).find((c) => c.getAttribute("id") === "1");
  let insertAfter: Element | null = layerCell ?? null;
  shells.forEach((tf, index) => {
    const ring = shells.length - 1 - index; // 0 = innermost
    const side = 30 + 30 * ring;
    const top = 40 + 30 * ring;
    const geometry = {
      x: multiprocess.x - side,
      y: multiprocess.y - top,
      width: 160 + 2 * side,
      height: 60 + top + side,
    };
    const cell = machineDoc.importNode(shellCells.get(tf)!, true) as Element;
    const cellId = ns(`shell|${tf}`);
    cell.setAttribute("id", cellId);
    shellLinks.push({ cellId, tfId: mapTf(tf), role: "ref", attached: true });
    cell.removeAttribute("link");
    const mx = mxCellOf(cell);
    mx.setAttribute("parent", "1");
    const old = mx.getElementsByTagName("mxGeometry")[0];
    if (old) mx.removeChild(old);
    mx.appendChild(
      el(machineDoc, `<mxGeometry x="${geometry.x}" y="${geometry.y}" width="${geometry.width}" height="${geometry.height}" as="geometry"/>`),
    );
    const next: ChildNode | null = insertAfter ? insertAfter.nextSibling : parentRoot.firstChild;
    parentRoot.insertBefore(cell, next);
    insertAfter = cell;
  });

  // ---- records with the component's properties
  const prefixed = (displayId: string) => (displayId ? `${prefix}:${displayId}` : displayId);
  const assetIds = new Set((component.assets ?? []).map((a) => a.id));
  const mapAsset = (assetId: string) => instanceAssetId(instanceId, assetId);
  /** Asset relations of a record, pointing to the instance assets. */
  const remapRelations = <T extends { assetId: string }>(relations: readonly T[] | undefined): T[] =>
    (relations ?? []).filter((r) => assetIds.has(r.assetId)).map((r) => ({ ...r, assetId: mapAsset(r.assetId) }));
  // Boundaries carry their display id in their label ("… [SHE]"), not in an
  // idlabel — it stays as the component named it.
  const LABEL_IDS = BOUNDARY_TYPES;
  for (const e of component.elements) {
    if (eeIds.has(e.id)) continue;
    newElements.push({
      ...e,
      id: mapTf(e.id),
      displayId: LABEL_IDS.has(e.type) ? e.displayId : prefixed(e.displayId),
      assetRelations: remapRelations(e.assetRelations),
    });
  }
  const newConnections: DFDConnection[] = [];
  for (const c of component.connections) {
    const fromEe = eeIds.has(c.from);
    const toEe = eeIds.has(c.to);
    if (fromEe && toEe) continue;
    const boundary = fromEe || toEe;
    // from / to as the save stores them: a boundary flow's record has the
    // endpoints of its definition on the parent page (machine element ↔
    // multiprocess); the effective model resolves the inner end.
    newConnections.push({
      ...c,
      id: mapTf(c.id),
      displayId: boundary ? "DF-xx" : prefixed(c.displayId),
      from: boundary && !fromEe ? multiprocessTfId : mapTf(c.from),
      to: boundary && !toEe ? multiprocessTfId : mapTf(c.to),
      assetRelations: remapRelations(c.assetRelations),
    });
  }

  // ---- the component's assets as instance assets
  // Links only to what exists in the machine (no EEs, no dropped EE → EE flows).
  const kept = new Set([...newElements, ...newConnections].map((x) => x.id));
  const newAssets: DFDAsset[] = (component.assets ?? []).map((a) => ({
    ...a,
    id: mapAsset(a.id),
    displayId: prefixed(a.displayId),
    linkedElements: (a.linkedElements ?? [])
      .filter((l) => !eeIds.has(l.elementId) && kept.has(mapTf(l.elementId)))
      .map((l) => ({ ...l, elementId: mapTf(l.elementId), displayId: prefixed(l.displayId) })),
    // The asset-to-asset view is projected from the store (a2a mirror).
    assetRelations: undefined,
  }));

  return {
    xml: new XMLSerializer().serializeToString(machineDoc),
    pages: [
      ...pages.map((p) =>
        p.pageId === parentPageId && shellLinks.length > 0 ? { ...p, links: [...(p.links ?? []), ...shellLinks] } : p,
      ),
      ...newPages,
    ],
    elements: newElements,
    connections: newConnections,
    assets: newAssets,
    multiprocessTfId,
    childPageId,
    idMap: { ...idMap },
  };
}

/**
 * The display id inside an idlabel's text gets the instance prefix — the
 * label may be wrapped in a <font> / <span> (shape library).
 */
export function prefixDisplayLabel(text: string, prefix: string): string {
  if (/[A-Z]{1,3}-[0-9x.]+[a-z]?/.test(text)) {
    return text.replace(/([A-Z]{1,3}-[0-9x.]+[a-z]?)/, `${prefix}:$1`);
  }
  // A free display id (e.g. a boundary's "SDC"): before the first text.
  return text.replace(/(^|>)(\s*)([^<\s][^<]*)/, `$1$2${prefix}:$3`);
}
