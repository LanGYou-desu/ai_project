import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

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
export const seeded = (seed) => mulberry32(seed);
export const randRange = (min, max, rng = Math.random) => min + (max - min) * rng();
export const pick = (array, rng = Math.random) => array[Math.floor(rng() * array.length) % array.length];

export function canvasTexture(width, height, draw, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = options.color === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.anisotropy = options.anisotropy || 4;
  if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  if (options.clamp) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  texture.needsUpdate = true;
  return texture;
}

export function rounded(w, h, d, r = 0.08, segments = 2) {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, Math.min(w, h, d) * 0.26));
}

export function addMesh(parent, geometry, material, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (options.position) mesh.position.set(...options.position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.scale) mesh.scale.set(...options.scale);
  mesh.castShadow = options.cast !== false;
  mesh.receiveShadow = options.receive !== false;
  mesh.renderOrder = options.renderOrder || 0;
  mesh.name = options.name || '';
  parent.add(mesh);
  return mesh;
}

export function addBox(parent, w, h, d, material, x = 0, y = 0, z = 0, r = 0.04, cast = true, receive = true) {
  const geo = r > 0 ? rounded(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
  return addMesh(parent, geo, material, { position: [x, y, z], cast, receive });
}

export function addCylinder(parent, radiusTop, radiusBottom, height, radialSegments, material, x = 0, y = 0, z = 0, cast = true) {
  return addMesh(parent, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1, false), material, {
    position: [x, y, z], cast
  });
}

export function addSphere(parent, radius, material, x = 0, y = 0, z = 0, wSeg = 12, hSeg = 8, cast = true) {
  return addMesh(parent, new THREE.SphereGeometry(radius, wSeg, hSeg), material, { position: [x, y, z], cast });
}

export function addTube(parent, points, radius, material, closed = false, tubularSegments = 64, radialSegments = 5) {
  const curve = points.isCurve ? points : new THREE.CatmullRomCurve3(points.map((p) => p.isVector3 ? p : new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  return addMesh(parent, geometry, material, { cast: true, receive: true });
}

export function addRope(parent, points, radius, material, closed = false, tubularSegments = 56) {
  return addTube(parent, points, radius, material, closed, tubularSegments, 5);
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

export function group(parent, x = 0, y = 0, z = 0, name = '') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.name = name;
  if (parent) parent.add(g);
  return g;
}

export function seededRange(seed) {
  const rng = mulberry32(seed);
  return () => rng();
}

export function makeGlowSprite(parent, material, x, y, z, scale = 1) {
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.setScalar(scale);
  parent.add(sprite);
  return sprite;
}

export function makeLathe(profile, segments = 32) {
  return new THREE.LatheGeometry(profile, segments);
}

export function pointOnCircle(radius, angle, y = 0) {
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

export function starPath(cx, cy, outer, inner, points = 5) {
  const verts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    verts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return verts;
}

export function makeTextPlaneTexture(text, options = {}) {
  const w = options.width || 512;
  const h = options.height || 180;
  const bg = options.background || '#30463f';
  const fg = options.foreground || '#eadfc9';
  const border = options.border || '#bca06a';
  return canvasTexture(w, h, (ctx, cw, ch) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    if (options.transparent) {
      ctx.clearRect(0, 0, cw, ch);
    }
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, cw - 20, ch - 20);
    ctx.fillStyle = fg;
    ctx.font = options.font || '500 60px "Microsoft YaHei", "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2 + 2);
  }, { clamp: true });
}
