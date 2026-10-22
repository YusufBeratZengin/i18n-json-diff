/**
 * A small ICU MessageFormat tokenizer/validator.
 *
 * It does not format anything. It checks that a message is syntactically
 * valid and collects the names of the arguments it refers to, including
 * arguments nested inside plural/select branches.
 *
 * Supported: {name}, {name, type}, {name, type, style},
 * {n, plural, =0 {...} one {...} other {...}}, selectordinal, select,
 * `offset:N`, `#` inside plural branches, apostrophe quoting ('{' and '').
 * Tolerated for vue-i18n: numeric names ({0}) and quoted literals ({'@'}).
 */

const SIMPLE_TYPES = new Set(['number', 'date', 'time', 'spellout', 'ordinal', 'duration']);
const PLURAL_SELECTOR = /^(?:=\d+|zero|one|two|few|many|other)$/;

class IcuError extends Error {}

export function parseIcu(message) {
  const args = new Set();
  let i = 0;

  const fail = (text) => {
    throw new IcuError(text);
  };
  const skipSpace = () => {
    while (i < message.length && /\s/.test(message[i])) i++;
  };

  /** Skips an apostrophe-quoted run or a literal apostrophe. */
  function skipApostrophe(inPlural) {
    const next = message[i + 1];
    if (next === "'") {
      i += 2;
      return;
    }
    if (next === '{' || next === '}' || (inPlural && next === '#')) {
      i++;
      for (;;) {
        const close = message.indexOf("'", i);
        if (close === -1) {
          i = message.length;
          return;
        }
        if (message[close + 1] === "'") {
          i = close + 2;
          continue;
        }
        i = close + 1;
        return;
      }
    }
    i++;
  }

  /** Parses message text until an unmatched '}' (consumed) or the end. */
  function parseMessage(depth, inPlural) {
    while (i < message.length) {
      const c = message[i];
      if (c === "'") skipApostrophe(inPlural);
      else if (c === '{') parseArgument();
      else if (c === '}') {
        if (depth === 0) fail("Unmatched '}'");
        i++;
        return;
      } else i++;
    }
    if (depth > 0) fail("Unclosed '{'");
  }

  function parseArgument() {
    i++; // {
    skipSpace();
    if (message[i] === "'") {
      // vue-i18n literal interpolation: {'@'}
      const close = message.indexOf("'", i + 1);
      if (close === -1) fail('Unterminated quoted literal');
      i = close + 1;
      skipSpace();
      if (message[i] !== '}') fail("Expected '}' after quoted literal");
      i++;
      return;
    }
    const nameStart = i;
    while (i < message.length && !/[\s,{}']/.test(message[i])) i++;
    const name = message.slice(nameStart, i);
    if (!name) fail('Empty argument name');
    skipSpace();
    if (i >= message.length) fail("Unclosed '{'");
    if (message[i] === '}') {
      args.add(name);
      i++;
      return;
    }
    if (message[i] !== ',') fail(`Expected ',' or '}' after argument "${name}"`);
    i++;
    skipSpace();
    const typeStart = i;
    while (i < message.length && /[A-Za-z]/.test(message[i])) i++;
    const type = message.slice(typeStart, i);
    if (!type) fail(`Missing argument type for "${name}"`);
    const structured = type === 'plural' || type === 'selectordinal' || type === 'select';
    if (!structured && !SIMPLE_TYPES.has(type)) fail(`Unknown argument type "${type}"`);
    args.add(name);
    skipSpace();
    if (message[i] === '}') {
      if (type === 'plural' || type === 'selectordinal' || type === 'select') {
        fail(`"${type}" argument "${name}" needs at least one option`);
      }
      i++;
      return;
    }
    if (message[i] !== ',') fail(`Expected ',' or '}' after type "${type}"`);
    i++;
    if (structured) parseOptions(type, name);
    else skipStyle();
  }

  /** Style text up to the closing brace; braces may nest (date skeletons). */
  function skipStyle() {
    let depth = 0;
    while (i < message.length) {
      const c = message[i];
      if (c === "'") skipApostrophe(false);
      else if (c === '{') {
        depth++;
        i++;
      } else if (c === '}') {
        i++;
        if (depth === 0) return;
        depth--;
      } else i++;
    }
    fail("Unclosed '{'");
  }

  function parseOptions(type, name) {
    const isPlural = type !== 'select';
    skipSpace();
    if (isPlural && message.startsWith('offset:', i)) {
      i += 7;
      skipSpace();
      const start = i;
      while (i < message.length && /\d/.test(message[i])) i++;
      if (start === i) fail('Expected a number after "offset:"');
    }
    const seen = new Set();
    for (;;) {
      skipSpace();
      if (i >= message.length) fail("Unclosed '{'");
      if (message[i] === '}') {
        i++;
        break;
      }
      const start = i;
      while (i < message.length && !/[\s{}]/.test(message[i])) i++;
      const selector = message.slice(start, i);
      if (!selector) fail(`Expected a selector in ${type} "${name}"`);
      if (isPlural && !PLURAL_SELECTOR.test(selector)) {
        fail(`Invalid ${type} selector "${selector}"`);
      }
      if (seen.has(selector)) fail(`Duplicate selector "${selector}" in ${type} "${name}"`);
      seen.add(selector);
      skipSpace();
      if (message[i] !== '{') fail(`Expected '{' after selector "${selector}"`);
      i++;
      parseMessage(1, isPlural);
    }
    if (seen.size === 0) fail(`"${type}" argument "${name}" needs at least one option`);
    if (!seen.has('other')) fail(`Missing required "other" selector in ${type} "${name}"`);
  }

  try {
    parseMessage(0, false);
  } catch (error) {
    if (error instanceof IcuError) return { args, error: error.message };
    throw error;
  }
  return { args, error: null };
}
