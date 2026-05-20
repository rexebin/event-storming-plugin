import { getLanguageFromCodeClassName, normalizeBlockText, shouldRenderCodeBlock } from './block-detection.js';
import { mountRenderedBlock, RenderedBlockInstance } from './block-render.js';

const DEBOUNCE_MS = 200;

let observer: MutationObserver | null = null;
const rendererInstances = new Map<HTMLElement, RenderedBlockInstance>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function main(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndRender);
  } else {
    scanAndRender();
  }

  startObserver();
}

function scanAndRender(): void {
  const codeBlocks = document.querySelectorAll<HTMLElement>('pre > code');

  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (!pre || pre.getAttribute('data-es-rendered') === 'true') continue;

    const language = getLanguageFromCodeClassName(code.className);
    const dslText = normalizeBlockText(code.textContent || '');

    if (!shouldRenderCodeBlock(language, dslText)) continue;

    const instance = mountRenderedBlock(pre, dslText);
    rendererInstances.set(instance.container, instance);
  }
}

function startObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes.length > 0)) {
      debouncedScan();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function debouncedScan(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    scanAndRender();
  }, DEBOUNCE_MS);
}

window.addEventListener('beforeunload', () => {
  if (observer) observer.disconnect();
  rendererInstances.forEach((instance) => {
    instance.destroy();
  });
  rendererInstances.clear();
});

main();
