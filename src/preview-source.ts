import { getLanguageFromElement, normalizeBlockText } from './block-detection.js';

export interface PreviewSourceBlock {
  language: string | undefined;
  text: string;
}

export function collectPreviewSourceBlocks(root: ParentNode = document): PreviewSourceBlock[] {
  const preBlocks = root.querySelectorAll<HTMLElement>('pre');

  return Array.from(preBlocks).map((pre) => {
    const code = pre.querySelector<HTMLElement>('code');
    return {
      language: getLanguageFromElement(code) || getLanguageFromElement(pre),
      text: normalizeBlockText(code?.textContent || pre.textContent || ''),
    };
  });
}

export function createPreviewSourceSnapshot(root: ParentNode = document): string {
  return JSON.stringify(
    collectPreviewSourceBlocks(root).map((block) => ({
      language: block.language ?? null,
      text: block.text,
    }))
  );
}
