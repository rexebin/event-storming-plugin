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
  // Negative links (altNext branches) use 90-degree orthogonal routing:
  // down → sideways → down to target (half-way bend avoids crossing intermediate nodes).
  const isNeg = isNegative || type === 'negative';
  if (isNeg) {
    const sourceCenterX = source.x + NODE_W / 2;
    const targetCenterX = target.x + NODE_W / 2;

    if (source.y < target.y) {
      // Target below: bottom-center → half-way → sideways → down to top of target
      const sourceBottomY = source.y + NODE_H;
      const targetTopY = target.y;
      const midY = sourceBottomY + (targetTopY - sourceBottomY) / 2;

      if (sourceCenterX === targetCenterX) {
        return `M ${sourceCenterX} ${sourceBottomY} L ${targetCenterX} ${targetTopY}`;
      }
      return `M ${sourceCenterX} ${sourceBottomY} L ${sourceCenterX} ${midY} L ${targetCenterX} ${midY} L ${targetCenterX} ${targetTopY}`;
    }

    // Target above: top-center → half-way → sideways → up to bottom of target
    const sourceTopY = source.y;
    const targetBottomY = target.y + NODE_H;
    const midY = sourceTopY + (targetBottomY - sourceTopY) / 2;

    if (sourceCenterX === targetCenterX) {
      return `M ${sourceCenterX} ${sourceTopY} L ${targetCenterX} ${targetBottomY}`;
    }
    return `M ${sourceCenterX} ${sourceTopY} L ${sourceCenterX} ${midY} L ${targetCenterX} ${midY} L ${targetCenterX} ${targetBottomY}`;
  }

   // Same column: draw straight vertical arrow (bottom-center → top-center or vice versa)
  if (source.x === target.x) {
    const cx = source.x + NODE_W / 2;
    if (source.y < target.y) {
      return `M ${cx} ${source.y + NODE_H} L ${cx} ${target.y}`;
    }
    return `M ${cx} ${source.y} L ${cx} ${target.y + NODE_H}`;
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

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
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

   // Handle polylines (M ... L ... L ...) — walk segments by length
  const coords = d.match(/[\d.]+/g)?.map(Number);
  if (coords && coords.length >= 4) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) pts.push([coords[i], coords[i + 1]]);
    }
    if (pts.length >= 2) {
      const segLens: number[] = [];
      let totalLen = 0;
      for (let i = 1; i < pts.length; i++) {
        const len = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        segLens.push(len);
        totalLen += len;
       }
      const targetT = t * totalLen;
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        if (acc + segLens[i] >= targetT) {
          const localT = segLens[i] > 0 ? (targetT - acc) / segLens[i] : 0;
          return {
            x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * localT,
            y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * localT,
           };
          }
        acc += segLens[i];
       }
      return { x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] };
     }
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
