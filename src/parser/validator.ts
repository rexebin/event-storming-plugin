/**
 * Event Storming DSL — structural validation.
 *
 * Validates that the parsed DOM tree conforms to the Event Storming DSL grammar:
 *   <eventstorming>
 *     └── ( aggregate | projector | process | externalSystem )+   (root containers)
 *          └── <container>+                                       (nested grouping only)
 *               └── <container>+                                  (recursive nesting)
 *                    └── ( event | command | policy | actor | error | query | externalsystem )+  (leaf nodes)
 *                         └── <note>+                             (notes nested inside node elements)
 */

import { VALID_CONTAINER_TAGS, XML_NODE_TYPES } from './models.js';
import { PositionTracker } from './position.js';
import { DSLValidationError, type ValidationError } from './validation-errors.js';

// ─── Element position lookup ────────────────────────────────────────────────

/**
 * Find the character offset of an element's opening tag in the source text.
 * Uses a combination of tag name and distinguishing attributes for accuracy.
 */
function findElementOffset(text: string, el: Element): number {
  const tagName = el.tagName.toLowerCase();

  // Try to find this specific element by combining tag + key attributes
  const attrs: string[] = [];
  for (const attr of el.attributes) {
    const value = attr.value.trim();
    if (value && value.length < 100) {
      attrs.push(`${attr.name}="${value}"`);
    }
  }

  // Build a search pattern: <tagname ...attrs...
  if (attrs.length > 0) {
    for (let i = attrs.length; i > 0; i--) {
      const parts = [`<${tagName}`];
      for (const a of attrs.slice(0, i)) {
        parts.push('\\s+' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }
      const pattern = parts.join('');
      const regex = new RegExp(pattern, 'i');
      const match = regex.exec(text);
      if (match) return match.index;
    }
  }

  // Fallback: search for <tagName followed by whitespace or >
  const regex = new RegExp('<' + tagName + '(?:\\s|>)', 'i');
  const match = regex.exec(text);
  return match?.index ?? 0;
}

// ─── Error collection ───────────────────────────────────────────────────────

const ALL_VALID_TAGS = [...VALID_CONTAINER_TAGS, 'container', ...Object.keys(XML_NODE_TYPES), 'note'].sort();

function addError(errors: ValidationError[], el: Element, message: string, tracker: PositionTracker, text: string): void {
  const offset = findElementOffset(text, el);
  errors.push({ message, position: tracker.offsetToPosition(offset) });
}

// ─── Validation rules ───────────────────────────────────────────────────────

/** Check children of <eventstorming> — only root container types allowed. */
function validateEventStormingChildren(
  root: Element,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  for (const child of Array.from(root.children)) {
    const tag = child.tagName.toLowerCase();

    if (!VALID_CONTAINER_TAGS.has(tag)) {
      addError(errors, child, `Unexpected element <${tag}> inside <eventstorming>. Only aggregate, projector, process, and externalsystem are allowed as root containers.`, tracker, text);
    } else {
      // Root container: children must only be <container> elements
      validateRootContainerChildren(child, tag, errors, tracker, text);
    }
  }
}

/** Check children of a root container (aggregate/projector/process/externalSystem). */
function validateRootContainerChildren(
  el: Element,
  parentTag: string,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();

    if (tag === 'container') {
      // Container inside root container is OK — validate its children recursively
      validateNestedContainerChildren(child, errors, tracker, text);
    } else if (tag === 'note') {
      addError(errors, child, `Note element must be nested inside a node element (e.g., <event><note>...</note></event>), not placed as a direct child of <${parentTag}>.`, tracker, text);
    } else if (XML_NODE_TYPES[tag]) {
      addError(errors, child, `Element <${tag}> cannot be a direct child of <${parentTag}>. Node elements must be inside a <container> element.`, tracker, text);
    } else if (!ALL_VALID_TAGS.includes(tag)) {
      // Unknown element entirely
      addError(errors, child, `Unexpected element <${tag}>. Valid elements are: ${ALL_VALID_TAGS.join(', ')}.`, tracker, text);
    }
  }
}

/** Check children of a nested <container> element. */
function validateNestedContainerChildren(
  el: Element,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();

    if (tag === 'container') {
      // Nested container — recurse
      validateNestedContainerChildren(child, errors, tracker, text);
    } else if (XML_NODE_TYPES[tag]) {
      // Node element — OK as direct child of container. Validate its children.
      validateNodeElementChildren(child, tag, errors, tracker, text);
    } else if (tag === 'note') {
      addError(errors, child, `Note element must be nested inside a node element (e.g., <event><note>...</note></event>), not placed as a direct child of <container>.`, tracker, text);
    } else if (!ALL_VALID_TAGS.includes(tag)) {
      // Unknown element
      addError(errors, child, `Unexpected element <${tag}>. Valid elements are: ${ALL_VALID_TAGS.join(', ')}.`, tracker, text);
    }
  }
}

/** Check children of a node element (event/command/policy/etc.). Only <note> allowed. */
function validateNodeElementChildren(
  el: Element,
  nodeTag: string,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();

    if (tag === 'note') {
      // OK — notes are the only valid children of node elements
      continue;
    } else if (tag === 'container') {
      addError(errors, child, `Element <container> cannot be a child of <${nodeTag}>. Containers can only be children of aggregate, projector, process, externalSystem, or other containers.`, tracker, text);
    } else if (!ALL_VALID_TAGS.includes(tag)) {
      // Unknown element inside a node
      addError(errors, child, `Unexpected element <${tag}> inside <${nodeTag}>. Node elements can only contain <note> children.`, tracker, text);
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Validate the parsed DOM tree against the Event Storming DSL grammar.
 *
 * Throws `DSLValidationError` with all violations (including line numbers)
 * if any structural rule is violated. Returns silently if valid.
 */
export function validateStructure(
  root: Element,
  tracker: PositionTracker,
  text: string,
): void {
  const errors: ValidationError[] = [];

  validateEventStormingChildren(root, errors, tracker, text);

  if (errors.length > 0) {
    throw new DSLValidationError(errors);
  }
}
