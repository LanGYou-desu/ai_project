import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const deg = (d) => d * Math.PI / 180;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(0x51f15e);
export const randRange = (min, max, rng = rand) => min + (max - min) * rng();
export const pick = (array, rng = rand) => array[Math.floor(rng() * array.length) % array.length];

export function canvasTexture(width, height, draw, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = options.color !== false ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = options.anisotropy || 4;
  if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

export function rounded(w, h, d, r = 0.08, segments = 2) {
  return new RoundedBoxGeometry(w, h, d, segments, r);
}

export function addMesh(parent, geometry, material, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (options.position) mesh.position.set(...options.position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.scale) mesh.scale.set(...options.scale);
  mesh.castShadow = options.cast !== false;
  mesh.receiveShadow = options.receive !== false;
  mesh.name = options.name || '';
  mesh.renderOrder = options.renderOrder || 0;
  parent.add(mesh);
  return mesh;
}

export function addBox(parent, w, h, d, material, x = 0, y = 0, z = 0, r = 0.04, cast = true, receive = true) {
  const geo = r > 0 ? rounded(w, h, d, Math.min(r, Math.min(w, h, d) * 0.24), 2) : new THREE.BoxGeometry(w, h, d);
  return addMesh(parent, geo, material, { position: [x, y, z], cast, receive });
}

export function addCylinder(parent, radiusTop, radiusBottom, height, radialSegments, material, x = 0, y = 0, z = 0, cast = true) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false);
  return addMesh(parent, geo, material, { position: [x, y, z], cast });
}

export function addSphere(parent, radius, material, x = 0, y = 0, z = 0, widthSegments = 12, heightSegments = 8, cast = true) {
  return addMesh(parent, new THREE.SphereGeometry(radius, widthSegments, heightSegments), material, { position: [x, y, z], cast });
}

export function setShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}

export function groupAt(parent, x = 0, y = 0, z = 0, name = '') {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.name = name;
  parent.add(group);
  return group;
}

export function lineBetween(parent, a, b, radius, material, radialSegments = 5) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addWire(parent, points, material, radius = 0.012, segments = 60) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segments, radius, 4, false);
  return addMesh(parent, geo, material, { cast: false, receive: false });
}

export function makeSprite(material, x, y, z, scale = 1) {
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(scale, scale, scale);
  return sprite;
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

export function mixHexColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

export function randomPointInEllipse(rng, rx, rz) {
  const a = rng() * TAU;
  const r = Math.sqrt(rng());
  return [Math.cos(a) * rx * r, Math.sin(a) * rz * r];
}
