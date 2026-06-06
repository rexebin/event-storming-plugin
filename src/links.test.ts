

import { describe, it, expect } from 'vitest';
import { computeLinkPath } from './links.js';

function makeNode(id: string, x: number, y: number, type: string) {
  return { id, x, y, label: '', type, color: '#FEE254', containerId: 'c', processIndex: 0, noteTarget: null, next: undefined, altNext: undefined, notes: [] } as any;
}

describe('computeLinkPath — default links (next-links)', () => {
  it('uses curved bezier for event → readModel same column (target below)', () => {
    const source = makeNode('e', 0, 0, 'event');
    const target = makeNode('rm', 0, 150, 'readModel');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).toContain(' C ');
  });

  it('uses curved bezier for event → readModel different column (source left)', () => {
    const source = makeNode('e', 0, 0, 'event');
    const target = makeNode('rm', 130 + 36, 50, 'readModel');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).toContain(' C ');
  });

  it('uses curved bezier for event → readModel different column (source right)', () => {
    const source = makeNode('e', 130 + 36, 50, 'event');
    const target = makeNode('rm', 0, 0, 'readModel');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).toContain(' C ');
  });

  it('uses straight line for event → non-readModel default link', () => {
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

  it('uses straight line for policy → non-readModel default link', () => {
    const source = makeNode('pol', 0, 50, 'policy');
    const target = makeNode('ext', 130 + 36, 70, 'externalSystem');
    const pathD = computeLinkPath(source, target, 'default');

    expect(pathD).not.toContain(' C ');
    expect(pathD).toMatch(/^M \d+ \d+ L \d+ \d+$/);
  });

  it('uses straight line for readModel → command default link', () => {
    const source = makeNode('rm', 0, 50, 'readModel');
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
});
