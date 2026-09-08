/* UNLIT · 无光之城 — 单元测试（Node 零依赖）
 * 运行：node test/run.js
 * 覆盖：盲文、听觉数学、白杖回声、钱币、世界数据、引擎状态机、
 *       过街仿真、全部谜题、以及 ch0→ch5 脚本化全流程通关。
 */
'use strict';
const path = require('path');
const base = path.join(__dirname, '..', 'js', 'shared');
const RNG = require(path.join(base, 'rng.js'));
const Braille = require(path.join(base, 'braille.js'));
const AS = require(path.join(base, 'audioscene.js'));
const Cane = require(path.join(base, 'cane.js'));
const Money = require(path.join(base, 'money.js'));
const World = require(path.join(base, 'world.js'));
const Chapters = require(path.join(base, 'chapters.js'));
const Engine = require(path.join(base, 'engine.js'));

// ---------------- 断言框架 ----------------
let pass = 0, fail = 0, failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (err) { fail++; failures.push(name + ' :: ' + err.message); console.log('  ✗ ' + name + ' — ' + err.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error((msg || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
function assertNear(a, b, eps, msg) { if (Math.abs(a - b) > (eps || 1e-6)) throw new Error((msg || 'not near') + ': ' + a + ' vs ' + b); }
function assertTrue(a, msg) { assert(!!a, msg || 'expected truthy, got ' + JSON.stringify(a)); }

// ---------------- 盲文 ----------------
console.log('盲文 braille');
test('字母全表编码/解码', () => {
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  for (const ch of alpha) {
    const cell = Braille.charToCell(ch);
    assert(cell && cell.kind === 'letter', ch);
    assertEq(Braille.cellToChar(cell.mask), ch, ch);
  }
});
test('数字需要数字符前缀', () => {
  const cells = Braille.textToCells('3');
  assertEq(cells.length, 2, 'digits need number sign');
  assertEq(cells[0].kind, 'numbersign');
  assertEq(cells[1].kind, 'digit');
  assertEq(cells[1].ch, '3');
});
test('文本→盲文→文本 往返', () => {
  const words = ['hello', 'shiyin', 'xx', 'a1 b2', "it's", '12.5'];
  for (const w of words) {
    const cells = Braille.textToCells(w);
    assertEq(Braille.cellsToText(cells), w.toLowerCase(), w);
  }
});
test('数字符语境：空格结束数字，非 a-j 字母结束数字', () => {
  assertEq(Braille.cellsToText(Braille.textToCells('a1 b')), 'a1 b');
  assertEq(Braille.cellsToText(Braille.textToCells('a1b')), 'a12'); // 盲文中 b 在数字语境里读作 2
  assertEq(Braille.cellsToText(Braille.textToCells('12x')), '12x');
});
test('渲染 Unicode 盲文字符', () => {
  assertEq(Braille.renderChar(Braille.dotMask([1])), '⠁');
  assertEq(Braille.renderChar(Braille.dotMask([1, 2, 3])), '⠇');
  assertEq(Braille.renderChar(Braille.dotMask([1, 4])), '⠉');
});
test('2×3 网格', () => {
  assertEq(JSON.stringify(Braille.cellGrid(Braille.dotMask([1, 6]))), '[[true,false],[false,false],[false,true]]');
});
test('磨损至少保留一个点', () => {
  const rng = RNG.create(7);
  const mask = Braille.dotMask([1, 2, 3]);
  for (let i = 0; i < 20; i++) {
    const w = Braille.wearMask(mask, rng, 2);
    assert(w !== 0, 'must keep at least one dot');
  }
});
test('整行磨损：保留真实字符、凸点只减不增、记录缺点点号', () => {
  const cells = Braille.textToCells('shiyin');
  const worn = Braille.wearCells(cells, RNG.create(99), 2);
  assertEq(worn.length, cells.length, '长度不变');
  let damaged = 0;
  for (let i = 0; i < cells.length; i++) {
    assertEq(worn[i].ch, cells[i].ch, '字符仍然是原文（只磨凸点）');
    assert((worn[i].mask & cells[i].mask) === worn[i].mask, '磨损掩码必须是原掩码的子集');
    if (cells[i].mask) assert(worn[i].mask !== 0, '至少保留一个凸点');
    if (worn[i].worn) {
      damaged++;
      assert(worn[i].wornDots.length > 0, '缺角点号要记录（前端画虚线点）');
      for (const d of worn[i].wornDots) assert(!(worn[i].mask & (1 << (d - 1))), '缺角点号不应还在掩码里');
    }
  }
  assert(damaged > 0, '这封信确实被磨过');
});
test('整行磨损同种子可复现', () => {
  const cells = Braille.textToCells('xing xing de mi ma');
  const a = Braille.wearCells(cells, RNG.create(1234), 2);
  const b = Braille.wearCells(cells, RNG.create(1234), 2);
  assertEq(JSON.stringify(a), JSON.stringify(b), '同一封信每次打开都一样');
});

// ---------------- 听觉数学 ----------------
console.log('听觉数学 audioscene');
test('方位角归一化到 [-π, π] 且 2π 周期', () => {
  assert(Math.abs(AS.normAngle(Math.PI * 3)) <= Math.PI + 1e-9);
  assert(Math.abs(AS.normAngle(-Math.PI * 3)) <= Math.PI + 1e-9);
  assertNear(AS.normAngle(0), 0, 1e-9);
  assertNear(AS.normAngle(2 * Math.PI), 0, 1e-9);
  assertNear(AS.normAngle(Math.PI / 2), Math.PI / 2, 1e-9);
});
test('relAngle 正前方为 0', () => {
  assertNear(AS.relAngle(0, 0, 0, 5, 0), 0, 1e-9);
  assertNear(AS.relAngle(0, 0, 0, 0, 5), Math.PI / 2, 1e-9);
});
test('isFacing 锥体判断', () => {
  assert(AS.isFacing(0, 0, 0, 5, 0.2, 1));
  assert(!AS.isFacing(0, 0, 0, -5, 0, 1));
});
test('等功率声像左右对称', () => {
  const l1 = AS.panEqualPower(-1), r1 = AS.panEqualPower(1);
  assertNear(l1[0], 1, 1e-9); assertNear(l1[1], 0, 1e-9);
  assertNear(r1[0], 0, 1e-9); assertNear(r1[1], 1, 1e-9);
  const c = AS.panEqualPower(0);
  assertNear(c[0], c[1], 1e-9);
});
test('距离越远音量越小、越闷、回声越晚', () => {
  assert(AS.distanceGain(1) > AS.distanceGain(5));
  assert(AS.lowpassCutoff(1) > AS.lowpassCutoff(5));
  assert(AS.echoDelayMs(5) > AS.echoDelayMs(1));
});

// ---------------- 白杖回声 ----------------
console.log('白杖回声 cane');
test('开阔空间无回声', () => {
  const grid = ['########', '#......#', '#......#', '########'].map(r => r.split(''));
  const r = Cane.tap(grid, 1.5, 1.5, 0, []);
  assert(!r.hit, 'open space should not hit');
});
test('前方有墙返回回声', () => {
  const grid = ['########', '#......#', '#......#', '########'].map(r => r.split(''));
  const wall = Cane.tap(grid, 3.5, 1.5, 0, []);
  assert(wall.hit, 'should hit wall ahead');
  assertNear(wall.dist, 3.5, 0.3, 'wall distance');
  assertEq(wall.by, 'wall');
});
test('锥体外障碍物不返回回声', () => {
  const grid = ['####', '#..#', '#..#', '####'].map(r => r.split(''));
  const obs = [{ x: 1.5 + 2, y: 1.5 - 2 }];
  const r = Cane.tap(grid, 1.5, 1.5, 0, obs);
  assert(!r.hit || r.by !== 'object');
});
test('锥体内障碍物返回回声且带方位', () => {
  const grid = ['##########', '#........#', '#........#', '##########'].map(r => r.split(''));
  const obs = [{ x: 5.5, y: 1.5 }];
  const r = Cane.tap(grid, 1.5, 1.5, 0, obs);
  assert(r.hit && r.by === 'object');
  assertNear(r.dist, 4, 0.2);
  assertNear(r.angle, 0, 0.1);
});
test('房间开放度：小房间小、大房间大', () => {
  const small = ['####', '#..#', '#..#', '####'].map(r => r.split(''));
  const big = ['##########', '#........#', '#........#', '#........#', '#........#', '##########'].map(r => r.split(''));
  assert(Cane.nearestWallDist(small, 2.0, 2.0) < Cane.nearestWallDist(big, 5.0, 3.0));
});
test('斜向回声距离精确到厘米级（不再量化到 8cm 步长）', () => {
  const grid = ['##########', '#........#', '#........#', '#........#', '#........#', '##########'].map(r => r.split(''));
  const r = Cane.tap(grid, 1.5, 1.5, -Math.PI / 4, []);
  assert(r.hit, 'should hit the top wall');
  assertNear(r.dist, 0.5 * Math.SQRT2, 0.02, '斜向墙距');
  const r2 = Cane.tap(grid, 1.5, 1.5, Math.PI / 2, []);
  assertNear(r2.dist, 3.5, 0.02, '正前方墙距');
});
test('回声方位区分左右，pan 与方位一致', () => {
  const grid = ['##########', '#........#', '#........#', '#........#', '#........#', '##########'].map(r => r.split(''));
  const right = Cane.tap(grid, 4.5, 3.5, 0, [{ x: 7.5, y: 4.3 }]);
  const left = Cane.tap(grid, 4.5, 3.5, 0, [{ x: 7.5, y: 2.7 }]);
  assert(right.hit && right.by === 'object', 'right object should echo');
  assert(left.hit && left.by === 'object', 'left object should echo');
  assert(right.angle > 0 && right.pan > 0, '右侧目标 angle/pan 为正: ' + right.angle);
  assert(left.angle < 0 && left.pan < 0, '左侧目标 angle/pan 为负: ' + left.angle);
});

// ---------------- 钱币 ----------------
console.log('钱币 money');
test('钱包总额 31.5 元', () => {
  const w = Money.wallet();
  assertEq(Money.total(w), 3150);
});
test('付款：足够找零 / 不足拒绝', () => {
  const w = Money.wallet();
  const r1 = Money.pay([w[0], w[1], w[2]], 2750);
  assert(!r1.ok);
  assertEq(r1.short, 250);
  const chosen = [w[0], w[1], w[2], ...w.filter(x => x.value === 100).slice(0, 5)];
  const r2 = Money.pay(chosen, 2750);
  assert(r2.ok);
  assertEq(r2.change, 250);
});
test('付款边界：空钱包被拒、正好付清找零 0', () => {
  const empty = Money.pay([], 2750);
  assert(!empty.ok);
  assertEq(empty.short, 2750);
  const exact = Money.pay([{ name: '10元', value: 1000 }], 1000);
  assert(exact.ok);
  assertEq(exact.change, 0);
});

// ---------------- 世界数据 ----------------
console.log('世界数据 world');
test('所有地图行等长、图例齐全、边界完整', () => {
  const errors = World.validate();
  assertEq(errors.length, 0, errors.join(' | '));
});
test('校验器能发现没封口的地图', () => {
  World.register({ id: '__tmp_bad__', maps: { bad: { raw: ['#####', '#...#', '####.'].join('\n'), legend: {} } } });
  try {
    const errors = World.validate();
    assert(errors.some(x => x.indexOf('__tmp_bad__') >= 0), 'should flag the broken map: ' + JSON.stringify(errors));
  } finally { delete World.CHAPTERS.__tmp_bad__; }
});
test('每章入口地图有出生点', () => {
  for (const id of ['ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5']) {
    const ch = Chapters.CHAPTERS[id];
    const m = World.parseMap(ch.maps[ch.entryMap].raw.split('\n'), ch.maps[ch.entryMap].legend || {});
    assert(m.start, id + ' missing start');
  }
});
test('所有对象 id 都有元数据', () => {
  for (const cid of Object.keys(Chapters.CHAPTERS)) {
    const ch = Chapters.CHAPTERS[cid];
    for (const mid of Object.keys(ch.maps)) {
      const m = World.parseMap(ch.maps[mid].raw.split('\n'), ch.maps[mid].legend || {});
      for (const o of m.objects) {
        if (o.id === '__start__' || o.id === '__exit__') continue;
        assert(ch.objects[o.id], cid + '/' + mid + ' missing meta for ' + o.id);
      }
    }
  }
});
test('知识卡字段齐全', () => {
  const f = Chapters.FACTS;
  assertEq(Object.keys(f).length, 10);
  for (const k of Object.keys(f)) {
    assert(f[k].title && f[k].body && f[k].icon, k);
  }
});

// ---------------- 引擎辅助 ----------------
function makeEngine() { return Engine.create(); }

function bfsPath(e, sx, sy, gx, gy) {
  const grid = e.map.grid, W = e.map.w, H = e.map.h;
  const prev = new Map();
  const key = (x, y) => x + ',' + y;
  const q = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (q.length) {
    const [x, y] = q.shift();
    if (x === gx && y === gy) break;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (grid[ny][nx] === '#') continue;
      if (blockObjAt(e, nx, ny)) continue;
      prev.set(k, [x, y]); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(gx, gy))) return null;
  const path = [];
  let cur = [gx, gy];
  while (cur) { path.push(cur); cur = prev.get(key(cur[0], cur[1])); }
  return path.reverse();
}
function blockObjAt(e, x, y) {
  for (const o of e.map.objects) {
    const m = e.objMeta(o.id);
    if (m && m.block && o.id !== 'elevDoorOut' && o.id !== 'elevDoorIn') {
      if (o.x === x && o.y === y) return true;
    }
  }
  return false;
}
function steer(e, ta) {
  let da = ta - e.facing;
  da = ((da + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (Math.abs(da) > 0.12) {
    e.turn(Math.sign(da) * Math.min(Math.abs(da), 0.3));
    return da; // 返回残余角度，供调用方判断是否前进
  }
  return 0;
}
function goTo(e, tx, ty, maxIters) {
  const iters = maxIters || 5000;
  let guard = 0;
  let stuck = 0;
  while (guard++ < iters) {
    if (Math.hypot(tx - e.px, ty - e.py) < 0.3) return true;
    const path = bfsPath(e, Math.floor(e.px), Math.floor(e.py), Math.floor(tx), Math.floor(ty));
    if (!path || path.length < 2) {
      const da = steer(e, Math.atan2(ty - e.py, tx - e.px));
      if (Math.abs(da) > 0.9) continue; // 大角度转向时不前移
      const r = e.move(Math.cos(e.facing), Math.sin(e.facing));
      if (!r.moved) { e.turn(0.45); }
      continue;
    }
    // 找路径上第一个离玩家足够远的途经点（跳过已踩到的）
    let wp = null;
    for (let i = 1; i < Math.min(path.length, 8); i++) {
      const wx = path[i][0] + 0.5, wy = path[i][1] + 0.5;
      if (Math.hypot(wx - e.px, wy - e.py) > 0.4) { wp = [wx, wy]; break; }
    }
    if (!wp) wp = [tx, ty];
    const da = steer(e, Math.atan2(wp[1] - e.py, wp[0] - e.px));
    if (Math.abs(da) > 0.9) continue;
    const r = e.move(Math.cos(e.facing), Math.sin(e.facing));
    if (!r.moved) { e.turn(0.45); stuck++; if (stuck > 40) { e.turn(Math.PI / 2); stuck = 0; } }
  }
  return false;
}
function eWalkable(e, x, y) {
  const fx = Math.floor(x), fy = Math.floor(y);
  if (fx < 0 || fy < 0 || fx >= e.map.w || fy >= e.map.h) return false;
  if (e.map.grid[fy][fx] === '#') return false;
  return !blockObjAt(e, fx, fy);
}
function touchObj(e, id) {
  const objs = e.map.objects.filter(o => o.id === id);
  if (!objs.length) throw new Error('object not in map: ' + id);
  const o = objs[0];
  const cx = o.x + 0.5, cy = o.y + 0.5;
  // 候选落脚点：对象周围 8 格（只取可达的）
  const cands = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const tx = o.x + dx + 0.5, ty = o.y + dy + 0.5;
    if (eWalkable(e, tx, ty)) cands.push([tx, ty]);
  }
  const CARD = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  let best = null, bestD = Infinity, bestScore = 0;
  const tryCands = (list, baseScore) => {
    for (const [dx, dy] of list) {
      const tx = o.x + dx + 0.5, ty = o.y + dy + 0.5;
      if (!eWalkable(e, tx, ty)) continue;
      const p = bfsPath(e, Math.floor(e.px), Math.floor(e.py), Math.floor(tx), Math.floor(ty));
      if (!p) continue;
      const d = Math.hypot(tx - e.px, ty - e.py);
      const score = baseScore + d;
      if (!best || score < bestScore) { bestScore = score; best = [tx, ty]; }
    }
  };
  tryCands(CARD, 0);
  if (!best) tryCands(DIAG, 100);
  if (!best) throw new Error('no reachable tile near ' + id + ' at ' + o.x + ',' + o.y);
  const ok = goTo(e, best[0], best[1]);
  if (!ok) throw new Error('cannot reach ' + id);
  const ta = Math.atan2(cy - e.py, cx - e.px);
  let guard = 0;
  let da = ((ta - e.facing + Math.PI) % (2 * Math.PI)) - Math.PI;
  while (Math.abs(da) > 0.06 && guard++ < 40) { e.turn(Math.sign(da) * 0.15); da = ((ta - e.facing + Math.PI) % (2 * Math.PI)) - Math.PI; }
  return e.interact();
}
function waitGreen(e, maxSec) {
  const max = maxSec || 60;
  let t = 0;
  while (t < max * 20) {
    if (e.signalPhase() === 'green' && e.crossingClear()) return true;
    e.update(0.05); t++;
  }
  return false;
}
function waitFor(e, fn, maxSec) {
  let t = 0;
  while (t < (maxSec || 30) * 50) {
    if (fn()) return true;
    e.update(0.02); t++;
  }
  return false;
}
function pump(e, sec) {
  const n = Math.ceil((sec || 1) / 0.02);
  for (let i = 0; i < n; i++) e.update(0.02);
}

// ---------------- 引擎状态机 ----------------
console.log('引擎 engine');
test('加载章节：出生点与地图', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  assertEq(e.chapterId, 'ch0');
  assertEq(e.mapId, 'bedroom');
  assert(e.map.grid.length > 0);
  assert(e.px > 0 && e.py > 0);
});
test('墙壁阻挡移动', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  e.px = 1.0; e.py = 5.5; e.facing = Math.PI;
  const oldX = e.px;
  e.move(-1, 0);
  assertEq(e.px, oldX, 'should be blocked by left wall');
  // 转身向右可以移动
  e.facing = 0;
  const r = e.move(1, 0);
  assert(r.moved, 'moving right should work');
});
test('家具阻挡移动', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  e.px = 5.5; e.py = 6.9; e.facing = -Math.PI / 2;
  const r = e.move(Math.cos(e.facing), Math.sin(e.facing));
  assert(!r.moved, 'bed should block');
});
test('转身改变朝向', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  e.turn(Math.PI / 2);
  assertNear(e.facing, Math.PI / 2, 1e-9);
});
test('白杖回声在房间内命中', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  e.facing = Math.PI / 2; // 朝南，近墙
  const r = e.tap();
  assert(r.hit, 'bedroom should echo: ' + JSON.stringify(r));
});
test('触摸需要靠近对象', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  const t = e.touch();
  assert(t.found === false || t.obj.id === 'bed', 'start should not touch anything yet: ' + (t.obj && t.obj.id));
});
test('闹钟互动与着装', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  touchObj(e, 'alarmPhone');
  assertEq(e.flags.alarmOff, true, 'alarm off');
  touchObj(e, 'closet');
  assertEq(e.flags.dressed, true, 'dressed');
});
test('门在条件未满足时拒绝', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  touchObj(e, 'door');
  assert(e.chapterId === 'ch0', 'should not advance');
});
test('对话推进', () => {
  const e = makeEngine();
  e.loadChapter('ch1');
  e.loadMap('ch1', 'lobby', 2, 8, 0);
  touchObj(e, 'doorman');
  assertEq(e.mode, 'dialogue');
  assert(e.currentMessage.text.length > 0);
  let done = null, guard = 0;
  while (e.mode === 'dialogue' && guard++ < 10) done = e.dialogueNext();
  assert(done && done.done, 'dialogue ended');
});
test('记忆标记增删', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  const id = e.addMarker('door', 3, 9);
  assertEq(e.memory.length, 1);
  e.removeMarker(id);
  assertEq(e.memory.length, 0);
});
test('语音导航目标随进度变化', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  assertEq(e.navTarget().id, 'alarmPhone');
  touchObj(e, 'alarmPhone');
  assertEq(e.navTarget().id, 'closet');
  touchObj(e, 'closet');
  assertEq(e.navTarget().id, 'door');
});
test('语音导航指向最近的同名目标（街口有两个提示器）', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  const signs = e.map.objects.filter(o => o.id === 'crossSignA');
  assert(signs.length === 2, 'street has two beepers: ' + signs.length);
  // 站在南侧提示器旁：导航应该指向它，而不是地图上先出现的北侧那个
  const south = signs.reduce((a, b) => (a.y > b.y ? a : b));
  e.px = south.x + 0.5; e.py = south.y + 1.5; e.facing = 0;
  const nav = e.navTarget();
  assertEq(nav.id, 'crossSignA');
  assertEq(nav.y, south.y, 'nearest beeper row');
  assert(nav.d < 2, 'distance should be small: ' + nav.d);
});

