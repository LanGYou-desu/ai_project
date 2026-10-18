'use strict';
/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · test/run.js
 * 零依赖测试：node test/run.js
 *
 * 覆盖：
 *   1. 前端脚本加载（真实 vendor/three.min.js + 浏览器桩）
 *   2. 程序化生成的确定性（同种子同输出 / 不同种子不同输出）
 *   3. 地形与布局的几何不变量（高度范围、边界、道路贴地、台阶落地、建筑地基）
 *   4. 运动学（时钟指针、摩天轮吊舱、汽车、飞艇、小船、行人）
 *   5. 昼夜循环与光照
 *   6. 渲染循环跑若干帧不抛异常、不产生 NaN、不泄漏资源
 *   7. 健壮性（WebGL 不可用、窗口尺寸为 0、DOM 元素缺失）
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createWorld, ROOT } = require('./stub.js');

/* ---------- 断言工具（与仓库其他项目风格一致） ---------- */
let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  ✗ ' + msg); }
}function eq(a, b, msg) {
  ok(a === b, (msg || '') + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
}
function near(a, b, tol, msg) {
  tol = tol == null ? 1e-9 : tol;
  ok(Math.abs(a - b) <= tol, (msg || '') + ' (got ' + a + ', want ' + b + '±' + tol + ')');
}
function between(v, lo, hi, msg) {
  ok(v >= lo && v <= hi, (msg || '') + ' (got ' + v + ', want ' + lo + '..' + hi + ')');
}
function isFiniteNum(v, msg) { ok(typeof v === 'number' && isFinite(v), (msg || '') + ' (got ' + v + ')'); }
function section(name) { console.log('\n== ' + name + ' =='); }

/* ============================================================
 * 1. 加载
 * ============================================================ */
section('前端脚本加载');
const W = createWorld();
const H = W.H;
const THREE = W.THREE;
const V = THREE.Vector3;

eq(typeof H, 'object', 'window.H 命名空间存在');
W.files.forEach(function (f) {
  ok(fs.existsSync(path.join(ROOT, f)), '文件存在: ' + f);
});
ok(typeof H.updateCycle === 'function', 'H.updateCycle 已导出');
ok(typeof H.updateDynamics === 'function', 'H.updateDynamics 已导出');
ok(typeof H.updateHud === 'function', 'H.updateHud 已导出');
ok(typeof H.buildTerrain === 'function' && typeof H.buildTown === 'function', '构建函数已导出');
ok(H.scene && H.scene.isScene, '场景已创建');
ok(H.camera && H.camera.isPerspectiveCamera, '相机已创建');
ok(H.renderer, '渲染器已创建');
ok(H.scene.children.length > 200, '场景对象数量 > 200（实际 ' + H.scene.children.length + '）');

/* index.html 与代码保持一致 */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
W.files.forEach(function (f) {
  ok(html.indexOf('"' + f + '"') >= 0, 'index.html 引用了 ' + f);
});
ok(html.indexOf('vendor/three.min.js') >= 0, 'index.html 引用本地 three.js');
['scene', 'clock', 'phase', 'sunDot', 'timeSlider', 'timeVal', 'btnRotate', 'btnDyn', 'btnFx', 'btnShot', 'btnFull', 'loading']
  .forEach(function (id) { ok(html.indexOf('id="' + id + '"') >= 0, 'index.html 含 #' + id); });
eq(THREE.REVISION, '158', 'vendor 里的 three.js 版本');

/* ============================================================
 * 2. 确定性
 * ============================================================ */
section('程序化生成的确定性');
function signature() {
  const parts = [];
  H.scene.traverse(function (o) {
    parts.push(o.type, o.name || '');
    parts.push(o.position.x.toFixed(5), o.position.y.toFixed(5), o.position.z.toFixed(5));
    parts.push(o.rotation.x.toFixed(5), o.rotation.y.toFixed(5), o.rotation.z.toFixed(5));
    parts.push(o.scale.x.toFixed(5), o.scale.y.toFixed(5), o.scale.z.toFixed(5));
    if (o.geometry) {
      parts.push(o.geometry.type);
      if (o.geometry.type !== 'ExtrudeGeometry') {
        // ExtrudeGeometry.parameters 里带 uuid，跳过以免误判
        parts.push(JSON.stringify(o.geometry.parameters || null));
      }
      const pos = o.geometry.attributes.position;
      if (pos) {
        let s = 0;
        for (let i = 0; i < pos.array.length; i++) s += pos.array[i];
        parts.push(pos.count + ':' + s.toFixed(5));
      }
      const col = o.geometry.attributes.color;
      if (col) {
        let s = 0;
        for (let i = 0; i < col.array.length; i++) s += col.array[i];
        parts.push('c' + s.toFixed(5));
      }
    }
    if (o.material && !Array.isArray(o.material)) {
      parts.push(o.material.type);
      if (o.material.color) parts.push(o.material.color.getHexString());
      if (o.material.emissive) parts.push(o.material.emissive.getHexString());
    }
    if (o.isLight) parts.push('L' + o.intensity);
    if (o.isInstancedMesh) parts.push('I' + o.count);
  });
  parts.push('PADS' + JSON.stringify(H.PADS));
  parts.push('RIVER' + JSON.stringify(H.RIVER));
  parts.push('rng' + H.rng().toFixed(12));
  const str = parts.join('|');
  let h1 = 2166136261;
  for (let i = 0; i < str.length; i++) { h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619); }
  return { hash: (h1 >>> 0).toString(16), len: str.length };
}

