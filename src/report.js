/** Output formatters for `check` and `stats`. */
import path from 'node:path';

function annotationPath(file, cwd = process.cwd()) {
  const paths = /^[A-Za-z]:[\\/]|^\\\\/.test(file) ? path.win32 : path;
  const normalized = file.replace(/\\/g, '/');
  const relative = paths.relative(cwd, paths.resolve(normalized));
  return (relative !== '..' && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative)
    ? relative : normalized).replace(/\\/g, '/');
}

export function countIssues(results) {
  let errors = 0;
  let warnings = 0;
  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.severity === 'error') errors++;
      else warnings++;
    }
  }
  return { errors, warnings };
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function formatText(results) {
  const lines = [];
  for (const result of results) {
    lines.push(result.locale ? `${result.file} (${result.locale})` : result.file);
    if (result.issues.length === 0) {
      lines.push('  OK');
      lines.push('');
      continue;
    }
    const where = (issue) => (issue.line ? `${issue.line}:${issue.column}` : '-');
    const widthWhere = Math.max(...result.issues.map((issue) => where(issue).length));
    const widthCode = Math.max(...result.issues.map((issue) => issue.code.length));
    const widthKey = Math.min(48, Math.max(...result.issues.map((issue) => issue.key.length)));
    for (const issue of result.issues) {
      lines.push(
        `  ${where(issue).padEnd(widthWhere)}  ${issue.severity.padEnd(7)}  ${issue.code.padEnd(widthCode)}  ${issue.key.padEnd(widthKey)}  ${issue.message}`,
      );
    }
    const counts = countIssues([result]);
    lines.push('');
    lines.push(`  ${plural(counts.errors, 'error')}, ${plural(counts.warnings, 'warning')}`);
    lines.push('');
  }
  const total = countIssues(results);
  lines.push(
    `${plural(results.length, 'file')} checked: ${plural(total.errors, 'error')}, ${plural(total.warnings, 'warning')}`,
  );
  return `${lines.join('\n')}\n`;
}

export function formatJson(results) {
  const files = results.map((result) => ({
    file: result.file,
    locale: result.locale,
    summary: { ...countIssues([result]), ...result.summary },
    issues: result.issues.map(({ code, severity, key, message, line, column, ...rest }) => ({
      code,
      severity,
      key,
      message,
      line: line ?? null,
      column: column ?? null,
      ...rest,
    })),
  }));
  return `${JSON.stringify({ files, summary: { files: files.length, ...countIssues(results) } }, null, 2)}\n`;
}

const escapeData = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = (text) => escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** GitHub Actions workflow commands. Missing keys are collapsed into one annotation per file. */
export function formatGithub(results) {
  const lines = [];
  for (const result of results) {
    const missing = result.issues.filter((issue) => issue.code === 'missing');
    if (missing.length > 0) {
      const shown = missing.slice(0, 10).map((issue) => issue.key).join(', ');
      const more = missing.length > 10 ? `, and ${missing.length - 10} more` : '';
      lines.push(
        `::error file=${escapeProperty(annotationPath(result.file))},title=${escapeProperty('i18n-diff missing')}::${escapeData(
          `${plural(missing.length, 'key')} missing from this translation: ${shown}${more}`,
        )}`,
      );
    }
    for (const issue of result.issues) {
      if (issue.code === 'missing') continue;
      const level = issue.severity === 'error' ? 'error' : 'warning';
      const position = issue.line ? `,line=${issue.line},col=${issue.column}` : '';
      lines.push(
        `::${level} file=${escapeProperty(annotationPath(issue.file ?? result.file))}${position},title=${escapeProperty(`i18n-diff ${issue.code}`)}::${escapeData(
          `${issue.key}: ${issue.message}`,
        )}`,
      );
    }
  }
  const total = countIssues(results);
  lines.push(`i18n-diff: ${plural(total.errors, 'error')}, ${plural(total.warnings, 'warning')}`);
  return `${lines.join('\n')}\n`;
}

export function formatStatsText(rows) {
  const header = ['File', 'Locale', 'Translated', 'Missing', 'Empty', 'Untranslated', 'Extra', 'Complete'];
  const body = rows.map((row) => [
    row.file,
    row.locale ?? '-',
    `${row.translated}/${row.expected}`,
    String(row.missing),
    String(row.empty),
    String(row.untranslated),
    String(row.extra),
    `${row.percent.toFixed(1)}%`,
  ]);
  const widths = header.map((title, column) => Math.max(title.length, ...body.map((line) => line[column].length)));
  const render = (cells) => cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd();
  return `${[render(header), ...body.map(render)].join('\n')}\n`;
}

export function formatStatsJson(rows) {
  return `${JSON.stringify({ files: rows }, null, 2)}\n`;
}

// Escape user-controlled cells so pipes, newlines and HTML cannot break the table.
const markdownCell = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/\\/g, '&#92;').replace(/\|/g, '&#124;')
  .replace(/`/g, '&#96;').replace(/\r\n|[\r\n]/g, '<br>');
const markdownRow = (cells) => `| ${cells.map(markdownCell).join(' | ')} |`;

export function formatMarkdown(results, { maxIssues = 200 } = {}) {
  const lines = ['| File | Key | Check | Message |', '| --- | --- | --- | --- |'];
  let count = 0;
  for (const result of results) {
    for (const issue of result.issues) {
      if (count++ < maxIssues) lines.push(markdownRow([issue.file ?? result.file, issue.key, issue.code, issue.message]));
    }
  }
  if (count > maxIssues) lines.push('', `... and ${count - maxIssues} more`);
  return `${lines.join('\n')}\n`;
}

export function formatStatsMarkdown(rows) {
  return `${[
    markdownRow(['File', 'Locale', 'Translated', 'Missing', 'Empty', 'Untranslated', 'Extra', 'Complete']),
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => markdownRow([row.file, row.locale ?? '-', `${row.translated}/${row.expected}`,
      row.missing, row.empty, row.untranslated, row.extra, `${row.percent.toFixed(1)}%`])),
  ].join('\n')}\n`;
}
