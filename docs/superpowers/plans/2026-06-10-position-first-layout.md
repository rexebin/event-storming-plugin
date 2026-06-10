# Position-first Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-pass container sizing (topology estimate + bounding-box correction) with a single-pass, position-first approach: layout all content at origin (0,0), compute real size from bounding box, then pack containers into rows and translate.

**Architecture:** Three phases per container — (1) layout process groups and notes with container origin fixed at (0,0), (2) compute container size from the bounding box of positioned content, (3) pack containers into rows and translate all content to final absolute positions. Group bounds still expand for notes after note positioning.

**Tech Stack:** TypeScript, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/layout/fan-in.ts` | Remove `processWidth` param from `layoutFanInProcess`; derive internally from `computeFanInProcessColumns` |
| `src/layout/main.ts` | Remove `groupWidth` from `layoutProcessGroup`; remove `containerW` from `layoutUnpositionedNodes`; refactor `computeLayout` to three-phase; delete `computeContainerBounds` |
| `src/layout/sizing.ts` | Delete entire file |
| `src/layout/index.ts` | Remove `computeContainerWidth`/`computeContainerHeight` export line |
| `src/renderer.test.ts` | Remove `computeContainerHeight` import and its one direct test |

---

## Task 1: Remove `processWidth` from `layoutFanInProcess`

The `processWidth` parameter is only used in the two-sided layout branch to compute `targetX`. It can be derived from `computeFanInProcessColumns`, which already lives in the same file.

**Files:**
- Modify: `src/layout/fan-in.ts:11-120`

- [ ] **Step 1: Verify the test suite passes before any change**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -5
```
Expected: all tests green.

- [ ] **Step 2: Remove `processWidth` from the signature and compute it internally**

In `src/layout/fan-in.ts`, replace the function signature and the first few lines of the two-sided branch:

Old signature (line 11–23):
```typescript
export function layoutFanInProcess(
  roots: DSLNode[],
  target: DSLNode,
  innerX: number,
  processY: number,
  container: import('../parser/').DSLContainer,
  processWidth: number,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  processPositioned: Set<string>,
  positioned: Set<string>,
): number {
  const rowHeight = NODE_H + NODE_GAP_Y;
  const useTwoSidedLayout = container.type === 'projector' || target.type === 'view';
```

New signature (remove `processWidth`, derive it internally):
```typescript
export function layoutFanInProcess(
  roots: DSLNode[],
  target: DSLNode,
  innerX: number,
  processY: number,
  container: import('../parser/').DSLContainer,
  model: DSLModel,
  processNodeMap: Map<string, DSLNode>,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  processPositioned: Set<string>,
  positioned: Set<string>,
): number {
  const rowHeight = NODE_H + NODE_GAP_Y;
  const useTwoSidedLayout = container.type === 'projector' || target.type === 'view';
  const cols = computeFanInProcessColumns(roots, target, processNodeMap, container);
  const processWidth = cols * (NODE_W + NODE_GAP_X) - NODE_GAP_X;
```

- [ ] **Step 3: Update the call site in `src/layout/main.ts`**

In `layoutProcessGroup`, find the call to `layoutFanInProcess` (around line 133–138):

Old:
```typescript
    processBottom = layoutFanInProcess(
      roots, fanInTarget, groupInnerX, groupInnerY, container,
      groupWidth - GROUP_PADDING * 2, model, processNodeMap,
      allNodes, allLinks, processPositioned, positioned,
    );
```