// ---------------- 过街仿真 ----------------
console.log('过街仿真 crossing');
test('信号周期红→绿循环', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  assertEq(e.signalPhase(), 'red');
  pump(e, 5.5);
  assertEq(e.signalPhase(), 'green');
  pump(e, 8.5);
  assertEq(e.signalPhase(), 'red');
});
test('绿灯期间车辆停在路口外', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  pump(e, 3);
  assert(e.cars.length > 0, 'cars spawned during red');
  pump(e, 3);
  assertEq(e.signalPhase(), 'green');
  e.update(0.1);
  const c = e.crossing;
  for (const car of e.cars) {
    if (car.clearing) continue;
    const road = c.roads[car.lane];
    const span = [car.x, car.x + car.len];
    assert(span[1] <= road.stopLineIn || span[0] >= road.stopLineOut, 'stopped car must not block crosswalk');
  }
});
test('红灯期间车流与碰撞计数', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.px = 14.5; e.py = 3.5; e.facing = Math.PI / 2;
  pump(e, 5.0);
  assert(e.cars.length > 0, 'cars present during red');
});
test('绿灯穿越安全且能到对面', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.px = 14.5; e.py = 1.5; e.facing = Math.PI / 2;
  assert(waitGreen(e, 30), 'green window');
  let steps = 0;
  while (e.py < 4.5 && steps++ < 300) { e.update(0.05); e.move(0, 1); }
  assert(e.py >= 4.5, 'crossed road A during green');
  assert(e.nearMiss === 0, 'no hit during green: ' + e.nearMiss);
});
test('被撞后推回安全行并记录', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.px = 14.5; e.py = 3.5;
  e.cars.push({ lane: 0, row: 3, dir: 1, x: 13.5, y: 3.5, speed: 0, len: 2, stopped: false, clearing: false });
  e.update(0.1);
  assert(e.nearMiss >= 1, 'nearMiss recorded');
  assert(![3, 4, 7, 8].includes(Math.floor(e.py)), 'pushed off road: ' + e.py);
});
test('绿灯时已越过路口的车不会被拉回停止线', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.cars.push({ lane: 0, row: 3, dir: 1, x: 20, y: 3.5, speed: 1.3, len: 2, stopped: false, clearing: false });
  e.cars.push({ lane: 1, row: 7, dir: -1, x: -2, y: 7.5, speed: 1.3, len: 2, stopped: false, clearing: false });
  e.signal = { phase: 'red', t: 4.99 };
  e.update(0.05);
  assertEq(e.signal.phase, 'green');
  const gone = e.cars.find(c => c.dir > 0);
  const leaving = e.cars.find(c => c.dir < 0);
  assert(gone && gone.x >= 20, '已通过路口的车不能被倒着拉回来: x=' + (gone && gone.x));
  assert(gone && !gone.stopped, '已通过路口的车不该被冻结');
  assert(leaving && leaving.x < 11, '刚驶出左侧的车不能被瞬移到路口右侧: x=' + (leaving && leaving.x));
});
test('绿灯时已越过路口的车继续驶离（不冻结在路口边缘）', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.cars.push({ lane: 0, row: 3, dir: 1, x: 20, y: 3.5, speed: 1.3, len: 2, stopped: false, clearing: false });
  e.signal = { phase: 'red', t: 4.99 };
  e.update(0.05);
  const before = e.cars[0].x;
  for (let i = 0; i < 40; i++) e.update(0.05);
  assert(e.cars[0].x > before + 1, '车应该继续开走: ' + before + ' → ' + e.cars[0].x);
});
test('绿灯时未到停止线的车停在路口外等待', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.cars.push({ lane: 0, row: 3, dir: 1, x: 5, y: 3.5, speed: 1.3, len: 2, stopped: false, clearing: false });
  e.signal = { phase: 'red', t: 4.99 };
  e.update(0.05);
  const car = e.cars[0];
  const road = e.crossing.roads[0];
  assert(car.stopped, '未到停止线的车要停下');
  assert(car.x + car.len <= road.stopLineIn, '不能占住斑马线: ' + (car.x + car.len));
});
test('红灯恢复后车辆重新行驶', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.cars.push({ lane: 0, row: 3, dir: 1, x: 5, y: 3.5, speed: 1.3, len: 2, stopped: true, clearing: false });
  e.signal = { phase: 'green', t: 7.99 };
  e.update(0.05);
  assertEq(e.signal.phase, 'red');
  const x0 = e.cars[0].x;
  for (let i = 0; i < 20; i++) e.update(0.05);
  assert(e.cars[0].x > x0, '红灯时车流恢复: ' + x0 + ' → ' + e.cars[0].x);
});
test('陌生人事件在安全岛触发', () => {
  const e = makeEngine();
  e.loadChapter('ch2');
  e.px = 16.5; e.py = 5.5;
  e.update(0.05);
  assertEq(e.mode, 'dialogue');
  assertEq(e.dialogueNpc, 'stranger');
});

