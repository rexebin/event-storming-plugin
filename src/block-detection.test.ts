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

  it('renders json fences only when they match the schema', () => {
    const valid = `[
      {
        "type": "Aggregate",
        "name": "Order",
        "containers": [
          {
            "name": "Place Order",
            "children": [
              { "type": "Command", "name": "PlaceOrder" }
            ]
          }
        ]
      }
    ]`;

    expect(shouldRenderCodeBlock('json', valid)).toBe(true);
    expect(shouldRenderCodeBlock('json', '{"foo":"bar"}')).toBe(false);
  });

  it('renders matching event storming JSON even without a language hint', () => {
    const valid = `[
      {
        "type": "Aggregate",
        "name": "Order",
        "containers": [
          {
            "name": "Place Order",
            "children": [
              { "type": "Command", "name": "PlaceOrder" }
            ]
          }
        ]
      }
    ]`;

    expect(shouldRenderCodeBlock(undefined, valid)).toBe(true);
  });
});
