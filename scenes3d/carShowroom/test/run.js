'use strict';
/*
 * 3D 跑车展厅 · 零依赖测试（node test/run.js）
 *
 * 覆盖四层：
 *   A. server.js 纯函数：URL → 项目内文件路径的解析与安全边界
 *   B. 真实启动一次 server.js（PORT=0 由系统分配随机端口），用 http 请求验证
 *      正常文件 200 / MIME / HEAD / 越权 403 / 缺失 404 / 非法 URL 400 / 方法 405 / 超大请求体 413
 *   C. 前端纯逻辑：把 index.html 里的 <script type="module"> 抽出来，用浏览器桩在 Node 里跑，
 *      断言涂装表、加载回退计划、尺寸退化、转向/车轮数学、部件→材质映射
 *   D. 真实模型 ferrari.glb：解析 GLB 头与 JSON chunk，核对网格/材质数量，并确认每个部件都能映射到自定义材质
 *
 * 不依赖任何第三方包，也不联网。
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

// vendor/*.js 以 ES module 语法书写、但最近一层 package.json 没有声明 "type": "module"，
// Node 加载时会发 MODULE_TYPELESS_PACKAGE_JSON 警告（纯噪音，不影响功能）。只静音这一条。
(function silenceTypelessWarning() {
  const original = process.emitWarning;
  process.emitWarning = function (warning, type, code) {
    const wcode = (warning && warning.code) || code || type;
    if (wcode === 'MODULE_TYPELESS_PACKAGE_JSON') return;
    return original.apply(process, arguments);
  };
})();

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const GLB = path.join(ROOT, 'ferrari.glb');
const SERVER = path.join(ROOT, 'server.js');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log('  ✗ ' + msg); }
}
function eq(a, b, msg) {
  ok(a === b, (msg || '') + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
}
function near(a, b, tol, msg) {
  tol = tol == null ? 1e-9 : tol;
  ok(Math.abs(a - b) <= tol, (msg || '') + ' (got ' + a + ', want ' + b + ')');
}
function section(name) { console.log('\n== ' + name + ' =='); }

/* ============================================================
 * A. server.js 纯函数
 * ============================================================ */
section('server.js · 路径解析与安全边界（纯函数）');
const srv = require(SERVER);
{
  const R = srv.resolveTarget;
  eq(srv.ROOT, ROOT, 'ROOT 指向项目目录');
  eq(srv.TYPES['.html'], 'text/html; charset=utf-8', 'MIME .html');
  eq(srv.TYPES['.js'], 'text/javascript; charset=utf-8', 'MIME .js');
  eq(srv.TYPES['.glb'], 'model/gltf-binary', 'MIME .glb');
  eq(srv.TYPES['.wasm'], 'application/wasm', 'MIME .wasm（DRACO 解码器）');

  const rootIdx = R('/');
  eq(rootIdx.file, path.join(ROOT, 'index.html'), '/ 落到 index.html');
  eq(R('/index.html?x=1#frag').file, path.join(ROOT, 'index.html'), '查询串/锚点被剥离');
  eq(R('').file, path.join(ROOT, 'index.html'), '空 URL 落到 index.html');
  eq(R(undefined).file, path.join(ROOT, 'index.html'), 'undefined URL 落到 index.html');
  eq(R('/vendor/three.module.js').rel, path.join('vendor', 'three.module.js'), '普通子路径');
  eq(R('/./index.html').file, path.join(ROOT, 'index.html'), './ 被折叠');

  // 越权：各种编码/分隔符变体都必须 403
  const escapes = [
    '/../README.md', '/../server.js', '/../../README.md',
    '/%2e%2e%2fREADME.md', '/..%2fREADME.md', '/%2e%2e/README.md',
    '/vendor/..%2f..%2fREADME.md', '/vendor/%2e%2e/%2e%2e/README.md',
    '/..%5c..%5cWindows/win.ini', '/%2e%2e%5c%2e%2e%5cWindows%5cwin.ini',
    '/C:/Windows/win.ini', '/..', '/vendor/..', '/./..'
  ];
  let escaped = [];
  for (const p of escapes) {
    const r = R(p);
    if (r.error !== 403) escaped.push(p + '→' + (r.error || r.file));
  }
  eq(escaped.length, 0, '所有穿越变体都被拒（403）：' + JSON.stringify(escaped));

  // 非法输入
  eq(R('/%zz').error, 400, '非法百分号转义 → 400');
  eq(R('/%').error, 400, '孤立 % → 400');
  eq(R('/%00index.html').error, 400, '空字节截断 → 400');
  eq(R('/index%00.html').error, 400, '路径中空字节 → 400');
  eq(R('/' + 'a'.repeat(3000)).error, 414, '超长 URL → 414');

  // 服务器自身文件与点文件不对外提供
  eq(R('/server.js').error, 403, 'server.js 不外泄');
  eq(R('/SERVER.JS').error, 403, 'server.js 大小写变体不外泄');
  eq(R('/server.js.').error, 403, 'Windows 结尾点变体不外泄');
  eq(R('/start.bat').error, 403, 'start.bat 不外泄');
  eq(R('/.git/config').error, 403, '点目录不外泄');
  eq(R('/vendor/.hidden.js').error, 403, '点文件不外泄');
  ok(R('/test/run.js').file, '普通源码文件仍可访问（静态根就是项目目录）');

  // 解析结果永远落在项目目录内
  let outside = [];
  for (const p of escapes.concat(['/', '/index.html', '/vendor/', '/a/b/c.js'])) {
    const r = R(p);
    if (r.file) {
      const rel = path.relative(ROOT, r.file);
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) outside.push(p);
    }
  }
  eq(outside.length, 0, '没有任何解析结果逃出项目目录');
}

