import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createWorld } from './world/index.js';
import { createEnvironment } from './environment.js';
import { clamp, lerp, easeInOutCubic, easeOutQuint } from './utils.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const webglError = document.getElementById('webglError');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 unavailable');
} catch (error) {
  console.error(error);
  if (loader) loader.style.display = 'none';
  if (webglError) webglError.hidden = false;
  throw error;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#aecbd5');
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(33, 31, 42);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.052;
controls.enablePan = false;
controls.rotateSpeed = 0.48;
controls.zoomSpeed = 0.75;
controls.minDistance = 10;
controls.maxDistance = 92;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = 1.42;
controls.target.set(0, 2.1, 0);
controls.update();

const world = createWorld();
scene.add(world.root);
const environment = createEnvironment(scene, renderer, world.materials);

const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.4 : 1.75);
renderer.setPixelRatio(getPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.26, 0.5, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.setSize(window.innerWidth, window.innerHeight);

const ui = {
  flowToggle: document.getElementById('flowToggle'),
  flowState: document.querySelector('#flowToggle .flow-state'),
  modeSwitch: document.getElementById('modeSwitch'),
  modeButtons: Array.from(document.querySelectorAll('.mode-button')),
  clock: document.getElementById('clockDisplay'),
  period: document.getElementById('periodLabel'),
  orbitLabel: document.getElementById('orbitLabel'),
  orbitDot: document.getElementById('orbitDot'),
  orbitProgress: document.getElementById('orbitProgress'),
  slider: document.getElementById('timeSlider'),
  note: document.getElementById('timeNote'),
  resetTime: document.getElementById('resetTime'),
  viewButtons: Array.from(document.querySelectorAll('.view-button')),
  landmarkLabels: Array.from(document.querySelectorAll('.landmark-label')),
  toast: document.getElementById('toast')
};

const START_TIME = 15.05;
let timeHours = START_TIME;
let autoFlow = false;
let timeTween = null;
let activeView = 'overview';
let cameraTween = null;
let userHasInteracted = false;
let uiReady = false;
let toastTimer = 0;
let lastUiUpdate = -1;
let introStart = performance.now();
let currentViewTheme = null;

function mod(n, m) { return ((n % m) + m) % m; }

function getAspectScale() {
  const aspect = window.innerWidth / window.innerHeight;
  if (aspect < 0.62) return 1.3;
  if (aspect < 1.0) return 1.14;
  return 1;
}

function viewFor(name) {
  const source = world.cameraViews[name] || world.cameraViews.overview;
  const scale = getAspectScale();
  const position = source.target.clone().add(source.position.clone().sub(source.target).multiplyScalar(scale));
  return { position, target: source.target.clone() };
}

function startCameraTween(to, duration = 1800) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  cameraTween = {
    fromPos,
    toPos: to.position.clone(),
    fromTarget,
    toTarget: to.target.clone(),
    start: performance.now(),
    duration: reduceMotion ? 1 : duration
  };
  controls.enabled = false;
  controls.autoRotate = false;
}

function cancelCameraTween() {
  if (!cameraTween) return;
  cameraTween = null;
  controls.enabled = true;
}

function flyToView(name, options = {}) {
  activeView = name;
  ui.viewButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.view === name));
  startCameraTween(viewFor(name), options.fast ? 900 : 1700);
  userHasInteracted = true;
}

function toggleAutoFlow(showMessage = true) {
  autoFlow = !autoFlow;
  timeTween = null;
  updateFlowUi();
  if (showMessage) {
    showToast(autoFlow ? '时间开始流转 · 光影正在移动' : '时间已停在这一刻');
  }
}

function updateFlowUi() {
  ui.flowToggle.classList.toggle('is-on', autoFlow);
  ui.flowToggle.setAttribute('aria-pressed', autoFlow ? 'true' : 'false');
  ui.flowToggle.setAttribute('aria-label', autoFlow ? '暂停时间流转' : '开启时间流转');
  if (ui.flowState) ui.flowState.textContent = autoFlow ? 'ON' : 'OFF';
}

function travelTo(targetHour, showMessage = false) {
  autoFlow = false;
  updateFlowUi();
  const normalized = mod(targetHour, 24);
  const current = mod(timeHours, 24);
  let delta = mod(normalized - current, 24);
  if (delta < 0.05) delta += 24;
  timeTween = {
    from: timeHours,
    to: timeHours + delta,
    start: performance.now(),
    duration: reduceMotion ? 1 : 2800
  };
  if (showMessage) {
    showToast(normalized >= 18 || normalized < 5 ? '暮色漫过屋檐，窗灯一盏盏亮起' : '晨光重新落在小镇上');
  }
}