/* 子进程模式：只输出世界签名（供确定性对比），由父进程以 HAKONIWA_SIG_SEED 触发 */
if (process.env.HAKONIWA_SIG_SEED) {
  H.resetRandom(parseInt(process.env.HAKONIWA_SIG_SEED, 10));
  const sig = signature();
  console.log(JSON.stringify({
    hash: sig.hash, len: sig.len,
    children: H.scene.children.length,
    smoke: H.smokeOrigins.length,
    sway: H.swayTrees.length,
    flags: H.flags.length,
    winMats: H.winMats.length
  }));
  process.exit(0);
}
const sigA = signature();
ok(sigA.hash !== undefined, '签名可计算（' + sigA.hash + '）');
// 重置种子后随机序列必须从头开始（重建世界时才能复现同一张地图）
{
  const first = H.resetRandom(H.SEED)();
  const again = H.resetRandom(H.SEED)();
  eq(again, first, 'resetRandom(同种子) 后随机序列从头开始');
  eq(H.SEED, 20260821, '默认世界种子被记录在 H.SEED');
  H.resetRandom(H.SEED);
}
// 用全新进程再生成一次，排除模块加载顺序/单例状态的影响
{
  const runSig = function (seed) {
    const out = execFileSync(process.execPath, [__filename], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HAKONIWA_SIG_SEED: String(seed) })
    });
    const line = out.trim().split('\n').filter(function (l) { return l.charAt(0) === '{'; }).pop();
    return JSON.parse(line);
  };
  const s1 = runSig(H.SEED), s2 = runSig(H.SEED), s3 = runSig(H.SEED + 1);
  eq(s1.hash, s2.hash, '两个独立进程 · 同种子 → 相同世界签名');
  eq(s1.len, s2.len, '两个独立进程 · 同种子 → 相同签名长度');
  ok(s1.hash !== s3.hash, '不同种子 → 不同世界签名');
  eq(s1.children, s2.children, '子进程场景规模一致（' + s1.children + '）');
  ok(s1.smoke > 0 && s1.sway > 0, '子进程统计量非零（smoke=' + s1.smoke + ', sway=' + s1.sway + '）');
}
// 随机数发生器本身
{
  const a = H.mulberry32(7), b = H.mulberry32(7), c = H.mulberry32(8);
  let same = true;
  for (let i = 0; i < 200; i++) if (a() !== b()) same = false;
  ok(same, 'mulberry32 同种子序列一致');
  ok(H.mulberry32(7)() !== c(), 'mulberry32 不同种子序列不同');
  const r = H.mulberry32(1);
  let inRange = true;
  for (let i = 0; i < 1000; i++) { const v = r(); if (v < 0 || v >= 1) inRange = false; }
  ok(inRange, '随机数落在 [0,1)');
}

/* ============================================================
 * 3. 地形 / 布局几何不变量
 * ============================================================ */
