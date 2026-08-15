/* ECO-ARK · 生态仿真引擎（浏览器 + Node 双端 UMD）
 * 模型：生产者(植物) → 消费者(食草/捕食) → 分解者(腐殖质) 的能量流动；
 * 水分/养分/气温驱动的种群动力学；洛特卡-沃尔泰拉式的波动自然涌现。
 * 全确定性：同一种子 + 相同操作序列 → 完全相同的演化结果。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else { root.ECOARK = root.ECOARK || {}; root.ECOARK.sim = factory(root); }
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var SPEC = (typeof module === 'object' && module.exports)
    ? require('./species.js') : root.ECOARK.species;
  var WORLD = (typeof module === 'object' && module.exports)
    ? require('./world.js') : root.ECOARK.world;
  var RNG = (typeof module === 'object' && module.exports)
    ? require('./rng.js') : root.ECOARK.rng;

  var T = SPEC.TERRAIN;
  var MONTHS_PER_YEAR = 12;
  var SEASONS = ['春', '夏', '秋', '冬'];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function createSim(opts) {
    opts = opts || {};
    var seed = opts.seed || 'ark';
    var w = opts.w || 84, h = opts.h || 54;
    var world = WORLD.create(seed, w, h);
    var simRng = RNG.makeRng(String(seed) + ':sim');
    var eventChance = opts.eventChance != null ? opts.eventChance : 0.014;

    // 气候基线（全年 8~24°C，降水适中）
    var tempBase = 16, rainBase = 0.62, tempAmp = 8, rainAmp = 0.15;
    var tempOffset = 0, rainOffset = 0;
    var activeEvents = [];   // {id, name, until(month), temp, rain, desc}
    var manualEvents = [];   // 记录手动触发的自然事件（用于存档重放）

    // 植物覆盖：tile * nSpecies
    var plants = SPEC.PLANTS.map(function (s) { return s.id; });
    var NP = plants.length;
    var coverage = new Float32Array(w * h * NP);
    var carcass = new Float32Array(w * h); // 尸体/落叶 → 分解为养分
    var moisture = Float32Array.from(world.moisture);
    var nutrients = Float32Array.from(world.nutrients);
    var terrain = world.terrain;

    // 动物实体
    var animals = []; // {id, sp, x, y, age, energy}
    var nextId = 1;
    // 种子库：植物只有被"引入"后才会生长与扩散（玩家放置 = 引入）
    var introduced = {};

    // 事件定义
    var EVENTS = {
      drought: { name: '大旱', desc: '降水骤减，大地干裂。', temp: 0, rain: -0.34, len: 12 },
      iceage:  { name: '冰期', desc: '气温骤降，冰盖推进。', temp: -15, rain: -0.08, len: 30 },
      heatwave:{ name: '热浪', desc: '异常高温炙烤大地。', temp: 8, rain: -0.05, len: 6 },
      meteor:  { name: '陨石撞击', desc: '一颗陨石砸向地表，留下焦土坑。', temp: 0, rain: 0, len: 1 },
      plague:  { name: '瘟疫', desc: '一种疾病在某个物种间蔓延。', temp: 0, rain: 0, len: 1 },
      vine:    { name: '外来藤蔓入侵', desc: '紫色藤蔓疯长，吞噬本土植被！', temp: 0, rain: 0, len: 60 },
      bumper:  { name: '丰饶之年', desc: '风调雨顺，万物疯长。', temp: 1, rain: 0.14, len: 8 }
    };

    var month = 0; // 累计月数
    var history = []; // 每年一条
    var log = [];
    var statsCache = null;
    var dirty = true;

    // ---------- 基础查询 ----------
    function seasonOf(m) { return SEASONS[Math.floor(((m % MONTHS_PER_YEAR) + 3) / 3) % 4]; }
    function yearOf(m) { return Math.floor(m / MONTHS_PER_YEAR); }

    function climateNow() {
      var m = month % MONTHS_PER_YEAR;
      var phase = ((m - 2) / MONTHS_PER_YEAR) * Math.PI * 2; // 冬(11月)最低
      var temp = tempBase + tempAmp * Math.cos(phase) + tempOffset;
      var rain = rainBase + rainAmp * Math.cos(phase + 0.6) + rainOffset;
      return { temp: temp, rain: clamp(rain, 0, 1.2) };
    }

    // ---------- 事件 ----------
    function addEvent(id) {
      var ev = EVENTS[id];
      if (!ev) return;
      tempOffset += ev.temp; rainOffset += ev.rain;
      activeEvents.push({ id: id, name: ev.name, until: month + ev.len,
        temp: ev.temp, rain: ev.rain, desc: ev.desc });
      log.push({ month: month, text: '⚠️ 事件：' + ev.name + '——' + ev.desc, kind: 'event' });
      if (id === 'meteor') meteorStrike();
      if (id === 'plague') plagueStrike();
      if (id === 'vine') vineStrike();
    }

    function meteorStrike() {
      var cx = simRng.int(6, w - 7), cy = simRng.int(6, h - 7), r = simRng.range(3.5, 6);
      var hit = 0;
      for (var y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
        for (var x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
          var dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
          var i = y * w + x;
          if (terrain[i] !== T.WATER) terrain[i] = T.ROCK;
          moisture[i] = 0.1; nutrients[i] = Math.min(1, nutrients[i] + 0.6);
          for (var s = 0; s < NP; s++) coverage[i * NP + s] = 0;
          carcass[i] = Math.min(1, carcass[i] + 0.5);
          hit++;
        }
      }
      // 冲击波：附近动物死亡
      for (var a = animals.length - 1; a >= 0; a--) {
        var an = animals[a];
        var d2 = (an.x - cx) * (an.x - cx) + (an.y - cy) * (an.y - cy);
        if (d2 < (r + 1.5) * (r + 1.5)) { killAnimal(a, 0.4); }
      }
      log.push({ month: month, text: '💥 陨石坑半径 ' + r.toFixed(1) + '，' + hit + ' 格地表被摧毁。', kind: 'event' });
      dirty = true;
    }

    function plagueStrike() {
      var alive = [];
      for (var s = 0; s < animals.length; s++) {
        var sp = SPEC.byId(animals[s].sp);
        if (sp.type === 'plant') continue;
        var found = false;
        for (var a = 0; a < alive.length; a++) if (alive[a] === animals[s].sp) { found = true; break; }
        if (!found) alive.push(animals[s].sp);
      }
      if (!alive.length) return;
      var target = alive[simRng.int(0, alive.length - 1)];
      var killed = 0;
      for (var k = animals.length - 1; k >= 0; k--) {
        if (animals[k].sp === target && simRng.chance(0.62)) { killAnimal(k, 0.3); killed++; }
      }
      var spName = SPEC.byId(target) ? SPEC.byId(target).name : target;
      log.push({ month: month, text: '🦠 瘟疫袭击了「' + spName + '」，约 ' + killed + ' 只死亡。', kind: 'event' });
      dirty = true;
    }

    function vineStrike() {
      introduced.vine = true;
      var spread = 0;
      for (var i = 0; i < w * h; i++) {
        var t = terrain[i];
        if (t === T.WATER || t === T.ROCK) continue;
        if (simRng.chance(0.06)) {
          var vi = speciesIndex('vine');
          if (vi >= 0) {
            var cur = coverage[i * NP + vi];
            coverage[i * NP + vi] = Math.min(0.9, cur + simRng.range(0.2, 0.5));
            spread++;
          }
        }
      }
      log.push({ month: month, text: '🪢 藤蔓在 ' + spread + ' 个格子扎根，疯狂扩张！', kind: 'event' });
      dirty = true;
    }

    function speciesIndex(id) { return plants.indexOf(id); }

    function countAlive(spId) {
      var n = 0;
      for (var i = 0; i < animals.length; i++) if (animals[i].sp === spId) n++;
      return n;
    }

    // ---------- 放置 / 干预 ----------
    function place(id, count) {
      var sp = SPEC.byId(id);
      if (!sp) return 0;
      count = count || 1;
      var placed = 0;
      if (sp.type === 'plant') {
        introduced[id] = true;
        var si = speciesIndex(id);
        for (var k = 0; k < count * 4; k++) {
          var x = simRng.int(0, w - 1), y = simRng.int(0, h - 1), i = y * w + x;
          if (SPEC.terrainFit(sp, terrain[i]) <= 0.05) continue;
          var cur = coverage[i * NP + si];
          if (cur >= sp.cap) continue;
          coverage[i * NP + si] = Math.min(sp.cap, cur + 0.35);
          placed++;
          if (placed >= count) break;
        }
      } else {
        for (var m = 0; m < count * 6; m++) {
          var px = simRng.range(1, w - 1.1), py = simRng.range(1, h - 1.1);
          var ti = Math.floor(py) * w + Math.floor(px);
          if (SPEC.terrainFit(sp, terrain[ti]) <= 0) continue;
          animals.push({ id: nextId++, sp: id, x: px, y: py, age: simRng.int(0, Math.floor(sp.lifespan * 0.3)), energy: sp.M * simRng.range(0.8, 1.1) });
          placed++;
          if (placed >= count) break;
        }
      }
      if (placed > 0) dirty = true;
      return placed;
    }

    // 笔刷涂抹：在指定格子直接添加覆盖 / 放置动物（供画布交互）
    function paintAt(id, x, y, amount) {
      var sp = SPEC.byId(id);
      if (!sp) return false;
      x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
      var i = Math.floor(y) * w + Math.floor(x);
      if (sp.type === 'plant') {
        introduced[id] = true;
        var si = speciesIndex(id);
        if (SPEC.terrainFit(sp, terrain[i]) <= 0.05) return false;
        if (coverage[i * NP + si] >= sp.cap) return false;
        coverage[i * NP + si] = Math.min(sp.cap, coverage[i * NP + si] + (amount || 0.35));
        dirty = true;
        return true;
      }
      if (SPEC.terrainFit(sp, terrain[i]) <= 0) return false;
      var px = x + simRng.range(-0.3, 0.3), py = y + simRng.range(-0.3, 0.3);
      animals.push({ id: nextId++, sp: id, x: clamp(px, 0.5, w - 1.5), y: clamp(py, 0.5, h - 1.5),
        age: simRng.int(0, Math.floor(sp.lifespan * 0.2)), energy: sp.M * simRng.range(0.85, 1.1) });
      dirty = true;
      return true;
    }

    function removeAt(x, y, r) {
      r = r || 2;
      for (var yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(h - 1, Math.ceil(y + r)); yy++) {
        for (var xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(w - 1, Math.ceil(x + r)); xx++) {
          var dx = xx - x, dy = yy - y;
          if (dx * dx + dy * dy > r * r) continue;
          var i = yy * w + xx;
          for (var s = 0; s < NP; s++) coverage[i * NP + s] = 0;
        }
      }
      for (var a = animals.length - 1; a >= 0; a--) {
        var an = animals[a];
        var d2 = (an.x - x) * (an.x - x) + (an.y - y) * (an.y - y);
        if (d2 < r * r) killAnimal(a, 0.2);
      }
      dirty = true;
    }

    function fertilizeAt(x, y, r) {
      r = r || 3;
      for (var yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(h - 1, Math.ceil(y + r)); yy++) {
        for (var xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(w - 1, Math.ceil(x + r)); xx++) {
          var dx = xx - x, dy = yy - y;
          if (dx * dx + dy * dy > r * r) continue;
          nutrients[yy * w + xx] = Math.min(1, nutrients[yy * w + xx] + 0.5);
        }
      }
      dirty = true;
    }

    function killAnimal(index, carcassFrac) {
      var an = animals[index];
      if (!an || an.dead) return;
      an.dead = true;
      var i = Math.floor(an.y) * w + Math.floor(an.x);
      if (i >= 0 && i < w * h) carcass[i] = Math.min(1, carcass[i] + 0.4 * SPEC.byId(an.sp).M * carcassFrac);
      animals[index] = animals[animals.length - 1];
      animals.pop();
      dirty = true;
    }

    // ---------- 月度推进 ----------
    function step() {
      var cl = climateNow();
      var temp = cl.temp, rain = cl.rain;

      // 1) 事件到期
      for (var e = activeEvents.length - 1; e >= 0; e--) {
        var ev = activeEvents[e];
        if (month >= ev.until) {
          tempOffset -= ev.temp; rainOffset -= ev.rain;
          activeEvents.splice(e, 1);
          log.push({ month: month, text: '✅ 事件「' + ev.name + '」结束，气候恢复。', kind: 'event' });
        }
      }
      // 2) 随机自然事件（全确定性）
      if (simRng.chance(eventChance)) {
        var pool = ['drought', 'heatwave', 'bumper'];
        var rolled = simRng.pick(pool);
        addEvent(rolled);
        temp = climateNow().temp; rain = climateNow().rain;
      }

      // 3) 地块层：水分 / 养分 / 植物
      for (var i = 0; i < w * h; i++) {
        var t = terrain[i];
        var x = i % w, y = (i / w) | 0;
        var dist = world.waterDist[i];
        var waterIn = 0.50 * Math.max(0, 1 - Math.min(dist, 10) / 10);
        var evap = 0.05 + 0.004 * Math.max(0, temp - 16);
        var target = 0.85 * rain + waterIn - evap;
        if (t === T.WATER) target = 1;
        else if (t === T.SAND) target *= 0.45;
        else if (t === T.ROCK) target *= 0.55;
        else if (t === T.MARSH) target += 0.12;
        moisture[i] = clamp(moisture[i] + (target - moisture[i]) * 0.35, 0, 1);

        // 分解：尸体 → 养分
        var decay = carcass[i] * 0.10;
        nutrients[i] = clamp(nutrients[i] + decay * 0.8, 0, 1);
        carcass[i] -= decay;
        if (carcass[i] < 0.001) carcass[i] = 0;

        // 养分缓慢再生
        nutrients[i] = clamp(nutrients[i] + (0.5 - nutrients[i]) * 0.006, 0, 1);

        // 植物生长
        var totalCov = 0;
        for (var s = 0; s < NP; s++) {
          totalCov += coverage[i * NP + s];
        }
        var compet = clamp(1 - totalCov, 0, 1);
        for (var s2 = 0; s2 < NP; s2++) {
          var sp = SPEC.byId(plants[s2]);
          var cov = coverage[i * NP + s2];
          // 种子库机制：未引入的植物不生长（藤蔓由入侵事件引入）
          if (!introduced[plants[s2]]) {
            if (cov > 0) coverage[i * NP + s2] = 0;
            continue;
          }
          var tFit = SPEC.terrainFit(sp, t);
          var tempF = SPEC.tempFit(sp, temp);
          var moistF = SPEC.moistFit(sp, moisture[i]);
          var fit = tFit * tempF * moistF;
          var nutr = 0.25 + 0.75 * nutrients[i];
          if (fit > 0.055) {
            var grow = sp.growth * fit * compet * nutr * (1 - cov / sp.cap);
            coverage[i * NP + s2] = Math.min(sp.cap, cov + grow);
          } else if (cov > 0) {
            // 环境不适：缓慢枯萎
            coverage[i * NP + s2] = Math.max(0, cov - sp.growth * 0.25 * (1 - fit));
          }
        }
      }

      // 4) 动物层
      stepAnimals(temp);

      // 5) 月度推进
      month++;
      dirty = true;
      if (month % MONTHS_PER_YEAR === 0) pushHistory();
      return month;
    }

    // ---------- 动物行为 ----------
    function buildBuckets() {
      var buckets = {};
      for (var a = 0; a < animals.length; a++) {
        var an = animals[a];
        if (an.dead) continue;
        var key = (Math.floor(an.x) >> 2) + ',' + (Math.floor(an.y) >> 2);
        (buckets[key] = buckets[key] || []).push(an);
      }
      return buckets;
    }

    function stepAnimals(temp) {
      var buckets = buildBuckets();
      for (var a = 0; a < animals.length; a++) {
        var an = animals[a];
        if (an.dead) continue;
        var sp = SPEC.byId(an.sp);
        if (!sp) continue;
        an.killsThisMonth = 0; // 每月捕食次数重置
        if (an.energy <= 0 || an.age > sp.lifespan) {
          killAnimal(a, 0.5);
          a--; continue;
        }
        var tempF = SPEC.tempFit(sp, temp);
        var moistF = SPEC.moistFit(sp, moisture[Math.floor(an.y) * w + Math.floor(an.x)]);
        var fit = Math.min(tempF, moistF);
        var stress = 1 + (1 - fit) * 2.2;
        an.age++;
        an.energy -= sp.metab * stress;

        // 渴死/冻死/热死边缘
        if (fit < 0.12 && simRng.chance(0.3)) { killAnimal(a, 0.4); a--; continue; }        if (sp.type === 'predator') predatorAct(a, an, sp, buckets, temp, fit);
        else herbivoreAct(a, an, sp, buckets, temp, fit);

        // 繁殖（捕食者额外要求：视野内有足够猎物——功能响应，猎物稀缺时繁殖被抑制）
        if (an.energy > sp.reproE * sp.M && fit > 0.35) {
          var pop = countAlive(sp.id);
          var cap = speciesCap(sp);
          var density = localDensity(an, sp.id, buckets, 5);
          var densityCap = 14 + 40 / (1 + sp.M);
          var chance = sp.repro * clamp(1 - pop / cap, 0, 1) * clamp(1 - density / densityCap, 0, 1);
          if (sp.type === 'predator') {
            var preyNear = countPreyNear(an, sp, buckets, Math.max(4, sp.vision));
            if (preyNear < 3) chance = 0;
            else chance *= clamp(preyNear / 8, 0.3, 1);
            // 全局猎物/捕食者比例闸门：猎物总量不足以支撑捕食者时停止繁殖
            var hTotal = 0, pTotal = 0;
            for (var ai = 0; ai < animals.length; ai++) {
              var aSp = SPEC.byId(animals[ai].sp);
              if (!aSp) continue;
              if (aSp.type === 'herbivore') hTotal++;
              else if (aSp.type === 'predator') pTotal++;
            }
            if (hTotal < pTotal * 1.6) chance = 0;
          }
          if (simRng.chance(chance)) {
            var nx = clamp(an.x + simRng.range(-2, 2), 1, w - 1.1);
            var ny = clamp(an.y + simRng.range(-2, 2), 1, h - 1.1);
            if (SPEC.terrainFit(sp, terrain[Math.floor(ny) * w + Math.floor(nx)]) > 0) {
              animals.push({ id: nextId++, sp: sp.id, x: nx, y: ny, age: 0, energy: sp.M * 0.75 });
              an.energy -= sp.reproE * sp.M * 0.55;
            }
          }
        }
        // 能量上限
        if (an.energy > sp.M * 2.5) an.energy = sp.M * 2.5;
        if (an.energy <= 0) { killAnimal(a, 0.4); a--; }
      }
    }

    function speciesCap(sp) {
      // 全局软上限（按体型）
      if (sp.M < 0.1) return 900;
      if (sp.M < 1) return 420;
      if (sp.M < 3) return 260;
      if (sp.M < 10) return 140;
      return 60;
    }

    function countPreyNear(an, sp, buckets, radius) {
      var count = 0;
      var cx = Math.floor(an.x) >> 2, cy = Math.floor(an.y) >> 2;
      var r = Math.ceil(radius / 4);
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var key = (cx + dx) + ',' + (cy + dy);
          var cell = buckets[key];
          if (!cell) continue;
          for (var k = 0; k < cell.length; k++) {
            var other = cell[k];
            if (other.dead) continue;
            if (sp.prey && sp.prey.indexOf(other.sp) >= 0) count++;
            else {
              var os = SPEC.byId(other.sp);
              if (os && os.type === 'herbivore') count++;
            }
          }
        }
      }
      return count;
    }

    function localDensity(an, spId, buckets, radius) {
      var count = 0;
      var cx = Math.floor(an.x) >> 2, cy = Math.floor(an.y) >> 2;
      var r = Math.ceil(radius / 4);
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var key = (cx + dx) + ',' + (cy + dy);
          var cell = buckets[key];
          if (!cell) continue;
          for (var k = 0; k < cell.length; k++) {
            var other = cell[k];
            if (!other.dead && other.sp === spId) count++;
          }
        }
      }
      return count;
    }

    function tileFoodAt(sp, x, y) {
      var i = Math.floor(y) * w + Math.floor(x);
      if (i < 0 || i >= w * h) return 0;
      var t = terrain[i];
      if (SPEC.terrainFit(sp, t) <= 0) return 0;
      var best = 0;
      var diet = sp.diet || [];
      for (var d = 0; d < diet.length; d++) {
        var si = speciesIndex(diet[d]);
        if (si < 0) continue;
        var cov = coverage[i * NP + si];
        var pfood = SPEC.byId(diet[d]).food;
        var gain = cov * pfood;
        if (gain > best) best = gain;
      }
      return best;
    }

    function herbivoreAct(a, an, sp, buckets, temp, fit) {
      // （逃逸机制已移除：猎物持续觅食保持体况，捕食者靠冲刺追击取胜）
      // 找附近食物最丰富的格子并移动过去
      var bestX = an.x, bestY = an.y, bestScore = tileFoodAt(sp, an.x, an.y) * (0.6 + simRng.range(0, 0.5));
      var speed = sp.speed;
      var steps = 9;
      for (var s = 0; s < steps; s++) {
        var tx = clamp(an.x + simRng.range(-speed, speed), 0.5, w - 1.5);
        var ty = clamp(an.y + simRng.range(-speed, speed), 0.5, h - 1.5);
        var score = tileFoodAt(sp, tx, ty);
        if (score > bestScore) { bestScore = score; bestX = tx; bestY = ty; }
      }
      var dist2 = (bestX - an.x) * (bestX - an.x) + (bestY - an.y) * (bestY - an.y);
      if (dist2 > 0.01) {
        var d = Math.sqrt(dist2);
        var step = Math.min(speed, d);
        an.x += (bestX - an.x) / d * step;
        an.y += (bestY - an.y) / d * step;
      }
      // 采食：按食欲吃到能量接近上限（必须超过繁殖阈值才能繁殖）
      var appetite = Math.max(0, sp.M * 2.2 - an.energy);
      var i = Math.floor(an.y) * w + Math.floor(an.x);
      var diet = sp.diet || [];
      for (var d2 = 0; d2 < diet.length && appetite > 0.01; d2++) {
        var si = speciesIndex(diet[d2]);
        if (si < 0) continue;
        var psp = SPEC.byId(diet[d2]);
        var cov = coverage[i * NP + si];
        if (cov <= 0.01) continue;
        var want = appetite / (psp.food * 0.55);
        var eat = Math.min(want, cov * 0.6);
        if (eat <= 0) continue;
        coverage[i * NP + si] = Math.max(0, cov - eat);
        var gain = eat * psp.food * 0.55;
        an.energy += gain;
        appetite -= gain;
      }
      dirty = true;
    }

    function predatorAct(a, an, sp, buckets, temp, fit) {
      var bestPrey = null, bestDist = 1e9;
      var cx = Math.floor(an.x) >> 2, cy = Math.floor(an.y) >> 2;
      var r = Math.ceil(sp.vision / 4);
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          var key = (cx + dx) + ',' + (cy + dy);
          var cell = buckets[key];
          if (!cell) continue;
          for (var k = 0; k < cell.length; k++) {
            var prey = cell[k];
            if (prey.dead || prey.sp === sp.id || prey.energy <= 0) continue;
            var ps = SPEC.byId(prey.sp);
            if (!ps || ps.type !== 'herbivore') continue;
            if (sp.prey && sp.prey.indexOf(prey.sp) < 0) continue;
            var d2 = (prey.x - an.x) * (prey.x - an.x) + (prey.y - an.y) * (prey.y - an.y);
            if (d2 < bestDist) { bestDist = d2; bestPrey = prey; }
          }
        }
      }      if (bestPrey) {
        var dist = Math.sqrt(bestDist);
        if (dist < 2.0 && an.killsThisMonth < 3) {
          // 攻击：体型决定成功率
          var ps2 = SPEC.byId(bestPrey.sp);
          var sizeRatio = (sp.M / 2) / ps2.M;
          var chance = clamp(0.9 * sizeRatio, 0.30, 0.95);
          // 功能响应：视野内猎物稀少时猎杀成功率下降（搜索成本上升）
          var preyNear = countPreyNear(an, sp, buckets, Math.max(4, sp.vision));
          chance *= clamp(preyNear / 6, 0.3, 1);
          // 地形庇护所：猎物藏在林地/湿地时更难被捕
          var cover = terrain[Math.floor(bestPrey.y) * w + Math.floor(bestPrey.x)];
          if (cover === T.FOREST || cover === T.MARSH) chance *= 0.55;
          // 残存种群庇护：该猎物物种全球数量 < 8 时捕食者无法找到它们（藏入庇护所）
          if (countAlive(bestPrey.sp) < 8) chance = 0;
          if (simRng.chance(chance)) {
            var gained = 0.80 * Math.max(bestPrey.energy, ps2.M * 0.3);
            var ci = Math.floor(bestPrey.y) * w + Math.floor(bestPrey.x);
            if (ci >= 0 && ci < w * h) carcass[ci] = Math.min(1, carcass[ci] + 0.25 * ps2.M);
            var pi = animals.indexOf(bestPrey);
            if (pi >= 0) killAnimal(pi, 0);
            an.energy += gained;
            an.killsThisMonth++;
          } else {
            // 猎物逃脱，能量代价
            an.energy -= sp.metab * 0.6;
          }
        } else {
          // 冲刺追击（猎杀时刻速度 ×1.5）
          var step = Math.min(sp.speed * 1.5, dist);
          an.x += (bestPrey.x - an.x) / dist * step;
          an.y += (bestPrey.y - an.y) / dist * step;
        }
      } else {
        // 游荡
        var tx = clamp(an.x + simRng.range(-sp.speed, sp.speed), 0.5, w - 1.5);
        var ty = clamp(an.y + simRng.range(-sp.speed, sp.speed), 0.5, h - 1.5);
        if (SPEC.terrainFit(sp, terrain[Math.floor(ty) * w + Math.floor(tx)]) > 0) { an.x = tx; an.y = ty; }
      }
      dirty = true;
    }

    // ---------- 统计 ----------
    function computeStats() {
      var counts = {}, biomass = {}, plantCov = {};
      var totalPlantBio = 0, totalAnimalBio = 0;
      var nutrSum = 0, moistSum = 0;
      var n = w * h;
      for (var s = 0; s < NP; s++) {
        var sp = SPEC.byId(plants[s]);
        var covSum = 0;
        for (var i = 0; i < n; i++) covSum += coverage[i * NP + s];
        plantCov[plants[s]] = covSum;
        biomass[plants[s]] = covSum * sp.food;
        totalPlantBio += covSum * sp.food;
      }
      for (var a = 0; a < animals.length; a++) {
        var an = animals[a];
        counts[an.sp] = (counts[an.sp] || 0) + 1;
        biomass[an.sp] = (biomass[an.sp] || 0) + an.energy;
        totalAnimalBio += an.energy;
      }
      var aliveCount = 0;
      for (var k in biomass) if (biomass[k] > 0.001) aliveCount++;
      var shannon = 0;
      var totalBio = totalPlantBio + totalAnimalBio;
      if (totalBio > 0) {
        for (var k2 in biomass) {
          var p = biomass[k2] / totalBio;
          if (p > 0) shannon -= p * Math.log(p);
        }
      }
      for (var q = 0; q < n; q++) { nutrSum += nutrients[q]; moistSum += moisture[q]; }
      return {
        month: month, year: yearOf(month), season: seasonOf(month),
        totalBiomass: totalBio, plantBiomass: totalPlantBio, animalBiomass: totalAnimalBio,
        aliveSpecies: aliveCount, shannon: shannon,
        nutrientsAvg: nutrSum / n, moistureAvg: moistSum / n,
        counts: counts, plantCov: plantCov, animalsTotal: animals.length
      };
    }

    function pushHistory() {
      var st = computeStats();
      history.push({
        year: st.year,
        biomass: st.totalBiomass,
        plant: st.plantBiomass,
        animal: st.animalBiomass,
        species: st.aliveSpecies,
        counts: Object.assign({}, st.counts)
      });
      if (history.length > 600) history.shift();
    }

    function stability() {
      // 近 36 年生物量变异系数的倒数（0~1）
      var recent = history.slice(-36);
      if (recent.length < 12) return 0.5;
      var vals = recent.map(function (r) { return r.biomass; });
      var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      if (mean <= 0) return 0;
      var varr = vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / vals.length;
      var cv = Math.sqrt(varr) / mean;
      return clamp(1 - cv * 1.6, 0, 1);
    }

    function getStats() {
      var st = computeStats();
      st.temp = climateNow().temp;
      st.rain = climateNow().rain;
      st.stability = stability();
      st.activeEvents = activeEvents.map(function (e) { return { name: e.name, until: e.until, desc: e.desc }; });
      return st;
    }

    // ---------- 序列化（种子 + 操作日志重放，见 main.js） ----------
    function serialize() {
      return {
        seed: seed, w: w, h: h, month: month,
        tempOffset: tempOffset, rainOffset: rainOffset,
        animals: animals.map(function (a) { return [a.id, a.sp, +a.x.toFixed(3), +a.y.toFixed(3), a.age, +a.energy.toFixed(3)]; }),
        history: history
      };
    }

    return {
      seed: seed, w: w, h: h,
      world: world,
      place: place, paintAt: paintAt, removeAt: removeAt, fertilizeAt: fertilizeAt,
      triggerEvent: addEvent,
      step: step,
      get month() { return month; },
      get year() { return yearOf(month); },
      get animals() { return animals; },
      get coverage() { return coverage; },
      get carcass() { return carcass; },
      get moisture() { return moisture; },
      get nutrients() { return nutrients; },
      get terrain() { return terrain; },
      get events() { return activeEvents; },
      get log() { return log; },
      getStats: getStats, getHistory: function () { return history; },
      stability: stability,
      speciesCount: countAlive,
      serialize: serialize
    };
  }

  return { createSim: createSim, MONTHS_PER_YEAR: MONTHS_PER_YEAR, SEASONS: SEASONS };
});
