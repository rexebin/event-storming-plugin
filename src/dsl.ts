/**
 * Event Storming DSL Parser — XML format.
 */

export interface DSLNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  containerId: string | null; // immediate parent container id (scope boundary for reference resolution)
  processIndex: number; // index within a process chain (-1 if standalone)
  noteTarget: string | null; // if type='note', the node it's attached to
  customId?: string; // optional user-provided id (differs from auto-generated id when set)
  next?: string | null; // next node id; null = explicitly no next (from next="")
  altNext?: string | null; // negative next node id (for policy no-path, rendered below)
  altNextText?: string; // original text of altNext (for auto-generated error node label)
  notes?: string[]; // attached notes for this node
  offset?: number; // additional column shift to avoid collisions (each unit = NODE_W + NODE_GAP_X)
}

export interface DSLLink {
  source: string;
  target: string;
  label: string;
  type: LinkType;
}

export interface DSLContainer {
  id: string;
  label: string;
  type: 'aggregate' | 'readModel' | 'process' | 'externalSystem';
  color: string;
  nodeIds: string[];           // ids of nodes inside this container
  processes: DSLProcess[];     // groups/processes inside this container
  parentId: string | null;     // parent container id (null for top-level)
  subContainers: DSLContainer[];  // nested child containers
  notes?: string[];            // container-level notes
}

export interface DSLSubGroup {
  name: string;
  nodeIds: string[];
  notes?: string[];
}

export interface DSLProcess {
  name: string;              // process group name
  stepIds: string[];        // ordered list of node ids in the flow
  notes?: string[];          // process-level notes
  subGroups?: DSLSubGroup[];  // nested containers within a process
}

export interface DSLModel {
  title: string;
  description: string;
  containers: DSLContainer[];
  nodes: DSLNode[];
  links: DSLLink[];
}

export type NodeType =
  | 'event'
  | 'command'
  | 'aggregate'
  | 'actor'
  | 'policy'
  | 'readModel'
  | 'externalSystem'
  | 'tempObject'
  | 'note'
  | 'query'
  | 'view'
  | 'error';

export type LinkType =
  | 'event'
  | 'command'
  | 'default'
  | 'uses'
  | 'affects'
  | 'creates'
  | 'results'
  | 'sends'
  | 'triggers';

/**
 * Parse raw XML-based DSL text into a structured model.
 */
export function parseDSL(text: string): DSLModel {
  if (!isEventStormingXML(text)) return { title: 'Event Storming', description: '', containers: [], nodes: [], links: [] };
  return parseXMLDSL(text);
}

const XML_NODE_TYPES: Record<string, NodeType> = {
  actor: 'actor',
  command: 'command',
  event: 'event',
  policy: 'policy',
  query: 'query',
  externalsystem: 'externalSystem',
  readmodel: 'readModel',
  error: 'error',
  note: 'note',
  aggregate: 'aggregate',
};

export function isEventStormingXML(text: string): boolean {
  return text.includes('<eventstorming') && text.includes('</eventstorming>');
}

const DEFAULT_COLORS: Record<NodeType, string> = {
  event: '#FFA500',
  command: '#91D49C',
  aggregate: '#FEE254',
  actor: '#D4D3D3',
  policy: '#859EBF',
  readModel: '#5BAA62',
  externalSystem: '#FB8597',
  tempObject: '#FFF1AA',
  note: '#FFF1AA',
  query: '#5BAA62',
  view: '#FEE254',
  error: '#8DCFF9',
};

const XML_CONTAINER_TYPES: Record<string, 'aggregate' | 'readModel' | 'process' | 'externalSystem'> = {
  aggregate: 'aggregate',
  externalsystem: 'externalSystem',
  projector: 'readModel',
  readmodel: 'readModel',
  process: 'process',
};

const CONTAINER_COLORS: Record<string, string> = {
  aggregate: '#FEE254',
  readModel: '#5BAA62',
  externalSystem: '#FB8597',
  process: '#859EBF',
};

// idPrefix must include any trailing separator (e.g. 'container_id_' or 'child_prefix_').
// customId is stored raw (unprefixed); id is stored with 'custom-' prefix when customId is set.
function makeXmlNode(el: Element, nodeType: NodeType, containerId: string, idPrefix: string): DSLNode {
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
    noteTarget: null,
    ...(customIdAttr && { customId: customIdAttr }),
    ...(offsetAttr && { offset: offsetAttr }),
    notes: xmlAttrNotes(el),
  };
}