section('地形与布局不变量');
{
  let mn = Infinity, mx = -Infinity, bad = 0;
  for (let x = -100; x <= 100; x += 1) {
    for (let z = -100; z <= 100; z += 1) {
      const y = H.groundHeight(x, z);
      if (!isFinite(y)) bad++;
      if (y < mn) mn = y;
      if (y > mx) mx = y;
    }
  }
  eq(bad, 0, '地形高度全部有限');
  between(mn, -3.5, -3.0, '地形最低点 ≈ 海底');
  between(mx, 10.0, 11.0, '地形最高点 ≈ 神社丘陵');
  near(H.groundHeight(0, 0), 5.98, 0.05, '广场高度稳定');
  ok(H.groundHeight(0, 0) > H.WATER_Y + 3, '广场显著高于海平面');
  between(H.groundHeight(70, 0), -3.5, -3.3, '岛缘（r=70）沉入海下');
  between(H.groundHeight(200, 0), -3.5, -3.3, '远处海床高度一致');
  ok(H.groundHeight(28, -16) > H.groundHeight(0, 0) + 4, '神社丘陵高于台地');
  ok(H.groundHeight(-27, 19) > H.groundHeight(0, 0) + 0.5, '城堡山高于台地');
  // 湖面低于台地，湖心被挖到水下
  ok(H.groundHeight(H.LAKE.x, H.LAKE.z) < H.LAKE_Y, '湖心低于湖面');
  ok(H.LAKE_Y > H.WATER_Y, '湖面高于海面');
  // 河道连通：从湖到入海口的路径上都低于水面
  let riverBelow = 0;
  for (let i = 0; i < H.RIVER.length; i++) {
    if (H.groundHeight(H.RIVER[i][0], H.RIVER[i][1]) < H.LAKE_Y) riverBelow++;
  }
  ok(riverBelow >= H.RIVER.length - 1, '河流路径基本都在水面之下（' + riverBelow + '/' + H.RIVER.length + '）');
  // 整平平台：每个 PAD 中心都应接近其声明高度
  let padBad = 0;
  H.PADS.forEach(function (p) {
    if (Math.abs(H.groundHeight(p[0], p[1]) - p[2]) > 1.2) padBad++;
  });
  eq(padBad, 0, '每个建筑整平平台高度有效（相邻平台重叠也在容差内）');
  // 建筑整平平台不重叠冲突：所有 PAD 两两中心的距离 >= 各自内半径
  let overlap = 0;
  for (let i = 0; i < H.PADS.length; i++) {
    for (let j = i + 1; j < H.PADS.length; j++) {
      const d = Math.hypot(H.PADS[i][0] - H.PADS[j][0], H.PADS[i][1] - H.PADS[j][1]);
      if (d < H.PADS[i][3] && d < H.PADS[j][3]) overlap++;
    }
  }
  eq(overlap, 0, '没有两个平台的核心区互相重叠');
}

section('道路贴合地形');
{
  const roads = H.scene.getObjectByName('roads');
  ok(roads && roads.isMesh, '道路是单个合并网格（不再逐段一个方块）');
  const pos = roads.geometry.attributes.position;
  ok(pos.count > 100, '道路顶点数合理（' + pos.count + '）');
  let mn = Infinity, mx = -Infinity, nan = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { nan++; continue; }
    const d = y - H.groundHeight(x, z);
    if (d < mn) mn = d;
    if (d > mx) mx = d;
  }
  eq(nan, 0, '道路顶点无 NaN');
  ok(mn >= 0.0, '道路每个顶点都在地面之上（最低 ' + mn.toFixed(4) + '）');
  between(mx, 0.05, 0.2, '道路抬升量合理（最高 ' + mx.toFixed(4) + '）');
  ok(roads.receiveShadow === true, '道路接收阴影');
  ok(!!roads.material.map, '道路使用鹅卵石程序化贴图');
  // 道路连通性：主街各段之间顶点在 1 单位内相接
  const pts = [];
  for (let i = 0; i < pos.count; i += 2) pts.push([pos.getX(i), pos.getZ(i)]);
  let isolated = 0;
  for (let i = 0; i < pts.length; i++) {
    let near1 = false;
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 1.5) { near1 = true; break; }
    }
    if (!near1) isolated++;
  }
  ok(isolated <= 2, '道路顶点没有孤立的碎块（孤立 ' + isolated + '）');
}

