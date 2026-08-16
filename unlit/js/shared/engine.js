/* UNLIT · 无光之城 — 游戏引擎（纯逻辑，无 DOM/音频）
 * 职责：章节流程、地图切换、移动碰撞、白杖回声、过街信号仿真、
 *       谜题结算、烹饪、记忆标记、知识卡、语音导航目标。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(
    require('./world.js'), require('./cane.js'), require('./audioscene.js'),
    require('./chapters.js'), require('./braille.js'), require('./money.js'), require('./rng.js')
  );
  else root.UNLIT_ENGINE = factory(root.UNLIT_WORLD, root.UNLIT_CANE, root.UNLIT_AUDIOSCENE,
    root.UNLIT_CHAPTERS, root.UNLIT_BRAILLE, root.UNLIT_MONEY, root.UNLIT_RNG);
})(typeof self !== 'undefined' ? self : this, function (World, Cane, AS, Chapters, Braille, Money, RNG) {
  'use strict';
  const TAU = Math.PI * 2;
  const STEP = 0.16;          // 每步移动距离（格）
  const TOUCH_RANGE = 1.5;
  const TOUCH_CONE = 1.5;
  const BLOCK_DIST = 0.62;    // 家具阻挡半径

  function create() {
    const e = {};
    // ---------- 状态 ----------
    e.chapterId = null; e.mapId = null; e.map = null;
    e.px = 0; e.py = 0; e.facing = 0;
    e.flags = {}; e.inventory = []; e.bought = [];
    e.factsUnlocked = []; e.memory = [];
    e.gameTime = 0; e.chapterTime = 0;
    e.mode = 'play'; e.puzzleId = null;
    e.dialogueNpc = null; e.dialogueIndex = 0;
    e.currentMessage = null; e.log = [];
    e.lastEcho = null;
    e.nearMiss = 0; e.crossAttempts = 0;
    e.cookStep = 0; e.boardHits = 0;
    e.stoveT = 0; e.panT = 0;
    e.audition = null;
    e.signal = { phase: 'red', t: 0 };
    e.crossing = null; e.cars = []; e.spawnTimers = []; e.immuneT = 0;
    e.gameOver = false;
    e.collected = {};           // 已拾取/已拿取的对象 id
    e.letterOk = { xx: false, shiyin: false };
    e.wasOnIsland = false;
    e.rng = RNG.create(42);
    e.onSay = null;             // 前端注入：说话回调
    e.onEvent = null;
    e.sayCount = 0;

    // ---------- 基础 ----------
    function cur() { return Chapters.get(e.chapterId); }
    function mapDef() { return cur().maps[e.mapId]; }
    function meta(id) { return cur().objects[id]; }

    function say(text, speaker) {
      e.currentMessage = { speaker: speaker || '墨（你）', text: String(text), at: e.gameTime };
      e.log.push(e.currentMessage);
      e.sayCount++;
      if (e.onSay) e.onSay(e.currentMessage);
      return e.currentMessage;
    }
    function emit(type, data) { if (e.onEvent) e.onEvent({ t: e.gameTime, type, data }); }

    function walkable(x, y) {
      const fx = Math.floor(x), fy = Math.floor(y);
      if (fx < 0 || fy < 0 || fx >= e.map.w || fy >= e.map.h) return false;
      const row = e.map.grid[fy];
      if (!row || row[fx] === '#') return false;
      for (const o of e.map.objects) {
        if (o.id === '__start__' || o.id === '__exit__') continue;
        const m = meta(o.id);
        if (m && (m.block || m.kind === 'door') && o.id !== 'elevDoorOut' && o.id !== 'elevDoorIn') {
          const dx = x - (o.x + 0.5), dy = y - (o.y + 0.5);
          if (dx * dx + dy * dy < BLOCK_DIST * BLOCK_DIST) return false;
        }
      }
      return true;
    }

    function move(dx, dy) {
      if (e.mode !== 'play') return { moved: false };
      const nx = e.px + dx * STEP, ny = e.py + dy * STEP;
      if (walkable(nx, ny)) { e.px = nx; e.py = ny; afterMove(); return { moved: true }; }
      if (walkable(nx, e.py)) { e.px = nx; afterMove(); return { moved: true, slid: true }; }
      if (walkable(e.px, ny)) { e.py = ny; afterMove(); return { moved: true, slid: true }; }
      return { moved: false, bumped: true };
    }
    function turn(dr) { e.facing = AS.normAngle(e.facing + dr); }

    function afterMove() { checkPortals(); checkStranger(); }

    // ---------- 地图/章节切换 ----------
    function loadMap(chapterId, mapId, x, y, facing) {
      const ch = Chapters.get(chapterId);
      const def = ch.maps[mapId];
      e.chapterId = chapterId; e.mapId = mapId;
      e.map = World.parseMap(def.raw.split('\n'), def.legend || {});
      e.px = x; e.py = y; e.facing = facing;
      e.gameTime = 0;
      e.mode = 'play'; e.puzzleId = null; e.dialogueNpc = null; e.currentMessage = null;
      e.lastEcho = null; e.cars = []; e.crossing = null; e.spawnTimers = []; e.immuneT = 0; e.audition = null;
      e.signal = { phase: 'red', t: 0 };
      if (def.crossing) {
        e.crossing = def.crossing;
        e.signal = { phase: 'red', t: 0 };
        e.spawnTimers = e.crossing.roads.map(() => 0.8);
      }
      for (const f of (ch.facts || [])) unlockFact(f);
      emit('map', { chapterId, mapId });
    }

    function loadChapter(id) {
      const ch = Chapters.get(id);
      e.flags = {}; e.bought = []; e.memory = []; e.cookStep = 0; e.boardHits = 0;
      e.stoveT = 0; e.panT = 0; e.letterOk = { xx: false, shiyin: false };
      e.nearMiss = 0; e.crossAttempts = 0; e.gameOver = false; e.chapterTime = 0;
      const entry = ch.maps[ch.entryMap];
      const parsedEntry = World.parseMap(entry.raw.split('\n'), entry.legend || {});
      const start = parsedEntry.start || { x: 2, y: 2 };
      loadMap(id, ch.entryMap, start.x + 0.5, start.y + 0.5, entry.startFacing || 0);
      emit('chapter', { id });
      return e;
    }

    function advanceChapter() {
      const ch = cur();
      const outro = ch.outro || [];
      if (ch.next) {
        const n = ch.next;
        if (outro.length) say(outro[0], '旁白');
        loadMap(n.chapter, n.map, n.x + 0.5, n.y + 0.5, n.facing);
        e.chapterTime = 0;
        for (let i = 1; i < outro.length; i++) say(outro[i], '旁白');
        return true;
      }
      e.gameOver = true;
      return false;
    }

    // ---------- 交互 ----------
    function nearestTouchable() {
      let best = null;
      for (const o of e.map.objects) {
        if (o.id === '__start__' || o.id === '__exit__') continue;
        if (e.collected[o.id]) continue;
        const dx = o.x + 0.5 - e.px, dy = o.y + 0.5 - e.py;
        const d = Math.hypot(dx, dy);
        if (d > TOUCH_RANGE) continue;
        const a = AS.relAngle(e.px, e.py, e.facing, o.x + 0.5, o.y + 0.5);
        if (d > 0.9 && Math.abs(a) > TOUCH_CONE) continue;
        if (!best || d < best.d) best = { obj: o, d, angle: a };
      }
      return best;
    }

    function touch() {
      const t = nearestTouchable();
      if (!t) return { found: false };
      const m = meta(t.obj.id) || {};
      if (m.touch) say(typeof m.touch === 'function' ? m.touch(e) : m.touch);
      return { found: true, obj: t.obj, meta: m, dist: t.d };
    }

    function interact() {
      if (e.mode !== 'play') return { noop: true };
      const t = nearestTouchable();
      if (!t) { say('你伸出手，摸了个空。'); return { found: false }; }
      const m = t.obj.meta || meta(t.obj.id) || {};
      const it = m.interact;
      if (!it) { touch(); return { found: true, interacted: false }; }
      return doInteract(t.obj, m, it);
    }

    function doInteract(obj, m, it) {
      switch (it.type) {
        case 'flag':
          e.flags[it.key] = it.value;
          if (it.after) say(it.after);
          emit('flag', it.key);
          return { ok: true };
        case 'pickup':
          if (!e.inventory.includes(it.item)) e.inventory.push(it.item);
          e.collected[obj.id] = true;
          if (it.after) say(it.after);
          return { ok: true };
        case 'function': {
          const res = it.fn(e);
          if (res && res.text) say(res.text);
          return { ok: true };
        }
        case 'puzzle':
          e.mode = 'puzzle'; e.puzzleId = it.id;
          say(openPuzzleText(it.id));
          emit('puzzle', it.id);
          return { ok: true, puzzle: it.id };
        case 'dialogue':
          startDialogue(it.npc);
          return { ok: true };
        case 'exit': {
          const need = it.need || [];
          const missing = need.find(k => !e.flags[k]);
          if (missing) { say(it.failText || '还差一步。'); return { ok: false }; }
          advanceChapter();
          return { ok: true, exit: true };
        }
        case 'buy': {
          const needItems = ['大米', '番茄', '牛奶', '罐头'];
          if (!needItems.includes(it.item)) { say('这个今天用不上，先不拿了。'); return { ok: false }; }
          if (e.bought.includes(it.item)) { say('你已经拿过' + it.item + '了。'); return { ok: false }; }
          e.bought.push(it.item);
          e.collected[obj.id] = true;
          say('你摸到' + it.item + '，轻轻放进购物袋。' + (e.bought.length === 4 ? '四样都齐了，该去收银台了。' : '还差' + (4 - e.bought.length) + '样。'));
          return { ok: true };
        }
        case 'cook':
          return handleCook(it.step);
        default:
          return { ok: false };
      }
    }

    function openPuzzleText(id) {
      const p = cur().puzzles[id];
      if (!p) return '';
      return p.title + '。' + (p.desc || '');
    }

    // ---------- 对话 ----------
    function startDialogue(npc) {
      const ch = cur();
      const lines = (ch.dialogue && ch.dialogue[npc]) || [];
      if (!lines.length) { say('（没有人回应。）'); return; }
      e.mode = 'dialogue'; e.dialogueNpc = npc; e.dialogueIndex = 0;
      const l = lines[0];
      say(l.text, l.who);
    }
    function dialogueNext() {
      if (e.mode !== 'dialogue') return null;
      const lines = cur().dialogue[e.dialogueNpc] || [];
      e.dialogueIndex++;
      if (e.dialogueIndex >= lines.length) {
        const npc = e.dialogueNpc;
        e.mode = 'play'; e.dialogueNpc = null;
        if (npc === 'stranger') unlockFact('etiquette');
        emit('dialogueEnd', npc);
        return { done: true };
      }
      const l = lines[e.dialogueIndex];
      say(l.text, l.who);
      return l;
    }

    // ---------- 谜题 ----------
    function solvePuzzle(id, input) {
      if (e.mode !== 'puzzle' || e.puzzleId !== id) return { noop: true };
      const p = cur().puzzles[id];
      if (!p) return { noop: true };
      let ok = false;
      switch (id) {
        case 'elevCall': {
          ok = input === p.correct;
          if (ok) { e.flags.elevOpen = true; say(p.onSuccess); }
          else say(p.onFail);
          break;
        }
        case 'elevFloor': {
          ok = input === p.correct;
          if (ok) { e.flags.floor1 = true; say(p.onSuccess); }
          else say(p.onFail);
          break;
        }
        case 'pay': {
          const wallet = Money.wallet();
          const chosen = (input || []).map(id2 => wallet.find(w => w.id === id2)).filter(Boolean);
          const res = Money.pay(chosen, p.price);
          ok = res.ok;
          if (ok) { e.flags.paid = true; say(p.successText); }
          else say(p.failText + '（还差 ' + (res.short / 100).toFixed(1) + ' 元）');
          break;
        }
        case 'letter': {
          const word = String(input || '').toLowerCase().replace(/\s/g, '');
          if (word === 'xx' && !e.letterOk.xx) { e.letterOk.xx = true; say('你读出来了：两个 x——星星的缩写。'); ok = true; }
          else if (word === 'shiyin' && !e.letterOk.shiyin) { e.letterOk.shiyin = true; say('你读出来了：shiyin——试音。'); ok = true; }
          else if (word !== 'xx' && word !== 'shiyin') { say('指尖划过那些点，好像……还差一点。'); return { ok: false }; }
          if (e.letterOk.xx && e.letterOk.shiyin) { e.flags.letterRead = true; say(p.successText); }
          break;
        }
        case 'books': {
          ok = input === p.correct;
          if (ok) { e.flags.bookFound = true; say(p.successText); }
          else say(p.failText);
          break;
        }
        default: return { noop: true };
      }
      if (ok && id !== 'letter') { e.mode = 'play'; e.puzzleId = null; }
      else if (id === 'letter' && e.flags.letterRead) { e.mode = 'play'; e.puzzleId = null; }
      return { ok };
    }

    // ---------- 试音（实时节奏） ----------
    function startAudition() {
      e.audition = { total: 4, idx: 0, t: 0, interval: 0.7, hits: 0, beats: [], done: false };
      e.mode = 'puzzle'; e.puzzleId = 'audition';
    }
    function updateAudition(dt) {
      const a = e.audition;
      if (!a || a.done) return;
      a.t += dt;
      while (a.t >= a.idx * a.interval) {
        a.beats.push({ at: a.idx * a.interval, hit: false });
        a.idx++;
        if (a.idx >= a.total) break;
      }
      if (a.idx >= a.total && a.t > a.total * a.interval + 0.4) {
        a.done = true;
        const ok = a.hits >= 3;
        if (ok) { e.flags.auditionDone = true; say(cur().puzzles.audition.successText); }
        else { say(cur().puzzles.audition.failText); }
        e.mode = 'play'; e.puzzleId = null; e.audition = null;
        if (!ok) startAudition();
      }
    }
    function auditionPress() {
      const a = e.audition;
      if (!a || a.done) return;
      const now = a.t;
      for (let i = 0; i < a.beats.length; i++) {
        const b = a.beats[i];
        if (!b.hit && Math.abs(now - b.at) <= 0.35) { b.hit = true; a.hits++; say('笃。', '节拍器'); return; }
      }
      say('（你按得早了/晚了……）');
    }

    // ---------- 烹饪 ----------
    function handleCook(stepId) {
      const steps = cur().puzzles.cook.steps;
      const curStep = steps[e.cookStep];
      if (!curStep) { say('都做好了。'); return { ok: false }; }
      if (stepId !== curStep.id) { say('现在还不是做这个的时候。' + curStep.desc); return { ok: false }; }
      if (stepId === 'stove' && stoveIntensity() < 0.85) { say('水还没开——你听见气泡声正慢慢变密。'); return { ok: false }; }
      if (stepId === 'pan' && panIntensity() < 0.8) { say('锅还没热透，再等等那阵"滋啦"。'); return { ok: false }; }
      if (stepId === 'board') {
        e.boardHits++;
        say('笃。' + (e.boardHits < 4 ? '（再切几刀：' + e.boardHits + '/4）' : ''));
        if (e.boardHits < 4) return { ok: false };
      }
      if (stepId === 'table') {
        say(cur().puzzles.cook.doneText);
        e.cookStep++;
        e.gameOver = true;
        emit('gameover');
        return { ok: true, done: true };
      }
      e.cookStep++;
      const next = steps[e.cookStep];
      say(next ? '好，下一步：' + next.name + '。' + next.desc : cur().puzzles.cook.doneText);
      return { ok: true };
    }
    function updateCook(dt) {
      const steps = cur().puzzles && cur().puzzles.cook && cur().puzzles.cook.steps;
      if (!steps || e.cookStep >= steps.length) return;
      const curStep = steps[e.cookStep];
      if (curStep.id === 'stove') e.stoveT += dt;
      if (curStep.id === 'pan') e.panT += dt;
    }

    // ---------- 过街仿真 ----------
    function updateCrossing(dt) {
      const c = e.crossing;
      if (!c) return;
      e.signal.t += dt;
      const red = c.signal.red, green = c.signal.green;
      if (e.signal.phase === 'red' && e.signal.t >= red) {
        e.signal.phase = 'green'; e.signal.t = 0;
        for (const car of e.cars) {
          const road = c.roads[car.lane];
          const span = [car.x, car.x + car.len];
          const inside = span[0] < road.stopLineOut && span[1] > road.stopLineIn;
          car.clearing = inside;
          if (!inside) {
            if (car.dir > 0 && car.x + car.len > road.stopLineIn) car.x = road.stopLineIn - car.len;
            if (car.dir < 0 && car.x < road.stopLineOut) car.x = road.stopLineOut;
            car.stopped = true;
          }
        }
      } else if (e.signal.phase === 'green' && e.signal.t >= green) {
        e.signal.phase = 'red'; e.signal.t = 0;
        for (const car of e.cars) { car.stopped = false; car.clearing = false; }
      }
      if (e.signal.phase === 'red') {
        for (let li = 0; li < c.roads.length; li++) {
          const road = c.roads[li];
          e.spawnTimers[li] -= dt;
          const laneCount = e.cars.filter(car => car.lane === li).length;
          if (e.spawnTimers[li] <= 0) {
            e.spawnTimers[li] = 0.6 + e.rng.next() * 0.8;
            if (laneCount < 2) {
              for (let r = 0; r < road.rows.length; r++) {
                const dir = road.dirs[r];
                e.cars.push({ lane: li, row: road.rows[r], dir, x: dir > 0 ? -3 : e.map.w + 1, y: road.rows[r] + 0.5, speed: c.carSpeed, len: 2, stopped: false, clearing: false });
              }
            }
          }
        }
      }
      for (const car of e.cars) {
        if (car.stopped && !car.clearing) continue;
        car.x += car.dir * car.speed * dt;
        const road = c.roads[car.lane];
        if (car.clearing && car.dir > 0 && car.x > road.stopLineOut) { car.clearing = false; car.stopped = true; car.x = road.stopLineOut; }
        if (car.clearing && car.dir < 0 && car.x + car.len < road.stopLineIn) { car.clearing = false; car.stopped = true; car.x = road.stopLineIn - car.len; }
      }
      e.cars = e.cars.filter(car => car.x > -4 && car.x < e.map.w + 4);
      e.immuneT -= dt;
      if (e.immuneT <= 0) {
        const pfx = Math.floor(e.px), pfy = Math.floor(e.py);
        for (const car of e.cars) {
          if (car.row !== pfy) continue;
          if (pfx >= Math.floor(car.x) && pfx < Math.floor(car.x + car.len)) {
            e.nearMiss++;
            say('——！车！你被推回人行道。心跳得厉害。（按 H 可看提示）', '旁白');
            pushToSafeRow();
            e.immuneT = 1.5;
            emit('nearmiss');
            break;
          }
        }
      }
    }
    function pushToSafeRow() {
      const c = e.crossing;
      const roadRows = c.roads.flatMap(r => r.rows);
      let best = null, bestD = 99;
      for (let y = 1; y < e.map.h - 1; y++) {
        if (roadRows.includes(y)) continue;
        const d = Math.abs(y - e.py);
        if (d < bestD) { bestD = d; best = y; }
      }
      e.py = (best === null ? 1 : best) + 0.5;
    }
    function crossingClear() {
      const c = e.crossing;
      if (!c) return true;
      for (const car of e.cars) {
        const road = c.roads[car.lane];
        const span = [car.x, car.x + car.len];
        if (span[0] < road.stopLineOut && span[1] > road.stopLineIn) return false;
      }
      return true;
    }
    function beeperTick() {
      if (e.signal.phase === 'red') return { kind: 'red', every: 1.2 };
      return { kind: 'green', every: 0.18 };
    }

    // ---------- 传送门与事件 ----------
    function checkPortals() {
      for (const o of e.map.objects) {
        const dx = e.px - (o.x + 0.5), dy = e.py - (o.y + 0.5);
        if (Math.hypot(dx, dy) > 0.55) continue;
        if (o.id === '__exit__') {
          const need = exitNeed();
          if (need) { say('还不能走：' + need); continue; }
          advanceChapter();
          return;
        }
        const m = meta(o.id);
        if (!m) continue;
        if (m.kind === 'portal') {
          const it = m.interact;
          if (it && it.type === 'portal') {
            if (it.needFlag && !e.flags[it.needFlag]) {
              if (it.failText) say(it.failText);
              e.px -= Math.cos(e.facing) * 0.3; e.py -= Math.sin(e.facing) * 0.3;
              continue;
            }
            loadMap(e.chapterId, it.map, it.x + 0.5, it.y + 0.5, it.facing);
            return;
          }
        }
      }
    }
    function exitNeed() {
      const ch = cur();
      if (ch.exitNeed) {
        const missing = ch.exitNeed.find(k => !e.flags[k]);
        if (missing) {
          const names = { letterRead: '读完那封信', bookFound: '找到那本书', auditionDone: '完成试音' };
          return names[missing] || '还有事没做完';
        }
      }
      return null;
    }
    function checkStranger() {
      if (e.mapId !== 'street' || e.flags.strangerDone) return;
      const fx = Math.floor(e.px), fy = Math.floor(e.py);
      if (fx >= 16 && fx <= 17 && fy >= 5 && fy <= 6) {
        e.flags.strangerDone = true;
        startDialogue('stranger');
      }
    }

    // ---------- 知识卡 / 记忆 / 提示 ----------
    function unlockFact(id) {
      if (!e.factsUnlocked.includes(id)) e.factsUnlocked.push(id);
    }
    function addMarker(type, x, y) {
      const id = 'm' + e.memory.length;
      e.memory.push({ id, type, x, y });
      return id;
    }
    function removeMarker(id) { e.memory = e.memory.filter(m => m.id !== id); }

    // ---------- 语音导航目标 ----------
    const NAV = {
      ch0: { order: ['alarmPhone', 'closet', 'door'], active: (id, e) => id === 'alarmPhone' ? !e.flags.alarmOff : id === 'closet' ? !e.flags.dressed : (e.flags.alarmOff && e.flags.dressed) },
      ch1: { order: ['keys', 'aptDoor', 'callPanel', 'elevDoorOut', 'floorPanel', 'elevDoorIn', 'doorman', '__exit__'], active: (id, e) => {
        if (id === 'keys') return !e.inventory.includes('keys');
        if (id === 'aptDoor') return e.mapId === 'apt' && !e.flags.locked;
        if (id === 'callPanel') return e.mapId === 'corridor' && !e.flags.elevOpen;
        if (id === 'elevDoorOut') return e.mapId === 'corridor' && e.flags.elevOpen;
        if (id === 'floorPanel') return e.mapId === 'elev' && !e.flags.floor1;
        if (id === 'elevDoorIn') return e.mapId === 'elev' && e.flags.floor1;
        if (id === 'doorman') return e.mapId === 'lobby' && !e.flags.metDoorman;
        if (id === '__exit__') return e.mapId === 'lobby';
        return false;
      } },
      ch2: { order: ['crossSignA'], active: () => true },
      ch3: { order: ['shelfRice', 'shelfTomato', 'shelfMilk', 'shelfCan', 'cashier', 'exitDoor'], active: (id, e) => {
        const names = { shelfRice: '大米', shelfTomato: '番茄', shelfMilk: '牛奶', shelfCan: '罐头' };
        if (names[id]) return !e.bought.includes(names[id]);
        if (id === 'cashier') return e.bought.length === 4 && !e.flags.paid;
        if (id === 'exitDoor') return e.flags.paid;
        return false;
      } },
      ch4: { order: ['letterTable', 'shelfA', 'boss', '__exit__'], active: (id, e) => {
        if (id === 'letterTable') return !e.flags.letterRead;
        if (id === 'shelfA') return e.flags.letterRead && !e.flags.bookFound;
        if (id === 'boss') return e.flags.letterRead && e.flags.bookFound && !e.flags.auditionDone;
        if (id === '__exit__') return e.flags.auditionDone;
        return false;
      } },
      ch5: { order: ['sink', 'stove', 'board', 'pan', 'table'], active: (id, e) => {
        const steps = cur().puzzles.cook.steps;
        return steps[e.cookStep] && steps[e.cookStep].id === id;
      } }
    };
    function navTarget() {
      const nav = NAV[e.chapterId];
      if (!nav) return null;
      for (const id of nav.order) {
        if (!nav.active(id, e)) continue;
        const objs = e.map.objects.filter(o => o.id === id);
        if (!objs.length) continue;
        const o = objs[0];
        const dx = o.x + 0.5 - e.px, dy = o.y + 0.5 - e.py;
        const d = Math.hypot(dx, dy);
        const a = AS.relAngle(e.px, e.py, e.facing, o.x + 0.5, o.y + 0.5);
        const dirText = Math.abs(a) < 0.4 ? '正前方' : a > 0 ? '右前方' : '左前方';
        return { id, name: (meta(id) || {}).name || '出口', x: o.x, y: o.y, d, dirText };
      }
      return null;
    }

    // ---------- 主更新 ----------
    function update(dt) {
      const d = Math.min(dt, 0.1);
      e.gameTime += d; e.chapterTime += d;
      if (e.mode !== 'puzzle' && e.mode !== 'dialogue') {
        updateCrossing(d);
        updateCook(d);
        checkStranger();
      }
      updateAudition(d);
    }

    // ---------- 强度（供前端做水开/油热的声音） ----------
    function stoveIntensity() { return Math.min(1, Math.max(0, (e.stoveT - 1) / 3.2)); }
    function panIntensity() { return Math.min(1, Math.max(0, (e.panT - 1) / 2.2)); }

    // ---------- 目标检查 ----------
    function goalDone() {
      switch (e.chapterId) {
        case 'ch0': return !!e.flags.alarmOff && !!e.flags.dressed;
        case 'ch1': return e.mapId === 'lobby';
        case 'ch2': return true;
        case 'ch3': return !!e.flags.paid;
        case 'ch4': return !!e.flags.letterRead && !!e.flags.bookFound && !!e.flags.auditionDone;
        case 'ch5': return e.gameOver;
        default: return false;
      }
    }

    // ---------- API 装配 ----------
    e.loadChapter = loadChapter; e.loadMap = loadMap;
    e.move = move; e.turn = turn;
    e.tap = function () {
      const obs = e.map.objects.filter(o => { const m = meta(o.id); return m && (m.block || m.kind === 'door') && o.id !== 'elevDoorOut' && o.id !== 'elevDoorIn'; }).map(o => ({ x: o.x + 0.5, y: o.y + 0.5 }));
      e.lastEcho = Cane.tap(e.map.grid, e.px, e.py, e.facing, obs);
      return e.lastEcho;
    };
    e.touch = touch; e.interact = interact;
    e.solvePuzzle = solvePuzzle;
    e.startAudition = startAudition; e.auditionPress = auditionPress;
    e.dialogueNext = dialogueNext;
    e.update = update;
    e.say = say;
    e.unlockFact = unlockFact; e.addMarker = addMarker; e.removeMarker = removeMarker;
    e.navTarget = navTarget; e.goalDone = goalDone;
    e.signalPhase = () => e.signal.phase;
    e.crossingClear = crossingClear; e.beeperTick = beeperTick;
    e.stoveIntensity = stoveIntensity; e.panIntensity = panIntensity;
    e.hasItem = (id) => e.inventory.includes(id);
    e.wallet = () => Money.wallet();
    e.curChapter = cur; e.objMeta = meta; e.mapDef = mapDef;
    e.letterCells = (word) => Braille.textToCells(word);
    return e;
  }

  return { create, constants: { STEP, TOUCH_RANGE, TOUCH_CONE } };
});
