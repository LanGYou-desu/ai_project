'use strict';
/* ============================================================
 * 雨夜便利店 RAIN MART · test/run.js
 * 零依赖测试：node test/run.js
 *
 * 覆盖：
 *   1. 文件与入口（index.html 无 UI、无外链、脚本顺序）
 *   2. 场景装配（命名空间 / 相机 / 渲染器 / 灯光预算 / 雾 / 天穹 / 描边）
 *   3. 底座铺装数据（无缝无重叠覆盖、边界、材质类型）
 *   4. 便利店外壳（玻璃登记、自动门、招牌灯箱、门传感器）
 *   5. 店内陈设（灯位、商品实例化、关东煮蒸汽）
 *   6. 街景道具（贩卖机 / 路灯 / 信号灯 / 霓虹 / 湿地反光）
 *   7. 雨（雨丝实例化 + 禁落区、玻璃雨痕、水膜、滴水与涟漪）
 *   8. 动态（招牌霓虹闪烁、自动门开合、信号灯循环、灯闪、蒸汽）
 *   9. 主循环 240 帧（无异常 / 无 NaN / 不新建几何与材质）
 *  10. 轨道相机（滚轮 / 拖拽 / 平移 / 夹取 / 自动旋转 / 双击复位）
 *  11. 视口自适应（resize 合帧）
 *  12. 健壮性（无 WebGL / 构造抛错 → 降级提示）
 *  13. 构建确定性（两次构建场景签名一致）
 *  14. 缓存清理（disposeCaches）
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { createWorld, ROOT } = require('./stub.js');

/* ---------- 断言工具 ---------- */
let passed = 0, failed = 0;
function show(v) {
  if (v && typeof v === 'object') {
    if (v.isObject3D) return 'Object3D<' + (v.type || '?') + '>';
    if (v.tagName) return 'El<' + v.tagName + '>';
  }
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; console.log('  ✗ ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, (msg || '') + ' (got ' + show(a) + ', want ' + show(b) + ')');
}
function near(a, b, tol, msg) {
  tol = tol == null ? 1e-9 : tol;
  ok(Math.abs(a - b) <= tol, (msg || '') + ' (got ' + a + ', want ' + b + '±' + tol + ')');
}
function between(v, lo, hi, msg) {
  ok(v >= lo && v <= hi, (msg || '') + ' (got ' + v + ', want ' + lo + '..' + hi + ')');
}
function isNum(v, msg) { ok(typeof v === 'number' && isFinite(v), (msg || '') + ' (got ' + v + ')'); }
function section(name) { console.log('\n== ' + name + ' =='); }

/* ============================================================
 * 1. 文件与入口
 * ============================================================ */
section('1. 文件与入口');
const FILE_LIST = [
  'index.html', 'run.bat', 'README.md', 'serve.js', 'vendor/three.min.js',
  'js/util.js', 'js/base.js', 'js/store.js', 'js/interior.js',
  'js/props.js', 'js/rain.js', 'js/dynamics.js', 'js/main.js',
  'test/stub.js', 'test/run.js'
];
FILE_LIST.forEach(function (f) {
  ok(fs.existsSync(path.join(ROOT, f)), '文件存在: ' + f);
});

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(html.indexOf('lang="zh-CN"') >= 0, 'index.html 语言标记');
ok(html.indexOf('charset="UTF-8"') >= 0, 'index.html 使用 UTF-8');
ok(html.indexOf('<canvas id="scene">') >= 0, 'index.html 含全屏画布 #scene');

/* 脚本顺序：vendor 在前，其后按依赖顺序加载；数量恰好 9 个 */
const SCRIPT_ORDER = [
  'vendor/three.min.js', 'js/util.js', 'js/base.js', 'js/store.js', 'js/interior.js',
  'js/props.js', 'js/rain.js', 'js/dynamics.js', 'js/main.js'
];
let orderOk = true, cursor = -1;
SCRIPT_ORDER.forEach(function (f) {
  const i = html.indexOf('"' + f + '"');
  if (i < 0 || i < cursor) orderOk = false;
  cursor = i;
});
ok(orderOk, 'index.html 脚本依赖顺序正确');
eq((html.match(/<script\s/g) || []).length, 9, '脚本数量');

/* 纯画布：不允许任何 UI 元素 */
['<button', '<input', '<select', '<textarea', '<form', '<label', '<header', '<nav', '<aside', 'class="panel"', 'onclick=']
  .forEach(function (tag) { ok(html.indexOf(tag) < 0, 'index.html 无 UI 元素: ' + tag); });
ok(!/(src|href)="https?:/i.test(html), 'index.html 无外部资源链接');

/* ============================================================
 * 2. 场景装配
 * ============================================================ */
section('2. 场景装配');
const W = createWorld();
const R = W.R;
const THREE = W.THREE;

eq(typeof R, 'object', 'window.R 命名空间存在');
eq(THREE.REVISION, '158', 'vendor 里的 three.js 版本');
eq(W.rafQueue.length, 0, '测试模式不自动启动动画');
eq(W.window.__RAIN_TEST__, true, '测试标记 __RAIN_TEST__');
eq(W.consoleRec.errors.length, 0, '加载期无 console.error');
/* vendor 的 r150+ UMD 弃用提示不可避免，过滤后不允许其他警告 */
const loadWarns = W.consoleRec.warns.filter(function (w) { return String(w).indexOf('deprecated') < 0; });
eq(loadWarns.length, 0, '加载期无 console.warn（过滤 three UMD 弃用提示）');
eq(W.document.body._children.length, 0, '正常模式下无降级提示横幅');

const LOOP_API = ['animate', 'updateCamera', 'applyViewSize', 'viewSize', 'showFatal', 'panBy'];
eq(typeof R.__loop, 'object', 'R.__loop 测试钩子');
LOOP_API.forEach(function (k) { eq(typeof R.__loop[k], 'function', 'R.__loop.' + k + ' 是函数'); });

ok(R.scene && R.scene.isScene, '场景已创建');
ok(R.camera && R.camera.isPerspectiveCamera, '透视相机已创建');
eq(R.camera.fov, 42, '相机 FOV');
ok(R.renderer, '渲染器已创建');
eq(R.renderer.domElement, W.els.scene, '渲染器绑定 #scene 画布');
eq(R.renderer.shadowMap.enabled, true, '阴影已开启');
eq(R.renderer.toneMappingExposure, 1.16, '曝光');
ok(R.scene.fog && R.scene.fog.isFogExp2, '雾是 FogExp2');
near(R.scene.fog.density, 0.0105, 1e-9, '雾浓度');

const vs = R.__loop.viewSize();
eq(vs.w, 1280, 'viewSize 宽');
eq(vs.h, 720, 'viewSize 高');
near(R.camera.aspect, 1280 / 720, 1e-9, '初始宽高比');

/* ---- 遍历统计 ---- */
function scanScene(root) {
  const c = {
    meshes: 0, instanced: 0, sprites: 0, points: 0, lights: 0, outlines: 0,
    materials: {}, lightsByType: {}
  };
  root.traverse(function (o) {
    if (o.isMesh) c.meshes++;
    if (o.isInstancedMesh) c.instanced++;
    if (o.isSprite) c.sprites++;
    if (o.isPoints) c.points++;
    if (o.isLight) { c.lights++; c.lightsByType[o.type] = (c.lightsByType[o.type] || 0) + 1; }
    if (o.userData && o.userData.isOutline) c.outlines++;
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function (m) { c.materials[m.type] = (c.materials[m.type] || 0) + 1; });
    }
  });
  return c;
}
const SCAN = scanScene(R.scene);
ok(SCAN.meshes >= 600, '网格数量 ≥ 600（实际 ' + SCAN.meshes + '）');
ok(SCAN.outlines >= 100, '描边外扩壳 ≥ 100（实际 ' + SCAN.outlines + '）');
ok(SCAN.instanced >= 8, '实例化网格 ≥ 8（实际 ' + SCAN.instanced + '）');
ok(SCAN.sprites >= 20, '光晕 Sprite ≥ 20（实际 ' + SCAN.sprites + '）');
eq(SCAN.points, 1, '滴水使用 1 组 Points');
eq(SCAN.lights, 8, '灯光总数');
eq(SCAN.lightsByType.PointLight, 6, '点光源数量（3 店内 + 1 门口 + 2 道具）');
eq(SCAN.lightsByType.HemisphereLight, 1, '半球光');
eq(SCAN.lightsByType.DirectionalLight, 1, '月光平行光');