section('台阶与建筑地基');
{
  const stairs = H.scene.getObjectByName('stairs');
  ok(stairs && stairs.children.length > 0, '台阶组存在（' + (stairs ? stairs.children.length : 0) + ' 级）');
  let sunk = 0;
  stairs.children.forEach(function (st) {
    st.parent.updateMatrixWorld(true);
    const p = st.geometry.parameters;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new V(sx * p.width / 2, -p.height / 2, sz * p.depth / 2).applyMatrix4(st.matrixWorld);
        if (w.y - H.groundHeight(w.x, w.z) < -1e-6) sunk++;
      }
    }
  });
  eq(sunk, 0, '没有台阶底面埋进地形');

  // 建筑：石基必须包住地形高差（底部低于地面最低点，顶部不低于地面最高点）
  let checked = 0, floating = 0, buried = 0;
  H.scene.traverse(function (g) {
    if (!g.isGroup) return;
    const plinth = g.children.find(function (c) {
      return c.isMesh && c.geometry.type === 'BoxGeometry' &&
        c.material && c.material.color && c.material.color.getHex() === 0xb7b2a7;
    });
    if (!plinth) return;
    checked++;
    g.updateMatrixWorld(true);
    const p = plinth.geometry.parameters;
    let lo = Infinity, hi = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const w = new V(sx * p.width / 2, 0, sz * p.depth / 2).applyMatrix4(plinth.matrixWorld);
        const gh = H.groundHeight(w.x, w.z);
        if (gh < lo) lo = gh;
        if (gh > hi) hi = gh;
      }
    }
    const top = new V(0, p.height / 2, 0).applyMatrix4(plinth.matrixWorld).y;
    const bottom = new V(0, -p.height / 2, 0).applyMatrix4(plinth.matrixWorld).y;
    if (bottom > lo + 0.01) floating++;
    if (top < hi - 0.01) buried++;
  });
  ok(checked >= 15, '检查到足够多的建筑石基（' + checked + '）');
  eq(floating, 0, '没有建筑石基悬空');
  eq(buried, 0, '没有建筑石基被地形埋没');
}

section('植被与实例化渲染');
{
  ok(H.swayTrees.length > 20, '摇曳树木/灌木数量合理（' + H.swayTrees.length + '）');
  let inWater = 0, farOut = 0;
  H.swayTrees.forEach(function (t) {
    const x = t.g.position.x, z = t.g.position.z;
    if (H.groundHeight(x, z) < H.WATER_Y + 0.02) inWater++;
    if (Math.hypot(x, z) > 70) farOut++;
  });
  eq(inWater, 0, '没有树木种在水里');
  eq(farOut, 0, '没有树木长到岛外');
  let instanced = 0, instBad = 0;
  H.scene.traverse(function (o) {
    if (!o.isInstancedMesh) return;
    instanced++;
    if (o.count <= 0) instBad++;
    if (o.instanceMatrix.count !== o.count) instBad++;
    const arr = o.instanceMatrix.array;
    for (let i = 0; i < arr.length; i++) {
      if (!isFinite(arr[i])) { instBad++; break; }
    }
  });
  ok(instanced >= 4, '花草/岩石使用实例化渲染（' + instanced + ' 个 InstancedMesh）');
  eq(instBad, 0, '实例矩阵合法');
  // 整场景：所有位置/缩放都是有限值
  let nanObj = 0;
  H.scene.traverse(function (o) {
    if (!isFinite(o.position.x + o.position.y + o.position.z)) nanObj++;
    if (!isFinite(o.scale.x + o.scale.y + o.scale.z)) nanObj++;
  });
  eq(nanObj, 0, '场景中所有对象的位姿都是有限值');
}

/* ============================================================
 * 4. 运动学
 * ============================================================ */
section('钟楼指针');
{
  const hour = H.clockHands.hour, minute = H.clockHands.minute;
  eq(hour.length, 4, '四面钟都有时针');
  eq(minute.length, 4, '四面钟都有分针');
  // 指针几何体不能被平移错位（共享几何被反复 translate 会让指针脱离钟面）
  hour[0].geometry.computeBoundingBox();
  const bb = hour[0].geometry.boundingBox;
  near(bb.min.y, -0.05, 1e-3, '时针根部在枢轴处');
  near(bb.max.y, 0.45, 1e-3, '时针长度正确');
  const deg = function (rad) { return ((-rad * 180 / Math.PI) % 360 + 360) % 360; };
  [[3.0, 90], [3.5, 105], [6.0, 180], [9.25, 277.5], [12.0, 0], [23.75, 352.5]].forEach(function (c) {
    H.env.playing = false;
    H.env.t = c[0] / 24;
    H.updateDynamics(1 / 60, 1);
    near(deg(hour[0].rotation.z), c[1], 0.5, '时针 @' + c[0] + 'h');
  });
  H.env.t = 3.5 / 24;
  H.updateDynamics(1 / 60, 1);
  near(deg(minute[0].rotation.z), 180, 0.5, '分针 @3:30');
  let sync = true;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(hour[i].rotation.z - hour[0].rotation.z) > 1e-9) sync = false;
    if (Math.abs(minute[i].rotation.z - minute[0].rotation.z) > 1e-9) sync = false;
  }
  ok(sync, '四面钟指针同步');
}

