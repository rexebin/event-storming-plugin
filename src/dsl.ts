/**
 * Event Storming DSL Parser — XML format.
 *
 * Barrel file: re-exports public symbols from src/dsl/ modules.
 */

export type {
  DSLNode, DSLLink, DSLContainer, DSLSubGroup, DSLProcess, DSLModel,
  NodeType, LinkType,
} from './parser/models.js';

export { normalizeId } from './parser/models.js';
export { parseDSL, isEventStormingXML } from './parser/main.js';
