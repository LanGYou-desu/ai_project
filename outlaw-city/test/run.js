'use strict';
/* OUTLAW CITY 3D · 零依赖测试：node test/run.js
 *
 * 用浏览器桩（2D/WebGL 上下文 Proxy、DOM 元素桩、可派发事件的监听器）按 index.html 的顺序
 * 加载全部前端脚本，然后对纯逻辑（数学/地图/输入/载具/战斗/任务状态机/警察/NPC 生命周期）
 * 做真实断言，并让主循环 tick + 3D 渲染路径连续跑若干帧确认不抛异常。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* ---------------- 断言 ---------------- */
let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed++; } else { failed++; console.log('  ✗ ' + msg); } }
function eq(a, b, msg) { ok(a === b, (msg || '') + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function near(a, b, tol, msg) { tol = tol == null ? 1e-6 : tol; ok(Math.abs(a - b) <= tol, (msg || '') + ' (got ' + a + ', want ' + b + ')'); }
function section(name) { console.log('\n== ' + name + ' =='); }
// three.js 会在桩环境下打印扩展缺失/上下文失败的告警，测试期间静音以免干扰结果输出
function silence(fn) {
  const w = console.warn, e = console.error;
  console.warn = function () {}; console.error = function () {};
  try { return fn(); } finally { console.warn = w; console.error = e; }
}

/* ---------------- 浏览器桩 ---------------- */
function makeGL(canvas) {
  const gl = new Proxy({}, {
    get(t, p) {
      if (typeof p === 'symbol') return undefined;
      if (p === 'canvas') return canvas;
      if (/^[A-Z][A-Z0-9_]*$/.test(p)) return 1;                       // WebGL 枚举常量
      if (p === 'getParameter') return function (x) {
        if (x === 7938) return 'WebGL 1.0';                             // VERSION
        if (x === 35724) return 'WebGL GLSL ES 1.0';                    // SHADING_LANGUAGE_VERSION
        return 4096;
      };
      if (p === 'getShaderPrecisionFormat') return function () { return { rangeMin: 127, rangeMax: 127, precision: 23 }; };
      if (p === 'getExtension') return function () { return null; };
      if (p === 'getShaderParameter' || p === 'getProgramParameter') return function () { return true; };
      if (p === 'getShaderInfoLog' || p === 'getProgramInfoLog') return function () { return ''; };
      if (p === 'getError') return function () { return 0; };
      if (p === 'getUniformLocation') return function () { return { loc: 1 }; };
      if (p === 'getAttribLocation') return function () { return 0; };
      if (/^create/.test(p)) return function () { return { id: 1 }; };
      return function () { return gl; };
    },
    set() { return true; },
  });
  return gl;
}
function make2D(canvas) {
  return new Proxy({}, {
    get(t, p) {
      if (typeof p === 'symbol') return undefined;
      if (p === 'canvas') return canvas;
      if (p === 'measureText') return function () { return { width: 40 }; };
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return function () { return { addColorStop: function () {} }; };
      return function () { return undefined; };
    },
    set() { return true; },
  });
}
function makeEl(id, w, h) {
  const el = {
    id: id, width: w === undefined ? 1280 : w, height: h === undefined ? 720 : h,
    style: {}, dataset: {}, textContent: '', innerHTML: '', hidden: false,
    _h: {},
    getContext: function (type) { return type === '2d' ? make2D(el) : makeGL(el); },
    addEventListener: function (type, fn) { (el._h[type] = el._h[type] || []).push(fn); },
    removeEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: el.width, height: el.height }; },
    appendChild: function (c) { return c; },
    removeChild: function () {},
    querySelector: function () { return makeEl('q'); },
    querySelectorAll: function () { return []; },
    requestPointerLock: function () { return undefined; },
    click: function () {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {} },
  };
  el.parentElement = el;
  return el;
}
function fire(target, type, ev) {
  const hs = target && target._h && target._h[type];
  if (!hs) return 0;
  for (const h of hs) h(ev || {});
  return hs.length;
}
function fireWin(type, ev) {
  const hs = winH[type];
  if (!hs) return 0;
  for (const h of hs) h(ev || {});
  return hs.length;
}

const els = {};
const winH = {};
const docH = {};

global.window = global;
global.self = global;
global.addEventListener = function (type, fn) { (winH[type] = winH[type] || []).push(fn); };
global.removeEventListener = function () {};
global.requestAnimationFrame = function () { return 1; };
global.cancelAnimationFrame = function () {};
global.devicePixelRatio = 1;
global.document = {
  readyState: 'complete',
  addEventListener: function (type, fn) { (docH[type] = docH[type] || []).push(fn); },
  removeEventListener: function () {},
  createElement: function (tag) { return makeEl(tag, 190, 190); },
  getElementById: function (id) {
    if (!els[id]) els[id] = makeEl(id, 1280, 720);
    return els[id];
  },
  querySelector: function () { return makeEl('q'); },
  querySelectorAll: function () { return []; },
  pointerLockElement: null,
  exitPointerLock: function () {},
};
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.performance = { now: function () { return Date.now(); } };
global.console = console;
// 不使用 AudioContext：顺带覆盖 AudioSys 在无 WebAudio 环境下的降级路径

/* 固定随机数种子，保证失败可复现 */
let seed = 20240613;
Math.random = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

/* ---------------- 按 index.html 顺序加载 ---------------- */
function scriptSrcs() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
function loadScript(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error('缺少脚本文件: ' + rel);
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: rel });
}