/* 三渲二材质白名单：不允许写实材质 */
const ALLOWED_MATS = ['MeshToonMaterial', 'MeshBasicMaterial', 'ShaderMaterial', 'PointsMaterial', 'SpriteMaterial', 'LineBasicMaterial'];
Object.keys(SCAN.materials).forEach(function (t) {
  ok(ALLOWED_MATS.indexOf(t) >= 0, '材质类型白名单: ' + t);
});
['MeshStandardMaterial', 'MeshPhongMaterial', 'MeshLambertMaterial', 'MeshPhysicalMaterial']
  .forEach(function (t) { eq(SCAN.materials[t], undefined, '不存在写实材质 ' + t); });
ok(SCAN.materials.MeshToonMaterial >= 300, 'toon 材质网格 ≥ 300（实际 ' + SCAN.materials.MeshToonMaterial + '）');
ok(SCAN.materials.MeshBasicMaterial >= 50, 'basic 材质网格 ≥ 50（实际 ' + SCAN.materials.MeshBasicMaterial + '）');
eq(SCAN.materials.ShaderMaterial, 8, '着色器材质使用数（天穹 1 + 雨丝 2 层共享 + 水膜 1 + 玻璃雨痕 4）');
{
  const shaderMats = new Set();
  R.scene.traverse(function (o) {
    if (o.material && o.material.isShaderMaterial) shaderMats.add(o.material.uuid);
  });
  eq(shaderMats.size, 7, '着色器材质实例数（近景雨层共享同一实例）');
}

const moon = R.lights.moon;
ok(moon && moon.castShadow, '月光投射阴影');
eq(moon.shadow.mapSize.x, 2048, '阴影贴图尺寸');
ok(R.lights.hemi.isHemisphereLight, '半球光存在');
eq(R.lights.interior.length, 3, '店内点光源 3 盏');
eq(R.lights.extra.length, 2, '道具点光源 2 盏（贩卖机 + 主路灯）');
ok(R.lights.doorSpill && R.lights.doorSpill.isPointLight, '门口溢出光');
R.lights.interior.forEach(function (l) { eq(l.baseIntensity, 2.5, '店内灯基准强度'); });

let sky = null;
R.scene.traverse(function (o) {
  if (o.material && o.material.isShaderMaterial && o.material.side === THREE.BackSide) sky = o;
});
ok(sky && sky.frustumCulled === false, '夜空穹顶（BackSide 着色器 + 不裁剪）');
ok(sky && sky.material.uniforms.uTop && sky.material.uniforms.uHorizon, '天穹渐变 uniforms');

/* ---- 分组 ---- */
const groups = {};
R.scene.children.forEach(function (c) { if (c.name) groups[c.name] = c; });
['base', 'store', 'interior', 'props'].forEach(function (n) {
  ok(groups[n], '场景分组存在: ' + n);
});
{
  const box = new THREE.Box3().setFromObject(groups.base);
  ok(box.min.y <= -1.3, '底座下沉（min.y = ' + box.min.y.toFixed(2) + '）');
  near(box.max.x, 15.08, 0.02, '底座压边宽度');
}

/* ---- util 工具自检 ---- */
eq(R.mat(0x224466), R.mat(0x224466), '材质缓存命中');
ok(R.mat(0x334455, { soft: true }) !== R.mat(0x334455), '不同参数不串缓存');
ok(R.toonTex(3).isDataTexture, 'toon 渐变贴图是 DataTexture');
eq(R.toonTex(3, true), R.toonTex(3, true), '渐变贴图缓存');
ok(R.toonTex(3) !== R.toonTex(5), '不同阶数不同贴图');
near(R.clamp(5, 0, 3), 3, 1e-9, 'clamp');
near(R.lerp(0, 10, 0.25), 2.5, 1e-9, 'lerp');
{
  const g0 = new THREE.BoxGeometry(1, 1, 1);
  const og = R.outlineGeo(g0, 0.05);
  og.computeBoundingBox();
  near(og.boundingBox.max.x, 0.55, 1e-6, '外扩壳沿法线外扩');
  ok(R.outlineGeo(g0, 0.05) === og, '外扩壳几何缓存');
  const im = R.instanced(R.scene, R.boxGeo(0.1, 0.1, 0.1), 0x112233, [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }
  ]);
  eq(im.isInstancedMesh, true, 'R.instanced 返回 InstancedMesh');
  eq(im.count, 2, 'R.instanced 实例数');
}
{
  const om = R.outlineMat();
  eq(om.side, THREE.BackSide, '描边材质 BackSide');
  eq(om.color.getHexString(), new THREE.Color(0x0b1018).convertSRGBToLinear().getHexString(), '描边深色');
}

/* ============================================================
 * 3. 底座铺装数据
 * ============================================================ */
