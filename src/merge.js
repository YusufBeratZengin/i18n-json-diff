import { categoryIndex, findPluralBases, splitPluralKey } from './plural.js';

/**
 * Merges translations into a target file by patching its text.
 *
 * Existing content is never re-serialised: new members are inserted as new
 * lines at the position implied by the source key order, and empty values are
 * replaced in place. Indentation, line endings, key order and the trailing
 * newline of the original are preserved, so the resulting diff only contains
 * the added lines. (Appending after the last member of an object cannot avoid
 * touching that member's line, because JSON needs a comma there.)
 */

const isBlank = (value) => value === null || value === undefined || value.trim() === '';

/** key -> first position in `order`, for every dotted prefix of every key. */
function buildRanker(order) {
  const prefixIndex = new Map();
  order.forEach((key, index) => {
    let prefix = '';
    for (const segment of key.split('.')) {
      prefix = prefix === '' ? segment : `${prefix}.${segment}`;
      if (!prefixIndex.has(prefix)) prefixIndex.set(prefix, index);
    }
  });
  const pluralStart = new Map();
  const bases = findPluralBases(order);
  order.forEach((key, index) => {
    const parts = splitPluralKey(key);
    if (parts && bases.has(parts.base) && !pluralStart.has(parts.base)) {
      pluralStart.set(parts.base, index);
    }
  });
  return (path) => {
    const parts = splitPluralKey(path);
    if (parts && pluralStart.has(parts.base)) {
      return pluralStart.get(parts.base) + categoryIndex(parts.category) * 0.001;
    }
    return prefixIndex.get(path);
  };
}

function joinPath(prefix, key) {
  return prefix === '' ? key : `${prefix}.${key}`;
}

function detectStyle(target) {
  const { text, root } = target;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const first = root.members[0];
  const multiline = first ? /\n/.test(text.slice(root.start, first.start)) : true;
  let unit = '  ';
  if (first && multiline) {
    const lineStart = text.lastIndexOf('\n', first.start - 1) + 1;
    const indent = text.slice(lineStart, first.start);
    if (/^[ \t]+$/.test(indent)) unit = indent;
  }
  let colon = ': ';
  if (first) colon = text.slice(first.keyEnd, first.value.start);
  return { eol, multiline, unit, colon };
}

function describeObject(obj, text, style) {
  const first = obj.members[0];
  let multiline = style.multiline;
  let colon = style.colon;
  let memberIndent;
  let closeIndent = '';
  if (first) {
    multiline = /\n/.test(text.slice(obj.start, first.start));
    colon = text.slice(first.keyEnd, first.value.start);
    if (multiline) {
      const lineStart = text.lastIndexOf('\n', first.start - 1) + 1;
      memberIndent = text.slice(lineStart, first.start);
    }
  } else {
    const lineStart = text.lastIndexOf('\n', obj.start - 1) + 1;
    closeIndent = /^[ \t]*/.exec(text.slice(lineStart, obj.start))[0];
    memberIndent = closeIndent + style.unit;
  }
  let separator = colon.includes(' ') ? ' ' : '';
  if (obj.members.length > 1) {
    const between = text.slice(obj.members[0].end, obj.members[1].start);
    const match = /^\s*,([ \t]*)$/.exec(between);
    if (match) separator = match[1];
  }
  return { multiline, colon, memberIndent, closeIndent, separator };
}

function serializeValue(value, baseIndent, info, style) {
  if (typeof value === 'string') return JSON.stringify(value);
  const entries = Object.entries(value);
  if (info.multiline) {
    const inner = baseIndent + style.unit;
    const body = entries
      .map(([k, v]) => `${inner}${JSON.stringify(k)}${info.colon}${serializeValue(v, inner, info, style)}`)
      .join(`,${style.eol}`);
    return `{${style.eol}${body}${style.eol}${baseIndent}}`;
  }
  const body = entries
    .map(([k, v]) => `${JSON.stringify(k)}${info.colon}${serializeValue(v, baseIndent, info, style)}`)
    .join(`,${info.separator}`);
  return `{${body}}`;
}

/** Offset just after the comma that follows `member`. */
function commaAfter(text, member) {
  let at = member.end;
  while (text[at] !== ',') at++;
  return at + 1;
}

/**
 * @param target  parsed target file (see parseLocaleText)
 * @param filled  parsed file with translations
 * @param options { source, overwrite }
 * @returns { text, added, filled, overwritten, kept, skipped }
 */