section('脚本加载与全局命名空间');
const srcs = scriptSrcs();
eq(srcs.length, 14, 'index.html 引用脚本数量（three.min.js + 13 个 js 模块）');
for (const s of srcs) {
  let err = null;
  silence(function () {
    try { loadScript(s); } catch (e) { err = e; }
  });
  ok(!err, '加载 ' + s + (err ? ' 失败: ' + err.message : ''));
}
for (const name of ['Utils', 'CFG', 'Input', 'AudioSys', 'MapSys', 'Player', 'Vehicle', 'NPC', 'Pickup',
  'Combat', 'Mission', 'Missions', 'PoliceSys', 'HUD', 'Render3D', 'W', 'boot', 'makeTrafficAI', 'makePoliceAI', 'makeEscortAI']) {
  // 前端脚本用顶层 const/class 声明，属于全局词法作用域而不是 globalThis 的属性
  ok(vm.runInThisContext('typeof ' + name) !== 'undefined', '全局命名空间存在 ' + name);
}
ok(typeof THREE !== 'undefined' && THREE.REVISION === '128', 'three.js 本地化版本为 r128');
ok(W.player !== null && MapSys.data !== null, 'readyState=complete 时 boot() 已自动初始化世界');
ok(Render3D.disabled === false, 'WebGL 桩可用时 3D 渲染器正常初始化');
eq(AudioSys.enabled, false, '无 WebAudio 时音频自动降级为静音');
let audioThrew = false;
try { AudioSys.tone(440, 0.1, 0.2); AudioSys.sirenStart(); AudioSys.engineStart(); AudioSys.engineStop(); AudioSys.sirenStop(); } catch (e) { audioThrew = true; }
ok(!audioThrew, '音频降级后各接口调用不抛异常');

/* ---------------- 数学工具 ---------------- */
section('数学工具');
eq(Utils.clamp(5, 0, 3), 3, 'clamp 上界');
eq(Utils.clamp(-5, 0, 3), 0, 'clamp 下界');
eq(Utils.clamp(2, 0, 3), 2, 'clamp 区间内');
eq(Utils.lerp(0, 10, 0.25), 2.5, 'lerp');
eq(Utils.dist(0, 0, 3, 4), 5, 'dist');
eq(Utils.dist2(0, 0, 3, 4), 25, 'dist2');
near(Utils.angleTo(0, 0, 1, 1), Math.PI / 4, 1e-12, 'angleTo 45°');
near(Utils.angleDiff(Math.PI * 3), Math.PI, 1e-12, 'angleDiff 归一到 ±π');
near(Utils.angleDiff(-Math.PI * 3), -Math.PI, 1e-12, 'angleDiff 负方向归一');
eq(Utils.angleDiff(Infinity), 0, 'angleDiff(Infinity) 不进入死循环（返回 0）');
eq(Utils.angleDiff(NaN), 0, 'angleDiff(NaN) 返回 0');
near(Utils.angleLerp(0, Math.PI / 2, 0.5), Math.PI / 4, 1e-12, 'angleLerp 走最短弧');
eq(Utils.hypot(3, 4), 5, 'hypot');
eq(Utils.fmtMoney(1234.7), '$1,234', 'fmtMoney');
for (let i = 0; i < 200; i++) {
  const v = Utils.randInt(4, 9);
  if (v < 4 || v > 9) { ok(false, 'randInt 越界: ' + v); break; }
}
ok(true, 'randInt 200 次均落在 [4,9]');
ok(['a', 'b'].indexOf(Utils.choice(['a', 'b'])) >= 0, 'choice 返回数组成员');

/* ---------------- 地图生成与碰撞 ---------------- */
section('地图生成与碰撞');
const D = MapSys.data;
eq(D.worldW, CFG.WORLD.cols * CFG.WORLD.cell, '世界宽度 = cols × cell');
eq(D.worldH, CFG.WORLD.rows * CFG.WORLD.cell, '世界高度 = rows × cell');
eq(D.roadsV.length, CFG.WORLD.cols + 1, '纵向道路数量');
eq(D.roadsH.length, CFG.WORLD.rows + 1, '横向道路数量');
ok(D.buildings.length > 50, '生成了建筑 (' + D.buildings.length + ' 栋)');
ok(D.parks.length >= 8, '固定公园地块至少 8 个 (' + D.parks.length + ')');
ok(D.lamps.length > 50, '生成了街灯 (' + D.lamps.length + ' 盏)');
ok(D.trees.length > 20, '公园里生成了树 (' + D.trees.length + ' 棵)');
ok(MapSys.mini && MapSys.mini.width === 190, '小地图位图已生成');
const cc = MapSys.cellCenter(3, 7);
near(cc.x, 3 * CFG.WORLD.cell + CFG.WORLD.cell / 2, 1e-9, 'cellCenter x');
near(cc.y, 7 * CFG.WORLD.cell + CFG.WORLD.cell / 2, 1e-9, 'cellCenter y');
const b0 = D.buildings[0];
ok(MapSys.isBlocked(b0.x + b0.w / 2, b0.y + b0.h / 2) === true, '建筑中心被判定为阻挡');
ok(MapSys.isBlocked(2, 2) === true, '世界边界外被判定为阻挡');
ok(MapSys.isBlocked(D.worldW / 2, D.roadsH[6]) === false, '道路中心可通行');
const outA = { x: 0, y: 0, hit: false };
const resA = MapSys.resolve(b0.x + b0.w / 2, b0.y + b0.h / 2, 11, outA);
ok(resA === outA, 'resolve 返回调用方传入的 out（可复用，零分配）');
eq(resA.hit, true, 'resolve 标记发生了推挤');
ok(resA.x !== b0.x + b0.w / 2 || resA.y !== b0.y + b0.h / 2, 'resolve 把实体推出了建筑内部');
let resolvedClean = 0, cleanCase = null;
for (const b of D.buildings) {
  const o = { x: 0, y: 0, hit: false };
  MapSys.resolve(b.x + b.w / 2, b.y + b.h / 2, 11, o);
  if (!MapSys.isBlocked(o.x, o.y)) { resolvedClean++; if (!cleanCase) cleanCase = { b: b, o: o }; }
}
ok(cleanCase !== null, '存在解算到可通行位置的建筑');
ok(!(cleanCase.o.x > cleanCase.b.x && cleanCase.o.x < cleanCase.b.x + cleanCase.b.w &&
     cleanCase.o.y > cleanCase.b.y && cleanCase.o.y < cleanCase.b.y + cleanCase.b.h), '解算结果落在建筑之外');
