/**
 * Event Storming — Link path computation.
 */

import type { LayoutNode } from './layout/index.js';
import { NODE_W, NODE_H, NODE_GAP_X, NODE_GAP_Y } from './layout/index.js';

export function computeLinkPath(
  source: LayoutNode,
  target: LayoutNode,
  type: string,
  isNegative: boolean = false,
): string {
  const isNeg = isNegative || type === 'negative';
  if (isNeg) {
    return altNextPath(source, target);
  }

  const isEventToReadModel = source.type === 'event' && target.type === 'readModel';

  if ((type === 'next' || type === 'default') && source.y !== target.y && !isEventToReadModel) {
    return nextOrthogonalPath(source, target);
  }

  // Same column
  if (source.x === target.x) {
    const cx = source.x + NODE_W / 2;
    if (isEventToReadModel) {
      // S-curve to stand out from straight vertical lines
      const controlOffset = Math.max(28, NODE_GAP_X);
      const cy1 = source.y + NODE_H / 2;
      const targetYAnchor = target.y + (source.y < target.y ? NODE_H * 0.75 : NODE_H * 0.25);
      const approachY = targetYAnchor + (cy1 - targetYAnchor) * 0.45;
      const controlX = cx - controlOffset;
      if (source.y < target.y) {
        return `M ${cx} ${source.y + NODE_H} C ${controlX} ${source.y + NODE_H}, ${controlX} ${approachY}, ${cx} ${target.y}`;
      }
      return `M ${cx} ${source.y} C ${controlX} ${source.y}, ${controlX} ${cy1}, ${cx} ${target.y + NODE_H}`;
    }
    if (source.y < target.y) {
      return `M ${cx} ${source.y + NODE_H} L ${cx} ${target.y}`;
    }
    return `M ${cx} ${source.y} L ${cx} ${target.y + NODE_H}`;
  }

  // Different columns
  const sourceIsLeft = source.x <= target.x;
  const sourceX = sourceIsLeft ? source.x + NODE_W : source.x;
  const targetX = sourceIsLeft ? target.x : target.x + NODE_W;

  if (type === 'next') {
    return `M ${sourceX} ${source.y + NODE_H / 2} L ${targetX} ${target.y + NODE_H / 2}`;
  }

  const sourceY = source.y + NODE_H / 2;
  const targetY = target.y + NODE_H / 2;

  if (isEventToReadModel && sourceY !== targetY) {
    return eventToReadModelBezierPath(source, target, sourceIsLeft);
  }

  if (sourceY !== targetY) {
    const straightTargetY = sourceIsLeft ? target.y : target.y + NODE_H;
    return `M ${sourceX} ${sourceY} L ${targetX} ${straightTargetY}`;
  }

  return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
}

// Orthogonal routing for altNext (negative) branches.
// Always exits from the bottom-center of source, goes down to clear the node,
// routes sideways toward target, then enters from above.
function altNextPath(source: LayoutNode, target: LayoutNode): string {
  const gapY = NODE_GAP_Y + 20;
  const sourceCenterX = source.x + NODE_W / 2;
  const targetCenterX = target.x + NODE_W / 2;

  if (source.y < target.y) {
    // Target is below — direct vertical only if same column and immediately adjacent
    const verticalGap = target.y - (source.y + NODE_H);
    if (sourceCenterX === targetCenterX && verticalGap <= NODE_GAP_Y * 3) {
      return `M ${sourceCenterX} ${source.y + NODE_H} L ${targetCenterX} ${target.y}`;
    }

    const safeX = source.x + NODE_W + NODE_GAP_X / 2;
    const routeY = source.y + NODE_H + gapY / 2;
    const aboveTarget = target.y - gapY / 2;

    return (
      `M ${sourceCenterX} ${source.y + NODE_H} ` +
      `L ${sourceCenterX} ${routeY} ` +
      `L ${safeX} ${routeY} ` +
      `L ${safeX} ${aboveTarget} ` +
      `L ${targetCenterX} ${aboveTarget} ` +
      `L ${targetCenterX} ${target.y}`
    );
  }

  // Target is above — always orthogonal, route toward target's column
  const safeX = sourceCenterX > targetCenterX
    ? source.x - NODE_GAP_X / 2
    : source.x + NODE_W + NODE_GAP_X / 2;
  const safeY = source.y + NODE_H + gapY / 2;
  const aboveTarget = target.y - gapY / 2;

  return (
    `M ${sourceCenterX} ${source.y + NODE_H} ` +
    `L ${sourceCenterX} ${safeY} ` +
    `L ${safeX} ${safeY} ` +
    `L ${safeX} ${aboveTarget} ` +
    `L ${targetCenterX} ${aboveTarget} ` +
    `L ${targetCenterX} ${target.y}`
  );
}

