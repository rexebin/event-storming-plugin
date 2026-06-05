/**
 * Event Storming — Link path computation.
 */

import { LayoutNode, LayoutLink } from './constants.js';
import { NODE_W, NODE_H, NODE_GAP_X } from './constants.js';

export function computeLinkPath(
  source: LayoutNode,
  target: LayoutNode,
  type: string,
  isNegative: boolean = false,
): string {
  if (isNegative) {
    const sourceCenterX = source.x + NODE_W / 2;
    const sourceBottomY = source.y + NODE_H;
    const targetCenterX = target.x + NODE_W / 2;
    const targetTopY = target.y;

    return `M ${sourceCenterX} ${sourceBottomY} L ${targetCenterX} ${targetTopY}`;
  }

   // Same column, target below: draw straight vertical arrow (bottom-center → top-center)
  if (source.x === target.x && source.y < target.y) {
    const cx = source.x + NODE_W / 2;
    return `M ${cx} ${source.y + NODE_H} L ${cx} ${target.y}`;
  }

  const sourceIsLeft = source.x <= target.x;
  const sourceX = sourceIsLeft ? source.x + NODE_W : source.x;
  const targetX = sourceIsLeft ? target.x : target.x + NODE_W;
  const sourceY = source.y + NODE_H / 2;
  const targetY = target.y + NODE_H / 2;

  if (sourceY !== targetY) {
    const sourceIsBelowTarget = sourceY > targetY;
    const targetAnchorY = target.y + (sourceIsBelowTarget ? NODE_H * 0.75 : NODE_H * 0.25);
    const targetApproachY = targetAnchorY + (sourceY - targetAnchorY) * 0.45;
    const horizontalDistance = Math.abs(targetX - sourceX);

    if (horizontalDistance < 1) {
      const sourceCenterX = source.x + NODE_W / 2;
      const targetCenterX = target.x + NODE_W / 2;
      if (!sourceIsBelowTarget) {
        // target is directly below — draw straight vertical arrow
        return `M ${sourceCenterX} ${source.y + NODE_H} L ${targetCenterX} ${target.y}`;
      }
      const curveDirection = type === 'negative' ? 1 : -1;
      const controlOffset = Math.max(28, NODE_GAP_X);
      const controlX = sourceCenterX + curveDirection * controlOffset;

      return `M ${sourceCenterX} ${sourceY} C ${controlX} ${sourceY}, ${controlX} ${targetApproachY}, ${targetCenterX} ${targetAnchorY}`;
    }

    const controlOffset = Math.max(32, horizontalDistance * 0.45);
    const controlX1 = sourceX + (sourceIsLeft ? controlOffset : -controlOffset);
    const controlX2 = targetX - (sourceIsLeft ? controlOffset : -controlOffset);

    return `M ${sourceX} ${sourceY} C ${controlX1} ${sourceY}, ${controlX2} ${targetApproachY}, ${targetX} ${targetAnchorY}`;
  }

  return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
}

export function getPointOnPath(d: string, t: number): { x: number; y: number } {
   // Handle cubic bezier
  const bezierMatch = d.match(/M ([\d.]+) ([\d.]+) C ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+), ([\d.]+) ([\d.]+)/);
  if (bezierMatch) {
    const x0 = parseFloat(bezierMatch[1]), y0 = parseFloat(bezierMatch[2]);
    const cx1 = parseFloat(bezierMatch[3]), cy1 = parseFloat(bezierMatch[4]);
    const cx2 = parseFloat(bezierMatch[5]), cy2 = parseFloat(bezierMatch[6]);
    const x3 = parseFloat(bezierMatch[7]), y3 = parseFloat(bezierMatch[8]);
    const u = 1 - t;
    return {
      x: u*u*u*x0 + 3*u*u*t*cx1 + 3*u*t*t*cx2 + t*t*t*x3,
      y: u*u*u*y0 + 3*u*u*t*cy1 + 3*u*t*t*cy2 + t*t*t*y3,
     };
   }
   // Fallback: straight line
  const lineMatch = d.match(/M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)/);
  if (lineMatch) {
    const x1 = parseFloat(lineMatch[1]), y1 = parseFloat(lineMatch[2]);
    const x2 = parseFloat(lineMatch[3]), y2 = parseFloat(lineMatch[4]);
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
   }
  return { x: 0, y: 0 };
}

export function getLinkLabelPosition(d: string, link: LayoutLink): { x: number; y: number } {
  const mid = getPointOnPath(d, 0.5);

  if (link.label === 'no') {
    return {
      x: mid.x + 14,
      y: mid.y - 10,
     };
   }

  return {
    x: mid.x,
    y: mid.y - 6,
   };
}
