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
    // 极简回退（TextEncoder 不可用时）：按码点编码，正确处理代理对（表情等）
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var low = s.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00); i++; }
      }
      if (c < 128) out.push(c);
      else if (c < 2048) { out.push(192 | (c >> 6), 128 | (c & 63)); }
      else if (c < 65536) { out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
      else { out.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
    }
    return out;
  }

  var B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // 字符码 -> 6bit 值 的查表（-1 表示非法），避免逐字符 indexOf
  var B64_LOOKUP = (function () {
    var t = new Int16Array(128);
    for (var i = 0; i < t.length; i++) t[i] = -1;
    for (var j = 0; j < B64_ALPHABET.length; j++) t[B64_ALPHABET.charCodeAt(j)] = j;
    return t;
  })();

  function _bytesToBase64(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += B64_ALPHABET.charAt(b0 >> 2);
      out += B64_ALPHABET.charAt(((b0 & 3) << 4) | (b1 >> 4));
      out += i + 1 < bytes.length ? B64_ALPHABET.charAt(((b1 & 15) << 2) | (b2 >> 6)) : '=';
      out += i + 2 < bytes.length ? B64_ALPHABET.charAt(b2 & 63) : '=';
    }
    return out;
  }

  // 清洗 Base64 文本：容忍空白 / URL-safe 字符(-_) / 省略的填充；非法输入抛错而不是静默乱码
  function _cleanBase64(input) {
    var s = String(input === null || input === undefined ? '' : input)
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    if (!s) return '';
    var body = s.replace(/=+$/, '');
    if (body.indexOf('=') >= 0) throw new Error('不是合法的 Base64：填充符「=」只能出现在末尾');
    if (body.length % 4 === 1) throw new Error('不是合法的 Base64：长度不合法');
    for (var i = 0; i < body.length; i++) {
      var c = body.charCodeAt(i);
      if (c > 127 || B64_LOOKUP[c] < 0) {
        throw new Error('不是合法的 Base64：含有非法字符「' + body.charAt(i) + '」');
      }
    }
    return body;
  }

  function _base64ToBytes(clean) {
    var out = [];
    var n = 0, bits = 0;
    for (var i = 0; i < clean.length; i++) {
      var v = B64_LOOKUP[clean.charCodeAt(i)];
      if (v < 0) continue;
      n = (n << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((n >> bits) & 255);
        n &= (1 << bits) - 1;   // 丢掉已输出的高位，防止 32 位溢出
      }
    }
    return out;
  }

  function b64encodeUtf8(s) {
    return _bytesToBase64(_utf8Bytes(String(s)));
  }

  function b64decodeUtf8(b64) {
    var clean = _cleanBase64(b64);
    if (!clean) return '';
    var bytes = _base64ToBytes(clean);
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(Uint8Array.from(bytes));
    }
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
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

  // 文本 → 摩斯（词之间用 " / " 分隔，非拉丁字符原样保留）
  function morseEncode(text) {
    var words = String(text === null || text === undefined ? '' : text).trim().split(/\s+/).filter(Boolean);
    return words.map(function (word) {
      var parts = [];
      for (var i = 0; i < word.length; i++) {
        var ch = word.charAt(i).toUpperCase();
        parts.push(MORSE_TABLE[ch] || word.charAt(i));
      }
      return parts.join(' ');
    }).join(' / ');
  }

  // 摩斯 → 文本
  // 字母之间用空白分隔；单词之间可以用 "/"、"|" 或 2 个以上空白（含换行）分隔
  function morseDecode(code) {
    var src = String(code === null || code === undefined ? '' : code)
      .replace(/\r\n?/g, '\n')
      .replace(/\|/g, '/')
      .trim();
    if (!src) return '';
    // 词分隔符：2 个以上空白，或两侧至少一侧带空白的 "/"；紧贴字母的 "/" 只当作字母分隔
    var marked = src
      .replace(/\s{2,}/g, ' | ')
      .replace(/\s+\/\s*|\s*\/\s+/g, ' | ')
      .replace(/\//g, ' ');
    var out = [];
    marked.split('|').forEach(function (word) {
      var letters = '';
      word.trim().split(/\s+/).forEach(function (tok) {
        if (!tok) return;
        if (MORSE_REVERSE[tok]) letters += MORSE_REVERSE[tok];
        else if (/^[.-]+$/.test(tok)) letters += '?';  // 未知点划组合
        else letters += tok;
      });
      if (letters) out.push(letters);
    });
    return out.join(' ');
  }

  /* ---------- 字符统计与藏头检测 ---------- */
  // 字符频次（按 Unicode 码点计数，跳过空白；标点、表情、扩展区汉字都计入）
  function charFreq(text) {
    var s = String(text === null || text === undefined ? '' : text);
    var freq = Object.create(null);
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      var ch = s.charAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {   // 代理对 → 合成一个码点
        var low = s.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) { ch = s.substr(i, 2); i++; }
      }
      if (/\s/.test(ch)) continue;
      freq[ch] = (freq[ch] || 0) + 1;
    }
    return Object.keys(freq).map(function (k) { return { char: k, count: freq[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  // 取每行（或每段）首字符 → 藏头
  function firstCharsOfLines(text, sep) {
    var lines = String(text === null || text === undefined ? '' : text).split(sep || /\r?\n+/);
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
    charFreq: charFreq,
    firstCharsOfLines: firstCharsOfLines
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tools;
  } else {
    global.NETools = Tools;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
