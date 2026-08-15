/* ============================================================
 * NETIME · 解码工具箱（纯函数，浏览器 / Node 通用）
 * ROT13 / Base64(UTF-8) / 摩斯电码 / 字符统计 / 藏头检测
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- ROT13：英文字母平移 13 位（中文原样保留） ---------- */
  function rot13(s) {
    if (typeof s !== 'string') s = String(s);
    return s.replace(/[A-Za-z]/g, function (ch) {
      var code = ch.charCodeAt(0);
      var base = code < 97 ? 65 : 97;
      return String.fromCharCode(((code - base + 13) % 26) + base);
    });
  }

  /* ---------- Base64（UTF-8 安全，浏览器 / Node 通用） ---------- */
  function _utf8Bytes(s) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(s);
    }
    // 极简回退：不常见，但保证可用
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) { out.push(192 | (c >> 6), 128 | (c & 63)); }
      else { out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
    }
    return out;
  }

  function _bytesToBase64(bytes) {
    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += b64.charAt(b0 >> 2);
      out += b64.charAt(((b0 & 3) << 4) | (b1 >> 4));
      out += i + 1 < bytes.length ? b64.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '=';
      out += i + 2 < bytes.length ? b64.charAt(b2 & 63) : '=';
    }
    return out;
  }

  function _base64ToBytes(b64) {
    var b64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = [];
    var buf = [];
    b64 = String(b64).replace(/[^A-Za-z0-9+/=]/g, '');
    for (var i = 0; i < b64.length; i++) {
      if (b64.charAt(i) === '=') break;
      buf.push(b64map.indexOf(b64.charAt(i)));
    }
    for (var j = 0; j < buf.length; j += 4) {
      var n = (buf[j] << 18) | ((j + 1 < buf.length ? buf[j + 1] : 0) << 12) |
              ((j + 2 < buf.length ? buf[j + 2] : 0) << 6) | (j + 3 < buf.length ? buf[j + 3] : 0);
      out.push((n >> 16) & 255);
      if (j + 2 < buf.length) out.push((n >> 8) & 255);
      if (j + 3 < buf.length) out.push(n & 255);
    }
    return out;
  }

  function b64encodeUtf8(s) {
    return _bytesToBase64(_utf8Bytes(String(s)));
  }

  function b64decodeUtf8(b64) {
    var bytes = _base64ToBytes(b64);
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
    }
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return decodeURIComponent(escape(s));
  }

  /* ---------- 摩斯电码（ITU 标准） ---------- */
  var MORSE_TABLE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
    V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '-': '-....-',
    '(': '-.--.', ')': '-.--.-', ':': '---...', ';': '-.-.-.', '=': '-...-',
    '+': '.-.-.', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
  };
  var MORSE_REVERSE = {};
  Object.keys(MORSE_TABLE).forEach(function (k) { MORSE_REVERSE[MORSE_TABLE[k]] = k; });

  // 文本 → 摩斯（词之间用 / 分隔，非拉丁字符原样保留）
  function morseEncode(text) {
    var out = [];
    var tokens = String(text).toUpperCase().split(/(\s+)/);
    tokens.forEach(function (tok) {
      var t = tok.trim();
      if (!t) return;
      if (tok.indexOf(' ') >= 0) { out.push('/'); return; } // 空白 → 词分隔
      var parts = [];
      for (var i = 0; i < t.length; i++) {
        var ch = t.charAt(i);
        if (MORSE_TABLE[ch]) parts.push(MORSE_TABLE[ch]);
        else if (ch === ' ') parts.push('/');
        else parts.push(ch);
      }
      out.push(parts.join(' '));
    });
    return out.join(' / ');
  }

  // 摩斯 → 文本
  function morseDecode(code) {
    var out = '';
    var tokens = String(code).trim().split(/\s+/);
    tokens.forEach(function (tok) {
      if (tok === '/') { out += ' '; return; }
      if (MORSE_REVERSE[tok]) out += MORSE_REVERSE[tok];
      else if (/^[.-]+$/.test(tok)) out += '?'; // 未知点划组合
      else out += tok;
    });
    return out.trim();
  }

  /* ---------- 字符统计与藏头检测 ---------- */
  function charFreq(text) {
    var freq = {};
    String(text).replace(/[\s\u4e00-\u9fffA-Za-z0-9]/g, function (ch) {
      if (/\s/.test(ch)) return '';
      freq[ch] = (freq[ch] || 0) + 1;
      return '';
    });
    return Object.keys(freq).map(function (k) { return { char: k, count: freq[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  // 取每行（或每段）首字符 → 藏头
  function firstCharsOfLines(text, sep) {
    var lines = String(text).split(sep || /\n+/);
    var out = [];
    lines.forEach(function (ln) {
      var t = ln.trim();
      if (t) out.push(t.charAt(0));
    });
    return out.join('');
  }

  var Tools = {
    rot13: rot13,
    b64encodeUtf8: b64encodeUtf8,
    b64decodeUtf8: b64decodeUtf8,
    morseEncode: morseEncode,
    morseDecode: morseDecode,
    MORSE_TABLE: MORSE_TABLE,
    charFreq: charFreq,
    firstCharsOfLines: firstCharsOfLines
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tools;
  } else {
    global.NETools = Tools;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