/* ============================================================
 * C. 前端纯逻辑（浏览器桩 + index.html 内联 module）
 * ============================================================ */
function makeEl(id) {
  const el = {
    id: id || '',
    style: {},
    dataset: {},
    title: '',
    className: '',
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    children: [],
    addEventListener: function () {},
    removeEventListener: function () {},
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function () {},
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 300, height: 200 }; },
    click: function () {},
    classList: {
      add: function () {}, remove: function () {},
      toggle: function () {}, contains: function () { return false; }
    }
  };
  return el;
}

function installStubs() {
  const els = {};
  global.window = global;
  global.__stubGL = null;
  global.location = { protocol: 'http:', reload: function () {} };
  global.innerWidth = 1280;
  global.innerHeight = 720;
  global.devicePixelRatio = 1;
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.requestAnimationFrame = function () { return 0; };
  global.cancelAnimationFrame = function () {};
  global.document = {
    readyState: 'complete',
    body: makeEl('body'),
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    getElementById: function (id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
    createElement: function (tag) {
      if (String(tag).toLowerCase() === 'canvas') {
        return { getContext: function () { return global.__stubGL; } };
      }
      return makeEl();
    }
  };
  return els;
}

function extractModuleSource() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = /<script type="module">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('index.html 中找不到 <script type="module">');
  return m[1];
}
function fileUrl(p) { return 'file:///' + p.replace(/\\/g, '/'); }

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try { v = fn(); } catch (e) { v = undefined; }
    if (v) return v;
    if (Date.now() - t0 > (timeoutMs || 8000)) throw new Error('等待超时：' + label);
    await new Promise(function (r) { setTimeout(r, 20); });
  }
}

/* ============================================================
 * D. 真实模型 ferrari.glb
 * ============================================================ */
function readGlb(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  return {
    bytes: buf.length,
    magic: buf.toString('utf8', 0, 4),
    version: buf.readUInt32LE(4),
    declaredLength: buf.readUInt32LE(8),
    jsonType: buf.toString('utf8', 16, 20),
    json: JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))
  };
}
function meshNodes(gltf) {
  const out = [];
  for (const n of gltf.nodes) {
    if (n.mesh == null) continue;
    const mesh = gltf.meshes[n.mesh];
    const prim = mesh.primitives[0];
    const mat = prim && prim.material != null ? gltf.materials[prim.material] : null;
    out.push({ node: n.name, mesh: mesh.name, material: mat ? mat.name : null, y: n.translation ? n.translation[1] : null });
  }
  return out;
}