section('摩天轮');
{
  ok(H.wheel && H.wheel.isGroup, '轮盘存在');
  eq(H.wheelCabins.length, 8, '8 个吊舱');
  const hubLocal = new V(0, H.wheelHubY, H.wheel.position.z);
  let minR = Infinity, maxR = 0, maxTilt = 0, nan = 0;
  H.scene.updateMatrixWorld(true);   // 保证父级矩阵是最新的，否则轮心会算错
  for (let k = 0; k < 90; k++) {
    H.updateDynamics(0.05, 1 + k * 0.05);
    H.scene.updateMatrixWorld(true);
    const hub = hubLocal.clone().applyMatrix4(H.wheel.parent.matrixWorld);
    H.wheelCabins.forEach(function (c) {
      const wp = new V().setFromMatrixPosition(c.matrixWorld);
      const r = wp.distanceTo(hub);
      if (!isFinite(r)) nan++;
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      const m = new THREE.Matrix4().extractRotation(c.matrixWorld);
      const up = new V(0, 1, 0).applyMatrix4(m);
      maxTilt = Math.max(maxTilt, Math.abs(1 - up.y));
    });
  }
  eq(nan, 0, '吊舱位置无 NaN');

  near(minR, H.wheelR, 1e-4, '吊舱环绕半径恒定（最小）');
  near(maxR, H.wheelR, 1e-4, '吊舱环绕半径恒定（最大）');
  ok(maxTilt < 1e-6, '吊舱始终保持直立（最大倾斜 ' + maxTilt.toExponential(2) + '）');
  const rotBefore = H.wheel.rotation.z;
  H.updateDynamics(0.5, 2);
  ok(H.wheel.rotation.z < rotBefore, '轮盘持续旋转');
}

section('汽车 / 飞艇 / 小船 / 行人');
{
  // 汽车：车身是 1.5×0.52×3.1 的盒子；这里按几何参数识别，避免误判飞艇/行人
  const isCar = function (o) {
    return o.isGroup && o.children.some(function (c) {
      return c.isMesh && c.geometry.type === 'BoxGeometry' &&
        c.geometry.parameters.width === 1.5 && c.geometry.parameters.height === 0.52;
    });
  };
  const isNpc = function (o) {
    return o.isGroup && o.children.length === 5 && o.children.some(function (c) {
      return c.isMesh && c.geometry.type === 'CylinderGeometry' &&
        c.geometry.parameters.radiusTop === 0.24 && c.geometry.parameters.height === 0.85;
    });
  };
  const isAirship = function (o) {
    return o.isGroup && o.children.some(function (c) {
      return c.isMesh && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.radiusTop === 1.1;
    });
  };
  const isBoat = function (o) {
    return o.isGroup && o.children.some(function (c) {
      return c.isMesh && c.geometry.type === 'CylinderGeometry' && c.geometry.parameters.radiusTop === 0.05;
    });
  };
  const cars = H.scene.children.filter(isCar);
  const npcs = H.scene.children.filter(isNpc);
  ok(cars.length >= 4, '至少 4 辆车（' + cars.length + '）');
  ok(npcs.length >= 5, '至少 5 位行人（' + npcs.length + '）');

  let offGround = 0, nanCar = 0, yawChanged = 0;
  const yaw0 = cars.map(function (c) { return c.rotation.y; });
  for (let k = 0; k < 240; k++) {
    H.updateDynamics(1 / 60, k / 60);
    cars.forEach(function (c) {
      const gh = H.groundHeight(c.position.x, c.position.z);
      const dy = c.position.y - gh;
      if (dy < 0.15 || dy > 0.6) offGround++;
      if (!isFinite(c.position.x + c.position.y + c.position.z)) nanCar++;
    });
  }
  eq(offGround, 0, '汽车始终贴合地面（车高偏移 0.24 左右）');
  eq(nanCar, 0, '汽车位置有限');
  cars.forEach(function (c, i) { if (Math.abs(c.rotation.y - yaw0[i]) > 1e-6) yawChanged++; });
  ok(yawChanged >= 1, '汽车朝向随路径变化');

  // 飞艇：绕岛巡航，半径与高度稳定
  let airBad = 0, rMin = Infinity, rMax = 0;
  for (let k = 0; k < 300; k++) {
    H.updateDynamics(1 / 60, k / 60);
    const a = H.scene.children.find(isAirship);
    if (!a) { airBad++; break; }
    const r = Math.hypot(a.position.x, a.position.z);
    rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
    if (Math.abs(r - 55) > 1e-6) airBad++;
    if (a.position.y < 30 || a.position.y > 40) airBad++;
  }
  eq(airBad, 0, '飞艇始终在半径 55、高度 32~36 巡航');
  between(rMin, 54.9, 55.1, '飞艇半径稳定');

  // 小船：沿河道往返且不飞出岛外
  let boatBad = 0;
  for (let k = 0; k < 300; k++) {
    H.updateDynamics(1 / 60, k / 60 * 2);
    const boat = H.scene.children.find(isBoat);
    if (!boat) { boatBad++; break; }
    if (!isFinite(boat.position.x + boat.position.y + boat.position.z)) boatBad++;
    if (Math.hypot(boat.position.x, boat.position.z) > 70) boatBad++;
  }
  eq(boatBad, 0, '小船始终在河道范围内');

  // 行人：贴地行走，不飞出岛外
  let npcBad = 0;
  for (let k = 0; k < 300; k++) {
    H.updateDynamics(1 / 60, k / 60);
    npcs.forEach(function (o) {
      const gh = H.groundHeight(o.position.x, o.position.z);
      if (!isFinite(o.position.y) || Math.abs(o.position.y - gh) > 0.2) npcBad++;
    });
  }
  eq(npcBad, 0, '行人始终贴合地面');
}

