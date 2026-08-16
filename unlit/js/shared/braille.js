/* UNLIT · 无光之城 — 盲文（六点制）编解码
 * 点位编号：1=左上 2=左中 3=左下 4=右上 5=右中 6=右下
 * 位掩码：dot1=1 dot2=2 dot3=4 dot4=8 dot5=16 dot6=32
 * 覆盖：字母、数字（数字符 ⠼）、常用标点、磨损(cell 缺点点)模拟。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UNLIT_BRAILLE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 字母 → 点位
  const ALPHA = {
    a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5],
    f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5],
    k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
    p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
    u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6],
    y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6]
  };
  const NUMBER_SIGN = [3, 4, 5, 6]; // ⠼
  const PUNCT = {
    ' ': [],
    '.': [2, 5, 6],
    ',': [2],
    '?': [2, 3, 6],
    '!': [2, 3, 5],
    "'": [3],
    '-': [3, 6],
    ':': [2, 5],
    ';': [2, 3],
    '（': [2, 3, 5, 6], '(': [2, 3, 5, 6],
    '）': [2, 3, 5, 6], ')': [2, 3, 5, 6],
    '“': [2, 3, 6], '”': [2, 3, 6], '"': [2, 3, 6]
  };
  const DIGIT_LETTER = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' };
  const LETTER_DIGIT = { a: '1', b: '2', c: '3', d: '4', e: '5', f: '6', g: '7', h: '8', i: '9', j: '0' };

  function dotMask(dots) {
    let m = 0;
    for (const d of dots) m |= (1 << (d - 1));
    return m;
  }
  function maskDots(mask) {
    const out = [];
    for (let d = 1; d <= 6; d++) if (mask & (1 << (d - 1))) out.push(d);
    return out;
  }

  // 单字符 → { mask, kind: 'letter'|'digit'|'punct'|'space' } 或 null
  function charToCell(ch) {
    const c = ch.toLowerCase();
    if (c === ' ') return { mask: 0, kind: 'space' };
    if (ALPHA[c]) return { mask: dotMask(ALPHA[c]), kind: 'letter' };
    if (DIGIT_LETTER[c]) return { mask: dotMask(ALPHA[DIGIT_LETTER[c]]), kind: 'digit' };
    if (PUNCT[c] !== undefined) return { mask: dotMask(PUNCT[c]), kind: 'punct' };
    return null;
  }

  // 文本 → 单元格序列（自动插入数字符）
  function textToCells(text) {
    const cells = [];
    let prevWasDigit = false;
    for (const ch of text) {
      const cell = charToCell(ch);
      if (!cell) continue;
      if (cell.kind === 'digit') {
        if (!prevWasDigit) cells.push({ ch: '⠼', mask: dotMask(NUMBER_SIGN), kind: 'numbersign' });
        cells.push({ ch: ch, mask: cell.mask, kind: 'digit' });
        prevWasDigit = true;
      } else {
        cells.push({ ch: ch.toLowerCase(), mask: cell.mask, kind: cell.kind });
        prevWasDigit = false;
      }
    }
    return cells;
  }

  // 单元格序列 → 文本（解码；自动处理数字符）
  function cellsToText(cells) {
    let out = '';
    let inNumber = false;
    for (const cell of cells) {
      if (cell.kind === 'numbersign') { inNumber = true; continue; }
      if (cell.kind === 'space') { inNumber = false; out += ' '; continue; }
      if (cell.kind === 'punct') { inNumber = false; out += cell.ch; continue; }
      if (cell.kind === 'letter') {
        out += inNumber ? (LETTER_DIGIT[cell.ch] || cell.ch) : cell.ch;
        inNumber = false;
      } else if (cell.kind === 'digit') {
        out += cell.ch; inNumber = true;
      }
    }
    return out;
  }

  // 根据掩码找字符
  function cellToChar(mask) {
    if (mask === 0) return ' ';
    if (mask === dotMask(NUMBER_SIGN)) return '⠼';
    for (const [ch, dots] of Object.entries(ALPHA)) if (dotMask(dots) === mask) return ch;
    for (const [ch, dots] of Object.entries(PUNCT)) if (dotMask(dots) === mask) return ch;
    return null;
  }

  // 掩码 → Unicode 盲文字符
  function renderChar(mask) { return String.fromCodePoint(0x2800 + mask); }

  // 掩码 → 2×3 网格（行序：上中下；每行 [左点, 右点]）
  function cellGrid(mask) {
    const on = (d) => !!(mask & (1 << (d - 1)));
    return [[on(1), on(4)], [on(2), on(5)], [on(3), on(6)]];
  }

  // 磨损：从单元格中随机移除若干点（模拟旧书磨损），返回新 mask
  function wearMask(mask, rng, maxWear) {
    const dots = maskDots(mask);
    if (dots.length === 0) return mask;
    const n = Math.min(dots.length - 1, rng ? rng.int(1, maxWear || 2) : 1);
    const removed = rng ? rng.shuffle(dots).slice(0, n) : dots.slice(0, n);
    for (const d of removed) mask &= ~(1 << (d - 1));
    return mask;
  }

  return {
    ALPHA, NUMBER_SIGN, PUNCT, DIGIT_LETTER, LETTER_DIGIT,
    dotMask, maskDots, charToCell, textToCells, cellsToText,
    cellToChar, renderChar, cellGrid, wearMask
  };
});