ok(resolvedClean / D.buildings.length > 0.95, '全部建筑中心的解算收敛率 > 95%（' + resolvedClean + '/' + D.buildings.length + '，重叠建筑会残留极少数夹缝）');
const outB = { x: 0, y: 0, hit: true };
const resB = MapSys.resolve(D.worldW / 2, D.roadsH[6], 11, outB);
eq(resB.hit, false, '空地 resolve 不产生位移');
let walkOk = true;
for (let i = 0; i < 60; i++) {
  const p = MapSys.randomWalkablePoint();
  if (MapSys.isBlocked(p.x, p.y) || !isFinite(p.x) || !isFinite(p.y)) { walkOk = false; break; }
}
ok(walkOk, 'randomWalkablePoint 60 次都落在可通行位置');
const rp = MapSys.randomRoadPoint();
ok(rp.axis === 'v' || rp.axis === 'h', 'randomRoadPoint 返回轴向');
near(Math.abs(rp.lane), CFG.WORLD.road / 4, 1e-9, 'randomRoadPoint 车道偏移 = road/4');
const nearPt = MapSys.walkableNear(D.buildings[0].x, D.buildings[0].y, 60);
ok(!MapSys.isBlocked(nearPt.x, nearPt.y), 'walkableNear 返回可通行点');

/* ---------------- 输入映射 ---------------- */
section('输入映射');
const hudCanvas = els.hud;
fire(hudCanvas, 'mousemove', { clientX: 640, clientY: 360, movementX: 0, movementY: 0 });
eq(Input.mouse.x, 640, '鼠标坐标按画布缩放换算');
eq(Input.mouse.y, 360, '鼠标 Y 坐标');
Input.locked = true;
fire(hudCanvas, 'mousemove', { clientX: 700, clientY: 360, movementX: 12, movementY: -4 });
eq(Input.dx, 12, '锁定后累计 movementX');
eq(Input.dy, -4, '锁定后累计 movementY');
Input.locked = false;
Input.dx = 0; Input.dy = 0;
fireWin('keydown', { code: 'KeyW', repeat: false, preventDefault: function () {} });
eq(Input.keys.KeyW, true, 'keydown 置位 keys');
eq(Input.pressed.KeyW, true, 'keydown 置位 pressed');
eq(Input.consume('KeyW'), true, 'consume 取出一次按下');
eq(Input.consume('KeyW'), false, 'consume 只生效一次');
fireWin('keydown', { code: 'Space', repeat: false, preventDefault: function () {} });
fireWin('keydown', { code: 'KeyW', repeat: true, preventDefault: function () {} });
eq(Input.pressed.KeyW, undefined, 'repeat 的按键不重复触发 pressed');
fireWin('keyup', { code: 'KeyW' });
eq(Input.keys.KeyW, false, 'keyup 复位 keys');
fire(hudCanvas, 'wheel', { deltaY: 100, preventDefault: function () {} });
eq(Input.wheel, 1, '滚轮累加方向');
fire(hudCanvas, 'mousedown', { button: 0 });
eq(Input.mouse.down, true, '左键按下置位 mouse.down');
eq(Input.suppressShot, true, '未锁定鼠标时点击会屏蔽第一枪');
fireWin('mouseup', { button: 0 });
eq(Input.mouse.down, false, '左键抬起复位 mouse.down');
fireWin('keydown', { code: 'KeyA', repeat: false, preventDefault: function () {} });
fireWin('blur', {});
eq(Input.keys.KeyA, undefined, '窗口失焦清空按键');
Input.clearPressed();
eq(Input.wheel, 0, 'clearPressed 清空滚轮');
fire(hudCanvas, 'contextmenu', { preventDefault: function () {} });
ok(true, 'contextmenu 处理不抛异常');
// 0 尺寸画布：不得把鼠标坐标算成 Infinity
const savedRect = hudCanvas.getBoundingClientRect;
hudCanvas.getBoundingClientRect = function () { return { left: 0, top: 0, width: 0, height: 0 }; };
Input.mouse.x = 0; Input.mouse.y = 0;
fire(hudCanvas, 'mousemove', { clientX: 100, clientY: 100, movementX: 0, movementY: 0 });
ok(isFinite(Input.mouse.x) && isFinite(Input.mouse.y), '0 尺寸画布下鼠标坐标保持有限值');
hudCanvas.getBoundingClientRect = savedRect;

