/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · main.js
 * 渲染器 / 场景 / 轨道相机 / UI 交互 / 主循环
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H;

  var canvas = document.getElementById('scene');
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd9e8);
  H.scene = scene;

  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  H.camera = camera;
  camera.position.set(0, 6, 0);

  // 视口尺寸：窗口被最小化/隐藏时 innerWidth/Height 可能为 0，
  // 直接喂给相机与渲染器会产生 NaN 投影矩阵，这里统一兜底。
  function viewSize() {
    var w = window.innerWidth || document.documentElement.clientWidth || 1280;
    var h = window.innerHeight || document.documentElement.clientHeight || 720;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  // WebGL 不可用/初始化失败时的兜底提示（避免只有加载层永远转圈）
  function showFatal(msg) {
    var loading = document.getElementById('loading');
    if (loading) {
      loading.classList.remove('hidden');
      loading.style.whiteSpace = 'pre-line';
      loading.textContent = msg;
    } else if (document.body) {
      var d = document.createElement('div');
      d.className = 'fatal';
      d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
        'padding:24px;text-align:center;white-space:pre-line;z-index:50;background:rgba(11,16,38,.92);';
      d.textContent = msg;
      document.body.appendChild(d);
    }
  }

  // ---------- 渲染器（WebGL 不可用时给出提示而不是白屏） ----------
  var renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.error('WebGL 初始化失败：', err);
  }
  if (!renderer || !renderer.getContext || !renderer.getContext()) {
    showFatal('你的浏览器或设备不支持 WebGL，无法运行箱庭小镇。\n请更新浏览器或开启硬件加速后重试。');
    return;
  }
  H.renderer = renderer;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewSize().w, viewSize().h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  camera.aspect = viewSize().w / viewSize().h;
  camera.updateProjectionMatrix();

  // ---------- 构建世界 ----------
  H.buildTerrain(scene);
  H.buildTown(scene);
  H.buildVehicles(scene);
  H.setupDynamics(scene);

  // ---------- 轨道相机（自实现：左键旋转 / 滚轮缩放 / 右键平移） ----------
  var orbit = {
    theta: 0.85, phi: 1.02, radius: 92,
    thetaT: 0.85, phiT: 1.02, radiusT: 92,
    target: new THREE.Vector3(0, 6, 0), targetT: new THREE.Vector3(0, 6, 0),
    dragging: false, panning: false, lastX: 0, lastY: 0
  };
  H.orbit = orbit; // 供调试/脚本控制相机

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button === 2) { orbit.panning = true; }
    else { orbit.dragging = true; }
    orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    var dx = e.clientX - orbit.lastX, dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    if (orbit.dragging) {
      orbit.thetaT -= dx * 0.005;
      orbit.phiT = H.clamp(orbit.phiT - dy * 0.005, 0.12, 1.5);
    } else if (orbit.panning) {
      var right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      right.y = 0; right.normalize();
      var fwd = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right);
      var k = orbit.radius * 0.0011;
      orbit.targetT.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k);
      orbit.targetT.y = H.clamp(orbit.targetT.y, 0, 30);
    }
  });
  canvas.addEventListener('pointerup', function (e) {
    orbit.dragging = false; orbit.panning = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    orbit.radiusT = H.clamp(orbit.radiusT * Math.exp(e.deltaY * 0.0012), 22, 190);
  }, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function updateCamera(dt) {
    if (H.state.autoRotate && !orbit.dragging && !orbit.panning) orbit.thetaT += dt * 0.05;
    var k = 1 - Math.exp(-dt * 9);
    orbit.theta = H.lerp(orbit.theta, orbit.thetaT, k);
    orbit.phi = H.lerp(orbit.phi, orbit.phiT, k);
    orbit.radius = H.lerp(orbit.radius, orbit.radiusT, k);
    orbit.target.lerp(orbit.targetT, k);
    var sp = Math.sin(orbit.phi), cp = Math.cos(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * sp * Math.sin(orbit.theta),
      orbit.target.y + orbit.radius * cp,
      orbit.target.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    camera.lookAt(orbit.target);
  }

  // ---------- UI ----------
  var timeSlider = document.getElementById('timeSlider');
  var timeVal = document.getElementById('timeVal');
  function fmtT(t) {
    // 先取整到分钟再拆分，避免浮点误差把 07:12 显示成 07:11
    var totalMin = Math.round(t * 24 * 60) % 1440;
    var hh = Math.floor(totalMin / 60), mm = totalMin % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function syncTimeUI() {
    if (timeSlider && !timeSlider._scrub) timeSlider.value = Math.round(H.env.t * 1000);
    if (timeVal) timeVal.textContent = fmtT(H.env.t);
  }
  function on(id) { return document.getElementById(id); }
  if (timeSlider) {
    timeSlider.addEventListener('input', function () {
      H.env.t = this.value / 1000;
      syncTimeUI();
    });
    timeSlider.addEventListener('pointerdown', function () { timeSlider._scrub = true; });
    // pointerup 挂在 window 上，指针移出窗口时用 pointercancel 兜底，
    // 否则 _scrub 会一直为真，时钟滑杆再也不跟随时间更新
    window.addEventListener('pointerup', function () { timeSlider._scrub = false; });
    window.addEventListener('pointercancel', function () { timeSlider._scrub = false; });
  }

  var speedBtns = document.querySelectorAll('[data-speed]');
  speedBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = parseFloat(btn.getAttribute('data-speed'));
      H.env.speed = v;
      H.env.playing = v > 0;
      speedBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
    });
  });
  var timeBtns = document.querySelectorAll('[data-time]');
  timeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      H.env.t = parseFloat(btn.getAttribute('data-time'));
      syncTimeUI();
    });
  });
  var btnRotate = on('btnRotate');
  if (btnRotate) btnRotate.addEventListener('click', function () {
    H.state.autoRotate = !H.state.autoRotate;
    btnRotate.classList.toggle('active', H.state.autoRotate);
  });
  var btnDyn = on('btnDyn');
  if (btnDyn) btnDyn.addEventListener('click', function () {
    H.state.dynamics = !H.state.dynamics;
    btnDyn.classList.toggle('active', H.state.dynamics);
  });
  var btnFx = on('btnFx');
  if (btnFx) btnFx.addEventListener('click', function () {
    H.state.fireworks = !H.state.fireworks;
    btnFx.classList.toggle('active', H.state.fireworks);
  });
  var btnShot = on('btnShot');
  if (btnShot) btnShot.addEventListener('click', function () {
    renderer.render(scene, camera);
    var a = document.createElement('a');
    a.download = 'hakoniwa-town-' + fmtT(H.env.t).replace(':', '-') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
  var btnFull = on('btnFull');
  if (btnFull) btnFull.addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });
  // 时间/速度按钮的激活态：以当前速度为准，避免空格暂停后出现两个高亮
  function syncSpeedUI() {
    speedBtns.forEach(function (b) {
      b.classList.toggle('active', H.env.playing && parseFloat(b.getAttribute('data-speed')) === H.env.speed);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      H.env.playing = !H.env.playing;
      syncSpeedUI();
    }
  });

  // ---------- 窗口大小 ----------
  var resizeRaf = 0;
  function applyViewSize() {
    resizeRaf = 0;
    var v = viewSize();
    camera.aspect = v.w / v.h;
    camera.updateProjectionMatrix();
    renderer.setSize(v.w, v.h);
  }
  window.addEventListener('resize', function () {
    // 合并同一帧内的多次 resize，避免布局抖动时重复重建绘制缓冲
    if (resizeRaf) return;
    resizeRaf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame(applyViewSize)
      : (applyViewSize(), 0);
  });

  // ---------- 主循环 ----------
  var clock = new THREE.Clock();
  var hudTimer = 0;
  var rafId = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
    H.elapsed = t;              // 供水面/溪流着色器共享时间
    H.updateCycle(dt);
    if (H.state.dynamics) H.updateDynamics(dt, t);
    // 水面/瀑布着色器时间与相机
    if (H.waterMats) {
      for (var i = 0; i < H.waterMats.length; i++) {
        H.waterMats[i].uniforms.uTime.value = t;
        H.waterMats[i].uniforms.uCam.value.copy(camera.position);
      }
    }
    updateCamera(dt);
    hudTimer += dt;
    if (hudTimer > 0.25) {
      hudTimer = 0;
      H.updateHud();
      syncTimeUI();
    }
    renderer.render(scene, camera);
  }

  // 首帧后淡出加载层
  var loadTimer = 0;
  requestAnimationFrame(function () {
    var loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    loadTimer = setTimeout(function () { if (loading) loading.remove(); }, 900);
  });

  // 供测试脚本驱动（真实浏览器下不会用到）
  H.__loop = {
    animate: animate, syncSpeedUI: syncSpeedUI, applyViewSize: applyViewSize,
    showFatal: showFatal, viewSize: viewSize
  };

  // Node 测试环境：不自动启动 rAF 循环，由 test/run.js 手动驱动帧
  if (window.__HAKONIWA_TEST__) return;

  animate();

  // ---------- 页面卸载时清理动画循环/定时器与 GPU 缓存 ----------
  window.addEventListener('pagehide', function () {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (loadTimer) clearTimeout(loadTimer);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    H.disposeCaches();
  });
})();
