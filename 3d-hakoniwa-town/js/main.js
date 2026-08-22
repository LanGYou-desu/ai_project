/* ============================================================
 * 箱庭小镇 HAKONIWA TOWN · main.js
 * 渲染器 / 场景 / 轨道相机 / UI 交互 / 主循环
 * ============================================================ */
(function () {
  'use strict';
  var H = window.H;

  var canvas = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd9e8);
  H.scene = scene;

  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
  H.camera = camera;
  H.camera.position.set(0, 6, 0);

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
    var h = t * 24;
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function syncTimeUI() {
    if (timeSlider && !timeSlider._scrub) timeSlider.value = Math.round(H.env.t * 1000);
    if (timeVal) timeVal.textContent = fmtT(H.env.t);
  }
  timeSlider.addEventListener('input', function () {
    H.env.t = this.value / 1000;
    syncTimeUI();
  });
  timeSlider.addEventListener('pointerdown', function () { timeSlider._scrub = true; });
  window.addEventListener('pointerup', function () { timeSlider._scrub = false; });

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
  var btnRotate = document.getElementById('btnRotate');
  btnRotate.addEventListener('click', function () {
    H.state.autoRotate = !H.state.autoRotate;
    btnRotate.classList.toggle('active', H.state.autoRotate);
  });
  var btnDyn = document.getElementById('btnDyn');
  btnDyn.addEventListener('click', function () {
    H.state.dynamics = !H.state.dynamics;
    btnDyn.classList.toggle('active', H.state.dynamics);
  });
  var btnFx = document.getElementById('btnFx');
  btnFx.addEventListener('click', function () {
    H.state.fireworks = !H.state.fireworks;
    btnFx.classList.toggle('active', H.state.fireworks);
  });
  document.getElementById('btnShot').addEventListener('click', function () {
    renderer.render(scene, camera);
    var a = document.createElement('a');
    a.download = 'hakoniwa-town-' + fmtT(H.env.t).replace(':', '-') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
  document.getElementById('btnFull').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      H.env.playing = !H.env.playing;
      speedBtns.forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-speed') === '0' ? !H.env.playing : b.classList.contains('active') && H.env.playing);
      });
    }
  });

  // ---------- 窗口大小 ----------
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- 主循环 ----------
  var clock = new THREE.Clock();
  var hudTimer = 0;
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;
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
  requestAnimationFrame(function () {
    var loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
    setTimeout(function () { if (loading) loading.remove(); }, 900);
  });
  animate();
})();
