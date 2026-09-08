'use strict';
/* LOOM · 织造核心引擎（纯逻辑，零依赖，浏览器 / Node 通用）
 *
 * 术语对照织机：
 *   经线 warp    —— 竖直的线，绕在织轴上，数量 warpCount
 *   纬线 weft    —— 水平打入的线，数量 weftCount
 *   综框 shaft   —— 一组经线穿过的框，可整框抬起
 *   踏杆 treadle —— 踩下时带动若干综框
 *   穿综 threading —— 每根经线穿在哪片综框
 *   提综 tieup     —— 每根踏杆抬起哪些综框
 *   踏综 treadling —— 每一纬踩哪根踏杆
 *   提升计划 liftplan —— 每一纬被抬起的经线集合（就是打孔卡片上的孔）
 *   织物矩阵 drawdown —— 每个交织点谁浮在表面：1 = 经浮于表，0 = 纬浮于表
 *
 * 约定：被抬起的经线压在刚打入的纬线之上，所以 liftplan 的数值与 drawdown 一致。
 */
(function (root) {
  'use strict';

  var WARP = 1, WEFT = 0;

  /* ================= 基础工具 ================= */
  function zeros(w, h) {
    var m = new Array(h);
    for (var i = 0; i < h; i++) m[i] = new Uint8Array(w);
    return m;
  }
  function gcd(a, b) {
    a = Math.abs(a) | 0; b = Math.abs(b) | 0;
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function clampInt(v, lo, hi, d) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return d;
    return Math.max(lo, Math.min(hi, n));
  }
  function divisors(n) {
    var out = [];
    for (var i = 1; i <= n; i++) if (n % i === 0) out.push(i);
    return out;
  }

  /* 把一行（或一列）看成环，取出 value 的连续段。
   * 返回 [{start, len}]；整行都是 value 时返回 [{start:0, len:n}]；没有 value 时返回 [] */
  function cyclicRuns(arr, value) {
    var n = arr.length;
    if (!n) return [];
    var anyV = false, anyOther = false;
    for (var i = 0; i < n; i++) { if (arr[i] === value) anyV = true; else anyOther = true; }
    if (!anyV) return [];
    if (!anyOther) return [{ start: 0, len: n }];
    var s = -1;
    for (var j = 0; j < n; j++) {
      if (arr[j] === value && arr[mod(j - 1, n)] !== value) { s = j; break; }
    }
    var runs = [], pos = s;
    while (pos < s + n) {
      var len = 0;
      while (len < n && arr[mod(pos + len, n)] === value) len++;
      runs.push({ start: mod(pos, n), len: len });
      pos += len;
      while (pos < s + n && arr[mod(pos, n)] !== value) pos++;
    }
    return runs;
  }

  function colOf(m, e) {
    var h = m.length, c = new Uint8Array(h);
    for (var p = 0; p < h; p++) c[p] = m[p][e];
    return c;
  }

  /* ================= 草稿构建 ================= */
  /* spec 由 DSL 解析器或纹样库给出：
   *   { title, warpCount, weftCount, shaftCount, treadleCount,
   *     threading:[0-based], tieup:[[0-based]], treadling:[0-based],
   *     liftplan:[[0|1]], warpYarn, weftYarn }
   */
  function build(spec) {
    spec = spec || {};
    var errors = [], warnings = [];
    var d = {
      title: spec.title || '未命名织物',
      warpCount: 0, weftCount: 0, shaftCount: 0, treadleCount: 0,
      threading: null, tieup: null, treadling: null, liftplan: null,
      warpYarn: spec.warpYarn || '#c8623c',
      weftYarn: spec.weftYarn || '#2f4f63'
    };

    /* --- 路线 A：直接给出提升计划（手工提花 / 打孔卡片） --- */
    if (spec.liftplan && spec.liftplan.length) {
      var lp = spec.liftplan;
      var w = lp[0].length, h = lp.length;
      for (var p0 = 0; p0 < h; p0++) {
        if (lp[p0].length !== w) { errors.push({ msg: '提升计划第 ' + (p0 + 1) + ' 纬的经线数与第 1 纬不一致' }); }
      }
      d.warpCount = w; d.weftCount = h;
      d.liftplan = lp.map(function (row) {
        var r = new Uint8Array(w);
        for (var e = 0; e < w; e++) r[e] = row[e] ? 1 : 0;
        return r;
      });
      d.shaftCount = spec.shaftCount || 0;
      d.treadleCount = spec.treadleCount || 0;
      d.threading = spec.threading || null;
      d.tieup = spec.tieup || null;
      d.treadling = spec.treadling || null;
      return { draft: d, errors: errors, warnings: warnings };
    }

    /* --- 路线 B：穿综 + 提综 + 踏综 --- */
    var th = spec.threading, tu = spec.tieup, tr = spec.treadling;
    if (!th || !th.length) errors.push({ msg: '缺少穿综 threading' });
    if (!tu || !tu.length) errors.push({ msg: '缺少提综 tieup' });
    if (!tr || !tr.length) errors.push({ msg: '缺少踏综 treadling' });
    if (errors.length) return { draft: d, errors: errors, warnings: warnings };

    var shaftCount = spec.shaftCount || (Math.max.apply(null, th) + 1);
    var treadleCount = spec.treadleCount || tu.length;
    var warpCount = spec.warpCount || th.length;
    var weftCount = spec.weftCount || tr.length;

    if (warpCount > 512 || weftCount > 512) errors.push({ msg: '织物尺寸过大（上限 512 × 512）' });
    if (shaftCount < 1 || shaftCount > 32) errors.push({ msg: '综框数必须在 1 – 32 之间' });
    if (treadleCount < 1 || treadleCount > 32) errors.push({ msg: '踏杆数必须在 1 – 32 之间' });

    for (var i = 0; i < th.length; i++) {
      if (th[i] < 0 || th[i] >= shaftCount) errors.push({ msg: '穿综第 ' + (i + 1) + ' 根经线用了不存在的综框 ' + (th[i] + 1) });
    }
    for (var t = 0; t < tu.length; t++) {
      if (!tu[t] || !tu[t].length) warnings.push({ msg: '第 ' + (t + 1) + ' 根踏杆没有抬起任何综框' });
      for (var q = 0; q < (tu[t] || []).length; q++) {
        if (tu[t][q] < 0 || tu[t][q] >= shaftCount) errors.push({ msg: '第 ' + (t + 1) + ' 根踏杆用了不存在的综框 ' + (tu[t][q] + 1) });
      }
    }
    for (var k = 0; k < tr.length; k++) {
      if (tr[k] < 0 || tr[k] >= treadleCount) errors.push({ msg: '踏综第 ' + (k + 1) + ' 纬用了不存在的踏杆 ' + (tr[k] + 1) });
    }
    if (errors.length) return { draft: d, errors: errors, warnings: warnings };

    /* 穿综 / 踏综不足时按织造惯例循环补齐 */
    var threading = new Uint8Array(warpCount);
    for (var e = 0; e < warpCount; e++) threading[e] = th[e % th.length];
    var treadling = new Uint8Array(weftCount);
    for (var pp = 0; pp < weftCount; pp++) treadling[pp] = tr[pp % tr.length];

    var tieup = [];
    for (var tt = 0; tt < treadleCount; tt++) {
      var src = tu[tt % tu.length] || [];
      var set = [];
      for (var s = 0; s < src.length; s++) if (set.indexOf(src[s]) < 0) set.push(src[s]);
      set.sort(function (a, b) { return a - b; });
      tieup.push(set);
    }

    d.warpCount = warpCount;
    d.weftCount = weftCount;
    d.shaftCount = shaftCount;
    d.treadleCount = treadleCount;
    d.threading = threading;
    d.tieup = tieup;
    d.treadling = treadling;
    d.liftplan = null;
    return { draft: d, errors: errors, warnings: warnings };
  }

  /* ================= 提升计划 / 织物矩阵 ================= */
  function liftPlan(draft) {
    var W = draft.warpCount, H = draft.weftCount, m = zeros(W, H);
    if (draft.liftplan) {
      for (var p = 0; p < H; p++) for (var e = 0; e < W; e++) m[p][e] = draft.liftplan[p][e] ? 1 : 0;
      return m;
    }
    var tu = [];
    for (var t = 0; t < draft.treadleCount; t++) {
      var row = new Uint8Array(draft.shaftCount);
      var list = draft.tieup[t] || [];
      for (var i = 0; i < list.length; i++) row[list[i]] = 1;
      tu.push(row);
    }
    for (var p2 = 0; p2 < H; p2++) {
      var tr = tu[draft.treadling[p2]];
      if (!tr) continue;
      for (var e2 = 0; e2 < W; e2++) m[p2][e2] = tr[draft.threading[e2]];
    }
    return m;
  }

  /* 织物矩阵：抬起的经线压在纬线之上 → 与提升计划一致 */
  function drawdown(draft) { return liftPlan(draft); }

  /* ================= 最小循环（重复单元） ================= */
  function periodX(m) {
    var h = m.length, w = m[0].length;
    var cands = divisors(w);
    for (var ci = 0; ci < cands.length; ci++) {
      var c = cands[ci], ok = true;
      for (var p = 0; p < h && ok; p++) {
        for (var e = c; e < w; e++) if (m[p][e] !== m[p][e % c]) { ok = false; break; }
      }
      if (ok) return c;
    }
    return w;
  }
  function periodY(m) {
    var h = m.length, w = m[0].length;
    var cands = divisors(h);
    for (var ci = 0; ci < cands.length; ci++) {
      var c = cands[ci], ok = true;
      for (var p = c; p < h && ok; p++) {
        for (var e = 0; e < w; e++) if (m[p][e] !== m[p % c][e]) { ok = false; break; }
      }
      if (ok) return c;
    }
    return h;
  }
  function repeatOf(m) {
    if (!m.length || !m[0].length) return { w: 0, h: 0 };
    return { w: periodX(m), h: periodY(m) };
  }
  function tileOf(m, rw, rh) {
    var t = [];
    for (var p = 0; p < rh; p++) {
      var row = new Uint8Array(rw);
      for (var e = 0; e < rw; e++) row[e] = m[p][e];
      t.push(row);
    }
    return t;
  }

  /* ================= 浮长分析 ================= */
  function histogram(list) {
    var h = {}, max = 0;
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      h[v] = (h[v] || 0) + 1;
      if (v > max) max = v;
    }
    return { hist: h, max: max };
  }

  function floatStats(m) {
    var h = m.length, w = m[0].length;
    var warpFloats = [], weftFloats = [];
    var hiddenEnds = [], hiddenPicks = [];
    var e, p, runs;
    for (e = 0; e < w; e++) {
      runs = cyclicRuns(colOf(m, e), 1);
      if (!runs.length) { hiddenEnds.push(e); warpFloats.push(h); continue; }
      for (var i = 0; i < runs.length; i++) warpFloats.push(runs[i].len);
    }
    for (p = 0; p < h; p++) {
      runs = cyclicRuns(m[p], 0);
      if (!runs.length) { hiddenPicks.push(p); weftFloats.push(w); continue; }
      for (var j = 0; j < runs.length; j++) weftFloats.push(runs[j].len);
    }
    var wf = histogram(warpFloats), ff = histogram(weftFloats);
    function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
    return {
      warp: { list: warpFloats, hist: wf.hist, max: wf.max, mean: mean(warpFloats) },
      weft: { list: weftFloats, hist: ff.hist, max: ff.max, mean: mean(weftFloats) },
      maxFloat: Math.max(wf.max, ff.max),
      hiddenEnds: hiddenEnds,
      hiddenPicks: hiddenPicks
    };
  }

  /* 交织次数：每根经线 / 每根纬线在循环内浮到表面的段数 */
  function interlacement(m) {
    var h = m.length, w = m[0].length;
    var perEnd = [], perPick = [];
    var e, p, runs;
    for (e = 0; e < w; e++) { runs = cyclicRuns(colOf(m, e), 1); perEnd.push(runs.length); }
    for (p = 0; p < h; p++) { runs = cyclicRuns(m[p], 1); perPick.push(runs.length); }
    function stat(a) {
      var mn = a.length ? a[0] : 0, mx = mn, s = 0;
      for (var i = 0; i < a.length; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; s += a[i]; }
      return { min: mn, max: mx, mean: a.length ? s / a.length : 0 };
    }
    return { ends: stat(perEnd), picks: stat(perPick), perEnd: perEnd, perPick: perPick };
  }

  /* ================= 组织识别 ================= */
  /* 找出使 tile[p][e] === tile[p][s - e] 的镜像轴 s（不存在返回 -1）。
   * 斜纹本身没有这样的轴，折返点斜纹 / 人字纹有。 */
  function mirrorAxis(tile) {
    var h = tile.length, w = tile[0].length;
    for (var s = 0; s < w; s++) {
      var ok = true;
      for (var p = 0; p < h && ok; p++) {
        for (var e = 0; e < w; e++) {
          if (tile[p][e] !== tile[p][mod(s - e, w)]) { ok = false; break; }
        }
      }
      if (ok) return s;
    }
    return -1;
  }
  function blockCheck(tile, a, b) {
    var h = tile.length, w = tile[0].length;
    for (var p = 0; p < h; p++) {
      for (var e = 0; e < w; e++) {
        var want = ((Math.floor(p / b) + Math.floor(e / a)) % 2 === 0) ? 1 : 0;
        if (tile[p][e] !== want) return false;
      }
    }
    return true;
  }

  function classify(tile) {
    var h = tile.length, w = tile[0].length;
    var res = { w: w, h: h, kind: 'irregular', label: '不规则 / 复合组织', notes: [] };
    var warpCells = 0, p, e;
    for (p = 0; p < h; p++) for (e = 0; e < w; e++) warpCells += tile[p][e];
    res.warpCells = warpCells;
    res.warpRatio = (w * h) ? warpCells / (w * h) : 0;

    if (warpCells === w * h) { res.kind = 'solid-warp'; res.label = '全经面（经线全部浮于表面）'; return res; }
    if (warpCells === 0) { res.kind = 'solid-weft'; res.label = '全纬面（纬线全部浮于表面）'; return res; }

    /* --- 1. 规则组织：每纬恰好一段经浮，段长恒定，位移恒定 --- */
    var rowRuns = [];
    for (p = 0; p < h; p++) rowRuns.push(cyclicRuns(tile[p], 1));
    var regular = true;
    for (p = 0; p < h; p++) {
      if (rowRuns[p].length !== 1 || rowRuns[p][0].len !== rowRuns[0][0].len) { regular = false; break; }
    }
    if (regular) {
      var k = rowRuns[0][0].len;
      var shifts = [];
      for (p = 0; p < h; p++) shifts.push(mod(rowRuns[mod(p + 1, h)][0].start - rowRuns[p][0].start, w));
      var step = shifts[0], same = true;
      for (var si = 1; si < shifts.length; si++) if (shifts[si] !== step) { same = false; break; }
      if (same && w === h) {
        res.regular = { repeat: w, warpFloat: k, step: step };
        if (w === 2 && k === 1) { res.kind = 'plain'; res.label = '平纹'; return res; }
        var isSatin = (k === 1 || k === w - 1) && step !== 1 && step !== w - 1 && gcd(step, w) === 1 && w >= 4;
        if (isSatin) {
          res.kind = 'satin';
          res.label = (k === 1 ? '纬面缎纹 sateen' : '经面缎纹 satin') + ' · ' + w + ' 枚 · 飞数 ' + step;
          res.notes.push(k === 1 ? '每纬只有 1 根经线浮起，纬纱占表面' : '每纬有 ' + k + ' 根经线浮起，经纱占表面');
          return res;
        }
        res.kind = 'twill';
        var dir = (step === w - 1) ? -1 : step;
        res.label = k + '/' + (w - k) + ' 斜纹 · ' + w + ' 枚';
        res.twillDir = dir;
        res.notes.push('每纬右移 ' + dir + ' 列（' + (dir > 0 ? '↘ 右下斜' : '↖ 左下斜') + '）');
        return res;
      }
    }

    /* --- 2. 方块棋盘：平纹 / 方平 / 重平 / 格纹 的统一形式 --- */
    /* 方块尺寸不会超过 16 根纱线；限制候选可以避免病态用例下退化成 O(w*h*候选数) */
    var dxs = divisors(w).filter(function (d) { return d <= 16; });
    var dys = divisors(h).filter(function (d) { return d <= 16; });
    for (var ai = 0; ai < dxs.length; ai++) {
      for (var bi = 0; bi < dys.length; bi++) {
        var a = dxs[ai], b = dys[bi];
        if (!blockCheck(tile, a, b)) continue;
        res.block = { a: a, b: b };
        if (a === 1 && b === 1) { res.kind = 'plain'; res.label = '平纹'; return res; }
        if (a === 2 && b === 2) { res.kind = 'basket'; res.label = '方平组织（2/2 方平）'; return res; }
        if (a === 1) { res.kind = 'stripe-v'; res.label = '纵条纹（每 ' + b + ' 纬翻转一次）'; return res; }
        if (b === 1) { res.kind = 'stripe-h'; res.label = '横条纹（每 ' + a + ' 经翻转一次）'; return res; }
        res.kind = 'check'; res.label = '格纹 · ' + a + ' × ' + b + ' 方块棋盘'; return res;
      }
    }

    /* --- 3. 全行 / 全列恒定：横条与纵条 --- */
    var rowsUniform = true, colsUniform = true;
    for (p = 0; p < h && rowsUniform; p++) {
      for (e = 1; e < w; e++) if (tile[p][e] !== tile[p][0]) { rowsUniform = false; break; }
    }
    for (e = 0; e < w && colsUniform; e++) {
      for (p = 1; p < h; p++) if (tile[p][e] !== tile[0][e]) { colsUniform = false; break; }
    }
    if (rowsUniform) { res.kind = 'stripe-h'; res.label = '横条纹（每一纬整体经面 / 纬面）'; return res; }
    if (colsUniform) { res.kind = 'stripe-v'; res.label = '纵条纹（每根经线恒定经面 / 纬面）'; return res; }

    /* --- 4. 人字 / 点斜纹：存在镜像轴，斜向在折返处反转 --- */
    /* 先做便宜的排除再算镜像轴：mirrorAxis 最坏是 O(w*h*w)，大循环单元上很贵 */
    if (w >= 4 && h >= 2 && res.warpRatio >= 0.3 && res.warpRatio <= 0.7) {
      var axis = mirrorAxis(tile);
      if (axis >= 0) {
        var lens = {}, thickRows = 0;
        for (p = 0; p < h; p++) {
          var rr = cyclicRuns(tile[p], 1), thick = false;
          for (var ri = 0; ri < rr.length; ri++) {
            lens[rr[ri].len] = 1;
            if (rr[ri].len >= 2) thick = true;
          }
          if (thick) thickRows++;
        }
        /* 斜纹型结构：浮长有粗细变化，且多数纬都有 >= 2 的经浮 */
        if (Object.keys(lens).length >= 2 && thickRows * 2 >= h) {
          res.kind = 'herringbone';
          res.label = '点斜纹 / 人字纹（斜向在折返处反转）';
          res.notes.push('镜像轴在第 ' + (axis + 1) + ' 根经线处，折返点浮长会合并变长');
          return res;
        }
      }
    }

    res.notes.push('没有匹配到规则组织，可能是有意为之的提花图案');
    return res;
  }

  /* 与纹样库比对（允许循环平移） */
  function matchLibrary(tile, library) {
    if (!library || !library.length) return null;
    var h = tile.length, w = tile[0].length;
    for (var i = 0; i < library.length; i++) {
      var entry = library[i], t = entry.tile;
      if (!t || t.length !== h || t[0].length !== w) continue;
      for (var dy = 0; dy < h; dy++) {
        for (var dx = 0; dx < w; dx++) {
          var ok = true;
          for (var p = 0; p < h && ok; p++) {
            for (var e = 0; e < w; e++) {
              if (tile[p][e] !== t[mod(p + dy, h)][mod(e + dx, w)]) { ok = false; break; }
            }
          }
          if (ok) return { name: entry.name, dx: dx, dy: dy };
        }
      }
    }
    return null;
  }

  /* ================= 织物规格（纺织工程计算） ================= */
  /* 纱线直径（mm）：由 tex 与纤维密度推导
   *   横截面积 A(mm²) = tex / (rho * 1000)，d = sqrt(4A/pi) = 0.03568 * sqrt(tex / rho)
   *   棉 rho ≈ 1.5 g/cm³，羊毛 ≈ 1.32，涤纶 ≈ 1.38 */
  function yarnDiameter(tex, rho) {
    if (!(tex > 0)) return 0;
    return 0.03568 * Math.sqrt(tex / (rho > 0 ? rho : 1.5));
  }

  function fabricSpec(o) {
    o = o || {};
    var epc = num(o.endsPerCm, 0), ppc = num(o.picksPerCm, 0);
    var tw = num(o.warpTex, 0), tf = num(o.weftTex, 0);
    var rho = num(o.density, 1.5);
    /* 1 tex = 每 1000 米 1 克；每厘米 n 根 → 每平方米质量 = n * 100 * tex / 1000 */
    var gsm = (epc * tw + ppc * tf) / 10;
    var dw = yarnDiameter(tw, rho), df = yarnDiameter(tf, rho);
    /* 单方向覆盖：每厘米排布 n 根直径 d(mm) 的纱 → 遮住 n*d/10 的比例 */
    var coverWarp = Math.min(1, epc * dw / 10);
    var coverWeft = Math.min(1, ppc * df / 10);
    /* 两个方向互相独立地遮挡，合成覆盖率 */
    var cover = 1 - (1 - coverWarp) * (1 - coverWeft);
    return {
      gsm: gsm,
      cover: cover,
      coverWarp: coverWarp,
      coverWeft: coverWeft,
      warpDia: dw,
      weftDia: df,
      fiberDensity: rho,
      endsPerM: epc * 100,
      picksPerM: ppc * 100,
      densityRatio: epc ? ppc / epc : 0,
      yarnPerM2: gsm
    };
  }

  /* ================= 总分析 ================= */
  function analyze(draft, opts) {
    opts = opts || {};
    var m = drawdown(draft);
    var rep = repeatOf(m);
    var tile = tileOf(m, rep.w, rep.h);
    var floats = floatStats(m);
    var inter = interlacement(m);
    var cls = classify(tile);
    var lib = matchLibrary(tile, opts.library);
    var warns = [];

    if (floats.hiddenEnds.length) warns.push('有 ' + floats.hiddenEnds.length + ' 根经线在整个循环里从未浮到表面（全浮经线）');
    if (floats.hiddenPicks.length) warns.push('有 ' + floats.hiddenPicks.length + ' 纬在整个循环里从未浮到表面（全浮纬线）');
    if (floats.maxFloat > 5) warns.push('最长浮长 ' + floats.maxFloat + '，超过 5 容易勾丝、起毛');
    else if (floats.maxFloat > 3) warns.push('最长浮长 ' + floats.maxFloat + '，日常衣着织物偏长');
    if (inter.ends.min === 0) warns.push('存在完全不交织的经线');
    if (inter.picks.min === 0) warns.push('存在完全不交织的纬线');
    if (cls.warpRatio > 0.62) warns.push('经面比例 ' + Math.round(cls.warpRatio * 100) + '%，织物明显偏经面');
    if (cls.warpRatio < 0.38) warns.push('经面比例 ' + Math.round(cls.warpRatio * 100) + '%，织物明显偏纬面');

    return {
      draft: draft,
      matrix: m,
      repeat: rep,
      tile: tile,
      classify: cls,
      libraryMatch: lib,
      floats: floats,
      interlacement: inter,
      warnings: warns
    };
  }

  var api = {
    WARP: WARP, WEFT: WEFT,
    zeros: zeros, gcd: gcd, mod: mod,
    cyclicRuns: cyclicRuns, divisors: divisors,
    build: build, liftPlan: liftPlan, drawdown: drawdown,
    repeatOf: repeatOf, tileOf: tileOf,
    floatStats: floatStats, interlacement: interlacement,
    classify: classify, matchLibrary: matchLibrary,
    mirrorAxis: mirrorAxis,
    yarnDiameter: yarnDiameter, fabricSpec: fabricSpec, analyze: analyze
  };

  root.Loom = root.Loom || {};
  root.Loom.weave = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