function setTimeValue(value, options = {}) {
  timeHours = value;
  if (!options.keepAuto) {
    autoFlow = false;
    timeTween = null;
    updateFlowUi();
  }
}

function showToast(text) {
  if (!ui.toast) return;
  ui.toast.textContent = text;
  ui.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), 2400);
}

function currentPeriod(hour) {
  const h = mod(hour, 24);
  if (h < 4.8) return ['深夜', 'LATE NIGHT', '灯火守着最后的梦'];
  if (h < 6.8) return ['黎明', 'FIRST LIGHT', '潮声把清晨轻轻叫醒'];
  if (h < 10) return ['清晨', 'MORNING', '海风正好，街角飘来面包香'];
  if (h < 13.6) return ['正午', 'HIGH NOON', '日光落在钟塔与石板路上'];
  if (h < 16.8) return ['午后', 'AFTERNOON', '日光正好，适合慢慢散步'];
  if (h < 19.2) return ['黄昏', 'GOLDEN HOUR', '暮色在屋檐上停留了一会儿'];
  if (h < 22.5) return ['夜晚', 'EVENING', '灯火替星星守着小镇'];
  return ['夜半', 'MIDNIGHT', '只剩潮汐和风车在低语'];
}

function updateClockUI(now) {
  const normalized = mod(timeHours, 24);
  const hours = Math.floor(normalized);
  const minutes = Math.floor((normalized - hours) * 60);
  const label = currentPeriod(normalized);
  const progress = (normalized / 24) * 100;
  ui.clock.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  ui.period.textContent = label[0];
  ui.orbitLabel.textContent = label[1];
  ui.note.textContent = label[2];
  ui.slider.value = String(normalized.toFixed(2));
  ui.orbitDot.style.left = progress + '%';
  ui.orbitProgress.style.width = progress + '%';
  document.documentElement.style.setProperty('--time-pct', progress + '%');
  lastUiUpdate = now;
}

function syncTheme(state, now) {
  const isNight = state.nightFactor > 0.43;
  if (currentViewTheme !== isNight) {
    currentViewTheme = isNight;
    document.documentElement.dataset.theme = isNight ? 'night' : 'day';
    ui.modeSwitch.dataset.mode = isNight ? 'night' : 'day';
    ui.modeButtons.forEach((button) => {
      const active = button.dataset.mode === (isNight ? 'night' : 'day');
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isNight ? '#0a1422' : '#e8dcc3');
  }
}

function updateCamera(dt) {
  if (!cameraTween) return;
  const now = performance.now();
  const raw = clamp((now - cameraTween.start) / cameraTween.duration, 0, 1);
  const t = cameraTween.duration <= 2 ? 1 : easeInOutCubic(raw);
  camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, t);
  controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, t);
  camera.lookAt(controls.target);
  if (raw >= 1) {
    cameraTween = null;
    controls.enabled = true;
    controls.update();
  }
}

function projectLandmarkLabels() {
  if (!uiReady) {
    ui.landmarkLabels.forEach((label) => { label.style.opacity = '0'; });
    return;
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  ui.landmarkLabels.forEach((label) => {
    const position = world.landmarks[label.dataset.landmark];
    if (!position) { label.style.opacity = '0'; return; }
    const projected = position.clone().project(camera);
    const visible = projected.z < 1 && projected.z > -1 && projected.x > -1.14 && projected.x < 1.14 && projected.y > -1.02 && projected.y < 1.04;
    if (!visible) {
      label.style.opacity = '0';
      label.style.pointerEvents = 'none';
      return;
    }
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const safeX = Math.min(width - 96, Math.max(96, x));
    const safeY = Math.min(height - 150, Math.max(96, y - 4));
    label.style.left = safeX + 'px';
    label.style.top = safeY + 'px';
    label.style.opacity = '0.92';
    label.style.pointerEvents = 'auto';
  });
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  camera.aspect = aspect;
  camera.fov = aspect < 0.55 ? 50 : (aspect < 0.82 ? 44 : 34);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(getPixelRatio());
  renderer.setSize(width, height);
  composer.setSize(width, height);
}

window.addEventListener('resize', handleResize);
handleResize();

ui.flowToggle.addEventListener('click', () => toggleAutoFlow(true));

ui.modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    userHasInteracted = true;
    if (mode === 'night') travelTo(21.65, true);
    else travelTo(9.4, true);
  });
});