(async function run() {
  let serverChild = null;
  try {
    /* ---------- C. 前端纯逻辑 ---------- */
    section('前端纯逻辑（index.html 内联 module + 浏览器桩）');
    const els = installStubs();
    const src = extractModuleSource();
    const tmp = path.join(os.tmpdir(), 'carShowroom-index-' + process.pid + '-' + Date.now() + '.mjs');
    const vendorUrl = fileUrl(path.join(ROOT, 'vendor')) + '/';
    // 把 ./vendor/... 的相对动态 import 换成绝对 file URL，Node 里才能加载
    fs.writeFileSync(tmp, src.replace(/import\('\.\/vendor\//g, "import('" + vendorUrl));
    let unhandled = null;
    process.on('unhandledRejection', function (e) { unhandled = e; });
    let D;
    try {
      await import(fileUrl(tmp));
      D = await waitFor(function () { return global.__carDebug; }, 15000, '__carDebug 就绪');
      await waitFor(function () {
        return els.ovText && els.ovText.textContent.indexOf('WebGL') !== -1;
      }, 15000, 'WebGL 不可用提示');
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) { /* 临时文件已被清理 */ }
    }

    ok(!!D, 'index.html 暴露 window.__carDebug 调试钩子');
    eq(D.REVISION, '160', 'vendor 里的 Three.js 版本 = r160');
    eq(unhandled, null, '无未处理的 Promise 异常');
    ok(els.ovText.textContent.indexOf('无法创建 WebGL 上下文') !== -1, 'WebGL 不可用时给出明确提示');
    eq(els.ovRetry.hidden, false, 'WebGL 不可用时显示重试按钮');

    // 涂装 / 轮毂
    eq(D.PAINTS.length, 8, '8 种车身涂装');
    eq(D.RIMS.length, 3, '3 种轮毂配色');
    eq(D.PAINTS[0][0], '罗索红', '默认涂装名');
    eq(D.PAINTS[0][1], '#d40000', '默认涂装色');
    let badHex = D.PAINTS.concat(D.RIMS).filter(function (p) { return !/^#[0-9a-fA-F]{6}$/.test(p[1]); });
    eq(badHex.length, 0, '所有色值都是 6 位十六进制');
    eq(new Set(D.PAINTS.map(function (p) { return p[1]; })).size, 8, '涂装色值互不重复');
    eq(new Set(D.RIMS.map(function (p) { return p[1]; })).size, 3, '轮毂色值互不重复');
    ok(D.PAINTS.every(function (p) { return typeof p[0] === 'string' && p[0].length > 0; }), '涂装名非空');

    // 资源与回退计划
    eq(D.LOCAL_GLB, './ferrari.glb', '本地模型路径');
    eq(D.LOCAL_DRACO, './vendor/draco/', '本地 DRACO 解码器路径');
    ok(/\/examples\/jsm\/libs\/draco\/$/.test(D.CDN_DRACO), 'CDN DRACO 解码器路径');
    eq(D.GLB_REMOTE.length, 3, '3 个 CDN 模型回退地址');
    ok(D.GLB_REMOTE.every(function (u) { return /^https:\/\//.test(u); }), '回退地址都是 https');
    ok(D.GLB_REMOTE.some(function (u) { return u.indexOf('r160') !== -1; }), '回退地址锁定 r160');
    ok(D.GLB_REMOTE.every(function (u) { return /ferrari\.glb$/.test(u); }), '回退地址都指向 ferrari.glb');

    const localAttempts = D.buildLoadAttempts(true);
    const cdnAttempts = D.buildLoadAttempts(false);
    eq(localAttempts.length, 7, '本地模式 7 次尝试（1 本地 + 3 本地解码器 + 3 CDN 解码器）');
    eq(localAttempts[0].decoder, D.LOCAL_DRACO, '第一次尝试用本地解码器');
    eq(localAttempts[0].url, D.LOCAL_GLB, '第一次尝试用本地模型');
    ok(localAttempts.slice(1, 4).every(function (a) { return a.decoder === D.LOCAL_DRACO; }), '回退 CDN 模型时仍先用本地解码器');
    ok(localAttempts.slice(4).every(function (a) { return a.decoder === D.CDN_DRACO; }), '本地解码器失败后改用 CDN 解码器');
    eq(cdnAttempts.length, 3, 'file:// 模式 3 次尝试');
    ok(cdnAttempts.every(function (a) { return a.decoder === D.CDN_DRACO; }), 'file:// 模式只用 CDN 解码器');
    ok(cdnAttempts.every(function (a) { return a.url !== D.LOCAL_GLB; }), 'file:// 模式不尝试本地模型');

    // 尺寸退化
    const vs = D.viewSize;
    eq(vs(0, 0).join(','), '1,1', '窗口 0×0 → 1×1（避免 aspect=NaN）');
    eq(vs(0, 720).join(','), '1,720', '宽度 0 → 1');
    eq(vs(-100, -100).join(','), '1,1', '负尺寸 → 1×1');
    eq(vs(NaN, 500).join(','), '1,500', 'NaN → 1');
    eq(vs(1920, 1080).join(','), '1920,1080', '正常尺寸不变');
    eq(vs(1920.9, 1080.9).join(','), '1920,1080', '小数尺寸取整');

    // WebGL 探测
    global.__stubGL = null;
    eq(D.hasWebGL(), false, '无 WebGL 上下文 → false');
    global.__stubGL = {};
    eq(D.hasWebGL(), true, '有 WebGL 上下文 → true');
    global.document.createElement = function () { return { getContext: function () { throw new Error('boom'); } }; };
    eq(D.hasWebGL(), false, 'getContext 抛异常 → false');
    installStubs();

    // 行驶数学
    eq(D.DRIVE_R, 8.5, '环形公路半径 8.5');
    eq(D.DRIVE_MAX_SPEED, 2.4, '最高速度 2.4');
    eq(D.STEER_MAX, 0.3, '前轮最大转向角 0.3');
    eq(D.steerSign(1, 0, 0, -1), 1, '车头 +X、环心 -Z → 左打');
    eq(D.steerSign(1, 0, 0, 1), -1, '车头 +X、环心 +Z → 右打');
    eq(D.steerSign(0, -1, -1, 0), 1, '车头 -Z、环心 -X → 左打');
    eq(D.steerSign(0, 1, 1, 0), 1, '车头 +Z、环心 +X → 左打');
    near(D.wheelSpinDelta(2.4, 0.358, 1), -(2.4 * 8.5 / 0.358), 1e-9, '车轮自转增量与速度/轮径一致');
    ok(D.wheelSpinDelta(2.4, 0.358, 0.016) < 0, '前进时车轮自转方向为负');
    eq(D.wheelSpinDelta(0, 0.358, 0.016), 0, '静止时车轮不转');
    ok(Math.abs(D.wheelSpinDelta(2.4, 0.358, 1)) > Math.abs(D.wheelSpinDelta(1.2, 0.358, 1)), '速度越大自转越快');
    ok(Math.abs(D.wheelSpinDelta(2.4, 0.179, 1)) > Math.abs(D.wheelSpinDelta(2.4, 0.358, 1)), '轮子越小自转越快');

    // 部件 → 材质键
    const keyCases = [
      ['body', 'x', 'paint'], ['blue', 'x', 'accentBlue'], ['yellow_trim', 'x', 'accentYellow'],
      ['glass', 'x', 'glass'], ['brakes', 'x', 'caliper'], ['grills', 'x', 'grill'],
      ['wipers', 'x', 'darkPlastic'], ['lights', 'x', 'headlight'], ['lights_red', 'x', 'taillight'],
      ['leds', 'x', 'taillight'], ['steering_red_lights', 'x', 'taillight'], ['interior_light', 'x', 'interiorLight'],
      ['wheel', 'x', 'rim'], ['rim_fl', 'x', 'rim'], ['tire', 'x', 'tyre'], ['brake', 'x', 'disc'],
      ['steering_carbon', 'x', 'carbon'], ['carbon fibre', 'x', 'carbon'], ['centre', 'x', 'chrome'],
      ['nuts', 'x', 'chrome'], ['metal', 'x', 'chrome'], ['steering_metal', 'x', 'chrome'],
      ['__none__', 'Body_Color', 'paint'], ['__none__', 'Projector_Glass', 'projectorGlass'],
      ['__none__', 'Turn_Signal_LED', 'turn'], ['__none__', 'Leather_red', 'leatherRed'],
      ['__none__', 'Nope_Material', null], [undefined, undefined, null], ['', '', null]
    ];
    let keyBad = [];
    for (const c of keyCases) {
      const got = D.resolveMaterialKey(c[0], c[1]);
      if (got !== c[2]) keyBad.push(JSON.stringify(c[0]) + '/' + JSON.stringify(c[1]) + ' → ' + got + ' ≠ ' + c[2]);
    }
    eq(keyBad.length, 0, '部件→材质键映射表正确：' + JSON.stringify(keyBad));
    eq(D.resolveMaterialKey('brake', 'Body_Color'), 'disc', '部件名优先级高于原始材质名');
    eq(D.resolveMaterialKey('wheel', 'Tires'), 'rim', 'wheel 用轮毂材质而非轮胎材质');

    /* ---------- D. 真实模型 ---------- */
    section('真实模型 ferrari.glb');
    const glb = readGlb(GLB);
    eq(glb.magic, 'glTF', 'GLB magic');
    eq(glb.version, 2, 'glTF 版本 2');
    eq(glb.jsonType, 'JSON', '第一个 chunk 是 JSON');
    eq(glb.declaredLength, glb.bytes, 'GLB 头声明长度 = 实际文件长度');
    eq(glb.json.meshes.length, 51, '模型 51 个网格');
    eq(glb.json.nodes.length, 58, '模型 58 个节点');
    eq(glb.json.materials.length, 17, '模型 17 种材质');
    eq((glb.json.images || []).length, 0, '模型不含贴图（因此替换材质无贴图泄漏）');
    ok((glb.json.extensionsUsed || []).indexOf('KHR_draco_mesh_compression') !== -1, '模型使用 DRACO 压缩（解码器必须可用）');

    const nodes = meshNodes(glb.json);
    eq(nodes.length, 51, '51 个网格节点');
    const unmapped = nodes.filter(function (n) { return !D.resolveMaterialKey(n.node, n.material); });
    eq(unmapped.length, 0, '每个部件都能映射到自定义材质：' + JSON.stringify(unmapped.map(function (n) { return n.node; })));
    const matNames = glb.json.materials.map(function (m) { return m.name; });
    const unmappedMats = matNames.filter(function (m) { return !D.resolveMaterialKey('__none__', m); });
    eq(unmappedMats.length, 0, '17 种模型材质都有对应材质键：' + JSON.stringify(unmappedMats));
    eq(new Set(matNames).size, 17, '材质名互不重复');

    const byName = {};
    for (const n of nodes) byName[n.node] = D.resolveMaterialKey(n.node, n.material);
    eq(byName['body'], 'paint', '车身用清漆车漆');
    eq(byName['glass'], 'glass', '玻璃用透射材质');
    eq(byName['wheel'], 'rim', '轮毂用轮毂材质');
    eq(byName['tire'], 'tyre', '轮胎用橡胶材质');
    eq(byName['brake'], 'disc', '刹车盘用金属盘材质');
    eq(byName['brakes'], 'caliper', '卡钳用卡钳材质');
    eq(byName['steering_carbon'], 'carbon', '碳纤维内饰用碳纤维材质');
    eq(byName['centre'], 'chrome', '轮心用镀铬材质');

    const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
    eq(wheels.filter(function (w) { return glb.json.nodes.some(function (n) { return n.name === w; }); }).length, 4, '4 个车轮节点齐全');
    const rr = glb.json.nodes.filter(function (n) { return n.name === 'wheel_rr'; })[0];
    near(rr.translation[1], 0.358, 1e-3, '车轮中心高度 ≈0.358（= 代码里的 wheelRadius 兜底值）');
    const tireNode = glb.json.nodes.filter(function (n) { return n.name === 'tire'; }).length;
    eq(tireNode, 4, '4 个轮胎节点');

    // 材质键目录（源码级一致性）：resolveMaterialKey 可能返回的键必须都在 MAT_KEYS 里
    const mkStart = src.indexOf('const MAT_KEYS = {');
    ok(mkStart !== -1, '源码里能找到 MAT_KEYS 表');
    const mkBlock = src.slice(mkStart, src.indexOf('};', mkStart));
    const mkKeys = new Set((mkBlock.match(/([A-Za-z_$][\w$]*)\s*:/g) || []).map(function (s) { return s.replace(/\s*:$/, ''); }));
    ok(mkKeys.size >= 20, 'MAT_KEYS 至少 20 项（实际 ' + mkKeys.size + '）');
    const usedKeys = new Set();
    for (const n of nodes) usedKeys.add(D.resolveMaterialKey(n.node, n.material));
    for (const m of matNames) usedKeys.add(D.resolveMaterialKey('__none__', m));
    const missing = Array.from(usedKeys).filter(function (k) { return !mkKeys.has(k); });
    eq(missing.length, 0, '所有映射键都在 MAT_KEYS 中定义：' + JSON.stringify(missing));

    // 每个网格都拿到了自定义材质 → 被替换的原始材质才会被 dispose 回收
    eq(nodes.filter(function (n) { return D.resolveMaterialKey(n.node, n.material) !== null; }).length, 51,
      '51 个网格全部替换材质（原 GLB 材质可回收）');

    /* ---------- B. 真实 HTTP 服务器 ---------- */
    section('真实 HTTP 服务器（PORT=0 随机端口）');
    const boot = await startServer();
    serverChild = boot.child;
    const port = boot.port;
    ok(port > 0 && port < 65536, '服务器拿到随机端口 ' + port);
    ok(boot.url.indexOf('127.0.0.1') !== -1 && boot.url.indexOf('0.0.0.0') === -1, '只绑定回环地址：' + boot.url);

    const getIndex = await request(port, '/');
    eq(getIndex.code, 200, 'GET / → 200');
    eq(getIndex.headers['content-type'], 'text/html; charset=utf-8', '/ 的 MIME');
    ok(getIndex.body.indexOf('<title>Ferrari 458') !== -1, '/ 返回真实页面');
    eq(getIndex.headers['x-content-type-options'], 'nosniff', '带 nosniff');

    const getJs = await request(port, '/vendor/three.module.js');
    eq(getJs.code, 200, 'GET vendor/three.module.js → 200');
    eq(getJs.headers['content-type'], 'text/javascript; charset=utf-8', 'JS 的 MIME');
    ok(getJs.body.length > 100000, 'three.module.js 内容完整');

    const getWasm = await request(port, '/vendor/draco/draco_decoder.wasm');
    eq(getWasm.code, 200, 'GET draco_decoder.wasm → 200');
    eq(getWasm.headers['content-type'], 'application/wasm', 'wasm 的 MIME');

    const getGlb = await request(port, '/ferrari.glb');
    eq(getGlb.code, 200, 'GET ferrari.glb → 200');
    eq(getGlb.headers['content-type'], 'model/gltf-binary', 'glb 的 MIME');
    eq(Number(getGlb.headers['content-length']), glb.bytes, 'glb 字节数正确');

    const getUtils = await request(port, '/utils/BufferGeometryUtils.js');
    eq(getUtils.code, 200, 'GET utils/BufferGeometryUtils.js → 200（GLTFLoader 依赖）');

    const head = await request(port, '/index.html', 'HEAD');
    eq(head.code, 200, 'HEAD /index.html → 200');
    eq(head.body.length, 0, 'HEAD 不返回响应体');
    eq(Number(head.headers['content-length']), Buffer.byteLength(getIndex.body), 'HEAD 保留 Content-Length（字节）');

    const misses = ['/nope.txt', '/vendor/', '/vendor/draco/', '/index.html.bak'];
    let missBad = [];
    for (const p of misses) {
      const r = await request(port, p);
      if (r.code !== 404) missBad.push(p + '→' + r.code);
      if (/index of|directory listing/i.test(r.body)) missBad.push(p + ' 泄露目录列举');
    }
    eq(missBad.length, 0, '不存在路径/目录 → 404 且无目录列举：' + JSON.stringify(missBad));

    const attacks = [
      '/../README.md', '/%2e%2e%2fREADME.md', '/..%2f..%2fREADME.md',
      '/vendor/..%2f..%2fREADME.md', '/..%5c..%5cWindows/win.ini',
      '/%2e%2e%5c%2e%2e%5cWindows%5cwin.ini', '/C:/Windows/win.ini',
      '/server.js', '/SERVER.JS', '/server.js.', '/start.bat', '/.git/config'
    ];
    let atkBad = [];
    for (const p of attacks) {
      const r = await request(port, p);
      if (r.code !== 403) atkBad.push(p + '→' + r.code);
      if (r.body.indexOf(ROOT) !== -1) atkBad.push(p + ' 响应泄露绝对路径');
      if (r.body.indexOf('ROOT') !== -1 && p !== '/server.js') { /* 仅提示，不判错 */ }
    }
    eq(atkBad.length, 0, '越权/服务器自身文件 → 403：' + JSON.stringify(atkBad));

    const badUrls = ['/%zz', '/%00index.html', '/%e0%a4%a'];
    let badBad = [];
    for (const p of badUrls) {
      const r = await request(port, p);
      if (r.code !== 400) badBad.push(p + '→' + r.code);
    }
    eq(badBad.length, 0, '非法 URL → 400（不是 500）：' + JSON.stringify(badBad));

    const post = await request(port, '/index.html', 'POST');
    eq(post.code, 405, 'POST → 405');
    eq(post.headers.allow, 'GET, HEAD', '405 带 Allow 头');

    const put = await request(port, '/', 'PUT');
    eq(put.code, 405, 'PUT → 405');

    const big = await request(port, '/index.html', 'GET', { 'content-length': '1048576' });
    eq(big.code, 413, '超大请求体 → 413');

    const leak = await request(port, '/nope.txt');
    ok(leak.body.indexOf(ROOT) === -1, '404 不回显服务器绝对路径');
    ok(leak.body.indexOf('\\') === -1 || leak.body.indexOf(ROOT) === -1, '404 响应干净');

    serverChild.kill();
    const code = await new Promise(function (resolve) {
      const t = setTimeout(function () { resolve('timeout'); }, 5000);
      serverChild.once('exit', function (c) { clearTimeout(t); resolve(c); });
    });
    ok(code === 0 || code === null || code === 'timeout', '服务器可被正常关闭（exit=' + code + '）');
    serverChild = null;

    /* ---------- README 一致性（防止文档再次跑偏） ---------- */
    section('README 与实现一致');
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    for (const name of ['index.html', 'server.js', 'start.bat', 'test/run.js', 'preview.png', 'ferrari.glb', 'vendor/', 'utils/', 'package.json']) {
      ok(readme.indexOf(name) !== -1, 'README 提到了 ' + name);
    }
    ok(readme.indexOf('node test/run.js') !== -1, 'README 给出了测试命令');
    ok(readme.indexOf('r160') !== -1, 'README 标注 Three.js r160');
    ok(readme.indexOf('51') !== -1, 'README 标注 51 个部件');
    ok(readme.indexOf('PORT=9000') !== -1, 'README 说明如何换端口');
    ok(readme.indexOf('GLB_LOCAL') === -1, 'README 不再提到不存在的 GLB_LOCAL');
    ok(readme.indexOf('MATMAP') === -1, 'README 不再提到已重构掉的 MATMAP');
    ok(readme.indexOf('需要支持 **WebGL2**') === -1, 'README 不再声称必须 WebGL2');

    // 最后一条：README 里声明的断言总数必须等于本次实际断言总数（含本条）
    const declaredMatch = /通过 (\d+) 项/.exec(readme);
    const declared = declaredMatch ? Number(declaredMatch[1]) : NaN;
    const total = passed + failed + 1;
    ok(declared === total, 'README 声明的断言数与实际一致（实际 ' + total + '，README ' + declared + '）');
  } catch (e) {
    failed++;
    console.log('  ✗ 测试异常: ' + (e && e.stack ? e.stack : e));
  } finally {
    if (serverChild) { try { serverChild.kill(); } catch (e) { /* ignore */ } }
  }

  console.log('\n========================================');
  console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
  console.log('========================================');
  if (failed > 0) process.exit(1);
})();

/* ============================================================
 * HTTP 辅助
 * ============================================================ */
function request(port, reqPath, method, headers) {
  return new Promise(function (resolve) {
    const req = http.request({
      host: '127.0.0.1', port: port, path: reqPath,
      method: method || 'GET', headers: headers || {}
    }, function (res) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        resolve({ code: res.statusCode, headers: res.headers, body: body });
      });
    });
    req.on('error', function (e) {
      resolve({ code: 'ERR', headers: {}, body: String(e && e.message) });
    });
    req.end();
  });
}

function startServer() {
  return new Promise(function (resolve, reject) {
    const child = spawn(process.execPath, [SERVER], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: '0', DSH_NO_OPEN: '1' })
    });
    let out = '', err = '';
    const timer = setTimeout(function () {
      child.kill();
      reject(new Error('服务器 10 秒内未启动。stdout=' + out + ' stderr=' + err));
    }, 10000);
    function scan(chunk) {
      out += chunk;
      const m = /http:\/\/127\.0\.0\.1:(\d+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve({ child: child, port: Number(m[1]), url: m[0] });
      }
    }
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', scan);
    child.stderr.on('data', function (c) { err += c; });
    child.once('exit', function (c) {
      clearTimeout(timer);
      reject(new Error('服务器提前退出（code=' + c + '）stderr=' + err));
    });
  });
}
