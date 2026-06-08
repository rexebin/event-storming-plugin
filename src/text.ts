/**
 * Event Storming — Text wrapping for node labels.
 */

import { NODE_W } from './layout/index.js';

export function wrapText(
  textGroup: any,
  text: string,
  maxWidth: number,
  _maxHeight: number,
): void {
  const maxCharsPerLine = Math.floor(maxWidth / 6.5);
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
     } else {
      current = test;
     }
   }

  if (current) lines.push(current);

  const displayLines = lines.slice(0, 4);
  const lineHeight = 15;
    // Center the text block vertically: first line starts so the whole block is centered
  const totalBlockHeight = (displayLines.length - 1) * lineHeight;
  const startY = -totalBlockHeight / 2;

  displayLines.forEach((line, i) => {
    textGroup
        .append('tspan')
        .attr('x', NODE_W / 2)
        .attr('dy', i === 0 ? `${startY}` : `${lineHeight}`)
        .text(line);
    });

  if (lines.length > 2) {
    textGroup
        .append('tspan')
        .attr('x', NODE_W / 2)
        .attr('dy', `${lineHeight}`)
        .text('…');
    }
}
