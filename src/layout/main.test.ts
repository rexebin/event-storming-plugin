/**
 * Regression tests for computeLayout's process-group stacking.
 */

import { describe, it, expect } from 'vitest';
import { computeLayout } from './main';
import { parseDSL } from '../parser/';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('computeLayout — process group stacking with notes', () => {
  it('does not let a positioned note pull a group into the group above it', () => {
    // Two containers under one aggregate, stacked top-to-bottom. The second
    // container's last event has a note positioned above its parent (noteY=1),
    // which previously expanded the second group's box upward into the first.
    const xml = `
      <eventstorming>
        <aggregate name="Care Plan">
          <container name="First Group">
            <actor name="Nurse" />
            <command name="Do First Thing" />
            <event name="First Thing Done" />
          </container>
          <container name="Second Group">
            <actor name="Nurse" />
            <command name="Do Second Thing" />
            <event name="Second Thing Done"><note x="1" y="1">This note used to overlap the group above.</note></event>
          </container>
        </aggregate>
      </eventstorming>
    `;
    const model = parseDSL(xml);
    const layout = computeLayout(model);

    const firstGroup = layout.groups.find((g) => g.label === 'First Group');
    const secondGroup = layout.groups.find((g) => g.label === 'Second Group');
    expect(firstGroup).toBeDefined();
    expect(secondGroup).toBeDefined();
    expect(overlaps(firstGroup!, secondGroup!)).toBe(false);

    // The note should be fully contained within its own group's box.
    const parentNode = layout.nodes.find((n) => n.label === 'Second Thing Done');
    const note = layout.nodes.find((n) => n.parentId === parentNode!.id);
    expect(note).toBeDefined();
    expect(note!.y).toBeGreaterThanOrEqual(secondGroup!.y);
    expect(note!.y).toBeLessThanOrEqual(secondGroup!.y + secondGroup!.height);

    // No group should overlap any other group within the same container tree.
    for (let i = 0; i < layout.groups.length; i++) {
      for (let j = i + 1; j < layout.groups.length; j++) {
        const a = layout.groups[i];
        const b = layout.groups[j];
        if (a.containerId === b.containerId) {
          expect(overlaps(a, b)).toBe(false);
        }
      }
    }
  });
});