/* ---------------- 玩家与武器 ---------------- */
section('玩家与武器');
const pl = W.player;
pl.equip(1);
eq(pl.weapon(), 'pistol', 'equip(1) 切到手枪');
pl.equip(1);
eq(pl.weapon(), 'pistol', 'equip 同槽位不重复切换');
pl.equip(0); pl.cycleWeapon(-1);
eq(pl.weapon(), CFG.WEAPON_ORDER[CFG.WEAPON_ORDER.length - 1], 'cycleWeapon(-1) 从首项回绕到末项');
pl.equip(1);
pl.mag.pistol = 0; pl.ammo.pistol = 30; pl.reloading = false;
pl.startReload();
eq(pl.reloading, true, 'startReload 进入换弹');
pl.updateReload(CFG.WEAPONS.pistol.reload + 0.01);
eq(pl.mag.pistol, CFG.WEAPONS.pistol.mag, '换弹后弹匣装满');
eq(pl.ammo.pistol, 30 - CFG.WEAPONS.pistol.mag, '换弹从备弹扣除');
pl.reloading = false; pl.mag.pistol = CFG.WEAPONS.pistol.mag;
pl.armor = 50; pl.health = 100;
pl.damage(30, 'test');
eq(pl.armor, 20, '伤害先扣护甲');
eq(pl.health, 100, '护甲足够时生命不变');
pl.damage(40, 'test');
eq(pl.armor, 0, '护甲被击穿');
eq(pl.health, 80, '溢出伤害扣生命');
pl.armor = 100; pl.health = 100; pl.dead = false;
pl.damage(999, 'test');
eq(pl.health, 0, '致命伤害后生命归零');
eq(pl.dead, true, '致命伤害触发死亡');
eq(W.state, 'wasted', '死亡进入 WASTED 状态');
respawn();
eq(pl.dead, false, 'respawn 复活');
eq(pl.health, CFG.PLAYER.health, 'respawn 恢复生命');
eq(W.state, 'play', 'respawn 回到游玩状态');

/* ---------------- 载具物理与碰撞 ---------------- */
section('载具物理与碰撞');
function makeCar(type, x, y, heading, ai) {
  const v = new Vehicle(type, x, y, heading, ai ? { ai: ai } : undefined);
  W.vehicles.push(v);
  return v;
}
const fullThrottle = { control: function () { return { throttle: 1, steer: 0, brake: false, handbrake: false }; } };
const car = makeCar('sedan', D.worldW / 2, D.roadsH[6], 0, fullThrottle);
const x0 = car.x;
for (let i = 0; i < 30; i++) car.update(0.05);
ok(car.fs > 0, '油门使速度增大 (' + car.fs.toFixed(1) + ')');
ok(car.fs <= car.def.maxSpeed, '速度不超过 maxSpeed');
ok(car.x > x0, 'heading=0 时沿 +x 前进');
for (let i = 0; i < 400; i++) car.update(0.05);
ok(car.fs <= car.def.maxSpeed + 1e-9, '长时间加速仍被 maxSpeed 限制');
const revCar = makeCar('sedan', D.worldW / 2, D.roadsH[6], 0, { control: function () { return { throttle: -1, steer: 0, brake: false, handbrake: false }; } });
for (let i = 0; i < 60; i++) revCar.update(0.05);
ok(revCar.fs >= -revCar.def.maxSpeed * 0.38 - 1e-9, '倒车速度被限制在 -0.38×maxSpeed 以上');
const steerCar = makeCar('sedan', D.worldW / 2, D.roadsH[6], 0, { control: function () { return { throttle: 1, steer: 1, brake: false, handbrake: false }; } });
const h0 = steerCar.heading;
for (let i = 0; i < 20; i++) steerCar.update(0.05);
ok(steerCar.heading > h0, '右转使 heading 增大');
// 建筑碰撞：把车塞进楼里，update 后应被推出
const bld = D.buildings.find(function (b) { return b.w > 60 && b.h > 60; }) || D.buildings[0];
const crash = makeCar('sedan', bld.x + bld.w / 2, bld.y + bld.h / 2, 0, null);
crash.update(0.05);
ok(!(crash.x > bld.x && crash.x < bld.x + bld.w && crash.y > bld.y && crash.y < bld.y + bld.h), '车辆不会卡在建筑内部（被碰撞解算推出）');
// 车车分离
const a1 = makeCar('sedan', D.worldW / 2 + 1000, D.roadsH[6], 0, null);
const a2 = makeCar('sedan', D.worldW / 2 + 1005, D.roadsH[6], 0, null);
const sep0 = Utils.dist(a1.x, a1.y, a2.x, a2.y);
a1.update(0.05); a2.update(0.05);
ok(Utils.dist(a1.x, a1.y, a2.x, a2.y) >= sep0, '重叠车辆互相推开');
// 碾压 NPC
const runSpot = MapSys.randomWalkablePoint();
const victim = new NPC('civilian', runSpot.x, runSpot.y);
W.npcs.push(victim);
const killer = makeCar('sedan', victim.x - 20, victim.y, 0, fullThrottle);
killer.fs = 120;
killer.update(0.05);
eq(victim.dead, true, '高速车辆碾死 NPC');
// 爆炸与残骸
const boomSpot = MapSys.randomWalkablePoint();
const boom = makeCar('sedan', boomSpot.x, boomSpot.y, 0, null);
boom.damage(9999, 'test');
eq(boom.wrecked, true, '血量归零后车辆报废');
ok(Combat.particles.length > 0, '爆炸产生粒子');
boom.update(0.05);
ok(true, '残骸继续 update 不抛异常');

