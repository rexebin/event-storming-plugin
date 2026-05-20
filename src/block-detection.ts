import { isEventStormingJSON } from './dsl.js';

export function normalizeBlockText(text: string): string {
  return text.replace(/^\`\`\`.*\n?/, '').replace(/\n?\`\`\`.*$/, '').trim();
}

export function shouldRenderCodeBlock(language: string | undefined, text: string): boolean {
  if (!text) return false;

  const normalizedLanguage = language?.trim().toLowerCase();
  if (normalizedLanguage === 'eventstorming') return true;
  if (normalizedLanguage === 'json') return isEventStormingJSON(text);

  return false;
}

export function getLanguageFromCodeClassName(className: string): string | undefined {
  const match = className.match(/(?:^|\s)language-([a-z0-9_-]+)(?:\s|$)/i);
  return match ? match[1].toLowerCase() : undefined;
}