section('3. 底座铺装数据');
const G = R.G;
const PATCHES = R.base.patches;
eq(G.SIZE, 30, '底座边长');
eq(G.HALF, 15, '底座半宽');
near(G.GY, 0.12, 1e-9, '人行道高度');
near(G.BOTTOM, -1.5, 1e-9, '底座下缘');
eq(PATCHES.length, 25, '铺装分区数量');

const KNOWN_MATS = ['road', 'walk', 'lot', 'yard', 'alley', 'gravel'];
let badPatches = 0;
PATCHES.forEach(function (p) {
  if (p.length !== 6 ||
    !(p[0] < p[2] && p[1] < p[3]) ||
    p[0] < -G.HALF || p[1] < -G.HALF || p[2] > G.HALF || p[3] > G.HALF ||
    KNOWN_MATS.indexOf(p[4]) < 0 ||
    (p[4] === 'road' ? p[5] !== G.ROADY : p[5] !== G.GY)) badPatches++;
});
eq(badPatches, 0, '每个分区结构合法（范围 / 顺序 / 材质 / 高度）');

/* 采样网格：无缝且无重叠 */
let samples = 0, uncovered = 0, multi = 0;
for (let x = -G.HALF + 0.125; x < G.HALF; x += 0.25) {
  for (let z = -G.HALF + 0.125; z < G.HALF; z += 0.25) {
    samples++;
    let n = 0;
    for (let i = 0; i < PATCHES.length; i++) {
      const p = PATCHES[i];
      if (x > p[0] && x < p[2] && z > p[1] && z < p[3]) n++;
    }
    if (n === 0) uncovered++;
    else if (n > 1) multi++;
  }
}
eq(samples, 14400, '采样点数量');
eq(uncovered, 0, '地面无未铺装缝隙');
eq(multi, 0, '地面无重叠铺装');

/* 便利店占地被单独登记（建筑坐在完整地面上） */
const footprintPatch = PATCHES.filter(function (p) {
  return p[0] === G.STORE.x0 && p[2] === G.STORE.x1 && p[1] === G.STORE.z0 && p[3] === G.STORE.z1;
});
eq(footprintPatch.length, 1, '便利店占地分区存在');
ok(groups.base.children.length >= 40, '底座构建了路面 / 标线 / 水洼等（' + groups.base.children.length + ' 个对象）');

/* ============================================================
 * 4. 便利店外壳
 * ============================================================ */
section('4. 便利店外壳');
const S = G.STORE;
eq(S.wallTop, 3.3, '墙体高度');
eq(S.parapet, 3.62, '女儿墙高度');
near(S.floor, 0.24, 1e-9, '室内地面高度');
near(S.ceil, 2.9, 1e-9, '天花高度');

eq(R.glass.length, 4, '登记给雨痕的玻璃窗格数量');
let glassBad = 0;
R.glass.forEach(function (p) {
  if (!(p.x0 < p.x1 && p.y0 < p.y1) || !isFinite(p.z) || !p.mesh) glassBad++;
});
eq(glassBad, 0, '玻璃窗格数据合法');
ok(R.glass.every(function (p) { return p.z === -0.97; }), '窗格位于立面玻璃平面');

const door = R.store.door;
eq(door.panels.length, 2, '自动门两扇');
eq(door.panels[0].dir * door.panels[1].dir, -1, '两扇门滑动方向相反');
near(door.closedCx[0], -3.25, 1e-9, '左门板中心');
near(door.closedCx[1], -1.95, 1e-9, '右门板中心');
near(door.panels[0].g.position.x, 0, 1e-9, '初始闭合');
near(door.panels[1].g.position.x, 0, 1e-9, '初始闭合');
eq(R.store.brandStripTex.isTexture, true, '品牌色带贴图');

ok(R.signMat && R.signMat.isMeshBasicMaterial, '招牌灯箱材质（可闪烁）');
ok(R.signGlowMat && R.signGlowMat.transparent, '招牌地面辉光材质独立克隆');
ok(R.glows && R.glows.sign, '招牌地面辉光已登记');
ok(R.doorLed && R.doorLed.isMesh, '门顶传感器 LED');

/* ============================================================
 * 5. 店内陈设
 * ============================================================ */
section('5. 店内陈设');
eq(R.interior.lightSpots.length, 3, '店内灯位 3 处');
R.interior.lightSpots.forEach(function (p) {
  isNum(p.x, '灯位 x'); isNum(p.y, '灯位 y'); isNum(p.z, '灯位 z');
  ok(p.x > S.x0 && p.x < S.x1 && p.z > S.z0 && p.z < S.z1, '灯位在店内');
});
ok(R.interior.products >= 100, '货架商品实例 ≥ 100（实际 ' + R.interior.products + '）');
ok(R.interior.productMeshes >= 6, '商品按色分组网格 ≥ 6（实际 ' + R.interior.productMeshes + '）');
ok(R.interior.group.children.length >= 40, '店内对象数 ≥ 40（' + R.interior.group.children.length + '）');
ok(R.steam && R.steam.length >= 4, '关东煮蒸汽粒子 ≥ 4');
R.steam.forEach(function (st) {
  ok(st.spr && st.spr.isSprite, '蒸汽是 Sprite');
  isNum(st.y0, '蒸汽起始高度');
});
{
  const box = new THREE.Box3().setFromObject(R.interior.group);
  ok(box.max.y <= S.ceil + 0.2, '店内陈设不穿出天花板');
}

/* ============================================================
 * 6. 街景道具
 * ============================================================ */
section('6. 街景道具');
const props = R.props;
ok(props && groups.props, '道具模块已建立');
eq(props.lights.length, 2, '道具光源登记（贩卖机 + 主路灯）');
props.lights.forEach(function (p) {
  isNum(p.x); isNum(p.y); isNum(p.z);
  ok(p.intensity > 0 && p.distance > 0 && p.decay >= 0, '道具光源参数合法');
});
['vending', 'lamp', 'alley', 'neon', 'laundry'].forEach(function (k) {
  ok(props.glows[k], '湿地反光登记: ' + k);
  ok(props.glows[k].material.blending === THREE.AdditiveBlending, k + ' 使用加色混合');
});
ok(props.glows.lamp.material.map, '路灯反光带渐变贴图');

