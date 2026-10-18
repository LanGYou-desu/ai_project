'use strict';
/* LOOM · 纱线颜色工具与配色方案 */
(function (root) {
  'use strict';

  var NAMED = {
    '茜红': '#c94f3d', '靛蓝': '#2f4a5e', '月白': '#f2e4c9', '藏青': '#1e2a38',
    '赭石': '#a9713f', '苔绿': '#5f7350', '朱砂': '#b5382c', '墨黑': '#1c1a18',
    '亚麻': '#e6dcc8', '竹青': '#6c8a6a', '紫檀': '#6b3a44', '金': '#c8a24a',
    'red': '#c94f3d', 'blue': '#2f4a5e', 'cream': '#f2e4c9', 'black': '#1c1a18'
  };

  function normalizeColor(c, fallback) {
    if (c == null) return fallback || '#888888';
    var s = String(c).trim();
    if (NAMED[s.toLowerCase()]) return NAMED[s.toLowerCase()];
    if (NAMED[s]) return NAMED[s];
    if (/^#?[0-9a-fA-F]{6}$/.test(s)) return '#' + s.replace('#', '').toLowerCase();
    if (/^#?[0-9a-fA-F]{3}$/.test(s)) {
      var h = s.replace('#', '').toLowerCase();
      return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return fallback || '#888888';
  }

  function toRgb(hex) {
    var h = normalizeColor(hex).replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function toHex(rgb) {
    function c(v) { v = Math.max(0, Math.min(255, Math.round(v))); var s = v.toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + c(rgb[0]) + c(rgb[1]) + c(rgb[2]);
  }
  /* amt > 0 变亮，< 0 变暗 */
  function shade(hex, amt) {
    var rgb = toRgb(hex);
    for (var i = 0; i < 3; i++) {
      if (amt >= 0) rgb[i] = rgb[i] + (255 - rgb[i]) * amt;
      else rgb[i] = rgb[i] * (1 + amt);
    }
    return toHex(rgb);
  }

  var PALETTES = [
    { name: '茜红 · 靛蓝', warp: '#c94f3d', weft: '#2f4a5e' },
    { name: '赭石 · 苔绿', warp: '#a9713f', weft: '#5f7350' },
    { name: '月白 · 藏青', warp: '#f2e4c9', weft: '#1e2a38' },
    { name: '朱砂 · 亚麻', warp: '#b5382c', weft: '#e6dcc8' },
    { name: '紫檀 · 金',   warp: '#6b3a44', weft: '#c8a24a' },
    { name: '竹青 · 墨黑', warp: '#6c8a6a', weft: '#1c1a18' }
  ];

  var api = {
    NAMED: NAMED, PALETTES: PALETTES,
    normalizeColor: normalizeColor, shade: shade,
    toRgb: toRgb, toHex: toHex
  };
  root.Loom = root.Loom || {};
  root.Loom.yarn = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