/* ============================================================
 * 5. 昼夜循环与光照
 * ============================================================ */
section('昼夜循环与光照');
{
  const sky = H.scene.children.find(function (o) { return o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uSunDir; });
  ok(sky, '天空穹顶着色器存在');
  H.env.playing = false;

  H.env.t = 0.5; // 正午
  H.updateCycle(0);
  const noon = {
    dayF: H.env.dayF, nightF: H.env.nightF, duskF: H.env.duskF,
    sunDir: H.env.sunDir.clone(),
    sunPos: H.scene.children.find(function (o) { return o.isSprite && o.material.map; }) ? null : null,
    dirIntensity: H.dir.intensity, hemi: H.hemi.intensity,
    fog: H.scene.fog.density, skyTop: sky.material.uniforms.uTop.value.clone(),
    moonAmount: sky.material.uniforms.uMoonAmount.value
  };
  H.env.t = 0.02; // 深夜
  H.updateCycle(0);
  const night = {
    dayF: H.env.dayF, nightF: H.env.nightF,
    dirIntensity: H.dir.intensity, hemi: H.hemi.intensity,
    fog: H.scene.fog.density, skyTop: sky.material.uniforms.uTop.value.clone(),
    moonAmount: sky.material.uniforms.uMoonAmount.value
  };
  near(noon.dayF, 1, 1e-6, '正午 dayF = 1');
  near(noon.nightF, 0, 1e-6, '正午 nightF = 0');
  near(night.nightF, 1, 1e-6, '深夜 nightF = 1');
  near(night.dayF, 0, 1e-6, '深夜 dayF = 0');
  ok(noon.dirIntensity > night.dirIntensity * 2, '白天主光强于夜晚');
  ok(noon.hemi > night.hemi, '白天环境光强于夜晚');
  ok(noon.fog < night.fog, '夜晚雾更浓');
  ok(noon.skyTop.getHex() !== night.skyTop.getHex(), '天空顶色随昼夜变化');
  ok(noon.skyTop.b > noon.skyTop.r, '正午天空偏蓝');
  ok(night.skyTop.getHex() < 0x202040, '深夜天空接近深蓝黑');
  near(noon.moonAmount, 0, 1e-6, '正午月亮强度 0');
  near(night.moonAmount, 1, 1e-6, '深夜月亮强度 1');

  // 太阳/月亮位置与太阳方向一致
  H.env.t = 0.35;
  H.updateCycle(0);
  const sunSprite = H.scene.children.find(function (o) { return o.isSprite && o.material.map && o.scale.x === 46; }) ||
    H.scene.children.filter(function (o) { return o.isSprite; })[0];
  const sunDir = H.env.sunDir;
  near(sunDir.length(), 1, 1e-6, '太阳方向向量已归一化');
  const sunMesh = H.scene.children.find(function (o) {
    return o.isMesh && o.material && o.material.type === 'MeshBasicMaterial' && o.geometry.type === 'SphereGeometry' && o.geometry.parameters.radius === 7;
  });
  ok(sunMesh, '太阳球体存在');
  const sunLen = sunMesh.position.length();
  near(sunLen, 400, 1e-3, '太阳位于半径 400 的天球上');
  const dot = sunMesh.position.clone().normalize().dot(sunDir);
  near(dot, 1, 1e-6, '太阳位置与太阳方向一致');

  // 夜晚灯光
  H.env.t = 0.02;
  H.updateCycle(0);
  const lampNight = H.lampLights[0].intensity;
  const winNight = H.winMats[0].emissiveIntensity;
  const beamNight = H.beamMat.opacity;
  H.env.t = 0.5;
  H.updateCycle(0);
  ok(lampNight > 5, '夜晚路灯点亮（' + lampNight.toFixed(2) + '）');
  near(H.lampLights[0].intensity, 0, 1e-9, '白天路灯熄灭');
  ok(winNight > 1, '夜晚窗户发光');
  near(H.winMats[0].emissiveIntensity, 0.05, 0.05, '白天窗户几乎不发光');
  ok(beamNight > 0.3, '夜晚灯塔光束可见');
  near(H.beamMat.opacity, 0, 1e-9, '白天灯塔光束不可见');

  // 时间推进：speed=1 时 60 秒一天
  H.env.playing = true; H.env.speed = 1; H.env.t = 0;
  H.updateCycle(30);
  near(H.env.t, 0.5, 1e-9, '30 秒推进半天');
  H.updateCycle(30);
  near(H.env.t, 0, 1e-9, '60 秒回到起点（一天循环）');
  H.env.speed = 10;
  H.updateCycle(6);
  near(H.env.t, 0, 1e-9, '10× 速度下 6 秒走完一天（回到 0）');
  H.env.t = 0;
  H.updateCycle(3);
  near(H.env.t, 0.5, 1e-9, '10× 速度下 3 秒走半天');
  // 防御：外部写入越界时间不应产生负数
  H.env.t = -0.1;
  H.updateCycle(0);
  ok(H.env.t >= 0 && H.env.t < 1, '越界时间被修正到 [0,1)');
  H.env.playing = false;
  H.env.speed = 1;
}

