# Renderer Refactor Plan

## Goal
Improve maintainability and readability of `src/renderer.ts` by extracting rendering phases into focused functions.

## Changes

### 1. Extract constants (constants.ts)
- Move `badgeWidths` hardcoded record from renderer:line125 → `CONTAINER_BADGE_WIDTHS` in constants.ts

### 2. Extract helper functions in renderer.ts
Extract these functions (all take D3 selection + data, mutate in place):

| Function | Lines | Data params | Responsibility |
|---|---|---|---|
| `renderDefs(svg)` | 47-74 | svg | Create defs, shadow filter, arrow marker |
| `renderContainers(g, containers, offsetX)` | 81-151 | containers | Draw container rects, headers, badges, notes |
| `renderGroups(g, groups, offsetX)` | 153-185 | groups | Draw process group boxes |
| `renderSubGroups(g, subGroups, offsetX)` | 189-219 | subGroups | Draw inline nested containers |
| `renderNodes(g, nodes, offsetX, model)` | 223-289 | nodes+model | Draw post-it nodes with notes & text |
| `renderLinks(g, links, nodes, offsetX)` | 293-334 | links+nodes | Draw link paths with arrowheads & labels |
| `setupZoom(svg)` | 338-350 | svg | Apply zoom behavior to all groups |
| `setupTooltips(nodesGroup, nodes, model)` | 352-397 | nodes+model+tooltip | Bind mouseenter/mousemove/mouseleave handlers |

### 3. Simplify renderEventStorming main flow
After extraction, the main function becomes a clean top-level orchestration:
```
parseDSL → computeLayout → measure container width
create svg + defs
render containers
render groups  
render sub-groups
render nodes → setup tooltips on result
render links
setup zoom
return { svg, model, destroy }
```

### 4. Tests
No new functionality — all existing tests should pass without modification. Verify with vitest.

## Files changed
- `src/constants.ts` — add `CONTAINER_BADGE_WIDTHS`
- `src/renderer.ts` — extract 8 functions, simplify main flow
- `src/renderer.test.ts` — no changes expected