/* ---------------- 战斗 ---------------- */
section('战斗');
Combat.bullets.length = 0;
Combat.particles.length = 0;
const savedNpcs = W.npcs;
W.npcs = [];                                   // 清场：确保子弹只可能命中被测目标
const tgtSpot = MapSys.randomWalkablePoint();
const target = new NPC('civilian', tgtSpot.x, tgtSpot.y);
W.npcs.push(target);
let mx = target.x - 30, my = target.y;         // 枪口放在 30px 内，避免刚出膛就撞墙
const muzzle = MapSys.walkableNear(mx, my, 30);
mx = muzzle.x; my = muzzle.y;
const aimAng = Utils.angleTo(mx, my, target.x, target.y);
Combat.fireWeapon('player', 'pistol', mx, my, aimAng);
eq(Combat.bullets.length, 1, '手枪开火产生 1 发子弹');
eq(Combat.bullets[0].team, 'player', '子弹阵营为玩家');
near(Combat.bullets[0].life, CFG.WEAPONS.pistol.range / CFG.WEAPONS.pistol.bulletSpeed, 1e-9, '子弹寿命 = 射程 / 速度');
Combat.bullets.length = 0;
Combat.fireWeapon('player', 'shotgun', mx, my, aimAng);
eq(Combat.bullets.length, CFG.WEAPONS.shotgun.pellets, '霰弹枪产生 pellets 发子弹');
Combat.bullets.length = 0;
const hpBefore = target.health;
Combat.fireWeapon('player', 'rifle', mx, my, aimAng);
for (let i = 0; i < 20; i++) Combat.update(0.01);
ok(target.health < hpBefore, '子弹命中并造成伤害');
eq(Combat.bullets.length, 0, '子弹在命中后移除');
Combat.particles.length = 0;
const splashSpot = MapSys.randomWalkablePoint();
const splash = new NPC('civilian', splashSpot.x, splashSpot.y);
W.npcs.push(splash);
Combat.explode(splash.x + 10, splash.y, 150, 200, 'player');
ok(splash.health < CFG.NPC.civilian.health, '爆炸范围内的 NPC 受到溅射伤害');
ok(Combat.particles.length > 20, '爆炸生成火焰/烟雾/火花粒子');
const partsBefore = Combat.particles.length;
for (let i = 0; i < 200; i++) Combat.update(0.05);
eq(Combat.particles.length, 0, '粒子寿命耗尽后清空');
ok(partsBefore > 0, '粒子曾存在');
eq(Combat.shake, 0, '镜头震动随时间衰减归零');
Combat.fireWeapon('player', 'fist', target.x - 10, target.y, 0);
ok(true, '近战攻击不抛异常');
Combat.enemyShot(splash, 0.05);
eq(Combat.bullets.length, 1, '敌人射击生成敌方子弹');
Combat.bullets.length = 0;
W.npcs = savedNpcs;

/* ---------------- 任务状态机 ---------------- */
section('任务状态机');
Missions.current = null;
Missions.doneIds = {};
Missions.start('tutorial');
const tut = Missions.current;
eq(tut.title, '新手上路', '任务标题');
eq(tut.steps.length, 4, '新手上路 4 个步骤');
eq(tut.index, 0, '从第 0 步开始');
ok(tut.spawned.length === 1, '第一步 onStart 生成了一辆轿车');
const sedan = tut.spawned[0];
ok(sedan instanceof Vehicle, '生成的是载具');
near(tut.current.marker.x, sedan.x, 1e-9, '第一步标记跟随生成的车');
pl.x = sedan.x; pl.y = sedan.y;
tut.update(0.016);
eq(tut.index, 1, '走到车库后进入第 1 步');
ok(/E/.test(tut.current.text), '第 1 步提示按 E 上车');
sedan.driver = pl; pl.vehicle = sedan;
tut.update(0.016);
eq(tut.index, 2, '上车后进入检查点步骤');
const pts = tut.current.points;
eq(pts.length, 3, '3 个检查点');
for (let i = 0; i < pts.length; i++) { pl.x = pts[i].x; pl.y = pts[i].y; tut.update(0.016); }
eq(tut.index, 3, '依次通过 3 个检查点后进入最后一步');
pl.x = 160; pl.y = 160;
const moneyBefore = pl.money;
tut.update(0.016);
eq(tut.done, true, '最后一步完成后任务结束');
eq(pl.money, moneyBefore + tut.reward, '任务奖励入账');
eq(pl.vehicle, null, '清理时把玩家请下车');
ok(W.vehicles.indexOf(sedan) < 0, '任务生成的载具被清理');
Missions.update(0.016);
eq(Missions.current, null, 'Missions.update 清空当前任务');
eq(Missions.completeCount, 1, '剧情任务计数 +1');
eq(Missions.doneIds.tutorial, true, '记录已完成任务 id');
eq(Missions.markers.length, Missions.order.length, '地图上有 7 个剧情任务标记');

// 失败路径
Missions.start('taxi');
const taxiM = Missions.current;
taxiM.current.timeLeft = 0.001;
taxiM.update(0.02);
eq(taxiM.failed, true, '限时步骤超时导致任务失败');
ok(taxiM.failReason.length > 0, '失败原因有文案');
ok(taxiM.spawned.length === 0, '失败后清理生成物');
Missions.update(0.016);
eq(Missions.current, null, '失败后 Missions.update 清空当前任务');

// 击杀计数：指定目标的任务不能把普通帮派成员算进去
Missions.start('boss');
const bossStep = Missions.current.current;
eq(bossStep.targetTag, 'boss', '枭雄陨落步骤指定 targetTag');
eq(bossStep.count, 1, '只需击杀 1 个目标');
Missions.onNpcKilled(new NPC('gang', 0, 0));
eq(bossStep.killed, 0, '击杀保镖不计数');
Missions.onNpcKilled(new NPC('boss', 0, 0, { tag: 'boss' }));
eq(bossStep.killed, 1, '击杀老大才计数');
Missions.onNpcKilled(new NPC('boss', 0, 0, { tag: 'boss' }));
eq(bossStep.killed, 1, '计数不超过 count');
Missions.current = null;

