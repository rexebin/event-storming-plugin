import { describe, expect, it } from 'vitest';

import { getLanguageFromCodeClassName, normalizeBlockText, shouldRenderCodeBlock } from './block-detection.js';

describe('block detection helpers', () => {
  it('normalizes fenced block text', () => {
    const text = '```eventstorming\n[\n  {}\n]\n```';
    expect(normalizeBlockText(text)).toBe('[\n  {}\n]');
  });

  it('extracts language from code element classes', () => {
    expect(getLanguageFromCodeClassName('hljs language-json')).toBe('json');
    expect(getLanguageFromCodeClassName('language-eventstorming')).toBe('eventstorming');
  });

  it('renders explicit eventstorming fences', () => {
    expect(shouldRenderCodeBlock('eventstorming', 'anything')).toBe(true);
  });

  it('renders json fences only when they match the schema', () => {
    const valid = `[
      {
        "type": "Aggregate",
        "name": "Order",
        "children": [
          {
            "name": "Place Order",
            "nodes": [
              { "type": "Command", "name": "PlaceOrder" }
            ]
          }
        ]
      }
    ]`;

    expect(shouldRenderCodeBlock('json', valid)).toBe(true);
    expect(shouldRenderCodeBlock('json', '{"foo":"bar"}')).toBe(false);
  });
});
