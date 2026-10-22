import { parseIcu } from './icu.js';

// i18next: {{name}}, {{- name}}, {{name, format}}
const DOUBLE_BRACES = /\{\{\s*-?\s*([^\s{},]+)[^{}]*\}\}/g;
// i18next nesting: $t(key) or $t(key, {"opt": 1})
const NESTING = /\$t\(([^)]*)\)/g;
// vue-i18n linked messages: @:key, @.upper:key, @:(key.path)
const LINKED = /@(?:\.[a-z]+)?:(?:\([\w.]+\)|\w+(?:\.\w+)*)/g;
const LENIENT_BRACES = /\{\s*([^\s,{}']+)/g;

/**
 * Extracts the placeholders of a message and validates its ICU syntax.
 * Placeholders are normalised to strings: `{name}`, `{{name}}`, `$t(key)`, `@:key`.
 * On an ICU syntax error the placeholders found by a lenient scan are returned
 * together with the error text.
 */
export function analyze(message) {
  const placeholders = new Set();
  let rest = message.replace(DOUBLE_BRACES, (_, name) => {
    placeholders.add(`{{${name}}}`);
    return ' ';
  });
  rest = rest.replace(NESTING, (_, inner) => {
    placeholders.add(`$t(${inner.split(',')[0].trim()})`);
    return ' ';
  });
  rest = rest.replace(LINKED, (match) => {
    placeholders.add(match);
    return ' ';
  });
  let icuError = null;
  if (/[{}]/.test(rest)) {
    const result = parseIcu(rest);
    if (result.error) {
      icuError = result.error;
      for (const match of rest.matchAll(LENIENT_BRACES)) placeholders.add(`{${match[1]}}`);
    } else {
      for (const name of result.args) placeholders.add(`{${name}}`);
    }
  }
  return { placeholders, icuError };
}

const TAG = /<(\/?)([A-Za-z0-9][\w:-]*)(?:\s[^<>]*?)?(\/?)>/g;
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr', 'meta', 'link']);

/** Counts HTML-like tags (`<b>`, `</b>`, `<br/>`, `<0>`), ignoring attributes. */
export function extractTags(message) {
  const counts = new Map();
  for (const [, closing, name, selfClosing] of message.matchAll(TAG)) {
    let token;
    if (closing) token = `</${name}>`;
    else if (selfClosing || VOID_TAGS.has(name.toLowerCase())) token = `<${name}/>`;
    else token = `<${name}>`;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

export function diffCounts(expected, actual) {
  const missing = [];
  const unexpected = [];
  for (const [token, count] of expected) {
    const delta = count - (actual.get(token) ?? 0);
    for (let n = 0; n < delta; n++) missing.push(token);
  }
  for (const [token, count] of actual) {
    const delta = count - (expected.get(token) ?? 0);
    for (let n = 0; n < delta; n++) unexpected.push(token);
  }
  return { missing, unexpected };
}

const PUNCTUATION_CLASS = new Map([
  ['.', '.'], ['。', '.'], ['।', '.'], ['۔', '.'], ['｡', '.'],
  ['!', '!'], ['！', '!'],
  ['?', '?'], ['？', '?'], ['؟', '?'],
  [':', ':'], ['：', ':'],
  [';', ';'], ['；', ';'], ['؛', ';'],
  [',', ','], ['，', ','], ['、', ','], ['،', ','],
  ['…', '…'],
]);

const TRAILING_NOISE = /(?:<\/?[^<>]+>|[\s"'“”‘’«»)\]*_`])+$/u;

/**
 * Canonical class of the punctuation at the end of a message ('' for none).
 * Full-width, Arabic and Devanagari marks map to their ASCII counterparts.
 */
export function trailingPunctuation(message, language = null) {
  const text = message.replace(TRAILING_NOISE, '');
  if (text.endsWith('...')) return '…';
  const last = text.slice(-1);
  if (language === 'el' && last === ';') return '?';
  return PUNCTUATION_CLASS.get(last) ?? '';
}

/** True when the message has at least one letter outside placeholders and tags. */
export function hasTranslatableText(message) {
  const stripped = message.replace(/\{\{[^{}]*\}\}|\{[^{}]*\}|<[^<>]*>/g, ' ');
  return /\p{L}/u.test(stripped);
}

export function globToRegExp(pattern) {
  const source = pattern
    .split('')
    .map((char) => {
      if (char === '*') return '.*';
      if (char === '?') return '.';
      return char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${source}$`);
}
