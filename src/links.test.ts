

import { describe, it, expect } from 'vitest';
import { computeLinkPath } from './links';
import { NODE_GAP_X, NODE_GAP_Y } from './layout';

function makeNode(id: string, x: number, y: number, type: string) {
  return { id, x, y, label: '', type, color: '#FEE254', containerId: 'c', processIndex: 0, noteTarget: null, next: undefined, altNext: undefined, notes: [] } as any;
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