ui.slider.addEventListener('input', (event) => {
  userHasInteracted = true;
  setTimeValue(parseFloat(event.target.value));
  updateClockUI(performance.now());
});

ui.resetTime.addEventListener('click', () => {
  const now = new Date();
  const localHour = now.getHours() + now.getMinutes() / 60;
  travelTo(localHour, false);
  showToast('时间已回到此刻 · ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
});

ui.viewButtons.forEach((button) => {
  button.addEventListener('click', () => flyToView(button.dataset.view));
});

ui.landmarkLabels.forEach((button) => {
  button.addEventListener('click', () => {
    const targetView = button.dataset.view;
    if (targetView) flyToView(targetView, { fast: true });
  });
});

canvas.addEventListener('pointerdown', () => {
  cancelCameraTween();
  activeView = '';
  ui.viewButtons.forEach((button) => button.classList.remove('is-active'));
  userHasInteracted = true;
}, { capture: true });

controls.addEventListener('start', () => {
  userHasInteracted = true;
  activeView = '';
  ui.viewButtons.forEach((button) => button.classList.remove('is-active'));
});

window.addEventListener('keydown', (event) => {
  const tag = event.target && event.target.tagName;
  if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
  if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    if (currentViewTheme === 'night') travelTo(9.4, true);
    else travelTo(21.65, true);
  }
  if (event.key === 'p' || event.key === 'P' || event.key === ' ') {
    event.preventDefault();
    toggleAutoFlow(true);
  }
  if (event.key === 'Escape') {
    cancelCameraTween();
  }
  if (['1', '2', '3', '4'].includes(event.key)) {
    const names = ['overview', 'plaza', 'harbor', 'hill'];
    flyToView(names[parseInt(event.key, 10) - 1]);
  }
});

// Start from a wide, reverent view and settle into the isometric diorama shot.
const introView = viewFor('overview');
camera.position.set(introView.position.x * 1.33, introView.position.y + 12, introView.position.z * 1.35);
controls.target.copy(introView.target);
startCameraTween(introView, 3000);
controls.enabled = true;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const elapsed = now * 0.001;
  const dt = Math.min(0.05, Math.max(0.001, animate.lastTime ? (now - animate.lastTime) / 1000 : 0.016));
  animate.lastTime = now;

  if (autoFlow) {
    timeHours += dt * 0.23;
    if (mod(timeHours, 24) > 23.999) timeHours = mod(timeHours, 24);
  } else if (timeTween) {
    const raw = clamp((now - timeTween.start) / timeTween.duration, 0, 1);
    const eased = easeInOutCubic(raw);
    timeHours = lerp(timeTween.from, timeTween.to, eased);
    if (raw >= 1) {
      const destination = timeTween.to;
      timeTween = null;
      timeHours = mod(destination, 24);
    }
  }

  updateCamera(dt);
  if (!cameraTween) controls.update();

  const state = environment.update(mod(timeHours, 24), elapsed, dt);
  state.timeHours = mod(timeHours, 24);
  world.update(dt, elapsed, state);

  bloom.strength = lerp(0.16, 0.56, state.nightFactor);
  bloom.radius = lerp(0.32, 0.5, state.nightFactor);

  syncTheme(state, now);
  if (now - lastUiUpdate > 95) updateClockUI(now);
  projectLandmarkLabels();

  composer.render();

  if (!uiReady) {
    uiReady = true;
    const introDelay = reduceMotion ? 0 : 650;
    setTimeout(() => {
      document.body.classList.add('is-ready');
      if (loader) loader.setAttribute('aria-hidden', 'true');
    }, introDelay);
    world.root.traverse((child) => {
      if (child.isMesh && child.material && child.material.transparent && child.material.opacity === 0) {
        child.visible = true;
      }
    });
  }
}

// Pre-warm shaders so the first interactive frame arrives without a visible stall.
try {
  environment.update(mod(START_TIME, 24), 0, 0.016);
  updateClockUI(performance.now());
  updateFlowUi();
  renderer.compile(scene, camera);
  composer.render();
} catch (error) {
  console.warn('Warm-up render failed:', error);
}

window.addEventListener('visibilitychange', () => {
  animate.lastTime = performance.now();
});

window.__HAKONIWA__ = {
  scene,
  camera,
  controls,
  world,
  environment,
  setTime: (hour) => { setTimeValue(hour); },
  getTime: () => mod(timeHours, 24),
  toggleAuto: () => toggleAutoFlow(false)
};

requestAnimationFrame(animate);
