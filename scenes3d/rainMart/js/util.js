/* ============================================================
 * 雨夜便利店 · RAIN MART · js/util.js
 * 共享工具：确定性随机、程序化贴图、三渲二材质（toon 渐变阶）、
 * 几何/材质缓存、描边（反向外扩壳）、辉光贴片、实例化辅助
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R = window.R || {};

  /* ---------------- 数学 ---------------- */
  R.lerp = function (a, b, t) { return a + (b - a) * t; };
  R.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  R.smoothstep = function (a, b, x) {
    var t = R.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  R.damp = function (a, b, lambda, dt) { return R.lerp(a, b, 1 - Math.exp(-lambda * dt)); };

  /* ---------------- 确定性随机 ---------------- */
  R.mulberry32 = function (seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  R.SEED = 20261018;                     // 固定种子：每次刷新布局一致
  R.resetRandom = function (seed) {
    R.SEED = seed === undefined ? R.SEED : seed;
    R.rng = R.mulberry32(R.SEED);
    return R.rng;
  };
  R.rng = R.resetRandom(R.SEED);
  R.rand = function (a, b) {
    if (b === undefined) { b = a; a = 0; }
    return a + R.rng() * (b - a);
  };
  R.randInt = function (a, b) { return Math.floor(R.rand(a, b + 1)); };
  R.pick = function (arr) { return arr[Math.min(arr.length - 1, Math.floor(R.rng() * arr.length))]; };
  R.chance = function (p) { return R.rng() < p; };

  // 值噪声
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  R.noise2 = function (x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return R.lerp(R.lerp(a, b, u), R.lerp(c, d, u), v);
  };

  /* ---------------- canvas 贴图 ---------------- */
  R.makeCanvasTexture = function (w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };
  // 无平铺需求的贴图（招牌文字等）
  R.tex = function (key, w, h, draw) {
    texCache[key] = R.makeCanvasTexture(w, h, draw);
    return texCache[key];
  };
  var texCache = {};
  R.cachedTex = function (key, make) {
    if (!texCache[key]) texCache[key] = make();
    return texCache[key];
  };
  // 平铺贴图（地面/墙面）
  R.tileTex = function (key, w, h, draw, rx, ry) {
    var t = R.cachedTex(key, function () {
      var tt = R.makeCanvasTexture(w, h, draw);
      tt.wrapS = tt.wrapT = THREE.RepeatWrapping;
      return tt;
    });
    t.repeat.set(rx, ry);
    return t;
  };

  // 径向渐变（灯光光晕 / 地面反光贴片）
  R.glowTexture = function (inner, outer) {
    return R.cachedTex('glow|' + inner + '|' + outer, function () {
      return R.makeCanvasTexture(128, 128, function (g, w, h) {
        var r = w / 2;
        var gr = g.createRadialGradient(r, r, 0, r, r, r);
        gr.addColorStop(0, inner);
        gr.addColorStop(0.38, outer);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
    });
  };
  // 竖向渐变（湿地面光带 / 拉长的反光）
  R.streakTexture = function (top, mid, bottom) {
    return R.cachedTex('streak|' + top + mid + bottom, function () {
      return R.makeCanvasTexture(64, 256, function (g, w, h) {
        var gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, top);
        gr.addColorStop(0.45, mid);
        gr.addColorStop(1, bottom);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
    });
  };
  // 软圆点（雨滴粒子 / 接触阴影）
  R.dotTexture = function (hardness) {
    return R.cachedTex('dot|' + hardness, function () {
      return R.makeCanvasTexture(64, 64, function (g, w, h) {
        var r = w / 2;
        var gr = g.createRadialGradient(r, r, 0, r, r, r);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(hardness, 'rgba(255,255,255,0.55)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
    });
  };

  /* ---------------- 三渲二：toon 渐变阶 ---------------- */
  var gradCache = {};
  R.toonTex = function (steps, soft) {
    var key = steps + '|' + (soft ? 1 : 0);
    if (gradCache[key]) return gradCache[key];
    var n = steps || 3;
    var data = new Uint8Array(n * 4);
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 1 : i / (n - 1);
      // soft：底部抬亮，避免暗部死黑；硬边：标准三段
      var v = soft ? (0.30 + 0.70 * t) : (0.22 + 0.78 * Math.pow(t, 0.85));
      var b = Math.round(R.clamp(v, 0, 1) * 255);
      data[i * 4] = b; data[i * 4 + 1] = b; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
    }
    var tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    gradCache[key] = tex;
    return tex;
  };

  /* ---------------- 材质缓存 ---------------- */
  var matCache = {};
  function texSig(m) {
    if (!m) return '-';
    return m.uuid || 'x';
  }
  R.mat = function (hex, opts) {
    opts = opts || {};
    var key = hex + '|' + (opts.emissive || '-') + '|' + (opts.emissiveIntensity || '-') + '|' +
      (opts.gradient || 3) + '|' + (opts.soft ? 1 : 0) + '|' + (opts.side || 0) + '|' +
      (opts.opacity === undefined ? 1 : opts.opacity) + '|' + (opts.transparent ? 1 : 0) + '|' +
      (opts.depthWrite === false ? 0 : 1) + '|' + (opts.flat ? 1 : 0) + '|' +
      texSig(opts.map) + '|' + texSig(opts.emissiveMap) + '|' + (opts.blending || 0) + '|' + (opts.fog === false ? 0 : 1);
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshToonMaterial({
      color: hex,
      gradientMap: R.toonTex(opts.gradient || 3, opts.soft),
      emissive: opts.emissive === undefined ? 0x000000 : opts.emissive,
      emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity
    });
    if (opts.map) m.map = opts.map;
    if (opts.emissiveMap) m.emissiveMap = opts.emissiveMap;
    if (opts.side) m.side = opts.side;
    if (opts.opacity !== undefined) m.opacity = opts.opacity;
    if (opts.transparent) { m.transparent = true; m.depthWrite = opts.depthWrite === false ? false : true; }
    if (opts.depthWrite === false) m.depthWrite = false;
    if (opts.flat) m.flatShading = true;
    if (opts.blending) m.blending = opts.blending;
    if (opts.fog === false) m.fog = false;
    matCache[key] = m;
    return m;
  };
  // 自发光纯色（灯光面板、灯箱面、信号灯）
  R.glowMat = function (hex, opacity) {
    var key = 'glowmat|' + hex + '|' + (opacity === undefined ? 1 : opacity);
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshBasicMaterial({ color: hex, fog: false });
    if (opacity !== undefined && opacity < 1) { m.transparent = true; m.opacity = opacity; }
    matCache[key] = m;
    return m;
  };
  // 加色贴片（地面反光、积水光泽、水面波纹）
  R.addMat = function (hex, opacity, map) {
    var key = 'add|' + hex + '|' + opacity + '|' + texSig(map);
    if (matCache[key]) return matCache[key];
    var m = new THREE.MeshBasicMaterial({
      color: hex, map: map || null, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    matCache[key] = m;
    return m;
  };
  R.spriteMat = function (map, hex, opacity) {
    var key = 'spr|' + hex + '|' + opacity + '|' + texSig(map);
    if (matCache[key]) return matCache[key];
    var m = new THREE.SpriteMaterial({
      map: map, color: hex, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    matCache[key] = m;
    return m;
  };
  // 描边材质：反向外扩壳专用
  R.outlineMat = function () {
    if (!matCache.outline) {
      matCache.outline = new THREE.MeshBasicMaterial({ color: 0x0b1018, side: THREE.BackSide, fog: true });
      matCache.outline.color.convertSRGBToLinear();
    }
    return matCache.outline;
  };

  /* ---------------- 几何缓存 ---------------- */
  var geoCache = {};
  function num(v) { return Math.round(v * 1000) / 1000; }
  function cached(key, make) {
    var g = geoCache[key];
    if (!g) g = geoCache[key] = make();
    return g;
  }
  R.boxGeo = function (w, h, d) {
    return cached('box|' + num(w) + '|' + num(h) + '|' + num(d), function () { return new THREE.BoxGeometry(w, h, d); });
  };
  R.cylGeo = function (rt, rb, h, seg) {
    seg = seg || 12;
    return cached('cyl|' + num(rt) + '|' + num(rb) + '|' + num(h) + '|' + seg, function () {
      return new THREE.CylinderGeometry(rt, rb, h, seg);
    });
  };
  R.coneGeo = function (r, h, seg) {
    seg = seg || 10;
    return cached('cone|' + num(r) + '|' + num(h) + '|' + seg, function () { return new THREE.ConeGeometry(r, h, seg); });
  };
  R.sphGeo = function (r, w, h) {
    w = w || 12; h = h || 10;
    return cached('sph|' + num(r) + '|' + w + '|' + h, function () { return new THREE.SphereGeometry(r, w, h); });
  };
  R.circleGeo = function (r, seg) {
    seg = seg || 24;
    return cached('circle|' + num(r) + '|' + seg, function () { return new THREE.CircleGeometry(r, seg); });
  };
  R.planeGeo = function (w, h) {
    return cached('plane|' + num(w) + '|' + num(h), function () { return new THREE.PlaneGeometry(w, h); });
  };
  R.torusGeo = function (r, tube, rad, tub) {
    rad = rad || 8; tub = tub || 14;
    return cached('torus|' + num(r) + '|' + num(tube) + '|' + rad + '|' + tub, function () {
      return new THREE.TorusGeometry(r, tube, rad, tub);
    });
  };
  R.ringGeo = function (ri, ro, seg) {
    seg = seg || 28;
    return cached('ring|' + num(ri) + '|' + num(ro) + '|' + seg, function () { return new THREE.RingGeometry(ri, ro, seg); });
  };
  R.geo = function (key, make) { return cached(key, make); };

  /* ---------------- 描边（反向外扩壳） ---------------- */
  var outlineGeoCache = {};
  R.outlineGeo = function (geo, width) {
    var key = geo.uuid + '|' + width.toFixed(4);
    var g = outlineGeoCache[key];
    if (g) return g;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    g = geo.clone();
    var pos = g.attributes.position, nrm = g.attributes.normal;
    for (var i = 0; i < pos.count; i++) {
      pos.setXYZ(i,
        pos.getX(i) + nrm.getX(i) * width,
        pos.getY(i) + nrm.getY(i) * width,
        pos.getZ(i) + nrm.getZ(i) * width);
    }
    pos.needsUpdate = true;
    g.computeBoundingSphere();
    outlineGeoCache[key] = g;
    return g;
  };
  // 给网格加描边（作为子节点，跟随父级变换）
  R.outline = function (mesh, width) {
    width = width === undefined ? 0.012 : width;
    var o = new THREE.Mesh(R.outlineGeo(mesh.geometry, width), R.outlineMat());
    o.castShadow = false; o.receiveShadow = false; o.matrixAutoUpdate = false;
    o.userData.isOutline = true;
    mesh.add(o);
    mesh.userData.outlined = true;
    return o;
  };
  // 建盒 + 可选描边
  R.boxMesh = function (parent, w, h, d, mat, x, y, z, ry, ow) {
    var m = new THREE.Mesh(R.boxGeo(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (ry) m.rotation.y = ry;
    parent.add(m);
    if (ow) R.outline(m, ow);
    return m;
  };
  R.cylMesh = function (parent, rt, rb, h, mat, x, y, z, seg) {
    var m = new THREE.Mesh(R.cylGeo(rt, rb, h, seg), mat);
    m.position.set(x || 0, y || 0, z || 0);
    parent.add(m);
    return m;
  };
  // 两点之间的圆柱：管件 / 线缆 / 辐条 / 斜撑（自动求朝向）
  var tmpUp = new THREE.Vector3(0, 1, 0), tmpDir = new THREE.Vector3();
  R.tubeBetween = function (parent, x1, y1, z1, x2, y2, z2, r, mat, seg) {
    var dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
    var m = new THREE.Mesh(R.cylGeo(r, r, len, seg || 8), mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.quaternion.setFromUnitVectors(tmpUp, tmpDir.set(dx / len, dy / len, dz / len));
    parent.add(m);
    return m;
  };
  // 螺栓材质（六角头）
  R.boltMat = function () {
    if (!matCache.bolt) {
      matCache.bolt = new THREE.MeshToonMaterial({
        color: 0x565b61,
        emissive: 0x14181c,
        emissiveIntensity: 0.9, gradientMap: R.toonTex(3)
      });
    }
    return matCache.bolt;
  };
  // 六角螺栓头：axis 为螺栓朝向（'y' 朝上 / 'z' 朝前 / 'x' 朝右）
  R.bolt = function (parent, x, y, z, r, axis, mat) {
    r = r || 0.011;
    var m = new THREE.Mesh(R.cylGeo(r, r, r * 1.2, 6), mat || R.boltMat());
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    else if (axis === 'z') m.rotation.x = Math.PI / 2;
    parent.add(m);
    return m;
  };
  // 螺栓环（法兰 / 井盖 / 底座）
  R.boltRing = function (parent, cx, cy, cz, radius, count, axis, r, mat) {
    for (var i = 0; i < count; i++) {
      var a = i / count * Math.PI * 2;
      R.bolt(parent, cx + Math.cos(a) * radius, cy, cz + Math.sin(a) * radius, r, axis || 'y', mat);
    }
  };
  // 水平贴片（地面标记 / 积水 / 反光）
  R.patch = function (parent, x0, z0, x1, z1, y, mat, noDepth) {
    var m = new THREE.Mesh(R.planeGeo(Math.abs(x1 - x0), Math.abs(z1 - z0)), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    if (noDepth) m.renderOrder = 2;
    parent.add(m);
    return m;
  };
  // 带平铺 UV（tileM：一张贴图对应多少米）的地面贴片；几何体独立，避免 UV 互相污染
  R.patchT = function (parent, x0, z0, x1, z1, y, mat, tileM) {
    var w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    var g = new THREE.PlaneGeometry(w, d);
    var uv = g.attributes.uv;
    for (var i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (w / tileM), uv.getY(i) * (d / tileM));
    }
    var m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // 灯光光晕（Sprite 面向相机）
  R.halo = function (parent, x, y, z, size, color, opacity, inner) {
    var spr = new THREE.Sprite(R.spriteMat(R.glowTexture(inner || 'rgba(255,255,255,1)', 'rgba(255,255,255,0.35)'), color, opacity));
    spr.scale.set(size, size, 1);
    spr.position.set(x, y, z);
    parent.add(spr);
    return spr;
  };
  // 地面反光（加色椭圆贴片；scale 可拉长）
  R.groundGlow = function (parent, x, z, rx, rz, y, color, opacity, texKey) {
    var map = texKey === 'streak' ? R.streakTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)')
      : R.glowTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0.30)');
    var m = new THREE.Mesh(R.planeGeo(2, 2), R.addMat(color, opacity, map));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(rx, rz, 1);
    m.position.set(x, y === undefined ? 0.135 : y, z);
    parent.add(m);
    return m;
  };
  // 接触阴影（软贴片，让道具“落地”）
  var contactMatCache = {};
  R.contact = function (parent, x, z, rx, rz, opacity, y) {
    var op = opacity === undefined ? 0.42 : opacity;
    var key = op.toFixed(2);
    if (!contactMatCache[key]) {
      contactMatCache[key] = new THREE.MeshBasicMaterial({
        color: 0x03060b, map: R.dotTexture(0.35), transparent: true, opacity: op,
        depthWrite: false, fog: true
      });
    }
    var m = new THREE.Mesh(R.planeGeo(2, 2), contactMatCache[key]);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(rx, rz === undefined ? rx : rz, 1);
    m.position.set(x, y === undefined ? 0.128 : y, z);
    parent.add(m);
    return m;
  };

  /* ---------------- 实例化（按颜色分组，兼容 r158） ---------------- */
  R.instanced = function (parent, geo, hex, transforms, matOpts) {
    if (!transforms.length) return null;
    var mesh = new THREE.InstancedMesh(geo, R.mat(hex, matOpts), transforms.length);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (var i = 0; i < transforms.length; i++) {
      var t = transforms[i];
      p.set(t.x, t.y, t.z);
      e.set(t.rx || 0, t.ry || 0, t.rz || 0);
      q.setFromEuler(e);
      s.set(t.sx || 1, t.sy || 1, t.sz || 1);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false; mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  };

  /* ---------------- 清理 ---------------- */
  R.disposeCaches = function () {
    var k;
    for (k in geoCache) if (geoCache[k]) geoCache[k].dispose();
    for (k in outlineGeoCache) if (outlineGeoCache[k]) outlineGeoCache[k].dispose();
    for (k in matCache) if (matCache[k] && matCache[k].dispose) matCache[k].dispose();
    for (k in texCache) if (texCache[k]) texCache[k].dispose();
    for (k in gradCache) if (gradCache[k]) gradCache[k].dispose();
    geoCache = {}; outlineGeoCache = {}; matCache = {}; texCache = {}; gradCache = {};
  };
  R.cacheStats = function () {
    function size(o) { var n = 0, k; for (k in o) n++; return n; }
    return { geo: size(geoCache), outline: size(outlineGeoCache), mat: size(matCache), tex: size(texCache) };
  };
})();
