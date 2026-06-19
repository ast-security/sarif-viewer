import type { ParsedLog, ParsedResult, ResultLevel } from './types.js';
import { RESULT_LEVEL_ORDER } from './types.js';

export function filterByLevel(results: ParsedResult[], level: ResultLevel | 'all'): ParsedResult[] {
  if (level === 'all') return results;
  return results.filter((r) => r.level === level);
}

export function filterByRule(results: ParsedResult[], ruleId: string): ParsedResult[] {
  return results.filter((r) => r.ruleId === ruleId);
}

export function filterByFile(results: ParsedResult[], filePath: string): ParsedResult[] {
  return results.filter((r) =>
    r.locations.some((l) => l.filePath?.includes(filePath))
  );
}

export function searchResults(results: ParsedResult[], query: string): ParsedResult[] {
  const q = query.toLowerCase();
  return results.filter(
    (r) =>
      r.message.toLowerCase().includes(q) ||
      r.ruleId.toLowerCase().includes(q) ||
      r.ruleName?.toLowerCase().includes(q) ||
      r.ruleShortDescription.toLowerCase().includes(q) ||
      r.locations.some((l) => (l.filePath ?? '').toLowerCase().includes(q))
  );
}

export function groupByLevel(results: ParsedResult[]): Map<ResultLevel, ParsedResult[]> {
  const groups = new Map<ResultLevel, ParsedResult[]>();
  for (const level of ['error', 'warning', 'note', 'none'] as ResultLevel[]) {
    const filtered = results.filter((r) => r.level === level);
    if (filtered.length) groups.set(level, filtered);
  }
  return groups;
}

export function groupByRule(results: ParsedResult[]): Map<string, ParsedResult[]> {
  const groups = new Map<string, ParsedResult[]>();
  for (const result of results) {
    const existing = groups.get(result.ruleId) ?? [];
    existing.push(result);
    groups.set(result.ruleId, existing);
  }
  return groups;
}

export function groupByFile(results: ParsedResult[]): Map<string, ParsedResult[]> {
  const groups = new Map<string, ParsedResult[]>();
  for (const result of results) {
    const fileSet = new Set(
      result.locations.map((l) => l.filePath).filter(Boolean) as string[]
    );
    for (const filePath of fileSet) {
      const existing = groups.get(filePath) ?? [];
      existing.push(result);
      groups.set(filePath, existing);
    }
  }
  return groups;
}

export function groupBySeveritySummary(results: ParsedResult[]): {
  errors: number;
  warnings: number;
  notes: number;
  total: number;
} {
  let errors = 0;
  let warnings = 0;
  let notes = 0;
  for (const r of results) {
    if (r.level === 'error') errors++;
    else if (r.level === 'warning') warnings++;
    else if (r.level === 'note') notes++;
  }
  return { errors, warnings, notes, total: results.length };
}

export function sortResultsBySeverity(results: ParsedResult[]): ParsedResult[] {
  return [...results].sort((a, b) => {
    const diff = (RESULT_LEVEL_ORDER[a.level] ?? 3) - (RESULT_LEVEL_ORDER[b.level] ?? 3);
    if (diff !== 0) return diff;
    const aFile = a.locations[0]?.filePath ?? '';
    const bFile = b.locations[0]?.filePath ?? '';
    if (aFile < bFile) return -1;
    if (aFile > bFile) return 1;
    const aLine = a.locations[0]?.line ?? 0;
    const bLine = b.locations[0]?.line ?? 0;
    return aLine - bLine;
  });
}

export function sortResults(results: ParsedResult[], by: 'severity' | 'file' | 'rule' = 'severity'): ParsedResult[] {
  switch (by) {
    case 'severity':
      return sortResultsBySeverity(results);
    case 'file': {
      return [...results].sort((a, b) => {
        const aFile = a.locations[0]?.filePath ?? '';
        const bFile = b.locations[0]?.filePath ?? '';
        if (aFile < bFile) return -1;
        if (aFile > bFile) return 1;
        const aLine = a.locations[0]?.line ?? 0;
        const bLine = b.locations[0]?.line ?? 0;
        return aLine - bLine;
      });
    }
    case 'rule': {
      return [...results].sort((a, b) => {
        if (a.ruleId < b.ruleId) return -1;
        if (a.ruleId > b.ruleId) return 1;
        return sortResultsBySeverity([a, b])[0] === a ? -1 : 1;
      });
    }
  }
}