function parseXMLDSL(text: string): DSLModel {
  const model: DSLModel = {
    title: 'Event Storming',
    description: '',
    containers: [],
    nodes: [],
    links: [],
  };

  const start = text.indexOf('<eventstorming');
  const end = text.lastIndexOf('</eventstorming>') + '</eventstorming>'.length;
  const xml = text.slice(start, end);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  if (root.tagName !== 'eventstorming' || root.querySelector('parsererror')) return model;

  for (const diagramEl of Array.from(root.children)) {
    const tagLower = diagramEl.tagName.toLowerCase();
    const cType = XML_CONTAINER_TYPES[tagLower];
    if (!cType) continue;

    const containerName = diagramEl.getAttribute('name') || diagramEl.tagName;
    const containerId = normalizeId(containerName);
    const dslContainer: DSLContainer = {
      id: containerId,
      label: containerName,
      type: cType,
      color: CONTAINER_COLORS[cType],
      nodeIds: [],
      processes: [],
      parentId: null,
      subContainers: [],
      notes: xmlAttrNotes(diagramEl),
    };

    // Phase 1 & 1b: Single pass — collect inline process nodes and nested container elements.
    const pendingChildren: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];
    const inlineStepIds: string[] = [];
    const allChildContainers: Array<{ el: Element; prefix: string }> = [];

    for (const childEl of Array.from(diagramEl.children)) {
      const tagLower = childEl.tagName.toLowerCase();
      if (tagLower === 'container') {
        const childPrefix = normalizeId(childEl.getAttribute('name') || '') + '_';
        allChildContainers.push({ el: childEl, prefix: childPrefix });
        continue;
      }
      if (cType !== 'process') continue;

      const name = childEl.getAttribute('name') || '';
      const nodeType = XML_NODE_TYPES[tagLower];
      if (!nodeType) continue;
      if (tagLower === 'note' && !name) continue;

      const n = makeXmlNode(childEl, nodeType, dslContainer.id, containerId + '_');
      model.nodes.push(n);
      inlineStepIds.push(n.id);
      pendingChildren.push({ node: n, rawNext: childEl.getAttribute('next') ?? undefined, rawNegativeNext: childEl.getAttribute('altNext') ?? undefined });
    }

    let pendingRefs: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];
    for (const { el, prefix } of allChildContainers) {
      const result = buildContainerTree(el, dslContainer, model, prefix);
      pendingRefs = pendingRefs.concat(result);
    }

    // Phase 1b-ii: Resolve references across all sibling containers within scope.
    if (pendingRefs.length > 0) {
      const boundaryNodeIds = collectSubtreeNodeIds(dslContainer.id, model);

      for (const { node, rawNext, rawNegativeNext } of pendingRefs) {
        const cId = node.containerId || dslContainer.id;
        if (rawNext !== undefined && rawNext !== '') {
          node.next = resolveReference(rawNext, model.nodes, cId, false, boundaryNodeIds);
        } else if (rawNext === '') {
          node.next = null;
        }
        if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
          node.altNext = resolveReference(rawNegativeNext, model.nodes, cId, true, boundaryNodeIds);
        } else if (rawNegativeNext === '') {
          node.altNext = null;
        }
      }

      // Apply implicit next linking within each container's flow.
      const nodesByContainer = new Map<string, DSLNode[]>();
      for (const p of pendingRefs) {
        const cid = p.node.containerId || dslContainer.id;
        if (!nodesByContainer.has(cid)) nodesByContainer.set(cid, []);
        nodesByContainer.get(cid)!.push(p.node);
      }
      for (const [, nodes] of nodesByContainer) {
        if (nodes.length > 1) {
          fillImplicitNext(nodes, nodes.map(n => n.id));
        }
      }
    }

    // Phase 2: Resolve references for inline process nodes.
    const inlineBoundaryNodeIds = collectSubtreeNodeIds(dslContainer.id, model);

    for (const { node, rawNext, rawNegativeNext } of pendingChildren) {
      if (rawNext !== undefined && rawNext !== '') {
        const nextId = resolveReference(rawNext, model.nodes, dslContainer.id, false, inlineBoundaryNodeIds);
        node.next = nextId;
        if (nextId && !inlineStepIds.includes(nextId)) inlineStepIds.push(nextId);
      } else {
        node.next = rawNext === '' ? null : undefined;
      }
      if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
        const altNextId = resolveReference(rawNegativeNext, model.nodes, dslContainer.id, true, inlineBoundaryNodeIds);
        node.altNext = altNextId;
        if (altNextId && !inlineStepIds.includes(altNextId)) inlineStepIds.push(altNextId);
      } else {
        node.altNext = rawNegativeNext === '' ? null : undefined;
      }
    }

    if (pendingChildren.length > 0) {
      fillImplicitNext(pendingChildren.map((p) => p.node), inlineStepIds);
    }

    if (inlineStepIds.length > 0) {
      dslContainer.processes.push({
        name: containerId,
        stepIds: inlineStepIds,
        notes: [],
      });
    }

    if (dslContainer.processes.length === 0 && dslContainer.subContainers.length === 0 && dslContainer.nodeIds.length > 0) {
      dslContainer.processes.push({ name: containerName, stepIds: dslContainer.nodeIds, notes: dslContainer.notes || [] });
    }

    model.containers.push(dslContainer);
  }

  for (const c of model.containers) ensureSyntheticProcesses(c, model.nodes);

  return model;
}

