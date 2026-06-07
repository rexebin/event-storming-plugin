/**\n    * Event Storming DSL Parser\n    *\n    * Supports two input formats:\n    *   1. XML-based DSL (&lt;eventstorming&gt; ... &lt;/eventstorming&gt;)\n    *   2. Text-based DSL (e.g. "actor: Customer [purple]")\n    */

export interface DSLNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  containerId: string | null; // immediate parent container id
  rootContainerId: string | null; // hard boundary scope (the containing <container>'s scope)
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
  nodeIds: string[];         // ids of nodes inside this container
  processes: DSLProcess[];    // groups/processes inside the container
  notes?: string[];           // container-level notes
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
  subGroups?: DSLSubGroup[];  // nested sub-containers rendered as inline boxes
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
      };
   model.containers.push(currentContainer);
   continue;
   }

  // ─── Standalone aggregate / entity (no {) ───
  let lineForStandalone = line;
  let standaloneCustomId: string | undefined;
  const saIdMatch = line.match(/^(.+?)\s*\[id="([^"]*)"\]\s*$/i);
  if (saIdMatch) {
    lineForStandalone = saIdMatch[1];
    if (saIdMatch[2]) {
      standaloneCustomId = saIdMatch[2];
    }
  }

  const standaloneAggregateMatch = lineForStandalone.match(/^(?:aggregate|entity):\s*(.+?)\s*\[(\w+)\]\s*$/i);
  if (standaloneAggregateMatch && !currentContainer) {
   model.nodes.push({
     id: standaloneCustomId ?? normalizeId(standaloneAggregateMatch[1]),
     label: standaloneAggregateMatch[1].trim(),
     type: 'aggregate',
     color: getColor(standaloneAggregateMatch[2]),
     containerId: null,
     rootContainerId: null,
     processIndex: -1,
     noteTarget: null,
     customId: standaloneCustomId,
     });
   continue;
   }

  // ─── Standalone readModel (no {) ───
  const standaloneReadModelMatch = lineForStandalone.match(/^readModel:\s*(.+?)\s*\[(\w+)\]\s*$/i);
  if (standaloneReadModelMatch && !currentContainer) {
   model.nodes.push({
     id: standaloneCustomId ?? normalizeId(standaloneReadModelMatch[1]),
     label: standaloneReadModelMatch[1].trim(),
     type: 'readModel',
     color: getColor(standaloneReadModelMatch[2]),
     containerId: null,
     rootContainerId: null,
     processIndex: -1,
     noteTarget: null,
     customId: standaloneCustomId,
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
          stepCustomId = stepIdMatch[2];
        }
      }
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
        rootContainerId: node.rootContainerId,
        processIndex: -1,
        color: COLOR_MAP.red,
        noteTarget: null,
        notes: [],
      });
    }
    if (node.next && !model.nodes.find((n) => n.id === node.next)) {
      const nid = normalizeId(node.next);
      model.nodes.push({
        id: nid,
        label: node.next,
        type: 'error',
        containerId: node.containerId,
        rootContainerId: node.rootContainerId,
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
  rootContainerId: containerId,
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
  return {
  id: normalizeId(label),
  label,
  type: 'policy',
  color: '#859EBF',
  containerId,
  rootContainerId: containerId,
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

  return {
  id: customId ?? normalizeId(label),
  label,
  type: nodeDefaults[typeName].type,
  color,
  containerId,
  rootContainerId: containerId,
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
  const id = customId ?? normalizeId(label);
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
    rootContainerId: containerId,
    processIndex,
    noteTarget: null,
    customId: customId ?? undefined,
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
      notes: xmlAttrNotes(diagramEl),
    };

    for (const containerEl of Array.from(diagramEl.children)) {
      const childTag = containerEl.tagName.toLowerCase();
      if (childTag === 'container') {
        expandXMLContainer(containerEl, dslContainer, model, normalizeId(containerEl.getAttribute('name') || '') + '_');
      } else if (cType === 'process') {
        // Top-level process containers have flow nodes as direct children
        const stepIds: string[] = [];
        const subGroups: DSLSubGroup[] = [];
        const aliases = new Map<string, string>();
        const pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }> = [];
        collectXMLChildren(diagramEl, dslContainer, model, containerId + '_', aliases, stepIds, subGroups, pending, model.nodes);

        for (const { node, rawNext, rawNegativeNext } of pending) {
          if (rawNext !== undefined && rawNext !== '') {
            const nextId = resolveReference(rawNext, containerId + '_', model.nodes, node.rootContainerId);
            node.next = nextId;
            if (nextId && !stepIds.includes(nextId)) stepIds.push(nextId);
          } else {
            node.next = rawNext === '' ? null : undefined;
          }
          if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
            const altNextId = resolveReference(rawNegativeNext, containerId + '_', model.nodes, node.rootContainerId);
            node.altNext = altNextId;
            if (altNextId && !stepIds.includes(altNextId)) stepIds.push(altNextId);
          } else {
            node.altNext = rawNegativeNext === '' ? null : undefined;
          }
        }

        dslContainer.processes.push({
          name: containerEl.getAttribute('name') || '',
          stepIds,
          notes: xmlAttrNotes(containerEl),
          subGroups: subGroups.length > 0 ? subGroups : undefined,
        });
      }
    }

    model.containers.push(dslContainer);
  }

  return model;
}

