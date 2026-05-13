/**
 * JSON Formatter Hub — content script: gate on HTTPS/HTTP bare JSON pages, then mount viewer.
 */
(function () {
  var proto = location.protocol;
  if (proto !== 'http:' && proto !== 'https:') return;

  var U = window.JFHUtils;
  var V = window.JFHViewer;
  if (!U || !V) return;

  if (document.documentElement.dataset.jfhInjected === '1') return;
  if (!U.isLikelyJsonDocument(document)) return;

  var raw = U.extractPageText(document);
  if (!raw) return;

  var trimmed = raw.trim().replace(/^\uFEFF/, '');
  if (!(trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[')) return;

  function applyShell() {
    document.documentElement.setAttribute('data-jfh-root', '1');
    while (document.head && document.head.firstChild) {
      document.head.removeChild(document.head.firstChild);
    }
    var metaCharset = document.createElement('meta');
    metaCharset.setAttribute('charset', 'utf-8');
    var metaVp = document.createElement('meta');
    metaVp.setAttribute('name', 'viewport');
    metaVp.setAttribute('content', 'width=device-width, initial-scale=1');
    document.head.appendChild(metaCharset);
    document.head.appendChild(metaVp);
    document.title = 'JSON';
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    var load = document.createElement('div');
    load.className = 'jfh-loading';
    load.textContent = 'Parsing JSON…';
    document.body.appendChild(load);
  }

  function mountViewer(opts) {
    document.body.innerHTML = '';
    document.body.appendChild(V.mount(opts).element);
  }

  function scheduleHeavy(fn) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 0);
    }
  }

  function run() {
    try {
      if (raw.length > U.ABS_MAX_CHARS) {
        mountViewer({
          prettyText: raw,
          parsed: null,
          rawText: raw,
          forceText: true,
          isError: true,
          errorTitle: 'Response too large',
          errorMessage:
            'This document exceeds the extension limit (~6MB). Raw text is shown; use Download or Open Advanced Tools.',
          errorPosition: null
        });
        return;
      }

      var parsedRes = U.parseJsonDetailed(trimmed);
      var pretty = parsedRes.ok ? U.stringifyPretty(parsedRes.value) : trimmed;

      var forceText = !parsedRes.ok || pretty.length > U.TREE_MAX_CHARS;
      if (parsedRes.ok) {
        forceText = forceText || U.estimateTreeNodes(parsedRes.value) > 22000;
      }

      mountViewer({
        prettyText: pretty,
        parsed: parsedRes.ok ? parsedRes.value : null,
        rawText: raw,
        forceText: forceText,
        isError: !parsedRes.ok,
        errorTitle: 'Invalid JSON',
        errorMessage: parsedRes.ok ? '' : parsedRes.message,
        errorPosition: parsedRes.ok ? null : parsedRes.position
      });
    } catch (e) {
      mountViewer({
        prettyText: raw,
        parsed: null,
        rawText: raw,
        forceText: true,
        isError: true,
        errorTitle: 'Unexpected error',
        errorMessage: e && e.message ? e.message : String(e),
        errorPosition: null
      });
    }
  }

  try {
    document.documentElement.dataset.jfhInjected = '1';
    applyShell();
    if (raw.length > 220000) scheduleHeavy(run);
    else run();
  } catch (e) {
    try {
      document.documentElement.removeAttribute('data-jfh-injected');
    } catch (e2) {}
  }
})();
