import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  HoshiFuru Mart — shared art direction, materials and tiny helpers
 * ------------------------------------------------------------------ */

export const COLORS = {
  ink: 0x101820,
  inkSoft: 0x18242d,
  night: 0x08111a,
  asphalt: 0x111b23,
  asphaltEdge: 0x1c2932,
  sidewalk: 0x58666d,
  sidewalkDark: 0x3f4b53,
  curb: 0x79848a,
  cream: 0xeee6d4,
  creamWarm: 0xfff1d2,
  paper: 0xf8f0da,
  white: 0xe7eef1,
  teal: 0x246b67,
  tealDeep: 0x174848,
  mint: 0x94ddc4,
  coral: 0xe76c59,
  mustard: 0xe3b354,
  warm: 0xffcf8b,
  warmDeep: 0xff9d55,
  cool: 0xb8dbff,
  glass: 0xbcdcf0,
  steel: 0x87959d,
  darkMetal: 0x26333b,
  wood: 0x4b3730,
  woodDark: 0x2b211f,
  red: 0xdf4d4d,
  green: 0x4fbf8b,
  amber: 0xf0b755,
};

/* Four-step cel ramp. Kept in linear space so the light response is crisp. */
function buildGradientMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  const bands = ['#3b4b5b', '#8192a0', '#d7dde1', '#fff8ea'];
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i, 0, 1, 1);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export const gradientMap = buildGradientMap();

const materialCache = new Map();

export function toon(color, options = {}) {
  const key = `${color}|${options.emissive ?? ''}|${options.emissiveIntensity ?? ''}|${options.transparent ?? ''}|${options.opacity ?? ''}|${options.side ?? ''}`;
  if (!options.unique && materialCache.has(key)) return materialCache.get(key);
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap,
    ...options,
  });
  if (!options.unique) materialCache.set(key, mat);
  return mat;
}

export const MAT = {
  ink: toon(COLORS.ink),
  cream: toon(COLORS.cream),
  creamWarm: toon(COLORS.creamWarm, { emissive: 0x23190d, emissiveIntensity: 0.18 }),
  paper: toon(COLORS.paper),
  white: toon(COLORS.white),
  teal: toon(COLORS.teal),
  tealDeep: toon(COLORS.tealDeep),
  mint: toon(COLORS.mint),
  coral: toon(COLORS.coral),
  mustard: toon(COLORS.mustard),
  warm: toon(COLORS.warm, { emissive: 0x4b2a0b, emissiveIntensity: 0.5 }),
  darkMetal: toon(COLORS.darkMetal),
  steel: toon(COLORS.steel),
  wood: toon(COLORS.wood),
  woodDark: toon(COLORS.woodDark),
};

export const edgeMaterial = new THREE.LineBasicMaterial({
  color: 0x101820,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
});

const hullMaterial = new THREE.MeshBasicMaterial({
  color: 0x0d151c,
  side: THREE.BackSide,
});

export function applyEdges(mesh, threshold = 30) {
  if (!mesh.geometry?.attributes?.position) return null;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, threshold), edgeMaterial);
  edges.renderOrder = 2;
  edges.raycast = () => {};
  mesh.add(edges);
  return edges;
}

export function applyHull(mesh, scale = 1.018) {
  if (mesh.material?.transparent) return null;
  const shell = new THREE.Mesh(mesh.geometry, hullMaterial);
  shell.scale.setScalar(scale);
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.renderOrder = -1;
  mesh.add(shell);
  return shell;
}

const tmpEuler = new THREE.Euler();

export function mesh(geometry, material, opts = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (opts.edge) applyEdges(m, opts.edgeThreshold ?? 30);
  if (opts.hull) applyHull(m, opts.hull === true ? 1.018 : opts.hull);
  m.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  tmpEuler.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0);
  m.rotation.copy(tmpEuler);
  const s = opts.scale;
  if (typeof s === 'number') m.scale.setScalar(s);
  else if (s) m.scale.set(s[0], s[1], s[2]);
  m.castShadow = opts.castShadow ?? false;
  m.receiveShadow = opts.receiveShadow ?? false;
  m.name = opts.name ?? '';
  if (opts.parent) opts.parent.add(m);
  return m;
}

export function box(parent, w, h, d, material, opts = {}) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, {
    ...opts,
    parent,
    edge: opts.edge ?? true,
    castShadow: opts.castShadow ?? true,
    receiveShadow: opts.receiveShadow ?? false,
  });
}

export function sphere(parent, radius, material, opts = {}) {
  return mesh(new THREE.SphereGeometry(radius, opts.segments ?? 16, opts.rings ?? 12), material, {
    ...opts,
    parent,
    edge: opts.edge ?? false,
    castShadow: opts.castShadow ?? true,
  });
}

export function cylinder(parent, rt, rb, h, material, opts = {}) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, opts.segments ?? 16, 1, opts.openEnded ?? false), material, {
    ...opts,
    parent,
    edge: opts.edge ?? true,
    castShadow: opts.castShadow ?? true,
  });
}

