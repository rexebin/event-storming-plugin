

import { describe, it, expect } from 'vitest';
import { computeLinkPath } from './links';
import { NODE_W, NODE_H, NODE_GAP_X, NODE_GAP_Y, ALT_BRANCH_GAP } from './layout/constants';

function makeNode(id: string, x: number, y: number, type: string) {
  return { id, x, y, label: '', type, color: '#FEE254', containerId: 'c', processIndex: 0, next: undefined, altNext: undefined, notes: [] } as any;
}

function makeNoteNode(id: string, x: number, y: number, type = 'note') {
  return { id, x, y, label: '', type, color: '#FEE254', containerId: 'c', processIndex: -1, notes: [] } as any;
}

describe('computeLinkPath — default links (next-links)', () => {
  it('uses curved bezier for event → projector same column (target below)', () => {
    const source = makeNode('e', 0, 0, 'event');
    const target = makeNode('rm', 0, 150, 'projector');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).toContain(' C ');
  });

  it('uses curved bezier for event → projector different column (source left)', () => {
    const source = makeNode('e', 0, 0, 'event');
    const target = makeNode('rm', 130 + 36, 50, 'projector');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).toContain(' C ');
  });

  it('uses curved bezier for event → projector different column (source right)', () => {
    const source = makeNode('e', 130 + 36, 50, 'event');
    const target = makeNode('rm', 0, 0, 'projector');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).toContain(' C ');
  });

  it('uses straight line for event → non-projector default link', () => {
    const source = makeNode('e', 0, 50, 'event');
    const target = makeNode('cmd', 130 + 36, 50, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    // Same row: horizontal straight line from right edge to left edge
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('uses straight line for command → command default link', () => {
    const source = makeNode('cmd1', 0, 50, 'command');
    const target = makeNode('cmd2', 130 + 36, 50, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('uses orthogonal routing for policy → non-projector default link across rows', () => {
    const source = makeNode('pol', 0, 50, 'policy');
    const target = makeNode('ext', 130 + 36, 70, 'externalSystem');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+/);
  });

  it('uses straight line for projector → command default link', () => {
    const source = makeNode('rm', 0, 50, 'projector');
    const target = makeNode('cmd', 130 + 36, 50, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('uses straight line for same-row different column links', () => {
    const source = makeNode('a', 0, 50, 'actor');
    const target = makeNode('b', 130 + 36, 50, 'query');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('next-type target below → exits right-edge-mid, 6-segment Z path', () => {
    const source = makeNode('e', 0, 10, 'event');
    const target = makeNode('rm', 130 + 36, 200, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    // M rightEdge rightMidY L extX rightMidY L extX approachY L approachX approachY L approachX targetMidY L targetX targetMidY
    expect(pathD).toMatch(/M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+/);

    const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
    expect(coords).toBeDefined();
    if (coords) {
      expect(coords[0]).toBe(source.x + 130);           // right edge X
      expect(coords[1]).toBe(source.y + 60);             // right edge mid Y
      expect(coords[2]).toBe(source.x + 130 + NODE_GAP_X / 2); // extendedX
      expect(coords[3]).toBe(source.y + 60);             // same Y (horizontal)
      expect(coords[5]).toBe(target.y - NODE_GAP_Y / 2); // approachY (half GAP_Y above target top)
      expect(coords[6]).toBe(target.x - NODE_GAP_X / 2); // approachX (half GAP_X left of target left)
      expect(coords[9]).toBe(target.y + 60);             // target mid Y
      expect(coords[10]).toBe(target.x);                 // target left edge
      expect(coords[11]).toBe(target.y + 60);            // target mid Y
    }
  });

  it('next-type target above → exits right-edge-mid, 6-segment Z path approaching from below', () => {
    const source = makeNode('e', 100, 200, 'event');
    const target = makeNode('rm', 0, 10, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+/);

    const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
    expect(coords).toBeDefined();
    if (coords) {
      expect(coords[0]).toBe(source.x + 130);                   // right edge X
      expect(coords[1]).toBe(source.y + 60);                    // right edge mid Y
      expect(coords[2]).toBe(source.x + 130 + NODE_GAP_X / 2); // extendedX
      expect(coords[3]).toBe(source.y + 60);                    // same Y (horizontal)
      expect(coords[5]).toBe(target.y + 120 + NODE_GAP_Y / 2); // approachY (half GAP_Y below target bottom)
      expect(coords[6]).toBe(target.x - NODE_GAP_X / 2);        // approachX (half GAP_X left of target left)
      expect(coords[9]).toBe(target.y + 60);                    // target mid Y
      expect(coords[10]).toBe(target.x);                        // target left edge
      expect(coords[11]).toBe(target.y + 60);                   // target mid Y
    }
  });

  it('next-type different columns target below → 6-segment Z, exits right edge', () => {
    const source = makeNode('e', 0, 50, 'event');
    const target = makeNode('rm', 130 + 36, 200, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+/);

    const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
    expect(coords).toBeDefined();
    if (coords) {
      expect(coords[0]).toBe(source.x + 130);           // right edge X
      expect(coords[1]).toBe(source.y + 60);             // right edge mid Y
      expect(coords[2]).toBe(source.x + 130 + NODE_GAP_X / 2); // extendedX
      expect(coords[5]).toBe(target.y - NODE_GAP_Y / 2); // approachY above target top
      expect(coords[10]).toBe(target.x);                 // ends at target left edge
    }
  });

  it('next-type different columns target above → 6-segment Z, approaches from below target', () => {
    const source = makeNode('e', 0, 200, 'event');
    const target = makeNode('rm', 130 + 36, 50, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+/);

    const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
    expect(coords).toBeDefined();
    if (coords) {
      expect(coords[0]).toBe(source.x + 130);                   // right edge X
      expect(coords[1]).toBe(source.y + 60);                    // right edge mid Y
      expect(coords[2]).toBe(source.x + 130 + NODE_GAP_X / 2); // extendedX
      expect(coords[5]).toBe(target.y + 120 + NODE_GAP_Y / 2); // approachY below target bottom
      expect(coords[10]).toBe(target.x);                        // ends at target left edge
    }
  });

  it('next-type same row → straight horizontal line unchanged', () => {
    const source = makeNode('a', 0, 50, 'command');
    const target = makeNode('b', 130 + 36, 50, 'command');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('default cross-row cross-column → orthogonal routing', () => {
    const source = makeNode('pol', 0, 50, 'policy');
    const target = makeNode('ext', 130 + 36, 200, 'externalSystem');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+/);
  });
});

describe('computeLinkPath — note links with grid offsets', () => {
  function makeNoteLink(source: any, target: any, noteX: number, noteY: number) {
    return computeLinkPath(source, target, 'default', false, noteX, noteY);
  }

  describe('vertical notes (noteX === 0, y offset only)', () => {
    it('source below → straight vertical from top of source to bottom of target', () => {
      // noteY=-1 → placed one row below parent; near edges: top-of-note → bottom-of-parent
      const source = makeNoteNode('note', 0, NODE_H + NODE_GAP_Y);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 0, -1);

      expect(pathD).not.toContain(' C ');
      // Path: M 65 262 L 65 120 — vertical from top-of-note to bottom-of-parent
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(65);       // center X = source.x + NODE_W/2 = 0+65
        expect(coords[1]).toBe(142);      // source.y (near edge for below-note in vertical path)
        expect(coords[2]).toBe(65);
        expect(coords[3]).toBe(120);      // target.bottom (near edge for below-note)
      }
    });

    it('source above → straight vertical from bottom of source to top of target', () => {
      // noteY=1 → placed one row above parent; near edges: bottom-of-note → top-of-parent
      const source = makeNoteNode('note', 0, -(NODE_H + NODE_GAP_Y));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 0, 1);

      expect(pathD).not.toContain(' C ');
      // Path: M 65 -22 L 65 0 — from bottom-of-note above to top-of-parent
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(65);       // center X = source.x + NODE_W/2 = 0+65
        expect(coords[1]).toBe(-22);      // source.bottom edge = -142 + 120
        expect(coords[2]).toBe(65);
        expect(coords[3]).toBe(0);        // target.y (top edge of parent, near edge for above-note)
      }
    });

    it('source above with |y|>1 → depart bottom, go left below parent, approach top', () => {
      // noteX=0, noteY=3 → same column, far above; routes from source.bottom via left-detour below parent to target.top
      const source = makeNoteNode('note', 0, -3 * (NODE_H + NODE_GAP_Y + ALT_BRANCH_GAP));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 0, 3);

      expect(pathD).not.toContain(' C ');
      // source.y = -486; source.bottom = -486 + 120 = -366
      // gapBelowParentY = NODE_H + (GAP_Y+ALT)/2 = 120 + 21 = 141
      // Expected: M 0 -366 L -18 -366 L -18 141 L 0 0
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords.length).toBe(8);
        expect(coords[0]).toBe(0);         // source.leftX
        expect(coords[1]).toBe(-426);      // midLeftY = source.y + NH/2 = -486+60 (above |y|>1)
        expect(coords[2]).toBe(-18);       // left-detour X
        expect(coords[3]).toBe(-426);      // same Y, horizontal extension
        expect(coords[4]).toBe(-18);       // left-detour X stays constant
        expect(coords[5]).toBe(60);        // NODE_H/2
        expect(coords[6]).toBe(0);         // target.leftX
        expect(coords[7]).toBe(60);         // target.y (top edge, near edge for above-note)
      }
    });

    it('source below with |y|>1 → depart top, go left above parent, approach bottom', () => {
      // noteX=0, noteY=-3 → same column, far below; routes from source.bottom via left-detour above parent to target.bottom
      const source = makeNoteNode('note', 0, 3 * (NODE_H + NODE_GAP_Y + ALT_BRANCH_GAP));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 0, -3);

      expect(pathD).not.toContain(' C ');
      // source.y = 486; source.bottom = 486 + 120 = 606
      // gapAboveParentY = -(GAP_Y+ALT)/2 = -21
      // Expected: M 0 606 L -18 606 L -18 -21 L 0 120
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords.length).toBe(8);
        expect(coords[0]).toBe(0);         // source.leftX
        expect(coords[1]).toBe(546);       // midLeftY = source.y + NH/2 = 486+60 (below |y|>1)
        expect(coords[2]).toBe(-18);       // left-detour X
        expect(coords[3]).toBe(546);       // same Y, horizontal extension
        expect(coords[4]).toBe(-18);       // left-detour X stays constant
        expect(coords[5]).toBe(60);        // NODE_H/2
        expect(coords[6]).toBe(0);         // target.leftX
        expect(coords[7]).toBe(60);       // target.bottom (near edge for below-note)
      }
    });

  });

  describe('horizontal notes (noteY === 0, x offset only)', () => {
    it('source right adjacent → straight horizontal from left of source to right of target', () => {
      // near edges: left-of-note → right-of-parent
      const source = makeNoteNode('note', NODE_W + NODE_GAP_X, 0);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 1, 0);

      expect(pathD).not.toContain(' C ');
      // Path: M 166 60 L 130 60 — horizontal from near edges
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(166);    // source.x = (NODE_W+NODE_GAP_X) = 130+36
        expect(coords[1]).toBe(60);     // center Y = NODE_H/2
        expect(coords[2]).toBe(130);    // target.rightX = target.x + NODE_W = 0+130
        expect(coords[3]).toBe(60);     // same Y
      }
    });

    it('source left adjacent → straight horizontal from right of source to left of target', () => {
      // near edges: right-of-note → left-of-parent
      const source = makeNoteNode('note', -(NODE_W + NODE_GAP_X), 0);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, -1, 0);

      expect(pathD).not.toContain(' C ');
      // source.x+NODE_W=-36 (right edge); target.x=0 (left edge)
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(-36);    // right edge of source (near edge)
        expect(coords[1]).toBe(60);     // center Y
        expect(coords[2]).toBe(0);      // left edge of target (near edge)
        expect(coords[3]).toBe(60);     // same Y
      }
    });

    it('source right non-adjacent (noteX=2) → top-center detour from source CX up then horizontal to parent CX', () => {
      // Routes from source top-edge middle, up by (GAP_Y + ALT_BRANCH_GAP)/2, then horizontal to target
      const source = makeNoteNode('note', 2 * (NODE_W + NODE_GAP_X), 0);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 2, 0);

      expect(pathD).not.toContain(' C ');
      // source_cx=397, source.y=0, detourY=0-(22+20)/2=-21, target_cx=65, target.y=0
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(397);    // source center X
        expect(coords[1]).toBe(0);      // top edge of source
        expect(coords[2]).toBe(397);    // same X (going up)
        expect(coords[3]).toBe(-21);    // source.y - (GAP_Y + ALT_BRANCH_GAP)/2 = 0-21
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(-21);    // same detour Y
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(0);      // top edge of target
      }
    });

    it('source left non-adjacent (noteX=-2) → top-center detour from source CX up then horizontal to parent CX', () => {
      // Routes from source top-edge middle, up by (GAP_Y + ALT_BRANCH_GAP)/2, then horizontal to target
      const source = makeNoteNode('note', -2 * (NODE_W + NODE_GAP_X), 0);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, -2, 0);

      expect(pathD).not.toContain(' C ');
      // source_cx=-267, source.y=0, detourY=0-21=-21, target_cx=65, target.y=0
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(-267);   // source center X (-332 + 65)
        expect(coords[1]).toBe(0);      // top edge of source
        expect(coords[2]).toBe(-267);   // same X (going up)
        expect(coords[3]).toBe(-21);    // source.y - 21
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(-21);    // same detour Y
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(0);      // top edge of target
      }
    });
  });

  describe('orthogonal notes (both x and y non-zero)', () => {
    // 3-segment path: vertical departure from bottom edge, down/up toward midpoint, horizontal to parent center-X, then vertical to parent near edge.
    // note above (y>0): bottom-of-note → down to step → horiz to parent-cx → top-of-parent
    // note below (y<0): bottom-of-note → down to step → horiz to parent-cx → bottom-of-parent

    it('source below-right → top of source, up GAP_Y/2, horizontal to parent CX, up to parent bottom', () => {
      const source = makeNoteNode('note', NODE_W + NODE_GAP_X, NODE_H + NODE_GAP_Y);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 1, -1);

      expect(pathD).not.toContain(' C ');
      // Path: M 231 142 L 231 131 L 65 131 L 65 120 — source.y(142)>target.y(0): below branch, depart from source.top→down→horiz→parent.bottom
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(231);    // source center X
        expect(coords[1]).toBe(142);    // source.y = 142 + 0 (=NODE_H*0 for below branch |y|<=1)
        expect(coords[2]).toBe(231);    // same X (vertical segment)
        expect(coords[3]).toBe(131);    // step1Y = Math.round((source.y+NODE_H+target.y)/2)
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(131);    // same Y (horizontal segment)
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(120);    // target.bottom (near edge for below-note)
      }
    });

    it('source above-left → bottom of source, down GAP_Y/2, horizontal to parent CX, down to parent top', () => {
      const source = makeNoteNode('note', -(NODE_W + NODE_GAP_X), -(NODE_H + NODE_GAP_Y));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, -1, 1);

      expect(pathD).not.toContain(' C ');
      // Path: M -101 -22 L -101 -11 L 65 -11 L 65 0 — above-left: bottom-of-note→down→horiz→parent.top
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(-101);   // source center X = -(NODE_W+NODE_GAP_X)+NODE_W/2 = -166+65=-101
        expect(coords[1]).toBe(-22);    // source.bottom = -142 + 120
        expect(coords[2]).toBe(-101);   // same X (vertical segment)
        expect(coords[3]).toBe(-11);    // Math.round((-142+120+0)/2) = -11
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(-11);    // same Y (horizontal segment)
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(0);      // target.y (top edge, near edge for above-note)
      }
    });

    it('source below-left → top of source, up GAP_Y/2, horizontal to parent CX, down to parent bottom', () => {
      const source = makeNoteNode('note', -(NODE_W + NODE_GAP_X), NODE_H + NODE_GAP_Y);
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, -1, -1);

      expect(pathD).not.toContain(' C ');
      // Path: M -101 262 L -101 191 L 65 191 L 65 120 — source.y(142)>target.y(0): below branch, depart from source.top→down→horiz→parent.bottom
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(-101);   // source center X = -166 + 65
        expect(coords[1]).toBe(142);    // source.y (below branch |y|<=1 departs from source.y)
        expect(coords[2]).toBe(-101);   // same X (vertical segment)
        expect(coords[3]).toBe(131);    // step1Y = Math.round((source.y+NODE_H+target.y)/2)
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(131);    // step1Y = Math.round((source.y+NODE_H+target.y)/2) for |noteY|<=1
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(120);    // target.bottom (near edge for below-note)
      }
    });

    it('source above-right → bottom of source, down to step, horizontal to parent CX, to parent top', () => {
      const source = makeNoteNode('note', NODE_W + NODE_GAP_X, -(NODE_H + NODE_GAP_Y));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 1, 1);

      expect(pathD).not.toContain(' C ');
      // Path: M 231 -22 L 231 -11 L 65 -11 L 65 0 — above-right: bottom-of-note→down→horiz→parent.top
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(231);    // source center X
        expect(coords[1]).toBe(-22);    // source.bottom = -142 + 120
        expect(coords[2]).toBe(231);    // same X (vertical segment)
        expect(coords[3]).toBe(-11);    // Math.round((-142+120+0)/2) = -11
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(-11);    // same Y (horizontal segment)
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(0);      // target.y (top edge, near edge for above-note)
      }
    });

    it('wide below-right (x=2,y=-2) → 5-segment column-gap routing to parent bottom', () => {
      const source = makeNoteNode('note', 2 * (NODE_W + NODE_GAP_X), 2 * (NODE_H + NODE_GAP_Y));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 2, -2);

      expect(pathD).not.toContain(' C ');
      // Path: M 397 284 L 397 263 L 148 263 L 148 141 L 65 141 L 65
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(397);    // source center X
        expect(coords[1]).toBe(284);    // source.y = 284 (below branch |y|>1 departs from source.y)
        expect(coords[2]).toBe(397);    // same X
        expect(coords[3]).toBe(263);    // step1Y = midLeftY - GAP = 284+60-21
        expect(coords[4]).toBe(148);    // column gap right of parent
        expect(coords[5]).toBe(263);    // same Y (horizontal)
        expect(coords[6]).toBe(148);    // same X
        expect(coords[7]).toBe(141);    // gapBelowParentY = NODE_H + (GAP_Y+ALT)/2 = 120+21
        expect(coords[8]).toBe(65);     // target center X
        expect(coords[9]).toBe(141);    // gapBelowParentY
        expect(coords[10]).toBe(65);    // target center X
        expect(coords[11]).toBe(120);   // bottom edge of target (near edge for below-note)
      }
    });

    it('wide above-left (x=-2,y=2) → 5-segment column-gap routing to parent top', () => {
      const source = makeNoteNode('note', -2 * (NODE_W + NODE_GAP_X), -2 * (NODE_H + NODE_GAP_Y));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, -2, 2);

      expect(pathD).not.toContain(' C ');
      // Path: M -267 -164 L -267 -143 L -18 -143 L -18 141 L 65 141 L 65
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(-267);   // source center X
        expect(coords[1]).toBe(-164);   // source.bottom = -284 + 120 (code uses source.bottom for wide above)
        expect(coords[2]).toBe(-267);   // same X
        expect(coords[3]).toBe(-143);   // step1Y = source.y + NODE_H + GAP = -284+120+21
        expect(coords[4]).toBe(-18);    // column gap left of parent
        expect(coords[5]).toBe(-143);   // same Y (horizontal)
        expect(coords[6]).toBe(-18);    // same X
        expect(coords[7]).toBe(-21);    // gapAboveParentY = -(GAP_Y+ALT)/2 = -21 for above case
        expect(coords[8]).toBe(65);     // target center X
        expect(coords[9]).toBe(-21);    // same Y (gapAboveParentY)
        expect(coords[10]).toBe(65);    // target center X
        expect(coords[11]).toBe(0);     // target.y (top edge, near edge for above-note)
      }
    });

    it('mixed (x=2,y=1) → 3-segment orthogonal to parent top', () => {
      const source = makeNoteNode('note', 2 * (NODE_W + NODE_GAP_X), -(NODE_H + NODE_GAP_Y));
      const target = makeNoteNode('parent', 0, 0, 'command');
      const pathD = makeNoteLink(source, target, 2, 1);

      expect(pathD).not.toContain(' C ');
      // Path: M 397 -22 L 397 -11 L 65 -11 L 65 0 — above-right: bottom-of-note→down→horiz→parent.top
      const coords = pathD.match(/-?[\d.]+/g)?.map(Number);
      expect(coords).toBeDefined();
      if (coords) {
        expect(coords[0]).toBe(397);    // source center X
        expect(coords[1]).toBe(-22);    // source.bottom = -142 + 120
        expect(coords[2]).toBe(397);    // same X
        expect(coords[3]).toBe(-11);    // Math.round((-142+120+0)/2) = -11
        expect(coords[4]).toBe(65);     // target center X
        expect(coords[5]).toBe(-11);    // same Y (horizontal segment)
        expect(coords[6]).toBe(65);     // target center X
        expect(coords[7]).toBe(0);      // target.y (top edge, near edge for above-note)
      }
    });
  });
});
