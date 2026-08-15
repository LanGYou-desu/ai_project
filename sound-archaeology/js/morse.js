'use strict';
// ============================================================
// 声音考古学 · 摩斯电码
// 注意：本文件需在 synth.js 之前加载（synth.morseTokens 引用 Morse.TABLE）
// ============================================================

const Morse = (() => {
  const TABLE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
    U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '-': '-....-',
  };
  const REV = {};
  for (const k in TABLE) REV[TABLE[k]] = k;

  // 文本 → 标准字符串（字母间空格，词间 " / "）
  function encode(text) {
    const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
    return words.map((w) =>
      [...w].map((ch) => TABLE[ch] || '').filter(Boolean).join(' ')
    ).join(' / ');
  }

  // 电码字符串 → 文本（兼容字母间单空格、词间 " / " 或多空格）
  function decode(seq) {
    const words = String(seq).trim().split(/\s*\/\s*|\s{2,}/);
    return words.map((w) =>
      w.trim().split(/\s+/).map((code) => REV[code] || '?').join('')
    ).join(' ');
  }

  // UI 速查表
  const REF_LETTERS = (() => {
    const rows = [];
    let line = [];
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      line.push([ch, TABLE[ch]]);
      if (line.length === 6) { rows.push(line); line = []; }
    }
    if (line.length) rows.push(line);
    return rows;
  })();
  const REF_DIGITS = '0123456789'.split('').map((d) => [d, TABLE[d]]);

  return { TABLE, REV, encode, decode, REF_LETTERS, REF_DIGITS };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Morse;
}
