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
  let pattern = '<' + tagName + '(?:\\s|>)';

  for (const attr of el.attributes) {
    const value = attr.value.trim();
    if (value && value.length < 100) {
      const escapedAttr = attr.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pattern += '(?:\\s+' + escapedAttr + '="' + escapedValue + '")?';
    }
  }

  const regex = new RegExp(pattern, 'i');
  const match = regex.exec(text);
  return match?.index ?? 0;
}

// ─── Error collection ───────────────────────────────────────────────────────

const ALL_VALID_TAGS = [...VALID_CONTAINER_TAGS, 'container', ...Object.keys(XML_NODE_TYPES), 'note'].sort();
const ALL_VALID_TAGS_DISPLAY = ALL_VALID_TAGS.join(', ');

function addError(errors: ValidationError[], el: Element, message: string, tracker: PositionTracker, text: string): void {
  const offset = findElementOffset(text, el);
  errors.push({ message, position: tracker.offsetToPosition(offset) });
}

// ─── Validation rules ───────────────────────────────────────────────────────

/** Strategy for handling a child element by tag name during validation. */
interface ChildValidationStrategy {
  /** What to do when encountering a <container> child. Pass null to reject. */
  onContainer: ((el: Element, errors: ValidationError[], tracker: PositionTracker, text: string) => void) | null;
  /** What to do when encountering a known node element (event/command/policy/etc.). Pass null to reject. */
  onNodeElement: ((el: Element, tag: string, errors: ValidationError[], tracker: PositionTracker, text: string) => void) | null;
  /** Error message when <note> appears in an invalid location. Pass null to allow notes. */
  noteError: string | null;
  /** Error message for unknown elements. Pass null to silently accept them. */
  unknownElementError: ((tag: string) => string) | null;
}

/**
 * Validate children of an element using the provided strategy.
 * Iterates child nodes and dispatches each to the appropriate handler.
 */
function validateChildren(
  el: Element,
  strategy: ChildValidationStrategy,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    const tag = child.tagName.toLowerCase();

    if (tag === 'container') {
      if (strategy.onContainer) {
        strategy.onContainer(child, errors, tracker, text);
      } else {
        addError(errors, child, `Element <container> cannot be a child of <${el.tagName.toLowerCase()}>.`, tracker, text);
      }
    } else if (XML_NODE_TYPES[tag]) {
      if (strategy.onNodeElement) {
        strategy.onNodeElement(child, tag, errors, tracker, text);
      } else {
        addError(errors, child, `Element <${tag}> cannot be a direct child of <${el.tagName.toLowerCase()}>. Node elements must be inside a <container> element.`, tracker, text);
      }
    } else if (tag === 'note') {
      if (strategy.noteError) {
        addError(errors, child, strategy.noteError, tracker, text);
      }
    } else if (strategy.unknownElementError) {
      addError(errors, child, strategy.unknownElementError(tag), tracker, text);
    }
  }
}

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
  validateChildren(el, {
    onContainer: (child) => validateNestedContainerChildren(child, errors, tracker, text),
    onNodeElement: null,
    noteError: `Note element must be nested inside a node element (e.g., <event><note>...</note></event>), not placed as a direct child of <${parentTag}>.`,
    unknownElementError: (tag) => `Unexpected element <${tag}>. Valid elements are: ${ALL_VALID_TAGS_DISPLAY}.`,
  }, errors, tracker, text);
}

/** Check children of a nested <container> element. */
function validateNestedContainerChildren(
  el: Element,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  validateChildren(el, {
    onContainer: (child) => validateNestedContainerChildren(child, errors, tracker, text),
    onNodeElement: (child, tag) => validateNodeElementChildren(child, tag, errors, tracker, text),
    noteError: `Note element must be nested inside a node element (e.g., <event><note>...</note></event>), not placed as a direct child of <container>.`,
    unknownElementError: (tag) => `Unexpected element <${tag}>. Valid elements are: ${ALL_VALID_TAGS_DISPLAY}.`,
  }, errors, tracker, text);
}

/** Check children of a node element (event/command/policy/etc.). Only <note> allowed. */
function validateNodeElementChildren(
  el: Element,
  nodeTag: string,
  errors: ValidationError[],
  tracker: PositionTracker,
  text: string,
): void {
  validateChildren(el, {
    onContainer: null,
    onNodeElement: null,
    noteError: null, // notes are allowed — no error
    unknownElementError: (tag) => `Unexpected element <${tag}> inside <${nodeTag}>. Node elements can only contain <note> children.`,
  }, errors, tracker, text);
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