// ---------------- 谜题 ----------------
console.log('谜题 puzzles');
test('呼梯：按▼正确', () => {
  const e = makeEngine();
  e.loadChapter('ch1');
  e.loadMap('ch1', 'corridor', 2, 6, 0);
  touchObj(e, 'callPanel');
  assertEq(e.puzzleId, 'elevCall');
  const r = e.solvePuzzle('elevCall', 'down');
  assert(r.ok && e.flags.elevOpen, 'elevOpen');
});
test('呼梯：按▲错误留在界面', () => {
  const e = makeEngine();
  e.loadChapter('ch1');
  e.loadMap('ch1', 'corridor', 2, 6, 0);
  touchObj(e, 'callPanel');
  e.solvePuzzle('elevCall', 'up');
  assert(!e.flags.elevOpen);
  assertEq(e.mode, 'puzzle');
});
test('电梯：按1楼正确', () => {
  const e = makeEngine();
  e.loadChapter('ch1');
  e.loadMap('ch1', 'elev', 3, 5, -1.57);
  touchObj(e, 'floorPanel');
  const r = e.solvePuzzle('elevFloor', '1');
  assert(r.ok && e.flags.floor1, 'floor1');
});
test('电梯：按3楼错误', () => {
  const e = makeEngine();
  e.loadChapter('ch1');
  e.loadMap('ch1', 'elev', 3, 5, -1.57);
  touchObj(e, 'floorPanel');
  e.solvePuzzle('elevFloor', '3');
  assert(!e.flags.floor1);
});
test('付款谜题：凑够 27.5 元', () => {
  const e = makeEngine();
  e.loadChapter('ch3');
  e.loadMap('ch3', 'market', 1, 1, 0);
  touchObj(e, 'cashier');
  assertEq(e.puzzleId, 'pay');
  const w = e.wallet();
  const ids = ['t0', 't1', 'f0'].concat(w.filter(x => x.value === 100).slice(0, 3).map(x => x.id));
  const r = e.solvePuzzle('pay', ids);
  assert(r.ok && e.flags.paid, 'paid');
});
test('付款不足被拒', () => {
  const e = makeEngine();
  e.loadChapter('ch3');
  e.loadMap('ch3', 'market', 1, 1, 0);
  touchObj(e, 'cashier');
  const r = e.solvePuzzle('pay', ['b1']);
  assert(!r.ok && !e.flags.paid);
});
test('盲文信：两个答案都正确才读完', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  touchObj(e, 'letterTable');
  assertEq(e.puzzleId, 'letter');
  let r = e.solvePuzzle('letter', 'xx');
  assert(r.ok && !e.flags.letterRead, 'xx alone not enough');
  r = e.solvePuzzle('letter', 'shiyin');
  assert(r.ok && e.flags.letterRead, 'letter read');
});
test('盲文信：错误答案不通过', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  touchObj(e, 'letterTable');
  const r = e.solvePuzzle('letter', 'nope');
  assert(!r.ok && !e.flags.letterRead);
});
test('找书：星星的密码是 book4', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  touchObj(e, 'shelfA');
  assertEq(e.puzzleId, 'books');
  let r = e.solvePuzzle('books', 'book3');
  assert(!r.ok && !e.flags.bookFound);
  r = e.solvePuzzle('books', 'book4');
  assert(r.ok && e.flags.bookFound);
});
test('试音：跟上 4 拍通过', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  e.startAudition();
  let guard = 0;
  while (!e.flags.auditionDone && guard++ < 2000) {
    const a = e.audition;
    if (a) {
      for (const b of a.beats) {
        if (!b.hit && Math.abs(a.t - b.at) <= 0.25) e.auditionPress();
      }
    }
    e.update(0.02);
  }
  assertEq(e.flags.auditionDone, true, 'audition passed');
});
test('试音：第一拍前有准备时间，且每一拍都会发事件（前端据此发声）', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  const beats = [];
  e.onEvent = (ev) => { if (ev.type === 'beat') beats.push(ev.data); };
  e.startAudition();
  assert(e.audition.lead >= 0.5, '第一拍不能一开场就响: ' + e.audition.lead);
  assertEq(beats.length, 0, '还没到时间就不该有拍子');
  pump(e, 4.2);
  assertEq(beats.length, 4, '4 拍都发出了事件: ' + beats.length);
  assert(beats[0].at >= 0.5, '第一拍在准备时间之后');
  for (let i = 1; i < beats.length; i++) assert(beats[i].at > beats[i - 1].at, '拍子按时间递增');
  assert(beats[0].accent, '第一拍是重音');
});
test('试音：窗口外按键不计入', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  e.startAudition();
  pump(e, 0.2);                 // 第一拍之前
  const r = e.auditionPress();
  assert(!r.hit, '太早按下不算');
  assertEq(e.audition.hits, 0);
});
test('试音：离开面板即暂停，不会自动把面板弹回来', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  e.startAudition();
  assert(e.cancelAudition(), '取消成功');
  assertEq(e.mode, 'play');
  assertEq(e.audition, null);
  pump(e, 20);
  assertEq(e.mode, 'play', '不该自动重开谜题');
  assert(!e.flags.auditionDone, '不该偷偷判定通过');
});
test('烹饪顺序：乱序被拒', () => {  const e = makeEngine();
  e.loadChapter('ch5');
  e.loadMap('ch5', 'kitchen', 13, 10, Math.PI);
  touchObj(e, 'stove');
  assert(e.cookStep === 0, 'stove before sink rejected');
  assert(!e.gameOver);
});
test('电梯未到时进门会被推回，且不会卡进墙里', () => {
  const e = makeEngine();
  e.loadChapter('ch1');
  e.loadMap('ch1', 'corridor', 2, 6, 0);
  e.px = 8.0; e.py = 2.5; e.facing = 0;      // 面朝电梯门
  e.move(1, 0);
  assertEq(e.mapId, 'corridor', '没呼梯就不该进电梯');
  assertEq(e.px <= 8.0 + 1e-9, true, '被推回门外: ' + e.px);
  const row = e.map.grid[Math.floor(e.py)];
  assert(row && row[Math.floor(e.px)] !== '#', '不能被推进墙里');
});
test('切菜会发出落刀事件（前端据此播放"笃"声）', () => {
  const e = makeEngine();
  e.loadChapter('ch5');
  e.loadMap('ch5', 'kitchen', 13, 10, Math.PI);
  const events = [];
  e.onEvent = (ev) => { if (ev.type === 'chop') events.push(ev.data); };
  touchObj(e, 'sink');
  e.stoveT = 10;
  touchObj(e, 'stove');
  for (let i = 0; i < 3; i++) touchObj(e, 'board');
  assertEq(events.length, 3, '三刀三个事件');
  assertEq(events[2].hits, 3, '事件里带刀数');
});
test('收银台会念出店员的无障碍支付提示（谜题挂 NPC 台词）', () => {
  const e = makeEngine();
  e.loadChapter('ch3');
  e.loadMap('ch3', 'market', 1, 1, 0);
  touchObj(e, 'cashier');
  const spoken = e.log.map(m => m.text).join('');
  assert(spoken.indexOf('纸币') >= 0, '店员的提示必须真的念出来: ' + spoken.slice(0, 60));
});
test('老板在试音结束后会说台词（不是只返回一句硬编码）', () => {
  const e = makeEngine();
  e.loadChapter('ch4');
  e.loadMap('ch4', 'shop', 2, 10, 0);
  e.flags.letterRead = true; e.flags.bookFound = true; e.flags.auditionDone = true;
  const boss = e.map.objects.find(o => o.id === 'boss');
  e.px = boss.x + 1.5; e.py = boss.y + 0.5; e.facing = Math.PI;
  e.interact();
  assertEq(e.mode, 'dialogue');
  assertEq(e.dialogueNpc, 'boss');
  const lines = [];
  let guard = 0;
  while (e.mode === 'dialogue' && guard++ < 10) { e.dialogueNext(); lines.push(e.currentMessage.text); }
  assert(lines.join('').indexOf('无光电台') >= 0, '老板的台词里应有无光电台');
});

