/**\n    * Event Storming DSL Parser\n    *\n    * Supports two input formats:\n    *   1. XML-based DSL (&lt;eventstorming&gt; ... &lt;/eventstorming&gt;)\n    *   2. Text-based DSL (e.g. "actor: Customer [purple]")\n    */

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

const COLOR_MAP: Record<string, string> = {
  orange: '#FFA500',   // Domain Events (orange)
  blue: '#91D49C',     // Commands (light green)
  green: '#FEE254',    // Aggregates (yellow)
  purple: '#D4D3D3',   // Actors (gray)
  yellow: '#859EBF',   // Policies (blue)
  cyan: '#5BAA62',     // Read Models (dark green)
  pink: '#FB8597',     // External Systems (pink)
  lightgray: '#FFF1AA', // Temporary Objects / Notes (light yellow)
  red: '#8DCFF9',      // Errors (cyan)
};

/**
 * Parse raw DSL text into a structured model.
 *
 * Supports two input formats:
 *  1. XML-based DSL (&lt;eventstorming&gt; ... &lt;/eventstorming&gt;)
 *  2. Text-based DSL (e.g. "actor: Customer [purple]")
 */
export function parseDSL(text: string): DSLModel {
  // Try XML format first
  if (isEventStormingXML(text)) {
    return parseXMLDSL(text);
  }

  const model: DSLModel = {
  title: 'Event Storming',
  description: '',
  containers: [],
  nodes: [],
  links: [],
  };

  const lines = text.split('\n');
  let currentContainer: DSLContainer | null = null;

  for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

  // Metadata
  const titleMatch = line.match(/^# Title:\s*(.+)$/);
  const descMatch = line.match(/^# Description:\s*(.+)$/);
  if (titleMatch) {
   model.title = titleMatch[1].trim();
    continue;
    }
  if (descMatch) {
   model.description = descMatch[1].trim();
   continue;
   }

  // Close container block
  if (line === '}') {
   currentContainer = null;
   continue;
   }

  // ─── Container definitions (aggregate / readModel / process / entity with {) ───
  const containerMatch = line.match(/^(?:aggregate|readModel|process|entity):\s*(.+?)\s*\[(\w+)\]\s*\{/i);
  if (containerMatch) {
   const lineLower = line.toLowerCase();
   currentContainer = {
     id: normalizeId(containerMatch[1]),
     label: containerMatch[1].trim(),
     type: lineLower.startsWith('readmodel') ? 'readModel' : lineLower.startsWith('process') ? 'process' : 'aggregate',
     color: getColor(containerMatch[2]),
     nodeIds: [],
     processes: [],
     parentId: null,
     subContainers: [],
   };
   model.containers.push(currentContainer);
   continue;
   }

  // ─── Standalone aggregate / entity (no {) ───
  let lineForStandalone = line;
  let standaloneCustomIdPrefixed: string | undefined;
  const saIdMatch = line.match(/^(.+?)\s*\[id="([^"]*)"\]\s*$/i);
  if (saIdMatch) {
    lineForStandalone = saIdMatch[1];
    if (saIdMatch[2]) {
      // Prefix with "custom-" unless already prefixed to prevent ID conflicts
      standaloneCustomIdPrefixed = saIdMatch[2].startsWith('custom-') ? saIdMatch[2] : 'custom-' + saIdMatch[2];
    }
  }

  const standaloneAggregateMatch = lineForStandalone.match(/^(?:aggregate|entity):\s*(.+?)\s*\[(\w+)\]\s*$/i);
  if (standaloneAggregateMatch && !currentContainer) {
   model.nodes.push({
     id: standaloneCustomIdPrefixed ?? normalizeId(standaloneAggregateMatch[1]),
     label: standaloneAggregateMatch[1].trim(),
     type: 'aggregate',
     color: getColor(standaloneAggregateMatch[2]),
     containerId: null,
     processIndex: -1,
     noteTarget: null,
     customId: saIdMatch && saIdMatch[2] ? saIdMatch[2] : undefined,
     });
   continue;
   }

  // ─── Standalone readModel (no {) ───
  const standaloneReadModelMatch = lineForStandalone.match(/^readModel:\s*(.+?)\s*\[(\w+)\]\s*$/i);
  if (standaloneReadModelMatch && !currentContainer) {
   model.nodes.push({
     id: standaloneCustomIdPrefixed ?? normalizeId(standaloneReadModelMatch[1]),
     label: standaloneReadModelMatch[1].trim(),
     type: 'readModel',
     color: getColor(standaloneReadModelMatch[2]),
     containerId: null,
     processIndex: -1,
     noteTarget: null,
     customId: saIdMatch && saIdMatch[2] ? saIdMatch[2] : undefined,
     });
   continue;
   }

   // ─── Inside a container ───
  if (currentContainer) {
    // Named process group: process: "Name" { ... }
   const namedProcessMatch = line.match(/^process:\s*(.+?)\s*\{/i);
   if (namedProcessMatch) {
     const groupName = namedProcessMatch[1].trim();
     // Create a DSLProcess for this group
     const proc: DSLProcess = {
      name: groupName,
      stepIds: [],
      notes: [],
      };
     currentContainer.processes.push(proc);
     // We'll track nodes in this group via a marker — for simplicity, add stepIds as nodes are parsed
     // Store current process on the container (temporary)
     (currentContainer as any)._currentProcess = proc;
     continue;
      }

    // Process chain (flat): process: Actor -> Command -> Event
   const processMatch = line.match(/^process:\s*(.+)$/i);
   if (processMatch) {
     const steps = processMatch[1]
           .split('->')
           .map((s) => s.trim().replace(/^\|(.+)\|$/, '$1'))
           .filter(Boolean);
     const stepIds: string[] = [];
     for (const step of steps) {
      // Extract optional [id="..."] from step label for custom id support
      let stepCustomId: string | undefined;
      let stepLabel = step;
      const stepIdMatch = step.match(/^(.+?)\s*\[id="([^"]*)"\]\s*$/i);
      if (stepIdMatch) {
        stepLabel = stepIdMatch[1].trim();
        if (stepIdMatch[2]) {
          stepCustomId = stepIdMatch[2]; // ensureNode adds the prefix
        }
      }
      // Strip trailing [color] suffix from label (e.g. "Customer [purple]" → "Customer")
      stepLabel = stepLabel.replace(/\s+\[\w+\]\s*$/, '').trim();
      const node = ensureNode(model, stepLabel, inferProcessType(stepLabel, currentContainer.type), currentContainer.id, stepIds.length, stepCustomId);
      stepIds.push(node.id);
       }
     const proc: DSLProcess = {
      name: steps.join(' -> '),
      stepIds,
      notes: [],
      };
     currentContainer.processes.push(proc);
       // Also add links between consecutive steps, set next/altNext
     for (let j = 0; j < stepIds.length - 1; j++) {
      model.links.push({ source: stepIds[j], target: stepIds[j + 1], label: '', type: 'default' });
      // Set next on the source node
      const srcNode = model.nodes.find((n) => n.id === stepIds[j]);
      if (srcNode) srcNode.next = stepIds[j + 1];
       }
     continue;
      }

    // Element inside container (with or without [color], with optional next/altNext)
   const nodeInContainer = parseNodeLine(line, currentContainer.id, -1, null);
   if (nodeInContainer) {
     model.nodes.push(nodeInContainer);
     currentContainer.nodeIds.push(nodeInContainer.id);
     // If we're inside a named process group, add to that process
     const curProc = (currentContainer as any)._currentProcess;
     if (curProc) {
      curProc.stepIds.push(nodeInContainer.id);
      }
     continue;
      }

   continue;
   }

  // ─── Standalone node definitions (outside containers) ───
  const standalone = parseNodeLine(line, null, -1, null);
  if (standalone) {
   model.nodes.push(standalone);
   continue;
   }

  // ─── Relationships / Links (standalone) ───
  const linkMatch = line.match(/^#?(\S+)\s*->\s*(?:\|(.+?)\|)?\s*(\S+)\s*(?::\s*(\w+))?$/);
  if (linkMatch) {
   const sourceId = normalizeId(linkMatch[1]);
   const label = linkMatch[2] || '';
   const targetId = normalizeId(linkMatch[3]);
   const linkType = (linkMatch[4] || 'default') as LinkType;

   const sourceNode = model.nodes.find((n) => n.id === sourceId);
   const targetNode = model.nodes.find((n) => n.id === targetId);

   if (sourceNode && targetNode) {
     model.links.push({ source: sourceId, target: targetId, label, type: linkType });
      }
   }
  }

  // Second pass: create implicit error nodes for unmatched next/altNext references (text DSL)
  for (const node of model.nodes) {
    if (node.altNext && !model.nodes.find((n) => n.id === node.altNext)) {
      const nid = normalizeId(node.altNext);
      model.nodes.push({
        id: nid,
        label: node.altNext,
        type: 'error',
        containerId: node.containerId,
        processIndex: -1,
        color: COLOR_MAP.red,
        noteTarget: null,
        notes: [],
      });
    }
  }

  // Add implicit error nodes to their parent process stepIds so layout routes them through altNext
  for (const container of model.containers) {
    for (const node of model.nodes) {
      if (node.containerId !== container.id || node.type !== 'error') continue;
      // Check if this error node is targeted by altNext from any process node
      const owner = container.processes.flatMap((p) => p.stepIds).some((sid) => {
        const n = model.nodes.find((nn) => nn.id === sid);
        return n && n.altNext === node.id;
      });
      if (!owner) continue;
      // Add to the first process that references this implicit error node
      for (const proc of container.processes) {
        if (proc.stepIds.includes(node.id)) continue;
        const referrer = model.nodes.find((n) => proc.stepIds.includes(n.id) && n.altNext === node.id);
        if (referrer) {
          proc.stepIds.push(node.id);
          break;
        }
      }
    }
  }

 return model;
}

/**
 * Parse a single line into a node (actor, command, event, etc.).
 * Returns null if the line is not a node definition.
 * [color] is optional — uses default color when omitted.
 */
function parseNodeLine(
  line: string,
  containerId: string | null,
  processIndex: number,
  _noteTarget: string | null
): DSLNode | null {
  // Extract optional [id="..."] attribute from the end of the line (non-greedy so other brackets are preserved)
  let customId: string | undefined;
  const idMatch = line.match(/^(.+?)\s*\[id="([^"]*)"\]\s*$/i);
  if (idMatch) {
    line = idMatch[1];
    if (idMatch[2]) {
      // Store original without prefix; compute prefixed version for actual node id
      customId = idMatch[2];
    }
  }

  const nodeDefaults: Record<string, { type: NodeType; color: string }> = {
  note: { type: 'note', color: '#FFF1AA' },
  actor: { type: 'actor', color: '#D4D3D3' },
  command: { type: 'command', color: '#91D49C' },
  query: { type: 'query', color: '#5BAA62' },
  event: { type: 'event', color: '#FFA500' },
  policy: { type: 'policy', color: '#859EBF' },
  externalsystem: { type: 'externalSystem', color: '#FB8597' },
  tempobject: { type: 'tempObject', color: '#FFF1AA' },
  readmodel: { type: 'readModel', color: '#5BAA62' },
  aggregate: { type: 'aggregate', color: '#FEE254' },
  entity: { type: 'aggregate', color: '#FEE254' },
  view: { type: 'view', color: '#FEE254' },
  error: { type: 'error', color: '#8DCFF9' },
   };

  // Note (attached to a nearby element)
  const noteMatch = line.match(/^note:\s*["'](.+)["'](?:\s*->\s*(\S+))?/i);
  if (noteMatch) {
  return {
  id: normalizeId(`note_${noteMatch[1]}_${containerId || ''}`),
  label: noteMatch[1].trim(),
  type: 'note',
  color: '#FFF1AA',
  containerId,
  processIndex,
  noteTarget: noteMatch[2] ? normalizeId(noteMatch[2]) : null,
  customId,
    };
  }

  // Policy with yes/no branching: policy: Name [yes: YesNode, no: NoNode]
  const policyBranchMatch = line.match(/^policy:\s*(.+?)\s*\[\s*yes:\s*(.+?),\s*no:\s*(.+)\s*\]/i);
  if (policyBranchMatch) {
  const label = policyBranchMatch[1].trim();
  const yesNode = policyBranchMatch[2].trim();
  const noNode = policyBranchMatch[3].trim();
  // Compute actual node id with "custom-" prefix if customId is set
  let policyNodeId = customId;
  if (policyNodeId && !policyNodeId.startsWith('custom-')) {
    policyNodeId = 'custom-' + policyNodeId;
  }
  return {
  id: policyNodeId ?? normalizeId(label),
  label,
  type: 'policy',
  color: '#859EBF',
  containerId,
  processIndex,
  noteTarget: null,
  next: normalizeId(yesNode),
  altNext: normalizeId(noNode),
  notes: [],
  customId,
    };
    }

  // Generic parser: type: Name [color]   (color is optional)
  const genericMatch = line.match(/^(\w+):\s*(.+?)(?:\s*\[(\w+)\])?\s*$/i);
  if (genericMatch) {
  const typeName = genericMatch[1].toLowerCase();
  if (!nodeDefaults[typeName]) return null;

  const label = genericMatch[2].trim();
  const rawColor = genericMatch[3];
  const color = rawColor ? getColor(rawColor) : nodeDefaults[typeName].color;

  // Compute actual node id with "custom-" prefix if customId is set
  let nodeId = customId;
  if (nodeId && !nodeId.startsWith('custom-')) {
    nodeId = 'custom-' + nodeId;
  }
  return {
  id: nodeId ?? normalizeId(label),
  label,
  type: nodeDefaults[typeName].type,
  color,
  containerId,
  processIndex,
  noteTarget: null,
  notes: [],
  customId,
    };
  }

 return null;
}

/**
 * Ensure a node exists in the model (creates it if not).
 * Used inside process chains where nodes are referenced by label.
 */
function ensureNode(
  model: DSLModel,
  label: string,
  type: NodeType,
  containerId: string | null,
  processIndex: number,
  customId?: string
): DSLNode {
  // Prefix with "custom-" unless already prefixed to prevent ID conflicts
  let actualCustomId = customId;
  if (actualCustomId && !actualCustomId.startsWith('custom-')) {
    actualCustomId = 'custom-' + actualCustomId;
  }
  const id = actualCustomId ?? normalizeId(label);
  let node = model.nodes.find((n) => n.id === id && n.containerId === containerId);
  // Fallback to name-based resolution if exact id didn't match
  if (!node) {
    const canon = canonicalizeReference(label);
    node = model.nodes.find(
      (n) => !!n.label && n.containerId === containerId && canonicalizeReference(n.label!) === canon
    );
  }
  if (!node) {
  node = {
    id,
    label: label.trim(),
    type,
    color: DEFAULT_COLORS[type] || '#6a737d',
    containerId,
    processIndex,
    noteTarget: null,
    ...(customId && { customId }),
    };
  model.nodes.push(node);
  }
  node.processIndex = processIndex;
  return node;
}

/**
 * Infer node type from a process step label.
 * Defaults to: actor -> command -> event based on common naming conventions.
 */
function inferProcessType(label: string, containerType: string): NodeType {
  const l = label.toLowerCase();
  if (l.endsWith('placed') || l.endsWith('received') || l.endsWith('sent') || l.endsWith('created') || l.endsWith('cancelled') || l.endsWith('updated') || l.endsWith('deleted')) {
  return 'event';
  }
  // If we can match an existing node, use its type
  // Otherwise default to 'command' for aggregates, 'event' for read models
  return containerType === 'aggregate' ? 'command' : 'event';
}

/**
 * Default colors for each node type (used in process chains without explicit [color]).
 */
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

export function isEventStormingXML(text: string): boolean {
  return text.includes('<eventstorming') && text.includes('</eventstorming>');
}

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
          const nextId = resolveReference(rawNext, model.nodes, cId, false, scopeBoundary, boundaryNodeIds);
          node.next = nextId;
        } else if (rawNext === '') {
          node.next = null;
        }
        if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
          const altNextId = resolveReference(rawNegativeNext, model.nodes, cId, true, scopeBoundary, boundaryNodeIds);
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
      if (n.containerId === dslContainer.id || (inlineStepIds.length > 0 && n.containerId === dslContainer.id)) {
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
        const nextId = resolveReference(rawNext, model.nodes, dslContainer.id, false, dslContainer.id, inlineBoundaryNodeIds);
        node.next = nextId;
        if (nextId && !inlineStepIds.includes(nextId)) inlineStepIds.push(nextId);
      } else {
        node.next = rawNext === '' ? null : undefined;
      }
      if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
        const altNextId = resolveReference(rawNegativeNext, model.nodes, dslContainer.id, true, dslContainer.id, inlineBoundaryNodeIds);
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

// ─── Child container creation (batch: no reference resolution) ─────────────

function createChildContainerBatch(
  childEl: Element,
  parentContainer: DSLContainer,
  model: DSLModel,
  containerPrefix = '',
  scopeBoundary?: string
): void {
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

  // Compute scope boundary for reference resolution within this container.
  // Use explicit boundary if provided, otherwise walk up to find the top-level (root) container.
  let effectiveScope = scopeBoundary;
  if (!effectiveScope && parentContainer.parentId !== null) {
    const allContainers = model.containers;
    let current = parentContainer.id;
    while (current !== null) {
      const c = allContainers.find((x) => x.id === current);
      if (!c || c.parentId === null) { effectiveScope = current; break; }
      current = c.parentId;
    }
  } else if (!effectiveScope) {
    effectiveScope = parentContainer.id;
  }

  // Nodes inside this container get scoped with the incoming prefix (matching original expandXMLContainer)
  collectProcessChildren(childEl, childId, model, containerPrefix, stepIds, [], childContainer, effectiveScope);

  childContainer.nodeIds.push(...stepIds);

  // Add to parent's subContainers and top-level containers list
  parentContainer.subContainers.push(childContainer);
  model.containers.push(childContainer);
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

// ─── Collect direct process children (nodes + recurse into <container>) ──────

function collectProcessChildren(
  containerEl: Element,
  hostContainerId: string,
  model: DSLModel,
  prefix: string,
  stepIds: string[],
  _pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string }> | undefined,
  parentContainer: DSLContainer,
  resolveScopeBoundary?: string
): void {
  // Determine the resolution scope: if an explicit boundary is provided use it,
  // otherwise fall back to the current container. This allows nodes at any nesting
  // level to cross-reference siblings' children within the same scope boundary.
  const effectiveScope = resolveScopeBoundary ?? hostContainerId;

  // Collect all nodeIds under the effective scope for cross-sibling matching.
  const boundaryNodeIds: Set<string> = new Set();
  if (effectiveScope) {
    const seenContainers = new Set<string>();
    const queue: string[] = [effectiveScope];
    while (queue.length > 0) {
      const cid = queue.shift()!;
      if (seenContainers.has(cid)) continue;
      seenContainers.add(cid);
      for (const n of model.nodes) {
        if (n.containerId === cid) boundaryNodeIds.add(n.id);
      }
      for (const c of model.containers) {
        if (c.parentId === cid) queue.push(c.id);
      }
    }
  }

  // Separate child containers from inline nodes for two-phase processing.
  const childContainers: Array<{ el: Element; subPrefix: string }> = [];
  const inlineNodes: Array<{ n: DSLNode; rawNext?: string; rawNegativeNext?: string }> = [];

  for (const child of Array.from(containerEl.children)) {
    const tagLower = child.tagName.toLowerCase();

    if (tagLower === 'container') {
      const subPrefix = prefix + normalizeId(child.getAttribute('name') || '') + '_';
      childContainers.push({ el: child, subPrefix });
      continue;
    }

    const nodeType = XML_NODE_TYPES[tagLower];
    if (!nodeType) continue;
    if (tagLower === 'note' && !child.getAttribute('name')) continue;

    const n = makeXmlNode(child, nodeType, hostContainerId, prefix);
    model.nodes.push(n);
    stepIds.push(n.id);
    inlineNodes.push({ n, rawNext: child.getAttribute('next') ?? undefined, rawNegativeNext: child.getAttribute('altNext') ?? undefined });
  }

  // Phase 1: Create ALL child containers (recursively) before resolving any references.
  for (const { el, subPrefix } of childContainers) {
    createChildContainerBatch(el, parentContainer, model, subPrefix);
  }

  // Phase 2: Resolve inline node references with proper scope boundary.
  for (const { n, rawNext, rawNegativeNext } of inlineNodes) {
    if (rawNext !== undefined && rawNext !== '') {
      const nextId = resolveReference(rawNext, model.nodes, hostContainerId, false, effectiveScope, boundaryNodeIds);
      n.next = nextId;
      if (nextId && !stepIds.includes(nextId)) stepIds.push(nextId);
    } else {
      n.next = rawNext === '' ? null : undefined;
    }
    if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
      const altNextId = resolveReference(rawNegativeNext, model.nodes, hostContainerId, true, effectiveScope, boundaryNodeIds);
      n.altNext = altNextId;
      if (altNextId && !stepIds.includes(altNextId)) stepIds.push(altNextId);
    } else {
      n.altNext = rawNegativeNext === '' ? null : undefined;
    }
  }

  // Phase 3: Auto-link sequential nodes without explicit next.
  if (inlineNodes.length > 1) {
    fillImplicitNext(inlineNodes.map((i) => i.n), stepIds);
  }
}

function xmlAttrNotes(el: Element): string[] {
  const attr = el.getAttribute('notes');
  const childNotes = Array.from(el.children)
    .filter(c => ['note', 'notes'].includes(c.tagName.toLowerCase()) && !c.getAttribute('name'))
    .map(c => c.textContent?.trim() ?? '')
    .filter(Boolean);
  return attr ? [attr, ...childNotes] : childNotes;
}

function fillImplicitNext(nodes: DSLNode[], stepIds: string[], subGroups?: DSLSubGroup[]): void {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const subGroupLastIds = new Set<string>();
  if (subGroups) {
    for (const sg of subGroups) {
      if (sg.nodeIds.length > 0) subGroupLastIds.add(sg.nodeIds[sg.nodeIds.length - 1]);
    }
  }

  // Nodes already reachable via altNext belong to an alt branch, not the sibling chain.
  const altNextTargets = new Set(nodes.map((n) => n.altNext).filter((id): id is string => !!id));

  for (let i = 0; i < stepIds.length - 1; i++) {
    const node = nodeById.get(stepIds[i]);
    if (node && node.next === undefined) {
      if (subGroupLastIds.has(node.id)) continue;
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

function canonicalizeReference(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveReference(
  reference: string | undefined,
  allNodes: DSLNode[],
  scopeContainerId: string,
  createOnError: boolean = true,
  _scopeBoundary?: string,        // broader scope (e.g. parent or aggregate container id)
  boundaryNodeIds?: Set<string>   // pre-collected nodeIds under scopeBoundary for sibling matching
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
    color: COLOR_MAP.red,
    noteTarget: null,
    notes: [],
  });
  return nodeId;
}

function getColor(name: string): string {
  return COLOR_MAP[name.toLowerCase()] || '#6a737d';
}