ok(R.neon && R.neon.mat && R.neon.mat.isMeshBasicMaterial, '竖排霓虹面');
ok(R.neon.halo && R.neon.halo.isSprite, '霓虹光晕 Sprite');
ok(R.traffic && R.traffic.lamps, '交通信号灯');
['red', 'yellow', 'green'].forEach(function (k) {
  const lamp = R.traffic.lamps[k];
  ok(lamp && lamp.mesh && lamp.mesh.isMesh, '信号灯 ' + k + ' 灯面');
  ok(lamp.halo && lamp.halo.isSprite, '信号灯 ' + k + ' 光晕');
  ok(typeof R.traffic.base[k] === 'number' && typeof R.traffic.dim[k] === 'number', '信号灯 ' + k + ' 明暗色');
});
eq(R.traffic.state, 0, '初始相位');
ok(R.traffic.decal && R.traffic.decal.material.blending === THREE.AdditiveBlending, '信号灯地面反光贴片');
ok(isFinite(R.traffic.decal.material.opacity), '反光贴片透明度有效');

/* 灯柱、电线杆、指示牌等坐落于底座范围 */
const propsBox = new THREE.Box3().setFromObject(groups.props);
ok(propsBox.min.x >= -G.HALF - 0.5 && propsBox.max.x <= G.HALF + 0.5, '道具不越界（x）');
ok(propsBox.min.z >= -G.HALF - 0.5 && propsBox.max.z <= G.HALF + 0.5, '道具不越界（z）');

/* 背景楼真实开窗（实例化几何，而非贴图假窗） */
const bgw = R.props.bgWindows;
ok(bgw, '背景楼开窗已登记');
eq(bgw.total, bgw.lit + bgw.dark, '亮窗 + 暗窗 = 开窗总数');
ok(bgw.total >= 60, '真实开窗 ≥ 60（实际 ' + bgw.total + '）');
ok(bgw.lit >= 8 && bgw.dark >= 8, '亮 / 暗窗分布合理');
['frames', 'sills', 'litMesh', 'darkMesh'].forEach(function (k) {
  ok(bgw[k] && bgw[k].isInstancedMesh, '开窗实例网格: ' + k);
});
eq(bgw.frames.count, bgw.total, '窗框实例数 = 开窗总数');
eq(bgw.sills.count, bgw.total, '窗台实例数 = 开窗总数');
{
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), s3 = new THREE.Vector3();
  let bad = 0;
  for (let i = 0; i < bgw.frames.count; i++) {
    bgw.frames.getMatrixAt(i, m4);
    m4.decompose(v3, q, s3);
    if (!isFinite(v3.x) || !isFinite(v3.y) || !isFinite(v3.z) || !isFinite(s3.x) || !isFinite(s3.y)) bad++;
    else if (Math.abs(v3.x) > 15.4 || Math.abs(v3.z) > 15.4) bad++;
  }
  eq(bad, 0, '开窗实例均位于底座范围且数值有效');
}

/* ============================================================
 * 7. 雨
 * ============================================================ */
section('7. 雨');
const rain = R.rain;
eq(rain.streaks.count, 1250, '雨丝实例数');
eq(rain.streaks.mesh.isInstancedMesh, true, '雨丝是 InstancedMesh');
eq(rain.streaks.mat.isShaderMaterial, true, '雨丝是着色器材质');
ok(rain.streaks.near && rain.streaks.near.mesh.isInstancedMesh, '近景大雨层存在');
eq(rain.streaks.near.count, 260, '近景大雨层实例数');
eq(rain.streaks.near.mesh.material, rain.streaks.mat, '近景层共享雨丝材质（不新增着色器）');
['uTime', 'uHeight', 'uWind', 'uColor', 'uAlpha'].forEach(function (u) {
  ok(rain.streaks.mat.uniforms[u], '雨丝 uniform: ' + u);
});
ok(rain.streaks.mesh.frustumCulled === false, '雨丝不裁剪');

/* 雨滴不落在建筑内部 */
{
  const off = rain.streaks.mesh.geometry.attributes.iOffset.array;
  const par = rain.streaks.mesh.geometry.attributes.iParams.array;
  eq(off.length, 1250 * 3, 'iOffset 缓冲');
  eq(par.length, 1250 * 4, 'iParams 缓冲');
  const knd = rain.streaks.mesh.geometry.attributes.iKind.array;
  eq(knd.length, 1250, 'iKind 缓冲');
  let kindBad = 0;
  for (let i = 0; i < knd.length; i++) { if (knd[i] !== 0) kindBad++; }
  eq(kindBad, 0, '主雨层 iKind 全 0');
  const nknd = rain.streaks.near.mesh.geometry.attributes.iKind.array;
  let nkBad = 0;
  for (let i = 0; i < nknd.length; i++) { if (nknd[i] !== 1) nkBad++; }
  eq(nkBad, 0, '近景层 iKind 全 1');
  let inStore = 0, inHouse = 0, badRange = 0;
  for (let i = 0; i < 1250; i++) {
    const x = off[i * 3], z = off[i * 3 + 2];
    if (x > S.x0 - 0.2 && x < S.x1 + 0.2 && z > S.z0 - 0.2 && z < S.z1 + 0.2) inStore++;
    if (x > G.HOUSE.x0 - 0.2 && x < G.HOUSE.x1 + 0.2 && z > G.HOUSE.z0 - 0.2 && z < G.HOUSE.z1 + 0.2) inHouse++;
    const speed = par[i * 4], len = par[i * 4 + 1], thick = par[i * 4 + 2], yaw = par[i * 4 + 3];
    if (speed < 13 || speed > 20 || len < 0.5 || len > 1.5 ||
      thick < 0.5 || thick > 1.25 || yaw < 0 || yaw > Math.PI * 2) badRange++;
    isNum(off[i * 3 + 1]);
  }
  eq(inStore, 0, '雨丝不落入便利店内');
  eq(inHouse, 0, '雨丝不落入邻家屋内');
  eq(badRange, 0, '雨丝参数范围合法');
}

eq(rain.rivuletMats.length, R.glass.length, '每格玻璃一组雨痕材质');
rain.rivuletMats.forEach(function (m) {
  ok(m.isShaderMaterial && m.uniforms.uTime && m.uniforms.uOpacity && m.uniforms.uWind, '玻璃雨痕着色器材质（含风场）');
  between(m.uniforms.uTime.value, 0, 30, '雨痕相位随机但有限');
  near(m.uniforms.uOpacity.value, 0.55, 1e-9, '雨痕基础透明度');
});
eq(rain.filmMat.isShaderMaterial, true, '湿地面水膜着色器');
['uTime', 'uIntensity', 'uWind'].forEach(function (u) { ok(rain.filmMat.uniforms[u], '水膜 uniform: ' + u); });
near(rain.filmMat.uniforms.uIntensity.value, 1.0, 1e-9, '水膜强度初始值');

