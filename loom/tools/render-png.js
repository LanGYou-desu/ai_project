'use strict';
/* LOOM · 无浏览器渲染器
 *
 * 用纯 Node 实现 fabric.js 需要的那一小撮 Canvas 2D API（fillRect / 线性渐变 /
 * 平移 / 透明度 / 直线），把真实的织物渲染路径跑成 PNG。
 * 用途：命令行导出、CI 里做视觉回归、给 README 生成预览图。
 *
 *   node tools/render-png.js twill22 out.png
 *   node tools/render-png.js --all preview/
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const W = require(path.join(ROOT, 'js/shared/weave.js'));
const D = require(path.join(ROOT, 'js/shared/dsl.js'));
const P = require(path.join(ROOT, 'js/shared/patterns.js'));
const Y = require(path.join(ROOT, 'js/shared/yarn.js'));

/* ================= 颜色 ================= */
function parseColor(c) {
  if (Array.isArray(c)) return c;
  var s = String(c == null ? '#000' : c).trim();
  if (s[0] === '#') {
    var h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length >= 6) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
  }
  var m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    var p = m[1].split(',').map(function (v) { return parseFloat(v); });
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  }
  return [0, 0, 0, 1];
}

function Gradient(x0, y0, x1, y1) {
  this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
  this.stops = [];
}
Gradient.prototype.addColorStop = function (pos, color) {
  this.stops.push([pos, parseColor(color)]);
  this.stops.sort(function (a, b) { return a[0] - b[0]; });
};
Gradient.prototype.at = function (x, y) {
  var dx = this.x1 - this.x0, dy = this.y1 - this.y0;
  var len2 = dx * dx + dy * dy;
  var t = len2 ? ((x - this.x0) * dx + (y - this.y0) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  var s = this.stops;
  if (!s.length) return [0, 0, 0, 1];
  if (t <= s[0][0]) return s[0][1];
  if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (var i = 1; i < s.length; i++) {
    if (t <= s[i][0]) {
      var a = s[i - 1], b = s[i];
      var k = (t - a[0]) / ((b[0] - a[0]) || 1);
      return [
        a[1][0] + (b[1][0] - a[1][0]) * k,
        a[1][1] + (b[1][1] - a[1][1]) * k,
        a[1][2] + (b[1][2] - a[1][2]) * k,
        a[1][3] + (b[1][3] - a[1][3]) * k
      ];
    }
  }
  return s[s.length - 1][1];
};

/* ================= 迷你 2D 上下文 ================= */
function MiniCtx(width, height, bg) {
  this.width = width; this.height = height;
  this.buf = Buffer.alloc(width * height * 4);
  this.tx = 0; this.ty = 0;
  this.fillStyle = '#000';
  this.strokeStyle = '#000';
  this.lineWidth = 1;
  this.globalAlpha = 1;
  this.shadowColor = 'transparent';
  this.shadowBlur = 0;
  this.shadowOffsetY = 0;
  this._subs = [];
  this._stack = [];
  if (bg) this.fillRect(0, 0, width, height);
}

MiniCtx.prototype.setTransform = function () { return this; };
MiniCtx.prototype.clearRect = function (x, y, w, h) {
  var x0 = Math.round(x + this.tx), y0 = Math.round(y + this.ty);
  for (var py = y0; py < y0 + h; py++) {
    if (py < 0 || py >= this.height) continue;
    for (var px = x0; px < x0 + w; px++) {
      if (px < 0 || px >= this.width) continue;
      var i = (py * this.width + px) * 4;
      this.buf[i] = this.buf[i + 1] = this.buf[i + 2] = this.buf[i + 3] = 0;
    }
  }
};
MiniCtx.prototype.save = function () { this._stack.push({ tx: this.tx, ty: this.ty, fa: this.globalAlpha }); };
MiniCtx.prototype.restore = function () {
  var s = this._stack.pop();
  if (s) { this.tx = s.tx; this.ty = s.ty; this.globalAlpha = s.fa; }
};
MiniCtx.prototype.translate = function (x, y) { this.tx += x; this.ty += y; };
MiniCtx.prototype.createLinearGradient = function (x0, y0, x1, y1) {
  return new Gradient(x0 + this.tx, y0 + this.ty, x1 + this.tx, y1 + this.ty);
};
MiniCtx.prototype._blend = function (px, py, rgba, alpha) {
  if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
  var a = rgba[3] * alpha;
  if (a <= 0) return;
  var i = (py * this.width + px) * 4;
  var b = this.buf;
  b[i] = b[i] + (rgba[0] - b[i]) * a;
  b[i + 1] = b[i + 1] + (rgba[1] - b[i + 1]) * a;
  b[i + 2] = b[i + 2] + (rgba[2] - b[i + 2]) * a;
  b[i + 3] = 255;
};
MiniCtx.prototype.fillRect = function (x, y, w, h) {
  var style = this.fillStyle;
  var x0 = Math.round(x + this.tx), y0 = Math.round(y + this.ty);
  var x1 = Math.round(x0 + w), y1 = Math.round(y0 + h);
  var grad = (style instanceof Gradient) ? style : null;
  var flat = grad ? null : parseColor(style);
  for (var py = y0; py < y1; py++) {
    for (var px = x0; px < x1; px++) {
      this._blend(px, py, grad ? grad.at(px + 0.5, py + 0.5) : flat, this.globalAlpha);
    }
  }
};
MiniCtx.prototype.strokeRect = function (x, y, w, h) {
  var lw = Math.max(1, Math.round(this.lineWidth));
  this.fillRect(x, y, w, lw);
  this.fillRect(x, y + h - lw, w, lw);
  this.fillRect(x, y, lw, h);
  this.fillRect(x + w - lw, y, lw, h);
};
MiniCtx.prototype.beginPath = function () { this._subs = []; };
MiniCtx.prototype.moveTo = function (x, y) { this._subs.push([{ x: x + this.tx, y: y + this.ty }]); };
MiniCtx.prototype.lineTo = function (x, y) {
  if (!this._subs.length) this._subs.push([]);
  this._subs[this._subs.length - 1].push({ x: x + this.tx, y: y + this.ty });
};
/* 曲线用折线近似：够画卡片圆角和梭子轮廓 */
MiniCtx.prototype.quadraticCurveTo = function (cx, cy, x, y) {
  var sub = this._subs[this._subs.length - 1];
  var from = sub && sub.length ? sub[sub.length - 1] : { x: this.tx, y: this.ty };
  var n = 8;
  for (var i = 1; i <= n; i++) {
    var t = i / n, u = 1 - t;
    this.lineTo(
      u * u * (from.x - this.tx) + 2 * u * t * cx + t * t * (x - this.tx),
      u * u * (from.y - this.ty) + 2 * u * t * cy + t * t * (y - this.ty)
    );
  }
};
MiniCtx.prototype.closePath = function () {};
MiniCtx.prototype.arc = function (cx, cy, r, a0, a1) {
  var pts = [], n = Math.max(8, Math.round(r * 3));
  for (var i = 0; i <= n; i++) {
    var a = a0 + (a1 - a0) * i / n;
    pts.push({ x: cx + this.tx + Math.cos(a) * r, y: cy + this.ty + Math.sin(a) * r });
  }
  this._subs.push(pts);
};
MiniCtx.prototype.rect = function (x, y, w, h) {
  this._subs.push([
    { x: x + this.tx, y: y + this.ty }, { x: x + w + this.tx, y: y + this.ty },
    { x: x + w + this.tx, y: y + h + this.ty }, { x: x + this.tx, y: y + h + this.ty }
  ]);
};
MiniCtx.prototype.clip = function () {};
/* 文字不参与像素验证，留空实现（导出的 PNG 里不画文字） */
MiniCtx.prototype.fillText = function () {};
MiniCtx.prototype.measureText = function (t) { return { width: String(t).length * 6 }; };
MiniCtx.prototype.fill = function () {
  var style = this.fillStyle;
  var grad = (style instanceof Gradient) ? style : null;
  var flat = grad ? null : parseColor(style);
  var edges = [], minY = Infinity, maxY = -Infinity;
  for (var s = 0; s < this._subs.length; s++) {
    var sub = this._subs[s];
    for (var i = 0; i < sub.length; i++) {
      var a = sub[i], b = sub[(i + 1) % sub.length];
      if (a.y === b.y) continue;
      edges.push([a, b]);
      if (a.y < minY) minY = a.y; if (b.y < minY) minY = b.y;
      if (a.y > maxY) maxY = a.y; if (b.y > maxY) maxY = b.y;
    }
  }
  if (!edges.length) return;
  var y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.height - 1, Math.ceil(maxY));
  for (var y = y0; y <= y1; y++) {
    var yc = y + 0.5, xs = [];
    for (var k = 0; k < edges.length; k++) {
      var e = edges[k];
      if ((e[0].y <= yc && e[1].y > yc) || (e[1].y <= yc && e[0].y > yc)) {
        xs.push(e[0].x + (yc - e[0].y) / (e[1].y - e[0].y) * (e[1].x - e[0].x));
      }
    }
    xs.sort(function (p, q) { return p - q; });
    for (var m = 0; m + 1 < xs.length; m += 2) {
      var xa = Math.ceil(xs[m] - 0.5), xb = Math.floor(xs[m + 1] - 0.5);
      for (var x = xa; x <= xb; x++) this._blend(x, y, grad ? grad.at(x + 0.5, yc) : flat, this.globalAlpha);
    }
  }
};
MiniCtx.prototype.stroke = function () {
  var col = parseColor(this.strokeStyle);
  var lw = Math.max(1, Math.round(this.lineWidth));
  for (var s = 0; s < this._subs.length; s++) {
    var sub = this._subs[s];
    for (var i = 0; i + 1 < sub.length; i++) this._line(sub[i].x, sub[i].y, sub[i + 1].x, sub[i + 1].y, col, lw);
  }
};
MiniCtx.prototype._line = function (x0, y0, x1, y1, col, lw) {
  var dx = x1 - x0, dy = y1 - y0;
  var steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  var r = Math.max(0, Math.floor(lw / 2));
  for (var s = 0; s <= steps; s++) {
    var x = Math.round(x0 + dx * s / steps), y = Math.round(y0 + dy * s / steps);
    for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) this._blend(x + ox, y + oy, col, this.globalAlpha);
  }
};

