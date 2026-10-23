import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { createWorld } from './world.js';
import { createStore } from './store.js';
import { createStreetProps } from './props.js';
import { createRainEffects } from './effects.js';

/* ------------------------------------------------------------------ *
 *  星降るマート — rainy-night corner shop, built entirely in code
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.FogExp2(0x07111a, 0.0068);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 180);
const target = new THREE.Vector3(-1.4, 1.8, -2.5);

function startingPosition() {
  const aspect = window.innerWidth / window.innerHeight;
  const distance = aspect < 0.9 ? 59 : aspect < 1.25 ? 52 : 47.2;
  const direction = new THREE.Vector3(0.58, 0.175, 0.79).normalize();
  return target.clone().addScaledVector(direction, distance);
}

camera.position.copy(startingPosition());

const controls = new OrbitControls(camera, canvas);
controls.target.copy(target);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.75;
controls.minDistance = 19;
controls.maxDistance = 78;
controls.minPolarAngle = 0.16;
controls.maxPolarAngle = Math.PI * 0.492;
controls.update();

/* ------------------------------- light ------------------------------- */

const hemisphere = new THREE.HemisphereLight(0x7fa7c7, 0x0a1116, 0.9);
scene.add(hemisphere);

const moon = new THREE.DirectionalLight(0xaac9e4, 2.15);
moon.position.set(18, 31, 23);
moon.target.position.set(-1.0, 0, -2.0);
scene.add(moon, moon.target);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 1;
moon.shadow.camera.far = 95;
moon.shadow.camera.left = -21;
moon.shadow.camera.right = 21;
moon.shadow.camera.top = 21;
moon.shadow.camera.bottom = -21;
moon.shadow.bias = -0.00035;
moon.shadow.normalBias = 0.035;

const nightFill = new THREE.DirectionalLight(0x40637f, 0.8);
nightFill.position.set(-22, 13, -17);
scene.add(nightFill);

const cornerFill = new THREE.PointLight(0x89b6d4, 18, 19, 2);
cornerFill.position.set(8.5, 7.2, 8.5);
scene.add(cornerFill);

/* ------------------------------- world ------------------------------- */

const world = createWorld(scene, renderer);
const store = createStore(scene);
const street = createStreetProps(scene, store.state);
const effects = createRainEffects(scene, world);

/* ------------------------------ resizing ----------------------------- */

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  camera.aspect = aspect;
  camera.fov = aspect < 0.9 ? 43 : aspect < 1.25 ? 38 : 35;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(width, height, false);
}

window.addEventListener('resize', resize, { passive: true });

/* ----------------------------- interaction --------------------------- */

document.body.addEventListener('pointerdown', () => document.body.classList.add('is-dragging'));
for (const eventName of ['pointerup', 'pointercancel', 'blur']) {
  window.addEventListener(eventName, () => document.body.classList.remove('is-dragging'));
}

/* -------------------------------- loop ------------------------------- */

const clock = new THREE.Clock();
let elapsed = 0;
let firstFrame = true;

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  store.update(elapsed, dt);
  street.update(elapsed, dt);
  effects.update(elapsed, dt);
  controls.update();

  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => canvas.classList.add('is-ready'));
  }

  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