// ---------------- 存档 ----------------
console.log('存档 save');
test('存档：快照/恢复完整还原进度（可 JSON 往返）', () => {
  const e = makeEngine();
  e.loadChapter('ch3');
  touchObj(e, 'shelfRice');
  touchObj(e, 'shelfTomato');
  e.addMarker('sound', 3, 3);
  e.unlockFact('braille');
  const snap = JSON.parse(JSON.stringify(e.snapshot()));
  const e2 = makeEngine();
  assert(e2.restore(snap), 'restore should succeed');
  assertEq(e2.chapterId, 'ch3');
  assertEq(e2.mapId, 'market');
  assertEq(e2.bought.length, 2, 'bought');
  assertEq(e2.collected.shelfRice, true, 'collected');
  assert(e2.factsUnlocked.includes('braille'), 'facts');
  assertEq(e2.memory.length, 1, 'memory');
  assertNear(e2.px, e.px, 1e-9); assertNear(e2.py, e.py, 1e-9); assertNear(e2.facing, e.facing, 1e-9);
  assertEq(e2.mode, 'play', 'restore always resumes in play mode');
});
test('存档：烹饪进度能续上并接着做', () => {
  const e = makeEngine();
  e.loadChapter('ch5');
  touchObj(e, 'sink');
  e.stoveT = 3.0;
  const snap = JSON.parse(JSON.stringify(e.snapshot()));
  const e2 = makeEngine();
  assert(e2.restore(snap));
  assertEq(e2.cookStep, 1);
  assertNear(e2.stoveT, 3.0, 1e-9);
  assert(waitFor(e2, () => e2.stoveIntensity() >= 0.85, 30), 'water can still boil after restore');
  touchObj(e2, 'stove');
  assertEq(e2.cookStep, 2, 'cook continues');
});
test('存档：版本不符/未知章节被拒绝且不破坏当前状态', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  assert(!e.restore(null));
  assert(!e.restore({ v: 999, chapterId: 'ch0', mapId: 'bedroom', px: 1, py: 1 }));
  assert(!e.restore({ v: 1, chapterId: 'nope', mapId: 'bedroom', px: 1, py: 1 }));
  assert(!e.restore({ v: 1, chapterId: 'ch0', mapId: 'nope', px: 1, py: 1 }));
  assert(!e.restore({ v: 1, chapterId: 'ch0', mapId: 'bedroom', px: NaN, py: 1 }));
  assertEq(e.chapterId, 'ch0', 'current state untouched');
  assertEq(e.mapId, 'bedroom');
});

