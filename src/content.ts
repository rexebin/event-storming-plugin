/**
 * Event Storming — GitHub Content Script
 *
 * Scans GitHub pages for fenced code blocks with language "eventstorming"
 * or JSON blocks that match the event storming schema, and replaces them
 * with rendered D3 diagrams.
 */

import { normalizeBlockText, shouldRenderCodeBlock } from './block-detection.js';
import { mountRenderedBlock } from './block-render.js';

// ─── Constants ──────────────────────────────────────────────

const DEBOUNCE_MS = 300;

// ─── State ──────────────────────────────────────────────────

let observer: MutationObserver | null = null;
const rendererInstances = new Map<HTMLElement, { destroy: () => void }>();

// ─── Entry Point ────────────────────────────────────────────

function main(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndRender);
  } else {
    scanAndRender();
  }

  startObserver();
}

// ─── Scanning & Rendering ───────────────────────────────────

/**
 * Find all fenced code blocks we can render and replace them with diagrams.
 */
function scanAndRender(): void {
  // GitHub renders fenced code blocks as:
  // <div class="highlight highlight-text-md"><pre><span class="pl-en">eventstorming</span>...</pre></div>
  // So find all .highlight divs and check if they contain an eventstorming block
  const highlightDivs = document.querySelectorAll<HTMLElement>('div.highlight pre');

  console.log(`[Event Storming] Found ${highlightDivs.length} <pre> blocks in .highlight`);

  for (const pre of highlightDivs) {
  const parent = pre.parentElement;
  // Skip if already rendered
  if (parent?.getAttribute('data-es-rendered') === 'true') continue;

   const langSpan = pre.querySelector('span.pl-en');
   const language = langSpan?.textContent?.trim().toLowerCase();
   const dslText = normalizeBlockText(pre.textContent || '');

   if (shouldRenderCodeBlock(language, dslText)) {
     renderBlock(parent!, dslText);
   }
  }
}

/**
 * Wrap a code block container in a diagram and render the diagram inside.
 */
function renderBlock(highlightDiv: HTMLElement, dslText: string): void {
  const instance = mountRenderedBlock(highlightDiv, dslText);
  rendererInstances.set(instance.container, instance);
}

// ─── Mutation Observer (for SPA navigation) ─────────────────

function startObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }

    if (shouldScan) {
      debouncedScan();
    }
  });

  // Observe the main GitHub content area
  const container =
    document.querySelector<HTMLElement>('#react-partial-root') ??
    document.querySelector<HTMLElement>('.application-main') ??
    document.body;

  observer.observe(container, {
    childList: true,
    subtree: true,
  });
}

// ─── Debounce ───────────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedScan(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log('[Event Storming] Scanning for new blocks...');
    scanAndRender();
  }, DEBOUNCE_MS);
}

// ─── Cleanup ────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
  rendererInstances.forEach((instance) => {
    instance.destroy();
  });
  rendererInstances.clear();
});

// ─── Bootstrap ──────────────────────────────────────────────

// Start (d3 is bundled, no CDN needed)
console.log('[Event Storming] D3.js bundled, initializing…');
main();
