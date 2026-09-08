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
      return {
        width: 64, height: 64, clientWidth: 400, clientHeight: 300,
        getContext: () => makeCanvasCtx(), getBoundingClientRect: () => ({ left: 0, top: 0 }),
        addEventListener() {}, removeEventListener() {}
      };
    }
    return { style: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} };
  },
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => []
};
global.window = global;
global.performance = global.performance || { now: () => Date.now() };
// 固定 fetch，避免测试里真的去请求 /api/*；同时保证 window.addEventListener 存在（Battle/Practice 会绑定 resize）
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({}), ok: false });
global.addEventListener = global.addEventListener || (() => {});
global.removeEventListener = global.removeEventListener || (() => {});

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


// ---------- 7) 新增：剧情结局 / 存档统计 / 装备 / 识别 / 服务器安全 ----------
load('js/game/storyflow.js');
load('js/core/audio.js');

test('剧情：结局总数为 5（含隐藏问天者）', () => {
  assert.strictEqual(Object.keys(global.INK_STORY.endings).length, 5);
  assert.ok(global.INK_STORY.endings.wenyin, 'wenyin missing');
});
test('剧情：问天路线才映射隐藏结局，其它路线不劫持承墨者', () => {
  const F = global.INK_STORYFLOW;
  assert.strictEqual(F.resolveEnding('hengmo', { wenyin: true }), 'wenyin');
  assert.strictEqual(F.resolveEnding('hengmo', { wenyin: false }), 'hengmo');
  assert.strictEqual(F.resolveEnding('zhenmo', { wenyin: true }), 'zhenmo');
});

test('存档：applyRun 写入击杀类型/词/成语/Boss/错字', () => {
  const S = global.INK_SAVE;
  S._inject(S.defaultState());
  S.applyRun({
    kills: 3, qiEarned: 20, written: 5, wrong: 1, maxCombo: 7, perfects: 2,
    killByType: { mote: 2, idiom: 1 }, charsUsed: { '火': 1, '龘': 1 },
    wordsUsed: ['火海'], idiomsUsed: ['火冒三丈'], bosses: ['idiom_beast'],
    misses: [{ ch: '火', count: 2 }]
  });
  const st = S.load();
  assert.strictEqual(st.stats.killMote, 2);
  assert.strictEqual(st.stats.killIdiom, 1);
  assert.deepStrictEqual(st.stats.bosses, ['idiom_beast']);
  assert.ok(st.gallery.words.includes('火海'));
  assert.ok(st.gallery.idioms.includes('火冒三丈'));
  assert.strictEqual(st.stats.wrongChars[0].count, 2);
  assert.strictEqual(st.growth.qi, 20);
});
test('存档：图鉴只收词库内的字，词/成语生僻字不撑爆 271 字图鉴', () => {
  const S = global.INK_SAVE;
  S._inject(S.defaultState());
  S.addGalleryChar('火');
  S.addGalleryChar('龘');
  assert.deepStrictEqual(S.load().gallery.chars, ['火']);
});

test('装备：uid 不再每次刷新从 1 开始，且能被存档同步抬高', () => {
  const E = global.INK_EQUIP;
  const a = E.makeItem('pen', 'white');
  assert.ok(a.uid > 1, 'uid=' + a.uid);
  E.syncUid({ pen: { uid: a.uid + 100 }, ink: null, paper: null, stone: null, inventory: [] });
  const b = E.makeItem('pen', 'white');
  assert.ok(b.uid > a.uid + 100, 'uid=' + b.uid);
});
test('装备：合成拒绝混槽位', () => {
  const E = global.INK_EQUIP;
  const r = E.craftUpgrade([E.makeItem('pen', 'white'), E.makeItem('ink', 'white'), E.makeItem('paper', 'white')]);
  assert.strictEqual(r.ok, false);
});

test('识别：symmetrize 把方向直方图对称化', () => {
  const h = global.INK_RECOGNITION.symmetrize([1, 0, 0, 0, 0, 0, 0, 0]);
  assert.strictEqual(h[0], 0.5);
  assert.strictEqual(h[4], 0.5);
});
test('识别：recognize 对候选去重', () => {
  const pts = [];
  for (let x = 10; x <= 50; x += 3) pts.push({ x, y: 30 });
  for (let y = 10; y <= 50; y += 3) pts.push({ x: 30, y });
  assert.strictEqual(global.INK_RECOGNITION.recognize(pts, ['火', '火', '水']).length, 2);
});

// ---------- 8) 服务器纯函数（安全 + 校验） ----------
const SRV = require(path.join(ROOT, 'server.js'));

