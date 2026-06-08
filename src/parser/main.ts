/**
 * Event Storming DSL — main parsing entry point.
 *
 * Coordinates the parse flow: validation → XML tree build → reference resolution
 * → synthetic process generation.
 */

import type { DSLModel } from './models.js';
import type { PendingRef } from './parsing.js';
import { normalizeId } from './models.js';
import {
  xmlAttrNotes,
  makeXmlNode,
  buildContainerTree,
  resolveNodeRefs,
  applyImplicitLinking,
  resolveInlineProcessRefs,
  collectSubtreeNodeIds,
  ensureSyntheticProcesses,
} from './parsing.js';

// ─── Validation ─────────────────────────────────────────────────────────────

export function isEventStormingXML(text: string): boolean {
  return text.includes('<eventstorming') && text.includes('</eventstorming>');
}

// ─── Container type config ──────────────────────────────────────────────────

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

// ─── Top-level parsing ─────────────────────────────────────────────────────

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
    const dslContainer: import('./models.js').DSLContainer = {
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

    // Phase 1 & 1b: Collect inline process nodes and nested containers.
    const pendingChildren: Array<{ node: PendingRef['node']; rawNext?: string; rawNegativeNext?: string }> = [];
    const inlineStepIds: string[] = [];
    const allChildContainers: Array<{ el: Element; prefix: string }> = [];

    for (const childEl of Array.from(diagramEl.children)) {
      const tagLower2 = childEl.tagName.toLowerCase();
      if (tagLower2 === 'container') {
        const childPrefix = normalizeId(childEl.getAttribute('name') || '') + '_';
        allChildContainers.push({ el: childEl, prefix: childPrefix });
        continue;
      }
      if (cType !== 'process') continue;

      const n = makeXmlNodeForTag(childEl, tagLower2, dslContainer.id, containerId + '_');
      if (!n) continue;
      model.nodes.push(n);
      inlineStepIds.push(n.id);
      pendingChildren.push({ node: n, rawNext: childEl.getAttribute('next') ?? undefined, rawNegativeNext: childEl.getAttribute('altNext') ?? undefined });
    }

    let pendingRefs: Array<{ node: PendingRef['node']; rawNext?: string; rawNegativeNext?: string }> = [];
    for (const { el, prefix } of allChildContainers) {
      const result = buildContainerTree(el, dslContainer, model, prefix);
      pendingRefs = pendingRefs.concat(result.map(r => ({ node: r.node, rawNext: r.rawNext, rawNegativeNext: r.rawNegativeNext })));
    }

    // Phase 1b: Resolve cross-container references.
    if (pendingRefs.length > 0) {
      const boundaryNodeIds = collectSubtreeNodeIds(dslContainer.id, model);
      resolveNodeRefs(pendingRefs.map(r => r as PendingRef), model, dslContainer.id, boundaryNodeIds);
      applyImplicitLinking(pendingRefs.map(r => r as PendingRef));
    }

    // Phase 2: Resolve references for inline process nodes.
    const inlineBoundaryNodeIds = collectSubtreeNodeIds(dslContainer.id, model);
    if (pendingChildren.length > 0) {
      resolveInlineProcessRefs(pendingChildren.map(r => r as PendingRef), model, inlineStepIds, dslContainer.id, inlineBoundaryNodeIds);
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

// Helper to create a node from a tag — reuses makeXmlNode but checks XML_NODE_TYPES inline.
function makeXmlNodeForTag(el: Element, tagLower: string, containerId: string, idPrefix: string): import('./models.js').DSLNode | null {
  const nodeType = XML_NODE_TYPES[tagLower];
  if (!nodeType) return null;
  if (tagLower === 'note' && !el.getAttribute('name')) return null;
  return makeXmlNode(el, nodeType, containerId, idPrefix);
}

const XML_NODE_TYPES: Record<string, import('./models.js').NodeType> = {
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

export function parseDSL(text: string): DSLModel {
  if (!isEventStormingXML(text)) return { title: 'Event Storming', description: '', containers: [], nodes: [], links: [] };
  return parseXMLDSL(text);
}
