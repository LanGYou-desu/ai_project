/* ============================================================
 * 雨夜便利店 · js/main.js
 * 渲染器 / 夜空穹顶 / 灯光 / 轨道相机（拖拽旋转·缩放·平移）/ 主循环
 * ============================================================ */
(function () {
  'use strict';
  var R = window.R;

  var canvas = document.getElementById('scene');
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1018, 0.0105);
  R.scene = scene;

  var camera = new THREE.PerspectiveCamera(42, 1, 0.5, 420);
  R.camera = camera;

  function viewSize() {
    var w = window.innerWidth || document.documentElement.clientWidth || 1280;
    var h = window.innerHeight || document.documentElement.clientHeight || 720;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }
  function showFatal(msg) {
    if (document.body) {
      var d = document.createElement('div');
      d.className = 'fatal';
      d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;text-align:center;white-space:pre-line;z-index:50;background:#070a12;color:#c8d4e2;' +
        'font:16px/1.7 "Yu Gothic","Microsoft YaHei",sans-serif;';
      d.textContent = msg;
      document.body.appendChild(d);
    }
  }

  /* ---------------- 渲染器 ---------------- */
  var renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    if (window.console) console.error('WebGL 初始化失败：', err);
  }
  if (!renderer || !renderer.getContext || !renderer.getContext()) {
    showFatal('你的浏览器或设备不支持 WebGL，无法显示这个雨夜便利店模型。\n请更新浏览器或开启硬件加速后重试。');
    return;
  }
  R.renderer = renderer;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewSize().w, viewSize().h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  camera.aspect = viewSize().w / viewSize().h;
  camera.updateProjectionMatrix();

  /* ---------------- 夜空穹顶 ---------------- */
  (function sky() {
    var geo = new THREE.SphereGeometry(170, 24, 16);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x05070e).convertSRGBToLinear() },
        uMid: { value: new THREE.Color(0x0d1626).convertSRGBToLinear() },
        uHorizon: { value: new THREE.Color(0x1d2c46).convertSRGBToLinear() },
        uGlow: { value: new THREE.Color(0x3a2a34).convertSRGBToLinear() }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uGlow;',
        'varying vec3 vDir;',
        'void main() {',
        '  float y = vDir.y;',
        '  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, y));',
        '  col = mix(col, uTop, smoothstep(0.25, 0.85, y));',
        '  col = mix(col * 0.55, col, smoothstep(-0.22, 0.06, y));',
        '  float glow = exp(-max(y, 0.0) * 7.5);',
        '  col += uGlow * glow * 0.9;',
        '  col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var dome = new THREE.Mesh(geo, mat);
    dome.frustumCulled = false;
    scene.add(dome);
  })();

  /* ---------------- 灯光 ---------------- */
  var hemi = new THREE.HemisphereLight(0x2c4666, 0x090c12, 0.62);
  scene.add(hemi);
  var moon = new THREE.DirectionalLight(0x9cbedf, 0.5);
  moon.position.set(11, 20, 9);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -22; moon.shadow.camera.right = 22;
  moon.shadow.camera.top = 22; moon.shadow.camera.bottom = -22;
  moon.shadow.camera.near = 2; moon.shadow.camera.far = 70;
  moon.shadow.bias = -0.0007;
  moon.shadow.normalBias = 0.03;
  scene.add(moon);
  scene.add(moon.target);
  R.lights = { hemi: hemi, moon: moon, interior: [], doorSpill: null, extra: [] };

  /* ---------------- 构建世界 ---------------- */
  R.buildBase(scene);
  R.buildStore(scene);
  R.buildInterior(scene);
  R.buildProps(scene);
  R.buildRain(scene);
  R.setupDynamics();

  /* ---- 店内暖光 / 门口溢出光 / 贩卖机冷光 / 路灯（由各模块登记位置） ---- */
  R.interior.lightSpots.forEach(function (p) {
    var l = new THREE.PointLight(0xffd7a4, 2.5, 9.0, 1.9);
    l.position.set(p.x, p.y, p.z);
    l.baseIntensity = 2.5;
    scene.add(l);
    R.lights.interior.push(l);
  });
  var dspill = new THREE.PointLight(0xffc890, 0.95, 7.5, 2.0);
  dspill.position.set(-2.6, 1.7, 0.7);
  scene.add(dspill);
  R.lights.doorSpill = dspill;
  (R.props.lights || []).forEach(function (p) {
    var l = new THREE.PointLight(p.color, p.intensity, p.distance, p.decay);
    l.position.set(p.x, p.y, p.z);
    scene.add(l);
    R.lights.extra.push(l);
  });

  /* ---------------- 阴影登记：投影 / 承影（微缩模型的立体感关键） ---------------- */
  (function registerShadows() {
    function opaqueMesh(o) {
      if (!o.isMesh || !o.geometry || !o.material || Array.isArray(o.material)) return false;
      if (o.userData && o.userData.isOutline) return false;              // 外扩描边壳
      if (o.material.blending === THREE.AdditiveBlending) return false;  // 地面反光 / 光斑
      if (o.material.transparent) return false;                          // 玻璃 / 半透明贴片
      return true;
    }
    // 承影：地面、建筑、陈设、道具接受阴影
    ['base', 'store', 'interior', 'props'].forEach(function (name) {
      var g = scene.getObjectByName(name);
      if (!g) return;
      g.traverse(function (o) {
        if (opaqueMesh(o)) o.receiveShadow = true;
      });
    });
    // 投影：跳过天穹与平面贴片（铺装 / 标线 / 水渍），按几何半径筛掉过小零件
    // 底座（base）按原约定只承影不投影
    ['store', 'interior', 'props'].forEach(function (name) {
      var g = scene.getObjectByName(name);
      if (!g) return;
      g.traverse(function (o) {
        if (!opaqueMesh(o)) return;
        if (o.frustumCulled === false) return;                           // 天穹
        var geo = o.geometry;
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        if (!geo.boundingSphere) return;
        if (o.isInstancedMesh) { o.castShadow = true; return; }
        if (geo.type === 'PlaneGeometry') return;                        // 贴地贴片不投影
        if (geo.boundingSphere.radius < 0.14) return;
        o.castShadow = true;
      });
    });
  })();

  /* ---------------- 辉光后处理（雨夜霓虹光晕·轻量 bloom） ---------------- */
  var bloom = null;
  (function setupBloom() {
    /* 1) 发光物打标：只属于第 1 层（主画面照常可见；辉光通道仅渲染它们） */
    var glowCount = 0;
    scene.traverse(function (o) {
      var m = o.material;
      if (Array.isArray(m)) return;
      var isGlow = false;
      if (o.isSprite) isGlow = true;                                                            // 光晕牌
      else if (m && !m.isShaderMaterial && m.blending === THREE.AdditiveBlending) isGlow = true; // 加法贴片 / 光点
      else if (m && m.isMeshBasicMaterial && m.fog === false) isGlow = true;                    // 自发光面（glowMat）
      else if (m && R.neon && m === R.neon.mat) isGlow = true;                                  // 霓虹灯管
      if (!isGlow) return;
      o.layers.set(1);
      glowCount++;
    });
    camera.layers.enable(1);

    /* 2) 渲染目标：半分辨率辉光 + 两块模糊乒乓（支持时用半浮点 HDR） */
    var ext = renderer.extensions;
    var useHDR = !!(ext && ext.has && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float')));
    var rtType = useHDR ? THREE.HalfFloatType : THREE.UnsignedByteType;
    function half(n) { return Math.max(1, n >> 1); }
    function bufSize() {
      var p = Math.min(window.devicePixelRatio || 1, 2), v = viewSize();
      return { w: Math.max(2, Math.floor(v.w * p)), h: Math.max(2, Math.floor(v.h * p)) };
    }
    var bs0 = bufSize();
    var glowRT = new THREE.WebGLRenderTarget(half(bs0.w), half(bs0.h), {
      depthBuffer: true, stencilBuffer: false, type: rtType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
    });
    var blurOpts = {
      depthBuffer: false, stencilBuffer: false, type: rtType,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
    };
    var blurA = new THREE.WebGLRenderTarget(half(bs0.w), half(bs0.h), blurOpts);
    var blurB = new THREE.WebGLRenderTarget(half(bs0.w), half(bs0.h), blurOpts);

    /* 3) 全屏四边形 + 模糊 / 合成着色器 */
    var quadScene = new THREE.Scene();
    quadScene.name = '__RPost';
    var quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    quadMesh.frustumCulled = false;
    quadScene.add(quadMesh);
    var quadVS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

    var blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: quadVS,
      fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform vec2 uDir;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;',
        '  c += (texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb + texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;',
        '  c += (texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb + texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n'),
      depthTest: false, depthWrite: false
    });
    var postMat = new THREE.ShaderMaterial({
      uniforms: { tGlow: { value: blurB.texture }, uStrength: { value: 0.38 } },
      vertexShader: quadVS,
      fragmentShader: [
        'uniform sampler2D tGlow;',
        'uniform float uStrength;',
        'varying vec2 vUv;',
        'void main() {',
        '  vec3 g = max(texture2D(tGlow, vUv).rgb, vec3(0.0));',
        '  g = pow(g, vec3(1.0 / 2.2)) * uStrength;',   // 感知空间叠加，与现有加法贴片一致
        '  gl_FragColor = vec4(g, 1.0);',
        '}'
      ].join('\n'),
      transparent: true, blending: THREE.AdditiveBlending,
      depthTest: false, depthWrite: false, fog: false
    });

    function blurInto(from, to, dirX, dirY) {
      blurMat.uniforms.tDiffuse.value = from.texture;
      blurMat.uniforms.uDir.value.set(dirX / to.width, dirY / to.height);
      quadMesh.material = blurMat;
      renderer.setRenderTarget(to);
      renderer.render(quadScene, quadCam);
    }
    function renderFrame() {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);                       // 主画面（与辉光前完全一致）
      var shadowAuto = renderer.shadowMap.autoUpdate;       // 后续通道无需重算阴影贴图
      renderer.shadowMap.autoUpdate = false;
      var mask = camera.layers.mask;                        // 辉光通道：只画第 1 层发光物
      camera.layers.set(1);
      renderer.setRenderTarget(glowRT);
      renderer.render(scene, camera);
      camera.layers.mask = mask;
      blurInto(glowRT, blurA, 1.0, 0); blurInto(blurA, blurB, 0, 1.0);   // 两轮高斯模糊
      blurInto(blurB, blurA, 2.0, 0); blurInto(blurA, blurB, 0, 2.0);
      quadMesh.material = postMat;                          // 叠加合成（不清屏，保护主画面）
      var ac = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
      renderer.autoClear = ac;
      renderer.shadowMap.autoUpdate = shadowAuto;
    }
    function resizeBloom(v) {
      var p = Math.min(window.devicePixelRatio || 1, 2);
      var w = half(Math.max(2, Math.floor(v.w * p)));
      var h = half(Math.max(2, Math.floor(v.h * p)));
      glowRT.setSize(w, h); blurA.setSize(w, h); blurB.setSize(w, h);
    }
    bloom = {
      strength: 0.38, count: glowCount, hdr: useHDR,
      glowRT: glowRT, blurA: blurA, blurB: blurB,
      quadScene: quadScene, quadCam: quadCam, mat: postMat, blurMat: blurMat,
      renderFrame: renderFrame, resize: resizeBloom
    };
    R.bloom = bloom;
  })();

  /* ---------------- 轨道相机（自由拖拽 / 旋转 / 缩放） ---------------- */
  var orbit = {
    theta: 0.46, phi: 1.06, radius: 36,
    thetaT: 0.46, phiT: 1.06, radiusT: 36,
    minR: 9, maxR: 78,
    target: new THREE.Vector3(0, 1.2, -1.3),
    targetT: new THREE.Vector3(0, 1.2, -1.3),
    dragging: false, panning: false, lastX: 0, lastY: 0,
    idle: 0, autoRotate: true
  };
  R.orbit = orbit;
  var pointers = {};
  var pinch = null;
  function updateCamera(dt) {
    if (orbit.autoRotate && !orbit.dragging && !orbit.panning) {
      orbit.idle += dt;
      if (orbit.idle > 9) orbit.thetaT += dt * 0.035;
    }
    var k = 1 - Math.exp(-dt * 8);
    orbit.theta = R.lerp(orbit.theta, orbit.thetaT, k);
    orbit.phi = R.lerp(orbit.phi, orbit.phiT, k);
    orbit.radius = R.lerp(orbit.radius, orbit.radiusT, k);
    orbit.target.lerp(orbit.targetT, k);
    var sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * cp,
      orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    camera.lookAt(orbit.target);
  }
  function panBy(dx, dy) {
    var right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    var fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right);
    var k = orbit.radius * 0.0013;
    orbit.targetT.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
    orbit.targetT.x = R.clamp(orbit.targetT.x, -10, 10);
    orbit.targetT.z = R.clamp(orbit.targetT.z, -10, 10);
    orbit.targetT.y = R.clamp(orbit.targetT.y, 0, 12);
  }
  canvas.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var n = Object.keys(pointers).length;
    if (n === 2) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
    if (e.button === 2 || e.shiftKey) orbit.panning = true; else orbit.dragging = true;
    orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    orbit.idle = 0;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId]) return;
    var prev = pointers[e.pointerId];
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    var n = Object.keys(pointers).length;
    if (n >= 2 && pinch) {
      var ids = Object.keys(pointers);
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y);
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.d > 8) orbit.radiusT = R.clamp(orbit.radiusT * (pinch.d / Math.max(1, d)), orbit.minR, orbit.maxR);
      panBy(mx - pinch.mx, my - pinch.my);
      pinch.d = d; pinch.mx = mx; pinch.my = my;
      orbit.idle = 0;
      return;
    }
    if (orbit.dragging) {
      orbit.thetaT -= dx * 0.0052;
      orbit.phiT = R.clamp(orbit.phiT - dy * 0.0045, 0.16, 1.35);
    } else if (orbit.panning) {
      panBy(dx, dy);
    }
    orbit.idle = 0;
  });
  function endPointer(e) {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) pinch = null;
    if (Object.keys(pointers).length === 0) { orbit.dragging = false; orbit.panning = false; }
    if (canvas.releasePointerCapture) { try { canvas.releasePointerCapture(e.pointerId); } catch (err) { } }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    orbit.radiusT = R.clamp(orbit.radiusT * Math.exp((e.deltaY || 0) * 0.0011), orbit.minR, orbit.maxR);
    orbit.idle = 0;
  }, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('dblclick', function () {
    orbit.radiusT = 17;
    orbit.phiT = 1.02;
    orbit.idle = 0;
  });

  /* ---------------- 视口 ---------------- */
  var resizeRaf = 0;
  function applyViewSize() {
    resizeRaf = 0;
    var v = viewSize();
    camera.aspect = v.w / v.h;
    camera.updateProjectionMatrix();
    renderer.setSize(v.w, v.h);
    if (bloom) bloom.resize(v);
  }
  window.addEventListener('resize', function () {
    if (resizeRaf) return;
    resizeRaf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(applyViewSize) : (applyViewSize(), 0);
  });

  /* ---------------- 主循环 ---------------- */
  var clock = new THREE.Clock();
  var rafId = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    R.elapsed = t;
    updateCamera(dt);
    R.updateRain(dt, t);
    R.updateDynamics(dt, t);
    if (bloom) bloom.renderFrame();
    else renderer.render(scene, camera);
  }

  R.__loop = {
    animate: animate, updateCamera: updateCamera, applyViewSize: applyViewSize,
    viewSize: viewSize, showFatal: showFatal, panBy: panBy
  };

  if (window.__RAIN_TEST__) return;      // Node 测试环境：不自动启动

  animate();

  window.addEventListener('pagehide', function () {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    R.disposeCaches();
  });
})();