export function mergeTranslations(target, filled, options = {}) {
  const { source = null, overwrite = false } = options;
  const order = source ? source.keys : filled.keys;
  const rank = buildRanker(order);
  const style = detectStyle(target);
  // Dotted top-level keys mean a flat file; otherwise follow the file, or the
  // source/filled shape when the target has no structure to copy yet.
  const flatKeys = target.root.members.some((member) => member.key.includes('.'));
  let nested = (source ?? filled).hasNesting;
  if (flatKeys) nested = false;
  else if (target.hasNesting) nested = true;

  const sourceBases = findPluralBases(source ? source.keys : []);
  const isKnown = (key) => {
    if (!source) return true;
    if (source.entries.has(key)) return true;
    const parts = splitPluralKey(key);
    return Boolean(parts && sourceBases.has(parts.base));
  };

  const result = { text: target.text, added: [], filled: [], overwritten: [], kept: [], skipped: [] };
  const edits = [];
  const memberLookup = new WeakMap();
  const findMember = (obj, key) => {
    if (!memberLookup.has(obj)) {
      const map = new Map();
      for (const member of obj.members) map.set(member.key, member);
      memberLookup.set(obj, map);
    }
    return memberLookup.get(obj).get(key);
  };

  /** Finds the deepest existing object that should contain `key`. */
  function attach(obj, prefix, key) {
    const segments = key.split('.');
    for (let n = segments.length - 1; n >= 1; n--) {
      const member = findMember(obj, segments.slice(0, n).join('.'));
      if (member && member.value.type === 'object') {
        return attach(member.value, joinPath(prefix, member.key), segments.slice(n).join('.'));
      }
    }
    return { obj, prefix, rest: key };
  }

  const pending = [];
  for (const [key, entry] of filled.entries) {
    if (entry.type !== 'string' || isBlank(entry.value)) {
      result.skipped.push({ key, reason: 'empty-value' });
      continue;
    }
    if (!isKnown(key)) {
      result.skipped.push({ key, reason: 'unknown-key' });
      continue;
    }
    const existing = target.entries.get(key);
    if (existing) {
      if (isBlank(existing.value) || overwrite) {
        if (existing.value === entry.value) {
          result.kept.push(key);
          continue;
        }
        edits.push({ start: existing.node.start, end: existing.node.end, text: JSON.stringify(entry.value) });
        (isBlank(existing.value) ? result.filled : result.overwritten).push(key);
      } else {
        result.kept.push(key);
      }
      continue;
    }
    pending.push({ key, value: entry.value, rank: rank(key) ?? Number.MAX_SAFE_INTEGER });
  }
  pending.sort((a, b) => a.rank - b.rank);

  // Group new keys by the object that receives them and the member they create.
  const groups = new Map();
  const groupList = [];
  for (const item of pending) {
    const { obj, prefix, rest } = attach(target.root, '', item.key);
    const segments = nested ? rest.split('.') : [rest];
    const name = segments[0];
    if (findMember(obj, name) && !groups.has(`${obj.start}|${name}`)) {
      result.skipped.push({ key: item.key, reason: 'type-conflict' });
      continue;
    }
    const id = `${obj.start}|${name}`;
    let group = groups.get(id);
    if (!group) {
      group = { obj, prefix, name, tree: null, rank: item.rank, keys: [] };
      groups.set(id, group);
      groupList.push(group);
    }
    if (segments.length === 1) {
      group.tree = item.value;
    } else {
      group.tree ??= {};
      let node = group.tree;
      for (const segment of segments.slice(1, -1)) {
        if (typeof node[segment] !== 'object') node[segment] = {};
        node = node[segment];
      }
      node[segments[segments.length - 1]] = item.value;
    }
    group.keys.push(item.key);
  }

  // Decide where each group goes within its object.
  const slots = new Map();
  for (const group of groupList) {
    const { obj } = group;
    let before = obj.members.length;
    let best = -Infinity;
    let successorIndex = -1;
    let successorRank = Infinity;
    obj.members.forEach((member, index) => {
      const r = rank(joinPath(group.prefix, member.key));
      if (r === undefined) return;
      if (r < group.rank && r > best) {
        best = r;
        before = index + 1;
      } else if (r > group.rank && r < successorRank) {
        successorRank = r;
        successorIndex = index;
      }
    });
    if (best === -Infinity && successorIndex !== -1) before = successorIndex;
    const id = `${obj.start}@${before}`;
    if (!slots.has(id)) slots.set(id, { obj, before, groups: [] });
    slots.get(id).groups.push(group);
  }

  const { text } = target;
  for (const { obj, before, groups: slotGroups } of slots.values()) {
    const info = describeObject(obj, text, style);
    slotGroups.sort((a, b) => a.rank - b.rank);
    const members = obj.members;
    const indent = info.memberIndent ?? '';
    const items = slotGroups.map(
      (g) => `${JSON.stringify(g.name)}${info.colon}${serializeValue(g.tree, indent, info, style)}`,
    );

    if (members.length === 0) {
      const inner = info.multiline
        ? `${style.eol}${indent}${items.join(`,${style.eol}${indent}`)}${style.eol}${info.closeIndent}`
        : items.join(`,${info.separator}`);
      edits.push({ start: obj.start + 1, end: obj.end - 1, text: inner });
    } else if (info.multiline) {
      if (before === members.length) {
        const at = members[members.length - 1].end;
        edits.push({ start: at, end: at, text: items.map((it) => `,${style.eol}${indent}${it}`).join('') });
      } else {
        const at = before === 0 ? obj.start + 1 : commaAfter(text, members[before - 1]);
        edits.push({ start: at, end: at, text: items.map((it) => `${style.eol}${indent}${it},`).join('') });
      }
    } else if (before === members.length) {
      const at = members[members.length - 1].end;
      edits.push({ start: at, end: at, text: items.map((it) => `,${info.separator}${it}`).join('') });
    } else if (before === 0) {
      const at = members[0].start;
      edits.push({ start: at, end: at, text: items.map((it) => `${it},${info.separator}`).join('') });
    } else {
      const at = commaAfter(text, members[before - 1]);
      edits.push({ start: at, end: at, text: items.map((it) => `${info.separator}${it},`).join('') });
    }
    for (const g of slotGroups) result.added.push(...g.keys);
  }

  let output = text;
  edits.sort((a, b) => b.start - a.start);
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  try {
    JSON.parse(output.charCodeAt(0) === 0xfeff ? output.slice(1) : output);
  } catch (error) {
    throw new Error(`Internal error: merge produced invalid JSON (${error.message})`);
  }
  result.text = output;
  return result;
}
