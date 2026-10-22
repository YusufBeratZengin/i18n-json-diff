import { basename, dirname } from 'node:path';

export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

const LOCALE_SHAPE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/;

/** Returns a canonical BCP 47 tag, or null when the text is not a known locale. */
export function normalizeLocale(tag) {
  if (typeof tag !== 'string' || !LOCALE_SHAPE.test(tag)) return null;
  try {
    const canonical = Intl.getCanonicalLocales(tag.replace(/_/g, '-'))[0];
    if (Intl.PluralRules.supportedLocalesOf([canonical]).length === 0) return null;
    return canonical;
  } catch {
    return null;
  }
}

/**
 * Guesses the locale of a translation file from its path:
 * `fr.json`, `pt_BR.json`, `messages.de.json`, `locales/ja/common.json`.
 */
export function detectLocale(filePath) {
  const base = basename(filePath).replace(/\.[^.]+$/, '');
  const candidates = [base, ...base.split('.').reverse(), basename(dirname(filePath))];
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) return locale;
  }
  return null;
}

export function primaryLanguage(locale) {
  return locale ? locale.split('-')[0].toLowerCase() : null;
}

/** Plural categories a locale needs, in canonical order. Null when unknown. */
export function pluralCategoriesFor(locale, ordinal = false) {
  if (!locale) return null;
  try {
    const rules = new Intl.PluralRules(locale, { type: ordinal ? 'ordinal' : 'cardinal' });
    const categories = rules.resolvedOptions().pluralCategories;
    return PLURAL_CATEGORIES.filter((category) => categories.includes(category));
  } catch {
    return null;
  }
}
