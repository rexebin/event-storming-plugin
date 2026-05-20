/**
 * Event Storming — GitHub Content Script
 *
 * Scans GitHub pages for fenced code blocks with language "eventstorming"
 * or JSON blocks that match the event storming schema, and replaces them
 * with rendered D3 diagrams.
 */

import { isEventStormingJSON } from './dsl.js';
import { renderEventStorming } from './renderer.js';
import * as d3 from 'd3';

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
   let dslText = pre.textContent || '';
   dslText = dslText.replace(/^\`\`\`.*\n?/, '').replace(/\n?\`\`\`.*$/, '').trim();

   const shouldRender =
     language === 'eventstorming' ||
     (language === 'json' && isEventStormingJSON(dslText));

   if (shouldRender && dslText.length > 0) {
     renderBlock(parent!, dslText);
   }
  }
}

/**
 * Wrap a code block container in a diagram and render the diagram inside.
 */
function renderBlock(highlightDiv: HTMLElement, dslText: string): void {
  // Create the wrapper container
  const container = document.createElement('div');
  container.className = 'event-storming-container';

  // Build header
  const header = document.createElement('div');
  header.className = 'es-header';

  const badge = document.createElement('span');
  badge.className = 'es-badge';
  badge.textContent = 'Event Storming';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'es-title';

  // Extract title from DSL
  const titleMatch = dslText.match(/^# Title:\s*(.+)$/m);
  titleSpan.textContent = titleMatch ? titleMatch[1].trim() : 'Event Storming';

  header.appendChild(badge);
  header.appendChild(titleSpan);
  container.appendChild(header);

  // Toggle button
  const toggle = document.createElement('button');
  toggle.className = 'es-toggle';
  toggle.setAttribute('aria-label', 'Toggle diagram');
  toggle.addEventListener('click', () => {
    container.classList.toggle('collapsed');
  });
  container.appendChild(toggle);

  // Canvas wrapper
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'es-canvas-wrapper';
  container.appendChild(canvasWrapper);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'es-legend';
  legend.innerHTML = `
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FFA500"></span> Domain Event
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#91D49C"></span> Command
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FEE254"></span> Aggregate
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#D4D3D3"></span> Actor
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#859EBF"></span> Policy
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FEE254; border-style:dashed"></span> Read Model
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FB8597"></span> External System
    </div>
  `;
  container.appendChild(legend);

  // Insert container before the highlight div
    // Mark the highlight div as processed
  highlightDiv.setAttribute('data-es-rendered', 'true');
  highlightDiv.parentElement?.insertBefore(container, highlightDiv);
  highlightDiv.style.display = 'none'; // Hide the raw code block

  // Render D3 diagram
  const d3Container = d3.select(canvasWrapper);
  const instance = renderEventStorming(d3Container as any, dslText);
  rendererInstances.set(container, instance);
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