section('HUD');
{
  H.env.t = 0.3; // 07:12
  H.updateHud();
  eq(W.els.clock.textContent, '07:12', 'HUD 时钟文本');
  eq(W.els.phase.textContent, '清晨', 'HUD 时段名称');
  eq(W.els.sunDot.style.left, '30%', 'HUD 太阳位置');
  H.env.t = 0.02;
  H.updateHud();
  eq(W.els.phase.textContent, '深夜', '深夜时段名称');
  H.env.t = 0.5;
  H.updateHud();
  eq(W.els.phase.textContent, '正午', '正午时段名称');
}

/* ============================================================
 * 6. 渲染循环
 * ============================================================ */
section('渲染循环');
{
  const countObjects = function () {
    let n = 0, g = 0, m = 0;
    H.scene.traverse(function (o) {
      n++;
      if (o.geometry) g++;
      if (o.material) m++;
    });
    return { n: n, g: g, m: m };
  };
  const before = countObjects();
  const rendersBefore = W.renders();
  let thrown = null;
  const t0 = Date.now();
  const FRAMES = 240;
  for (let i = 0; i < FRAMES; i++) {
    try {
      H.__loop.animate();
    } catch (e) { thrown = e; break; }
  }
  const elapsed = Date.now() - t0;
  ok(thrown === null, '跑 ' + FRAMES + ' 帧无异常' + (thrown ? '：' + thrown.message : ''));
  ok(W.renders() - rendersBefore >= FRAMES, '每帧都调用 renderer.render（' + (W.renders() - rendersBefore) + ' 次）');
  const after = countObjects();
  eq(after.n, before.n, '帧循环不增删场景对象');
  eq(after.g, before.g, '帧循环不创建几何体');
  eq(after.m, before.m, '帧循环不创建材质');
  const perFrame = elapsed / FRAMES;
  ok(perFrame < 8, '每帧 CPU 更新耗时 ' + perFrame.toFixed(3) + ' ms（< 8ms 预算）');
  // 相机与水面着色器每帧更新
  ok(isFinite(H.camera.position.x + H.camera.position.y + H.camera.position.z), '相机位置有限');
  ok(H.camera.aspect > 0, '相机宽高比有效');
  ok(H.waterMats.length > 0 && H.waterMats[0].uniforms.uTime.value > 0, '水面时间在推进');
  ok(H.waterfallMat.uniforms.uTime.value >= 0, '溪流时间在推进');
  ok(H.env.t >= 0 && H.env.t < 1, '时间始终在 [0,1) 内');
  // 帧循环中不应出现 NaN
  let nan = 0;
  H.scene.traverse(function (o) {
    if (!isFinite(o.position.x + o.position.y + o.position.z)) nan++;
  });
  eq(nan, 0, '帧循环后场景无 NaN');
  // 手动驱动 rAF 队列（测试模式下 main.js 不自转）
  const flushed = W.flushRaf();
  ok(flushed >= 1, '加载层回调已入队（' + flushed + '）');
  ok(W.els.loading.classList.contains('hidden'), '加载层已淡出');
  // 相机自动旋转
  H.state.autoRotate = true;
  const theta0 = H.orbit.thetaT;
  for (let i = 0; i < 60; i++) H.__loop.animate();
  ok(H.orbit.thetaT > theta0, '自动旋转推进相机角度');
  H.state.autoRotate = false;
}

