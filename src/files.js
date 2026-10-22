import { readFileSync } from 'node:fs';
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
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new InputError(`Cannot read ${path}: ${error.code ?? error.message}`);
  }
  return parseLocaleText(text, path);
}

/**
 * Parses translation JSON into a flat view while keeping the AST.
 * Nested keys are joined with dots, so `{"a": {"b": "x"}}` and `{"a.b": "x"}`
 * both produce the key `a.b`. Arrays use their index as a path segment.
 *
 * Returns { path, text, root, entries: Map<key, entry>, keys, duplicates, hasNesting }
 * where entry = { key, value: string | null, type, line, column, node }.
 */
export function parseLocaleText(text, path = '<input>') {
  let root;
  try {
    root = parseJson(text);
  } catch (error) {
    if (error instanceof JsonSyntaxError) {
      throw new InputError(`${path}: invalid JSON: ${error.message}`);
    }
    throw error;
  }
  if (root.type !== 'object') {
    throw new InputError(`${path}: the top-level JSON value must be an object`);
  }

  const lines = new LineIndex(text);
  const entries = new Map();
  const duplicates = [];
  let hasNesting = false;

  function record(key, member, node) {
    const { line, column } = lines.at(member.keyStart);
    if (entries.has(key)) duplicates.push({ key, line, column });
    let value;
    if (node.type === 'null') value = null;
    else if (node.type === 'string') value = node.value;
    else value = String(node.value);
    entries.set(key, { key, value, type: node.type, line, column, node });
  }

  function visit(node, key, member) {
    if (node.type === 'object') {
      hasNesting = true;
      for (const child of node.members) visit(child.value, `${key}.${child.key}`, child);
    } else if (node.type === 'array') {
      hasNesting = true;
      node.items.forEach((item, index) => visit(item, `${key}.${index}`, member));
    } else {
      record(key, member, node);
    }
  }

  for (const member of root.members) visit(member.value, member.key, member);

  return { path, text, root, entries, keys: [...entries.keys()], duplicates, hasNesting };
}
