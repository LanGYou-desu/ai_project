/* ECO-ARK · 生态仿真引擎（浏览器 + Node 双端 UMD）
 * 模型：生产者(植物) → 消费者(食草/捕食) → 分解者(腐殖质) 的能量流动；
 * 水分/养分/气温驱动的种群动力学；洛特卡-沃尔泰拉式的波动自然涌现。
 * 全确定性：同一种子 + 相同操作序列 → 完全相同的演化结果。
 *
 * 性能约定：
 *  - 逐格植物生长使用静态地形适配查表 + 每步温度适配查表，避免逐格调用函数；
 *  - 空间分桶每月重建一次，桶内维护「物种计数 / 食草计数」，邻域查询为 O(桶数)；
 *  - 存活数量（全局与分桶）随出生/死亡增量维护，避免每次 O(n) 重扫；
 *  - getStats() 结果按 dirty 标记缓存，同一模拟步内多次读取只计算一次。
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
  var TERRAIN_CODES = 6;

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

    // 植物覆盖：tile * nSpecies
    var plantSpecs = SPEC.PLANTS;
    var plants = plantSpecs.map(function (s) { return s.id; });
    var NP = plants.length;
    var coverage = new Float32Array(w * h * NP);
    var carcass = new Float32Array(w * h); // 尸体/落叶 → 分解为养分
    var moisture = Float32Array.from(world.moisture);
    var nutrients = Float32Array.from(world.nutrients);
    var terrain = world.terrain;

    // 静态查表：物种下标 × 地形编码 → 地形适配度（地形不随季节变化）
    // 用 Float64Array 保持与原实现完全一致的浮点精度（Float32 舍入会改变演化结果）
    var terrainFitTable = new Float64Array(NP * TERRAIN_CODES);
    for (var ps = 0; ps < NP; ps++) {
      for (var tc = 0; tc < TERRAIN_CODES; tc++) {
        terrainFitTable[ps * TERRAIN_CODES + tc] = SPEC.terrainFit(plantSpecs[ps], tc);
      }
    }
    // 每步刷新：物种下标 → 温度适配度（温度对全图相同）
    var tempFitStep = new Float64Array(NP);
    // 湿度舒适区中点/半宽（内联 fit01，省去逐格函数调用；数值与 SPEC.moistFit 完全一致）
    var moistMid = new Float64Array(NP), moistSpan = new Float64Array(NP);
    for (var mi = 0; mi < NP; mi++) {
      var msp = plantSpecs[mi];
      moistMid[mi] = (msp.moistMin + msp.moistMax) / 2;
      moistSpan[mi] = (msp.moistMax - msp.moistMin) / 2;
    }

    // 食性查表：动物 id → 可食植物的下标数组
    var dietIdx = {};
    SPEC.ANIMALS.forEach(function (sp) {
      if (!sp.diet) return;
      dietIdx[sp.id] = sp.diet.map(function (id) { return plants.indexOf(id); })
        .filter(function (si) { return si >= 0; });
    });

    // 动物实体
    var animals = []; // {id, sp, x, y, age, energy}
    var nextId = 1;
    // 存活计数：增量维护，countAlive 与繁殖闸门不再重扫全表
    var spAlive = {};
    var herbTotal = 0, predTotal = 0;
    // 空间分桶：整数桶号 + 类型化计数数组，邻域查询无字符串拼接
    var spIdxAll = {};   // 物种 id → 紧凑下标
    SPEC.ALL.forEach(function (s, i) { spIdxAll[s.id] = i; });
    var NS = SPEC.ALL.length;
    var BX = Math.ceil(w / 4) + 1, BY = Math.ceil(h / 4) + 1;
    var NB = BX * BY;
    var bucketList = new Array(NB);      // 桶号 → 动物数组（每月复用）
    var bucketSp = new Int32Array(NB * NS); // 桶号 × 物种 → 个体数
    var bucketHerb = new Int32Array(NB);    // 桶号 → 食草动物数
    var bucketUsed = new Uint8Array(NB);    // 本月该桶是否已登记
    var bucketKeys = [];                    // 本月使用的桶号（用于清空）
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
      var phase = ((m - 2) / MONTHS_PER_YEAR) * Math.PI * 2; // 2 月最热、8 月最冷
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
      dirty = true; // 气温/降水已改变，统计缓存必须失效
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
        if (!sp || sp.type === 'plant') continue;
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
      var targetSp = SPEC.byId(target);
      log.push({ month: month, text: '🦠 瘟疫袭击了「' + (targetSp ? targetSp.name : target) + '」，约 ' + killed + ' 只死亡。', kind: 'event' });
      dirty = true;
    }

    function vineStrike() {
      introduced.vine = true;
      var spread = 0;
      var vi = speciesIndex('vine');
      for (var i = 0; i < w * h; i++) {
        var t = terrain[i];
        if (t === T.WATER || t === T.ROCK) continue;
        if (simRng.chance(0.06) && vi >= 0) {
          var cur = coverage[i * NP + vi];
          coverage[i * NP + vi] = Math.min(0.9, cur + simRng.range(0.2, 0.5));
          spread++;
        }
      }
      log.push({ month: month, text: '🪢 藤蔓在 ' + spread + ' 个格子扎根，疯狂扩张！', kind: 'event' });
      dirty = true;
    }

    function speciesIndex(id) { return plants.indexOf(id); }

    function countAlive(spId) { return spAlive[spId] || 0; }

    // ---------- 出生 / 死亡（存活计数的唯一入口） ----------
    function spawn(spId, x, y, age, energy) {
      var an = { id: nextId++, sp: spId, x: x, y: y, age: age, energy: energy };
      animals.push(an);
      spAlive[spId] = (spAlive[spId] || 0) + 1;
      var sp = SPEC.byId(spId);
      if (sp) {
        if (sp.type === 'herbivore') herbTotal++;
        else if (sp.type === 'predator') predTotal++;
      }
      return an;
    }

    function killAnimal(index, carcassFrac) {
      var an = animals[index];
      if (!an || an.dead) return;
      an.dead = true;
      var i = Math.floor(an.y) * w + Math.floor(an.x);
      var sp = SPEC.byId(an.sp);
      if (sp && i >= 0 && i < w * h) carcass[i] = Math.min(1, carcass[i] + 0.4 * sp.M * carcassFrac);
      if (spAlive[an.sp]) spAlive[an.sp]--;
      if (sp) {
        if (sp.type === 'herbivore') herbTotal--;
        else if (sp.type === 'predator') predTotal--;
      }
      // 同步本月分桶计数（分桶只在本月内被读取，下月重建会覆盖）
      var bk = an._bk;
      if (bk != null) {
        var si = spIdxAll[an.sp];
        if (si != null) {
          var bi = bk * NS + si;
          if (bucketSp[bi] > 0) bucketSp[bi]--;
        }
        if (sp && sp.type === 'herbivore' && bucketHerb[bk] > 0) bucketHerb[bk]--;
      }
      animals[index] = animals[animals.length - 1];
      animals.pop();
      dirty = true;
    }

    // ---------- 放置 / 干预 ----------
    function place(id, count) {
      var sp = SPEC.byId(id);
      if (!sp) return 0;
      if (count == null) count = 1;
      if (count <= 0) return 0;
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
          spawn(id, px, py, simRng.int(0, Math.floor(sp.lifespan * 0.3)), sp.M * simRng.range(0.8, 1.1));
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
        if (amount == null) amount = 0.35;
        coverage[i * NP + si] = Math.min(sp.cap, coverage[i * NP + si] + amount);
        dirty = true;
        return true;
      }
      if (SPEC.terrainFit(sp, terrain[i]) <= 0) return false;
      var px = x + simRng.range(-0.3, 0.3), py = y + simRng.range(-0.3, 0.3);
      spawn(id, clamp(px, 0.5, w - 1.5), clamp(py, 0.5, h - 1.5),
        simRng.int(0, Math.floor(sp.lifespan * 0.2)), sp.M * simRng.range(0.85, 1.1));
      dirty = true;
      return true;
    }

    function removeAt(x, y, r) {
      if (r == null) r = 2;
      if (r <= 0) return;
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
      if (r == null) r = 3;
      if (r <= 0) return;
      for (var yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(h - 1, Math.ceil(y + r)); yy++) {
        for (var xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(w - 1, Math.ceil(x + r)); xx++) {
          var dx = xx - x, dy = yy - y;
          if (dx * dx + dy * dy > r * r) continue;
          nutrients[yy * w + xx] = Math.min(1, nutrients[yy * w + xx] + 0.5);
        }
      }
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
      // 温度对全图一致：每步只计算一次每个物种的温度适配
      for (var ts = 0; ts < NP; ts++) tempFitStep[ts] = SPEC.tempFit(plantSpecs[ts], temp);
      var tiles = w * h;
      for (var i = 0; i < tiles; i++) {
        var t = terrain[i];
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
        var base = i * NP;
        var mm = moisture[i];
        var totalCov = 0;
        for (var s = 0; s < NP; s++) totalCov += coverage[base + s];
        var compet = clamp(1 - totalCov, 0, 1);
        var nutr = 0.25 + 0.75 * nutrients[i];
        var tileFit = t < TERRAIN_CODES ? t : 0;
        for (var s2 = 0; s2 < NP; s2++) {
          var sp = plantSpecs[s2];
          var cov = coverage[base + s2];
          // 种子库机制：未引入的植物不生长（藤蔓由入侵事件引入）
          if (!introduced[plants[s2]]) {
            if (cov > 0) coverage[base + s2] = 0;
            continue;
          }
          // 内联 fit01(mm, moistMin, moistMax)，数值与 SPEC.moistFit 完全一致
          var mspan = moistSpan[s2], mfit;
          if (mspan <= 0) mfit = 1;
          else {
            var md = Math.abs(mm - moistMid[s2]) / mspan;
            mfit = md >= 1 ? 0 : 1 - md;
          }
          var fit = terrainFitTable[s2 * TERRAIN_CODES + tileFit] * tempFitStep[s2] * mfit;
          if (fit > 0.055) {
            var grow = sp.growth * fit * compet * nutr * (1 - cov / sp.cap);
            coverage[base + s2] = Math.min(sp.cap, cov + grow);
          } else if (cov > 0) {
            // 环境不适：缓慢枯萎
            coverage[base + s2] = Math.max(0, cov - sp.growth * 0.25 * (1 - fit));
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
    // 桶号 = bx * BY + by（bx/by 为 4 格一桶的网格坐标）
    function buildBuckets() {
      // 清空上个月的桶（数组与计数复用，避免每月重新分配）
      for (var i = 0; i < bucketKeys.length; i++) {
        var k = bucketKeys[i];
        var list = bucketList[k];
        if (list) list.length = 0;
        bucketHerb[k] = 0;
        bucketUsed[k] = 0;
        var off = k * NS;
        for (var s = 0; s < NS; s++) bucketSp[off + s] = 0;
      }
      bucketKeys.length = 0;
      for (var a = 0; a < animals.length; a++) {
        var an = animals[a];
        if (an.dead) continue;
        var bx = Math.floor(an.x) >> 2, by = Math.floor(an.y) >> 2;
        if (bx < 0) bx = 0; else if (bx >= BX) bx = BX - 1;
        if (by < 0) by = 0; else if (by >= BY) by = BY - 1;
        var key = bx * BY + by;
        var cell = bucketList[key];
        if (!cell) cell = bucketList[key] = [];
        if (!bucketUsed[key]) { bucketUsed[key] = 1; bucketKeys.push(key); }
        cell.push(an);
        an._bk = key;
        var si = spIdxAll[an.sp];
        if (si == null) si = 0;
        bucketSp[key * NS + si]++;
        var asp = SPEC.ALL[si];
        if (asp.type === 'herbivore') bucketHerb[key]++;
      }
    }

    function stepAnimals(temp) {
      buildBuckets();
      for (var a = 0; a < animals.length; a++) {
        var an = animals[a];
        if (an.dead) continue;
        var sp = SPEC.byId(an.sp);
        if (!sp) continue;
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
        if (fit < 0.12 && simRng.chance(0.3)) { killAnimal(a, 0.4); a--; continue; }
        if (sp.type === 'predator') predatorAct(a, an, sp, temp, fit);
        else herbivoreAct(a, an, sp, temp, fit);

        // 繁殖（捕食者额外要求：视野内有足够猎物——功能响应，猎物稀缺时繁殖被抑制）
        if (an.energy > sp.reproE * sp.M && fit > 0.35) {
          var pop = spAlive[sp.id] || 0;
          var cap = speciesCap(sp);
          var density = localDensity(an, sp.id, 5);
          var densityCap = 14 + 40 / (1 + sp.M);
          var chance = sp.repro * clamp(1 - pop / cap, 0, 1) * clamp(1 - density / densityCap, 0, 1);
          if (sp.type === 'predator') {
            var preyNear = countPreyNear(an, Math.max(4, sp.vision));
            if (preyNear < 3) chance = 0;
            else chance *= clamp(preyNear / 8, 0.3, 1);
            // 全局猎物/捕食者比例闸门：猎物总量不足以支撑捕食者时停止繁殖
            if (herbTotal < predTotal * 1.6) chance = 0;
          }
          if (simRng.chance(chance)) {
            var nx = clamp(an.x + simRng.range(-2, 2), 1, w - 1.1);
            var ny = clamp(an.y + simRng.range(-2, 2), 1, h - 1.1);
            if (SPEC.terrainFit(sp, terrain[Math.floor(ny) * w + Math.floor(nx)]) > 0) {
              spawn(sp.id, nx, ny, 0, sp.M * 0.75);
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

    // 邻域食草动物数量（功能响应）：桶内已维护食草计数，复杂度 O(桶数)
    function countPreyNear(an, radius) {
      var count = 0;
      var bx = Math.floor(an.x) >> 2, by = Math.floor(an.y) >> 2;
      var r = Math.ceil(radius / 4);
      var y0 = Math.max(0, by - r), y1 = Math.min(BY - 1, by + r);
      var x0 = Math.max(0, bx - r), x1 = Math.min(BX - 1, bx + r);
      for (var xx = x0; xx <= x1; xx++) {
        var row = xx * BY;
        for (var yy = y0; yy <= y1; yy++) count += bucketHerb[row + yy];
      }
      return count;
    }

    // 邻域同种个体数量：桶内已维护物种计数，复杂度 O(桶数)
    function localDensity(an, spId, radius) {
      var count = 0;
      var si = spIdxAll[spId];
      if (si == null) return 0;
      var bx = Math.floor(an.x) >> 2, by = Math.floor(an.y) >> 2;
      var r = Math.ceil(radius / 4);
      var y0 = Math.max(0, by - r), y1 = Math.min(BY - 1, by + r);
      var x0 = Math.max(0, bx - r), x1 = Math.min(BX - 1, bx + r);
      for (var xx = x0; xx <= x1; xx++) {
        var row = xx * BY * NS + si;
        for (var yy = y0; yy <= y1; yy++) count += bucketSp[row + yy * NS];
      }
      return count;
    }

    function tileFoodAt(sp, x, y) {
      var i = Math.floor(y) * w + Math.floor(x);
      if (i < 0 || i >= w * h) return 0;
      var t = terrain[i];
      if (SPEC.terrainFit(sp, t) <= 0) return 0;
      var idxs = dietIdx[sp.id];
      if (!idxs) return 0;
      var best = 0;
      var base = i * NP;
      for (var d = 0; d < idxs.length; d++) {
        var si = idxs[d];
        var gain = coverage[base + si] * plantSpecs[si].food;
        if (gain > best) best = gain;
      }
      return best;
    }

    function herbivoreAct(a, an, sp, temp, fit) {
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
      var base = i * NP;
      var idxs = dietIdx[sp.id] || [];
      for (var d2 = 0; d2 < idxs.length && appetite > 0.01; d2++) {
        var si = idxs[d2];
        var psp = plantSpecs[si];
        var cov = coverage[base + si];
        if (cov <= 0.01) continue;
        var want = appetite / (psp.food * 0.55);
        var eat = Math.min(want, cov * 0.6);
        if (eat <= 0) continue;
        coverage[base + si] = Math.max(0, cov - eat);
        var gain = eat * psp.food * 0.55;
        an.energy += gain;
        appetite -= gain;
      }
      dirty = true;
    }

    function predatorAct(a, an, sp, temp, fit) {
      var bestPrey = null, bestDist = 1e9;
      var bx = Math.floor(an.x) >> 2, by = Math.floor(an.y) >> 2;
      var r = Math.ceil(sp.vision / 4);
      var y0 = Math.max(0, by - r), y1 = Math.min(BY - 1, by + r);
      var x0 = Math.max(0, bx - r), x1 = Math.min(BX - 1, bx + r);
      // 遍历顺序与原实现一致（dy 外层、dx 内层），保证同距目标的取舍完全相同
      for (var yy = y0; yy <= y1; yy++) {
        for (var xx = x0; xx <= x1; xx++) {
          var cell = bucketList[xx * BY + yy];
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
      }
      if (bestPrey) {
        var dist = Math.sqrt(bestDist);
        if (dist < 2.0) {
          // 攻击：体型决定成功率
          var ps2 = SPEC.byId(bestPrey.sp);
          var sizeRatio = (sp.M / 2) / ps2.M;
          var chance = clamp(0.9 * sizeRatio, 0.30, 0.95);
          // 功能响应：视野内猎物稀少时猎杀成功率下降（搜索成本上升）
          var preyNear = countPreyNear(an, Math.max(4, sp.vision));
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
        var sp = plantSpecs[s];
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

    // 统计缓存：同一模拟步内（状态未改动时）多次读取只计算一次
    function getStats() {
      if (!dirty && statsCache) return statsCache;
      var st = computeStats();
      var cl = climateNow();
      st.temp = cl.temp;
      st.rain = cl.rain;
      st.stability = stability();
      st.activeEvents = activeEvents.map(function (e) { return { name: e.name, until: e.until, desc: e.desc }; });
      statsCache = st;
      dirty = false;
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
