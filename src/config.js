import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCheckNames } from './compare.js';
import { InputError } from './files.js';

export const CONFIG_FILE = '.i18n-diff.json';

const LIST_FIELDS = ['ignore', 'allowKeys', 'allowValues'];
const KNOWN_FIELDS = new Set([...LIST_FIELDS, 'sourceLocale', 'warningsAsErrors', 'format']);

/**
 * Loads the optional config file. With no explicit path, `.i18n-diff.json` in
 * the working directory is used when it exists.
 *
 * Fields: ignore, allowKeys, allowValues (string arrays), sourceLocale (string),
 * warningsAsErrors (boolean), format ("text" | "json" | "github").
 */
export function loadConfig(explicitPath, cwd = process.cwd()) {
  const path = resolve(cwd, explicitPath ?? CONFIG_FILE);
  if (!existsSync(path)) {
    if (explicitPath) throw new InputError(`Config file not found: ${explicitPath}`);
    return {};
  }
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new InputError(`Cannot read config ${path}: ${error.message}`);
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new InputError(`Config ${path} must be a JSON object`);
  }
  for (const key of Object.keys(config)) {
    if (!KNOWN_FIELDS.has(key)) throw new InputError(`Unknown config field "${key}" in ${path}`);
  }
  for (const field of LIST_FIELDS) {
    const value = config[field];
    if (value !== undefined && !(Array.isArray(value) && value.every((item) => typeof item === 'string'))) {
      throw new InputError(`Config field "${field}" must be an array of strings`);
    }
  }
  if (config.ignore) validateCheckNames(config.ignore);
  if (config.warningsAsErrors !== undefined && typeof config.warningsAsErrors !== 'boolean') {
    throw new InputError('Config field "warningsAsErrors" must be a boolean');
  }
  if (config.sourceLocale !== undefined && typeof config.sourceLocale !== 'string') {
    throw new InputError('Config field "sourceLocale" must be a string');
  }
  return config;
}