// 无 targetTag 的清剿任务统计帮派成员
Missions.start('rampage');
const killStep = Missions.current.current;
eq(killStep.count, 20, '帮派清剿需要 20 杀');
for (let i = 0; i < 25; i++) Missions.onNpcKilled(new NPC('gang', 0, 0));
eq(killStep.killed, 20, '击杀数被 clamp 到 count');
Missions.current = null;

// onEnd：定时炸弹逃亡步结束时清除通缉
W.police.level = 0; W.player.wanted = 0;
Missions.start('bomb');
const bombM = Missions.current;
bombM.current.condition = function () { return true; };
bombM.update(0.016);
eq(bombM.index, 1, '进入逃亡步骤');
eq(W.police.level, 3, '逃亡步开始时通缉等级 +3');
bombM.current.timeLeft = 0.001;
bombM.update(0.02);
eq(W.police.level, 0, '逃亡步结束时 onEnd 清除通缉');
eq(bombM.done, true, '炸弹任务完成');
Missions.update(0.016);

// 出租车生意在完成"城市出租"后解锁
Missions.current = null;
Missions.taxiUnlocked = false;
Missions.start('taxi');
const taxi2 = Missions.current;
for (const s of taxi2.steps) s.condition = function () { return true; };
for (let i = 0; i < 20 && !taxi2.done; i++) taxi2.update(0.016);
eq(taxi2.done, true, '出租车任务可完成');
Missions.update(0.016);
eq(Missions.taxiUnlocked, true, '完成城市出租后解锁出租车生意');
const beforeCount = Missions.completeCount;
Missions.current = null;
eq(Missions.tryStart(Missions.taxiStand.x, Missions.taxiStand.y), true, '出租车招呼点可接任务');
ok(Missions.current !== null, '接下了出租车生意');
Missions.current = null;
eq(Missions.completeCount, beforeCount, '重复出租车生意不增加剧情计数');

// 追踪型目标标记跟随
Missions.start('chase');
const chaseStep = Missions.current.current;
chaseStep.onStart(Missions.current);
const targetCar = chaseStep.targetRef;
ok(targetCar instanceof Vehicle, '追捕任务生成了目标车');
targetCar.x += 500;
Missions.update(0.016);
eq(chaseStep.marker.x, targetCar.x, '目标移动后标记同步跟随');
targetCar.wrecked = true;
Missions.current.update(0.016);
eq(Missions.current.done, true, '摧毁目标后任务完成');
Missions.current = null;

/* ---------------- 警察系统 ---------------- */
section('警察系统');
PoliceSys.init();
W.npcs = W.npcs.filter(function (n) { return !n.police; });
W.vehicles = W.vehicles.filter(function (v) { return !v.siren; });
W.addWanted(3);
eq(W.police.level, 3, '通缉等级累加');
eq(W.player.wanted, 3, '通缉等级同步到玩家');
W.addWanted(10);
eq(W.police.level, 5, '通缉等级上限为 5');
W.addWanted(-99);
eq(W.police.level, 0, '通缉等级下限为 0');
W.addWanted(2);
PoliceSys.update(0.016);
ok(W.police.cars.length >= 1, '通缉状态下会派出警车 (' + W.police.cars.length + ' 辆)');
const squad = W.police.cars[0];
ok(W.vehicles.indexOf(squad.v) >= 0, '警车加入世界');
const officerCount = W.npcs.filter(function (n) { return n.police; }).length;
W.player.x = squad.v.x + 10; W.player.y = squad.v.y;
PoliceSys.update(0.016);
ok(W.npcs.filter(function (n) { return n.police; }).length > officerCount, '警车靠近后下车部署警察');
ok(W.npcs.filter(function (n) { return n.police; })[0].state === 'attack', '部署的警察进入攻击状态');
// 玩家抢走编队警车后，通缉清零不得把车删掉
W.player.vehicle = null;
enterVehicle(squad.v);
ok(W.player.vehicle === squad.v, '玩家抢到警车');
W.addWanted(-99);
PoliceSys.update(0.016);
ok(W.vehicles.indexOf(squad.v) >= 0, '通缉清零后玩家驾驶的警车仍在世界里');
ok(W.police.cars.indexOf(squad) < 0, '被抢的警车已从警察编队摘除');
exitVehicle();
eq(W.player.vehicle, null, '下车后玩家不再绑定载具');
// 被捕
PoliceSys.init();
W.addWanted(1);
W.player.health = 10; W.player.dead = false;
const cop = new NPC('police', W.player.x + 5, W.player.y);
W.npcs.push(cop);
W.police.cars.push({ v: makeCar('police', W.player.x + 40, W.player.y, 0, makePoliceAI(null)), officers: [cop] });
PoliceSys.update(0.016);
eq(W.state, 'busted', '残血被警察贴近判定被捕');
respawn();
eq(W.state, 'play', '被捕后重生');
eq(W.police.level, 0, '重生后通缉清零');

