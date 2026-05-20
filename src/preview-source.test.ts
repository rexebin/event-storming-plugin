import { describe, expect, it } from 'vitest';

import { collectPreviewSourceBlocks, createPreviewSourceSnapshot } from './preview-source.js';

describe('preview source snapshot', () => {
  it('captures fenced code block language and text', () => {
    document.body.innerHTML = `
      <pre class="language-json"><code class="language-json">[
  { "type": "Aggregate", "name": "Order", "children": [] }
]</code></pre>
    `;

    const blocks = collectPreviewSourceBlocks(document);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('json');
    expect(blocks[0].text).toContain('"type": "Aggregate"');
  });

  it('ignores unrelated rendered DOM when source blocks stay the same', () => {
    document.body.innerHTML = `
      <pre class="language-json"><code class="language-json">[
  { "type": "Aggregate", "name": "Order", "children": [] }
]</code></pre>
    `;

    const before = createPreviewSourceSnapshot(document);

    const rendered = document.createElement('div');
    rendered.className = 'event-storming-container';
    rendered.innerHTML = '<div class="es-tooltip">Tooltip</div>';
    document.body.appendChild(rendered);

    const after = createPreviewSourceSnapshot(document);

    expect(after).toBe(before);
  });
});