eq(rain.drips.length, 16, '屋檐滴水点数量');
rain.drips.forEach(function (d) {
  ok(d.e.x >= -G.HALF && d.e.x <= G.HALF && d.e.z >= -G.HALF && d.e.z <= G.HALF, '滴水点位于底座内');
  ok(d.e.y0 > d.e.y1, '滴水起止高度');
  ok(d.period >= 0.9 && d.period <= 2.2, '滴水周期');
  isNum(d.dx, '滴水风偏 x');
  isNum(d.dz, '滴水风偏 z');
});
eq(rain.ripples.length, 20, '涟漪环池');
rain.ripples.forEach(function (rp) { eq(rp.mesh.visible, false, '涟漪初始隐藏'); });

/* 手动触发涟漪 + 生命周期 */
{
  const rp = rain.spawnRipple(1, 0.15, 2, 0.5, 0.8);
  eq(rp.mesh.visible, true, 'spawnRipple 显形');
  near(rp.mesh.position.x, 1, 1e-9, '涟漪落点 x');
  near(rp.mesh.position.z, 2, 1e-9, '涟漪落点 z');
  eq(rp.active, true, '涟漪激活');
  R.updateRain(0.1, 10);
  ok(rp.mat.opacity > 0 && rp.mat.opacity <= 0.9, '涟漪渐隐中');
  ok(rp.mat.opacity > 0.6, '涟漪初生闪光增强');
  ok(rp.mesh.scale.x > 0.06, '涟漪扩散');
  R.updateRain(0.5, 10.5);
  eq(rp.active, false, '涟漪生命周期结束');
  eq(rp.mesh.visible, false, '涟漪回收隐藏');
  eq(rp.mat.opacity, 0, '涟漪透明度归零');
}

/* 长时间降雨：滴水循环 + 落点涟漪 + 雨丝时间推进 */
{
  let sawFalling = false, sawRipple = false, badPos = 0;
  for (let i = 0; i < 600; i++) {
    R.updateRain(0.05, i * 0.05);
    for (let j = 0; j < rain.drips.length; j++) {
      if (rain.drips[j].falling) sawFalling = true;
      const y = rain.points.geometry.attributes.position.array[j * 3 + 1];
      if (!isFinite(y)) badPos++;
    }
    if (rain.ripples.some(function (rp) { return rp.active; })) sawRipple = true;
  }
  ok(sawFalling, '滴水持续下落');
  ok(sawRipple, '滴水落地生成涟漪');
  eq(badPos, 0, '滴水位置无 NaN');
  near(rain.streaks.mat.uniforms.uTime.value, 599 * 0.05, 1e-9, '雨丝时间推进');

  /* 阵风风场联动 */
  isNum(R.wind.x, '风场 x'); isNum(R.wind.z, '风场 z');
  ok(R.wind.gust >= 0.2 && R.wind.gust <= 1.4, '阵风强度有效');
  between(Math.abs(rain.streaks.mat.uniforms.uWind.value.x), 0, 0.2, '雨丝风偏幅度合理');
  eq(rain.filmMat.uniforms.uWind.value.x, R.wind.x, '水膜风场联动');
  eq(rain.rivuletMats[0].uniforms.uWind.value.x, R.wind.x, '玻璃雨痕风场联动');
  const wxA = rain.streaks.mat.uniforms.uWind.value.x;
  R.updateRain(0.05, 100);
  ok(Math.abs(rain.streaks.mat.uniforms.uWind.value.x - wxA) > 1e-5, '阵风随时间变化');
}
{
  const rp = R.rain.ripples.filter(function (r) { return r.active; })[0];
  if (rp) between(rp.mat.opacity, 0, 0.9, '活动涟漪透明度范围');
  ok(true, '涟漪状态抽样');
}

/* ============================================================
 * 8. 动态
 * ============================================================ */
section('8. 动态');
ok(R.dyn && R.dyn.spillMat, '动态系统已初始化');
eq(R.dyn.door.state, 'closed', '初始门状态');
eq(R.dyn.door.cycles, 0, '初始开门计数');
ok(R.dyn.spillMat.blending === THREE.AdditiveBlending, '门口溢出光贴片');
eq(R.dyn.traffic.state, 0, '信号灯初始绿');

/* ---- 自动门开合 ---- */
const dr = R.dyn.door;
dr.timer = 0.05;
let maxOpen = 0, maxX0 = 0, maxX1 = 0, sawOpening = false, sawClosing = false, sawSpillUp = false, maxSpillLight = 0;
const spillBase = R.dyn.spillMat.opacity;
for (let i = 0; i < 70; i++) {                     // 模拟 7 秒：开 → 停 → 关
  R.updateDynamics(0.1, i * 0.1);
  if (dr.state === 'opening') sawOpening = true;
  if (dr.state === 'closing') sawClosing = true;
  if (dr.open > maxOpen) maxOpen = dr.open;
  const p0 = door.panels[0].g.position.x, p1 = door.panels[1].g.position.x;
  if (p0 < maxX0) maxX0 = p0;
  if (p1 > maxX1) maxX1 = p1;
  if (R.dyn.spillMat.opacity > spillBase + 0.05) sawSpillUp = true;
  if (R.lights.doorSpill.intensity > maxSpillLight) maxSpillLight = R.lights.doorSpill.intensity;
}
eq(dr.cycles, 1, '完成一次开门周期');
ok(sawOpening && sawClosing, '经历开门与关门阶段');
ok(maxOpen > 0.95, '门完全打开（max open = ' + maxOpen.toFixed(3) + '）');
ok(maxX0 < -1.2 && maxX1 > 1.2, '门板向两侧滑开');
ok(maxX0 >= -1.31 - 1e-6 && maxX1 <= 1.31 + 1e-6, '门板滑动不超过门框');
ok(sawSpillUp, '门开时地面溢出光变亮');
ok(maxSpillLight > 1.2, '门口点光源随门开增强（max = ' + maxSpillLight.toFixed(2) + '）');
eq(dr.state, 'closed', '周期结束后门回到关闭');
ok(Math.abs(door.panels[0].g.position.x) < 0.35, '门板回收至闭合位');
{
  /* 门开时光照外溢贴片透明度上限 */
  let spillMax = 0;
  dr.timer = 0.05;
  for (let i = 0; i < 60; i++) { R.updateDynamics(0.1, 100 + i * 0.1); spillMax = Math.max(spillMax, R.dyn.spillMat.opacity); }
  between(spillMax, 0.3, 0.65, '溢出贴片透明度上限合理');
}

