'use strict';
/* LOOM · 织造程序语言（DSL）
 *
 * 一份织造程序长这样：
 *
 *   # 我的第一块布
 *   title 2/2 斜纹
 *   warp 32 / weft 32
 *   shafts 4 / treadles 4
 *
 *   threading  1 2 3 4
 *   tieup
 *     1: 1 2
 *     2: 2 3
 *     3: 3 4
 *     4: 4 1
 *   treadling  1 2 3 4
 *
 *   warp-yarn #c8623c
 *   weft-yarn #2f4f63
 *
 * 数字一律从 1 开始数（和第几根经线、第几片综框的说法一致）。
 * 也可以跳过提综 / 踏综，直接写提升计划（打孔卡片）：
 *
 *   liftplan
 *     1: 1 3 5 7
 *     2: 2 4 6 8
 */
(function (root) {
  'use strict';

  var KEYWORDS = {
    'title': 'title', 'name': 'title', '名称': 'title',
    'warp': 'warpCount', 'ends': 'warpCount', '经线': 'warpCount',
    'weft': 'weftCount', 'picks': 'weftCount', '纬线': 'weftCount',
    'shafts': 'shaftCount', '综框': 'shaftCount',
    'treadles': 'treadleCount', '踏杆': 'treadleCount',
    'threading': 'threading', '穿综': 'threading',
    'tieup': 'tieup', '提综': 'tieup',
    'treadling': 'treadling', '踏综': 'treadling',
    'liftplan': 'liftplan', '提升计划': 'liftplan',
    'warp-yarn': 'warpYarn', 'warp-color': 'warpYarn', '经纱': 'warpYarn',
    'weft-yarn': 'weftYarn', 'weft-color': 'weftYarn', '纬纱': 'weftYarn'
  };

  function stripComment(line) {
    var out = '', inCode = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '#' && !/[0-9a-fA-F]/.test(line[i + 1] || '') && (i === 0 || line[i - 1] !== '#')) {
        /* '#' 后面紧跟十六进制时当作颜色，否则当注释 */
        break;
      }
      out += ch;
    }
    return out;
  }

  /* 把 '1 2 3' / '1,2,3' / '1-4' 解析成 [1,2,3,4] */
  function parseNumbers(str) {
    var out = [];
    var t0 = String(str).trim();
    if (t0 === '' || t0 === '-' || t0 === 'none' || t0 === '空') return { values: [] };
    var parts = t0.replace(/,/g, ' ').split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      var tok = parts[i];
      if (!tok) continue;
      var m = /^(\d+)\s*[-~]\s*(\d+)$/.exec(tok);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        var step = a <= b ? 1 : -1;
        for (var v = a; step > 0 ? v <= b : v >= b; v += step) out.push(v);
        continue;
      }
      if (/^\d+$/.test(tok)) { out.push(parseInt(tok, 10)); continue; }
      return { error: '看不懂的记号 "' + tok + '"（只支持数字、逗号和 1-4 这样的范围）' };
    }
    return { values: out };
  }

  /* 一行里用 / 或 | 分隔多个片段：'warp 32 / weft 32'、'1 2 | 2 3 | 3 4' */
  function splitSlash(str) {
    return String(str).split(/\s*[\/|]\s*/);
  }

  function parse(text) {
    var errors = [], warnings = [];
    var spec = {
      title: null, warpCount: null, weftCount: null, shaftCount: null, treadleCount: null,
      threading: null, tieup: null, treadling: null, liftplan: null,
      warpYarn: null, weftYarn: null
    };
    var tieupRows = [], liftRows = [];
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var block = null;
    var nextTreadle = 0, nextPick = 0;
    var seenTieupBlock = false, seenLiftBlock = false;

    function err(ln, msg) { errors.push({ line: ln, msg: msg }); }

    for (var i = 0; i < lines.length; i++) {
      var ln = i + 1;
      var raw = stripComment(lines[i]);
      var line = raw.trim();
      if (!line) continue;

      var mHead = /^([A-Za-z\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5-]*)\s*[:=]?\s*(.*)$/.exec(line);
      var head = mHead ? mHead[1].toLowerCase() : null;
      var rest = mHead ? mHead[2] : '';
      var kw = head ? KEYWORDS[head] : null;

      /* 块内的条目：'1: 2 3' 或 '2 3' */
      if (block && !kw) {
        var mIdx = /^(t)?(\d+)\s*[:=]\s*(.*)$/.exec(line);
        var idx = null, body = line;
        if (mIdx) { idx = parseInt(mIdx[2], 10); body = mIdx[3]; }
        var pn = parseNumbers(body);
        if (pn.error) { err(ln, pn.error); continue; }
        if (block === 'tieup') {
          if (idx == null) idx = ++nextTreadle; else nextTreadle = Math.max(nextTreadle, idx);
          tieupRows[idx - 1] = pn.values;
        } else {
          if (idx == null) idx = ++nextPick; else nextPick = Math.max(nextPick, idx);
          liftRows[idx - 1] = pn.values;
        }
        continue;
      }

      if (!kw) { err(ln, '不认识的指令 "' + (head || line) + '"'); block = null; continue; }

      if (kw === 'tieup' || kw === 'liftplan') {
        block = kw;
        if (kw === 'tieup') seenTieupBlock = true; else seenLiftBlock = true;
        /* 允许单行写法： tieup 1 2 | 2 3 | 3 4 */
        var segs = splitSlash(rest).filter(function (s) { return s.trim().length; });
        for (var si = 0; si < segs.length; si++) {
          var pn0 = parseNumbers(segs[si]);
          if (pn0.error) { err(ln, pn0.error); continue; }
          if (kw === 'tieup') tieupRows[nextTreadle++] = pn0.values;
          else liftRows[nextPick++] = pn0.values;
        }
        continue;
      }

      block = null;

      if (kw === 'title') { spec.title = rest.trim(); continue; }
      if (kw === 'warpYarn' || kw === 'weftYarn') {
        var c = rest.trim();
        if (!c) { err(ln, '纱线颜色不能为空'); continue; }
        spec[kw] = c;
        continue;
      }
      if (kw === 'threading' || kw === 'treadling') {
        var pn1 = parseNumbers(rest);
        if (pn1.error) { err(ln, pn1.error); continue; }
        if (!pn1.values.length) { err(ln, kw + ' 至少要有一个数字'); continue; }
        if (kw === 'threading') spec.threading = pn1.values.map(function (v) { return v - 1; });
        else spec.treadling = pn1.values.map(function (v) { return v - 1; });
        continue;
      }
      /* warp / weft / shafts / treadles：允许 'warp 32 / weft 32' 写在一行 */
      var parts = splitSlash(rest);
      var first = parts[0].trim();
      if (!/^\d+$/.test(first)) { err(ln, kw + ' 需要一个整数'); continue; }
      spec[kw] = parseInt(first, 10);
      for (var pi = 1; pi < parts.length; pi++) {
        var sub = parts[pi].trim();
        if (!sub) continue;
        var mSub = /^([A-Za-z\u4e00-\u9fa5-]+)\s*[:=]?\s*(\d+)$/.exec(sub);
        if (!mSub) { err(ln, '这一行里的 "' + sub + '" 看不懂'); continue; }
        var subKw = KEYWORDS[mSub[1].toLowerCase()];
        if (!subKw || !/^(warpCount|weftCount|shaftCount|treadleCount)$/.test(subKw)) {
          err(ln, '"' + mSub[1] + '" 不能写在这里'); continue;
        }
        spec[subKw] = parseInt(mSub[2], 10);
      }
    }

    if (seenTieupBlock) {
      var cleanedT = [];
      for (var t = 0; t < tieupRows.length; t++) cleanedT.push((tieupRows[t] || []).map(function (v) { return v - 1; }));
      spec.tieup = cleanedT;
    }
    if (seenLiftBlock) {
      var wGuess = spec.warpCount || (spec.threading ? spec.threading.length : 0);
      var cleanedL = [];
      for (var p = 0; p < liftRows.length; p++) {
        var row = new Uint8Array(wGuess || 0);
        var src = liftRows[p] || [];
        for (var q = 0; q < src.length; q++) {
          var idx2 = src[q] - 1;
          if (wGuess && (idx2 < 0 || idx2 >= wGuess)) {
            warnings.push({ line: 0, msg: '提升计划第 ' + (p + 1) + ' 纬里的经线 ' + src[q] + ' 超出 ' + wGuess + ' 根，已忽略' });
            continue;
          }
          if (!wGuess) {
            /* 未声明经线数时按最大下标扩张 */
            var need = idx2 + 1;
            if (row.length < need) { var grown = new Uint8Array(need); grown.set(row); row = grown; }
          }
          row[idx2] = 1;
        }
        cleanedL.push(row);
      }
      /* 统一宽度 */
      var maxW = 0;
      for (var r2 = 0; r2 < cleanedL.length; r2++) maxW = Math.max(maxW, cleanedL[r2].length);
      for (var r3 = 0; r3 < cleanedL.length; r3++) {
        if (cleanedL[r3].length !== maxW) {
          var fixed = new Uint8Array(maxW); fixed.set(cleanedL[r3]); cleanedL[r3] = fixed;
        }
      }
      spec.liftplan = cleanedL;
      if (!spec.warpCount) spec.warpCount = maxW;
    }

    if (!spec.threading && !spec.liftplan) errors.push({ line: 0, msg: '既没有 threading 也没有 liftplan，织不出布' });
    if (!spec.liftplan && !spec.treadling) errors.push({ line: 0, msg: '缺少 treadling（或改用 liftplan）' });

    return { spec: spec, errors: errors, warnings: warnings };
  }

  /* ================= 序列化：把草稿写回织造程序 ================= */
  function serialize(draft) {
    var L = [];
    L.push('# 由 LOOM 手绘提花导出');
    if (draft.title) L.push('title ' + draft.title);
    L.push('warp ' + draft.warpCount + ' / weft ' + draft.weftCount);
    if (draft.warpYarn) L.push('warp-yarn ' + draft.warpYarn);
    if (draft.weftYarn) L.push('weft-yarn ' + draft.weftYarn);
    L.push('');
    var m = (root.Loom && root.Loom.weave) ? root.Loom.weave.drawdown(draft)
          : (typeof require !== 'undefined' ? require('./weave.js').drawdown(draft) : null);
    if (!m) return L.join('\n');
    L.push('liftplan');
    for (var p = 0; p < m.length; p++) {
      var ups = [];
      for (var e = 0; e < m[p].length; e++) if (m[p][e]) ups.push(e + 1);
      L.push('  ' + (p + 1) + ': ' + (ups.length ? ups.join(' ') : '-'));
    }
    return L.join('\n');
  }

  var api = { parse: parse, serialize: serialize, parseNumbers: parseNumbers, KEYWORDS: KEYWORDS };
  root.Loom = root.Loom || {};
  root.Loom.dsl = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