export function plane(parent, w, h, material, opts = {}) {
  return mesh(new THREE.PlaneGeometry(w, h, opts.segments ?? 1, opts.segments ?? 1), material, {
    ...opts,
    parent,
    edge: false,
    castShadow: false,
  });
}

export function cylinderBetween(parent, a, b, radius, material, opts = {}) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(opts.taper ? radius * opts.taper : radius, radius, len, opts.segments ?? 8);
  const m = new THREE.Mesh(geo, material);
  m.position.copy(start).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = opts.castShadow ?? true;
  m.receiveShadow = opts.receiveShadow ?? false;
  if (opts.edge) applyEdges(m, 40);
  parent.add(m);
  return m;
}

export function tubeBetween(parent, a, b, radius, material, opts = {}) {
  return cylinderBetween(parent, a, b, radius, material, opts);
}

/* ---------------------------- texture helpers ---------------------------- */

export function canvasTexture(width, height, draw, {
  repeatX = 1,
  repeatY = 1,
  wrapS = THREE.ClampToEdgeWrapping,
  wrapT = THREE.ClampToEdgeWrapping,
  anisotropy = 8,
  colorSpace = THREE.SRGBColorSpace,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = wrapS;
  tex.wrapT = wrapT;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, r, color) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  glowTexture = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.16, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { colorSpace: THREE.SRGBColorSpace });
  return glowTexture;
}

let blobTexture = null;
export function getBlobTexture() {
  if (blobTexture) return blobTexture;
  blobTexture = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.03, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0.58)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { colorSpace: THREE.SRGBColorSpace });
  return blobTexture;
}

export function glowSprite(color = 0xffdd99, size = 2, opacity = 0.5, parent = null) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 8;
  if (parent) parent.add(sprite);
  return sprite;
}

export function contactShadow(parent, w, d, opacity = 0.6, x = 0, z = 0, y = 0.011) {
  const mat = new THREE.MeshBasicMaterial({
    map: getBlobTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    color: 0x000000,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 3;
  parent.add(m);
  return m;
}

export function makeReflectionTexture(baseColor = '#ffd28a', accentColor = '#e66f58') {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(0,0,0,0)');
    bg.addColorStop(0.26, 'rgba(0,0,0,0.18)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.filter = 'blur(7px)';
    const cols = [baseColor, accentColor, '#fff3d2', baseColor, accentColor];
    for (let i = 0; i < 22; i++) {
      const x = 14 + Math.random() * (w - 28);
      const top = 18 + Math.random() * h * 0.25;
      const len = 100 + Math.random() * h * 0.62;
      const cw = 5 + Math.random() * 17;
      const g = ctx.createLinearGradient(0, top, 0, top + len);
      g.addColorStop(0, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.2, cols[i % cols.length]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.12 + Math.random() * 0.24;
      ctx.fillStyle = g;
      ctx.fillRect(x, top, cw, len);
    }
    ctx.globalAlpha = 1;
    ctx.filter = 'blur(16px)';
    const warm = ctx.createLinearGradient(0, 0, w, 0);
    warm.addColorStop(0, 'rgba(255,210,140,0)');
    warm.addColorStop(0.45, 'rgba(255,210,140,0.18)');
    warm.addColorStop(0.6, 'rgba(255,160,115,0.12)');
    warm.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);
  }, { colorSpace: THREE.SRGBColorSpace });
}

export function makeLightCone(color = 0xb9dcff, radius = 3.2, height = 7, opacity = 0.11) {
  const geometry = new THREE.ConeGeometry(radius, height, 28, 1, true);
  geometry.translate(0, -height / 2, 0);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vLocal;
      void main() {
        float h = clamp(1.0 - (vLocal.y / -${height.toFixed(2)}), 0.0, 1.0);
        float edge = smoothstep(0.0, 0.22, 1.0 - abs(normalize(vLocal.xz).x));
        float fade = smoothstep(0.0, 0.16, h) * (1.0 - smoothstep(0.4, 1.0, h));
        gl_FragColor = vec4(uColor, fade * uOpacity);
      }
    `,
  });
  const m = new THREE.Mesh(geometry, material);
  m.renderOrder = 6;
  return m;
}

/* ------------------------------- math / rng ------------------------------ */

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(9142026);

export function randBetween(a, b) {
  return a + (b - a) * rand();
}

export function pick(array) {
  return array[Math.floor(rand() * array.length)];
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function smoothstep(min, max, value) {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

export function catmullRom(points, divisions = 48) {
  return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35).getPoints(divisions);
}

export function addWire(parent, points, { color = 0x131d24, opacity = 0.8, divisions = 48 } = {}) {
  const curve = catmullRom(points, divisions);
  const geo = new THREE.BufferGeometry().setFromPoints(curve);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geo, mat);
  parent.add(line);
  return line;
}

export function toColorString(hex) {
  return `#${new THREE.Color(hex).getHexString()}`;
}
