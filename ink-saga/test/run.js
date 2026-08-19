// 墨战 · 天书纪 — 单元测试（零依赖，node test/run.js）
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

// ---------- 最小浏览器环境 stub ----------
function makeCanvasCtx() {
  const W = 64, H = 64;
  const data = new Uint8ClampedArray(W * H * 4);
  return {
    canvas: { width: W, height: H, clientWidth: 400, clientHeight: 300 },
    clearRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {},
    arc() {}, fill() {}, fillRect() {}, strokeRect() {},
    quadraticCurveTo() {},
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    setLineDash() {}, fillText() {}, strokeText() {},
    measureText(t) { return { width: String(t).length * 20 }; },
    setTransform() {},
    getImageData() { return { data }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    lineWidth: 1, strokeStyle: '', fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1
  };
}
global.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      return { width: 64, height: 64, getContext: () => makeCanvasCtx(), getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    }
    return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} };
  },
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => []
};
global.window = global;
global.performance = global.performance || { now: () => Date.now() };
global.fetch = global.fetch || (() => Promise.resolve({ json: () => Promise.resolve({}), ok: false }));

// ---------- 加载模块 ----------
function load(file) {
  const code = fs.readFileSync(path.join(PUB, file), 'utf-8');
  const fn = new Function('window', 'document', 'performance', 'fetch', code + ";\nreturn window;");
  return fn(global, global.document, global.performance, global.fetch);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + ' → ' + e.message); }
}

console.log('墨战 · 天书纪 单元测试');
console.log('==============================');

// 1) 数据完整性
load('js/data/dictionary.js');
load('js/data/words.js');
load('js/data/story.js');

test('词库：字典含 250+ 字', () => {
  assert.ok(global.INK_DICT.length >= 250, 'dict=' + global.INK_DICT.length);
});
test('词库：每字都有拼音/释义/分类/元素（覆盖全部）', () => {
  for (const c of global.INK_DICT) {
    assert.ok(c.pinyin && c.meaning && c.cat && c.el, 'bad: ' + c.ch);
  }
});
test('词库：双字词 100+，成语 70+，诗词 15+', () => {
  assert.ok(global.INK_WORDS.words2.length >= 100, 'w2=' + global.INK_WORDS.words2.length);
  assert.ok(global.INK_WORDS.idioms.length >= 70, 'id=' + global.INK_WORDS.idioms.length);
  assert.ok(global.INK_WORDS.poems && global.INK_WORDS.poems.length >= 15, 'poems=' + (global.INK_WORDS.poems || []).length);
});
test('词库：无重复字', () => {
  const s = new Set(global.INK_DICT.map(c => c.ch));
  assert.strictEqual(s.size, global.INK_DICT.length);
});
test('词库：每字都有拼音/释义/分类/元素', () => {
  for (const c of global.INK_DICT) {
    assert.ok(c.pinyin && c.meaning && c.cat && c.el, 'bad: ' + c.ch);
  }
});
test('词库：双字词 30+，成语 20+', () => {
  assert.ok(global.INK_WORDS.words2.length >= 30, 'w2=' + global.INK_WORDS.words2.length);
  assert.ok(global.INK_WORDS.idioms.length >= 20, 'id=' + global.INK_WORDS.idioms.length);
});
test('剧情：章节 ≥ 10（含分支），结局 ≥ 5', () => {
  assert.ok(global.INK_STORY.chapters.length >= 10, 'chapters=' + global.INK_STORY.chapters.length);
  assert.ok(Object.keys(global.INK_STORY.endings).length >= 5, 'endings=' + Object.keys(global.INK_STORY.endings).length);
});
test('剧情：每个选择都指向存在的章节或结局', () => {
  const ids = new Set(global.INK_STORY.chapters.map(c => c.id));
  for (const ch of global.INK_STORY.chapters) {
    if (ch.choice) for (const o of ch.choice.options) {
      if (o.next && !ids.has(o.next) && !String(o.next).startsWith('END_')) assert.fail(ch.id + ' → ' + o.next);
      if (o.ending) assert.ok(global.INK_STORY.endings[o.ending], 'ending missing: ' + o.ending);
    }
  }
});

// 2) 识别引擎纯函数
load('js/core/input.js');
load('js/core/recognition.js');
const R = global.INK_RECOGNITION;