/* ================= PNG 编码 ================= */
var CRC_TABLE = (function () {
  var t = new Int32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  var c = -1;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var t = Buffer.from(type, 'ascii');
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  var raw = Buffer.alloc((width * 4 + 1) * height);
  for (var y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ================= 渲染 ================= */
function renderMatrix(matrix, o) {
  o = o || {};
  var F = require(path.join(ROOT, 'js/fabric.js'));
  var Wc = matrix[0].length, Hc = matrix.length;
  var cs = o.cellSize || Math.max(3, Math.min(24, Math.floor(640 / Math.max(Wc, Hc))));
  var pad = o.pad == null ? 18 : o.pad;
  var width = Wc * cs + pad * 2, height = Hc * cs + pad * 2;
  var ctx = new MiniCtx(width, height, o.background || '#14100c');
  F.draw(ctx, {
    matrix: matrix,
    warpColor: o.warpColor || '#c8623c',
    weftColor: o.weftColor || '#2f4f63',
    cellSize: cs, ox: pad, oy: pad,
    mode: o.mode || 'real', grid: !!o.grid,
    background: o.background || '#14100c', crisp: cs < 5
  });
  return { ctx: ctx, width: width, height: height };
}

function renderPattern(id, o) {
  var entry = P.LIBRARY.filter(function (p) { return p.id === id; })[0];
  if (!entry) throw new Error('没有纹样 ' + id);
  var parsed = D.parse(entry.dsl);
  var built = W.build(parsed.spec);
  if (built.errors.length) throw new Error(JSON.stringify(built.errors));
  var matrix = W.drawdown(built.draft);
  o = o || {};
  return renderMatrix(matrix, {
    warpColor: built.draft.warpYarn, weftColor: built.draft.weftYarn,
    mode: o.mode, grid: o.grid, cellSize: o.cellSize, background: o.background
  });
}

function writePng(file, r) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePng(r.width, r.height, r.ctx.buf));
  return file;
}

module.exports = {
  MiniCtx: MiniCtx, encodePng: encodePng, renderMatrix: renderMatrix,
  renderPattern: renderPattern, writePng: writePng, parseColor: parseColor, Gradient: Gradient
};

/* ================= CLI ================= */
if (require.main === module) {
  var args = process.argv.slice(2);
  if (!args.length || args[0] === '--help') {
    console.log('用法: node tools/render-png.js <纹样 id | all> [输出.png 或 目录]');
    console.log('纹样: ' + P.LIBRARY.map(function (p) { return p.id; }).join(', '));
    process.exit(0);
  }
  var target = args[0], out = args[1] || '.';
  if (target === 'all' || target === '--all') {
    var dir = (out === '.' ? 'preview' : out);
    P.LIBRARY.forEach(function (p) {
      var r = renderPattern(p.id, { cellSize: 14 });
      var f = path.join(dir, p.id + '.png');
      writePng(f, r);
      console.log('✓ ' + f + '  ' + r.width + '×' + r.height);
    });
  } else {
    var r2 = renderPattern(target, { cellSize: Number(process.env.LOOM_CELL || 16) });
    var f2 = out === '.' ? target + '.png' : out;
    writePng(f2, r2);
    console.log('✓ ' + f2 + '  ' + r2.width + '×' + r2.height);
  }
}