function expandXMLContainer(
  containerEl: Element,
  dslContainer: DSLContainer,
  model: DSLModel,
  prefix: string,
  _parentAliases?: Map<string, string>
): void {
  const stepIds: string[] = [];
  const subGroups: DSLSubGroup[] = [];
  const aliases = new Map<string, string>();
  const pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }> = [];

  // Compute the local scope id for this container so nodes inside get the right rootContainerId
  const subName = containerEl.getAttribute('name') || '';
  const localScopeId = dslContainer.id + '_' + normalizeId(subName);

  collectXMLChildren(containerEl, dslContainer, model, prefix, aliases, stepIds, subGroups, pending, model.nodes, localScopeId);

  // Second pass: resolve references (after all aliases are registered)
  for (const { node, rawNext, rawNegativeNext } of pending) {
    if (rawNext !== undefined && rawNext !== '') {
      const nextId = resolveReference(rawNext, prefix, model.nodes, node.rootContainerId);
      node.next = nextId;
      if (nextId && !stepIds.includes(nextId)) stepIds.push(nextId);
    } else {
      node.next = rawNext === '' ? null : undefined;
    }
    if (rawNegativeNext !== undefined && rawNegativeNext !== '') {
      const altNextId = resolveReference(rawNegativeNext, prefix, model.nodes, node.rootContainerId);
      node.altNext = altNextId;
      if (altNextId && !stepIds.includes(altNextId)) stepIds.push(altNextId);
    } else {
      node.altNext = rawNegativeNext === '' ? null : undefined;
    }
  }

  fillImplicitNext(pending.map((p) => p.node), stepIds, subGroups);

  dslContainer.processes.push({
    name: containerEl.getAttribute('name') || '',
    stepIds,
    notes: xmlAttrNotes(containerEl),
    subGroups: subGroups.length > 0 ? subGroups : undefined,
  });
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

function findOrCreateSubDSLContainer(childEl: Element, parentDslContainer: DSLContainer, model: DSLModel): DSLContainer {
  const subName = childEl.getAttribute('name') || '';
  const subId = normalizeId(subName);
  // Check if a container with this id already exists (shouldn't normally happen)
  let existing = model.containers.find((c) => c.id === parentDslContainer.id + '_' + subId);
  if (existing) return existing;
  const sub: DSLContainer = {
    id: parentDslContainer.id + '_' + subId,
    label: subName,
    type: parentDslContainer.type,
    color: parentDslContainer.color,
    nodeIds: [],
    processes: [],
  };
  model.containers.push(sub);
  return sub;
}