test('normalizePoints：归一化到 64 画布内', () => {
  const pts = [{x: 0, y: 0}, {x: 100, y: 0}, {x: 100, y: 100}, {x: 0, y: 100}];
  const n = R.normalizePoints(pts);
  assert.ok(n, 'should not be null');
  for (const p of n) { assert.ok(p.x >= 0 && p.x <= 64 && p.y >= 0 && p.y <= 64); }
});
test('normalizePoints：太短的笔画返回 null', () => {
  assert.strictEqual(R.normalizePoints([{x:1,y:1},{x:2,y:1},{x:2,y:2}]), null);
});
test('iou：完全重合为 1，完全不重合为 0', () => {
  const a = new Uint8Array(64 * 64), b = new Uint8Array(64 * 64);
  a[0] = 1; b[0] = 1;
  assert.strictEqual(R.iou(a, b), 1);
  b[1] = 1; // a∩b=1, a∪b=2 → 0.5
  assert.strictEqual(R.iou(a, b), 0.5);
  const c = new Uint8Array(64 * 64); c[100] = 1;
  assert.strictEqual(R.iou(a, c), 0);
});
test('chainHist：方向直方图归一化', () => {
  const h = R.chainHist([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]);
  const sum = h.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'sum=' + sum);
  assert.strictEqual(h.length, 8);
});
test('cosine：相同向量为 1', () => {
  assert.ok(Math.abs(R.cosine([1,0,0,0,0,0,0,0], [1,0,0,0,0,0,0,0]) - 1) < 1e-9);
  assert.strictEqual(R.cosine([1,0,0,0,0,0,0,0], [0,1,0,0,0,0,0,0]), 0);
});
test('recognize：对候选返回降序得分', () => {
  // 手绘"十"字轨迹 → 应把「十」排最前（若候选包含）
  const pts = [];
  for (let x = 10; x <= 50; x += 3) pts.push({ x, y: 30 });
  for (let y = 10; y <= 50; y += 3) pts.push({ x: 30, y });
  const res = R.recognize(pts, ['十', '火', '水']);
  assert.ok(res.length === 3);
  assert.ok(res[0].score >= res[1].score && res[1].score >= res[2].score);
});

test('dilate：单像素膨胀为 3×3 块', () => {
  const img = new Uint8Array(64 * 64);
  img[32 * 64 + 32] = 1;
  const d = R.dilate(img);
  let count = 0;
  for (let y = 31; y <= 33; y++) for (let x = 31; x <= 33; x++) count += d[y * 64 + x];
  assert.strictEqual(count, 9);
  // 原图不被修改
  assert.strictEqual(img[32 * 64 + 32], 1);
});
test('aspectRatio：横线宽、竖线窄', () => {
  const img = new Uint8Array(64 * 64);
  for (let x = 10; x <= 50; x++) img[30 * 64 + x] = 1;
  assert.ok(R.aspectRatio(img) > 1.5);
  const img2 = new Uint8Array(64 * 64);
  for (let y = 10; y <= 50; y++) img2[y * 64 + 30] = 1;
  assert.ok(R.aspectRatio(img2) < 0.7);
});

// 3) 敌人 / 字诀
load('js/game/enemies.js');
load('js/game/spells.js');
test('敌人：九种模板齐全', () => {
  for (const t of ['mote', 'wrong', 'radical', 'word', 'idiom', 'mimic', 'inkchild', 'inkgen', 'pen', 'poem']) assert.ok(global.INK_ENEMIES.TEMPLATES[t], t);
});
test('Boss：六个模板齐全', () => {
  for (const b of ['idiom_beast', 'calligrapher', 'oracle', 'inkdragon', 'zhenzhi', 'luobi']) assert.ok(global.INK_ENEMIES.BOSS_TEMPLATES[b], b);
});
test('笔妖：带书写进度字段', () => {
  const { Enemy } = global.INK_ENEMIES;
  const e = new Enemy({ type: 'pen', target: { type: 'char', ch: '火' } });
  assert.ok(e.progress === 0 && e.progressRate > 0);
});
test('元素克制：火克木，木被火克', () => {
  assert.strictEqual(global.INK_SPELLS.elementMult('fire', 'wood'), 1.6);
  assert.strictEqual(global.INK_SPELLS.elementMult('wood', 'fire'), 0.6);
  assert.strictEqual(global.INK_SPELLS.elementMult('blade', 'dark'), 1);
});

