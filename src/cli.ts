import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import pc from 'chalk';
import type { Log as SarifLog } from '@types/sarif';
import { parseSarif } from './sarif/parser.js';
import { renderText } from './renderers/text.js';
import { htmlRender } from './renderers/html.js';

const program = new Command();

program
  .name('sarif-viewer');

// "sarif-viewer file" - display in terminal
program
  .version('0.1.0')
  .arguments('<file>')
  .description('Display SARIF results in the terminal')
  .option('-l, --level <level>', 'Filter by severity: error, warning, note, all')
  .option('-r, --rule <ruleId>', 'Filter by rule ID')
  .option('-f, --file <path>', 'Filter by file path')
  .option('-s, --search <query>', 'Search results')
  .option('--no-color', 'Disable colored output')
  .action((file: string, opts: any) => {
    try {
      const sarifPath = fs.realpathSync(path.resolve(file));
      const data = fs.readFileSync(sarifPath, 'utf-8');
      const log = JSON.parse(data) as SarifLog;
      const parsed = parseSarif(log);
      const output = renderText(parsed, {
        noColor: opts.noColor,
        sortBy: 'severity',
        level: opts.level,
        ruleId: opts.rule,
      });
      process.stdout.write(output + '\n');
    } catch (err) {
      if (err instanceof SyntaxError) {
        process.stderr.write(pc.red('Error: Invalid JSON in SARIF file\n') + '\n');
        process.exit(1);
      }
      if (typeof err === 'object' && 'code' in (err as object)) {
        const code = (err as { code: string }).code;
        if (code === 'ENOENT') {
          process.stderr.write(pc.red('Error: File not found: ') + file + '\n\n');
        }
      }
      process.stderr.write(pc.red('Error: ' + String(err)) + '\n');
      process.exit(1);
    }
  });

// "sarif-viewer html file" - convert to HTML
program
  .command('html <file>')
  .description('Convert SARIF file to interactive HTML report')
  .option('-o, --output <path>', 'Output file path (default: sarif-report.html)')
  .option('--dark', 'Use dark theme')
  .action((file: string, opts: any) => {
    try {
      const sarifPath = fs.realpathSync(path.resolve(file));
      const data = fs.readFileSync(sarifPath, 'utf-8');
      const log = JSON.parse(data) as SarifLog;
      const parsed = parseSarif(log);

      const outPath = opts.output
        ? path.resolve(opts.output)
        : path.join(process.cwd(), 'sarif-report.html');

      const html = htmlRender(parsed, {
        output: outPath,
        darkMode: opts.dark,
      });

      fs.writeFileSync(outPath, html, 'utf-8');
      process.stdout.write(pc.green('\u2713 HTML report written to: ') + pc.cyan(outPath) + '\n');
    } catch (err) {
      if (err instanceof SyntaxError) {
        process.stderr.write(pc.red('Error: Invalid JSON in SARIF file\n') + '\n');
      } else if (typeof err === 'object' && 'code' in (err as object)) {
        const code = (err as { code: string }).code;
        if (code === 'ENOENT') {
          process.stderr.write(pc.red('Error: File not found: ') + file + '\n\n');
        }
      }
      process.stderr.write(pc.red('Error: ' + String(err)) + '\n');
      process.exit(1);
    }
  });

program.parse();
