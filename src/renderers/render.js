(function() {
  'use strict';
  if (typeof rf === 'undefined' || typeof cf === 'undefined') {
    console.error('Missing rf or cf - ensure data is set before rendering');
    return;
  }

  var RESULTS = rf;
  var CONFIG = cf;
  var currentSort = 'severity';
  var currentFilter = null;
  var searchTerm = '';
  var _cache = {};
  var _dom = null;

  function esc(s) {
    if (!s) return '';
    var t = String(s);
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function eAttr(s) {
    if (!s) return '';
    var t = String(s);
    return t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function lvlType(l) {
    if (l === 'error') return 'critical';
    if (l === 'warning') return 'warning';
    if (l === 'note') return 'info';
    return 'attention';
  }

  var lvlIcon = { critical: '!', warning: '!', info: 'i', attention: ' ' };
  var lvlLabel = { error: 'error', warning: 'warning', note: 'note', none: 'none' };

  function applyFilts() {
    if (!_dom) return;
    var r = RESULTS.slice();
    if (currentFilter) {
      if (currentFilter.t === 'level') {
        r = r.filter(function(x) { return x.level === currentFilter.v; });
      } else if (currentFilter.t === 'rule') {
        r = r.filter(function(x) { return x.ruleId === currentFilter.v; });
      } else if (currentFilter.t === 'file') {
        r = r.filter(function(x) {
          return x.locations.some(function(y) { return y.filePath === currentFilter.v; });
        });
      }
    }
    if (searchTerm) {
      var q = searchTerm.toLowerCase();
      r = r.filter(function(x) {
        if (x.message.toLowerCase().indexOf(q) !== -1) return true;
        if (x.ruleId.toLowerCase().indexOf(q) !== -1) return true;
        return x.locations.some(function(y) {
          return (y.filePath || '').toLowerCase().indexOf(q) !== -1;
        });
      });
    }
    renderResults(r);
  }

  function buildCard(r) {
    if (_cache[r.index]) return _cache[r.index];

    // Location strings
    var locStrs = [];
    for (var i = 0; i < r.locations.length; i++) {
      var loc = r.locations[i];
      if (loc.filePath) {
        var p = esc(loc.filePath);
        if (loc.line) p += ':' + loc.line;
        if (loc.column) p += ':' + loc.column;
        locStrs.push('<span class="loc">' + p + '</span>');
      }
    }
    var locHtml = locStrs.join('<br>') || '';

    _cache[r.index] = {
      ridx: r.index,
      level: r.level,
      ruleId: esc(r.ruleId),
      message: esc(r.message),
      countHtml: r.count > 1 ? '<span class="cnt">&#215;' + r.count + '</span>' : '',
      levelType: lvlType(r.level),
      icon: lvlIcon[lvlType(r.level)] || 'i',
      locHtml: locHtml,
      // Details
      descHtml: buildDescHtml(r),
      locSecHtml: locHtml ? '<div class="sec"><h4>Location</h4>' + locHtml + '</div>' : '',
      snippetHtml: buildSnippetHtml(r),
      fixHtml: buildFixHtml(r),
      kindHtml: r.kind ? '<div class="sec"><h4>Kind</h4><span class="rub">' + esc(r.kind.toUpperCase()) + '</span></div>' : '',
    };
    return _cache[r.index];
  }

  function buildDescHtml(r) {
    var d = r.markdown || r.fullDesc || r.ruleShort;
    if (!d) return '';
    var lines = d.split('\n').filter(function(x) { return x.trim(); });
    if (lines.length === 0) return '';
    var l = lines[0].substring(0, 250);
    return '<div class="sec"><h4>Description</h4><p>' + esc(l) + '</p></div>';
  }

  function buildSnippetHtml(r) {
    if (!r.snippet || !r.snippet.text) return '';
    var firstLine = r.snippet.text.split('\n')[0];
    if (!firstLine) return '';
    return '<div class="sec"><h4>Snippet</h4><div class="snp">' + esc(firstLine) + '</div></div>';
  }

  function buildFixHtml(r) {
    if (!r.fix || !r.fix.desc) return '';
    var h = '<div class="sec"><h4>Fix</h4><span class="fix">&#9745; ' + esc(r.fix.desc) + '</span>';
    if (r.fix.changes && r.fix.changes.length > 0) {
      h += '<br>Draft a new fix file at:';
      for (var i = 0; i < r.fix.changes.length; i++) {
        h += '<br>&#8226; ' + esc(r.fix.changes[i]);
      }
    }
    h += '</div>';
    return h;
  }

  function renderResults(arr) {
    if (!arr || arr.length === 0 || !arr || arr.length === 0) {
      document.getElementById('res').innerHTML = '<p style="text-align:center;color:var(--dim);padding:40px;">No results match your filters.</p>';
      _cache = {};
      return;
    }
    _cache = {};
    var html = '';
    for (var i = 0; i < arr.length; i++) {
      var c = buildCard(arr[i]);
      html += buildCardHtml(c);
    }
    document.getElementById('res').innerHTML = html;
  }

  function buildCardHtml(c) {
    var html = '<div class="rcard lvl-' + c.levelType + '" data-idx="' + c.ridx + '">\n';
    html += '  <div class="rhdr" onclick="toggleDet(' + c.ridx + ')">\n';
    html += '    <div class="lic">' + c.icon + '</div>\n';
    html += '    <div class="ctt">\n';
    html += '      <span class="rid">' + c.ruleId + '</span>' + c.countHtml + '\n';
    html += '      <span class="msg">' + c.message + '</span>\n';
    html += '      ' + c.locHtml + '\n';
    html += '    </div>\n';
    html += '    <span class="tog">&#9662;</span>\n';
    html += '  </div>\n';
    html += '  <div class="rdtl" id="det-' + c.ridx + '">\n';
    html += '    <div class="rdbody">\n';
    html += c.descHtml;
    html += c.locSecHtml;
    html += c.snippetHtml;
    html += c.fixHtml;
    html += c.kindHtml;
    html += '    </div>\n';
    html += '  </div>\n';
    html += '</div>';
    return html;
  }

  // Global toggle function
  window.toggleDet = function(idx) {
    var el = document.getElementById('det-' + idx);
    if (!el) return;
    el.classList.toggle('exp');
    var prev = el.previousElementSibling;
    if (prev) prev.classList.toggle('exp');
  };

  // Global sort function
  window.doSort = function(by) {
    currentSort = by;
    var btns = document.querySelectorAll('.racts button');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('act');
    var id = 'b' + by.charAt(0).toUpperCase() + by.slice(1);
    var btn = document.getElementById(id);
    if (btn) btn.classList.add('act');
  };

  // Sidebar filters
  document.addEventListener('click', function(e) {
    var item = e.target.closest('[data-filter-level]');
    if (item) { currentFilter = { t: 'level', v: item.dataset.filterLevel }; applyFilts(); return; }
    var ri = e.target.closest('[data-filter-rule]');
    if (ri) { currentFilter = { t: 'rule', v: ri.dataset.filterRule }; applyFilts(); return; }
    var fi = e.target.closest('[data-filter-file]');
    if (fi) { currentFilter = { t: 'file', v: fi.dataset.filterFile }; applyFilts(); return; }
    var sh = e.target.closest('.shdr');
    if (sh) {
      var tgt = document.getElementById(sh.dataset.target);
      if (tgt) tgt.classList.toggle('exp');
      return;
    }
  });

  // Search
  var srchEl = document.getElementById('src');
  if (srchEl) {
    srchEl.addEventListener('input', function(ev) {
      searchTerm = ev.target.value;
      applyFilts();
    });
  }

  // Theme toggle
  var themeBtn = document.getElementById('tb');
  if (themeBtn) {
    themeBtn.addEventListener('click', function() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    });
  }

  // Set stats
  function setId(elId, val) {
    var el = document.getElementById(elId);
    if (el) el.textContent = val;
  }

  setId('tn', CONFIG.tool || '');
  setId('tv', 'v' + (CONFIG.ver || ''));
  setId('se', String(CONFIG.errors || 0));
  setId('sw', String(CONFIG.warnings || 0));
  setId('sn', String(CONFIG.notes || 0));
  setId('tc', String(CONFIG.total || 0) + ' results');

  // Initial layout
  var bs = document.getElementById('bySeverity');
  if (bs) bs.classList.add('exp');

  // Apply filters and render
  applyFilts();
})();