test('敌人：精英变体（铁甲/诅咒/疾影）生效', () => {
  const { Enemy } = global.INK_ENEMIES;
  const armored = new Enemy({ type: 'wrong', target: { type: 'char', ch: '火' }, variant: 'armored' });
  assert.strictEqual(armored.armor, 1);
  assert.ok(armored.maxHp > 90, 'armored hp=' + armored.maxHp);
  const cursed = new Enemy({ type: 'wrong', target: { type: 'char', ch: '火' }, variant: 'cursed' });
  assert.strictEqual(cursed.cursed, true);
  const swift = new Enemy({ type: 'wrong', target: { type: 'char', ch: '火' }, variant: 'swift' });
  assert.ok(swift.r < 24, 'swift r=' + swift.r);
  const plain = new Enemy({ type: 'wrong', target: { type: 'char', ch: '火' } });
  assert.strictEqual(plain.armor, undefined);
});
test('敌人：词/成语目标的连写进度字段存在', () => {
  const { Enemy } = global.INK_ENEMIES;
  const e = new Enemy({ type: 'word', target: { type: 'word', chars: ['火', '海'] } });
  assert.strictEqual(e.needIdx, 0);
  assert.deepStrictEqual(e.targetTexts(), ['火', '海']);
});

test('敌人：墨傀模板与吸收字段', () => {
  const { TEMPLATES, Enemy } = global.INK_ENEMIES;
  assert.ok(TEMPLATES.mimic, 'mimic template missing');
  const m = new Enemy({ type: 'mimic', target: { type: 'char', ch: '火' } });
  assert.strictEqual(m.type, 'mimic');
  assert.strictEqual(m.target.ch, '火');
  assert.strictEqual(m.absorbed, undefined);
});

// 3.5) 种子随机与每日（先加载 battle 依赖模块）
load('js/core/brush.js');
load('js/game/battle.js');
test('mulberry32：同种子序列一致，异种子不同', () => {
  const { mulberry32 } = global.INK_BATTLE;
  const a = mulberry32(20250601), b = mulberry32(20250601);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB);
  const c = mulberry32(20250602);
  assert.notDeepStrictEqual(seqA, [c(), c(), c(), c()]);
});

// 3.75) 主题与存档注入
test('主题：每章节都有主题且字段完整', () => {
  load('js/data/themes.js');
  const { THEMES, themeOf } = global.INK_THEMES;
  assert.ok(THEMES.default && THEMES.finale && THEMES.endless);
  for (const [k, v] of Object.entries(THEMES)) {
    assert.ok(v.bg, k + ' missing bg');
    assert.ok(Array.isArray(v.scale) && v.scale.length >= 5, k + ' bad scale');
    assert.ok('dark' in v, k + ' missing dark');
  }
  assert.strictEqual(themeOf('prologue', 'story').bg, 'rain');
  assert.strictEqual(themeOf(null, 'endless').bg, 'rain');
  assert.strictEqual(themeOf('nope', 'story').bg, 'paper');
});
test('存档：_inject 覆盖当前状态', () => {
  load('js/save.js');
  const injected = global.INK_SAVE.defaultState();
  injected.name = '注入书生';
  injected.growth.qi = 777;
  global.INK_SAVE._inject(injected);
  const st = global.INK_SAVE.load();
  assert.strictEqual(st.name, '注入书生');
  assert.strictEqual(st.growth.qi, 777);
});

// 3.8) 装备系统
test('装备：生成/加成/合成', () => {
  load('js/game/equipment.js');
  const E = global.INK_EQUIP;
  const pen = E.makeItem('pen', 'green');
  assert.strictEqual(pen.slot, 'pen');
  assert.ok(pen.power > 0);
  assert.ok(E.RARITY_MAP[pen.rarity].mult === 1.4);
  const bonus = E.statBonus({ pen });
  assert.strictEqual(bonus.power, pen.power);
  // 合成：3 件凡品 → 良品
  const items = [E.makeItem('ink', 'white'), E.makeItem('ink', 'white'), E.makeItem('ink', 'white')];
  const r = E.craftUpgrade(items);
  assert.ok(r.ok, r.reason);
  assert.strictEqual(r.item.rarity, 'green');
  assert.strictEqual(r.consumed.length, 3);
  // 圣品无法再升
  const golds = [E.makeItem('pen', 'gold'), E.makeItem('pen', 'gold'), E.makeItem('pen', 'gold')];
  const r2 = E.craftUpgrade(golds);
  assert.strictEqual(r2.ok, false);
});

