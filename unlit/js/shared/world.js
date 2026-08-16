/* UNLIT · 无光之城 — 世界数据与地图解析
 * 地图图例：'#'=墙  '.'=地板  'P'=出生点  'r'=车道(可走但危险)
 *          其余字母=对象点位（由各章 legend 映射到对象 id，含 X → '__exit__' 出口）
 * 章节可含多张地图（如电梯内），通过 portal 对象切换。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UNLIT_WORLD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseMap(lines, legend) {
    const grid = [];
    const objects = [];
    let startPos = null;
    let h = 0, w = 0;
    for (const line of lines) {
      const clean = String(line).replace(/\r/g, '');
      const row = clean.split('');
      w = Math.max(w, row.length);
      grid.push(row);
      h++;
    }
    for (const row of grid) while (row.length < w) row.push('#');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = grid[y][x];
        if (c === 'P') {
          if (startPos) throw new Error('map has multiple start points');
          grid[y][x] = '.';
          startPos = { x, y };
        } else if (c === 'r') {
          grid[y][x] = '.';
        } else if (c !== '#' && c !== '.') {
          const oid = legend[c];
          if (!oid) throw new Error('unmapped legend char: ' + c + ' in map');
          grid[y][x] = '.';
          objects.push({ id: oid, x, y });
        }
      }
    }
    return { grid, w, h, start: startPos, objects };
  }

  // 章节定义：入口地图 + 地图集 + 对象元数据（详见 chapters.js）
  const CHAPTERS = {};

  function register(chapter) { CHAPTERS[chapter.id] = chapter; }

  function get(id) { return CHAPTERS[id]; }

  function validate() {
    const errors = [];
    for (const cid of Object.keys(CHAPTERS)) {
      const ch = CHAPTERS[cid];
      for (const mid of Object.keys(ch.maps)) {
        const m = ch.maps[mid];
        const rows = m.raw.split('\n').map(r => r.replace(/\r/g, ''));
        const len = rows[0].length;
        rows.forEach((r, i) => { if (r.length !== len) errors.push(cid + '/' + mid + ' row' + i + ' length ' + r.length + ' != ' + len); });
        if (rows[0][0] !== '#' || rows[rows.length - 1][0] !== '#') errors.push(cid + '/' + mid + ' border?');
        for (const c of Object.keys(m.legend || {})) {
          if (!m.raw.includes(c)) errors.push(cid + '/' + mid + ' legend char ' + c + ' not in map');
        }
      }
    }
    return errors;
  }

  return { parseMap, register, get, CHAPTERS, validate };
});
