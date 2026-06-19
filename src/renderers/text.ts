import type { SarifOptions } from './types.js';
import type { ParsedLog, ParsedResult, ResultLevel } from '../sarif/types.js';
import { groupBySeveritySummary, sortResults } from '../sarif/utils.js';

export function renderText(parsedLog: ParsedLog, opts: SarifOptions = {}): string {
  const results = parsedLog.results;
  const sorted = sortResults(results, 'severity');
  const summary = groupBySeveritySummary(sorted);

  // Collect all unique property keys across all results
  const allKeys = new Set<string>();
  results.forEach(r => {
    if (r.properties) {
      for (const key of Object.keys(r.properties)) {
        allKeys.add(key);
      }
    }
  });

  // Add standard fields that aren't properties
  if (sorted.some(x => x.kind)) allKeys.add('Kind');
  if (sorted.some(x => x.message)) allKeys.add('Message');
  if (sorted.some(x => x.locations.some(l => l.filePath))) allKeys.add('File');
  if (sorted.some(x => x.locations.some(l => l.line))) allKeys.add('Line');
  if (sorted.some(x => x.locations.some(l => l.column))) allKeys.add('Column');
  if (sorted.some(x => x.fix)) allKeys.add('Fix');
  if (sorted.some(x => x.contextSnippet?.text)) allKeys.add('Snippet');
  if (sorted.some(x => x.ruleFullDescription)) allKeys.add('Description');
  if (sorted.some(x => x.occurenceCount)) allKeys.add('Occurrences');
  if (sorted.some(x => x.ruleFullDescription)) allKeys.add('Description');

  const sortedKeys = Array.from(allKeys).sort();

  const d: string[] = [];

  // Header
  d.push(parsedLog.tool.name);
  if (parsedLog.tool.version) {
    d.push('  Version: ' + parsedLog.tool.version);
  }
  d.push('');
  d.push('Summary');
  d.push('  Errors:   ' + summary.errors);
  d.push('  Warnings: ' + summary.warnings);
  d.push('  Notes:    ' + summary.notes);
  d.push('  Total:    ' + summary.total);
  d.push('');

  // Group by severity
  const groups: Map<ResultLevel, ParsedResult[]> = new Map();
  for (const r of sorted) {
    const existing = groups.get(r.level) || [];
    existing.push(r);
    groups.set(r.level, existing);
  }

  const levelOrder: ResultLevel[] = ['error', 'warning', 'note', 'none'];

  for (const level of levelOrder) {
    const group = groups.get(level);
    if (!group || group.length === 0) continue;

    d.push('### ' + level.toUpperCase() + ' (Count: ' + group.length + ')');
    d.push('');

    for (let idx = 0; idx < group.length; idx++) {
      const r = group[idx];
      d.push('#### Result ' + (idx + 1) + ' - ' + r.ruleId);
      d.push('');
      d.push(getTableHeader(sortedKeys.join(' | ')));
      d.push(getTableSeparator(sortedKeys));
      d.push(getTableRow(sortedKeys, r, idx));
      d.push('');
    }
  }

  return d.join('\n');
}

function getTableHeader(cols: string): string {
  return '| # | ' + cols + ' |';
}

function getTableSeparator(keys: string[]): string {
  const seps = keys.map(() => '---');
  return '| --- | ' + seps.join(' | ') + ' |';
}

function getTableRow(keys: string[], r: ParsedResult, idx: number): string {
  const values = new Map<string, string>();
  values.set('Index', String(idx + 1));
  values.set('Level', r.level);
  values.set('RuleId', r.ruleId);

  for (const key of keys) {
    let val = '';
    if (key === 'Kind') val = r.kind || '';
    else if (key === 'Message') val = r.message;
    else if (key === 'File') {
      const loc = r.locations.find(l => l.filePath);
      val = loc ? spp(loc.filePath) : '';
    }
    else if (key === 'Line') {
      const loc = r.locations.find(l => l.filePath);
      val = loc ? String(loc.line) : '';
    }
    else if (key === 'Column') {
      const loc = r.locations.find(l => l.filePath);
      val = loc && loc.column ? String(loc.column) : '';
    }
    else if (key === 'Description') {
      val = r.ruleFullDescription || '';
    }
    else if (key === 'Snippet') {
      val = r.contextSnippet?.text?.split('\n')[0] || '';
    }
    else if (key === 'Fix') {
      val = r.fix?.description || '';
    }
    else if (key === 'Occurrences') {
      val = r.occurenceCount ? String(r.occurenceCount) : '';
    }
    else {
      // Custom property
      val = r.properties?.[key.toLowerCase()] || r.properties?.[key] || '';
    }

    // Truncate very long values
    if (val.length > 60) val = val.slice(0, 60) + '...';
    val = val || '-';
    values.set(key, val);
  }

  // Build the row string with simple spacing
  const parts = keys.map(k => values.get(k) || '-');
  return '| ' + (idx + 1) + ' | ' + parts.join(' | ') + ' |';
}

function spp(fp: string): string {
  const parts = fp.split('/');
  if (parts.join('').length > 60 && parts.length > 3) {
    return '...' + parts.slice(-3).join('/');
  }
  return fp;
}
