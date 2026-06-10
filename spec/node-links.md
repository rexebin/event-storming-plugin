Note links currently always go from the right edge of the note to the left edge of the parent node.
This can lead to visual confusion when the note is placed above or below the parent node,
as the link will be orthogonal and may overlap with other elements in the diagram.

To improve the visual clarity of note links, we propose the following changes:
1. Update the note link rendering logic to determine the position of the note relative to its parent node based on the x and y attributes of the note.
2. when x == 0 and y = -1 or 1, render the link vertically from the top or bottom edge of the note to the corresponding edge bottom or top of the parent node.
3. when x == -1 or 1 and y = 0, render the link horizontally (straight line) from the near edge of the note to the near edge of the parent node.
   - when |x| > 1 and y = 0, route from the source top-center: go up by (NODE_GAP_Y + ALT_BRANCH_GAP)/2, travel horizontally to the parent center-X, then drop down to the parent's top edge.
4. when x and y are both non-zero, render an orthogonal path:
   - |y| === 1 (3-segment): start from note's near-Y-edge, turn at the midpoint of the gap between note and parent, reach parent's near-Y-edge.
   - |y| > 1 (5-segment column-gap): depart from note near-Y-edge by GAP_Y/2, route through the column gap beside the parent, approach parent from GAP_Y/2 away.
5. All notes are positioned exactly one gap from their parent, matching the altNext lane gap. The noteY magnitude only controls routing mode (3-segment vs 5-segment), not distance:
   - position Y = parent.y - sign(noteY) * (NODE_H + NODE_GAP_Y + ALT_BRANCH_GAP)

## Implementation

### Changes made:
- `src/layout/models.ts`: Added `noteX?: number` and `noteY?: number` to `LayoutLink` interface.
- `src/layout/main.ts`: Passes `noteX`/`noteY` from positioned notes when creating note-to-parent links. All notes placed at exactly `-sign(noteY) * (NODE_H + NODE_GAP_Y + ALT_BRANCH_GAP)` from parent. The noteY magnitude only selects routing path.
- `src/links/routing.ts`: Extended `computeLinkPath()` to accept optional `noteX`/`noteY` params. When source type is 'note' and both offsets are present, routes via specialized functions:
  - `verticalNotePath()`: straight vertical line from near edge (bottom/top) based on relative screen position.
  - `horizontalNotePath()`: straight line for adjacent (|noteX|=1); top-center detour — go up from source center-X by (GAP_Y+ALT_BRANCH_GAP)/2, horizontal to parent center-X, drop to parent top-edge — for non-adjacent (|noteX|>1).
  - `orthogonalNotePath()`: 3-segment L-path — vertical GAP_Y/2 toward parent first, then horizontal to parent center-X, then vertical to parent near-Y-edge.
- `src/render/render-nodes.ts`: Updated `renderLinks()` to pass noteX/noteY through to `computeLinkPath()`.
- `src/links.test.ts`: Tests for all routing modes.

### Routing behavior:
All notes use consistent bottom-edge departure (source.y + NODE_H). Landing is based on visual position relative to parent.
- Vertical (noteX === 0, |y|=1): straight line from source.bottom → target top/bottom edge via center-X. Above-notes land at target.top; below-notes land at target.bottom.
- Vertical (noteX === 0, |y|>1): left-detour with near-edge departure/landing. Depart source.bottom, go left by gap/2, route below parent for above-notes or above parent for below-notes, approach at gapBelowParentY or gapAboveParentY respectively. Above-notes land at target.top; below-notes land at target.bottom.
- Horizontal adjacent (noteY === 0, |noteX| === 1): near-edge straight line; arrow lands at facing edge of parent
- Horizontal non-adjacent (noteY === 0, |noteX| > 1): 4-segment top-center detour — source center-X upward by (GAP_Y+ALT_BRANCH_GAP)/2 → horizontal to parent center-X → down to parent top edge; arrow at parent facing edge
- Orthogonal |y|=1 (3-segment L-path): depart from source.bottom → down/up to midpoint Y (Math.round((source.y + NODE_H + target.y ± offset) / 2)) → horizontal to parent center-X → vertical to parent near-Y-edge. Above-notes land at target.top; below-notes land at target.bottom.
- Orthogonal |y|>1 (5-segment column-gap): depart from source.bottom, route through column gap. For above-notes: go down via gapBelowParentY; for below-notes: go up via gapAboveParentY. Above-notes land at target.top; below-notes land at target.bottom.