function collectXMLChildren(
  containerEl: Element,
  dslContainer: DSLContainer,
  model: DSLModel,
  prefix: string,
  aliases: Map<string, string>,
  stepIds: string[],
  subGroups: DSLSubGroup[],
  pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }>,
  allNodes?: DSLNode[],
  rootScope?: string
): void {
  for (const child of Array.from(containerEl.children)) {
    const tagLower = child.tagName.toLowerCase();

    if (tagLower === 'container') {
      const subDslContainer = findOrCreateSubDSLContainer(child, dslContainer, model);
      const subPrefix = prefix + normalizeId(subDslContainer.label) + '_';
      const subStepIds: string[] = [];
      // Each container is its own scope boundary — nodes inside get the container's own id as rootScope
      collectXMLChildren(child, subDslContainer, model, subPrefix, aliases, subStepIds, subGroups, pending, allNodes, subDslContainer.id);
      for (const id of subStepIds) stepIds.push(id);
      subGroups.push({ name: subDslContainer.label, nodeIds: subStepIds, notes: xmlAttrNotes(child) });
    } else {
      const nodeType = XML_NODE_TYPES[tagLower];
      if (!nodeType) continue;

      // <note> without a name attribute is notes text, not a flow node
      if (tagLower === 'note' && !child.getAttribute('name')) continue;

      const name = child.getAttribute('name') || '';
      const rawIdAttr = child.getAttribute('id');
      const customIdAttr = (rawIdAttr && rawIdAttr.length > 0) ? rawIdAttr : undefined;
      const autoId = prefix + normalizeId(name);
      // Use id (actual node id) consistently for aliases and stepIds
      const id = customIdAttr ?? autoId;

      const offsetAttr = child.getAttribute('offset');
      const offset = offsetAttr !== null ? parseInt(offsetAttr, 10) : undefined;

      aliases.set(canonicalizeReference(name), id);
      dslContainer.nodeIds.push(id);
      stepIds.push(id);

      const n: DSLNode = {
        id,
        label: name,
        type: nodeType,
        color: DEFAULT_COLORS[nodeType] || '#6a737d',
        containerId: dslContainer.id,
        rootContainerId: rootScope ?? dslContainer.id,
        processIndex: -1,
        noteTarget: null,
        customId: customIdAttr ?? undefined,
        next: undefined,
        altNext: undefined,
        altNextText: child.getAttribute('altNext') ?? undefined,
        notes: xmlAttrNotes(child),
        offset,
      };
      model.nodes.push(n);
      pending.push({ node: n, rawNext: child.getAttribute('next') ?? undefined, rawNegativeNext: child.getAttribute('altNext') ?? undefined, nodePrefix: prefix });
    }
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
  prefix: string,
  allNodes: DSLNode[],
  rootContainerId: string | null = null
): string | null | undefined {
  if (reference === '') return null; // explicitly no next
  if (!reference) return undefined;
  const canon = canonicalizeReference(reference);

  // 1) Direct ID / customId match — scoped to same root container only (hard boundary)
  const directMatch = rootContainerId
    ? allNodes.find((n) => n.rootContainerId === rootContainerId && (n.id === reference || (!!n.customId && canonicalizeReference(n.customId!) === canon)))
    : null;
  if (directMatch) return directMatch.id;

  // 2) Name-based lookup — scoped to same root container only
  const matches = rootContainerId
    ? allNodes.filter(
        (n) => !!n.label && n.rootContainerId === rootContainerId && canonicalizeReference(n.label!) === canon
      )
    : [];
  if (matches.length >= 1) return matches[0].id;
  // Fallback: create implicit error node scoped to the current root container
  const nodeId = prefix + normalizeId(reference);
  allNodes.push({
    id: nodeId,
    label: reference,
    type: 'error',
    containerId: rootContainerId,
    rootContainerId: rootContainerId,
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