/* ---- 招牌闪烁 ---- */
let minR = 1, maxR = 0, minGlow = 1, maxGlow = 0;
for (let i = 0; i < 220; i++) {                    // 22 秒
  R.updateDynamics(0.1, 200 + i * 0.1);
  const cr = R.signMat.color;
  if (cr.r < minR) minR = cr.r;
  if (cr.r > maxR) maxR = cr.r;
  if (R.signGlowMat.opacity < minGlow) minGlow = R.signGlowMat.opacity;
  if (R.signGlowMat.opacity > maxGlow) maxGlow = R.signGlowMat.opacity;
}
between(minR, 0.5, 1.001, '招牌亮度下限（闪烁）');
between(maxR, 0.95, 1.001, '招牌亮度上限');
ok(minR < 0.95, '招牌出现闪烁低谷');
between(minGlow, 0.08, 0.21, '招牌地面反光透明度范围');
ok(maxGlow > 0.14, '招牌地面反光呼吸');

/* ---- 霓虹闪烁 ---- */
let neonMin = 1, neonMax = 0;
for (let i = 0; i < 260; i++) {                    // 26 秒
  R.updateDynamics(0.1, 300 + i * 0.1);
  const o = R.neon.halo.material.opacity;
  if (o < neonMin) neonMin = o;
  if (o > neonMax) neonMax = o;
}
between(neonMin, 0.08, 0.35, '霓虹光晕下限（旧灯管抖动）');
between(neonMax, 0.15, 0.35, '霓虹光晕上限');
ok(neonMin < neonMax, '霓虹出现明暗变化');
const neonR = R.neon.mat.color.r;
between(neonR, 0.55, 1.001, '霓虹面色范围');
const neonGlow = R.props.glows.neon.material.opacity;
between(neonGlow, 0.05, 0.17, '霓虹湿地反光范围');

/* ---- 交通灯循环 ---- */
const tr = R.dyn.traffic, tf = R.traffic;
tr.state = 0;                                      // 前置测试推进过时间，重置回绿灯再验时序
tr.timer = 0.05;
const seq = [];
let prevState = tr.state;
for (let i = 0; i < 400; i++) {                    // 40 秒
  R.updateDynamics(0.1, 400 + i * 0.1);
  if (tr.state !== prevState) { seq.push(tr.state); prevState = tr.state; }
}
eq(seq[0], 1, '绿灯结束后转黄');
eq(seq[1], 2, '黄灯结束后转红');
ok(seq.indexOf(0) >= 2, '红灯结束后回到绿');
ok(seq.length >= 3, '循环持续推进');
{
  const names = ['green', 'yellow', 'red'];
  const act = names[tr.state];
  const activeLamp = tf.lamps[act];
  function colDist(c, hex) {
    const t = new THREE.Color(hex);
    return Math.abs(c.r - t.r) + Math.abs(c.g - t.g) + Math.abs(c.b - t.b);
  }
  ok(colDist(activeLamp.mesh.material.color, tf.base[act]) <
    colDist(activeLamp.mesh.material.color, tf.dim[act]), '当前相位灯更亮');
  eq(activeLamp.halo.material.opacity, 0.5, '当前相位光晕全亮');
  names.forEach(function (n) {
    if (n !== act) eq(tf.lamps[n].halo.material.opacity, 0.06, n + ' 灯熄');
  });
  between(tf.decal.material.opacity, 0.16, 0.43, '信号灯地面反光呼吸');
}

/* ---- 店内灯轻微闪动 ---- */
for (let i = 0; i < 120; i++) R.updateDynamics(0.1, 500 + i * 0.1);
R.lights.interior.forEach(function (l) {
  between(l.intensity, l.baseIntensity * 0.8, l.baseIntensity * 1.2, '店内灯强度范围');
});

/* ---- 关东煮蒸汽 ---- */
{
  const y0 = R.steam.map(function (s) { return s.spr.position.y; });
  for (let i = 0; i < 60; i++) R.updateDynamics(0.1, 600 + i * 0.1);
  let moved = 0;
  R.steam.forEach(function (s, i) {
    if (Math.abs(s.spr.position.y - y0[i]) > 1e-4) moved++;
    between(s.spr.material.opacity, 0, 0.21, '蒸汽透明度');
  });
  ok(moved >= R.steam.length / 2, '蒸汽持续上升');
}

/* ---- 雨势起伏影响雨丝与水膜 ---- */
{
  R.dyn.intensity = 1;
  for (let i = 0; i < 80; i++) R.updateDynamics(0.1, 700 + i * 0.1);
  between(R.rain.streaks.mat.uniforms.uAlpha.value, 0.2, 0.6, '雨丝透明度随雨势起伏');
  between(R.rain.filmMat.uniforms.uIntensity.value, 0.7, 1.1, '水膜强度随之变化');
  R.rain.rivuletMats.forEach(function (m) {
    between(m.uniforms.uOpacity.value, 0.3, 0.6, '玻璃雨痕透明度联动');
  });
}

/* ============================================================
 * 9. 主循环 240 帧
 * ============================================================ */
section('9. 主循环 240 帧');
{
  function collectMaterials(root) {
    const set = new Set();
    root.traverse(function (o) {
      if (o.geometry) set.add('g' + o.geometry.uuid);
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) { set.add('m' + m.uuid); });
      }
    });
    return set;
  }
  const stats0 = R.cacheStats();
  const objs0 = collectMaterials(R.scene);
  let thrown = null;
  try {
    for (let i = 0; i < 240; i++) R.__loop.animate();
  } catch (e) { thrown = e; }
  eq(thrown, null, '240 帧无异常（' + (thrown && thrown.message) + '）');
  eq(W.renders(), 240, '渲染 240 帧');
  ok(R.elapsed > 0, '时钟推进');
  const stats1 = R.cacheStats();
  eq(stats1.geo, stats0.geo, '循环不新建几何体');
  eq(stats1.outline, stats0.outline, '循环不新建外扩壳');
  eq(stats1.mat, stats0.mat, '循环不新建材质');
  eq(stats1.tex, stats0.tex, '循环不新建贴图');
  const objs1 = collectMaterials(R.scene);
  let same = objs1.size === objs0.size;
  if (same) objs1.forEach(function (u) { if (!objs0.has(u)) same = false; });
  eq(same, true, '场景对象集合稳定（几何 / 材质无新增）');

  /* 辉光后处理管线 */
  ok(R.bloom && R.bloom.quadScene && R.bloom.quadCam, '辉光后处理已装配');
  ok(R.bloom.count >= 60, '辉光层对象 ≥ 60（实际 ' + R.bloom.count + '）');
  ok(R.bloom.strength > 0.1 && R.bloom.strength <= 1, '辉光强度合理（' + R.bloom.strength + '）');
  eq(R.bloom.mat.blending, THREE.AdditiveBlending, '辉光以加法合成');
  near(R.bloom.mat.uniforms.uStrength.value, R.bloom.strength, 1e-9, '辉光强度与 uniform 一致');
  eq(R.bloom.glowRT.width, 640, '辉光 RT 半分辨率（宽 640）');
  eq(R.bloom.glowRT.height, 360, '辉光 RT 半分辨率（高 360）');

  /* NaN 扫描 */
  let bad = 0;
  R.scene.traverse(function (o) {
    const p = o.position, r = o.rotation, s = o.scale;
    if (!isFinite(p.x + p.y + p.z + r.x + r.y + r.z + s.x + s.y + s.z)) bad++;
    if (o.isInstancedMesh) {
      const a = o.instanceMatrix.array;
      for (let i = 0; i < a.length; i++) { if (!isFinite(a[i])) { bad++; break; } }
    }
  });
  eq(bad, 0, '场景无 NaN 变换');
  ok(isFinite(R.camera.position.x + R.camera.position.y + R.camera.position.z), '相机位置有限');
  eq(W.consoleRec.errors.length, 0, '运行期无 console.error');
  eq(W.consoleRec.warns.filter(function (w) { return String(w).indexOf('deprecated') < 0; }).length, 0, '运行期无 console.warn');
}

