---
sessionId: session-260609-184256-1ug2
---

# Requirements

### Overview & Goals
When the XML DSL contains syntax errors, all three renderer paths (Playground, VSCode preview, GitHub browser extension) currently crash and show a blank area. This plan ensures users see a clear, safe error message instead of nothing.

### Scope

**In Scope:**
- Playground (`DiagramPreview.tsx` via `useRenderer` → `renderEventStorming()`)
- VSCode preview (`vscode-preview.ts` → `block-render.ts` → `mountRenderedBlock`) 
- GitHub browser extension (`content.ts` → `mountRenderedBlock` in `block-render.ts` — **shares code with VSCode path**)

**Out of Scope:**
- Changes to the parser itself (errors are caught at rendering boundaries, not inside `parseDSL`)
- Logging or telemetry for errors
- Error recovery (retry mechanism)

### User Stories
- As a **diagram author**, when my event storming DSL has a syntax error, I see a clear message explaining what went wrong instead of a blank area.
- As a **GitHub user** browsing a repo with event storming diagrams, if the markdown contains malformed DSL code inside fenced blocks, I see the error overlaid within the same block area.

### Functional Requirements
1. Error messages must display **where the diagram would normally appear**, not just on console.
2. Error messages must use `textContent` only — no HTML injection to prevent XSS from user-authored DSL text.
3. Error messages should be truncated at ~200 characters with a "..." suffix if longer.
4. Styling should visually distinguish error areas from successful diagrams.

### Non-Functional Requirements
- Additive change only — existing success paths are unaffected.
- No breaking changes to public APIs or return types (`renderEventStorming` still throws on parse errors; callers handle them).
- The browser extension's error overlay must not interfere with GitHub's native UI elements.

# Technical Design

### Current Implementation
There are three independent entry points into the rendering pipeline:

1. **Playground**: `playground/src/components/DiagramPreview.tsx` receives DSL text, passes it to `useRenderer()` hook (in `@/hooks/useRenderer`), which calls `renderEventStorming()` from D3.
2. **VSCode preview**: `src/vscode-preview.ts` → `block-render.ts:mountRenderedBlock()` → calls `parseDSL(dslText)` at L11, then `renderEventStorming()` via D3 selection.
3. **Browser extension (GitHub)**: `src/content.ts` → same `mountRenderedBlock()` from `block-render.ts`. Built by `build.mjs` as an IIFE content script.

The shared function `mountRenderedBlock` (in `block-render.ts`) is the convergence point for paths 2 and 3. It currently calls `parseDSL(dslText)` directly at line 11 without error handling, then constructs DOM elements (`header`, `canvasWrapper`, `legend`), and calls `renderEventStorming()`.

### Key Decisions

**Decision 1: Centralize VSCode + browser extension error handling in `block-render.ts`**
- Rationale: Both VSCode preview (via MutationObserver scanning `<pre>` blocks) and the GitHub browser extension use the exact same `mountRenderedBlock()` function. A single try/catch here covers both.

**Decision 2: Handle Playground errors separately via the `render` callback in `useRenderer`**
- Rationale: The Playground uses a different code path — it calls `renderEventStorming()` from D3 directly within a `useEffect`, not through `mountRenderedBlock`. Error handling lives at the React component level.

**Decision 3: Show inline DOM error overlay (not alert/toast)**
- Rationale: Users expect to see what went wrong right where they expected the diagram. Toast/alert would require extra interaction and could be missed.

### Architecture

```
┌─ Playground ───────────────────────┐
│  DiagramPreview.tsx                 │        ┌─ VSCode Preview ───────────────┐
│    useEffect → render(dsl)         │        │  vscode-preview.ts              │
│           try/catch at call site   │        │    scanAndRender()              │
│           shows DOM error element  │        │      ↓                           │
│                                    │        │  block-render.ts                │
└────────────────────────────────────┘        │    mountRenderedBlock() ───→    │ ←───┐
┌── Browser Extension (GitHub) ──────────────┤      try/catch around:              │     │
│  content.ts                                │      - parseDSL()                  │     │
│    scanAndRender()                         │      - renderEventStorming()       │     │
│      ↓                                      │                                     │     │
│    mountRenderedBlock(highlightDiv, dsl)   │  On error: show styled error        │     │
│    (shared with VSCode path)               │  overlay in canvasWrapper          │     │
└────────────────────────────────────────────┘                                     │     │
                                                                                   │     │
            ┌──────────────────────────────────────────────────────────────────────┴─────┘
            │ style.css: .es-error-display (shared for VSCode + browser extension)
            │ style.css: .es-diagram-error  (Playground only)
```

### Proposed Changes

#### File: `src/block-render.ts`
- Wrap both calls in `mountRenderedBlock` with try/catch:
  - On success: existing behavior (creates header, canvasWrapper, legend, calls renderEventStorming)
  - On error: instead of calling `renderEventStorming`, create an `.es-error-display` div inside `canvasWrapper` with the error text. The returned `{ container, destroy }` still works — `destroy()` removes the HTML overlay.
- Error text set via `textContent` (never innerHTML) for XSS safety.
- Error message truncated at 200 chars.

#### File: `src/render/main.ts`
- Add error handling wrapper around `parseDSL` + `computeLayout` call so D3 users (Playground path) can detect failures early. Return an extended object or let caller handle — since Playground wraps the `render()` callback, it's sufficient to handle errors at the call site without modifying this file.

#### File: `playground/src/components/DiagramPreview.tsx`
- Wrap the `render(dslText)` call inside useEffect in try/catch. On error, render a DOM `<div>` with an error message as a sibling of the container element.

#### File: `style.css`
- Add `.es-error-display` styles for the inline error overlay used by VSCode and browser extension (positioned over canvasWrapper, red background, readable text).
- Add `.es-diagram-error` styles for Playground errors.

# Delivery Steps

### ✓ Step 1: Stage 1: Add error display to block-render.ts (covers VSCode + browser extension)
- Wrap both `parseDSL(dslText)` and `renderEventStorming(d3Container, dslText)` in a try/catch block inside `mountRenderedBlock()`.
- On success: keep existing behavior unchanged (header + canvasWrapper + legend DOM construction + D3 render).
- On error: before calling `renderEventStorming`, instead create an `.es-error-display` div inside `canvasWrapper` and set its `textContent` to the truncated error message.
- Always return `{ container, destroy }` with working cleanup — on error, `destroy()` removes the overlay HTML element.
- Truncate error messages at 200 characters; use `textContent` only (never innerHTML) for XSS safety.

### ✓ Step 2: Stage 2: Add error display to Playground DiagramPreview.tsx
- Wrap the `render(dslText)` call inside useEffect in DiagramPreview with try/catch.
- On success: keep existing behavior.
- On error: conditionally render a `<div className="es-diagram-error">` showing the truncated error message as a sibling of the container, using textContent.
- Clear error state when `render()` succeeds on re-render.

### ✓ Step 3: Stage 3: Add CSS styles for error displays in style.css
- Add `.es-error-display` CSS class in style.css: positioned overlay with red/orange error styling, readable white or dark text, padding, rounded corners.
- Add `.es-diagram-error` CSS class for Playground: inline error banner with similar styling but adapted for the Playground layout.
- Ensure styles don't leak into or conflict with GitHub's native UI elements (scoped to our container classes).