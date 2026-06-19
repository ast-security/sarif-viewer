import type { HtmlOptions } from './types.js';
import type { ParsedLog } from '../sarif/types.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { groupBySeveritySummary, groupByFile, groupByRule } from '../sarif/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function esc(s: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '');
}

export function htmlRender(parsedLog: ParsedLog, opts: HtmlOptions): string {
  const dark = !!opts.darkMode;
  const summary = groupBySeveritySummary(parsedLog.results);

  const c = {
    bg: dark ? '#0d1117' : '#fff',
    sb: dark ? '#161b22' : '#f6f8fa',
    nav: dark ? '#010409' : '#fff',
    txt: dark ? '#c9d1d9' : '#1f2328',
    dm: dark ? '#8b949e' : '#656d76',
    lnk: dark ? '#58a6ff' : '#0969da',
    brd: dark ? '#30363d' : '#d0d7de',
    alt: dark ? '#161b22' : '#f6f8fa',
    crt: dark ? '#f85149' : '#d73a49',
    wng: dark ? '#d29922' : '#d29922',
    inf: dark ? '#58a6ff' : '#0969da',
    tbg: dark ? '#1f6feb' : '#ddf4ff',
    tfg: dark ? '#58a6ff' : '#0969da',
    snp: dark ? '#161b22' : '#f6f8fa',
    mkd: dark ? '#21262d' : '#e8e8e8',
  };

  // Sidebar HTML
  let sb = '';

  // Severity group
  const lc = { error: 0, warning: 0, note: 0 };
  parsedLog.results.forEach(r => {
    if (r.level === 'error') lc.error++;
    else if (r.level === 'warning') lc.warning++;
    else if (r.level === 'note') lc.note++;
  });

  sb += '\n  <!-- By Severity -->\n';
  sb += '\n  <div class="ssection">\n';
  sb += '\n    <div class="shdr" data-target="bySeverity">';
  sb += 'By Severity<span>&#9662;</span>';
  sb += '</div>\n';
  sb += '\n    <div class="sct" id="bySeverity">\n';
  if (lc.error > 0) {
    sb += '\n      <div class="sitem" data-filter-level="error">';
    sb += '<span class="sbadge"><span class="dot crt"></span>Error</span>';
    sb += '<span class="cnt">' + lc.error + '</span></div>';
  }
  if (lc.warning > 0) {
    sb += '\n      <div class="sitem" data-filter-level="warning">';
    sb += '<span class="sbadge"><span class="dot wng"></span>Warning</span>';
    sb += '<span class="cnt">' + lc.warning + '</span></div>';
  }
  if (lc.note > 0) {
    sb += '\n      <div class="sitem" data-filter-level="note">';
    sb += '<span class="sbadge"><span class="dot inf"></span>Note</span>';
    sb += '<span class="cnt">' + lc.note + '</span></div>';
  }
  sb += '\n    </div>\n';
  sb += '\n  </div>\n';

  // Rule group
  const gr = groupByRule(parsedLog.results);
  const rl = Array.from(gr.entries()).sort((a, b) => b[1].length - a[1].length);

  sb += '\n  <!-- By Rule -->\n';
  sb += '\n  <div class="ssection">\n';
  sb += '\n    <div class="shdr" data-target="byRule">';
  sb += 'By Rule<span>&#9662;</span>';
  sb += '</div>\n';
  sb += '\n    <div class="sct" id="byRule">\n';
  for (const [id, items] of rl) {
    sb += '\n      <div class="sitem" data-filter-rule="' + esc(id) + '">';
    sb += '<span class="sbadge">&#9670;' + esc(id) + '</span>';
    sb += '<span class="cnt">' + items.length + '</span></div>';
  }
  sb += '\n    </div>\n';
  sb += '\n  </div>\n';

  // File group
  const gf = groupByFile(parsedLog.results);
  const fl = Array.from(gf.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  sb += '\n  <!-- By File -->\n';
  sb += '\n  <div class="ssection">\n';
  sb += '\n    <div class="shdr" data-target="byFile">';
  sb += 'By File<span>&#9662;</span>';
  sb += '</div>\n';
  sb += '\n    <div class="sct" id="byFile">\n';
  for (const [fp, items] of fl) {
    const short = fp.includes('/') ? fp.split('/').slice(-3).join('/') : fp;
    sb += '\n      <div class="sitem" data-filter-file="' + esc(fp) + '">';
    sb += '<span class="sbadge">&#128196;' + esc(short) + '</span>';
    sb += '<span class="cnt">' + items.length + '</span></div>';
  }
  sb += '\n    </div>\n';
  sb += '\n  </div>\n';

  // Read JS file
  let jsPath = join(__dirname, 'render.js');
  let jsCode = '';
  try {
    jsCode = readFileSync(jsPath, 'utf8');
  } catch {
    jsCode = '';
  }

  // Build result cards HTML (for embed, actual rendering done by JS)
  // Actually we build cards via JS from the embedded data

  // Build results data as JSON
  const rd = parsedLog.results.map((r, i) => ({
    index: i,
    ruleId: r.ruleId,
    level: r.level,
    message: r.message,
    locations: r.locations.filter(l => l.filePath).map(l => ({
      filePath: l.filePath,
      line: l.line || 1,
      column: l.column || 0,
    })),
    ruleShort: r.ruleShortDescription || '',
    markdown: r.markdown || '',
    fullDesc: r.ruleFullDescription || '',
    snippet: r.contextSnippet ? { text: r.contextSnippet.text || '' } : null,
    fix: r.fix ? { desc: r.fix.description, changes: r.fix.artifactChanges.map(a => a.filePath) } : null,
    kind: r.kind || '',
    count: r.occurenceCount || 1,
  }));
  const rj = JSON.stringify(rd);

  const cj = JSON.stringify({
    tool: parsedLog.tool.name,
    ver: parsedLog.tool.version || '',
    errors: summary.errors,
    warnings: summary.warnings,
    notes: summary.notes,
    total: summary.total,
    dark: dark,
  });

  // Build full HTML
  let h = '';

  h += '<!DOCTYPE html><html lang="en"><head>\n';
  h += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">\n';
  h += '<title>SARIF Report - ' + esc(parsedLog.tool.name) + '</title>\n';

  // CSS
  h += '<style>\n';
  h += '*{box-sizing:border-box;margin:0;padding:0}\n';
  h += 'html,body{height:100%;overflow:hidden}\n';
  h += 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:' + c.bg + ';color:' + c.txt + ';line-height:1.6;display:flex;flex-direction:column}\n';

  // Navbar
  h += '.navbar{height:52px;background:' + c.nav + ';color:#fff;display:flex;align-items:center;padding:0 20px;gap:16px;flex-shrink:0;overflow:hidden}\n';
  h += '.navbar h1{font-size:15px;font-weight:600;white-space:nowrap}\n';
  h += '.navbar .ver{font-size:12px;opacity:.7}\n';
  h += '.navbar .srch{position:relative;width:260px}\n';
  h += '.navbar .srch input{width:100%;padding:5px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:13px;outline:none}\n';
  h += '.navbar .srch input::placeholder{color:rgba(255,255,255,.5)}\n';
  h += '.navbar .stats{margin-left:auto;display:flex;gap:14px;font-size:13px}\n';
  h += '.navbar .stats span{display:flex;align-items:center;gap:4px}\n';
  h += '.navbar .stats .dt{width:8px;height:8px;border-radius:50%;display:inline-block}\n';
  h += '.navbar .stats .dt.crt{background:' + c.crt + '}\n';
  h += '.navbar .stats .dt.wng{background:' + c.wng + '}\n';
  h += '.navbar .stats .dt.inf{background:' + c.inf + '}\n';
  h += '.navbar .thb{cursor:pointer;background:rgba(255,255,255,.1);border:none;color:#fff;padding:4px 10px;border-radius:4px;font-size:12px}\n';

  // Layout
  h += '.layout{display:flex;flex:1;overflow:hidden}\n';
  h += '.sidebar{width:280px;background:' + c.sb + ';border-right:1px solid ' + c.brd + ';overflow-y:auto;flex-shrink:0}\n';
  h += '.ssection{border-bottom:1px solid ' + c.mkd + '}\n';
  h += '.shdr{padding:10px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:' + c.dm + ';cursor:pointer;display:flex;justify-content:space-between;align-items:center}\n';
  h += '.shdr:hover{background:' + c.alt + '}\n';
  h += '.sct{display:none}\n';
  h += '.sct.exp{display:block}\n';
  h += '.sitem{padding:6px 16px;font-size:13px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background .15s}\n';
  h += '.sitem:hover{background:' + c.alt + '}\n';
  h += '.sbadge{display:flex;align-items:center;gap:6px}\n';
  h += '.sbadge .dt.crt{background:' + c.crt + '}\n';
  h += '.sbadge .dt.wng{background:' + c.wng + '}\n';
  h += '.sbadge .dt.inf{background:' + c.inf + '}\n';
  h += '.sitem .cnt{background:' + c.tbg + ';color:' + c.tfg + ';padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600}\n';

  // Main
  h += '.main{flex:1;overflow-y:auto;padding:20px 24px}\n';
  h += '.rhead{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid ' + c.brd + '}\n';
  h += '.rhead h2{font-size:20px;font-weight:600}\n';
  h += '.rhead .cnt{background:' + c.tbg + ';color:' + c.tfg + ';padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600}\n';
  h += '.racts{display:flex;gap:8px;margin-left:auto}\n';
  h += '.racts button{padding:4px 12px;border-radius:6px;border:1px solid ' + c.brd + ';background:#000;color:' + c.txt + ';font-size:12px;cursor:pointer}\n';
  h += '.racts button:hover{background:' + c.alt + '}\n';
  h += '.racts button.act{background:' + c.tbg + ';border-color:' + c.lnk + ';color:' + c.lnk + '}\n';

  // Cards
  h += '.rcard{background:' + c.bg + ';border:1px solid ' + c.brd + ';border-radius:8px;margin-bottom:12px;overflow:hidden}\n';
  h += '.rcard.lvl-crt{border-left:4px solid ' + c.crt + '}\n';
  h += '.rcard.lvl-wng{border-left:4px solid ' + c.wng + '}\n';
  h += '.rcard.lvl-inf{border-left:4px solid ' + c.inf + '}\n';
  h += '.rcard.lvl-att{border-left:4px solid ' + c.dm + '}\n';

  h += '.rhdr{padding:12px 16px;cursor:pointer;display:flex;gap:12px;align-items:flex-start}\n';
  h += '.rhdr:hover{background:' + c.alt + '}\n';
  h += '.rhdr .lic{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;margin-top:2px}\n';
  h += '.rcard.lvl-crt .lic{background:' + c.crt + '}\n';
  h += '.rcard.lvl-wng .lic{background:' + c.wng + '}\n';
  h += '.rcard.lvl-inf .lic{background:' + c.inf + '}\n';
  h += '.rcard.lvl-att .lic{background:' + c.dm + '}\n';
  h += '.rhdr .cnt{font-size:11px;color:' + c.dm + ';background:' + c.tbg + ';padding:2px 8px;border-radius:8px;margin-left:6px}\n';

  h += '.rhdr .ctt{flex:1;min-width:0}\n';
  h += '.rhdr .rid{font-weight:600;font-size:14px;color:' + c.lnk + '}\n';
  h += '.rhdr .msg{font-size:14px;color:' + c.txt + ';margin-top:2px;display:block;word-break:break-word}\n';
  h += '.rhdr .loc{font-size:12px;color:' + c.dm + ';margin-top:4px;display:block}\n';
  h += '.rhdr .tog{font-size:12px;color:' + c.dm + ';transition:transform .2s;flex-shrink:0;margin-top:4px}\n';
  h += '.rhdr.exp .tog{transform:rotate(180deg)}\n';

  // Details
  h += '.rdtl{display:block;max-height:0;overflow:hidden;transition:max-height .3s ease-out}\n';
  h += '.rdtl.exp{max-height:2000px}\n';
  h += '.rdbody{border-top:1px solid ' + c.mkd + ';padding:16px}\n';
  h += '.rdbody .sec{margin-bottom:16px}\n';
  h += '.rdbody .sec:last-child{margin-bottom:0}\n';
  h += '.rdbody h4{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:' + c.dm + ';margin-bottom:6px}\n';
  h += '.rdbody p{font-size:13px;color:' + c.txt + ';line-height:1.6;word-break:break-word}\n';
  h += '.rdbody .loc{font-family:\'SFMono-Regular\',Consolas,monospace;font-size:13px;color:' + c.lnk + '}\n';
  h += '.rdbody .snp{background:' + c.snp + ';padding:10px;border-radius:6px;font-family:\'SFMono-Regular\',Consolas,monospace;font-size:12px;white-space:pre-wrap;overflow-x:auto}\n';
  h += '.rdbody .fix{display:inline-flex;align-items:center;gap:4px;background:#3fb95033;color:#3fb950;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500}\n';
  h += '.rdbody .rub{background:' + c.tbg + ';color:' + c.tfg + ';padding:4px 10px;border-radius:6px;display:inline-block;font-size:12px;margin-top:4px}\n';
  h += '\n</style></head><body>';

  // Navbar
  h += '\n<nav class="navbar">\n';
  h += '<h1 id="tn"></h1>\n';
  h += '<span class="ver" id="tv"></span>\n';
  h += '<div class="srch"><input type="text" id="src" placeholder="Search results..."></div>\n';
  h += '<div class="stats">\n';
  h += '<span><span class="dt crt"></span> Errors: <span id="se"></span></span>\n';
  h += '<span><span class="dt wng"></span> Warnings: <span id="sw"></span></span>\n';
  h += '<span><span class="dt inf"></span> Notes: <span id="sn"></span></span>\n';
  h += '</div>\n';
  h += '<button class="thb" id="tb">Toggle</button>\n';
  h += '</nav>';

  // Layout
  h += '\n<div class="layout">\n';
  h += '<aside class="sidebar">' + sb + '</aside>';

  // Main
  h += '\n<main class="main">\n';
  h += '<div class="rhead">\n';
  h += '<h2>All Results</h2>\n';
  h += '<span class="cnt" id="tc"></span>\n';
  h += '<div class="racts">\n';
  h += '<button id="bs" class="act" onclick="doSort(\'severity\')">Severity</button>\n';
  h += '<button id="bf" onclick="doSort(\'file\')">File</button>\n';
  h += '<button id="br" onclick="doSort(\'rule\')">Rule</button>\n';
  h += '</div></div>\n';
  h += '<div id="res"></div>\n';
  h += '</main></div>';

  // Script
  h += '\n<script>var rf=' + rj + ';\n';
  h += 'var cf=' + cj + ';\n';
  h += '</script>\n';

  if (jsCode) {
    h += '<script>' + jsCode + '</script>\n';
  }

  h += '</body></html>';

  return h;
}
