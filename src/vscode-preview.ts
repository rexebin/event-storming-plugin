import { getLanguageFromElement, normalizeBlockText, shouldRenderCodeBlock } from './block-detection.js';
import { mountRenderedBlock, RenderedBlockInstance } from './block-render.js';

const DEBOUNCE_MS = 200;

let observer: MutationObserver | null = null;
const rendererInstances = new Map<HTMLElement, RenderedBlockInstance>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function main(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshRenderedBlocks);
  } else {
    refreshRenderedBlocks();
  }
}

function scanAndRender(): void {
  const preBlocks = document.querySelectorAll<HTMLElement>('pre');

  for (const pre of preBlocks) {
    if (pre.getAttribute('data-es-rendered') === 'true') continue;

    const code = pre.querySelector<HTMLElement>('code');
    const language = getLanguageFromElement(code) || getLanguageFromElement(pre);
    const dslText = normalizeBlockText((code?.textContent || pre.textContent || ''));

    if (!shouldRenderCodeBlock(language, dslText)) continue;

    const instance = mountRenderedBlock(pre, dslText);
    rendererInstances.set(instance.container, instance);
  }
}

function startObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    if (mutations.length > 0) {
      debouncedScan();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function debouncedScan(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    refreshRenderedBlocks();
  }, DEBOUNCE_MS);
}

function refreshRenderedBlocks(): void {
  if (observer) observer.disconnect();

  rendererInstances.forEach((instance) => {
    instance.destroy();
  });
  rendererInstances.clear();

  scanAndRender();
  startObserver();
}

window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
  rendererInstances.forEach((instance) => {
    instance.destroy();
  });
  rendererInstances.clear();
});

main();
