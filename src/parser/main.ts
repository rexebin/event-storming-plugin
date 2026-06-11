/**
 * Event Storming DSL — main parsing entry point.
 *
 * Coordinates the parse flow: validation → XML tree build → reference resolution
 * → synthetic process generation.
 */

import type { DSLModel, DSLContainer } from './models.js';
import type { PendingRef } from './parsing.js';
import { normalizeId, XML_NODE_TYPES } from './models.js';
import {

  buildContainerTree,
  addPositionedNote,
  makeXmlNode,
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

const XML_CONTAINER_TYPES: Record<string, 'aggregate' | 'projector' | 'process' | 'externalSystem'> = {
  aggregate: 'aggregate',
  externalsystem: 'externalSystem',
  projector: 'projector',
  process: 'process',
};

const CONTAINER_COLORS: Record<string, string> = {
  aggregate: '#FEE254',
  projector: '#5BAA62',
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
  if (root.tagName !== 'eventstorming' || root.querySelector('parsererror')) {
    const errEl = root.querySelector('parsererror');
    const msg = errEl ? (errEl.textContent?.trim() ?? '') : 'Document does not contain <eventstorming>…</eventstorming>';
    throw new Error(`Invalid XML: ${msg}`);
  }

  const orphanedNodes: Array<{ tagName: string; name?: string }> = [];

  for (const diagramEl of Array.from(root.children)) {
    const tagLower = diagramEl.tagName.toLowerCase();
    const cType = XML_CONTAINER_TYPES[tagLower];
    if (!cType) {
      // Track any root-level element that isn't a container as orphaned
      const name = diagramEl.getAttribute('name') || diagramEl.textContent?.trim() || diagramEl.tagName;
      orphanedNodes.push({ tagName: tagLower, name });
      continue;
    }

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
      notes: diagramEl.getAttribute('notes') ? [diagramEl.getAttribute('notes')!] : [],
    };

    // Phase 1 & 1b: Collect inline process nodes and nested containers.
    const pendingChildren: Array<{ node: PendingRef['node']; rawNext?: string; rawNegativeNext?: string }> = [];
    const inlineStepIds: string[] = [];
    const allChildContainers: Array<{ el: Element; prefix: string }> = [];
    let lastRegularNodeId: string | undefined;

    for (const childEl of Array.from(diagramEl.children)) {
      const tagLower2 = childEl.tagName.toLowerCase();
      if (tagLower2 === 'container') {
        const childPrefix = normalizeId(childEl.getAttribute('name') || '') + '_';
        allChildContainers.push({ el: childEl, prefix: childPrefix });
        continue;
      }

      // Positioned note → create as layout node linked to parent
      if (tagLower2 === 'note') {
        if (lastRegularNodeId) {
          addPositionedNote(childEl, dslContainer, model, lastRegularNodeId, inlineStepIds.length);
        }
        continue;
      }

      const nodeType = XML_NODE_TYPES[tagLower2];
      if (!nodeType) continue;
      const n = makeXmlNode(childEl, nodeType, dslContainer.id, containerId + '_');
      model.nodes.push(n);
      inlineStepIds.push(n.id);
      lastRegularNodeId = n.id;
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

  // Validate no orphaned node elements exist outside any container
  if (orphanedNodes.length > 0) {
    const noteOrphans = orphanedNodes.filter((o) => o.tagName === 'note');
    const otherOrphans = orphanedNodes.filter((o) => o.tagName !== 'note');

    const containerTypesStr = Object.keys(XML_CONTAINER_TYPES)
      .map((t) => `<${t}>`)
      .join(', ');

    let message: string;
    if (otherOrphans.length > 0 && noteOrphans.length > 0) {
      // Mixed orphans: list all under "Node element(s)"
      const allDetails = orphanedNodes.map((o) => `${o.name ?? o.tagName} (${o.tagName})`).join(', ');
      message = `Node elements found outside of a container: ${allDetails}. All node elements must be inside a container (${containerTypesStr}).`;
    } else if (otherOrphans.length > 0) {
      // Only non-note orphans
      const details = otherOrphans.map((o) => `${o.name ?? o.tagName} (${o.tagName})`).join(', ');
      message = `Node elements found outside of a container: ${details}. All node elements must be inside a container (${containerTypesStr}).`;
    } else {
      // Only note orphans
      const details = noteOrphans.map((o) => `${o.name ?? o.tagName} (${o.tagName})`).join(', ');
      message = `Note element(s) found outside of a container: ${details}. All notes must be inside a container (${containerTypesStr}) and after a node element to attach.`;
    }

    throw new Error(message);
  }

  for (const c of model.containers) ensureSyntheticProcesses(c, model.nodes);

  return model;
}

export function parseDSL(text: string): DSLModel {
  if (!isEventStormingXML(text)) return { title: 'Event Storming', description: '', containers: [], nodes: [], links: [] };
  return parseXMLDSL(text);
}
