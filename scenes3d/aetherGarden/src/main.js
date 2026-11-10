import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createTextures } from './core/textures.js';
import { createMaterials } from './core/materials.js';
import { createEnvironment } from './world/environment.js';
import { createWorld } from './world/index.js';
import { clamp, damp, easeInOutCubic } from './core/utils.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const ui = document.getElementById('ui');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL 2 required');
} catch (error) {
  document.getElementById('webglError').hidden = false;
  loader.style.display = 'none';
  throw error;
}

const scene = new THREE.Scene();
const getFov = () => window.innerWidth < 620 ? 50 : window.innerWidth < 1000 ? 46 : 41;
const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.35 : 1.7);
const getViewScale = () => {
  if (window.innerWidth < 620) return 1.35;
  if (window.innerWidth < 1000) return 1.18;
  if (window.innerWidth < 1400) return 1.08;
  return 1;
};
const camera = new THREE.PerspectiveCamera(getFov(), window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(23.0, 10.8, 32.0);

renderer.setPixelRatio(getPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 82;
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = 1.53;
controls.target.set(-0.3, 2.6, 0.2);
controls.update();

const textures = createTextures();
const materials = createMaterials(textures);
const environment = createEnvironment(scene, renderer, materials);
const world = createWorld(scene, materials);

const composer = new EffectComposer(renderer);
composer.setPixelRatio(getPixelRatio());
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.62, 0.84);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const START_TIME = 16.15;
const AUTO_RATE = 0.13;
let timeHours = START_TIME;
let autoFlow = true;
let elapsed = 0;
let lastNow = performance.now();
let manualHold = 0;

const clockDisplay = document.getElementById('clockDisplay');
const periodLabel = document.getElementById('periodLabel');
const timeSlider = document.getElementById('timeSlider');
const timeFill = document.getElementById('timeFill');
const timeKnob = document.getElementById('timeKnob');
const orbitLabel = document.getElementById('orbitLabel');
const flowToggle = document.getElementById('flowToggle');
const modeSwitch = document.getElementById('modeSwitch');
const toast = document.getElementById('toast');
const landmarkEls = [...document.querySelectorAll('.landmark-label')];

const cameraViews = {};
for (const [name, view] of Object.entries(world.cameraViews)) {
  cameraViews[name] = { position: view.position.clone(), target: view.target.clone() };
}
let activeView = 'overview';
let flight = null;
let toastTimer = 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function periodFor(hour) {
  if (hour < 5) return '深夜';
  if (hour < 7.4) return '黎明';
  if (hour < 11) return '晨间';
  if (hour < 14) return '正午';
  if (hour < 17.2) return '午后';
  if (hour < 19.2) return '黄昏';
  if (hour < 22.5) return '星夜';
  return '深夜';
}

function themeFor(hour) {
  return hour < 5.9 || hour >= 18.55 ? 'night' : 'day';
}

function updateUI() {
  const h = Math.floor(timeHours % 24);
  const m = Math.floor((timeHours % 1) * 60);
  clockDisplay.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  periodLabel.textContent = periodFor(timeHours);
  timeSlider.value = timeHours.toFixed(2);
  const pct = (timeHours / 24) * 100;
  timeFill.style.width = pct + '%';
  timeKnob.style.left = pct + '%';
  const theta = ((timeHours - 6) / 24) * Math.PI * 2;
  const sunX = Math.cos(theta) * 0.48 - 0.18;
  const sunY = Math.sin(theta);
  const sunZ = 0.86;
  const sunLength = Math.hypot(sunX, sunY, sunZ);
  const altitude = Math.round(Math.asin(sunY / sunLength) * 180 / Math.PI);
  const azimuth = Math.round(((Math.atan2(sunX, sunZ) * 180 / Math.PI) + 360) % 360);
  orbitLabel.textContent = '天光高度 ' + altitude + '° · 方位 ' + azimuth + '°';
  const theme = themeFor(timeHours);
  if (document.documentElement.dataset.theme !== theme) {
    document.documentElement.dataset.theme = theme;
  }
  document.querySelectorAll('.mode-button').forEach((button) => {
    const active = button.dataset.mode === theme;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setTime(hour, announce = false) {
  timeHours = ((hour % 24) + 24) % 24;
  manualHold = 1.4;
  updateUI();
  if (announce) showToast(periodFor(timeHours) + ' · 光正在改变');
}

function toggleFlow() {
  autoFlow = !autoFlow;
  flowToggle.setAttribute('aria-pressed', String(autoFlow));
  flowToggle.querySelector('.flow-copy b').textContent = autoFlow ? '流转中' : '已暂停';
  showToast(autoFlow ? '云上时流 · 继续' : '云上时流 · 暂停');
}

function goToView(name) {
  const view = cameraViews[name];
  if (!view) return;
  activeView = name;
  document.body.classList.toggle('view-close', name !== 'overview');
  document.querySelectorAll('.view-button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === name));
  const farScale = getViewScale();
  const target = view.target.clone();
  const position = target.clone().add(view.position.clone().sub(view.target).multiplyScalar(farScale));
  flight = {
    start: performance.now(),
    duration: 1550,
    fromPosition: camera.position.clone(),
    toPosition: position,
    fromTarget: controls.target.clone(),
    toTarget: target
  };
}

function settleViewAfterResize() {
  if (!cameraViews[activeView]) return;
  const view = cameraViews[activeView];
  const farScale = getViewScale();
  const position = view.target.clone().add(view.position.clone().sub(view.target).multiplyScalar(farScale));
  camera.position.copy(position);
  controls.target.copy(view.target);
  controls.update();
}

function toggleNight() {
  const theme = themeFor(timeHours);
  setTime(theme === 'day' ? 21.2 : 9.1, false);
  showToast(theme === 'day' ? '星野 · 灯笼次第亮起' : '白昼 · 云海重新展开');
}

function resetToNow() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  setTime(hour, false);
  showToast('已回到此刻 · ' + periodFor(hour));
}

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === 'n' || event.key === 'N') toggleNight();
  else if (event.key === 'p' || event.key === 'P' || event.code === 'Space') {
    event.preventDefault();
    toggleFlow();
  } else if (event.key === 'Escape') {
    flight = null;
  } else if (event.key >= '1' && event.key <= '4') {
    goToView(['overview', 'orrery', 'falls', 'bridge'][Number(event.key) - 1]);
  }
});

timeSlider.addEventListener('input', () => {
  setTime(Number(timeSlider.value), false);
});
flowToggle.addEventListener('click', toggleFlow);
document.getElementById('resetTime').addEventListener('click', resetToNow);
modeSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  const target = button.dataset.mode;
  if (target === themeFor(timeHours)) return;
  if (target === 'night') setTime(21.2, true);
  else setTime(9.2, true);
});
document.querySelectorAll('.view-button').forEach((button) => {
  button.addEventListener('click', () => goToView(button.dataset.view));
});
landmarkEls.forEach((button) => {
  button.addEventListener('click', () => goToView(button.dataset.view));
});

