import { compareFiles } from './compare.js';

/** Builds a nested object from dotted keys; keys that collide stay flat. */
function nest(pairs) {
  const root = {};
  for (const [key, value] of pairs) {
    const segments = key.split('.');
    let node = root;
    let ok = true;
    for (const segment of segments.slice(0, -1)) {
      if (node[segment] === undefined) node[segment] = {};
      if (typeof node[segment] !== 'object') {
        ok = false;
        break;
      }
      node = node[segment];
    }
    const last = segments[segments.length - 1];
    if (ok && node[last] === undefined) node[last] = value;
    else root[key] = value;
  }
  return root;
}

/**
 * Collects the keys a translator still has to work on, with the source text
 * as value. Plural forms the target language needs but the source lacks
 * (for example `item_few` for Russian) carry the source `_other` text.
 *
 * options: compare options plus
 *   onlyMissing          leave out keys that exist but are empty
 *   includeUntranslated  also list keys identical to the source
 *   shape                'nested' | 'flat' | 'auto' (default: follow the source file)
 */
export function exportMissing(source, target, options = {}) {
  const { onlyMissing = false, includeUntranslated = false, shape = 'auto', ...compareOptions } = options;
  const result = compareFiles(source, target, compareOptions);
  const reasons = new Set(['missing']);
  if (!onlyMissing) reasons.add('empty');
  if (includeUntranslated) reasons.add('untranslated');
  const pairs = result.todo
    .filter((item) => reasons.has(item.reason))
    .sort((a, b) => a.index - b.index)
    .map((item) => [item.key, item.sourceValue]);
  const nested = shape === 'nested' || (shape === 'auto' && source.hasNesting);
  const data = nested ? nest(pairs) : Object.fromEntries(pairs);
  return { data, count: pairs.length, text: `${JSON.stringify(data, null, 2)}\n`, locale: result.locale };
}
