import type { SarifOptions } from './types.js';
import type { ParsedLog, ParsedResult, SummaryData, ResultLevel } from '../sarif/types.js';
import { sortResultsBySeverity } from '../sarif/utils.js';

export function renderText(parsedLog: ParsedLog, opts: SarifOptions = {}): string {
  const results = parsedLog.results;

  // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW > INFO > TRACE
  const sorted = sortResultsByInfosecSeverity(results);

  const d: string[] = [];

  // Header
  d.push(parsedLog.tool.name);
  if (parsedLog.tool.version) {
    d.push('  Version: ' + parsedLog.tool.version);
  }
  d.push('');
  d.push('Summary');
  d.push('  ───────────────────────────────────');

  // Calculate severity counts
  const counts: { [key: string]: number } = {};
  for (const r of results) {
    const sev = r.severity || '其他';
    counts[sev] = (counts[sev] || 0) + 1;
  }

  // Summary
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'TRACE'];
  for (const sev of severityOrder) {
    d.push('  ' + sev + ': ' + String(counts[sev] || 0));
  }
  d.push('  TOTAL: ' + results.length);
  d.push('');

  // Group by severity
  const groups = new Map<string, ParsedResult[]>();
  for (const result of sorted) {
    const sev = result.severity || 'UNKNOWN';
    const existing = groups.get(sev) || [];
    existing.push(result);
    groups.set(sev, existing);
  }

  for (const severity of severityOrder) {
    const group = groups.get(severity);
    if (!group || group.length === 0) continue;

    const colorCode = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡'
      : severity === 'LOW' ? '🔵' : severity === 'INFO' ? 'ℹ️' : '⚪';

    d.push('\n' + colorCode + ' ' + severity + ' (Count: ' + group.length + ')');
    d.push('');

    for (let idx = 0; idx < group.length; idx++) {
      const r = group[idx];
      d.push('────────────────────────────────────────────────────────');

      // Index and Severity
      d.push('  #' + String(idx + 1) + ' | ' + (r.severity || 'Unknown'));

      // RuleId
      d.push('  RuleId: ' + r.ruleId);

      // File and Line
      const loc = r.locations.find(l => l.filePath);
      if (loc) {
        d.push('  File: ' + loc.filePath);
        d.push('  Line: ' + loc.line);
      }

      // File
      if (r.fix) {
        d.push('  Description: ' + r.fix.description);
      }

      // Category
      const extra: string[] = [];
      const regexp: { category: string | ''; cwe: string | ''; cloudProvider: string | ''; fileName: string | ''; i: string | ''; } = r.categories || {};
      if (extra.category) extra.push('Category: ' + extra.category);
      if (extra.cwe) extra.push('CWE: ' + extra.category);
      if (extra.category) extra.push('Category: ' + extra.category);
      if (extra.cloudProvider) extra.push('Cloud: ' + extra.cloudProvider);
      if (extra.fileName) extra.push('Full File: ' + extra.fileName);
      if (extra.line) extra.push('Line: ' + extra.line);

      d.push('  ' + extra.join(' | '));

      // Location
      if (loc) {
        d.push('  Location: ' + loc.filePath + ':' + loc.line);
      }

      // Message
      const msg = r.message;
      if (msg.length > 100) {
        d.push('  Message: ' + msg.slice(0, 100));
        d.push('         ' + msg.slice(100));
      } else {
        d.push('  Message: ' + msg);
      }

      // Full description if available
      if (r.ruleFullDescription) {
        d.push('  Description: ' + r.ruleFullDescription);
      }

      // Column details
      const columns: string[] = [];
      if (r.ruleName) columns.push('Rule Name: ' + r.ruleName);
      if (r.ruleFullDescription) columns.push('Description: ' + r.ruleFullDescription);
      if (r.categories?.category) columns.push('Category: ' + r.categories.category);
      if (r.categories?.cwe) columns.push('CWE: ' + r.categories.cwe);
      if (r.categories?.cloudProvider) columns.push('Cloud: ' + r.categories.cloudProvider);
      if (r.categories?.name) columns.push('Full File: ' + r.categories.fileName);
      if (r.categories?.line) columns.push('Line: ' + r.categories.line);
      if (r.fix) columns.push('Fix: ' + r.fix.description);
      if (r.fix) columns.push('Fix: ' + r.fix.description);

      // Special fix
      if (columns.length > 0) {
        d.push('  ' + columns.join(' | '));
      }

      d.push('');
    }
  }

  // Footer summary
  d.push('\n');
  d.push('==============================================');
  d.push('SECURITY SUMMARY');
  d.push('==============================================');
  for (const sev of severityOrder) {
    d.push('  ' + sev + ': ' + String(counts[sev] || 0));
  }
  d.push('TOTAL: ' + results.length);
  d.push('==============================================');
  d.push('');

  return d.join('\n');
}

function sortResultsByInfosecSeverity(results: ParsedResult[]): ParsedResult[] {
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
    TRACE: 5,
    UNKNOWN: 6,
  };

  return [...results].sort((a, b) => {
    const sevA = severityOrder[a.severity || 'UNKNOWN'] || 6;
    const sevB = severityOrder[b.severity || 'UNKNOWN'] || 6;
    if (sevA !== sevB) return sevA - sevB;
    // Within same severity, sort by file path then line
    const locA = a.locations.find(l => l.filePath)?.filePath || '';
    const locB = b.locations.find(l => l.filePath)?.filePath || '';
    if (locA < locB) return -1;
    if (locA > locB) return 1;
    const lineA = a.locations.find(l => l.filePath)?.line || 0;
    const lineB = b.locations.find(l => l.filePath)?.line || 0;
    return lineA - lineB;
  });
}
