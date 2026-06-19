import type { SarifOptions } from './types.js';
import type { ParsedLog, ResultLevel } from '../sarif/types.js';
import { groupBySeveritySummary, sortResults } from '../sarif/utils.js';

function c(colorName: string) {
  const fn = (global as any).chalk;
  return (s: string) => {
    if (typeof fn === 'undefined' || typeof fn[colorName] !== 'function') return s;
    return fn[colorName](s);
  };
}

const lc: Record<ResultLevel, (s: string) => string> = {
  error: c('red'),
  warning: c('yellow'),
  note: c('cyan'),
  none: c('grey'),
};

export function renderText(parsedLog: ParsedLog, opts: SarifOptions = {}): string {
  const results = parsedLog.results;
  const sorted = sortResults(results, 'severity');
  const summary = groupBySeveritySummary(sorted);

  const d: string[] = [];
  const tool = parsedLog.tool.name + (parsedLog.tool.version ? ' v' + parsedLog.tool.version : '');

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
  d.push('Results (By severity)');
  d.push('\u2500'.repeat(85));

  if (sorted.length === 0) {
    d.push('  No results found.');
  } else {
    let cur = '';
    for (const r of sorted) {
      if (r.level !== cur) {
        if (cur !== '') d.push('');
        cur = r.level;
        d.push('Level: ' + r.level);
        d.push('\u2500'.repeat(70));
      }
      const icon = r.level === 'error' ? 'X' : r.level === 'warning' ? '!' : 'i';
      const cnt = r.occurenceCount && r.occurenceCount > 1
        ? ' (observed ' + r.occurenceCount + ' times)'
        : '';
      d.push('');
      d.push('  [' + icon + '] [' + r.ruleId + '] ' + r.message + cnt);

      const lp: string[] = [];
      for (const loc of r.locations) {
        if (loc.filePath) {
          let p = spp(loc.filePath);
          if (loc.line) p += ':' + loc.line;
          if (loc.column) p += ':' + loc.column;
          lp.push(p);
        }
      }
      if (lp.length > 0) {
        d.push('  ' + lp.join(' | '));
      }

      if (r.contextSnippet?.text) {
        const line = r.contextSnippet.text.split('\n')[0];
        if (line && line.trim()) {
          d.push('  ' + (line.length > 78 ? line.slice(0, 78) + '\u2026' : line));
        }
      }

      if (r.ruleFullDescription) {
        const dl = r.ruleFullDescription.split('\n').filter(l => l.trim())[0];
        if (dl) {
          d.push('  ' + (dl.length > 78 ? dl.slice(0, 78) + '\u2026' : dl));
        }
      }

      if (r.fix) {
        d.push('  Fix: ' + r.fix.description);
      }
    }
  }
  d.push('');
  d.push('\u2500'.repeat(85));
  return d.join('\n');
}

function spp(fp: string): string {
  const parts = fp.split('/');
  if (parts.join('').length > 60 && parts.length > 3) {
    return '...' + parts.slice(-3).join('/');
  }
  return fp;
}
