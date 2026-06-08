/**
 * Event Storming — Standalone (free-floating) node layout.
 */

import type { LayoutNode } from './models.js';
import { NODE_W, NODE_GAP_X, NODE_H, NODE_GAP_Y } from './constants.js';

const COLS = 5;

export function layoutStandaloneNodes(nodes: LayoutNode[], allNodes: LayoutNode[], startX: number, startY: number) {
  let cx = startX;
  let cy = startY;

  for (let i = 0; i < nodes.length; i++) {
    if (i % COLS !== 0) {
      cx += NODE_W + NODE_GAP_X;
        } else {
      cx = startX;
      cy += NODE_H + NODE_GAP_Y;
        }
    allNodes.push({ ...nodes[i], x: cx, y: cy });
     }
}
