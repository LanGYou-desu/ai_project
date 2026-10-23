import * as THREE from 'three';
import { GI_BOUNDS } from '../scene/constants';
import { buildEmitters, specularLights, type RectEmitter } from '../scene/lights';
import type { BakeVolume } from './bake-data';
import { VERT, MAX_LIGHTS } from '../shaders/surface';
import {
  DECAL_FRAG, EMISSIVE_FRAG, METAL_FRAG, PAINT_FRAG, PLASTIC_FRAG, SLIDE_FRAG, TILE_FRAG,
} from '../shaders/materials';

export interface SharedUniforms {
  uTime: THREE.IUniform<number>;
  uWaterY: THREE.IUniform<number>;
  uClipWater: THREE.IUniform<number>;
  uGIReady: THREE.IUniform<number>;
  uGI: THREE.IUniform<THREE.Texture>;
  uGIMin: THREE.IUniform<THREE.Vector3>;
  uGIInvRange: THREE.IUniform<THREE.Vector3>;
  uGIGain: THREE.IUniform<number>;
  uEnvEnabled: THREE.IUniform<number>;
  uEnv: THREE.IUniform<THREE.Texture>;
  uEnvIntensity: THREE.IUniform<number>;
  uLightCount: THREE.IUniform<number>;
  uLightCenter: THREE.IUniform<THREE.Vector3[]>;
  uLightRight: THREE.IUniform<THREE.Vector3[]>;
  uLightUp: THREE.IUniform<THREE.Vector3[]>;
  uLightNormal: THREE.IUniform<THREE.Vector3[]>;
  uLightColor: THREE.IUniform<THREE.Vector3[]>;
}

export interface MaterialLibrary {
  uniforms: SharedUniforms;
  materials: Partial<Record<string, THREE.ShaderMaterial>>;
  setEnvironment(cube: THREE.Texture | null): void;
  setBake(gi: BakeVolume | null): void;
  setClipWater(clip: boolean): void;
  update(dt: number, elapsed: number): void;
  dispose(): void;
}

const LIGHT_VECTOR_SCALE = 0.32;

function makeFallbackGI(): THREE.Data3DTexture {
  const t = new THREE.Data3DTexture(new Uint8Array([20, 26, 24, 255]), 1, 1, 1);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function makeSharedUniforms(gi: BakeVolume | null, env: THREE.Texture | null): SharedUniforms {
  const lights = specularLights(buildEmitters()).slice(0, MAX_LIGHTS);
  const center = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3());
  const right = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(1, 0, 0));
  const up = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, 1, 0));
  const normal = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3(0, 0, 1));
  const color = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3());
  lights.forEach((light, i) => {
    center[i].fromArray(light.center);
    right[i].fromArray(light.right);
    up[i].fromArray(light.up);
    normal[i].fromArray(light.normal);
    color[i].set(light.color[0], light.color[1], light.color[2]).multiplyScalar(light.intensity * LIGHT_VECTOR_SCALE);
  });

  const giMin = new THREE.Vector3().fromArray(gi?.info.min ?? GI_BOUNDS.min);
  const giMax = new THREE.Vector3().fromArray(gi?.info.max ?? GI_BOUNDS.max);
  const range = giMax.clone().sub(giMin);
  const inv = new THREE.Vector3(1 / range.x, 1 / range.y, 1 / range.z);

  return {
    uTime: { value: 0 },
    uWaterY: { value: -0.085 },
    uClipWater: { value: 0 },
    uGIReady: { value: gi ? 1 : 0 },
    uGI: { value: gi?.texture ?? makeFallbackGI() },
    uGIMin: { value: giMin },
    uGIInvRange: { value: inv },
    uGIGain: { value: 3.45 },
    uEnvEnabled: { value: env ? 1 : 0 },
    uEnv: { value: env ?? new THREE.CubeTexture() },
    uEnvIntensity: { value: 0.95 },
    uLightCount: { value: lights.length },
    uLightCenter: { value: center },
    uLightRight: { value: right },
    uLightUp: { value: up },
    uLightNormal: { value: normal },
    uLightColor: { value: color },
  };
}

/* ------------------------------------------------------------------ sign textures */

