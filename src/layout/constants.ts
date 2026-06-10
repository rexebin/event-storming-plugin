/**
 * Event Storming — Layout dimensions and style constants.
 */

export const NODE_W = 130;
export const NODE_H = 120;
export const NODE_FOLD = 16;
export const NODE_GAP_X = 36;
export const NODE_GAP_Y = 42;

export const CONTAINER_PADDING = 24;
export const CONTAINER_HEADER_H = 32;
export const CONTAINER_GAP_X = 60;
export const CONTAINER_GAP_Y = 80;

export const GROUP_PADDING = 16;
export const GROUP_HEADER_H = 22;
export const GROUP_GAP_Y = 18;

export const SUB_GROUP_GAP_X = 24;

export const SUB_PAD_BASE = 8;
export const NESTED_GAP = 14;
export const CONTAINER_BOTTOM_EXTRA = 20;

export const MAX_ROW_WIDTH = 1200;

export const LINK_COLOR = '#6a737d';

export const CONTAINER_TYPE_LABELS: Record<string, string> = {
  aggregate: 'Aggregate',
  projector: 'Projector',
  process: 'Process',
  externalSystem: 'External System',
};