/* ---------------- NPC 生命周期 ---------------- */
section('NPC 生命周期');
const civ = new NPC('civilian', 100, 100);
eq(civ.state, 'wander', '平民初始为游荡');
eq(civ.dropsMoney, true, '平民会掉落金钱');
const ganger = new NPC('gang', 100, 100);
eq(ganger.weapon, 'smg', '帮派成员使用冲锋枪');
const bossN = new NPC('boss', 100, 100);
eq(bossN.weapon, 'pistol', '老大使用手枪');
ok(new NPC('civilian', 0, 0).weapon === null, '平民没有武器');
W.lastGunshot = { x: civ.x + 50, y: civ.y, t: 1 };
let fled = false;
for (let i = 0; i < 200 && !fled; i++) { civ.update(0.05); if (civ.state === 'flee') fled = true; }
ok(fled, '附近枪声使平民逃跑');
W.lastGunshot = null;
civ.state = 'wander';
civ.damage(5, 'player');
eq(civ.state, 'flee', '平民被玩家打中后逃跑');
civ.damage(999, 'player');
eq(civ.dead, true, '平民死亡');
eq(W.stats.kills > 0, true, '击杀计入统计');
civ.update(0.05);
ok(civ.deathTimer > 0, '死亡计时器推进');
// 尸体回收 + 活人计数（市区不会被清空）
W.npcs = [];
for (let i = 0; i < 22; i++) { const c = new NPC('civilian', 500 + i * 5, 500); c.dead = true; c.deathTimer = 999; W.npcs.push(c); }
for (let i = 0; i < 40; i++) { W.pedCd = 0; update(0.02); }
const alive = W.npcs.filter(function (n) { return !n.dead; }).length;
ok(alive > 0, '尸体被回收后仍会补充新的平民 (' + alive + ' 名存活)');
ok(W.npcs.length < 40, '尸体不会无限堆积 (' + W.npcs.length + ')');
// 拾取物
const pk = new Pickup('money', pl.x, pl.y, 150);
W.pickups.push(pk);
const moneyBefore2 = pl.money;
pk.update(0.016);
eq(pk.dead, true, '走到拾取物上会被拾取');
eq(pl.money, moneyBefore2 + 150, '金钱拾取物增加金钱');

/* ---------------- 昼夜循环与 HUD ---------------- */
section('昼夜循环与 HUD');
W.gameTime = 0;
near(HUD.hour(), 6, 1e-9, '游戏时间 0 对应 06:00');
W.gameTime = CFG.DAY_LENGTH * 0.25;
near(HUD.hour(), 12, 1e-9, '1/4 天对应 12:00');
W.gameTime = CFG.DAY_LENGTH * 0.5;
near(HUD.hour(), 18, 1e-9, '1/2 天对应 18:00');
let lightMin = 9, lightMax = -9;
for (let i = 0; i <= 48; i++) {
  W.gameTime = CFG.DAY_LENGTH * i / 48;
  const l = HUD.dayLight();
  if (l < lightMin) lightMin = l;
  if (l > lightMax) lightMax = l;
}
ok(lightMin >= 0 && lightMax <= 1, 'dayLight 始终落在 [0,1]（' + lightMin.toFixed(2) + '~' + lightMax.toFixed(2) + '）');
ok(lightMax > 0.9, '正午光照接近 1');
const hudCtx = hudCanvas.getContext('2d');
let hudErr = null;
try {
  for (let w = 0; w <= 5; w++) { pl.wanted = w; HUD.topRight(hudCtx); }
  pl.wanted = 3;
  HUD.draw(hudCtx);
  W.prompt = { x: 0, y: 0, text: '按 E 上车' };
  W.notifs.push({ text: '测试通知', t: 3, color: '#fff' });
  HUD.draw(hudCtx);
} catch (e) { hudErr = e; }
ok(!hudErr, 'HUD 绘制（含通缉 0-5 全档）不抛异常' + (hudErr ? ': ' + hudErr.message : ''));
eq(pl.wanted, 3, 'HUD 不修改玩家通缉等级');

/* ---------------- 3D 渲染与镜头 ---------------- */
section('3D 渲染与镜头');
ok(Render3D.scene && Render3D.camera, '场景与相机已创建');
eq(Render3D.scene.fog !== null, true, '场景带雾效');
ok(Render3D.worldGroup && Render3D.worldGroup.children.length > 0, '静态世界组已建立');
let frozen = 0, dynamic = 0, geoSet = new Set(), matSet = new Set();
Render3D.scene.traverse(function (o) {
  if (o !== Render3D.scene && o !== Render3D.worldGroup) { if (o.matrixAutoUpdate) dynamic++; else frozen++; }
  if (o.geometry) geoSet.add(o.geometry);
  if (o.material) matSet.add(o.material);
});
ok(frozen > 1000, '静态世界矩阵已冻结 (' + frozen + ' 个对象不再每帧重算)');
ok(dynamic < 100, '动态对象保持自动矩阵更新 (' + dynamic + ' 个)');
ok(geoSet.size < 400, '重复几何体已复用（唯一几何体 ' + geoSet.size + ' 个）');
ok(matSet.size < 80, '重复材质已复用（唯一材质 ' + matSet.size + ' 个）');
near(Render3D.screenVecs().ux * Render3D.screenVecs().rx + Render3D.screenVecs().uz * Render3D.screenVecs().rz, 0, 1e-9, '屏幕前后/左右向量正交');
Render3D.rotateCam(0.5, 0);
const yaw0 = Render3D.camYaw;
Render3D.rotateCam(0.25, 0);
ok(Render3D.camYaw !== yaw0, '鼠标转动改变镜头 yaw');
Render3D.camPitch = 0.8;
Render3D.rotateCam(0, 99);
near(Render3D.camPitch, Render3D.maxPitch, 1e-9, '俯仰角被限制在 maxPitch');
Render3D.rotateCam(0, -99);
near(Render3D.camPitch, Render3D.minPitch, 1e-9, '俯仰角被限制在 minPitch');
Render3D.rotateCam(Infinity, Infinity);
ok(isFinite(Render3D.camYaw) && isFinite(Render3D.camPitch), '异常输入不会污染镜头角度');
const aim = Render3D.aimPoint();
ok(isFinite(aim.x) && isFinite(aim.y), '准星射线求交返回有限坐标');
Combat.explode(pl.x + 40, pl.y + 40, 150, 200, 'player');
Combat.fireWeapon('player', 'rocket', pl.x, pl.y, 0);
Combat.spawnBlood(pl.x, pl.y, 8);
let renderErr = null;
const t0 = Date.now();
try {
  for (let i = 0; i < 60; i++) {
    W.gameTime += 0.05;
    Render3D.update(0.016);
  }
} catch (e) { renderErr = e; }
ok(!renderErr, 'Render3D.update 连续 60 帧（含粒子/子弹/爆炸/镜头震动）不抛异常' + (renderErr ? ': ' + renderErr.message : ''));
ok(isFinite(Render3D.camera.position.x) && isFinite(Render3D.camera.position.y) && isFinite(Render3D.camera.position.z), '渲染后相机坐标有限');
console.log('  · 60 帧 3D 更新耗时 ' + (Date.now() - t0) + ' ms');