// ─── next-type orthogonal routing ─────────────────────────────────────
// Always exits from source's right-edge middle, goes right by half GAP_X,
// turns toward target's row stopping half GAP_Y past the target's near edge,
// goes left to half GAP_X before the target's left edge, aligns to the
// target's mid-Y, then enters the target's left-edge middle.

/** Source → Target (target is below) */
function nextPathBelow(source: LayoutNode, target: LayoutNode): string {
  const rightEdgeX = source.x + NODE_W;
  const rightMidY = source.y + NODE_H / 2;
  const extX = rightEdgeX + NODE_GAP_X / 2;
  const approachY = target.y - NODE_GAP_Y / 2;
  const approachX = target.x - NODE_GAP_X / 2;
  const targetMidY = target.y + NODE_H / 2;

  return (
    `M ${rightEdgeX} ${rightMidY} ` +
    `L ${extX} ${rightMidY} ` +
    `L ${extX} ${approachY} ` +
    `L ${approachX} ${approachY} ` +
    `L ${approachX} ${targetMidY} ` +
    `L ${target.x} ${targetMidY}`
  );
}

/** Source → Target (target is above) */
function nextPathAbove(source: LayoutNode, target: LayoutNode): string {
  const rightEdgeX = source.x + NODE_W;
  const rightMidY = source.y + NODE_H / 2;
  const extX = rightEdgeX + NODE_GAP_X / 2;
  const approachY = target.y + NODE_H + NODE_GAP_Y / 2;
  const approachX = target.x - NODE_GAP_X / 2;
  const targetMidY = target.y + NODE_H / 2;

  return (
    `M ${rightEdgeX} ${rightMidY} ` +
    `L ${extX} ${rightMidY} ` +
    `L ${extX} ${approachY} ` +
    `L ${approachX} ${approachY} ` +
    `L ${approachX} ${targetMidY} ` +
    `L ${target.x} ${targetMidY}`
  );
}

function nextOrthogonalPath(source: LayoutNode, target: LayoutNode): string {
  return source.y <= target.y ? nextPathBelow(source, target) : nextPathAbove(source, target);
}

// Curved bezier for event → readModel links across different columns or rows.
// Coordinates are always non-negative (layout positions start at 0).
function eventToReadModelBezierPath(source: LayoutNode, target: LayoutNode, sourceIsLeft: boolean): string {
  const sourceX = sourceIsLeft ? source.x + NODE_W : source.x;
  const targetX = sourceIsLeft ? target.x : target.x + NODE_W;
  const sourceY = source.y + NODE_H / 2;
  const sourceIsBelowTarget = sourceY > target.y + NODE_H / 2;
  const targetAnchorY = target.y + (sourceIsBelowTarget ? NODE_H * 0.75 : NODE_H * 0.25);
  const targetApproachY = targetAnchorY + (sourceY - targetAnchorY) * 0.45;
  const horizontalDistance = Math.abs(targetX - sourceX);

  if (horizontalDistance < 1) {
    const sourceCenterX = source.x + NODE_W / 2;
    const targetCenterX = target.x + NODE_W / 2;
    if (!sourceIsBelowTarget) {
      return `M ${sourceCenterX} ${source.y + NODE_H} L ${targetCenterX} ${target.y}`;
    }
    const controlOffset = Math.max(28, NODE_GAP_X);
    const controlX = sourceCenterX - controlOffset;
    return `M ${sourceCenterX} ${sourceY} C ${controlX} ${sourceY}, ${controlX} ${targetApproachY}, ${targetCenterX} ${targetAnchorY}`;
  }

  const controlOffset = Math.max(32, horizontalDistance * 0.45);
  const controlX1 = sourceX + (sourceIsLeft ? controlOffset : -controlOffset);
  const controlX2 = targetX - (sourceIsLeft ? controlOffset : -controlOffset);

  return `M ${sourceX} ${sourceY} C ${controlX1} ${sourceY}, ${controlX2} ${targetApproachY}, ${targetX} ${targetAnchorY}`;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getPointOnPath(d: string, t: number): { x: number; y: number } {
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

  // Walk polyline segments by arc length. Coordinates are always non-negative.
  const coords = d.match(/[\d.]+/g)?.map(Number);
  if (coords && coords.length >= 4) {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i + 1 < coords.length; i += 2) {
      pts.push([coords[i], coords[i + 1]]);
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

  return { x: 0, y: 0 };
}

export function getLinkLabelPosition(d: string): { x: number; y: number } {
  const mid = getPointOnPath(d, 0.5);
  return { x: mid.x, y: mid.y - 6 };
}
