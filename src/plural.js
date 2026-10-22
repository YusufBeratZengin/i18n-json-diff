import { PLURAL_CATEGORIES } from './locale.js';

const PLURAL_KEY = /^(.+)_(zero|one|two|few|many|other)$/;

/** Splits `item_one` into `{ base: 'item', category: 'one' }`, or null. */
export function splitPluralKey(key) {
  const match = PLURAL_KEY.exec(key);
  return match ? { base: match[1], category: match[2] } : null;
}

/**
 * Finds i18next-style plural groups in a list of keys.
 * A base counts as a plural group when it has an `_other` form plus at least
 * one other form, so a lone key such as `settings_other` is left alone.
 * Returns Map<base, Set<category>>.
 */
export function findPluralBases(keys) {
  const groups = new Map();
  for (const key of keys) {
    const parts = splitPluralKey(key);
    if (!parts) continue;
    if (!groups.has(parts.base)) groups.set(parts.base, new Set());
    groups.get(parts.base).add(parts.category);
  }
  for (const [base, categories] of groups) {
    if (!categories.has('other') || categories.size < 2) groups.delete(base);
  }
  return groups;
}

export function categoryIndex(category) {
  return PLURAL_CATEGORIES.indexOf(category);
}
