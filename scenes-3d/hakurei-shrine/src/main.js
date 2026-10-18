import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildWorld } from './world.js';
import { buildShrine } from './shrine.js';
import { buildNature } from './nature.js';
import { buildReimu } from './reimu.js';
import { mergeStaticMeshes } from './helpers.js';

const canvas = document.querySelector('#stage');
const app = document.querySelector('#app');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(
  34,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.1,
  180,
);
camera.position.set(18.2, 15.0, 26.3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.65, 0.35);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 14;
controls.maxDistance = 54;
controls.minPolarAngle = 0.34;
controls.maxPolarAngle = 1.43;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.85;
controls.update();

/* ------------------------------------------------------------------ *
 * Light — a warm late-afternoon sun with cool sky bounce.
 * ------------------------------------------------------------------ */
const hemi = new THREE.HemisphereLight(0xfff3dc, 0x7f8b7e, 0.62);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffedcf, 2.6);
sun.position.set(-10.5, 18.5, 11.5);
sun.target.position.set(0, 2.2, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -17;
sun.shadow.camera.right = 17;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 55;
sun.shadow.bias = -0.0007;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3.2;
scene.add(sun, sun.target);

const fill = new THREE.DirectionalLight(0xa8c8d2, 0.5);
fill.position.set(12, 11, -13);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffd9ae, 0.34);
rim.position.set(-3, 7, -16);
scene.add(rim);

/* ------------------------------------------------------------------ *
 * Build the tiny world.
 * ------------------------------------------------------------------ */
const root = new THREE.Group();
root.name = 'HakureiShrineDiorama';
scene.add(root);

const shrine = buildShrine(root);
const world = buildWorld(root);
const nature = buildNature(root, world.groundHeightAt);
// Batch every remaining static opaque surface by material. Animated crowns,
// ema, streamers, water, shadows and particles have already opted out.
mergeStaticMeshes(root);
const reimu = buildReimu(root, camera, world.groundHeightAt, nature.groundLeaves);

/* ------------------------------------------------------------------ *
 * Resize handling — keep the whole square garden in view.
 * ------------------------------------------------------------------ */
function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const aspect = w / h;
  camera.aspect = aspect;
  camera.fov = aspect < 0.82 ? 46 : aspect < 1.15 ? 41 : 34;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

// Double-clicking returns to the storybook three-quarter view, quietly.
renderer.domElement.addEventListener('dblclick', () => {
  camera.position.set(18.2, 15.0, 26.3);
  controls.target.set(0, 1.65, 0.35);
  controls.update();
});

/* ------------------------------------------------------------------ *
 * Main loop
 * ------------------------------------------------------------------ */
let elapsed = 0;
let lastTime = performance.now();
let firstFrame = true;

function step(dt) {
  elapsed += dt;
  controls.update();
  shrine.update(elapsed, dt);
  world.update(elapsed, dt);
  nature.update(elapsed, dt);
  reimu.update(elapsed, dt);

  // A barely perceptible drift of the key light keeps the scene alive
  // without turning a collectible model into a moving picture.
  const sunSwing = Math.sin(elapsed * 0.045) * 0.55;
  sun.position.x = -10.5 + sunSwing;
  sun.position.z = 11.5 - Math.sin(elapsed * 0.03) * 0.35;
}

function animate(now) {
  const raw = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(0.05, Math.max(0, raw));
  if (dt > 0) step(dt);
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.documentElement.dataset.ready = 'true';
    window.dispatchEvent(new Event('hakurei-ready'));
  }
}

renderer.setAnimationLoop(animate);

/** Non-visual helper for automated captures and deterministic review. */
function debugAdvance(seconds, dt = 1 / 30) {
  const steps = Math.max(1, Math.ceil(seconds / dt));
  for (let i = 0; i < steps; i++) step(seconds / steps);
  renderer.render(scene, camera);
}

window.__HAKUREI__ = {
  scene,
  camera,
  renderer,
  controls,
  root,
  reimu,
  nature,
  world,
  shrine,
  lights: { hemi, sun, fill, rim },
  debugAdvance,
  ready: true,
};