// ─── Build container hierarchy tree (no reference resolution) ──────────────

function buildContainerTree(
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
    notes: xmlAttrNotes(childEl),
  };

  const stepIds: string[] = [];
  const pendingRefs: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];

  for (const child of Array.from(childEl.children)) {
    const tagLower = child.tagName.toLowerCase();

    if (tagLower === 'container') {
      const subPrefix = containerPrefix + normalizeId(child.getAttribute('name') || '') + '_';
      pendingRefs.push(...buildContainerTree(child, childContainer, model, subPrefix));
      continue;
    }

    const nodeType = XML_NODE_TYPES[tagLower];
    if (!nodeType) continue;
    if (tagLower === 'note' && !child.getAttribute('name')) continue;

    const n = makeXmlNode(child, nodeType, childId, containerPrefix);
    model.nodes.push(n);
    stepIds.push(n.id);

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

function xmlAttrNotes(el: Element): string[] {
  const attr = el.getAttribute('notes');
  const childNotes = Array.from(el.children)
    .filter(c => ['note', 'notes'].includes(c.tagName.toLowerCase()) && !c.getAttribute('name'))
    .map(c => c.textContent?.trim() ?? '')
    .filter(Boolean);
  return attr ? [attr, ...childNotes] : childNotes;
}

function fillImplicitNext(nodes: DSLNode[], stepIds: string[]): void {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Nodes already reachable via altNext belong to an alt branch, not the sibling chain.
  const altNextTargets = new Set(nodes.map((n) => n.altNext).filter((id): id is string => !!id));

  for (let i = 0; i < stepIds.length - 1; i++) {
    const node = nodeById.get(stepIds[i]);
    if (node && node.next === undefined) {
      const candidateId = stepIds[i + 1];
      const candidate = nodeById.get(candidateId);
      if (node.type === 'policy' && candidate?.type === 'error' && candidate.id === node.altNext) {
        // Policy: skip over its own adjacent inline error to assign the positive branch
        node.next = stepIds[i + 2];
      } else if (!altNextTargets.has(candidateId)) {
        node.next = candidateId;
      }
      // else: candidate is already reachable via altNext — leave it to the alt branch
    }
  }
}

export function normalizeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '_');
}

function resolveReference(
  reference: string | undefined,
  allNodes: DSLNode[],
  scopeContainerId: string,
  createOnError: boolean = true,
  boundaryNodeIds?: Set<string>   // pre-collected nodeIds for cross-sibling matching within scope
): string | null | undefined {
  if (reference === '') return null; // explicitly no next
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
    color: DEFAULT_COLORS.error,
    noteTarget: null,
    notes: [],
  });
  return nodeId;
}

// BFS over model.containers (by parentId) to collect all node IDs in a container's subtree.
// Stays scoped to the subtree because child containers have parentId pointing into it.
function collectSubtreeNodeIds(rootId: string, model: DSLModel): Set<string> {
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

// Ordered dedup collection of all node IDs in a container's subtree (including error nodes
// added by resolveReference, and process stepIds). Used to build synthetic process stepIds.
function collectDesc(c: DSLContainer, allNodes: DSLNode[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  const add = (id: string) => { if (!seen.has(id)) { seen.add(id); ids.push(id); } };

  for (const n of allNodes) if (n.containerId === c.id) add(n.id);
  for (const p of c.processes) for (const sid of p.stepIds) add(sid);
  for (const child of c.subContainers) for (const nid of collectDesc(child, allNodes)) add(nid);

  return ids;
}

// Build subGroup descriptors from nested containers so they render as labelled dashed bboxes.
function buildSubGroups(children: DSLContainer[], allNodes: DSLNode[]): DSLSubGroup[] {
  const result: DSLSubGroup[] = [];
  function add(c: DSLContainer) {
    const nodeIds = collectDesc(c, allNodes);
    if (nodeIds.length > 0) result.push({ name: c.label, nodeIds, notes: c.notes });
    for (const child of c.subContainers) add(child);
  }
  for (const c of children) add(c);
  return result;
}

// Ensure every container has at least one process so the layout engine has stepIds to render.
// Called after all containers are built; containers with sub-containers get one process per child.
function ensureSyntheticProcesses(container: DSLContainer, allNodes: DSLNode[]): void {
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
    const ownNodes = allNodes.filter(n => n.containerId === container.id);
    if (ownNodes.length > 0) {
      container.processes.push({ name: container.label, stepIds: ownNodes.map(n => n.id), notes: container.notes ?? [] });
    }
  } else {
    const allNodeIds = allNodes.filter(n => n.containerId === container.id).map(n => n.id);
    if (allNodeIds.length > 0) {
      container.processes.push({ name: container.label, stepIds: allNodeIds, notes: container.notes ?? [] });
    }
  }
}
