/**
 * Event Storming DSL Parser
 *
 * ─── DSL Syntax ───────────────────────────────────────────
 */

export interface DSLNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  containerId: string | null; // parent container id (aggregate/readModel/process)
  processIndex: number; // index within a process chain (-1 if standalone)
  noteTarget: string | null; // if type='note', the node it's attached to
  next?: string; // next node id (for explicit flow, especially policy yes-path)
  negativeNext?: string; // negative next node id (for policy no-path, rendered below)
  negativeNextText?: string; // original text of negativeNext (for auto-generated error node label)
  notes?: string[]; // attached notes for this node
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
 * Supports three input formats:
 *  1. XML-based DSL (<eventstorming> ... </eventstorming>)
 *  2. JSON array of containers (from dsl-type.ts spec)
 *  3. Text-based DSL (e.g. "actor: Customer [purple]")
 */
export function parseDSL(text: string): DSLModel {
  // Try XML format first
  if (isEventStormingXML(text)) {
    return parseXMLDSL(text);
  }

 // Try JSON format (dsl-type.ts spec)
 const trimmed = text.trim();
 if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
   try {
     const parsed = JSON.parse(trimmed);
     if (isEventStormingJSONValue(parsed)) {
       return parseJSONDSL(parsed);
     }
   } catch {
     // Fall through to text-based parser
   }
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
  const standaloneAggregateMatch = line.match(/^(?:aggregate|entity):\s*(.+?)\s*\[(\w+)\]\s*$/i);
  if (standaloneAggregateMatch && !currentContainer) {
   model.nodes.push({
     id: normalizeId(standaloneAggregateMatch[1]),
     label: standaloneAggregateMatch[1].trim(),
     type: 'aggregate',
     color: getColor(standaloneAggregateMatch[2]),
     containerId: null,
     processIndex: -1,
     noteTarget: null,
     });
   continue;
   }

  // ─── Standalone readModel (no {) ───
  const standaloneReadModelMatch = line.match(/^readModel:\s*(.+?)\s*\[(\w+)\]\s*$/i);
  if (standaloneReadModelMatch && !currentContainer) {
   model.nodes.push({
     id: normalizeId(standaloneReadModelMatch[1]),
     label: standaloneReadModelMatch[1].trim(),
     type: 'readModel',
     color: getColor(standaloneReadModelMatch[2]),
     containerId: null,
     processIndex: -1,
     noteTarget: null,
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
      const node = ensureNode(model, step, inferProcessType(step, currentContainer.type), currentContainer.id, stepIds.length);
      stepIds.push(node.id);
       }
     const proc: DSLProcess = {
      name: steps.join(' -> '),
      stepIds,
      notes: [],
      };
     currentContainer.processes.push(proc);
       // Also add links between consecutive steps, set next/negativeNext
     for (let j = 0; j < stepIds.length - 1; j++) {
      model.links.push({ source: stepIds[j], target: stepIds[j + 1], label: '', type: 'default' });
      // Set next on the source node
      const srcNode = model.nodes.find((n) => n.id === stepIds[j]);
      if (srcNode) srcNode.next = stepIds[j + 1];
       }
     continue;
      }

    // Element inside container (with or without [color], with optional next/negativeNext)
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
  noteTarget: string | null
): DSLNode | null {
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
  processIndex,
  noteTarget: null,
  next: normalizeId(yesNode),
  negativeNext: normalizeId(noNode),
  notes: [],
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
  id: normalizeId(label),
  label,
  type: nodeDefaults[typeName].type,
  color,
  containerId,
  processIndex,
  noteTarget: null,
  notes: [],
    };
  }

 return null;
}

/**
 * Ensure a node exists in the model (creates it if not).
 * Used inside process chains where nodes are referenced by label.
 */
