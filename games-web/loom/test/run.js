'use strict';
/* LOOM · 零依赖单元测试：node test/run.js */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SH = path.join(ROOT, 'js', 'shared');
function load(n) { return require(path.join(SH, n)); }

const W = load('weave.js');
const D = load('dsl.js');
const P = load('patterns.js');
const Y = load('yarn.js');

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.log('  ✗ ' + msg); } }
function eq(a, b, msg) { ok(a === b, (msg || '') + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function near(a, b, tol, msg) { tol = tol == null ? 1e-9 : tol; ok(Math.abs(a - b) <= tol, (msg || '') + ' (got ' + a + ', want ' + b + ')'); }
function section(n) { console.log('\n== ' + n + ' =='); }
function matStr(m) { return m.map(function (r) { return Array.prototype.join.call(r, ''); }).join('/'); }
function expectMat(m, want, msg) { eq(matStr(m), want, msg); }
function parseDsl(text) {
  const p = D.parse(text);
  if (p.errors.length) throw new Error('DSL 错误: ' + JSON.stringify(p.errors));
  const b = W.build(p.spec);
  if (b.errors.length) throw new Error('构建错误: ' + JSON.stringify(b.errors));
  return b.draft;
}

/* ---------- 基础工具 ---------- */
section('基础工具：循环串 / 数论');
{
  eq(matStr([W.cyclicRuns([1,1,0,0],1).map(function(r){return r.start+':'+r.len;})]), '0:2', '单段');
  eq(W.cyclicRuns([0,0,0],1).length, 0, '没有该值时返回空');
  eq(W.cyclicRuns([1,1,1],1)[0].len, 3, '整行同值时返回整段');
  const wrap = W.cyclicRuns([1,0,0,1],1);
  eq(wrap.length, 1, '首尾相接的浮长合并为一段');
  eq(wrap[0].start + ',' + wrap[0].len, '3,2', '环绕段起点与长度');
  eq(W.cyclicRuns([1,0,1,0],1).length, 2, '两个独立浮长段');
  eq(W.gcd(12,18), 6, 'gcd');
  eq(W.gcd(3,8), 1, 'gcd 互质');
  eq(W.mod(-1,5), 4, 'mod 负值');
  eq(W.divisors(8).join(','), '1,2,4,8', '约数');
}

/* ---------- 平纹 ---------- */
section('平纹：2×2 织物矩阵');
{
  const d = parseDsl([
    'warp 8 / weft 8', 'shafts 2 / treadles 2',
    'threading 1 2', 'tieup', '  1: 1', '  2: 2', 'treadling 1 2'
  ].join('\n'));
  const m = W.drawdown(d);
  const rep = W.repeatOf(m);
  expectMat(W.tileOf(m, rep.w, rep.h), '10/01', '平纹 2×2 循环');
  eq(rep.w + 'x' + rep.h, '2x2', '平纹最小循环');
  const f = W.floatStats(m);
  eq(f.maxFloat, 1, '平纹最大浮长 1');
  const it = W.interlacement(m);
  eq(it.ends.mean, 4, '平纹每根经线交织 4 次（8 纬）');
  const c = W.classify(W.tileOf(m, rep.w, rep.h));
  eq(c.kind, 'plain', '平纹识别');
  near(c.warpRatio, 0.5, 1e-9, '平纹经纬平衡');
}

/* ---------- 2/2 斜纹 ---------- */
section('2/2 斜纹');
{
  const d = parseDsl([
    'warp 8 / weft 8', 'shafts 4 / treadles 4',
    'threading 1 2 3 4',
    'tieup', '  1: 1 2', '  2: 2 3', '  3: 3 4', '  4: 4 1',
    'treadling 1 2 3 4'
  ].join('\n'));
  const m = W.drawdown(d);
  const rep = W.repeatOf(m);
  expectMat(W.tileOf(m, rep.w, rep.h), '1100/0110/0011/1001', '2/2 斜纹 4×4 循环');
  eq(rep.w + 'x' + rep.h, '4x4', '斜纹最小循环');
  const c = W.classify(W.tileOf(m, rep.w, rep.h));
  eq(c.kind, 'twill', '斜纹识别');
  eq(c.regular.warpFloat, 2, '斜纹经浮长 2');
  eq(c.regular.step, 1, '斜纹飞数 1');
  eq(W.floatStats(m).maxFloat, 2, '斜纹最大浮长 2');
}

/* ---------- 缎纹 ---------- */
section('缎纹');
{
  const satin = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'satin5'; })[0].dsl);
  const ms = W.drawdown(satin);
  const repS = W.repeatOf(ms);
  eq(repS.w + 'x' + repS.h, '5x5', '5 枚缎纹最小循环');
  const cs = W.classify(W.tileOf(ms, repS.w, repS.h));
  eq(cs.kind, 'satin', '缎纹识别');
  eq(cs.regular.step, 2, '缎纹飞数 2');
  const fs = W.floatStats(ms);
  eq(fs.warp.max, 4, '经面缎纹经浮长 4');
  eq(fs.weft.max, 1, '经面缎纹纬浮长 1');

  const sateen = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'sateen5'; })[0].dsl);
  const mt = W.drawdown(sateen);
  const ct = W.classify(W.tileOf(mt, 5, 5));
  eq(ct.kind, 'satin', '纬面缎纹识别');
  eq(ct.regular.warpFloat, 1, '纬面缎纹经浮长 1');

  const s8 = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'satin8'; })[0].dsl);
  const m8 = W.drawdown(s8);
  const c8 = W.classify(W.tileOf(m8, 8, 8));
  eq(c8.kind, 'satin', '8 枚缎纹识别');
  eq(c8.regular.step, 3, '8 枚缎纹飞数 3');
}

