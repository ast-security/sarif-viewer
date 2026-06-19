import { describe, it, expect } from 'vitest';
import { parseSarif } from '../src/sarif/parser.js';
import { renderText } from '../src/renderers/text.js';
import { htmlRender } from '../src/renderers/html.js';
import { groupBySeveritySummary, sortResults } from '../src/sarif/utils.js';
import type { Log } from '@types/sarif';

const sampleSarif: Log = {
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'test-tool',
          version: '1.0.0',
          rules: [
            {
              id: 'TS-001',
              shortDescription: { text: 'Test rule one' },
              fullDescription: { text: 'Full description of test rule one' },
              defaultConfiguration: { level: 'error' },
            },
          ],
        },
      },
      results: [
        {
          ruleId: 'TS-001',
          level: 'error',
          message: { text: 'Error message one' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'src/file1.ts' },
                region: { startLine: 10, startColumn: 5 },
              },
            },
          ],
        },
        {
          ruleId: 'TS-001',
          level: 'warning',
          message: { text: 'Warning message two' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'src/file2.ts' },
                region: { startLine: 20, startColumn: 1 },
              },
            },
          ],
        },
        {
          ruleId: 'TS-001',
          level: 'note',
          message: { text: 'Note message three' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'src/file3.ts' },
                region: { startLine: 5, startColumn: 3 },
              },
            },
          ],
        },
        {
          ruleId: 'TS-002',
          level: 'error',
          message: { text: 'Error message four' },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: 'src/file1.ts' },
                region: { startLine: 15 },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('SARIF Parser', () => {
  it('parses SARIF file with results', () => {
    const parsed = parseSarif(sampleSarif);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.tool.name).toBe('test-tool');
    expect(parsed.tool.version).toBe('1.0.0');
    expect(parsed.results.length).toBe(4);
  });

  it('extracts rule information', () => {
    const parsed = parseSarif(sampleSarif);
    expect(parsed.results[0].ruleId).toBe('TS-001');
    expect(parsed.results[0].level).toBe('error');
    expect(parsed.results[0].message).toBe('Error message one');
  });

  it('extracts location information', () => {
    const parsed = parseSarif(sampleSarif);
    const loc = parsed.results[0].locations[0];
    expect(loc.filePath).toBe('src/file1.ts');
    expect(loc.line).toBe(10);
    expect(loc.column).toBe(5);
  });

  it('handles missing locations gracefully', () => {
    const sarif: Log = {
      version: '2.1.0',
      runs: [
        {
          tool: { driver: { name: 'test' } },
          results: [
            {
              ruleId: 'R001',
              level: 'warning',
              message: { text: 'No location' },
            },
          ],
        },
      ],
    };
    const parsed = parseSarif(sarif);
    expect(parsed.results.length).toBe(1);
    expect(parsed.results[0].locations[0].line).toBe(1);
  });
});

describe('SARIF Utils', () => {
  const parsed = parseSarif(sampleSarif);

  it('counts severity summary correctly', () => {
    const summary = groupBySeveritySummary(parsed.results);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.notes).toBe(1);
    expect(summary.total).toBe(4);
  });

  it('sorts by severity (errors first)', () => {
    const sorted = sortResults(parsed.results, 'severity');
    expect(sorted[0].level).toBe('error');
    expect(sorted[2].level).toBe('warning');
  });
});

describe('Text Renderer', () => {
  it('renders results as text', () => {
    const parsed = parseSarif(sampleSarif);
    const output = renderText(parsed);
    expect(output).toContain('test-tool');
    expect(output).toContain('Summary');
    expect(output).toContain('Errors:   2');
    expect(output).toContain('Warnings: 1');
    expect(output).toContain('Total:    4');
  });

  it('includes rule IDs in output', () => {
    const output = renderText(parseSarif(sampleSarif));
    expect(output).toContain('TS-001');
    expect(output).toContain('TS-002');
  });

  it('includes file locations in output', () => {
    const output = renderText(parseSarif(sampleSarif));
    expect(output).toContain('src/file1.ts');
    expect(output).toContain('src/file2.ts');
  });

  it('includes occurrence counts', () => {
    const sarif: Log = {
      version: '2.1.0',
      runs: [
        {
          tool: { driver: { name: 't' } },
          results: [
            {
              ruleId: 'R001',
              level: 'error',
              occurrenceCount: 5,
              message: { text: 'Repeated' },
              locations: [{ physicalLocation: { artifactLocation: { uri: 'a.ts' } } }],
            },
          ],
        },
      ],
    };
    const output = renderText(parseSarif(sarif));
    expect(output).toContain('observed 5 times');
  });
});

describe('HTML Renderer', () => {
  it('generates valid HTML', () => {
    const parsed = parseSarif(sampleSarif);
    const html = htmlRender(parsed, {});
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes data in HTML', () => {
    const parsed = parseSarif(sampleSarif);
    const html = htmlRender(parsed, {});
    expect(html).toContain('test-tool');
    expect(html).toContain('TS-001');
    expect(html).toContain('Error message one');
  });

  it('supports dark mode', () => {
    const parsed = parseSarif(sampleSarif);
    const light = htmlRender(parsed, { darkMode: false });
    const dark = htmlRender(parsed, { darkMode: true });
    expect(light).toContain('"dark":false');
    expect(dark).toContain('"dark":true');
  });

  it('includes sidebar structure', () => {
    const parsed = parseSarif(sampleSarif);
    const html = htmlRender(parsed, {});
    // sidebar should contain filter items
    expect(html).toContain('Severity');
    expect(html).toContain('By Rule');
    expect(html).toContain('By File');
  });
});
