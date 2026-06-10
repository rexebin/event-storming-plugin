/**
 * Event Storming DSL — DOM parsing and reference resolution.
 */

import type {DSLContainer, DSLModel, DSLNode, DSLSubGroup, NodeType} from './models.js';
import {normalizeId, XML_NODE_TYPES} from './models.js';

export const DEFAULT_COLORS: Record<NodeType, string> = {
  event: '#FFA500',
  command: '#91D49C',
  aggregate: '#FEE254',
  actor: '#D4D3D3',
  policy: '#859EBF',
  projector: '#5BAA62',
  externalSystem: '#FB8597',
  tempObject: '#FFF1AA',
  note: '#FFF1AA',
  query: '#5BAA62',
  view: '#FEE254',
  error: '#8DCFF9',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

// ─── Node construction ─────────────────────────────────────────────────────

export function makeXmlNode(el: Element, nodeType: NodeType, containerId: string, idPrefix: string): DSLNode {
  const name = el.getAttribute('name') || '';
  const rawIdAttr = el.getAttribute('id');
  const customIdAttr = rawIdAttr && rawIdAttr.length > 0 ? rawIdAttr : undefined;
  const autoId = idPrefix + normalizeId(name);
  let actualCustomId = customIdAttr;
  if (actualCustomId && !actualCustomId.startsWith('custom-')) {
    actualCustomId = 'custom-' + actualCustomId;
  }
  const actualId = actualCustomId ?? autoId;
  const offsetAttr = parseInt(el.getAttribute('offset') ?? '0', 10);
  return {
    id: actualId,
    label: name,
    type: nodeType,
    color: DEFAULT_COLORS[nodeType] || '#6a737d',
    containerId,
    processIndex: -1,
    parentId: undefined,
    noteX: undefined,
    noteY: undefined,
    ...(customIdAttr && { customId: customIdAttr }),
    ...(offsetAttr && { offset: offsetAttr }),
    notes: el.getAttribute('notes') ? [el.getAttribute('notes')!] : [],
  };
}

// ─── Positioned note creation ───────────────────────────────────────────────

function safeInt(attr: string | null, fallback: number): number {
  if (!attr) return fallback;
  const v = parseInt(attr, 10);
  return isNaN(v) ? fallback : v;
}

export function addPositionedNote(
  child: Element,
  dslContainer: DSLContainer,
  model: DSLModel,
  lastRegularNodeId: string,
  indexSuffix: number,
): void {
  const noteX = safeInt(child.getAttribute('x'), 0);
  const noteY = safeInt(child.getAttribute('y'), 1);
  model.nodes.push({
    id: `${lastRegularNodeId}_note_${indexSuffix}`,
    label: child.textContent?.trim() ?? '',
    type: 'note',
    color: DEFAULT_COLORS.note,
    containerId: dslContainer.id,
    processIndex: -1,
    parentId: lastRegularNodeId,
    noteX,
    noteY,
    notes: [],
  });
}

// ─── Container tree building ────────────────────────────────────────────────

export function buildContainerTree(
  childEl: Element,
  parentContainer: DSLContainer,
  model: DSLModel,
  containerPrefix = ''
): Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> {
  const childName = childEl.getAttribute('name') || '';
  const childId = normalizeId(childName);
  const childContainer: DSLContainer = {
    id: childId,
    label: childName,
    type: parentContainer.type,
    color: parentContainer.color,
    nodeIds: [],
    processes: [],
    parentId: parentContainer.id,
    subContainers: [],
    notes: childEl.getAttribute('notes') ? [childEl.getAttribute('notes')!] : [],
  };

  const stepIds: string[] = [];
  const pendingRefs: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];
  let lastRegularNodeId: string | undefined;
  let noteIndex = 0;

  for (const child of Array.from(childEl.children)) {
    const tagLower = child.tagName.toLowerCase();

    if (tagLower === 'container') {
      const subPrefix = containerPrefix + normalizeId(child.getAttribute('name') || '') + '_';
      pendingRefs.push(...buildContainerTree(child, childContainer, model, subPrefix));
      continue;
    }

    if (tagLower === 'note') {
      if (lastRegularNodeId) {
        addPositionedNote(child, childContainer, model, lastRegularNodeId, noteIndex++);
      }
      continue;
    }

    const nodeType = XML_NODE_TYPES[tagLower];
    if (!nodeType) continue;

    const n = makeXmlNode(child, nodeType, childId, containerPrefix);
    model.nodes.push(n);
    stepIds.push(n.id);
    lastRegularNodeId = n.id;

    // Process <note> children of this regular node (positioned notes attached to the element)
    for (const noteChild of Array.from(child.children)) {
      if (noteChild.tagName.toLowerCase() === 'note') {
        addPositionedNote(noteChild, childContainer, model, n.id, noteIndex++);
      }
    }

    pendingRefs.push({
      node: n,
      rawNext: child.getAttribute('next') ?? undefined,
      rawNegativeNext: child.getAttribute('altNext') ?? undefined,
    });
  }

  childContainer.nodeIds.push(...stepIds);

  parentContainer.subContainers.push(childContainer);
  model.containers.push(childContainer);

  return pendingRefs;
}

