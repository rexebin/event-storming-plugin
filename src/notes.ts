/**
 * Event Storming — Notes badges and tooltip rendering.
 */

import { DSLModel, DSLNode, normalizeId } from './parser/';
import { escapeHtml } from './utils.js';

export function appendNotesBadge(
  parent: any,
  x: number,
  y: number,
  notes: string[],
  tooltip: any,
  className: string,
): void {
  const badge = parent
     .append('g')
     .attr('class', className)
     .attr('transform', `translate(${x}, ${y})`);

  badge
     .append('circle')
     .attr('r', 6)
     .attr('fill', '#FFF1AA')
     .attr('stroke', '#333')
     .attr('stroke-width', 1);

  badge
     .append('text')
     .attr('x', 0)
     .attr('y', 0.5)
     .attr('text-anchor', 'middle')
     .attr('dominant-baseline', 'middle')
     .attr('font-size', '7px')
     .attr('font-weight', '700')
     .attr('fill', '#333')
     .attr('pointer-events', 'none')
     .text('i');

  badge
     .on('mouseenter', function (event: MouseEvent) {
      tooltip
         .style('display', 'block')
         .html(buildNotesHtml(notes))
         .style('left', (event.pageX + 12) + 'px')
         .style('top', (event.pageY - 10) + 'px');
     })
     .on('mousemove', function (event: MouseEvent) {
      tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 10) + 'px');
     })
     .on('mouseleave', function () {
      tooltip.style('display', 'none');
     });
}

export function buildNotesHtml(notes: string[]): string {
  return `<div class="es-tooltip-notes"><div class="es-tooltip-notes-label">Notes</div><ul>${
    notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')
   }</ul></div>`;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  event: 'Domain Event', command: 'Command', aggregate: 'Aggregate',
  actor: 'Actor', policy: 'Policy', projector: 'Projector',
  externalSystem: 'External System', tempObject: 'Object', note: 'Note',
  query: 'Query', view: 'View', error: 'Error',
};

export function formatNodeType(type: string): string {
  return NODE_TYPE_LABELS[type] ?? type;
}

export function getNodeNotes(node: DSLNode, model: DSLModel): string[] {
  const directNotes = node.notes || [];
  const attachedNotes = model.nodes
     .filter((candidate) => candidate.type === 'note')
     .filter((candidate) => isAttachedNote(candidate, node))
     .map((candidate) => candidate.label);

  return [...new Set([...directNotes, ...attachedNotes])];
}

export function isAttachedNote(noteNode: DSLNode, node: DSLNode): boolean {
  if (noteNode.type !== 'note' || !noteNode.noteTarget) return false;
  if (noteNode.containerId !== node.containerId) return false;

  return noteNode.noteTarget === node.id || noteNode.noteTarget === normalizeId(node.label);
}
