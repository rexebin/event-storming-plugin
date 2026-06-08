import { GSelection } from './models.js';
import { GROUP_HEADER_H } from '../constants.js';
import { appendNotesBadge } from '../notes.js';

interface LayoutGroup {
  id: string;
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
  containerId: string;
  notes?: string[];
}

export function renderGroups(
  g: GSelection,
  groups: LayoutGroup[],
  offsetX: number,
  tooltip: any,
): void {
  for (const group of groups) {
    const gg = g.append('g')
      .attr('class', 'es-process-group')
      .attr('transform', `translate(${group.x + offsetX}, ${group.y})`)
      .attr('data-id', group.id)
      .attr('data-container-id', group.containerId)
      .attr('data-name', group.label);

    gg.append('rect')
      .attr('width', group.width)
      .attr('height', group.height)
      .attr('rx', 6)
      .attr('fill', '#ffffff')
      .attr('fill-opacity', 0.55)
      .attr('stroke', '#d0d7de')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4');

    gg.append('text')
      .attr('x', 12)
      .attr('y', 16)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#57606a')
      .text(group.label);

    if (group.notes && group.notes.length > 0) {
      appendNotesBadge(gg, group.width - 14, 12, group.notes, tooltip, 'es-group-note-badge');
    }
  }
}

interface LayoutSubGroup {
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
  notes?: string[];
}

export function renderSubGroups(
  g: GSelection,
  subGroups: LayoutSubGroup[],
  offsetX: number,
  tooltip: any,
): void {
  for (const sg of subGroups) {
    const sgG = g.append('g')
      .attr('class', 'es-sub-group')
      .attr('transform', `translate(${sg.x + offsetX}, ${sg.y})`)
      .attr('data-name', sg.label);

    sgG.append('rect')
      .attr('width', sg.width)
      .attr('height', sg.height)
      .attr('rx', 4)
      .attr('fill', '#f0f4ff')
      .attr('fill-opacity', 0.7)
      .attr('stroke', '#a8b8d8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4 3');

    sgG.append('text')
      .attr('x', 10)
      .attr('y', GROUP_HEADER_H - 6)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#7a8aaa')
      .text(sg.label);

    if (sg.notes && sg.notes.length > 0) {
      appendNotesBadge(sgG, sg.width - 14, 10, sg.notes, tooltip, 'es-group-note-badge');
    }
  }
}
