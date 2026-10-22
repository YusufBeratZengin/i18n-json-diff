/**
 * A small position-aware JSON parser. Unlike JSON.parse it keeps the source
 * offsets of every node, which lets us report line numbers and, more
 * importantly, patch a file in place without re-serialising it.
 */

export class LineIndex {
  constructor(text) {
    this.starts = [0];
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
      this.starts.push(i + 1);
    }
  }

  /** Returns 1-based line and column for a character offset. */
  at(offset) {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - this.starts[lo] + 1 };
  }
}

export class JsonSyntaxError extends Error {
  constructor(message, offset, text) {
    const { line, column } = new LineIndex(text).at(offset);
    super(`${message} at line ${line}, column ${column}`);
    this.name = 'JsonSyntaxError';
    this.offset = offset;
    this.line = line;
    this.column = column;
    this.reason = message;
  }
}

const MAX_DEPTH = 512;

/**
 * Parses JSON text into an AST.
 * Node shapes:
 *   { type: 'object', start, end, members: [{ key, keyStart, keyEnd, value, start, end }] }
 *   { type: 'array', start, end, items: [node] }
 *   { type: 'string' | 'number' | 'boolean' | 'null', start, end, value }
 */
export function parseJson(text) {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const fail = (message, at = i) => {
    throw new JsonSyntaxError(message, Math.min(at, text.length), text);
  };

  const skipWhitespace = () => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13) i++;
      else break;
    }
    if (text.startsWith('//', i) || text.startsWith('/*', i)) {
      fail('Comments are not supported in JSON files');
    }
  };

  function parseString() {
    const start = i;
    i++;
    for (;;) {
      if (i >= text.length) fail('Unterminated string', start);
      const c = text.charCodeAt(i);
      if (c === 34) {
        i++;
        break;
      }
      if (c < 32) fail('Control character in string');
      i += c === 92 ? 2 : 1;
    }
    let value;
    try {
      value = JSON.parse(text.slice(start, i));
    } catch {
      fail('Invalid escape sequence in string', start);
    }
    return { type: 'string', start, end: i, value };
  }

  const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

  function parseNumber() {
    NUMBER.lastIndex = i;
    const match = NUMBER.exec(text);
    if (!match) fail('Invalid number');
    const start = i;
    i += match[0].length;
    return { type: 'number', start, end: i, value: Number(match[0]) };
  }

  function parseObject(depth) {
    const start = i;
    i++;
    const members = [];
    skipWhitespace();
    if (text[i] === '}') {
      i++;
      return { type: 'object', start, end: i, members };
    }
    for (;;) {
      skipWhitespace();
      if (text[i] !== '"') fail('Expected a string key');
      const keyNode = parseString();
      skipWhitespace();
      if (text[i] !== ':') fail("Expected ':'");
      i++;
      const value = parseValue(depth + 1);
      members.push({
        key: keyNode.value,
        keyStart: keyNode.start,
        keyEnd: keyNode.end,
        value,
        start: keyNode.start,
        end: value.end,
      });
      skipWhitespace();
      if (text[i] === ',') {
        const comma = i;
        i++;
        skipWhitespace();
        if (text[i] === '}') fail('Trailing commas are not supported in JSON files', comma);
        continue;
      }
      if (text[i] === '}') {
        i++;
        break;
      }
      fail("Expected ',' or '}'");
    }
    return { type: 'object', start, end: i, members };
  }

  function parseArray(depth) {
    const start = i;
    i++;
    const items = [];
    skipWhitespace();
    if (text[i] === ']') {
      i++;
      return { type: 'array', start, end: i, items };
    }
    for (;;) {
      items.push(parseValue(depth + 1));
      skipWhitespace();
      if (text[i] === ',') {
        const comma = i;
        i++;
        skipWhitespace();
        if (text[i] === ']') fail('Trailing commas are not supported in JSON files', comma);
        continue;
      }
      if (text[i] === ']') {
        i++;
        break;
      }
      fail("Expected ',' or ']'");
    }
    return { type: 'array', start, end: i, items };
  }

  function parseValue(depth) {
    if (depth > MAX_DEPTH) fail('Nesting too deep');
    skipWhitespace();
    if (i >= text.length) fail('Unexpected end of input');
    const c = text[i];
    if (c === '{') return parseObject(depth);
    if (c === '[') return parseArray(depth);
    if (c === '"') return parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
    for (const [literal, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ]) {
      if (text.startsWith(literal, i)) {
        const start = i;
        i += literal.length;
        return { type: value === null ? 'null' : 'boolean', start, end: i, value };
      }
    }
    return fail(`Unexpected character ${JSON.stringify(c)}`);
  }

  const root = parseValue(0);
  skipWhitespace();
  if (i < text.length) fail('Unexpected data after JSON value');
  return root;
}