// ─── Reference resolution ──────────────────────────────────────────────────

export type PendingRef = { node: DSLNode; rawNext?: string; rawNegativeNext?: string };

function resolveReference(
  reference: string | undefined,
  allNodes: DSLNode[],
  scopeContainerId: string,
  createOnError: boolean = true,
  boundaryNodeIds?: Set<string>,
): string | null | undefined {
  if (reference === '') return null;
  if (!reference) return undefined;

  const normalizedRef = normalizeId(reference);

  // Build set of in-scope node IDs: immediate container + boundary subtree nodes.
  const scopeIds = new Set<string>();
  for (const n of allNodes) {
    if (n.containerId === scopeContainerId || (boundaryNodeIds && boundaryNodeIds.has(n.id))) {
      scopeIds.add(n.id);
    }
  }

  // 1) Direct ID match — scoped.
  const directMatch = allNodes.find(
    (n) => scopeIds.has(n.id) && (n.id === reference || n.id === 'custom-' + reference),
  );
  if (directMatch) return directMatch.id;

  // 2) Auto-generated ID match — scoped.
  const autoMatch = allNodes.find(
    (n) => scopeIds.has(n.id) && (n.id === normalizedRef || n.id.endsWith('_' + normalizedRef)),
  );
  if (autoMatch) return autoMatch.id;

  if (!createOnError) return null;

  // Fallback: create implicit error node scoped to the current container
  const nodeId = scopeContainerId + '_' + normalizedRef;
  allNodes.push({
    id: nodeId,
    label: reference,
    type: 'error',
    containerId: scopeContainerId,
    processIndex: -1,
    parentId: undefined,
    color: DEFAULT_COLORS.error,
    notes: [],
  });
  return nodeId;
}

export function resolveNodeRefs(
  pending: PendingRef[],
  model: DSLModel,
  scopeId: string,
  boundaryNodeIds: Set<string>,
): void {
  for (const { node, rawNext, rawNegativeNext } of pending) {
    const cId = node.containerId || scopeId;
    if (rawNext !== undefined && rawNext !== '') {
      node.next = resolveReference(rawNext, model.nodes, cId, false, boundaryNodeIds);
    } else {
      node.next = rawNext === '' ? null : undefined;
    }
    if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
      node.altNext = resolveReference(rawNegativeNext, model.nodes, cId, true, boundaryNodeIds);
    } else {
      node.altNext = rawNegativeNext === '' ? null : undefined;
    }
  }
}

export function applyImplicitLinking(pending: PendingRef[]): void {
  const nodesByContainer = new Map<string, DSLNode[]>();
  for (const p of pending) {
    const cid = p.node.containerId ?? '';
    if (!nodesByContainer.has(cid)) nodesByContainer.set(cid, []);
    nodesByContainer.get(cid)!.push(p.node);
  }
  for (const [, groupNodes] of nodesByContainer) {
    if (groupNodes.length > 1) fillImplicitNext(groupNodes.map(n => n.id), groupNodes);
  }
}