type Sampler = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function strokeRule(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, width = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

function paintPlant(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.clearRect(0, 0, w, h);
  const rand = (i: number) => {
    const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const baseX = w * 0.5;
  const baseY = h * 0.99;
  const fronds = 12;
  for (let i = 0; i < fronds; i++) {
    const t = i / (fronds - 1);
    const ang = -Math.PI * 0.5 + (t - 0.5) * 2.5 + (rand(i) - 0.5) * 0.3;
    const len = h * (0.5 + 0.4 * rand(i + 20)) * (1.0 - Math.abs(t - 0.5) * 0.34);
    const tipX = baseX + Math.cos(ang) * len;
    const tipY = baseY + Math.sin(ang) * len;
    const cx = baseX + Math.cos(ang) * len * 0.48 - Math.sin(ang) * len * 0.16;
    const cy = baseY + Math.sin(ang) * len * 0.48 + Math.cos(ang) * len * 0.1;
    const shade = 34 + Math.floor(rand(i + 40) * 30);
    ctx.strokeStyle = `rgba(${Math.floor(shade * 0.34)}, ${shade}, ${Math.floor(shade * 0.62)}, 0.95)`;
    ctx.lineCap = 'round';
    ctx.lineWidth = w * 0.0075;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(cx, cy, tipX, tipY);
    ctx.stroke();

    const leaflets = 15;
    for (let j = 1; j <= leaflets; j++) {
      const u = j / (leaflets + 1);
      const omu = 1 - u;
      const px = omu * omu * baseX + 2 * omu * u * cx + u * u * tipX;
      const py = omu * omu * baseY + 2 * omu * u * cy + u * u * tipY;
      let dx = 2 * omu * (cx - baseX) + 2 * u * (tipX - cx);
      let dy = 2 * omu * (cy - baseY) + 2 * u * (tipY - cy);
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const nx = -dy;
      const ny = dx;
      const llen = len * 0.23 * (1.05 - u * 0.55) * (0.7 + 0.55 * rand(i * 31 + j));
      for (const side of [-1, 1]) {
        const ex = px + nx * side * llen * 0.72 + dx * llen * 0.34;
        const ey = py + ny * side * llen * 0.72 + dy * llen * 0.34;
        ctx.lineWidth = w * 0.0068;
        ctx.strokeStyle = `rgba(${Math.floor(shade * 0.3)}, ${Math.floor(shade * 0.92)}, ${Math.floor(shade * 0.58)}, 0.92)`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(
          px + nx * side * llen * 0.26 + dx * llen * 0.12,
          py + ny * side * llen * 0.26 + dy * llen * 0.12,
          ex, ey,
        );
        ctx.stroke();
      }
    }
  }
  // Upright spear leaves fill the centre of the cluster.
  for (let i = 0; i < 7; i++) {
    const x = baseX + (rand(i + 90) - 0.5) * w * 0.18;
    const tipX = x + (rand(i + 95) - 0.5) * w * 0.2;
    const tipY = h * (0.16 + rand(i + 97) * 0.3);
    ctx.strokeStyle = 'rgba(20, 62, 39, 0.9)';
    ctx.lineWidth = w * 0.009;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + (tipX - x) * 0.2, h * 0.5, tipX, tipY);
    ctx.stroke();
  }
}

const DECAL_PAINTERS: Record<string, Sampler> = {
  plant: (ctx, w, h) => paintPlant(ctx, w, h, 7),
  plant2: (ctx, w, h) => paintPlant(ctx, w, h, 23),
  sun: (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.47);
    grad.addColorStop(0, 'rgba(255, 246, 220, 1)');
    grad.addColorStop(0.3, 'rgba(255, 226, 172, 0.88)');
    grad.addColorStop(0.62, 'rgba(255, 196, 126, 0.22)');
    grad.addColorStop(1, 'rgba(255, 180, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.47, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 233, 192, 0.28)';
    ctx.lineWidth = w * 0.004;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.315, 0, Math.PI * 2);
    ctx.stroke();
  },
  'no-diving': (ctx, w, h) => {
    ctx.fillStyle = '#ece7d6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9b2a21';
    ctx.lineWidth = w * 0.025;
    ctx.strokeRect(w * 0.055, h * 0.055, w * 0.89, h * 0.89);
    ctx.strokeStyle = '#6e1d17';
    ctx.lineWidth = w * 0.028;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.14);
    ctx.lineTo(w * 0.85, h * 0.78);
    ctx.lineTo(w * 0.15, h * 0.78);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#79221a';
    ctx.font = `700 ${w * 0.28}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', w * 0.5, h * 0.5);
    ctx.font = `600 ${w * 0.088}px "Courier New", monospace`;
    ctx.letterSpacing = `${w * 0.012}px`;
    ctx.fillText('NO DIVING', w * 0.5, h * 0.865);
  },
  rules: (ctx, w, h) => {
    ctx.fillStyle = '#e9e4d3';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(30,50,43,.35)';
    ctx.lineWidth = 5;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = '#1d3731';
    ctx.textAlign = 'center';
    ctx.font = `600 ${w * 0.072}px "Courier New", monospace`;
    ctx.fillText('BATHHOUSE RULES', w * 0.5, h * 0.135);
    strokeRule(ctx, w * 0.1, w * 0.9, h * 0.185, 'rgba(30,50,43,.4)', 2);
    ctx.textAlign = 'left';
    ctx.font = `400 ${w * 0.045}px "Courier New", monospace`;
    const lines = [
      '01  bathe only in silence',
      '02  no running on the tiles',
      '03  diving is prohibited',
      '04  children must be attended',
      '05  leave the water as you found it',
    ];
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 4 ? 'rgba(30,50,43,.48)' : '#284238';
      ctx.fillText(line, w * 0.11, h * (0.255 + i * 0.085));
    });
    ctx.fillStyle = 'rgba(30,50,43,.38)';
    ctx.textAlign = 'center';
    ctx.font = `400 ${w * 0.034}px "Courier New", monospace`;
    ctx.fillText('STILLWATER BATHS · EST. 1931', w * 0.5, h * 0.865);
    ctx.font = `italic 400 ${w * 0.04}px Georgia, serif`;
    ctx.fillText('the water remembers', w * 0.5, h * 0.93);
  },
  depth: (ctx, w, h) => {
    ctx.fillStyle = 'rgba(16,48,42,.82)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(220,229,213,.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#e3e0cf';
    ctx.textAlign = 'center';
    ctx.font = `600 ${w * 0.16}px "Courier New", monospace`;
    ctx.fillText('2.4 M', w * 0.5, h * 0.52);
    ctx.font = `400 ${w * 0.075}px "Courier New", monospace`;
    ctx.fillText('DEEP WATER', w * 0.5, h * 0.73);
  },
  private: (ctx, w, h) => {
    ctx.fillStyle = '#d3c5a2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4f4535';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.fillStyle = '#423a2d';
    ctx.textAlign = 'center';
    ctx.font = `600 ${w * 0.15}px Georgia, serif`;
    ctx.fillText('PRIVATE', w * 0.5, h * 0.56);
    ctx.font = `400 ${w * 0.06}px "Courier New", monospace`;
    ctx.fillText('MEMBERS ONLY', w * 0.5, h * 0.75);
  },
  exit: (ctx, w, h) => {
    ctx.fillStyle = '#0c462e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(150,255,200,.35)';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#b7ffd6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${w * 0.36}px "Courier New", monospace`;
    ctx.fillText('EXIT', w * 0.5, h * 0.54);
  },
  plaque: (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#b3a37d');
    grad.addColorStop(0.45, '#d8cba8');
    grad.addColorStop(1, '#96845f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6f5e3e';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#382f22';
    ctx.textAlign = 'center';
    ctx.font = `500 ${w * 0.13}px Georgia, serif`;
    ctx.fillText('STILLWATER', w * 0.5, h * 0.36);
    ctx.font = `400 ${w * 0.055}px "Courier New", monospace`;
    ctx.fillText('MUNICIPAL BATHS  ·  MCMXXXI', w * 0.5, h * 0.55);
    strokeRule(ctx, w * 0.27, w * 0.73, h * 0.64, 'rgba(56,47,34,.55)', 3);
    ctx.font = `italic 400 ${w * 0.047}px Georgia, serif`;
    ctx.fillText('aqua memoriae', w * 0.5, h * 0.78);
  },
  clock: (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ddd8c6';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b2723';
    ctx.lineWidth = w * 0.012;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const major = i % 5 === 0;
      const r0 = w * (major ? 0.37 : 0.41);
      const r1 = w * 0.455;
      ctx.lineWidth = major ? w * 0.016 : w * 0.005;
      ctx.beginPath();
      ctx.moveTo(w * 0.5 + Math.sin(a) * r0, h * 0.5 - Math.cos(a) * r0);
      ctx.lineTo(w * 0.5 + Math.sin(a) * r1, h * 0.5 - Math.cos(a) * r1);
      ctx.stroke();
    }
    ctx.fillStyle = '#1b2723';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${w * 0.09}px Georgia, serif`;
    ctx.fillText('VI', w * 0.5, h * 0.16);
    ctx.font = `500 ${w * 0.07}px Georgia, serif`;
    ctx.fillText('STILLWATER', w * 0.5, h * 0.73);
    // 06:42
    const hourA = ((6 + 42 / 60) / 12) * Math.PI * 2;
    const minA = (42 / 60) * Math.PI * 2;
    ctx.strokeStyle = '#131c19';
    ctx.lineCap = 'round';
    ctx.lineWidth = w * 0.03;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.5 + Math.sin(hourA) * w * 0.22, h * 0.5 - Math.cos(hourA) * w * 0.22);
    ctx.stroke();
    ctx.lineWidth = w * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.5);
    ctx.lineTo(w * 0.5 + Math.sin(minA) * w * 0.34, h * 0.5 - Math.cos(minA) * w * 0.34);
    ctx.stroke();
    ctx.fillStyle = '#8f2d24';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, w * 0.018, 0, Math.PI * 2);
    ctx.fill();
  },
  '1931': (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(210,214,196,.82)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${w * 0.38}px Georgia, serif`;
    ctx.fillText('1931', w * 0.5, h * 0.55);
  },
  medallion: (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.5;
    const R = w * 0.47;
    ctx.fillStyle = 'rgba(32, 76, 64, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(226, 200, 144, 0.92)';
    ctx.lineWidth = w * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(226, 213, 178, 0.55)';
    ctx.lineWidth = w * 0.008;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    // Bold eight-point sunburst, legible from across the hall.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.strokeStyle = 'rgba(236, 214, 166, 0.9)';
      ctx.lineWidth = w * 0.034;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * R * 0.34, cy - Math.cos(a) * R * 0.34);
      ctx.lineTo(cx + Math.sin(a) * R * 0.74, cy - Math.cos(a) * R * 0.74);
      ctx.stroke();
      const b = a + Math.PI / 8;
      ctx.strokeStyle = 'rgba(154, 198, 174, 0.55)';
      ctx.lineWidth = w * 0.012;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(b) * R * 0.58, cy - Math.cos(b) * R * 0.58);
      ctx.lineTo(cx + Math.sin(b) * R * 0.74, cy - Math.cos(b) * R * 0.74);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(232, 210, 163, 0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(24, 60, 51, 0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.06, 0, Math.PI * 2);
    ctx.fill();
  },
  motto: (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Dark frieze band with gold lettering, mounted high on the entrance wall.
    ctx.fillStyle = 'rgba(14, 40, 34, 0.94)';
    ctx.fillRect(w * 0.035, h * 0.3, w * 0.93, h * 0.4);
    ctx.strokeStyle = 'rgba(206, 179, 120, 0.8)';
    ctx.lineWidth = w * 0.003;
    ctx.strokeRect(w * 0.035, h * 0.3, w * 0.93, h * 0.4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(232, 209, 160, 0.98)';
    ctx.save();
    ctx.translate(w * 0.5, h * 0.425);
    ctx.scale(0.5, 1);
    ctx.font = `500 ${w * 0.22}px Georgia, serif`;
    ctx.letterSpacing = `${w * 0.02}px`;
    ctx.fillText('STILLWATER', 0, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(196, 205, 181, 0.72)';
    ctx.save();
    ctx.translate(w * 0.5, h * 0.585);
    ctx.scale(0.55, 1);
    ctx.font = `400 ${w * 0.036}px "Courier New", monospace`;
    ctx.letterSpacing = `${w * 0.009}px`;
    ctx.fillText('MUNICIPAL BATHS · MCMXXXI', 0, 0);
    ctx.restore();
  },
};

export function makeDecalTexture(name: string, renderer?: THREE.WebGLRenderer): THREE.Texture {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  (DECAL_PAINTERS[name] ?? DECAL_PAINTERS.plaque)(ctx, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ factory */

export function createMaterialLibrary(options: {
  gi?: BakeVolume | null;
  env?: THREE.Texture | null;
  renderer?: THREE.WebGLRenderer;
} = {}): MaterialLibrary {
  const uniforms = makeSharedUniforms(options.gi ?? null, options.env ?? null);
  const decalCache = new Map<string, THREE.Texture>();

  const shader = (frag: string, extra: Record<string, THREE.IUniform> = {}, side = THREE.FrontSide) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms: { ...uniforms, ...extra },
    side,
    transparent: false,
    depthWrite: true,
  });

  const materials: Partial<Record<string, THREE.ShaderMaterial>> = {
    tile: shader(TILE_FRAG),
    paint: shader(PAINT_FRAG),
    metal: shader(METAL_FRAG),
    plastic: shader(PLASTIC_FRAG),
    slide: shader(SLIDE_FRAG),
    emissive: shader(EMISSIVE_FRAG),
  };

  function setBake(gi: BakeVolume | null) {
    uniforms.uGIReady.value = gi ? 1 : 0;
    uniforms.uGI.value = gi?.texture ?? makeFallbackGI();
    if (gi) {
      uniforms.uGIMin.value.fromArray(gi.info.min);
      const range = new THREE.Vector3().fromArray(gi.info.max).sub(uniforms.uGIMin.value);
      uniforms.uGIInvRange.value.set(1 / range.x, 1 / range.y, 1 / range.z);
    }
  }

  function decal(index: number, tex: string, emissive: number): THREE.ShaderMaterial {
    let texture = decalCache.get(tex);
    if (!texture) {
      texture = makeDecalTexture(tex, options.renderer);
      decalCache.set(tex, texture);
    }
    const m = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: DECAL_FRAG,
      uniforms: {
        ...uniforms,
        tDecal: { value: texture },
        uDecalEmissive: { value: emissive },
        uDecalTint: { value: new THREE.Vector3(1, 1, 1) },
      },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    (m.userData as { decalIndex?: number }).decalIndex = index;
    return m;
  }

  let decalCounter = 0;

  return {
    uniforms,
    materials,
    setEnvironment(cube) {
      uniforms.uEnv.value = cube ?? new THREE.CubeTexture();
      uniforms.uEnvEnabled.value = cube ? 1 : 0;
    },
    setBake,
    setClipWater(clip) {
      uniforms.uClipWater.value = clip ? 1 : 0;
    },
    update(_dt, elapsed) {
      uniforms.uTime.value = elapsed;
    },
    dispose() {
      Object.values(materials).forEach((m) => m?.dispose());
      decalCache.forEach((t) => t.dispose());
    },
  };
}

export function applyWorldMaterials(root: THREE.Object3D, lib: MaterialLibrary): void {
  let decalIndex = 0;
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const meta = obj.userData.surface as { kind?: string } | undefined;
    if (!meta?.kind) return;
    if (meta.kind === 'decal') {
      const decal = obj.userData.decal as { texture: string; emissive: number } | undefined;
      if (!decal) return;
      const material = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: DECAL_FRAG,
        uniforms: {
          ...lib.uniforms,
          tDecal: { value: makeDecalTexture(decal.texture) },
          uDecalEmissive: { value: decal.emissive },
          uDecalTint: { value: new THREE.Vector3(1, 1, 1) },
        },
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      (material.userData as { decalIndex?: number }).decalIndex = decalIndex++;
      obj.renderOrder = 3 + decalIndex;
      obj.material = material;
      return;
    }
    const material = lib.materials[meta.kind];
    if (material) obj.material = material;
  });
}
