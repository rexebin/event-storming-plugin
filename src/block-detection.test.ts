import { describe, expect, it } from 'vitest';

import { getLanguageFromCodeClassName, getLanguageFromElement, normalizeBlockText, shouldRenderCodeBlock } from './block-detection.js';

describe('block detection helpers', () => {
  it('normalizes fenced block text', () => {
    const text = '```eventstorming\n[\n  {}\n]\n```';
    expect(normalizeBlockText(text)).toBe('[\n  {}\n]');
   });

  it('extracts language from code element classes', () => {
    expect(getLanguageFromCodeClassName('hljs language-json')).toBe('json');
    expect(getLanguageFromCodeClassName('language-eventstorming')).toBe('eventstorming');
   });

  it('extracts language from element attributes and class names', () => {
    const code = document.createElement('code');
    code.className = 'hljs language-json';
    expect(getLanguageFromElement(code)).toBe('json');

    const pre = document.createElement('pre');
    pre.setAttribute('data-lang', 'eventstorming');
    expect(getLanguageFromElement(pre)).toBe('eventstorming');
   });

  it('renders explicit eventstorming fences', () => {
    expect(shouldRenderCodeBlock('eventstorming', 'anything')).toBe(true);
   });

  it('renders matching event storming XML even without a language hint', () => {
    const xml = `<eventstorming><aggregate name="Order"><container name="Process"><command name="PlaceOrder"/></container></aggregate></eventstorming>`;
    expect(shouldRenderCodeBlock(undefined, xml)).toBe(true);
   });
});
