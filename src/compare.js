import { detectLocale, normalizeLocale, pluralCategoriesFor, primaryLanguage } from './locale.js';
import {
  analyze,
  diffCounts,
  extractTags,
  globToRegExp,
  hasTranslatableText,
  trailingPunctuation,
} from './messages.js';
import { findPluralBases, splitPluralKey } from './plural.js';
import { InputError } from './files.js';

/** Check codes, with the severity each one reports at. */
export const SEVERITY = {
  missing: 'error',
  extra: 'error',
  empty: 'error',
  placeholder: 'error',
  'icu-syntax': 'error',
  'html-tag': 'error',
  'duplicate-key': 'error',
  'key-collision': 'error',
  'invalid-file': 'error',
  untranslated: 'warning',
  punctuation: 'warning',
};

export const CHECKS = Object.keys(SEVERITY);

export function validateCheckNames(names) {
  for (const name of names) {
    if (!(name in SEVERITY)) {
      throw new InputError(`Unknown check "${name}". Known checks: ${CHECKS.join(', ')}`);
    }
  }
}

const isBlank = (value) => value === null || value.trim() === '';

function shorten(text, max = 60) {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function list(items) {
  return items.join(', ');
}

/**
 * Compares a target translation file with the source file.
 *
 * options:
 *   locale          locale of the target (default: detected from the file path)
 *   sourceLocale    locale of the source (default: detected from the file path)
 *   ignore          iterable of check codes to skip
 *   allowKeys       key patterns (with * and ?) allowed to equal the source
 *   allowValues     values allowed to equal the source
 *
 * Returns { file, locale, issues, summary, todo }. `todo` lists every key that
 * still needs a translation (missing, empty or identical to the source).
 */
export function compareFiles(source, target, options = {}) {
  const ignore = new Set(options.ignore ?? []);
  validateCheckNames(ignore);
  const allowKeys = (options.allowKeys ?? []).map(globToRegExp);
  const allowValues = new Set((options.allowValues ?? []).map((value) => value.trim()));

  const targetLocale = options.locale ? normalizeLocale(options.locale) ?? options.locale : detectLocale(target.path);
  const sourceLocale = options.sourceLocale
    ? normalizeLocale(options.sourceLocale) ?? options.sourceLocale
    : detectLocale(source.path);
  const targetLanguage = primaryLanguage(targetLocale);
  const sourceLanguage = primaryLanguage(sourceLocale);
  const sameLanguage = Boolean(targetLanguage && targetLanguage === sourceLanguage);

  const issues = [];
  const todo = [];
  const add = (code, key, message, extra = {}) => {
    if (ignore.has(code)) return;
    issues.push({ code, severity: SEVERITY[code], key, message, ...extra });
  };

  // Build the list of keys the target is expected to contain.
  const pluralBases = findPluralBases(source.keys);
  const expected = [];
  const handledBases = new Set();
  for (const key of source.keys) {
    const parts = splitPluralKey(key);
    if (!parts || !pluralBases.has(parts.base)) {
      expected.push({ key, sourceKey: key, plural: null });
      continue;
    }
    if (handledBases.has(parts.base)) continue;
    handledBases.add(parts.base);
    const sourceCategories = pluralBases.get(parts.base);
    const categories =
      pluralCategoriesFor(targetLocale, parts.base.endsWith('_ordinal')) ??
      [...sourceCategories];
    const group = [...sourceCategories].map((category) => `${parts.base}_${category}`);
    for (const category of categories) {
      const formKey = `${parts.base}_${category}`;
      expected.push({
        key: formKey,
        sourceKey: sourceCategories.has(category) ? formKey : `${parts.base}_other`,
        plural: { group },
      });
    }
  }
  const expectedKeys = new Set(expected.map((item) => item.key));

  const summary = {
    expected: expected.length,
    translated: 0,
    missing: 0,
    empty: 0,
    untranslated: 0,
    extra: 0,
  };

  const sourceAnalysis = new Map();
  const analyzeSource = (key) => {
    if (!sourceAnalysis.has(key)) sourceAnalysis.set(key, analyze(source.entries.get(key).value ?? ''));
    return sourceAnalysis.get(key);
  };

  expected.forEach((item, index) => {
    const sourceEntry = source.entries.get(item.sourceKey);
    const sourceValue = sourceEntry.value ?? '';
    const entry = target.entries.get(item.key);
    const need = (reason) => todo.push({ ...item, sourceValue, reason, index });

    if (!entry) {
      summary.missing++;
      if (!isBlank(sourceValue)) need('missing');
      add('missing', item.key, `Missing key (source: "${shorten(sourceValue)}")`, {
        sourceValue,
      });
      return;
    }
    const location = { line: entry.line, column: entry.column };
    if (isBlank(sourceValue)) {
      summary.translated++;
      return;
    }
    if (isBlank(entry.value)) {
      summary.empty++;
      need('empty');
      add('empty', item.key, 'Translation is empty', { ...location, sourceValue });
      return;
    }
    summary.translated++;
    const value = entry.value;
    const sourceInfo = analyzeSource(item.sourceKey);
    const targetInfo = analyze(value);

    if (targetInfo.icuError && !sourceInfo.icuError) {
      add('icu-syntax', item.key, `ICU syntax error: ${targetInfo.icuError}`, location);
    } else if (!sourceInfo.icuError) {
      let allowed = sourceInfo.placeholders;
      if (item.plural) {
        allowed = new Set(item.plural.group.flatMap((k) => [...analyzeSource(k).placeholders]));
      }
      const missing = item.sourceKey === item.key
        ? [...sourceInfo.placeholders].filter((p) => !targetInfo.placeholders.has(p))
        : [];
      const unexpected = [...targetInfo.placeholders].filter((p) => !allowed.has(p));
      if (missing.length > 0 || unexpected.length > 0) {
        const parts = [];
        if (missing.length > 0) parts.push(`missing ${list(missing)}`);
        if (unexpected.length > 0) parts.push(`unexpected ${list(unexpected)}`);
        add('placeholder', item.key, `Placeholder mismatch: ${parts.join('; ')}`, {
          ...location,
          missing,
          unexpected,
        });
      }
    }

    const tags = diffCounts(extractTags(sourceValue), extractTags(value));
    if (tags.missing.length > 0 || tags.unexpected.length > 0) {
      const parts = [];
      if (tags.missing.length > 0) parts.push(`missing ${list(tags.missing)}`);
      if (tags.unexpected.length > 0) parts.push(`unexpected ${list(tags.unexpected)}`);
      add('html-tag', item.key, `HTML tag mismatch: ${parts.join('; ')}`, {
        ...location,
        missing: tags.missing,
        unexpected: tags.unexpected,
      });
    }

    if (
      !sameLanguage &&
      value === sourceValue &&
      hasTranslatableText(sourceValue) &&
      !allowValues.has(sourceValue.trim()) &&
      !allowKeys.some((pattern) => pattern.test(item.key))
    ) {
      summary.untranslated++;
      need('untranslated');
      add('untranslated', item.key, 'Translation is identical to the source', location);
    }

    const sourceEnd = trailingPunctuation(sourceValue, sourceLanguage);
    const targetEnd = trailingPunctuation(value, targetLanguage);
    if (sourceEnd !== targetEnd) {
      const name = (mark) => (mark === '' ? 'no punctuation' : `"${mark}"`);
      add(
        'punctuation',
        item.key,
        `Trailing punctuation differs: source ends with ${name(sourceEnd)}, translation with ${name(targetEnd)}`,
        location,
      );
    }
  });

  for (const key of target.keys) {
    if (expectedKeys.has(key)) continue;
    const entry = target.entries.get(key);
    summary.extra++;
    add('extra', key, 'Key does not exist in the source', { line: entry.line, column: entry.column });
  }

  for (const file of [source, target]) {
    for (const duplicate of file.duplicates) {
      add('duplicate-key', duplicate.key, `Key is defined more than once in ${file.path}`, {
        line: duplicate.line, column: duplicate.column, file: file.path,
      });
    }
    for (const collision of file.collisions ?? []) {
      add('key-collision', collision.key, `Different keys flatten to the same path in ${file.path}`, {
        line: collision.line, column: collision.column, file: file.path,
      });
    }
  }

  summary.percent = summary.expected === 0 ? 100 : Math.round((summary.translated / summary.expected) * 1000) / 10;

  return { file: target.path, locale: targetLocale, issues, summary, todo };
}
