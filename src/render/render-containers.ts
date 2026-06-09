import { GSelection } from './models.js';
import { CONTAINER_HEADER_H, CONTAINER_TYPE_LABELS } from '../layout';
import { CONTAINER_BADGE_WIDTHS } from './constants.js';
import { isLight } from '../utils.js';
import { appendNotesBadge } from '../notes.js';

interface LayoutContainer {
  id: string;
  label: string;
  type: string;
  color: string;
  width: number;
  height: number;
  x: number;
  y: number;
  notes?: string[];
}

export function renderContainers(
  g: GSelection,
  containers: LayoutContainer[],
  offsetX: number,
  tooltip: any,
): void {
  for (const c of containers) {
    const cg = g.append('g')
      .attr('transform', `translate(${c.x + offsetX}, ${c.y})`)
      .attr('data-id', c.id)
      .attr('data-name', c.label);

    // Container background
    cg.append('rect')
      .attr('width', c.width)
      .attr('height', c.height)
      .attr('rx', 8)
      .attr('fill', '#fafbfc')
      .attr('stroke', c.color)
      .attr('stroke-width', 3);

    // Container header (colored band)
    cg.append('rect')
      .attr('width', c.width)
      .attr('height', CONTAINER_HEADER_H)
      .attr('rx', 8)
      .attr('fill', c.color);

    // Clip bottom corners of header
    cg.append('rect')
      .attr('x', 0)
      .attr('y', CONTAINER_HEADER_H - 8)
      .attr('width', c.width)
      .attr('height', 8)
      .attr('fill', c.color);

    // Container title
    cg.append('text')
      .attr('x', 12)
      .attr('y', CONTAINER_HEADER_H - 10)
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .attr('fill', isLight(c.color) ? '#333' : '#fff')
      .text(`${c.type === 'aggregate' ? '📦' : c.type === 'projector' ? '📚' : c.type === 'externalSystem' ? '🔌' : '🔄'} ${c.label}`);

    // Container type badge
    const containerTypeLabel = CONTAINER_TYPE_LABELS[c.type] ?? c.type;
    const badgePadding = 6;
    const badgeHeight = 14;
    const typeBadgeW = (CONTAINER_BADGE_WIDTHS[containerTypeLabel] ?? 82) + badgePadding * 2;
    const typeBadgeX = 8;
    const typeBadgeY = -badgeHeight - 6;

    cg.append('rect')
      .attr('x', typeBadgeX)
      .attr('y', typeBadgeY)
      .attr('width', typeBadgeW)
      .attr('height', badgeHeight)
      .attr('rx', 4)
      .attr('fill', c.color);

    cg.append('text')
      .attr('class', 'es-container-type-badge')
      .attr('x', typeBadgeX + typeBadgeW / 2)
      .attr('y', typeBadgeY + badgeHeight / 2 + 1)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('fill', isLight(c.color) ? '#333' : '#fff')
      .text(containerTypeLabel);

    if (c.notes && c.notes.length > 0) {
      appendNotesBadge(cg, c.width - 14, 12, c.notes, tooltip, 'es-container-note-badge');
    }
  }
}