test('服务器：safeFilename 阻断路径穿越与 Windows 保留名', () => {
  const f = SRV.safeFilename('../../server.js', 'fb');
  assert.ok(f !== '..' && f !== '.' && f.indexOf('/') < 0 && f.indexOf(String.fromCharCode(92)) < 0, 'f=' + f);
  assert.strictEqual(SRV.safeFilename('..', 'fb'), 'fb');
  assert.strictEqual(SRV.safeFilename('.', 'fb'), 'fb');
  assert.ok(SRV.safeFilename('CON', 'fb').indexOf('CON') !== 0);
  assert.strictEqual(SRV.safeFilename('汉字体检报告-1.html', 'fb'), '汉字体检报告-1.html');
});
test('服务器：sanitizeLeaderboardEntry 校验 mode/数值/名字/日期', () => {
  const e = SRV.sanitizeLeaderboardEntry({ name: '<b>x</b>', mode: 'hack', score: Infinity, chars: -1, date: '2025-01-01abc' });
  assert.strictEqual(e.mode, 'endless');
  assert.strictEqual(e.score, 0);
  assert.strictEqual(e.chars, 0);
  assert.ok(e.name.indexOf('<') < 0);
  assert.strictEqual(e.date, '2025-01-01');
  assert.strictEqual(SRV.sanitizeLeaderboardEntry(null), null);
});
test('服务器：sanitizeSavePayload 拒绝原型污染与数组', () => {
  assert.strictEqual(SRV.sanitizeSavePayload(JSON.parse('{"a":{"__proto__":{"x":1}}}')), null);
  assert.strictEqual(SRV.sanitizeSavePayload([]), null);
  assert.ok(SRV.sanitizeSavePayload({ version: 1 }));
});
test('服务器：resolveStaticPath 阻断穿越并回退 index.html', () => {
  assert.ok(SRV.resolveStaticPath('/../server.js').forbidden);
  const root = SRV.resolveStaticPath('/');
  assert.ok(root.fp && root.fp.endsWith('index.html'));
  const missing = SRV.resolveStaticPath('/definitely-not-here.js');
  assert.ok(missing.fp && missing.fp.endsWith('index.html'));
});
test('服务器：clampCount 处理非法/越界 count', () => {
  assert.strictEqual(SRV.clampCount('abc', 10, 1, 60), 10);
  assert.strictEqual(SRV.clampCount('-5', 10, 1, 60), 1);
  assert.strictEqual(SRV.clampCount('999', 10, 1, 60), 60);
});


// ---------- 9) 战斗引擎（种子 / 装备加成 / 字诀 / Boss 越界 / 灼烧清理 / 收集） ----------
function makeBattle(overrides) {
  const opts = {
    canvas: global.document.createElement('canvas'),
    mode: 'endless',
    config: { mode: 'endless', level: 1, seed: 123 },
    dict: [
      { ch: '光', pinyin: 'g', meaning: 'm', cat: '光', el: 'light' },
      { ch: '火', pinyin: 'h', meaning: 'm', cat: '火', el: 'fire' },
      { ch: '水', pinyin: 's', meaning: 'm', cat: '水', el: 'water' }
    ],
    words: { words2: [{ w: '火海', p: '', m: '' }], idioms: [{ w: '火冒三丈', p: '', m: '' }], poems: [] },
    getState: () => ({ growth: { levels: { power: 1, crit: 1, pool: 1, qi: 1, combo: 1, boss: 1 } }, equipment: {} }),
    theme: { bg: 'paper', weather: null, scale: [1, 2, 3, 4, 5] },
    threshold: 0.15, perfectTh: 0.5,
    onEnd: () => {}, onHud: () => {}
  };
  return new global.INK_BATTLE.Battle(Object.assign(opts, overrides || {}));
}