function ensureNode(model: DSLModel, label: string, type: NodeType, containerId: string | null, processIndex: number): DSLNode {
  const id = normalizeId(label);
  let node = model.nodes.find((n) => n.id === id && n.containerId === containerId);
  if (!node) {
  node = {
    id,
    label: label.trim(),
    type,
    color: DEFAULT_COLORS[type] || '#6a737d',
    containerId,
    processIndex,
    noteTarget: null,
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

// ─── JSON DSL (dsl-type.ts spec) ───────────────────────────

interface JSONNode {
  type: string;
  name: string;
  next?: string;
  negativeNext?: string;
  notes?: string[];
}

interface JSONContainerNode {
  name: string;
  notes?: string[];
  children: (JSONNode | JSONContainerNode)[];
}

interface JSONDiagram {
  type: string;
  name: string;
  notes?: string[];
  containers: JSONContainerNode[];
}

export function isEventStormingJSON(text: string): boolean {
  const trimmed = text.trim();
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return false;

  try {
    return isEventStormingJSONValue(JSON.parse(trimmed));
  } catch {
    return false;
  }
}

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
      if (containerEl.tagName.toLowerCase() === 'container') {
        expandXMLContainer(containerEl, dslContainer, model, normalizeId(containerEl.getAttribute('name') || '') + '_');
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
  parentAliases?: Map<string, string>
): void {
  const stepIds: string[] = [];
  const subGroups: DSLSubGroup[] = [];
  const aliases = new Map<string, string>();
  const pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }> = [];

  collectXMLChildren(containerEl, dslContainer, model, prefix, aliases, stepIds, subGroups, pending);

  for (const { node, rawNext, rawNegativeNext, nodePrefix } of pending) {
    node.next = resolveJSONReference(rawNext, nodePrefix, aliases, parentAliases);
    node.negativeNext = resolveJSONReference(rawNegativeNext, nodePrefix, aliases, parentAliases);
  }

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

function collectXMLChildren(
  containerEl: Element,
  dslContainer: DSLContainer,
  model: DSLModel,
  prefix: string,
  aliases: Map<string, string>,
  stepIds: string[],
  subGroups: DSLSubGroup[],
  pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }>
): void {
  for (const child of Array.from(containerEl.children)) {
    const tagLower = child.tagName.toLowerCase();

    if (tagLower === 'container') {
      const subName = child.getAttribute('name') || '';
      const subPrefix = prefix + normalizeId(subName) + '_';
      const subStepIds: string[] = [];
      collectXMLChildren(child, dslContainer, model, subPrefix, aliases, subStepIds, subGroups, pending);
      for (const id of subStepIds) stepIds.push(id);
      subGroups.push({ name: subName, nodeIds: subStepIds, notes: xmlAttrNotes(child) });
    } else {
      const nodeType = XML_NODE_TYPES[tagLower];
      if (!nodeType) continue;

      const name = child.getAttribute('name') || '';
      const id = prefix + normalizeId(name);
      const rawNext = child.getAttribute('next') ?? undefined;
      const rawNegativeNext = child.getAttribute('negativeNext') ?? undefined;

      const n: DSLNode = {
        id,
        label: name,
        type: nodeType,
        color: DEFAULT_COLORS[nodeType] || '#6a737d',
        containerId: dslContainer.id,
        processIndex: -1,
        noteTarget: null,
        next: undefined,
        negativeNext: undefined,
        negativeNextText: rawNegativeNext,
        notes: xmlAttrNotes(child),
      };
      model.nodes.push(n);
      pending.push({ node: n, rawNext, rawNegativeNext, nodePrefix: prefix });
      aliases.set(canonicalizeReference(name), id);
      dslContainer.nodeIds.push(id);
      stepIds.push(id);
    }
  }
}

function xmlAttrNotes(el: Element): string[] {
  const notes = el.getAttribute('notes');
  return notes ? [notes] : [];
}

function isEventStormingJSONValue(value: unknown): value is JSONDiagram[] {
  return Array.isArray(value) && value.every(isJSONDiagram);
}

function isJSONDiagram(value: unknown): value is JSONDiagram {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.containers) &&
    value.containers.every(isJSONContainerNode) &&
    isStringArrayOrUndefined(value.notes)
  );
}

function isJSONContainerNode(value: unknown): value is JSONContainerNode {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === 'string' &&
    !('type' in value) &&
    Array.isArray(value.children) &&
    value.children.every(isJSONNodeOrContainer) &&
    isStringArrayOrUndefined(value.notes)
  );
}

function isJSONNodeOrContainer(value: unknown): value is JSONNode | JSONContainerNode {
  return isJSONNode(value) || isJSONContainerNode(value);
}

