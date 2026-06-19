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
  if (sorted.some(r => r.kind)) allKeys.add('Kind');
  if (sorted.some(r => r.message)) allKeys.add('Message');
  if (sorted.some(r => r.locations.some(l => l.filePath))) allKeys.add('File');
  if (sorted.some(r => r.locations.some(l => l.line))) allKeys.add('Line');
  if (sorted.some(r => r.locations.some(l => l.column))) allKeys.add('Column');
  if (sorted.some(r => r.fix)) allKeys.add('Fix');
  if (sorted.some(r => r.contextSnippet?.text)) allKeys.add('Snippet');
  if (sorted.some(r => r.ruleFullDescription)) allKeys.add('Description');

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

  let first = true;
  for (const level of levelOrder) {
    const group = groups.get(level);
    if (!group || group.length === 0) continue;

    if (!first) d.push('');
    first = false;

    d.push('### ' + level.toUpperCase() + ' (Count: ' + group.length + ')');
    d.push('');

    for (let idx = 0; idx < group.length; idx++) {
      const r = group[idx];
      d.push('#### Result ' + (idx + 1) + ' - ' + r.ruleId);
      d.push('');

      // Build table header
      const header: string[] = [];
      const sep: string[] = [];
      header.push('| Field');
      sep.push('| ---');

      for (const key of sortedKeys) {
        header.push(' ' + key);
        sep.push(' ---');
      }
      sep.push(' |');
      header.push(' |');

      // Build table body
      const values: string[] = [];
      values.push('| ' + (idx + 1)); // Index column

      // Values for each key
      for (const key of sortedKeys) {
        let val = '';
        if (key === 'Level') val = r.level;
        else if (key === 'RuleId') val = r.ruleId;
        else if (key === 'Kind') val = r.kind || '';
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
          // Custom property from message.properties or rule.properties
          val = r.properties?.[key.toLowerCase()] || r.properties?.[key] || '';
        }

        // Truncate very long values
        if (val.length > 50) val = val.slice(0, 50) + '...';
        val = val || '-';
        values.push('| ' + val);
      }
      values.push('|');

      // Print table
      d.push(header.join(''));
      d.push(sep.join(''));
      d.push(values.join(''));
      d.push('');
    }
  }

  d.push('---');
  return d.join('\n');
}

function spp(fp: string): string {
  const parts = fp.split('/');
  if (parts.join('').length > 60 && parts.length > 3) {
    return '...' + parts.slice(-3).join('/');
  }
  return fp;
}
