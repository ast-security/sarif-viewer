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

  if (sorted.some(x => x.kind)) allKeys.add('Kind');
  if (sorted.some(x => x.message)) allKeys.add('Message');
  if (sorted.some(x => x.locations.some(l => l.filePath))) allKeys.add('File');
  if (sorted.some(x => x.locations.some(l => l.line))) allKeys.add('Line');
  if (sorted.some(x => x.locations.some(l => l.column))) allKeys.add('Column');
  if (sorted.some(x => x.fix)) allKeys.add('Fix');
  if (sorted.some(x => x.contextSnippet?.text)) allKeys.add('Snippet');
  if (sorted.some(x => x.ruleFullDescription)) allKeys.add('Description');
  if (sorted.some(x => x.occurenceCount)) allKeys.add('Occurrences');

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

    d.push(''.repeat(2) + level.toUpperCase() + ' (Count: ' + group.length + ')');
    d.push('');

    for (let idx = 0; idx < group.length; idx++) {
      const r = group[idx];

      // Separators around the result
      d.push('────────────────────────────────────────────────────────────────────────────────────────────────────');
      d.push('');

      // Header
      const headParts = ['Index'];
      for (const key of sortedKeys) headParts.push(key);
      d.push('  ' + headParts.join(' | '));

      const vals = [String(idx + 1)];

      for (const key of sortedKeys) {
        let val = '-';
        try {
          if (key === 'Kind') {
            val = r.kind || '';
          } else if (key === 'Message') {
            val = r.message;
          } else if (key === 'File') {
            const loc = r.locations.find(l => l.filePath);
            if (loc) val = spp(loc.filePath || '');
          } else if (key === 'Line') {
            const loc = r.locations.find(l => l.filePath);
            if (loc) val = String(loc.line);
          } else if (key === 'Column') {
            const loc = r.locations.find(l => l.filePath);
            if (loc && loc.column) val = String(loc.column);
          } else if (key === 'Description') {
            val = r.ruleFullDescription || '';
          } else if (key === 'Snippet') {
            val = r.contextSnippet?.text?.split('\n')[0] || '';
          } else if (key === 'Fix') {
            val = r.fix?.description || '';
          } else if (key === 'Occurrences') {
            val = r.occurenceCount ? String(r.occurenceCount) : '-';
          } else {
            // Case-insensitive property lookup
            const props = r.properties || {};
            const lowKey = key.toLowerCase();
            const upperKey = key.toUpperCase();
            val = props[lowKey] || props[upperKey] || props[key] || '-';
          }

          if (val.length > 50) {
            val = val.slice(0, 50) + '...';
          }
        } catch (err) {
          val = 'ERR';
        }

        if (!val) val = '-';
        vals.push(val);
      }

      d.push('  ' + vals.join(' | '));
      d.push('');
    }
  }

  return d.join('\n');
}

function spp(fp: string): string {
  const parts = fp.split('/');
  if (parts.join('').length > 60 && parts.length > 3) {
    return '...' + parts.slice(-3).join('/');
  }
  return fp;
}