// 4) 成长
load('js/game/growth.js');
test('成长：新增连墨/破锐升级', () => {
  const st = { growth: { qi: 100000, levels: { power: 1, crit: 1, pool: 1, qi: 1, combo: 1, boss: 1 }, spendTotal: 0 } };
  const r = global.INK_GROWTH.buy(st, 'combo');
  assert.ok(r.ok);
  assert.strictEqual(st.growth.levels.combo, 2);
  global.INK_GROWTH.buy(st, 'boss');
  const sts = global.INK_GROWTH.statsOf(st);
  assert.ok(sts.comboWindow > 3.5);
  assert.ok(sts.bossMul > 1);
});
test('成长：费用随等级递增，满级不可买', () => {
  const st = { growth: { qi: 100000, levels: { power: 1, crit: 1, pool: 1, qi: 1 }, spendTotal: 0 } };
  const r1 = global.INK_GROWTH.buy(st, 'power');
  assert.ok(r1.ok);
  assert.strictEqual(st.growth.levels.power, 2);
  // 升到满级
  for (let i = 0; i < 20; i++) global.INK_GROWTH.buy(st, 'power');
  assert.strictEqual(st.growth.levels.power, 8);
  const r2 = global.INK_GROWTH.buy(st, 'power');
  assert.strictEqual(r2.ok, false);
});

// 5) 成就
load('js/game/achievements.js');
test('成就：总数 45+', () => {
  assert.ok(global.INK_ACHIEVEMENTS.ACHIEVEMENTS.length >= 45, 'ach=' + global.INK_ACHIEVEMENTS.ACHIEVEMENTS.length);
});
test('成就：首杀达成 / 连击 10', () => {
  const st = { achievements: [], stats: { totalKills: 1, maxComboEver: 5 } };
  global.INK_ACHIEVEMENTS.checkAll(st);
  assert.ok(st.achievements.includes('first_blood'));
  assert.ok(!st.achievements.includes('combo10'));
  st.stats.maxComboEver = 12;
  global.INK_ACHIEVEMENTS.checkAll(st);
  assert.ok(st.achievements.includes('combo10'));
});

// 5.5) 新成就
test('成就：新成就条件（练习/每日/全结局）', () => {
  const st = { achievements: [], stats: { practiceSessions: 50, dailyDone: 1, bestEndless: 35, maxComboEver: 60 }, story: { endings: ['hengmo', 'zhenmo', 'fenshu', 'guiyin', 'wenyin'] } };
  global.INK_ACHIEVEMENTS.checkAll(st);
  for (const id of ['practice50', 'daily1', 'endless30', 'combo50', 'endings_all']) {
    assert.ok(st.achievements.includes(id), 'missing ' + id);
  }
});

// 5.5) 新成就（疾书）
test('成就：挥毫疾书成就', () => {
  const st = { achievements: [], stats: { taBest: 350, taRuns: 12 }, story: {} };
  global.INK_ACHIEVEMENTS.checkAll(st);
  assert.ok(st.achievements.includes('ta300'));
  assert.ok(st.achievements.includes('taRuns10'));
});

// 5.75) 成就奖励
test('成就：达成自动发放文气奖励', () => {
  const st = { achievements: [], growth: { qi: 100, levels: { power: 1, crit: 1, pool: 1, qi: 1 } }, stats: { totalKills: 1, maxComboEver: 0 } };
  global.INK_ACHIEVEMENTS.checkAll(st);
  assert.ok(st.achievements.includes('first_blood'));
  assert.strictEqual(st.growth.qi, 130); // 100 + 30
  assert.strictEqual(global.INK_ACHIEVEMENTS.rewardOf('boss4'), 120);
  assert.strictEqual(global.INK_ACHIEVEMENTS.rewardOf('unknown_id'), 30);
});
test('成就：无 growth 的状态自动补全', () => {
  const st = { achievements: [], stats: { totalKills: 1 } };
  global.INK_ACHIEVEMENTS.checkAll(st);
  assert.ok(st.growth && st.growth.qi === 30);
});

// 6) 存档
load('js/save.js');
test('存档：默认状态完整', () => {
  const d = global.INK_SAVE.defaultState();
  assert.ok(d.growth.levels.power === 1);
  assert.ok(Array.isArray(d.achievements));
});

console.log('==============================');
console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed > 0 ? 1 : 0);
