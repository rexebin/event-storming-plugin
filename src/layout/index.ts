/**
 * Event Storming — Layout module barrel.
 *
 * Re-exports public symbols from src/layout/ sub-modules.
 */

// ─── Constants ──────────────────────────────────────────────

export {
  NODE_W, NODE_H, NODE_FOLD,
  NODE_GAP_X, NODE_GAP_Y,
  CONTAINER_PADDING, CONTAINER_HEADER_H, CONTAINER_GAP_X, CONTAINER_GAP_Y,
  GROUP_PADDING, GROUP_HEADER_H, GROUP_GAP_Y,
  SUB_GROUP_GAP_X,
  LINK_COLOR,
  CONTAINER_TYPE_LABELS,
} from './constants.js';

// ─── Layout types ──────────────────────────────────────────

export type {
  LayoutNode, LayoutContainer, LayoutGroup, LayoutSubGroup,
  LayoutResult, LayoutLink,
} from './models.js';

// ─── Orchestrator ──────────────────────────────────────────

export { computeLayout } from './main.js';

// ─── Chain & branch layout ─────────────────────────────────

export { layoutAltBranch, layoutChainFrom, computeSubGroupDepths, computeMaxSubGroupDepth } from './chains.js';

// ─── Fan-in layout ─────────────────────────────────────────

export { layoutFanInProcess, computeProcessColumns, computeFanInProcessColumns } from './fan-in.js';

// ─── Container sizing ──────────────────────────────────────

export { computeContainerWidth, computeContainerHeight } from './sizing.js';
