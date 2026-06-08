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