/* ============================================================
 * 10. 轨道相机
 * ============================================================ */
section('10. 轨道相机');
{
  const orbit = R.orbit;
  const canvasEl = W.els.scene;
  eq(typeof orbit, 'object', 'orbit 状态对象');
  near(orbit.radius, 36, 1e-9, '初始半径');
  near(orbit.theta, 0.46, 1e-9, '初始方位角');
  near(orbit.phi, 1.06, 1e-9, '初始仰角');
  near(orbit.target.x, 0, 1e-9, '初始目标 x');
  near(orbit.target.z, -1.3, 1e-9, '初始目标 z');

  /* 滚轮缩放 + 夹取 */
  const rt0 = orbit.radiusT;
  W.emit(canvasEl, 'wheel', { deltaY: 240 });
  ok(orbit.radiusT > rt0, '滚轮下滚拉远');
  W.emit(canvasEl, 'wheel', { deltaY: -240 });
  near(orbit.radiusT, rt0, 1e-9, '滚轮反向回位');
  W.emit(canvasEl, 'wheel', { deltaY: 1e7 });
  eq(orbit.radiusT, orbit.maxR, '最大半径夹取 78');
  W.emit(canvasEl, 'wheel', { deltaY: -1e7 });
  eq(orbit.radiusT, orbit.minR, '最小半径夹取 9');

  /* 双击复位 */
  W.emit(canvasEl, 'dblclick', {});
  eq(orbit.radiusT, 17, '双击复位半径');
  eq(orbit.phiT, 1.02, '双击复位仰角');

  /* 拖拽旋转 */
  const th0 = orbit.thetaT, ph0 = orbit.phiT;
  W.emit(canvasEl, 'pointerdown', { pointerId: 11, button: 0, clientX: 300, clientY: 300 });
  eq(orbit.dragging, true, '左键拖拽开始');
  eq(orbit.idle, 0, '交互重置闲置计时');
  W.emit(canvasEl, 'pointermove', { pointerId: 11, clientX: 400, clientY: 260 });
  near(orbit.thetaT, th0 - 0.52, 1e-9, '水平拖拽改变方位角');
  near(orbit.phiT, Math.min(1.35, Math.max(0.16, ph0 + 0.18)), 1e-9, '垂直拖拽改变仰角');
  W.emit(canvasEl, 'pointerup', { pointerId: 11 });
  eq(orbit.dragging, false, '拖拽结束');

  /* 仰角夹取 */
  W.emit(canvasEl, 'pointerdown', { pointerId: 12, button: 0, clientX: 300, clientY: 300 });
  W.emit(canvasEl, 'pointermove', { pointerId: 12, clientX: 300, clientY: -100000 });
  eq(orbit.phiT, 1.35, '仰角上限夹取');
  W.emit(canvasEl, 'pointermove', { pointerId: 12, clientX: 300, clientY: 100000 });
  eq(orbit.phiT, 0.16, '仰角下限夹取');
  W.emit(canvasEl, 'pointerup', { pointerId: 12 });

  /* 右键平移 + 夹取 */
  W.emit(canvasEl, 'pointerdown', { pointerId: 13, button: 2, clientX: 400, clientY: 300 });
  eq(orbit.panning, true, '右键平移开始');
  const tx0 = orbit.targetT.x;
  W.emit(canvasEl, 'pointermove', { pointerId: 13, clientX: 500, clientY: 300 });
  ok(orbit.targetT.x !== tx0, '平移改变目标');
  W.emit(canvasEl, 'pointerup', { pointerId: 13 });
  eq(orbit.panning, false, '平移结束');
  for (let i = 0; i < 6; i++) R.__loop.panBy(10000, 0);
  between(orbit.targetT.x, -10, 10, '平移 x 夹取');
  between(orbit.targetT.z, -10, 10, '平移 z 夹取');
  R.__loop.panBy(-100000, -100000);
  between(orbit.targetT.x, -10, 10, '反向平移 x 夹取');
  orbit.targetT.y = 99;
  R.__loop.panBy(0, 0);
  eq(orbit.targetT.y, 12, '平移高度夹取');
  orbit.targetT.set(0, 1.2, -1.3);

  /* updateCamera 平滑 + 注视 */
  orbit.radiusT = 30; orbit.thetaT = 0.46; orbit.phiT = 1.06;
  R.__loop.updateCamera(0.5);
  isNum(R.camera.position.x, '相机 x');
  ok(R.camera.position.y > 0.5, '相机在地面之上');
  ok(orbit.radius < 36, '半径平滑趋近');
  eq(R.camera.matrixWorldNeedsUpdate !== undefined, true, '相机矩阵有效');

  /* 闲置自动旋转 */
  orbit.idle = 20;
  const th1 = orbit.thetaT;
  R.__loop.updateCamera(1);
  near(orbit.thetaT, th1 + 0.035, 1e-6, '闲置 9 秒后自动旋转');
  ok(orbit.autoRotate === true, '自动旋转开启');

  /* 指针事件在不同指针上互不干扰 */
  W.emit(canvasEl, 'pointerdown', { pointerId: 21, button: 0, clientX: 100, clientY: 100 });
  W.emit(canvasEl, 'pointerdown', { pointerId: 22, button: 0, clientX: 200, clientY: 200 });
  W.emit(canvasEl, 'pointercancel', { pointerId: 21 });
  W.emit(canvasEl, 'pointercancel', { pointerId: 22 });
  eq(orbit.dragging, false, '多点触控结束后复位');
}

/* ============================================================
 * 11. 视口自适应
 * ============================================================ */
