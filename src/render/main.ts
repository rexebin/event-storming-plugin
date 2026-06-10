import { parseDSL } from '../parser/';
import { CONTAINER_PADDING } from '../layout/constants.js';
import { computeLayout } from '../layout/index.js';
import { GSelection, DestroyableReturn } from './models.js';
import { renderDefs, createTooltip } from './svg-helpers.js';
import { renderContainers } from './render-containers.js';
import { renderGroups, renderSubGroups } from './render-groups.js';
import { renderNodes, renderLinks } from './render-nodes.js';
import { setupZoom, setupTooltips, type ZoomOptions } from './interaction.js';

export function renderEventStorming(
  container: any,
  dslText: string,
  options?: ZoomOptions,
): DestroyableReturn {
  const model = parseDSL(dslText);
  const layout = computeLayout(model);

  // Use container's actual width so the SVG always fills the available space.
  // Center the diagram horizontally when it is narrower than the container.
  const contentW = layout.width + CONTAINER_PADDING * 2;
  const containerPx = container.node()?.getBoundingClientRect().width ?? 0;
  const svgWidth = Math.max(containerPx, contentW);
  const svgHeight = layout.height + CONTAINER_PADDING * 2;
  const offsetX = (svgWidth - contentW) / 2;

  // Create the SVG
  const svg = container
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  // Shared defs (shadow filter, arrow marker)
  renderDefs(svg);

  // Create shared tooltip element
  const tooltip = createTooltip();

  // Containers
  const containersGroup = svg.append('g').attr('class', 'containers');
  renderContainers(containersGroup as GSelection, layout.containers, offsetX, tooltip);

  // Groups
  const groupsGroup = svg.append('g').attr('class', 'groups');
  renderGroups(groupsGroup as GSelection, layout.groups, offsetX, tooltip);

  // Sub-groups
  const subGroupsGroup = svg.append('g').attr('class', 'sub-groups');
  renderSubGroups(subGroupsGroup as GSelection, layout.subGroups, offsetX, tooltip);

  // Nodes
  const nodesGroup = svg.append('g').attr('class', 'nodes');
  renderNodes(nodesGroup as GSelection, layout.nodes, offsetX);

  // Links (on top of nodes so arrowheads are visible)
  const linksGroup = svg.append('g').attr('class', 'links');
  renderLinks(linksGroup as GSelection, layout.links, layout.nodes, offsetX);

  // Zoom & pan
  setupZoom(svg, ['nodes', 'links', 'containers', 'groups', 'sub-groups'], options);

  // Tooltips
  setupTooltips(nodesGroup as GSelection, layout.nodes, model, tooltip);

  const destroy = () => {
    tooltip.remove();
  };

  return { svg, model, destroy };
}
