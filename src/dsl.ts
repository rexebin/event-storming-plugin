/**\n    * Event Storming DSL Parser — XML format.\n    */

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
  subGroups?: Array<{ name: string; nodeIds: string[]; notes?: string[] }>;  // legacy: nested containers within a process
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

    // Phase 1: Collect child containers and inline process data without resolving references.
    const pendingChildren: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];
    const inlineStepIds: string[] = [];

    for (const childEl of Array.from(diagramEl.children)) {
      const tagLower = childEl.tagName.toLowerCase();
      if (tagLower === 'container') {
        // Will be processed below after all containers exist.
        continue;
      }
      if (cType !== 'process') continue;

      // Inline non-container children: create nodes but defer reference resolution.
      const name = childEl.getAttribute('name') || '';
      const nodeType = XML_NODE_TYPES[tagLower];
      if (!nodeType) continue;
      if (tagLower === 'note' && !name) continue;

      const n = makeXmlNode(childEl, nodeType, dslContainer.id, containerId + '_');
      model.nodes.push(n);
      inlineStepIds.push(n.id);
      pendingChildren.push({ node: n, rawNext: childEl.getAttribute('next') ?? undefined, rawNegativeNext: childEl.getAttribute('altNext') ?? undefined });
    }

    // Phase 1b: Create ALL nested containers as a batch (no reference resolution yet).
    const allChildContainers: Array<{ el: Element; prefix: string }> = [];
    for (const childEl of Array.from(diagramEl.children)) {
      if (childEl.tagName.toLowerCase() === 'container') {
        const childPrefix = normalizeId(childEl.getAttribute('name') || '') + '_';
        allChildContainers.push({ el: childEl, prefix: childPrefix });
      }
    }

    // Phase 1b-i: Build the entire container hierarchy tree first (all siblings visible).
    let pendingRefs: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];
    for (const { el, prefix } of allChildContainers) {
      const result = buildContainerTree(el, dslContainer, model, prefix);
      pendingRefs = pendingRefs.concat(result);
    }

    // Phase 1b-ii: Now resolve references across ALL sibling containers at once.
    if (pendingRefs.length > 0) {
      const scopeBoundary = dslContainer.id;
      // Collect all descendant nodeIds from the root container's subtree.
      const boundaryNodeIds: Set<string> = new Set();
      const seenC = new Set<string>();
      const q: string[] = [scopeBoundary];
      while (q.length > 0) {
        const cid = q.shift()!;
        if (seenC.has(cid)) continue;
        seenC.add(cid);
        for (const n of model.nodes) { if (n.containerId === cid) boundaryNodeIds.add(n.id); }
        for (const c of model.containers) { if (c.parentId === cid) q.push(c.id); }
      }

      for (const { node, rawNext, rawNegativeNext } of pendingRefs) {
        const cId = node.containerId || scopeBoundary;
        if (rawNext !== undefined && rawNext !== '') {
          const nextId = resolveReference(rawNext, model.nodes, cId, false, boundaryNodeIds);
          node.next = nextId;
        } else if (rawNext === '') {
          node.next = null;
        }
        if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
          const altNextId = resolveReference(rawNegativeNext, model.nodes, cId, true, boundaryNodeIds);
          node.altNext = altNextId;
        } else if (rawNegativeNext === '') {
          node.altNext = null;
        }
      }

      // Apply implicit next linking within each container's flow.
      const nodesByContainer = new Map<string, DSLNode[]>();
      for (const p of pendingRefs) {
        const cid = p.node.containerId || scopeBoundary;
        if (!nodesByContainer.has(cid)) nodesByContainer.set(cid, []);
        nodesByContainer.get(cid)!.push(p.node);
      }
      for (const [, nodes] of nodesByContainer) {
        if (nodes.length > 1) {
          const stepIds = nodes.map(n => n.id);
          fillImplicitNext(nodes, stepIds);
        }
      }
    }

    // Phase 2: Resolve references for inline process nodes with boundary scope.
    const inlineBoundaryNodeIds: Set<string> = new Set();
    for (const n of model.nodes) {
      if (n.containerId === dslContainer.id) {
        inlineBoundaryNodeIds.add(n.id);
      }
    }
    // Also collect from child containers created in Phase 1b.
    for (const c of model.containers) {
      if (c.parentId === dslContainer.id) {
        let queue: string[] = [c.id];
        const seen = new Set<string>();
        while (queue.length > 0) {
          const cid = queue.shift()!;
          if (seen.has(cid)) continue;
          seen.add(cid);
          for (const n of model.nodes) { if (n.containerId === cid) inlineBoundaryNodeIds.add(n.id); }
          for (const child of model.containers) { if (child.parentId === cid) queue.push(child.id); }
        }
      }
    }

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

    // Handle implicit next for inline nodes.
    if (pendingChildren.length > 0) {
      fillImplicitNext(pendingChildren.map((p) => p.node), inlineStepIds);
    }

    // Build process from inline children if any exist.
    if (inlineStepIds.length > 0) {
      dslContainer.processes.push({
        name: containerId,
        stepIds: inlineStepIds,
        notes: [],
      });
    }

    // Create a synthetic process from child container's descendant nodeIds when no inline nodes exist.
    // This maintains compatibility with layout code that expects container.processes[].stepIds.
    // Note: For containers with subContainers, skip here — ensureSyntheticProcesses (post-loop) handles it
    // with correct timing (children already have processes by then).
    if (dslContainer.processes.length === 0 && dslContainer.subContainers.length === 0) {
      const allNodeIds: string[] = [];
      if (dslContainer.nodeIds.length > 0) {
        allNodeIds.push(...dslContainer.nodeIds);
      }
      if (allNodeIds.length > 0) {
        dslContainer.processes.push({ name: containerName, stepIds: allNodeIds, notes: dslContainer.notes || [] });
      }
    }

    model.containers.push(dslContainer);
  }

  // Post-process: create synthetic processes for containers missing them.
  // Collect all descendant nodeIds for a container's subtree. Uses model.nodes filtered by
  // containerId to catch auto-created error nodes that are not stored in container.nodeIds.
  const collectDesc = (c: DSLContainer): string[] => {
    const ids: string[] = [];
    for (const n of model.nodes) {
      if (n.containerId === c.id && !ids.includes(n.id)) ids.push(n.id);
    }
    for (const p of c.processes) {
      for (const sid of p.stepIds) {
        if (!ids.includes(sid)) ids.push(sid);
      }
    }
    for (const child of c.subContainers) {
      for (const nid of collectDesc(child)) {
        if (!ids.includes(nid)) ids.push(nid);
      }
    }
    return ids;
  };

  // Build subGroups from nested containers so they render as visual dashed bboxes.
  const buildSubGroups = (children: DSLContainer[]): Array<{ name: string; nodeIds: string[]; notes?: string[] }> => {
    const result: Array<{ name: string; nodeIds: string[]; notes?: string[] }> = [];
    function add(c: DSLContainer) {
      const nodeIds = collectDesc(c);
      if (nodeIds.length > 0) result.push({ name: c.label, nodeIds, notes: c.notes });
      for (const child of c.subContainers) add(child);
    }
    for (const c of children) add(c);
    return result;
  };

  // Create synthetic processes for containers that have none yet (e.g. nested containers
  // built by buildContainerTree which defers process creation).
  function ensureSyntheticProcesses(container: DSLContainer) {
    if (container.processes.length > 0) return;

    if (container.subContainers.length > 0) {
      // One process per direct sub-container — each renders as a labelled group box.
      for (const child of container.subContainers) {
        const stepIds = collectDesc(child);
        if (stepIds.length > 0) {
          const subGroups = buildSubGroups(child.subContainers);
          container.processes.push({
            name: child.label,
            stepIds,
            notes: child.notes,
            subGroups: subGroups.length > 0 ? subGroups : undefined,
          });
        }
      }
      // Also include own direct inline nodes not belonging to any sub-container.
      const ownNodes = model.nodes.filter(n => n.containerId === container.id);
      if (ownNodes.length > 0) {
        container.processes.push({ name: container.label, stepIds: ownNodes.map(n => n.id), notes: container.notes ?? [] });
      }
    } else {
      const allNodeIds = model.nodes.filter(n => n.containerId === container.id).map(n => n.id);
      if (allNodeIds.length > 0) {
        container.processes.push({ name: container.label, stepIds: allNodeIds, notes: container.notes ?? [] });
      }
    }
  }
  for (const c of model.containers) ensureSyntheticProcesses(c);

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

    // Store raw reference strings on the node for later resolution.
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
}function xmlAttrNotes(el: Element): string[] {
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


