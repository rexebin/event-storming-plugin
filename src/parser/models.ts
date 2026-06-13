/**
 * Event Storming DSL — type definitions.
 */

export interface DSLNode {
  id: string;
  label: string;
  type: NodeType;
  color: string;
  containerId: string | null; // immediate parent container id (scope boundary for reference resolution)
  processIndex: number; // index within a process chain (-1 if standalone)
  parentId?: string | null; // positioned note: the DSL node id of the containing element
  noteX?: number; // positioned note: grid column offset relative to parent (0 = same column)
  noteY?: number; // positioned note: grid row offset relative to parent (0 = same row)
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
  type: 'aggregate' | 'projector' | 'process' | 'externalSystem';
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
  | 'projector'
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

/** Strip non-alphanumeric characters to produce a stable identifier. */
export function normalizeId(text: string): string {
  return text.replace(/[^a-zA-Z0-9]/g, '_');
}

/** Tags that represent node elements (events, commands, policies, etc.). Notes are NOT included — they can only appear as children of node elements. */
export const XML_NODE_TYPES: Record<string, NodeType> = {
  actor: 'actor',
  command: 'command',
  event: 'event',
  policy: 'policy',
  query: 'query',
  externalsystem: 'externalSystem',
  error: 'error',
  aggregate: 'aggregate',
  projector: 'projector',
};

/** Tags allowed as direct children of <eventstorming>. Single source of truth for root container types. */
export const VALID_CONTAINER_TAGS = new Set(['aggregate', 'projector', 'process', 'externalsystem']);
