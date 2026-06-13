/**
 * Event Storming DSL — source position tracking.
 *
 * Maps character offsets in raw XML text to 1-based (line, column) pairs
 * by scanning for newline characters once at construction time.
 */

export interface Position {
  line: number;    // 1-based
  column: number;  // 1-based
}

/** Pre-computed newline offsets for fast position lookup. */
interface NewlineMap {
  /** Sorted array of byte offsets where newlines occur. */
  offsets: number[];
  /** Total number of lines (newlines + 1, or 0 if text is empty). */
  lineCount: number;
}

/** Build a newline map from raw text — one pass, O(n). */
function buildNewlineMap(text: string): NewlineMap {
  const offsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i);
    }
  }
  return { offsets, lineCount: offsets.length + (text.length > 0 ? 1 : 0) };
}

/** Binary search: find the largest offset <= target. Returns -1 if none. */
function findNewlineBefore(map: NewlineMap, target: number): number {
  let lo = 0;
  let hi = map.offsets.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (map.offsets[mid] < target) {
      result = mid;
      lo = mid + 1;
    } else if (map.offsets[mid] > target) {
      hi = mid - 1;
    } else {
      return mid; // exact match — newline is right at target
    }
  }

  return result;
}

/** A position tracker that maps character offsets to (line, column). */
export class PositionTracker {
  private readonly map: NewlineMap;

  constructor(text: string) {
    this.map = buildNewlineMap(text);
  }

  /** Convert a character offset in the source text to a 1-based (line, column). */
  offsetToPosition(offset: number): Position {
    if (offset < 0 || offset > this.map.offsets.at(-1)!) {
      return { line: 1, column: Math.max(1, offset + 1) };
    }

    const newlineIndex = findNewlineBefore(this.map, offset);

    // Number of newlines before `offset` = number of lines completed
    const line = newlineIndex + 2; // +2 because newlineIndex is 0-based and lines are 1-based

    if (newlineIndex === -1) {
      // No newline before offset — column is just the offset + 1
      return { line: 1, column: offset + 1 };
    }

    const lastNewlineOffset = this.map.offsets[newlineIndex];
    const column = offset - lastNewlineOffset;

    return { line, column };
  }
}
