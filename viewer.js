/**
 * JSON Formatter Hub — viewer: toolbar, tree (syntax-colored keys/values), text view, search with match count.
 */
(function (global) {
  var U = function () {
    return global.JFHUtils;
  };

  var ICON = {
    copy:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    download:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    collapse:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    expand:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    tree:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect x="6" y="8" width="6" height="5" rx="1"/><rect x="16" y="5" width="5" height="5" rx="1"/><rect x="16" y="14" width="5" height="5" rx="1"/></svg>',
    text:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="12" y2="9"/></svg>',
    search:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    external:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    chevron:
      '<svg class="jfh-chev-svg" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
  };

  function iconSpan(name, extraClass) {
    var s = el('span', 'jfh-icon' + (extraClass ? ' ' + extraClass : ''), { 'aria-hidden': 'true' });
    s.innerHTML = ICON[name] || '';
    return s;
  }

  function toolbarBtn(className, iconName, labelText, ariaLabel) {
    var b = el('button', className, { type: 'button' });
    if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
    if (iconName) b.appendChild(iconSpan(iconName));
    if (labelText) {
      var lab = el('span', 'jfh-btn-label');
      lab.textContent = labelText;
      b.appendChild(lab);
    }
    return b;
  }

  function toolbarDivider() {
    return el('span', 'jfh-toolbar-divider', { 'aria-hidden': 'true' });
  }

  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      }
    }
    return e;
  }

  function downloadText(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2500);
  }

  /** Array index keys shown as [0], [1] for clarity. */
  function appendTreeKey(row, key, parentIsArray) {
    if (key === null) return;
    if (parentIsArray && typeof key === 'number') {
      var idx = el('span', 'jfh-key jfh-key-index');
      idx.textContent = '[' + key + ']';
      row.appendChild(idx);
    } else {
      var ks = el('span', 'jfh-key jfh-tok jfh-tok-key');
      ks.textContent = JSON.stringify(key);
      row.appendChild(ks);
    }
    row.appendChild(el('span', 'jfh-colon', null));
    row.appendChild(document.createTextNode(' '));
  }

  function buildPrimitiveSpan(value) {
    var span = el('span', 'jfh-val');
    if (value === null) {
      span.className += ' jfh-tok jfh-tok-null';
      span.textContent = 'null';
      return span;
    }
    var t = typeof value;
    if (t === 'string') {
      span.className += ' jfh-tok jfh-tok-str';
      span.textContent = JSON.stringify(value);
      return span;
    }
    if (t === 'number') {
      span.className += ' jfh-tok jfh-tok-num';
      span.textContent = String(value);
      return span;
    }
    if (t === 'boolean') {
      span.className += ' jfh-tok jfh-tok-bool';
      span.textContent = value ? 'true' : 'false';
      return span;
    }
    span.textContent = String(value);
    return span;
  }

  function renderTreeValue(container, key, value, depth, parentIsArray) {
    var isObj = value !== null && typeof value === 'object';
    if (!isObj) {
      var row = el('div', 'jfh-row jfh-row-primitive');
      appendTreeKey(row, key, parentIsArray);
      row.appendChild(buildPrimitiveSpan(value));
      container.appendChild(row);
      return;
    }

    var node = el('div', 'jfh-tree-node', { 'data-expandable': '1' });
    if (depth >= 2) node.classList.add('jfh-collapsed');

    var head = el('div', 'jfh-row jfh-row-branch');
    var btn = el('button', 'jfh-chev', { type: 'button', 'aria-label': 'Toggle node' });
    btn.appendChild(iconSpan('chevron'));
    btn.addEventListener('click', function () {
      node.classList.toggle('jfh-collapsed');
    });
    head.appendChild(btn);
    appendTreeKey(head, key, parentIsArray);

    var open = el('span', 'jfh-punct');
    open.textContent = Array.isArray(value) ? '[' : '{';
    head.appendChild(open);

    var summary = el('span', 'jfh-summary');
    var cnt = Array.isArray(value) ? value.length : Object.keys(value).length;
    summary.textContent =
      ' ' + (Array.isArray(value) ? cnt + ' item' + (cnt === 1 ? '' : 's') : cnt + ' key' + (cnt === 1 ? '' : 's')) + ' ';

    var inlineClose = el('span', 'jfh-punct jfh-inline-close');
    inlineClose.textContent = Array.isArray(value) ? ']' : '}';
    head.appendChild(summary);
    head.appendChild(inlineClose);
    node.appendChild(head);

    var kids = el('div', 'jfh-children');
    var frag = document.createDocumentFragment();
    var isArr = Array.isArray(value);
    if (isArr) {
      for (var i = 0; i < value.length; i++) {
        renderTreeValue(frag, i, value[i], depth + 1, true);
      }
    } else {
      for (var pk in value) {
        if (Object.prototype.hasOwnProperty.call(value, pk)) {
          renderTreeValue(frag, pk, value[pk], depth + 1, false);
        }
      }
    }
    kids.appendChild(frag);
    node.appendChild(kids);

    var foot = el('div', 'jfh-row jfh-row-close');
    var close = el('span', 'jfh-punct');
    close.textContent = Array.isArray(value) ? ']' : '}';
    foot.appendChild(close);
    node.appendChild(foot);

    container.appendChild(node);
  }

  function setAllCollapsed(root, collapsed) {
    root.querySelectorAll('.jfh-tree-node[data-expandable="1"]').forEach(function (n) {
      if (collapsed) n.classList.add('jfh-collapsed');
      else n.classList.remove('jfh-collapsed');
    });
  }

  function buildLineGutter(lineCount) {
    var g = el('div', 'jfh-gutter');
    var lines = new Array(lineCount);
    for (var i = 0; i < lineCount; i++) lines[i] = String(i + 1);
    g.textContent = lines.join('\n');
    return g;
  }

  function clearSearchMarks(root) {
    if (!root) return;
    root.querySelectorAll('.jfh-hit').forEach(function (m) {
      var p = m.parentNode;
      if (!p) return;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      if (p.normalize) p.normalize();
    });
  }

  /**
   * Case-insensitive search; returns list of <mark> nodes (first match scrolled into view).
   */
  function applySearch(root, query) {
    clearSearchMarks(root);
    var marks = [];
    if (!query) return marks;
    var q = query.toLowerCase();
    var twFilter = {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var par = node.parentElement;
        if (!par) return NodeFilter.FILTER_REJECT;
        if (par.closest('.jfh-toolbar')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    };
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, twFilter);
    var hits = 0;
    var MAX_HITS = 5000;
    while (walker.nextNode() && hits < MAX_HITS) {
      var tn = walker.currentNode;
      var text = tn.nodeValue;
      var lower = text.toLowerCase();
      var idx = lower.indexOf(q);
      if (idx === -1) continue;
      var frag = document.createDocumentFragment();
      var pos = 0;
      while (idx !== -1 && hits < MAX_HITS) {
        if (idx > pos) frag.appendChild(document.createTextNode(text.slice(pos, idx)));
        var mark = el('mark', 'jfh-hit');
        mark.appendChild(document.createTextNode(text.slice(idx, idx + query.length)));
        frag.appendChild(mark);
        marks.push(mark);
        hits++;
        pos = idx + query.length;
        idx = lower.indexOf(q, pos);
      }
      if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
      tn.parentNode.replaceChild(frag, tn);
    }
    return marks;
  }

  function mountTreeBody(treeHost, parsed) {
    var util = U();
    var n = util.estimateTreeNodes(parsed);
    var THRESH_DEFER = 2800;
    function build() {
      renderTreeValue(treeHost, null, parsed, 0, false);
    }
    if (n > THRESH_DEFER) {
      treeHost.classList.add('jfh-tree-loading');
      var hint = el('div', 'jfh-tree-loading-msg');
      hint.textContent = 'Rendering large tree…';
      treeHost.appendChild(hint);
      var run = function () {
        hint.remove();
        treeHost.classList.remove('jfh-tree-loading');
        build();
      };
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(run, { timeout: 800 });
      } else {
        requestAnimationFrame(run);
      }
    } else {
      build();
    }
  }

  function mount(options) {
    var pretty = options.prettyText;
    var parsed = options.parsed;
    var rawText = options.rawText;
    var forceText = !!options.forceText;
    var isError = !!options.isError;
    var errorTitle = options.errorTitle || 'Error';
    var errorMessage = options.errorMessage || '';
    var errorPosition = options.errorPosition;

    var root = el('div', 'jfh-root');
    var toolbar = el('header', 'jfh-toolbar');
    var toolbarInner = el('div', 'jfh-toolbar-inner');

    var actions = el('div', 'jfh-actions');

    var btnCopy = toolbarBtn('jfh-btn jfh-btn-primary', 'copy', 'Copy JSON');
    var btnCopyLabel = btnCopy.querySelector('.jfh-btn-label');
    var btnDl = toolbarBtn('jfh-btn jfh-btn-secondary', 'download', 'Download');

    var btnCollapseAll = null;
    var btnExpandAll = null;
    if (!isError && !forceText) {
      btnCollapseAll = toolbarBtn('jfh-btn jfh-btn-secondary', 'collapse', 'Collapse all');
      btnExpandAll = toolbarBtn('jfh-btn jfh-btn-secondary', 'expand', 'Expand all');
    }

    var searchCluster = el('div', 'jfh-search-cluster');
    var searchWrap = el('div', 'jfh-search-wrap');
    searchWrap.appendChild(iconSpan('search', 'jfh-search-leading'));
    var search = el('input', 'jfh-search-input', {
      type: 'search',
      placeholder: 'Search keys and values…',
      autocomplete: 'off'
    });
    searchWrap.appendChild(search);

    var searchCount = el('span', 'jfh-search-count', { 'aria-live': 'polite' });

    searchCluster.appendChild(searchWrap);
    searchCluster.appendChild(searchCount);

    var btnView = null;
    var btnViewIcon = null;
    var btnViewLabel = null;
    if (!isError && !forceText) {
      btnView = toolbarBtn('jfh-btn jfh-btn-secondary', 'text', 'Text view');
      btnViewIcon = btnView.querySelector('.jfh-icon');
      btnViewLabel = btnView.querySelector('.jfh-btn-label');
    }

    var btnAdvanced = toolbarBtn('jfh-btn jfh-btn-secondary', 'external', 'Open Advanced Tools');

    var groupFile = el('div', 'jfh-action-group');
    groupFile.appendChild(btnCopy);
    groupFile.appendChild(btnDl);
    actions.appendChild(groupFile);
    actions.appendChild(toolbarDivider());

    if (!isError && !forceText) {
      var groupFold = el('div', 'jfh-action-group jfh-action-group-compact');
      groupFold.appendChild(btnCollapseAll);
      groupFold.appendChild(btnExpandAll);
      actions.appendChild(groupFold);
      actions.appendChild(toolbarDivider());
    }

    actions.appendChild(searchCluster);
    actions.appendChild(toolbarDivider());

    var groupEnd = el('div', 'jfh-action-group jfh-action-group-end');
    if (!isError && !forceText) groupEnd.appendChild(btnView);
    groupEnd.appendChild(btnAdvanced);
    actions.appendChild(groupEnd);

    toolbarInner.appendChild(actions);
    toolbar.appendChild(toolbarInner);
    root.appendChild(toolbar);

    var main = el('main', 'jfh-main');
    var treeHost = el('div', 'jfh-panel jfh-tree-host');
    var textHost = el('div', 'jfh-panel jfh-text-host');
    var showingTree = !isError && !forceText;

    var pre = el('pre', 'jfh-pre');
    var gutter = null;

    if (isError) {
      var errWrap = el('div', 'jfh-error-banner');
      var errTitle = el('div', 'jfh-error-title');
      errTitle.textContent = errorTitle;
      errWrap.appendChild(errTitle);
      if (errorMessage) {
        var errDetail = el('div', 'jfh-error-detail');
        errDetail.textContent = errorMessage;
        errWrap.appendChild(errDetail);
      }
      main.appendChild(errWrap);
      pre.className += ' jfh-pre-raw';
      var utilE = U();
      if (errorPosition != null) {
        pre.innerHTML = utilE.rawHtmlWithErrorPointer(rawText, errorPosition);
      } else {
        pre.textContent = rawText;
      }
      textHost.appendChild(pre);
      main.appendChild(textHost);
    } else {
      if (forceText) {
        var lineCount = pretty.split('\n').length;
        var wrap = el('div', 'jfh-text-wrap');
        gutter = buildLineGutter(lineCount);
        pre.className += ' jfh-pre-code';
        var util = U();
        if (pretty.length <= util.TOKENIZE_MAX_CHARS) {
          pre.innerHTML = util.highlightJsonHtml(pretty);
        } else {
          pre.textContent = pretty;
        }
        wrap.appendChild(gutter);
        wrap.appendChild(pre);
        textHost.appendChild(wrap);
        main.appendChild(textHost);
      } else {
        mountTreeBody(treeHost, parsed);
        main.appendChild(treeHost);
        textHost.style.display = 'none';
        main.appendChild(textHost);
        if (btnViewLabel && btnViewIcon) {
          btnViewLabel.textContent = 'Text view';
          btnViewIcon.innerHTML = ICON.text;
        }
      }
    }

    root.appendChild(main);

    var searchHitMarks = [];
    var activeHitIdx = 0;

    function updateHitHighlight() {
      searchHitMarks.forEach(function (m, i) {
        m.classList.toggle('jfh-hit-active', i === activeHitIdx);
      });
    }

    function scrollToActiveHit() {
      var m = searchHitMarks[activeHitIdx];
      if (!m) return;
      m.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      updateHitHighlight();
    }

    function setSearchUI() {
      var n = searchHitMarks.length;
      if (!search.value.trim()) {
        searchCount.textContent = '';
        return;
      }
      searchCount.textContent = n ? n + ' match' + (n === 1 ? '' : 'es') : 'No matches';
      if (n === 0) return;
      activeHitIdx = Math.min(activeHitIdx, n - 1);
      updateHitHighlight();
    }

    function runSearch() {
      var q = search.value;
      clearAllSearchMarks();
      searchHitMarks = applySearch(getSearchRoot(showingTree), q);
      activeHitIdx = 0;
      setSearchUI();
      if (searchHitMarks.length) {
        scrollToActiveHit();
      }
    }

    btnAdvanced.addEventListener('click', function () {
      var href = global.location && global.location.href ? global.location.href : '';
      var url = U().buildHubUrlFromPageHref(href);
      try {
        global.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        global.location.href = url;
      }
    });

    function getTextPre() {
      return textHost.querySelector('pre.jfh-pre');
    }

    function clearAllSearchMarks() {
      clearSearchMarks(treeHost);
      var tp = getTextPre();
      if (tp) clearSearchMarks(tp);
      if (isError) clearSearchMarks(pre);
    }

    function getSearchRoot(showingTreeFlag) {
      if (isError) return pre;
      if (forceText) return getTextPre() || textHost;
      if (showingTreeFlag) return treeHost;
      return getTextPre() || textHost;
    }

    var searchTimer = null;
    search.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 100);
    });

    btnCopy.addEventListener('click', function () {
      var txt = isError ? rawText : pretty;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(
          function () {
            btnCopy.classList.add('jfh-btn-success');
            btnCopyLabel.textContent = 'Copied';
            setTimeout(function () {
              btnCopy.classList.remove('jfh-btn-success');
              btnCopyLabel.textContent = 'Copy JSON';
            }, 1400);
          },
          function () {
            window.prompt('Copy:', txt);
          }
        );
      } else {
        window.prompt('Copy:', txt);
      }
    });

    btnDl.addEventListener('click', function () {
      downloadText('formatted.json', isError ? rawText : pretty);
    });

    if (!isError && !forceText) {
      btnCollapseAll.addEventListener('click', function () {
        setAllCollapsed(treeHost, true);
      });
      btnExpandAll.addEventListener('click', function () {
        setAllCollapsed(treeHost, false);
      });
    }

    if (!isError && !forceText) {
      btnView.addEventListener('click', function () {
        showingTree = !showingTree;
        if (showingTree) {
          treeHost.style.display = '';
          textHost.style.display = 'none';
          btnViewLabel.textContent = 'Text view';
          btnViewIcon.innerHTML = ICON.text;
          search.value = '';
          runSearch();
        } else {
          if (!textHost.firstChild) {
            var lineCount2 = pretty.split('\n').length;
            var wrap2 = el('div', 'jfh-text-wrap');
            var g2 = buildLineGutter(lineCount2);
            var pre2 = el('pre', 'jfh-pre jfh-pre-code');
            var util2 = U();
            if (pretty.length <= util2.TOKENIZE_MAX_CHARS) {
              pre2.innerHTML = util2.highlightJsonHtml(pretty);
            } else {
              pre2.textContent = pretty;
            }
            wrap2.appendChild(g2);
            wrap2.appendChild(pre2);
            textHost.appendChild(wrap2);
          }
          treeHost.style.display = 'none';
          textHost.style.display = '';
          btnViewLabel.textContent = 'Tree view';
          btnViewIcon.innerHTML = ICON.tree;
          search.value = '';
          runSearch();
        }
      });
    }

    return {
      element: root,
      destroy: function () {
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  global.JFHViewer = { mount: mount };
})(window);