/* ---------- 方平 / 重平 / 条纹 ---------- */
section('方平与条纹');
{
  const d = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'basket'; })[0].dsl);
  const m = W.drawdown(d);
  const c = W.classify(W.tileOf(m, 4, 4));
  eq(c.kind, 'basket', '方平组织识别');

  const sv = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'stripev'; })[0].dsl);
  const mv = W.drawdown(sv);
  const rep = W.repeatOf(mv);
  const cv = W.classify(W.tileOf(mv, rep.w, rep.h));
  eq(cv.kind, 'stripe-v', '纵条纹识别');
  eq(rep.w, 2, '纵条纹经向循环 2');

  const rib = W.build({ warpCount: 4, weftCount: 2, shaftCount: 2, treadleCount: 2,
    threading: [0,0,1,1], tieup: [[0],[1]], treadling: [0,1] }).draft;
  const mr = W.drawdown(rib);
  expectMat(mr, '1100/0011', '重平组织矩阵');
  const cr = W.classify(W.tileOf(mr, 4, 2));
  eq(cr.kind, 'stripe-h', '重平组织识别为横条纹');
}

/* ---------- 点斜纹 / 人字纹 ---------- */
section('点斜纹（人字）');
{
  const d = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'pointed'; })[0].dsl);
  const m = W.drawdown(d);
  const rep = W.repeatOf(m);
  eq(rep.w + 'x' + rep.h, '6x6', '点斜纹最小循环 6×6');
  const tile = W.tileOf(m, rep.w, rep.h);
  eq(W.mirrorAxis(tile), 0, '点斜纹存在镜像轴');
  const c = W.classify(tile);
  eq(c.kind, 'herringbone', '人字纹识别');
  // 斜纹本身不应被误判为人字纹
  const tw = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'twill22'; })[0].dsl);
  const twTile = W.tileOf(W.drawdown(tw), 4, 4);
  eq(W.mirrorAxis(twTile), -1, '斜纹没有镜像轴');
  eq(W.classify(twTile).kind, 'twill', '斜纹不被误判');
}

/* ---------- 提花 / 位图 ---------- */
section('提花与位图');
{
  const d = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'motif'; })[0].dsl);
  eq(d.warpCount, 12, '提花经线数');
  eq(d.weftCount, 12, '提花纬线数');
  const m = W.drawdown(d);
  eq(m[5][1], 1, '菱格左腰抬起');
  eq(m[5][0], 0, '菱格左侧留白');
  eq(m[0][0], 0, '菱格角落不抬起');
  eq(m[1][5], 1, '菱格顶部抬起');
  const c = W.classify(W.tileOf(m, 12, 12));
  eq(c.kind, 'irregular', '提花图案归为不规则 / 复合组织');
}

