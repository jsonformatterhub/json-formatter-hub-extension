/**
 * JSON Formatter Hub — utils: detection, parse (with error position), format, highlight, hub URL.
 */
(function (global) {
  var TREE_MAX_CHARS = 350000;
  var TOKENIZE_MAX_CHARS = 1200000;
  var ABS_MAX_CHARS = 6 * 1024 * 1024;

  function extractPageText(doc) {
    var body = doc.body;
    if (!body) return '';
    var pre = body.querySelector('pre');
    if (pre) return pre.textContent || '';
    return body.textContent || '';
  }

  function estimateTreeNodes(value) {
    var n = 0;
    var stack = [value];
    var MAX_SAMPLE = 25000;
    while (stack.length) {
      var v = stack.pop();
      n++;
      if (n > MAX_SAMPLE) return n;
      if (!v || typeof v !== 'object') continue;
      if (Array.isArray(v)) {
        for (var i = 0; i < v.length; i++) stack.push(v[i]);
      } else {
        for (var k in v) {
          if (Object.prototype.hasOwnProperty.call(v, k)) stack.push(v[k]);
        }
      }
    }
    return n;
  }

  function isLikelyJsonDocument(doc) {
    var proto = doc.location && doc.location.protocol;
    if (proto !== 'http:' && proto !== 'https:') return false;

    var body = doc.body;
    if (!body) return false;

    var text = extractPageText(doc).trim();
    if (!text.length) return false;

    var first = text.charCodeAt(0);
    var last = text.charCodeAt(text.length - 1);
    if (!((first === 0x7b || first === 0x5b) && (last === 0x7d || last === 0x5d))) return false;
    if (/^\s*</.test(text)) return false;

    if (body.querySelectorAll('*').length > 8) return false;
    if (doc.querySelectorAll('script[src]').length > 2) return false;

    return true;
  }

  /** Parse JSON; on failure extract 0-based index from engine message when possible. */
  function parseJsonDetailed(text) {
    try {
      return { ok: true, value: JSON.parse(text), message: '', position: null };
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      var pos = extractErrorIndexFromMessage(msg);
      if (pos == null) pos = guessJsonErrorIndex(text);
      return { ok: false, value: null, message: msg, position: pos };
    }
  }

  function extractErrorIndexFromMessage(msg) {
    var patterns = [/position (\d+)/i, /at (\d+) \(/, /column (\d+)/i, /line \d+ column (\d+)/i];
    for (var i = 0; i < patterns.length; i++) {
      var m = msg.match(patterns[i]);
      if (m) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  /** Heuristic fallback when the engine does not report a byte offset (may return null). */
  function guessJsonErrorIndex(text) {
    var i = 0;
    var depth = 0;
    var inStr = false;
    var esc = false;
    var strQuote = '';
    for (; i < text.length; i++) {
      var c = text.charAt(i);
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === strQuote) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = true;
        strQuote = c;
        continue;
      }
      if (c === '{' || c === '[') depth++;
      if (c === '}' || c === ']') {
        depth--;
        if (depth < 0) return i;
      }
    }
    if (inStr || depth !== 0) return Math.max(0, text.length - 1);
    return null;
  }

  function stringifyPretty(value) {
    return JSON.stringify(value, null, 2);
  }

  function buildHubUrlFromPageHref(pageHref) {
    return 'https://jsonformatterhub.com?url=' + encodeURIComponent(pageHref || '');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Wrap raw JSON with a highlighted error character (if index in range). */
  function rawHtmlWithErrorPointer(raw, index) {
    if (index == null || index < 0 || index >= raw.length) {
      return '<span class="jfh-raw-json">' + escapeHtml(raw) + '</span>';
    }
    var a = escapeHtml(raw.slice(0, index));
    var mid = escapeHtml(raw.charAt(index));
    var b = escapeHtml(raw.slice(index + 1));
    return (
      '<span class="jfh-raw-json">' +
      a +
      '<span class="jfh-error-char" title="Near parse error">' +
      mid +
      '</span>' +
      b +
      '</span>'
    );
  }

  function isWordBoundary(ch) {
    return !ch || !/[A-Za-z0-9_]/.test(ch);
  }

  function tokenizeNonStringJsonFragment(text) {
    if (!text) return '';
    var out = '';
    var i = 0;
    var n = text.length;
    while (i < n) {
      if (text.slice(i, i + 4) === 'true' && isWordBoundary(text.charAt(i + 4))) {
        out += '<span class="jfh-tok jfh-tok-bool">true</span>';
        i += 4;
        continue;
      }
      if (text.slice(i, i + 5) === 'false' && isWordBoundary(text.charAt(i + 5))) {
        out += '<span class="jfh-tok jfh-tok-bool">false</span>';
        i += 5;
        continue;
      }
      if (text.slice(i, i + 4) === 'null' && isWordBoundary(text.charAt(i + 4))) {
        out += '<span class="jfh-tok jfh-tok-null">null</span>';
        i += 4;
        continue;
      }
      if (/[-0-9]/.test(text.charAt(i))) {
        var j = i;
        if (text.charAt(j) === '-') j++;
        if (j >= n || !/[0-9]/.test(text.charAt(j))) {
          out += escapeHtml(text.charAt(i));
          i++;
          continue;
        }
        while (j < n && /[0-9]/.test(text.charAt(j))) j++;
        if (text.charAt(j) === '.') {
          j++;
          while (j < n && /[0-9]/.test(text.charAt(j))) j++;
        }
        if (text.charAt(j) === 'e' || text.charAt(j) === 'E') {
          j++;
          if (text.charAt(j) === '+' || text.charAt(j) === '-') j++;
          while (j < n && /[0-9]/.test(text.charAt(j))) j++;
        }
        var num = text.slice(i, j);
        if (/^-?\d/.test(num)) {
          out += '<span class="jfh-tok jfh-tok-num">' + escapeHtml(num) + '</span>';
          i = j;
          continue;
        }
      }
      out += escapeHtml(text.charAt(i));
      i++;
    }
    return out;
  }

  function highlightJsonLine(line) {
    var i = 0;
    var n = line.length;
    var out = '';
    while (i < n) {
      var cq = line.indexOf('"', i);
      if (cq === -1) {
        out += tokenizeNonStringJsonFragment(line.slice(i));
        break;
      }
      out += tokenizeNonStringJsonFragment(line.slice(i, cq));
      var end = cq + 1;
      var esc = false;
      while (end < n) {
        var c = line.charAt(end);
        if (esc) {
          esc = false;
          end++;
          continue;
        }
        if (c === '\\') {
          esc = true;
          end++;
          continue;
        }
        if (c === '"') {
          end++;
          break;
        }
        end++;
      }
      var str = line.slice(cq, end);
      var rest = line.slice(end);
      var isKey = /^\s*:/.test(rest);
      if (isKey) {
        out += '<span class="jfh-tok jfh-tok-key">' + escapeHtml(str) + '</span>';
      } else {
        out += '<span class="jfh-tok jfh-tok-str">' + escapeHtml(str) + '</span>';
      }
      i = end;
    }
    return out;
  }

  function highlightJsonHtml(pretty) {
    var lines = pretty.split('\n');
    var buf = [];
    for (var li = 0; li < lines.length; li++) {
      buf.push(highlightJsonLine(lines[li]));
      if (li < lines.length - 1) buf.push('\n');
    }
    return buf.join('');
  }

  global.JFHUtils = {
    TREE_MAX_CHARS: TREE_MAX_CHARS,
    TOKENIZE_MAX_CHARS: TOKENIZE_MAX_CHARS,
    ABS_MAX_CHARS: ABS_MAX_CHARS,
    extractPageText: extractPageText,
    isLikelyJsonDocument: isLikelyJsonDocument,
    parseJson: function (t) {
      var r = parseJsonDetailed(t);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: null, message: r.message };
    },
    parseJsonDetailed: parseJsonDetailed,
    stringifyPretty: stringifyPretty,
    buildHubUrlFromPageHref: buildHubUrlFromPageHref,
    escapeHtml: escapeHtml,
    highlightJsonHtml: highlightJsonHtml,
    rawHtmlWithErrorPointer: rawHtmlWithErrorPointer,
    estimateTreeNodes: estimateTreeNodes
  };
})(typeof window !== 'undefined' ? window : self);