test('战斗：config.seed 决定随机序列（每日同题）', () => {
  const a = makeBattle(), b = makeBattle();
  assert.deepStrictEqual([a._pickChar(), a._pickChar(), a._pickChar()], [b._pickChar(), b._pickChar(), b._pickChar()]);
});
test('战斗：装备加成进入玩家属性', () => {
  const b = makeBattle({ getState: () => ({ growth: { levels: {} }, equipment: { pen: { power: 100 }, ink: null, paper: null, stone: null } }) });
  assert.ok(b.power >= 116, 'power=' + b.power);
});
test('战斗：光克暗字诀的 ×1.5 加成真正生效', () => {
  const b = makeBattle();
  b.critChance = 0; b.power = 100; b.boss = null;
  b.player.combo = 0;
  const dark = new global.INK_ENEMIES.Enemy({ type: 'wrong', target: { type: 'char', ch: '光' } });
  dark.el = 'dark'; dark.hp = dark.maxHp = 10000; b.enemies = [dark];
  b._applyHit(dark, '光', 0.3, false);
  assert.ok(Math.abs((10000 - dark.hp) - 288) < 1e-6, 'dark dmg=' + (10000 - dark.hp));
  b.player.combo = 0;
  const fire = new global.INK_ENEMIES.Enemy({ type: 'wrong', target: { type: 'char', ch: '光' } });
  fire.el = 'fire'; fire.hp = fire.maxHp = 10000; b.enemies = [fire];
  b._applyHit(fire, '光', 0.3, false);
  assert.ok(Math.abs((10000 - fire.hp) - 120) < 1e-6, 'fire dmg=' + (10000 - fire.hp));
});
test('战斗：Boss 越界不会卡死，重击后推回战场', () => {
  const b = makeBattle();
  b._spawnBoss({ id: 'idiom_beast' });
  const boss = b.boss, hp0 = b.player.hp;
  boss.x = b.boundary;
  b._enemyReached(boss);
  assert.ok(b.enemies.includes(boss));
  assert.strictEqual(boss.hp, boss.maxHp);
  assert.ok(b.player.hp < hp0);
});
test('战斗：灼烧致死会被清理并计入击杀', () => {
  const b = makeBattle();
  b.spawnQueue = []; b.bossSpec = null; b.boss = null;
  const e = b._spawn('wrong');
  b.enemies = [e];
  e.hp = 0.1; e.burn = 1;
  b.update(0.05);
  assert.ok(!b.enemies.includes(e));
  assert.strictEqual(b.stats.kills, 1);
});
test('战斗：连续写完整词会记入收集', () => {
  const b = makeBattle();
  b.spawnQueue = []; b.bossSpec = null; b.boss = null;
  const w = new global.INK_ENEMIES.Enemy({ type: 'word', target: { type: 'word', chars: ['火', '海'] } });
  b.enemies = [w];
  b._applyHit(w, '火', 0.3, false);
  assert.strictEqual(w.needIdx, 1);
  b._applyHit(w, '海', 0.3, false);
  assert.ok(b.stats.wordsUsed.includes('火海'));
});


// ---------- 10) 前端静态回归（重复 id / 屏幕切换 / 按钮绑定） ----------
test('前端：index.html 没有重复 id', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf-8');
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  assert.deepStrictEqual(dup, []);
});
test('前端：main.js 的 screens 覆盖 index.html 全部 screen-*', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf-8');
  const screens = [...html.matchAll(/id="screen-([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.ok(screens.length >= 10, 'screens=' + screens.length);
  const main = fs.readFileSync(path.join(PUB, 'js', 'main.js'), 'utf-8');
  const m = main.match(/const screens = \[([^\]]+)\]/);
  assert.ok(m, 'screens array missing');
  for (const s of screens) assert.ok(m[1].indexOf("'" + s + "'") >= 0, 'missing screen ' + s);
});
test('前端：书法练习场与生成字帖是两个独立按钮', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf-8');
  assert.ok(html.indexOf('id="menu-practice"') >= 0);
  assert.ok(html.indexOf('id="menu-practice-sheet"') >= 0);
  const main = fs.readFileSync(path.join(PUB, 'js', 'main.js'), 'utf-8');
  assert.ok(main.indexOf("'menu-practice-sheet'") >= 0);
  assert.ok(main.indexOf('id="menu-practice-sheet"') < 0);
});


test('存档：sanitize 过滤 __proto__/constructor/prototype', () => {
  const S = global.INK_SAVE;
  const cleaned = S.sanitize(JSON.parse('{"a":{"__proto__":{"x":1},"constructor":1},"b":2}'));
  assert.strictEqual(cleaned.b, 2);
  assert.ok(!Object.prototype.hasOwnProperty.call(cleaned.a, '__proto__'));
  assert.ok(!Object.prototype.hasOwnProperty.call(cleaned.a, 'constructor'));
  assert.strictEqual(Object.getPrototypeOf(cleaned.a), Object.prototype);
});


test('战斗：击杀 Boss 会记录 bossId（供 Boss 成就判定）', () => {
  const b = makeBattle();
  b.spawnQueue = []; b.bossSpec = { id: 'idiom_beast' }; b.boss = null;
  b._spawnBoss(b.bossSpec);
  const boss = b.boss;
  boss.hp = 1;
  b._applyHit(boss, '火', 0.3, false);
  assert.ok(b.stats.bosses.indexOf('idiom_beast') >= 0, JSON.stringify(b.stats.bosses));
});

console.log('==============================');
console.log('结果：' + passed + ' 通过，' + failed + ' 失败');
process.exit(failed > 0 ? 1 : 0);