New (remove the `groupWidth - GROUP_PADDING * 2` argument):
```typescript
    processBottom = layoutFanInProcess(
      roots, fanInTarget, groupInnerX, groupInnerY, container,
      model, processNodeMap,
      allNodes, allLinks, processPositioned, positioned,
    );
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -5
```
Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/layout/fan-in.ts src/layout/main.ts
git commit -m "refactor: derive processWidth from column count in layoutFanInProcess"
```

---

## Task 2: Remove `groupWidth` from `layoutProcessGroup`

`groupWidth` is used to: (a) set initial group width, (b) pass to `layoutFanInProcess` (now removed). Replace with actual node bounding box after positioning.

**Files:**
- Modify: `src/layout/main.ts:100-199`

- [ ] **Step 1: Remove `groupWidth` from the `layoutProcessGroup` signature**

Change the function signature from:
```typescript
function layoutProcessGroup(
  process: DSLProcess,
  processIndex: number,
  container: DSLContainer,
  model: DSLModel,
  groupX: number,
  groupY: number,
  groupWidth: number,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  allGroups: LayoutGroup[],
  allSubGroups: LayoutSubGroup[],
  positioned: Set<string>,
): number {
```

To:
```typescript
function layoutProcessGroup(
  process: DSLProcess,
  processIndex: number,
  container: DSLContainer,
  model: DSLModel,
  groupX: number,
  groupY: number,
  allNodes: LayoutNode[],
  allLinks: LayoutLink[],
  allGroups: LayoutGroup[],
  allSubGroups: LayoutSubGroup[],
  positioned: Set<string>,
): number {
```

- [ ] **Step 2: Replace initial group width with bounding-box derivation**

Find the `processGroupRef` construction and the "Grow process group rightward" block at the end of `layoutProcessGroup`. Replace both with a single bbox-derived initial width.

Old (lines ~165–196):
```typescript
  const processGroupRef: LayoutGroup = {
    id: `${container.id}_group_${processIndex}`,
    label: process.name,
    type: container.type,
    containerId: container.id,
    x: groupX,
    y: groupY,
    width: groupWidth,
    height: Math.max(GROUP_HEADER_H + GROUP_PADDING * 2 + NODE_H, processBottom - groupY + GROUP_PADDING),
    notes: process.notes,
  };
  allGroups.push(processGroupRef);

  if (process.subGroups) {
    for (const sg of buildSubGroupBBoxes(process, processIndex, container, allNodes)) {
      allSubGroups.push(sg);
      const sgRight = sg.x + sg.width;
      const sgBottom = sg.y + sg.height;
      if (sgBottom + GROUP_PADDING > processGroupRef.y + processGroupRef.height)
        processGroupRef.height = sgBottom + GROUP_PADDING - processGroupRef.y;
      if (sgRight + GROUP_PADDING > processGroupRef.x + processGroupRef.width)
        processGroupRef.width = sgRight + GROUP_PADDING - processGroupRef.x;
    }
  }

  // Grow process group rightward for offset nodes that exceed its boundary.
  const maxNodeRight = processNodes.reduce((max, n) => {
    const ln = allNodes.find((a) => a.id === n.id);
    return ln ? Math.max(max, ln.x + NODE_W) : max;
  }, groupX + GROUP_PADDING);
  if (maxNodeRight + GROUP_PADDING > processGroupRef.x + processGroupRef.width)
    processGroupRef.width = maxNodeRight + GROUP_PADDING - processGroupRef.x;

  return processGroupRef.height;
```

New:
```typescript
  // Derive initial group width from the actual node bounding box.
  const maxNodeRight = processNodes.reduce((max, n) => {
    const ln = allNodes.find((a) => a.id === n.id);
    return ln ? Math.max(max, ln.x + NODE_W) : max;
  }, groupInnerX);
  const initialGroupWidth = maxNodeRight + GROUP_PADDING - groupX;

  const processGroupRef: LayoutGroup = {
    id: `${container.id}_group_${processIndex}`,
    label: process.name,
    type: container.type,
    containerId: container.id,
    x: groupX,
    y: groupY,
    width: initialGroupWidth,
    height: Math.max(GROUP_HEADER_H + GROUP_PADDING * 2 + NODE_H, processBottom - groupY + GROUP_PADDING),
    notes: process.notes,
  };
  allGroups.push(processGroupRef);

  if (process.subGroups) {
    for (const sg of buildSubGroupBBoxes(process, processIndex, container, allNodes)) {
      allSubGroups.push(sg);
      const sgRight = sg.x + sg.width;
      const sgBottom = sg.y + sg.height;
      if (sgBottom + GROUP_PADDING > processGroupRef.y + processGroupRef.height)
        processGroupRef.height = sgBottom + GROUP_PADDING - processGroupRef.y;
      if (sgRight + GROUP_PADDING > processGroupRef.x + processGroupRef.width)
        processGroupRef.width = sgRight + GROUP_PADDING - processGroupRef.x;
    }
  }

  return processGroupRef.height;
```

- [ ] **Step 3: Update the call site in `computeLayout`**

Find the `layoutProcessGroup` call in `computeLayout` (around line 308–312). Remove `groupWidth` from the call:

Old:
```typescript
      const groupX = innerX;
      const groupY = processY;
      const groupWidth = containerW - CONTAINER_PADDING * 2;
      const groupHeight = layoutProcessGroup(
        process, processIndex, container, model,
        groupX, groupY, groupWidth,
        allNodes, allLinks, allGroups, allSubGroups, positioned,
      );
```

New:
```typescript
      const groupHeight = layoutProcessGroup(
        process, processIndex, container, model,
        innerX, processY,
        allNodes, allLinks, allGroups, allSubGroups, positioned,
      );
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -5
```
Expected: all tests green (group widths now come from actual nodes — any group-width-sensitive tests are behavioral and should still pass).

- [ ] **Step 5: Commit**

```bash
git add src/layout/main.ts
git commit -m "refactor: derive layoutProcessGroup width from node bounding box"
```

---

## Task 3: Remove `containerW` from `layoutUnpositionedNodes`

`containerW` is used only for grid-wrap logic. Replace with a fixed 4-column maximum that matches the existing `gridCols = Math.min(nonProcess.length, 4)` estimate.

**Files:**
- Modify: `src/layout/main.ts:201-231`

- [ ] **Step 1: Update `layoutUnpositionedNodes` signature and grid-wrap logic**

Old:
```typescript
function layoutUnpositionedNodes(
  container: DSLContainer,
  model: DSLModel,
  innerX: number,
  startY: number,
  containerW: number,
  positioned: Set<string>,
  allNodes: LayoutNode[],
): void {
  const nonProcessNodes = model.nodes.filter(
    (n) => n.containerId === container.id && n.type !== 'note' && !positioned.has(n.id),
  );
  let npX = innerX;
  let npY = startY + 10;
  for (const np of nonProcessNodes) {
    allNodes.push({ ...np, x: npX, y: npY });
    npX += NODE_W + NODE_GAP_X;
    if (npX - innerX > containerW - CONTAINER_PADDING * 2 - NODE_W) {
      npX = innerX;
      npY += NODE_H + NODE_GAP_Y;
    }
  }
```

New (remove `containerW`, use 4-column constant):
```typescript
const UNPOSITIONED_GRID_COLS = 4;

function layoutUnpositionedNodes(
  container: DSLContainer,
  model: DSLModel,
  innerX: number,
  startY: number,
  positioned: Set<string>,
  allNodes: LayoutNode[],
): void {
  const nonProcessNodes = model.nodes.filter(
    (n) => n.containerId === container.id && n.type !== 'note' && !positioned.has(n.id),
  );
  let col = 0;
  let npX = innerX;
  let npY = startY + 10;
  for (const np of nonProcessNodes) {
    allNodes.push({ ...np, x: npX, y: npY });
    col++;
    if (col >= UNPOSITIONED_GRID_COLS) {
      col = 0;
      npX = innerX;
      npY += NODE_H + NODE_GAP_Y;
    } else {
      npX += NODE_W + NODE_GAP_X;
    }
  }
```

(The orphan-notes block at the end of the function stays unchanged.)

- [ ] **Step 2: Update the call site in `computeLayout`**

Old:
```typescript
    layoutUnpositionedNodes(container, model, innerX, processY, containerW, positioned, allNodes);
```

New:
```typescript
    layoutUnpositionedNodes(container, model, innerX, processY, positioned, allNodes);
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -5
```
Expected: all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/layout/main.ts
git commit -m "refactor: remove containerW from layoutUnpositionedNodes, use fixed 4-col grid"
```

---

## Task 4: Three-phase `computeLayout`

This is the core refactor. Replace the current single-loop (estimate → layout → overflow-correct → resize) with three phases: layout at origin → bbox size → pack+translate.

**Files:**
- Modify: `src/layout/main.ts:272-384`

- [ ] **Step 1: Replace `computeLayout` with the three-phase implementation**

Replace the entire `computeLayout` function body with:

```typescript
export function computeLayout(model: DSLModel): LayoutResult {
  const allNodes: LayoutNode[] = [];
  const allContainers: LayoutContainer[] = [];
  const allGroups: LayoutGroup[] = [];
  const allSubGroups: LayoutSubGroup[] = [];
  const allLinks: LayoutLink[] = [];

  type PendingContainer = {
    containerRef: LayoutContainer;
    treeIds: Set<string>;
    nodeIndices: number[];
    groupIndices: number[];
    subGroupIndices: number[];
  };
  const pending: PendingContainer[] = [];

  for (const container of model.containers) {
    if (container.parentId !== null) continue;

    const treeIds = collectDescendantIds(container.id, model.containers);
    const nodesBefore = allNodes.length;
    const groupsBefore = allGroups.length;
    const subGroupsBefore = allSubGroups.length;

    const innerX = CONTAINER_PADDING;
    const innerY = CONTAINER_HEADER_H + CONTAINER_PADDING;
    const positioned = new Set<string>();
    let processY = innerY;

    container.processes.forEach((process, processIndex) => {
      const groupHeight = layoutProcessGroup(
        process, processIndex, container, model,
        innerX, processY,
        allNodes, allLinks, allGroups, allSubGroups, positioned,
      );
      processY += groupHeight + GROUP_GAP_Y;
    });

    layoutUnpositionedNodes(container, model, innerX, processY, positioned, allNodes);

    for (const note of model.nodes) {
      if (!treeIds.has(note.containerId!) || note.type !== 'note' || !note.parentId) continue;
      if (allNodes.some((n) => n.id === note.id)) continue;
      const parent = allNodes.find((n) => n.id === note.parentId!);
      if (!parent) continue;
      const noteX = note.noteX ?? 0;
      const noteY = note.noteY ?? -1;
      allNodes.push({ ...note, x: parent.x + noteX * (NODE_W + NODE_GAP_X), y: parent.y - noteY * (NODE_H + NODE_GAP_Y) });
      allLinks.push({ source: note.id, target: note.parentId!, label: '', type: 'default', noteX: note.noteX, noteY: note.noteY });
    }

    // Phase 2: compute bounding box over all content for this container tree.
    let minX = innerX;
    let minY = innerY;
    let maxRight = 0;
    let maxBottom = 0;
    for (const n of allNodes.slice(nodesBefore)) {
      if (!treeIds.has(n.containerId!)) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxRight = Math.max(maxRight, n.x + NODE_W);
      maxBottom = Math.max(maxBottom, n.y + NODE_H);
    }
    for (const g of allGroups.slice(groupsBefore)) {
      if (g.containerId !== container.id) continue;
      minX = Math.min(minX, g.x);
      minY = Math.min(minY, g.y);
      maxRight = Math.max(maxRight, g.x + g.width);
      maxBottom = Math.max(maxBottom, g.y + g.height);
    }
    for (const sg of allSubGroups.slice(subGroupsBefore)) {
      if (sg.containerId !== container.id) continue;
      maxRight = Math.max(maxRight, sg.x + sg.width);
      maxBottom = Math.max(maxBottom, sg.y + sg.height);
    }

    // Shift all content if notes overflow the container's left/top boundary.
    const overflowLeft = Math.max(0, CONTAINER_PADDING - minX);
    const overflowTop  = Math.max(0, innerY - minY);
    if (overflowLeft > 0 || overflowTop > 0) {
      for (const n of allNodes)      { if (treeIds.has(n.containerId!))      { n.x += overflowLeft; n.y += overflowTop; } }
      for (const g of allGroups)     { if (g.containerId === container.id)   { g.x += overflowLeft; g.y += overflowTop; } }
      for (const sg of allSubGroups) { if (sg.containerId === container.id)  { sg.x += overflowLeft; sg.y += overflowTop; } }
      maxRight  += overflowLeft;
      maxBottom += overflowTop;
    }

    // Expand each process group to include notes attached to its nodes.
    container.processes.forEach((process, processIndex) => {
      const group = allGroups.find((g) => g.id === `${container.id}_group_${processIndex}`);
      if (!group) return;
      const stepIdSet = new Set(process.stepIds);
      const groupNotes = allNodes.filter((n) => n.type === 'note' && n.parentId && stepIdSet.has(n.parentId));
      expandGroupBoundsForNotes(group, groupNotes);
    });

    const width  = maxRight  + CONTAINER_PADDING;
    const height = maxBottom + CONTAINER_PADDING + CONTAINER_BOTTOM_EXTRA;

    const containerRef: LayoutContainer = { ...container, x: 0, y: 0, width, height, notes: container.notes };
    allContainers.push(containerRef);

    pending.push({
      containerRef,
      treeIds,
      nodeIndices:     allNodes.reduce<number[]>((acc, n, i)  => { if (i >= nodesBefore     && treeIds.has(n.containerId!))     acc.push(i); return acc; }, []),
      groupIndices:    allGroups.reduce<number[]>((acc, g, i) => { if (i >= groupsBefore    && g.containerId === container.id)  acc.push(i); return acc; }, []),
      subGroupIndices: allSubGroups.reduce<number[]>((acc, sg, i) => { if (i >= subGroupsBefore && sg.containerId === container.id) acc.push(i); return acc; }, []),
    });
  }

  // Phase 3: pack containers into rows and translate content to absolute positions.
  let x = 0;
  let y = 0;
  let rowBottom = 0;

  for (const { containerRef, nodeIndices, groupIndices, subGroupIndices } of pending) {
    if (x > 0 && x + containerRef.width > CONTAINER_GAP_X * 2 + MAX_ROW_WIDTH) {
      x = 0;
      y = rowBottom + CONTAINER_GAP_Y;
    }
    const cx = x;
    const cy = y;
    containerRef.x = cx;
    containerRef.y = cy;
    for (const i of nodeIndices)     { allNodes[i].x     += cx; allNodes[i].y     += cy; }
    for (const i of groupIndices)    { allGroups[i].x    += cx; allGroups[i].y    += cy; }
    for (const i of subGroupIndices) { allSubGroups[i].x += cx; allSubGroups[i].y += cy; }
    rowBottom = Math.max(rowBottom, cy + containerRef.height);
    x += containerRef.width + CONTAINER_GAP_X;
  }

  const standaloneNodes = model.nodes.filter((n) => !n.containerId);
  if (standaloneNodes.length > 0) {
    const startY = y > 0 ? y + CONTAINER_GAP_Y : 0;
    layoutStandaloneNodes(standaloneNodes as LayoutNode[], allNodes, 0, startY);
  }

  let totalWidth = 0;
  let totalHeight = 0;
  for (const n of allNodes) {
    totalWidth = Math.max(totalWidth, n.x + NODE_W);
    totalHeight = Math.max(totalHeight, n.y + NODE_H);
  }
  for (const c of allContainers) {
    totalWidth = Math.max(totalWidth, c.x + c.width);
    totalHeight = Math.max(totalHeight, c.y + c.height);
  }

  return { width: totalWidth, height: totalHeight, containers: allContainers, groups: allGroups, subGroups: allSubGroups, nodes: allNodes, links: allLinks };
}
```

- [ ] **Step 2: Remove `computeContainerBounds` function and `computeContainerWidth`/`computeContainerHeight` import from `main.ts`**

Delete the `computeContainerBounds` function (lines 233–268 in the original file).

Remove from the import at the top of `main.ts`:
```typescript
import { computeContainerWidth, computeContainerHeight } from './sizing.js';
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -20
```
Expected: all tests green. If position tests fail due to different absolute values, investigate — the relative positions (node A to node B within a container) must be unchanged; only positions relative to canvas origin may differ.

- [ ] **Step 4: Commit**

```bash
git add src/layout/main.ts
git commit -m "refactor: three-phase computeLayout — position at origin, bbox size, pack+translate"
```

---

## Task 5: Delete `sizing.ts` and clean up exports

**Files:**
- Delete: `src/layout/sizing.ts`
- Modify: `src/layout/index.ts`

- [ ] **Step 1: Remove the sizing export line from `src/layout/index.ts`**

Old (last two lines):
```typescript
// ─── Container sizing ──────────────────────────────────────────

export { computeContainerWidth, computeContainerHeight } from './sizing.js';
```

New: delete those three lines entirely.

- [ ] **Step 2: Delete `src/layout/sizing.ts`**

```bash
rm /Users/rex/dev/event-storming-plugin/src/layout/sizing.ts
```

- [ ] **Step 3: Run tsc to confirm no remaining imports of sizing.ts**

```bash
cd /Users/rex/dev/event-storming-plugin && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -10
```
Expected: all tests green (except the `computeContainerHeight` test which will be fixed in Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/layout/index.ts && git rm src/layout/sizing.ts
git commit -m "refactor: delete sizing.ts — container dimensions now from bounding box"
```

---

## Task 6: Update `renderer.test.ts` — remove `computeContainerHeight` test

The `computeContainerHeight` function is deleted. Its direct test is replaced with a behavioral test: a container with a negative-offset node must be tall enough to contain the node visually.

**Files:**
- Modify: `src/renderer.test.ts`

- [ ] **Step 1: Remove `computeContainerHeight` from the import on line 8**

Old:
```typescript
import { computeLayout, computeContainerHeight, NODE_H, NODE_W, NODE_GAP_X, NODE_GAP_Y, CONTAINER_PADDING, GROUP_PADDING, CONTAINER_HEADER_H } from './layout';
```

New:
```typescript
import { computeLayout, NODE_H, NODE_W, NODE_GAP_X, NODE_GAP_Y, CONTAINER_PADDING, GROUP_PADDING, CONTAINER_HEADER_H } from './layout';
```

- [ ] **Step 2: Replace the direct `computeContainerHeight` test with a behavioral test**

Old (lines 796–804):
```typescript
    it('computeContainerHeight includes extra rows for negative-offset nodes', () => {
      const model = parseDSL(negOffsetXml);
      const container = model.containers[0];
      const height = computeContainerHeight(container, model);
      // base = CONTAINER_HEADER_H + CONTAINER_PADDING*2 + 1*(NODE_H+NODE_GAP_Y) + 10 = 232
      // with 1 node having offset=-1, should add at least one extra row
      const baseOneProcess = CONTAINER_HEADER_H + CONTAINER_PADDING * 2 + (NODE_H + NODE_GAP_Y) + 10;
      expect(height).toBeGreaterThan(baseOneProcess);
    });
```

New (test the behavior via `computeLayout`; `negOffsetXml` has `<command name="B" offset="-1">`):
```typescript
    it('container with a negative-offset node is tall enough to contain it', () => {
      const layout = computeLayout(parseDSL(negOffsetXml));
      const container = layout.containers[0];
      const offsetNode = layout.nodes.find(n => n.label === 'B')!;

      expect(offsetNode).toBeTruthy();
      expect(container.y + container.height).toBeGreaterThanOrEqual(offsetNode.y + NODE_H + CONTAINER_PADDING);
    });
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -10
```
Expected: all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/renderer.test.ts
git commit -m "test: replace computeContainerHeight unit test with behavioral layout assertion"
```

---

## Task 7: Build and verify

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/rex/dev/event-storming-plugin && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 2: Full test run**

```bash
cd /Users/rex/dev/event-storming-plugin && npx vp test run 2>&1 | tail -5
```
Expected: all tests green.

- [ ] **Step 3: Build and install VSIX**

Use the `/vsix-build` skill.
