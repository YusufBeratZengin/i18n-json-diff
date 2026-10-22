import { readFileSync, statSync } from 'node:fs';
import { JsonSyntaxError, LineIndex, parseJson } from './json-ast.js';

/** Raised for problems with user input: unreadable files, invalid JSON, bad options. */
export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

export function loadLocaleFile(path) {
  let text;
  try {
    if (statSync(path).isDirectory()) throw new InputError(`Expected a file, got a directory: ${path}`);
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof InputError) throw error;
    const messages = { ENOENT: 'File not found', EACCES: 'Permission denied', EPERM: 'Permission denied',
      ENOTDIR: 'A path component is not a directory', EISDIR: 'Expected a file, got a directory' };
    throw new InputError(`${messages[error.code] ?? 'Unable to read file'}: ${path}`);
  }
  return parseLocaleText(text, path);
}

/**
 * Parses translation JSON into a flat view while keeping the AST.
 * Nested keys are joined with dots, so `{"a": {"b": "x"}}` and `{"a.b": "x"}`
 * both produce the key `a.b`. Arrays use their index as a path segment.
 *
 * Returns { path, text, root, entries: Map<key, entry>, keys, duplicates, collisions, hasNesting }
 * where entry = { key, value: string | null, type, line, column, node }.
 */
export function parseLocaleText(text, path = '<input>') {
  let root;
  try {
    root = parseJson(text);
  } catch (error) {
    if (error instanceof JsonSyntaxError) {
      const detail = /not supported/.test(error.reason)
        ? `${error.reason} (line ${error.line}, column ${error.column})`
        : `Not valid JSON at line ${error.line}, column ${error.column}: ${error.reason}`;
      throw new InputError(`${detail}: ${path}`);
    }
    throw error;
  }
  if (root.type !== 'object') {
    throw new InputError(`${path}: the top-level JSON value must be an object`);
  }

  const lines = new LineIndex(text);
  const entries = new Map();
  const duplicates = [];
  const collisions = [];
  const origins = new Map();
  let hasNesting = false;

  function record(key, member, node, segments) {
    const { line, column } = lines.at(member.keyStart);
    const origin = JSON.stringify(segments);
    if (origins.has(key) && origins.get(key) !== origin) collisions.push({ key, line, column });
    origins.set(key, origin);
    let value;
    if (node.type === 'null') value = null;
    else if (node.type === 'string') value = node.value;
    else value = String(node.value);
    entries.set(key, { key, value, type: node.type, line, column, node });
  }

  function visitObject(node, prefix, segments) {
    const seen = new Set();
    for (const child of node.members) {
      const key = prefix === null ? child.key : `${prefix}.${child.key}`;
      if (seen.has(child.key)) duplicates.push({ key, ...lines.at(child.keyStart) });
      seen.add(child.key);
      visit(child.value, key, child, [...segments, child.key]);
    }
  }

  function visit(node, key, member, segments) {
    if (node.type === 'object') {
      hasNesting = true;
      visitObject(node, key, segments);
    } else if (node.type === 'array') {
      hasNesting = true;
      node.items.forEach((item, index) => visit(item, `${key}.${index}`, member, [...segments, index]));
    } else {
      record(key, member, node, segments);
    }
  }

  visitObject(root, null, []);

  return { path, text, root, entries, keys: [...entries.keys()], duplicates, collisions, hasNesting };
}