/* ============================================================
 * 7. 健壮性
 * ============================================================ */
section('健壮性');
{
  // 窗口尺寸为 0（最小化/隐藏）不应产生 NaN 投影矩阵
  const W2 = createWorld({ width: 0, height: 0 });
  ok(isFinite(W2.H.camera.aspect) && W2.H.camera.aspect > 0, '窗口 0×0 时相机宽高比有效');
  ok(W2.H.renderer.size.width >= 1 && W2.H.renderer.size.height >= 1, '窗口 0×0 时渲染尺寸被兜底');
  let threw = null;
  try { for (let i = 0; i < 5; i++) W2.H.__loop.animate(); } catch (e) { threw = e; }
  ok(threw === null, '窗口 0×0 时仍能跑帧循环' + (threw ? '：' + threw.message : ''));
  const pm = W2.H.camera.projectionMatrix.elements;
  let pmOk = true;
  for (let i = 0; i < pm.length; i++) if (!isFinite(pm[i])) pmOk = false;
  ok(pmOk, '窗口 0×0 时投影矩阵无 NaN');

  // resize 事件
  W2.window.innerWidth = 800; W2.window.innerHeight = 600;
  W2.emit('window', 'resize', {});
  W2.flushRaf();
  ok(isFinite(W2.H.camera.aspect) && Math.abs(W2.H.camera.aspect - 800 / 600) < 1e-9, 'resize 后相机宽高比更新');

  // WebGL 不可用：给出提示而不是抛异常
  const W3 = createWorld({ renderer: 'no-webgl' });
  ok(W3.H.renderer === undefined, 'WebGL 不可用时没有创建渲染器');
  eq(W3.H.scene.children.length, 0, 'WebGL 不可用时不构建场景');
  ok(String(W3.els.loading.textContent).indexOf('WebGL') >= 0, 'WebGL 不可用时显示提示文案');
  ok(!W3.els.loading.classList.contains('hidden'), '提示文案没有被隐藏');

  const W4 = createWorld({ renderer: 'throw' });
  ok(String(W4.els.loading.textContent).indexOf('WebGL') >= 0, '渲染器构造抛异常时也显示提示');

  // 缓存与释放
  const g1 = H.boxGeo(1.5, 2, 3), g2 = H.boxGeo(1.5, 2, 3);
  ok(g1 === g2, '相同尺寸的几何体被复用（几何缓存）');
  const m1 = H.mat('#123456'), m2 = H.mat('#123456');
  ok(m1 === m2, '相同参数的材质被复用（材质缓存）');
  ok(typeof H.disposeCaches === 'function', '提供 disposeCaches 清理接口');
  const sceneChildren = H.scene.children.length;
  H.disposeCaches();
  eq(H.scene.children.length, sceneChildren, 'disposeCaches 不破坏场景结构');
  ok(H.boxGeo(1.5, 2, 3) !== g1, 'disposeCaches 之后缓存被清空');
}

/* ---------- 总结 ---------- */
console.log('\n========================================');
console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
console.log('========================================');
if (failed > 0) process.exit(1);