// ---------------- 全流程通关 ----------------
console.log('全流程 walkthrough');
function solveCh0(e) {
  touchObj(e, 'alarmPhone');
  assertEq(e.flags.alarmOff, true, 'ch0 alarm');
  touchObj(e, 'closet');
  assertEq(e.flags.dressed, true, 'ch0 dressed');
  touchObj(e, 'door');
  assertEq(e.chapterId, 'ch1', 'entered ch1');
}
function solveCh1(e) {
  touchObj(e, 'keys');
  assert(e.hasItem('keys'), 'keys picked');
  touchObj(e, 'aptDoor');
  assertEq(e.mapId, 'corridor', 'locked door → corridor');
  touchObj(e, 'callPanel');
  const r = e.solvePuzzle('elevCall', 'down');
  assert(r.ok, 'elevator called');
  const door = e.map.objects.find(o => o.id === 'elevDoorOut');
  goTo(e, door.x + 0.5, door.y + 0.5);
  assertEq(e.mapId, 'elev', 'entered elevator');
  touchObj(e, 'floorPanel');
  const r2 = e.solvePuzzle('elevFloor', '1');
  assert(r2.ok, 'floor 1 pressed');
  const din = e.map.objects.find(o => o.id === 'elevDoorIn');
  goTo(e, din.x + 0.5, din.y + 0.5);
  assertEq(e.mapId, 'lobby', 'arrived lobby');
  const x = e.map.objects.find(o => o.id === '__exit__');
  goTo(e, x.x + 0.5, x.y + 0.5);
  assertEq(e.chapterId, 'ch2', 'entered ch2');
}
function solveCh2(e) {
  assertEq(e.mapId, 'street');
  e.px = 16.5; e.py = 5.5; e.update(0.05);
  while (e.mode === 'dialogue') e.dialogueNext();
  e.px = 12.5; e.py = 1.5; e.facing = Math.PI / 2;
  const targets = [[14.5, 1.5], [14.5, 2.5], [14.5, 3.5], [14.5, 4.5], [14.5, 5.5], [14.5, 6.5], [14.5, 7.5], [14.5, 8.5], [14.5, 9.5], [22.5, 9.5]];
  for (const [tx, ty] of targets) {
    if (ty === 3.5 || ty === 4.5 || ty === 7.5 || ty === 8.5) {
      assert(waitGreen(e, 60), 'green window for road');
      goTo(e, tx, ty);
    } else {
      goTo(e, tx, ty);
    }
  }
  assertEq(e.chapterId, 'ch3', 'entered ch3');
  assert(e.nearMiss === 0, 'crossed without being hit: ' + e.nearMiss);
}
function solveCh3(e) {
  touchObj(e, 'shelfRice');
  touchObj(e, 'shelfTomato');
  touchObj(e, 'shelfMilk');
  touchObj(e, 'shelfCan');
  assertEq(e.bought.length, 4, 'bought 4 items');
  touchObj(e, 'cashier');
  assertEq(e.puzzleId, 'pay');
  const w = e.wallet();
  const ids = ['t0', 't1', 'f0'].concat(w.filter(x => x.value === 100).slice(0, 3).map(x => x.id));
  e.solvePuzzle('pay', ids);
  assertEq(e.flags.paid, true, 'paid');
  touchObj(e, 'exitDoor');
  assertEq(e.chapterId, 'ch4', 'entered ch4');
}
function solveCh4(e) {
  touchObj(e, 'letterTable');
  assertEq(e.puzzleId, 'letter');
  e.solvePuzzle('letter', 'xx');
  e.solvePuzzle('letter', 'shiyin');
  assertEq(e.flags.letterRead, true, 'letter read');
  touchObj(e, 'shelfA');
  e.solvePuzzle('books', 'book4');
  assertEq(e.flags.bookFound, true, 'book found');
  touchObj(e, 'boss');
  if (e.mode === 'dialogue') { while (e.mode === 'dialogue') e.dialogueNext(); }
  if (!e.audition) e.startAudition();
  let guard = 0;
  while (!e.flags.auditionDone && guard++ < 3000) {
    const a = e.audition;
    if (a) { for (const b of a.beats) { if (!b.hit && Math.abs(a.t - b.at) <= 0.25) e.auditionPress(); } }
    e.update(0.02);
  }
  assertEq(e.flags.auditionDone, true, 'audition done');
  const x = e.map.objects.find(o => o.id === '__exit__');
  goTo(e, x.x + 0.5, x.y + 0.5);
  assertEq(e.chapterId, 'ch5', 'entered ch5');
}
function solveCh5(e) {
  touchObj(e, 'sink');
  assertEq(e.cookStep, 1, 'sink done');
  assert(waitFor(e, () => e.stoveIntensity() >= 0.85, 30), 'stove hot');
  touchObj(e, 'stove');
  assertEq(e.cookStep, 2, 'stove done');
  for (let i = 0; i < 4; i++) touchObj(e, 'board');
  assertEq(e.cookStep, 3, 'board done');
  assert(waitFor(e, () => e.panIntensity() >= 0.8, 30), 'pan hot');
  touchObj(e, 'pan');
  assertEq(e.cookStep, 4, 'pan done');
  touchObj(e, 'table');
  assertEq(e.gameOver, true, 'game over');
}
test('ch0 通关进入 ch1', () => { const e = makeEngine(); e.loadChapter('ch0'); solveCh0(e); });
test('ch1 通关进入 ch2', () => { const e = makeEngine(); e.loadChapter('ch1'); solveCh1(e); });
test('ch2 通关进入 ch3', () => { const e = makeEngine(); e.loadChapter('ch2'); solveCh2(e); });
test('ch3 通关进入 ch4', () => { const e = makeEngine(); e.loadChapter('ch3'); solveCh3(e); });
test('ch4 通关进入 ch5', () => { const e = makeEngine(); e.loadChapter('ch4'); solveCh4(e); });
test('ch5 通关游戏结束', () => { const e = makeEngine(); e.loadChapter('ch5'); solveCh5(e); });
test('全流程：ch0 一路打到结局', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  solveCh0(e); solveCh1(e); solveCh2(e); solveCh3(e); solveCh4(e); solveCh5(e);
  assertEq(e.gameOver, true, 'game over');
  assert(e.factsUnlocked.length >= 10, 'all 10 facts unlocked: ' + e.factsUnlocked.length);
  assertEq(e.nearMiss, 0, 'walkthrough crossed cleanly');
});
test('知识卡解锁覆盖全部 10 张', () => {
  const e = makeEngine();
  e.loadChapter('ch0');
  solveCh0(e); solveCh1(e); solveCh2(e); solveCh3(e); solveCh4(e); solveCh5(e);
  const ids = Object.keys(Chapters.FACTS);
  for (const id of ids) assert(e.factsUnlocked.includes(id), 'fact ' + id);
});

// ---------------- 汇总 ----------------
console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
if (failures.length) { console.log('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