/* ---------- DSL ---------- */
section('织造程序语言');
{
  const p = D.parse([
    '# 注释行',
    'title 测试布',
    'warp 8 / weft 4',
    'shafts 4 / treadles 4',
    'threading 1 2 3 4',
    'tieup 1 2 | 2 3 | 3 4 | 4 1',
    'treadling 1-4',
    'warp-yarn #AbC',
    'weft-yarn 茜红'
  ].join('\n'));
  eq(p.errors.length, 0, '合法程序没有错误');
  eq(p.spec.title, '测试布', '标题');
  eq(p.spec.warpCount + 'x' + p.spec.weftCount, '8x4', '经纬数');
  eq(p.spec.threading.join(','), '0,1,2,3', '穿综转 0 基');
  eq(p.spec.tieup.length, 4, '提综行数');
  eq(p.spec.tieup[0].join(','), '0,1', '提综内容');
  eq(p.spec.treadling.join(','), '0,1,2,3', '范围写法 1-4');
  eq(p.spec.warpYarn, '#AbC', '颜色原样保留');
  eq(Y.normalizeColor(p.spec.warpYarn), '#aabbcc', '三位色号展开');
  eq(Y.normalizeColor('茜红'), '#c94f3d', '中文色名');

  eq(D.parse('warp abc').errors.length >= 1, true, '非整数报错');
  eq(D.parse('foo 1 2').errors.length >= 1, true, '未知指令报错');
  eq(D.parse('threading 1 2').errors.length >= 1, true, '缺少提综报错');
  const bad = D.parse(['warp 4 / weft 4', 'shafts 2 / treadles 1', 'threading 1 2 9', 'tieup', '  1: 1', 'treadling 1'].join('\n'));
  const badBuild = W.build(bad.spec);
  eq(badBuild.errors.length >= 1, true, '越界综框报错');

  const seq = D.parseNumbers('1-3 5');
  eq(seq.values.join(','), '1,2,3,5', '范围 + 单值');
  eq(D.parseNumbers('1 2 3').values.length, 3, '空格分隔');
  eq(D.parseNumbers('-').values.length, 0, '空提花行');
}

/* ---------- 序列化往返 ---------- */
section('序列化往返');
{
  const d = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'motif'; })[0].dsl);
  const text = D.serialize(d);
  const again = parseDsl(text);
  expectMat(W.drawdown(again), matStr(W.drawdown(d)), '序列化后织物一致');
  eq(text.indexOf('liftplan') >= 0, true, '序列化输出 liftplan');
}

/* ---------- 纹样库全量 ---------- */
section('纹样库');
{
  const expectKind = {
    plain: 'plain', basket: 'basket', twill22: 'twill', twill13: 'twill', twill31: 'twill',
    pointed: 'herringbone', satin5: 'satin', sateen5: 'satin', satin8: 'satin',
    stripev: 'stripe-v', motif: 'irregular', plain2: 'plain'
  };
  eq(P.LIBRARY.length, 12, '纹样库条目数');
  const tiles = P.tiles();
  eq(tiles.length, 12, '所有纹样都能解析');
  for (const id in expectKind) {
    const entry = P.LIBRARY.filter(function (p) { return p.id === id; })[0];
    ok(!!entry, '存在纹样 ' + id);
    const d = parseDsl(entry.dsl);
    const m = W.drawdown(d);
    const rep = W.repeatOf(m);
    const c = W.classify(W.tileOf(m, rep.w, rep.h));
    eq(c.kind, expectKind[id], id + ' 的组织识别');
  }
  // 库比对：斜纹的循环单元能被识别回库
  const tw = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'twill22'; })[0].dsl);
  const twTile = W.tileOf(W.drawdown(tw), 4, 4);
  const hit = W.matchLibrary(twTile, tiles);
  ok(hit && hit.name === '2/2 斜纹', '库比对命中 2/2 斜纹');
  // 库比对允许平移：把循环单元整体平移后仍应命中
  const shifted = [];
  for (let p = 0; p < 4; p++) { const row = new Uint8Array(4); for (let e = 0; e < 4; e++) row[e] = twTile[(p + 1) % 4][(e + 2) % 4]; shifted.push(row); }
  const hit2 = W.matchLibrary(shifted, tiles);
  ok(hit2 && hit2.name === '2/2 斜纹', '库比对平移不变');
}

