/**
 * Event Storming DSL Parser — parser module barrel.
 *
 * Re-exports public symbols from src/parser/ sub-modules.
 */

export type {
  DSLNode, DSLLink, DSLContainer, DSLSubGroup, DSLProcess, DSLModel,
  NodeType, LinkType,
} from './models.js';

export { normalizeId } from './models.js';
export { parseDSL, isEventStormingXML } from './main.js';
