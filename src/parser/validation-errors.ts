/**
 * Event Storming DSL — structured validation error types.
 */

import type { Position } from './position.js';

export interface ValidationError {
  message: string;
  position?: Position;
}

/**
 * Aggregated validation error containing multiple individual violations.
 *
 * Thrown by the validator when one or more structural rules are violated.
 * Callers can inspect `errors` for individual violations with line numbers,
 * or use `message` for a single formatted summary string.
 */
export class DSLValidationError extends Error {
  readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super(formatValidationMessage(errors));
    this.errors = errors;
    Object.setPrototypeOf(this, DSLValidationError.prototype);
  }
}

/** Format an array of validation errors into a human-readable message. */
function formatValidationMessage(errors: ValidationError[]): string {
  if (errors.length === 0) return 'Validation passed';

  const parts = errors.map((e) => {
    const location = e.position ? ` (line ${e.position.line})` : '';
    return `${e.message}${location}`;
  });

  if (parts.length === 1) return parts[0];

  // Multiple errors: list each, then a summary
  return [
    ...parts,
    '',
    `Found ${errors.length} structural violation(s).`,
  ].join('\n');
}