/* ---------- 织物规格 ---------- */
section('织物规格计算');
{
  const s = W.fabricSpec({ endsPerCm: 20, picksPerCm: 20, warpTex: 20, weftTex: 20 });
  near(s.gsm, 80, 1e-9, '克重 20×20 经 + 20×20 纬 = 80 g/m²');
  near(s.endsPerM, 2000, 1e-9, '每米经纱根数');
  near(s.densityRatio, 1, 1e-9, '经纬密度比');
  /* 纱线直径 d(mm) = 0.03568 * sqrt(tex / rho)，棉 rho = 1.5 */
  near(W.yarnDiameter(20, 1.5), 0.03568 * Math.sqrt(20 / 1.5), 1e-9, '纱线直径公式');
  ok(W.yarnDiameter(20, 1.5) > 0.12 && W.yarnDiameter(20, 1.5) < 0.14, '20 tex 棉纱直径约 0.13 mm');
  const cw = Math.min(1, 20 * W.yarnDiameter(20, 1.5) / 10);
  near(s.coverWarp, cw, 1e-9, '经向覆盖率');
  near(s.cover, 1 - (1 - cw) * (1 - cw), 1e-9, '两向合成覆盖率');
  ok(s.cover > 0 && s.cover <= 1, '覆盖率落在 0–1 之间');
  const dense = W.fabricSpec({ endsPerCm: 60, picksPerCm: 60, warpTex: 20, weftTex: 20 });
  ok(dense.cover > s.cover, '密度越高覆盖率越大');
  const s2 = W.fabricSpec({ endsPerCm: 40, picksPerCm: 30, warpTex: 15, weftTex: 25 });
  near(s2.gsm, (40 * 15 + 30 * 25) / 10, 1e-9, '非对称克重');
  const thick = W.fabricSpec({ endsPerCm: 20, picksPerCm: 20, warpTex: 20, weftTex: 40 });
  ok(thick.coverWeft > thick.coverWarp, '同密度下纬纱更粗 → 纬向覆盖率更高');
}

/* ---------- 分析面板 ---------- */
section('总分析');
{
  const d = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'satin8'; })[0].dsl);
  const a = W.analyze(d, { library: P.tiles() });
  eq(a.repeat.w, 8, '分析得到循环宽');
  ok(a.warnings.some(function (w) { return w.indexOf('浮长') >= 0; }), '长浮长给出警告');
  eq(a.libraryMatch && a.libraryMatch.name, '8 枚经面缎纹', '分析面板命中纹样库');

  const allWarp = W.build({ warpCount: 4, weftCount: 4, liftplan: [[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]] }).draft;
  const a2 = W.analyze(allWarp);
  eq(a2.classify.kind, 'solid-warp', '全经面识别');
  ok(a2.warnings.some(function (w) { return w.indexOf('全浮') >= 0; }), '全浮给出警告');
}

/* ---------- 性能护栏 ---------- */
section('性能护栏');
{
  /* 病态用例：几乎全经面的大循环单元。
   * 早期版本的镜像轴检测会退化成 O(w*h*w)，256×256 要 300ms 以上。 */
  const n = 256, lp = [];
  for (let p = 0; p < n; p++) lp.push(new Uint8Array(n).fill(1));
  lp[n - 1][n - 1] = 0;
  const d = W.build({ liftplan: lp }).draft;
  const t0 = Date.now();
  const a = W.analyze(d);
  const ms = Date.now() - t0;
  ok(ms < 1500, '256×256 病态织物分析在 1.5s 内完成（实测 ' + ms + 'ms）');
  eq(a.classify.kind, 'irregular', '病态织物仍被正确归为不规则组织');
  eq(a.repeat.w, 256, '大循环单元仍被正确识别');

  /* 方块候选被限制在 16 以内：不应在超大循环单元上线性放大开销 */
  const big = [];
  for (let p = 0; p < 64; p++) {
    const row = new Uint8Array(64);
    for (let e = 0; e < 64; e++) row[e] = ((Math.floor(p / 32) + Math.floor(e / 32)) % 2 === 0) ? 1 : 0;
    big.push(row);
  }
  const t1 = Date.now();
  W.classify(big);
  ok(Date.now() - t1 < 500, '64×64 方块棋盘的组织识别不超时');
}