function isJSONNode(value: unknown): value is JSONNode {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === 'string' &&
    typeof value.name === 'string' &&
    (value.next === undefined || typeof value.next === 'string') &&
    (value.negativeNext === undefined || typeof value.negativeNext === 'string') &&
    isStringArrayOrUndefined(value.notes)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArrayOrUndefined(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

/**
 * Map dsl-type.ts NodeType strings to internal NodeType.
 */
function mapNodeType(type: string): NodeType {
  const m: Record<string, NodeType> = {
    Event: 'event',
    Command: 'command',
    Aggregate: 'aggregate',
    Actor: 'actor',
    Query: 'query',
    Policy: 'policy',
    Error: 'error',
    ExternalSystem: 'externalSystem',
    Note: 'note',
    ReadModel: 'view',
  };
  return m[type] || 'command';
}

/**
 * Map dsl-type.ts ContainerType strings to internal container types.
 */
function mapContainerType(type: string): 'aggregate' | 'readModel' | 'process' | 'externalSystem' {
  const l = type.toLowerCase();
  if (l === 'projector') return 'readModel';
  if (l === 'externalsystem') return 'externalSystem';
  if (l === 'process') return 'process';
  return 'aggregate';
}

function parseJSONDSL(data: JSONDiagram[]): DSLModel {
  const model: DSLModel = {
    title: 'Event Storming',
    description: '',
    containers: [],
    nodes: [],
    links: [],
  };

  for (const diagram of data) {
    const containerId = normalizeId(diagram.name);
    const cType = mapContainerType(diagram.type);

    const dslContainer: DSLContainer = {
      id: containerId,
      label: diagram.name,
      type: cType,
      color:
        cType === 'aggregate' ? '#FEE254' :
        cType === 'readModel' ? '#5BAA62' :
        cType === 'externalSystem' ? '#FB8597' :
        '#859EBF',
      nodeIds: [],
      processes: [],
      notes: diagram.notes || [],
    };

    for (const container of diagram.containers) {
      expandJSONContainer(container, dslContainer, model, normalizeId(container.name) + '_');
    }

    model.containers.push(dslContainer);
  }

  return model;
}

function expandJSONContainer(
  container: JSONContainerNode,
  dslContainer: DSLContainer,
  model: DSLModel,
  prefix: string,
  parentAliases?: Map<string, string>
): void {
  const stepIds: string[] = [];
  const subGroups: DSLSubGroup[] = [];
  const aliases = new Map<string, string>();
  const pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }> = [];

  collectChildren(container, dslContainer, model, prefix, aliases, stepIds, subGroups, pending);

  for (const { node, rawNext, rawNegativeNext, nodePrefix } of pending) {
    node.next = resolveJSONReference(rawNext, nodePrefix, aliases, parentAliases);
    node.negativeNext = resolveJSONReference(rawNegativeNext, nodePrefix, aliases, parentAliases);
  }

  dslContainer.processes.push({
    name: container.name,
    stepIds,
    notes: container.notes || [],
    subGroups: subGroups.length > 0 ? subGroups : undefined,
  });
}

function collectChildren(
  container: JSONContainerNode,
  dslContainer: DSLContainer,
  model: DSLModel,
  prefix: string,
  aliases: Map<string, string>,
  stepIds: string[],
  subGroups: DSLSubGroup[],
  pending: Array<{ node: DSLNode; rawNext?: string; rawNegativeNext?: string; nodePrefix: string }>
): void {
  for (const child of container.children) {
    if (isJSONNode(child)) {
      const id = prefix + normalizeId(child.name);
      const type = mapNodeType(child.type);
      const n: DSLNode = {
        id,
        label: child.name,
        type,
        color: DEFAULT_COLORS[type] || '#6a737d',
        containerId: dslContainer.id,
        processIndex: -1,
        noteTarget: null,
        next: undefined,
        negativeNext: undefined,
        negativeNextText: child.negativeNext || undefined,
        notes: child.notes || [],
      };
      model.nodes.push(n);
      pending.push({ node: n, rawNext: child.next, rawNegativeNext: child.negativeNext, nodePrefix: prefix });
      aliases.set(canonicalizeReference(child.name), id);
      dslContainer.nodeIds.push(id);
      stepIds.push(id);
    } else {
      // Sub-container: inline-expand into the parent process flow
      const subPrefix = prefix + normalizeId(child.name) + '_';
      const subStepIds: string[] = [];
      collectChildren(child, dslContainer, model, subPrefix, aliases, subStepIds, subGroups, pending);
      for (const id of subStepIds) stepIds.push(id);
      subGroups.push({ name: child.name, nodeIds: subStepIds, notes: child.notes || [] });
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────

export function normalizeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '_');
}

function canonicalizeReference(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveJSONReference(
  reference: string | undefined,
  prefix: string,
  aliases: Map<string, string>,
  parentAliases?: Map<string, string>
): string | undefined {
  if (!reference) return undefined;

  const key = canonicalizeReference(reference);

  const localMatch = aliases.get(key);
  if (localMatch) return localMatch;

  if (parentAliases) {
    const parentMatch = parentAliases.get(key);
    if (parentMatch) return parentMatch;
  }

  return prefix + normalizeId(reference);
}

function getColor(name: string): string {
  return COLOR_MAP[name.toLowerCase()] || '#6a737d';
}