/* ---------------- 主循环 ---------------- */
section('主循环');
W.state = 'menu';
let loopErr = null;
let now = 1000;
try {
  for (let i = 0; i < 5; i++) { now += 16.6; loop(now); }
  fireWin('keydown', { code: 'Enter', repeat: false, preventDefault: function () {} });
  now += 16.6; loop(now);
  eq(W.state, 'play', '按 Enter 从菜单进入游玩');
  for (let i = 0; i < 90; i++) { now += 16.6; loop(now); }
  ok(W.gameTime > 0, '主循环推进游戏时间');
  fireWin('keydown', { code: 'Escape', repeat: false, preventDefault: function () {} });
  now += 16.6; loop(now);
  eq(W.state, 'paused', 'Esc 暂停');
  const tPaused = W.gameTime;
  now += 16.6; loop(now);
  eq(W.gameTime, tPaused, '暂停时游戏时间不推进');
  fireWin('keydown', { code: 'Escape', repeat: false, preventDefault: function () {} });
  now += 16.6; loop(now);
  eq(W.state, 'play', 'Esc 继续游戏');
  // 大 dt（切标签页回来）
  now += 60000; loop(now);
  ok(W.gameTime - tPaused < 1, '超长帧间隔被钳制，不会一次性跳完整张地图');
  W.state = 'wasted'; W.stateTimer = 0.01;
  now += 16.6; loop(now);
  eq(W.state, 'play', '死亡计时结束后自动重生');
} catch (e) { loopErr = e; }
ok(!loopErr, '主循环 tick + 渲染路径 100 帧不抛异常' + (loopErr ? ': ' + loopErr.message : ''));

/* ---------------- 异常环境降级 ---------------- */
section('异常环境降级');
// 1) 窗口/画布尺寸为 0
els.hud.width = 0; els.hud.height = 0; els.game3d.width = 0;
let zeroErr = null;
silence(function () {
  try { boot(); } catch (e) { zeroErr = e; }
});
ok(!zeroErr, '画布尺寸为 0 时 boot() 不抛异常' + (zeroErr ? ': ' + zeroErr.message : ''));
eq(W.viewW, 1280, '尺寸为 0 时回退到默认宽度');
eq(W.viewH, 720, '尺寸为 0 时回退到默认高度');
ok(Render3D.disabled === false && isFinite(Render3D.camera.aspect), '回退尺寸后相机宽高比有限');
els.hud.width = 1280; els.hud.height = 720; els.game3d.width = 1280;
// 2) WebGL 不可用
const glCanvas = els.game3d;
const realGetContext = glCanvas.getContext;
glCanvas.getContext = function () { throw new Error('WebGL disabled for test'); };
let webglErr = null;
silence(function () {
  try { boot(); } catch (e) { webglErr = e; }
});
ok(!webglErr, 'WebGL 初始化失败时 boot() 不抛异常' + (webglErr ? ': ' + webglErr.message : ''));
eq(Render3D.disabled, true, 'WebGL 失败后 3D 渲染标记为停用');
ok(/WebGL/.test(Render3D.errorMsg), '记录可展示的失败原因: ' + Render3D.errorMsg);
let degradedErr = null;
try {
  W.state = 'play';
  for (let i = 0; i < 20; i++) { now += 16.6; loop(now); }
  // 降级模式下仍要能移动（screenVecs 走固定俯视方向）
  const px0 = W.player.x, py0 = W.player.y;
  fireWin('keydown', { code: 'KeyW', repeat: false, preventDefault: function () {} });
  for (let i = 0; i < 20; i++) { now += 16.6; loop(now); }
  fireWin('keyup', { code: 'KeyW' });
  ok(Utils.dist(px0, py0, W.player.x, W.player.y) > 1, '3D 停用时玩家仍可移动');
} catch (e) { degradedErr = e; }
ok(!degradedErr, '3D 停用时主循环仍能跑（HUD 降级显示）' + (degradedErr ? ': ' + degradedErr.message : ''));
const degradedAim = Render3D.aimPoint();
ok(isFinite(degradedAim.x) && isFinite(degradedAim.y), '3D 停用时 aimPoint 返回有限坐标');
glCanvas.getContext = realGetContext;
silence(function () { boot(); });
eq(Render3D.disabled, false, '恢复 WebGL 后重新初始化成功');
let finalErr = null;
try { for (let i = 0; i < 30; i++) { now += 16.6; loop(now); } } catch (e) { finalErr = e; }
ok(!finalErr, '恢复后主循环继续正常运行');

/* ---------------- 总结 ---------------- */
console.log('\n========================================');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
console.log('========================================');
if (failed > 0) process.exit(1);