/* ---------- 渲染：软件光栅化验证 ---------- */
section('渲染：把织物真的画出来再验像素');
{
  const RP = require(path.join(ROOT, 'tools', 'render-png.js'));
  const d = parseDsl(P.LIBRARY.filter(function (p) { return p.id === 'twill22'; })[0].dsl);
  const m = W.drawdown(d);
  const cs = 10, pad = 18;
  const r = RP.renderMatrix(m, { cellSize: cs, pad, warpColor: d.warpYarn, weftColor: d.weftYarn });
  eq(r.width, m[0].length * cs + pad * 2, '画布宽度 = 织物宽 × 格边长 + 边距');
  eq(r.height, m.length * cs + pad * 2, '画布高度');

  function dist(a, b) { return Math.sqrt((a[0]-b[0])*(a[0]-b[0]) + (a[1]-b[1])*(a[1]-b[1]) + (a[2]-b[2])*(a[2]-b[2])); }
  function px(rr, x, y) { const i = (y * rr.width + x) * 4; return [rr.ctx.buf[i], rr.ctx.buf[i+1], rr.ctx.buf[i+2]]; }

  const warpRef = Y.toRgb(Y.shade(d.warpYarn, 0.2));
  const weftRef = Y.toRgb(Y.shade(d.weftYarn, 0.2));
  let good = 0, total = 0;
  for (let p = 0; p < m.length; p++) {
    for (let e = 0; e < m[p].length; e++) {
      const c = px(r, pad + e * cs + 5, pad + p * cs + 5);
      const isWarp = dist(c, warpRef) < dist(c, weftRef);
      total++;
      if (isWarp === !!m[p][e]) good++;
    }
  }
  ok(good / total >= 0.97, '写实渲染：格心像素颜色与织物矩阵一致（' + good + '/' + total + '）');

  /* 组织图模式是平涂，应当逐点精确等于纱线颜色 */
  const r2 = RP.renderMatrix(m, { cellSize: 8, pad: 0, mode: 'drawdown', warpColor: d.warpYarn, weftColor: d.weftYarn });
  let exact = 0, exTotal = 0;
  const warpExact = Y.toRgb(Y.normalizeColor(d.warpYarn));
  for (let p = 0; p < m.length; p++) {
    for (let e = 0; e < m[p].length; e++) {
      if (!m[p][e]) continue;
      const c = px(r2, e * 8 + 4, p * 8 + 4);
      exTotal++;
      if (dist(c, warpExact) < 1) exact++;
    }
  }
  eq(exact, exTotal, '组织图：所有经浮点都是纯经纱色');

  /* PNG 编码：签名 + IDAT 可解压且长度正确 */
  const png = RP.encodePng(r.width, r.height, r.ctx.buf);
  eq(png.slice(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG 签名正确');
  const idatLen = (function () {
    let off = 8;
    while (off < png.length) {
      const len = png.readUInt32BE(off);
      const type = png.slice(off + 4, off + 8).toString('ascii');
      if (type === 'IDAT') return len;
      off += 12 + len;
    }
    return -1;
  })();
  ok(idatLen > 0, 'PNG 含 IDAT 数据块');

  /* 打孔卡片 / 织造图：在同一个迷你上下文里跑通并留下痕迹 */
  const PC = require(path.join(ROOT, 'js', 'punchcards.js'));
  const DV = require(path.join(ROOT, 'js', 'draftview.js'));
  const cardCtx = new RP.MiniCtx(900, 200, '#14100c');
  PC.draw(cardCtx, m, { width: 900, height: 200, current: 3 });
  let cardInk = 0;
  for (let i = 0; i < cardCtx.buf.length; i += 4) if (cardCtx.buf[i] > 150) cardInk++;
  ok(cardInk > 500, '打孔卡片链渲染出卡片（亮像素 ' + cardInk + '）');

  const draftCtx = new RP.MiniCtx(420, 420, '#17120d');
  DV.draw(draftCtx, d, { width: 420, height: 420 });
  let draftInk = 0;
  for (let i = 0; i < draftCtx.buf.length; i += 4) if (draftCtx.buf[i] > 150) draftInk++;
  ok(draftInk > 200, '织造图渲染出符号（亮像素 ' + draftInk + '）');
}

console.log('\n' + (failed ? '✗ ' : '✓ ') + passed + ' 项通过，' + failed + ' 项失败');
process.exit(failed ? 1 : 0);