function updateLandmarks() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width < 760) {
    landmarkEls.forEach((el) => el.classList.remove('is-visible'));
    return;
  }
  landmarkEls.forEach((el) => {
    const pos = world.landmarks[el.dataset.landmark];
    if (!pos) return;
    const p = pos.clone().project(camera);
    const behind = p.z > 1;
    const x = (p.x * 0.5 + 0.5) * width;
    const y = (-p.y * 0.5 + 0.5) * height;
    const safe = !behind && x > 80 && x < width - 100 && y > 150 && y < height - 170;
    el.classList.toggle('is-visible', safe);
    if (safe) {
      el.style.left = clamp(x, 110, width - 130) + 'px';
      el.style.top = clamp(y, 160, height - 190) + 'px';
    }
  });
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.fov = getFov();
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(getPixelRatio());
  renderer.setSize(width, height);
  composer.setPixelRatio(getPixelRatio());
  composer.setSize(width, height);
  bloom.setSize(width, height);
  if (!flight) settleViewAfterResize();
}

let revealed = false;
function reveal() {
  if (revealed) return;
  revealed = true;
  window.setTimeout(() => {
    document.body.classList.add('is-ready');
    loader.setAttribute('aria-hidden', 'true');
  }, 200);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  elapsed += dt;
  manualHold = Math.max(0, manualHold - dt);
  if (autoFlow && !flight && manualHold <= 0) {
    timeHours = (timeHours + dt * AUTO_RATE) % 24;
    updateUI();
  }
  if (flight) {
    const t = clamp((now - flight.start) / flight.duration, 0, 1);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, e);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
    if (t >= 1) flight = null;
  }
  controls.update();
  const state = environment.update(timeHours, elapsed, dt);
  world.update(timeHours, elapsed, dt, state);
  bloom.strength = 0.22 + state.nightFactor * 0.5;
  bloom.radius = 0.5;
  updateLandmarks();
  composer.render();
  reveal();
}

updateUI();
activeView = 'overview';
document.body.classList.remove('view-close');
settleViewAfterResize();
window.addEventListener('resize', onResize);
requestAnimationFrame(animate);

window.__AETHER__ = {
  scene, camera, controls, world, environment, materials, renderer, composer, bloom,
  setTime, getTime: () => timeHours, toggleAuto: toggleFlow,
  goToView, toggleNight
};