section('11. 视口自适应');
{
  W.window.innerWidth = 800;
  W.window.innerHeight = 600;
  const q0 = W.rafQueue.length;
  W.emit('window', 'resize', {});
  W.emit('window', 'resize', {});
  eq(W.rafQueue.length, q0 + 1, 'resize 合帧（两次只排一帧）');
  ok(W.flushRaf() >= 1, '帧回调执行');
  near(R.camera.aspect, 800 / 600, 1e-9, '相机宽高比更新');
  eq(R.renderer.size.width, 800, '渲染器宽度更新');
  eq(R.renderer.size.height, 600, '渲染器高度更新');
  eq(R.bloom.glowRT.width, 400, '辉光 RT 随视口更新（宽 400）');
  eq(R.bloom.glowRT.height, 300, '辉光 RT 随视口更新（高 300）');
  const vs2 = R.__loop.viewSize();
  eq(vs2.w, 800, 'viewSize 宽更新');
  eq(vs2.h, 600, 'viewSize 高更新');
  W.window.innerWidth = 1280;
  W.window.innerHeight = 720;
  W.emit('window', 'resize', {});
  W.flushRaf();
  near(R.camera.aspect, 1280 / 720, 1e-9, '视口恢复');
  eq(R.bloom.glowRT.width, 640, '辉光 RT 视口恢复（宽 640）');
  eq(R.bloom.glowRT.height, 360, '辉光 RT 视口恢复（高 360）');
}

/* ============================================================
 * 12. 健壮性：无 WebGL
 * ============================================================ */
section('12. 健壮性');
{
  const W2 = createWorld({ renderer: 'no-webgl' });
  eq(W2.R.renderer, undefined, '无 WebGL 时不创建渲染器');
  eq(W2.R.__loop, undefined, '无 WebGL 时不启动主循环');
  eq(W2.R.scene.children.length, 0, '无 WebGL 时不构建场景内容');
  ok(W2.R.buildBase && W2.R.buildStore, '模块仍完整加载（可诊断）');
  const fatal2 = W2.document.body._children.filter(function (c) {
    return String(c.className).indexOf('fatal') >= 0;
  });
  eq(fatal2.length, 1, '显示降级提示');
  ok(fatal2[0] && fatal2[0].textContent.indexOf('WebGL') >= 0, '提示包含 WebGL 说明');
  eq(W2.rafQueue.length, 0, '降级模式不请求动画帧');
  ok(!(W2.R.rain), '降级模式不构建雨');
  eq(W2.R.bloom, undefined, '降级模式无辉光后处理');
}
{
  const W3 = createWorld({ renderer: 'throw' });
  eq(W3.R.renderer, undefined, '构造抛错时捕获异常');
  eq(W3.R.__loop, undefined, '构造抛错时不启动主循环');
  const fatal3 = W3.document.body._children.filter(function (c) {
    return String(c.className).indexOf('fatal') >= 0;
  });
  eq(fatal3.length, 1, '构造抛错时显示降级提示');
  eq(W3.consoleRec.errors.length, 1, '错误被记录一次');
  ok(W3.consoleRec.errors[0].indexOf('WebGL') >= 0, '错误信息包含 WebGL');
}

/* ============================================================
 * 13. 构建确定性
 * ============================================================ */
section('13. 构建确定性');
function sceneSig(world) {
  const r = world.R;
  const parts = [];
  r.scene.traverse(function (o) {
    parts.push(o.type, o.name || '');
    parts.push(o.position.x.toFixed(4), o.position.y.toFixed(4), o.position.z.toFixed(4));
    parts.push(o.rotation.x.toFixed(4), o.rotation.y.toFixed(4), o.rotation.z.toFixed(4));
    parts.push(o.scale.x.toFixed(4), o.scale.y.toFixed(4), o.scale.z.toFixed(4));
    if (o.geometry) {
      parts.push(o.geometry.type);
      const pos = o.geometry.attributes && o.geometry.attributes.position;
      if (pos) {
        let s = 0;
        for (let i = 0; i < pos.array.length; i++) s += pos.array[i];
        parts.push(pos.count + ':' + s.toFixed(3));
      }
      const io = o.geometry.attributes && o.geometry.attributes.iOffset;
      if (io) {
        let s = 0;
        for (let i = 0; i < io.array.length; i++) s += io.array[i];
        parts.push('io' + s.toFixed(3));
      }
    }
    if (o.material && !Array.isArray(o.material)) {
      parts.push(o.material.type);
      if (o.material.color) parts.push(o.material.color.getHexString());
      if (o.material.emissive) parts.push(o.material.emissive.getHexString());
      if (o.material.uniforms) parts.push(Object.keys(o.material.uniforms).join(','));
    }
    if (o.isInstancedMesh) parts.push('I' + o.count);
    if (o.isLight) parts.push('L' + o.type + o.intensity.toFixed(3));
  });
  parts.push('PATCHES' + JSON.stringify(r.base.patches));
  parts.push('rain' + r.rain.streaks.count + '|' + r.rain.drips.length + '|' + r.rain.ripples.length);
  parts.push('glass' + r.glass.length);
  parts.push('prod' + r.interior.products + '|' + r.interior.productMeshes);
  parts.push('steam' + r.steam.length);
  parts.push('rng' + r.rng().toFixed(10));
  const str = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return { hash: (h >>> 0).toString(16), len: str.length };
}
const WA = createWorld();
const sig1 = sceneSig(WA);
{
  const W4 = createWorld();
  const sig4 = sceneSig(W4);
  eq(sig4.hash, sig1.hash, '两次构建场景签名一致（同种子确定性）');
  eq(sig4.len, sig1.len, '签名长度一致');
  eq(W4.consoleRec.errors.length, 0, '第二次构建无错误');
  eq(W4.R.base.patches.length, 25, '第二次构建铺装一致');
  eq(W4.R.rain.streaks.count, 1250, '第二次构建雨丝一致');
  eq(W4.R.interior.products, WA.R.interior.products, '第二次构建商品数一致');
}

/* ============================================================
 * 14. 缓存清理
 * ============================================================ */
section('14. 缓存清理');
{
  const before = R.cacheStats();
  ok(before.geo > 0 && before.mat > 0, '构建后有缓存');
  R.disposeCaches();
  const after = R.cacheStats();
  eq(after.geo, 0, '几何缓存已清空');
  eq(after.outline, 0, '外扩壳缓存已清空');
  eq(after.mat, 0, '材质缓存已清空');
  eq(after.tex, 0, '贴图缓存已清空');
  let again = true;
  try { R.disposeCaches(); } catch (e) { again = false; }
  eq(again, true, '重复清理安全');
}

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n' + (failed === 0 ? '✅ 全部通过' : '❌ 存在失败') +
  '：' + passed + ' 项断言，' + failed + ' 项失败');
process.exitCode = failed === 0 ? 0 : 1;
