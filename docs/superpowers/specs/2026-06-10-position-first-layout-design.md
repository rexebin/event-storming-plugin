# Position-first, inside-out container sizing

**Date:** 2026-06-10
**Status:** Approved

## Problem

The current layout algorithm estimates container dimensions from graph topology before positioning any nodes, then corrects those dimensions after positioning. This creates two sizing paths that must stay in sync:

- `computeContainerWidth` / `computeContainerHeight` in `sizing.ts` — upfront topology-based estimate
- `computeContainerBounds` in `main.ts` — post-layout correction from actual bounding boxes

The estimate cannot reliably account for note overflow (notes positioned outside the initial bounds) without knowing node positions — which are only available after layout.

## Goal

Single source of truth for container sizing: position content first, measure the bounding box, then pack containers into rows.

## Design

### Three-phase pipeline (per top-level container)

**Phase 1 — Layout**

Position all nodes, groups, subgroups, and notes with the container origin pinned at `(0, 0)`:

- `groupInnerX = CONTAINER_PADDING + GROUP_PADDING`
- `groupInnerY = CONTAINER_HEADER_H + CONTAINER_PADDING + GROUP_HEADER_H + topPad`
- Notes are positioned relative to their parent node as today; negative coords are allowed
- No container size is needed or consulted at this stage

**Phase 2 — Size**

Compute the container's bounding box from all positioned content (nodes, groups, subgroups):

```
minX = min(n.x) for all content nodes
minY = min(n.y) for all content nodes  
maxRight = max(n.x + NODE_W)
maxBottom = max(n.y + NODE_H)

width  = maxRight - minX + CONTAINER_PADDING
height = maxBottom - minY + CONTAINER_PADDING + CONTAINER_BOTTOM_EXTRA
```

If `minX < 0` or `minY < 0` (note overflow to the left/top), the container width/height absorbs the overflow — no separate correction pass needed.

**Phase 3 — Pack + translate**

Pack containers into rows using real sizes (same `MAX_ROW_WIDTH` logic as today). For each container, translate all its nodes, groups, and subgroups by `(cx + |minX|, cy + |minY|)` to bring them to the correct absolute position.

### Changes required

**`src/layout/main.ts`**

- `computeLayout`: replace the interleaved estimate-layout-correct-resize loop with the three-phase structure above. Collect `pendingContainers` with sized content during phase 1+2, then pack and translate in phase 3.
- `computeContainerBounds`: deleted — replaced by bbox calculation in phase 2.
- `expandGroupBoundsForNotes`: deleted — groups are sized from actual node positions in phase 2.
- `layoutProcessGroup`: remove the `groupWidth` parameter. Group width is derived from the node bounding box after positioning, not passed in.
- Overflow correction block (the `topOverflow`/`leftOverflow` shift): deleted — absorbed into the translate step.

**`src/layout/sizing.ts`**

- `computeContainerWidth`: deleted.
- `computeContainerHeight`: deleted.
- `getNonProcessNodes`: keep — still used by unpositioned-node grid layout in `layoutUnpositionedNodes`.
- `computeProcessColumns` / `computeFanInProcessColumns`: move to `src/layout/chains.ts` or `helpers.ts` so they remain available to `layoutFanInProcess` after `sizing.ts` is deleted.

**`src/layout/fan-in.ts`**

- `layoutFanInProcess`: remove the `availableWidth` / `groupWidth` parameter. Derive column width directly from `computeFanInProcessColumns` (already called in `computeProcessColumns` path in sizing.ts today).

### What does NOT change

- Node positioning logic inside `layoutChainFrom`, `layoutAltBranch`, `layoutFanInProcess` — unchanged except removal of the width parameter from fan-in.
- Note position formula: `x = parent.x + noteX * (NODE_W + NODE_GAP_X)`, `y = parent.y - noteY * (NODE_H + NODE_GAP_Y)` — unchanged.
- Row packing logic (`MAX_ROW_WIDTH`, `CONTAINER_GAP_X/Y`) — unchanged, just moves to phase 3.
- Standalone node layout — unchanged.

## Data flow

```
DSLModel
  │
  ▼ Phase 1: layout (origin = 0,0)
  layoutProcessGroup (no groupWidth)
  layoutUnpositionedNodes
  position notes
  │
  ▼ Phase 2: size
  bbox(nodes, groups, subgroups) → containerRef.{width, height}
  │
  ▼ Phase 3: pack + translate
  row packing → (cx, cy) per container
  translate all content by (cx + overflow, cy + overflow)
  │
  ▼
LayoutResult
```

## Testing

- Existing layout tests cover node positions — after this refactor, absolute positions will differ (shifted by `cx, cy`). Tests that assert absolute coordinates will need updating.
- New unit tests for the bbox sizing function with notes that overflow left/top.
- Snapshot/golden tests for end-to-end container positions with multi-container row wrapping.