export function resolveInlineProcessRefs(
  pending: PendingRef[],
  model: DSLModel,
  stepIds: string[],
  scopeId: string,
  boundaryNodeIds: Set<string>,
): void {
  resolveNodeRefs(pending, model, scopeId, boundaryNodeIds);

  for (const p of pending) {
    if (p.node.next && !stepIds.includes(p.node.next)) stepIds.push(p.node.next);
    if (p.node.altNext && !stepIds.includes(p.node.altNext)) stepIds.push(p.node.altNext);
  }

  applyImplicitLinking(pending);
}

// ─── Implicit linking ──────────────────────────────────────────────────────

export function fillImplicitNext(stepIds: string[], groupNodes: DSLNode[]): void {
  const nodeById = new Map(groupNodes.map((n) => [n.id, n]));

  const altNextTargets = new Set<string>();
  for (const n of groupNodes) {
    if (n.altNext) altNextTargets.add(n.altNext);
  }

  for (let i = 0; i < stepIds.length - 1; i++) {
    const node = nodeById.get(stepIds[i]);
    if (node && node.next === undefined) {
      const candidateId = stepIds[i + 1];
      const candidate = nodeById.get(candidateId);
      if (node.type === 'policy' && candidate?.type === 'error' && candidate.id === node.altNext) {
        node.next = stepIds[i + 2];
      } else if (!altNextTargets.has(candidateId)) {
        node.next = candidateId;
      }
    }
  }
}

// ─── Subtree helpers ────────────────────────────────────────────────────────

export function collectDesc(c: DSLContainer, allNodes: DSLNode[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const add = (id: string) => { if (!seen.has(id)) { seen.add(id); ids.push(id); } };

  for (const n of allNodes) {
    if (n.containerId === c.id && n.type !== 'note') add(n.id);
  }
  for (const p of c.processes) {
    for (const sid of p.stepIds) {
      const node = allNodes.find((n) => n.id === sid);
      if (node && node.type !== 'note') add(sid);
    }
  }
  for (const child of c.subContainers) for (const nid of collectDesc(child, allNodes)) add(nid);

  return ids;
}

export function buildSubGroups(children: DSLContainer[], allNodes: DSLNode[]): DSLSubGroup[] {
  const result: DSLSubGroup[] = [];
  function add(c: DSLContainer) {
    const nodeIds = collectDesc(c, allNodes);
    if (nodeIds.length > 0) result.push({ name: c.label, nodeIds, notes: c.notes });
    for (const child of c.subContainers) add(child);
  }
  for (const c of children) add(c);
  return result;
}

// BFS over model.containers (by parentId) to collect all node IDs in a container's subtree.
export function collectSubtreeNodeIds(rootId: string, model: DSLModel): Set<string> {
  const result = new Set<string>();
  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const cid = stack.pop()!;
    if (visited.has(cid)) continue;
    visited.add(cid);
    for (const n of model.nodes) if (n.containerId === cid) result.add(n.id);
    for (const c of model.containers) if (c.parentId === cid) stack.push(c.id);
  }
  return result;
}

export function ensureSyntheticProcesses(container: DSLContainer, allNodes: DSLNode[]): void {
  if (container.processes.length > 0) return;

  if (container.subContainers.length > 0) {
    for (const child of container.subContainers) {
      const stepIds = collectDesc(child, allNodes);
      if (stepIds.length > 0) {
        const subGroups = buildSubGroups(child.subContainers, allNodes);
        container.processes.push({
          name: child.label,
          stepIds,
          notes: child.notes,
          subGroups: subGroups.length > 0 ? subGroups : undefined,
        });
      }
    }
    const ownNodes = allNodes.filter(n => n.containerId === container.id && n.type !== 'note');
    if (ownNodes.length > 0) {
      container.processes.push({ name: container.label, stepIds: ownNodes.map(n => n.id), notes: container.notes ?? [] });
    }
  } else {
    const allNodeIds = allNodes.filter(n => n.containerId === container.id && n.type !== 'note').map(n => n.id);
    if (allNodeIds.length > 0) {
      container.processes.push({ name: container.label, stepIds: allNodeIds, notes: container.notes ?? [] });
    }
  }
}
