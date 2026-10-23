import * as THREE from 'three';
import { LAYOUT } from './world.js';
import { canvasTexture } from './utils.js';

/* ------------------------------------------------------------------ *
 *  Rain, drips, splashes, puddle rings and low night mist
 * ------------------------------------------------------------------ */

const RAIN_COUNT = 3600;
const DRIP_COUNT = 96;
const SPLASH_POOL = 150;
const RIPPLES_PER_PUDDLE = 2;

/* Roofs and canopies keep the rain off the little world beneath them. */
const SHELTERS = [
  // the mart, including its south and east canopies
  { x0: -8.15, x1: 4.18, z0: -10.68, z1: 3.96 },
  // the coffee shop and its deep wooden eaves
  { x0: -13.9, x1: -9.22, z0: -10.85, z1: 2.62 },
];

function isSheltered(x, z) {
  for (let i = 0; i < SHELTERS.length; i++) {
    const s = SHELTERS[i];
    if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return true;
  }
  return false;
}

function surfaceHeight(x, z) {
  // south pavement
  if (x >= -13.85 && x <= 5.8 && z >= 1.8 && z <= 5.8) return LAYOUT.WALK_Y;
  // east pavement
  if (x >= 2.5 && x <= 5.8 && z >= -13.85 && z <= 1.8) return LAYOUT.WALK_Y;
  // rear service walk
  if (x >= -13.45 && x <= 2.5 && z >= -13.85 && z <= -10.5) return 0.11;
  // narrow alley
  if (x >= -9.7 && x <= -7.5 && z >= -10.3 && z <= 1.8) return 0.12;
  return LAYOUT.ROAD_Y;
}

function randomGroundPoint() {
  for (let i = 0; i < 18; i++) {
    const x = -13.8 + Math.random() * 27.6;
    const z = -13.8 + Math.random() * 27.6;
    if (!isSheltered(x, z)) return { x, z };
  }
  return { x: -12.8, z: 8.4 };
}

function makeMistTexture() {
  return canvasTexture(
    512,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.filter = 'blur(22px)';
      for (let i = 0; i < 22; i++) {
        const x = w * (0.08 + Math.random() * 0.84);
        const y = h * (0.38 + Math.random() * 0.42);
        const r = 28 + Math.random() * 68;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(205,226,238,0.2)');
        g.addColorStop(0.45, 'rgba(170,198,216,0.09)');
        g.addColorStop(1, 'rgba(150,180,200,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.filter = 'none';
      const fade = ctx.createLinearGradient(0, 0, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(0.32, 'rgba(0,0,0,1)');
      fade.addColorStop(0.78, 'rgba(0,0,0,0.7)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    },
    { colorSpace: THREE.SRGBColorSpace },
  );
}

function createRain() {
  const positions = new Float32Array(RAIN_COUNT * 6);
  const drops = new Array(RAIN_COUNT);

  const reset = (drop, initial = false) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = -13.88 + Math.random() * 27.76;
      const z = -13.88 + Math.random() * 27.76;
      if (isSheltered(x, z)) continue;
      drop.x = x;
      drop.z = z;
      drop.speed = 13 + Math.random() * 7.5;
      drop.length = 0.28 + Math.random() * 0.52;
      drop.y = initial ? Math.random() * 15.5 : 12.5 + Math.random() * 4.5;
      drop.slantX = 0.035 + Math.random() * 0.04;
      drop.slantZ = 0.012 + Math.random() * 0.025;
      drop.wind = 0.2 + Math.random() * 0.26;
      return;
    }
    drop.x = -13.8;
    drop.z = 12.8;
    drop.speed = 16;
    drop.length = 0.4;
    drop.y = initial ? Math.random() * 14 : 14;
    drop.slantX = 0.04;
    drop.slantZ = 0.02;
    drop.wind = 0.2;
  };

  for (let i = 0; i < RAIN_COUNT; i++) {
    const d = {
      x: 0,
      y: 0,
      z: 0,
      speed: 15,
      length: 0.4,
      slantX: 0.04,
      slantZ: 0.02,
      wind: 0.25,
    };
    reset(d, true);
    drops[i] = d;
    const o = i * 6;
    positions[o] = d.x + d.slantX * d.length;
    positions[o + 1] = d.y + d.length;
    positions[o + 2] = d.z + d.slantZ * d.length;
    positions[o + 3] = d.x;
    positions[o + 4] = d.y;
    positions[o + 5] = d.z;
  }

  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);

  const mat = new THREE.LineBasicMaterial({
    color: 0xb5d9e7,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.name = 'night-rain';
  lines.frustumCulled = false;
  lines.renderOrder = 6;

  function update(time, dt) {
    for (let i = 0; i < RAIN_COUNT; i++) {
      const d = drops[i];
      d.y -= d.speed * dt;
      d.x += d.wind * dt;
      d.z += d.wind * 0.24 * dt;
      const floor = surfaceHeight(d.x, d.z);

      if (d.y < floor + 0.015 || d.x > 13.95 || d.z > 13.95) {
        reset(d);
        d.y = 12.5 + Math.random() * 4.2;
      }

      const o = i * 6;
      positions[o] = d.x + d.slantX * d.length;
      positions[o + 1] = d.y + d.length;
      positions[o + 2] = d.z + d.slantZ * d.length;
      positions[o + 3] = d.x;
      positions[o + 4] = d.y;
      positions[o + 5] = d.z;
    }
    attr.needsUpdate = true;
  }

  return { object: lines, update };
}

function createCanopyDrips() {
  const positions = new Float32Array(DRIP_COUNT * 6);
  const drips = new Array(DRIP_COUNT);
  const southX0 = -7.35;
  const southX1 = 2.35;
  const eastZ0 = -10.3;
  const eastZ1 = 1.6;

  for (let i = 0; i < DRIP_COUNT; i++) {
    const onSouth = i % 2 === 0;
    const x = onSouth ? southX0 + Math.random() * (southX1 - southX0) : 4.045;
    const z = onSouth ? 3.9 : eastZ0 + Math.random() * (eastZ1 - eastZ0);
    const y0 = 3.55 + Math.random() * 0.1;
    const floor = surfaceHeight(x, z);
    const speed = 3.6 + Math.random() * 3.1;
    const fall = (y0 - floor) / speed;
    drips[i] = {
      x,
      z,
      y0,
      floor,
      speed,
      fall,
      pause: 0.35 + Math.random() * 2.4,
      phase: Math.random() * 7,
      length: 0.12 + Math.random() * 0.2,
    };
  }

  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);

  const mat = new THREE.LineBasicMaterial({
    color: 0xd2f1fa,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.name = 'canopy-drips';
  lines.frustumCulled = false;
  lines.renderOrder = 7;

  function update(time) {
    for (let i = 0; i < DRIP_COUNT; i++) {
      const d = drips[i];
      const cycle = d.fall + d.pause;
      const local = (time + d.phase) % cycle;
      const o = i * 6;

      if (local <= d.fall) {
        const y = d.y0 - local * d.speed;
        positions[o] = d.x + 0.006;
        positions[o + 1] = y + d.length;
        positions[o + 2] = d.z;
        positions[o + 3] = d.x;
        positions[o + 4] = y;
        positions[o + 5] = d.z;
      } else {
        // parked at the eave, waiting for the next bead to gather
        positions[o] = d.x;
        positions[o + 1] = d.y0;
        positions[o + 2] = d.z;
        positions[o + 3] = d.x;
        positions[o + 4] = d.y0 - 0.018;
        positions[o + 5] = d.z;
      }
    }
    attr.needsUpdate = true;
  }

  return { object: lines, update, drips };
}

function createSplashes() {
  const geo = new THREE.RingGeometry(0.56, 0.96, 18);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xbfe8f4,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, SPLASH_POOL);
  mesh.name = 'rain-splashes';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;

  const pool = new Array(SPLASH_POOL);
  const dummy = new THREE.Object3D();
  const black = new THREE.Color(0x000000);
  const tint = new THREE.Color(0xbfe8f4);

  for (let i = 0; i < SPLASH_POOL; i++) {
    pool[i] = { active: false, x: 0, z: 0, y: 0, age: 0, life: 0.5, size: 0.1 };
    mesh.setColorAt(i, black);
    dummy.position.set(0, -40, 0);
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceColor.needsUpdate = true;

  function spawn(x, z, size = 0.08 + Math.random() * 0.12, force = false) {
    if (!force && isSheltered(x, z)) return;
    for (let i = 0; i < SPLASH_POOL; i++) {
      const s = pool[i];
      if (s.active) continue;
      s.active = true;
      s.x = x;
      s.z = z;
      s.y = surfaceHeight(x, z) + 0.006;
      s.age = 0;
      s.life = 0.38 + Math.random() * 0.22;
      s.size = size;
      return;
    }
  }

  function update(dt) {
    for (let i = 0; i < SPLASH_POOL; i++) {
      const s = pool[i];
      const o = i;
      if (!s.active) {
        dummy.position.set(0, -40, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(o, dummy.matrix);
        mesh.setColorAt(o, black);
        continue;
      }

      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        s.active = false;
        dummy.position.set(0, -40, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(o, dummy.matrix);
        mesh.setColorAt(o, black);
        continue;
      }

      const grow = 0.42 + t * 1.5;
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(s.size * grow, s.size * grow, s.size * grow);
      dummy.updateMatrix();
      mesh.setMatrixAt(o, dummy.matrix);
      const strength = Math.pow(1 - t, 2.2);
      tint.setRGB(0.75 * strength, 0.91 * strength, 0.97 * strength);
      mesh.setColorAt(o, tint);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { object: mesh, spawn, update };
}

function createPuddleRipples(world) {
  const group = new THREE.Group();
  group.name = 'puddle-ripples';
  const geo = new THREE.RingGeometry(0.9, 1, 36);
  const ripples = [];

  for (const p of world.puddles) {
    for (let n = 0; n < RIPPLES_PER_PUDDLE; n++) {
      const mat = new THREE.MeshBasicMaterial({
        color: n === 0 ? 0xc6e8f1 : 0xa9d4e4,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, p.y + 0.006, p.z);
      m.renderOrder = 6;
      group.add(m);
      ripples.push({
        mesh: m,
        mat,
        p,
        phase: Math.random() * 4.2 + n * 1.9,
        duration: 2.8 + Math.random() * 1.7,
        strength: 0.045 + Math.random() * 0.06,
      });
    }
  }

  function update(time) {
    for (const r of ripples) {
      const t = ((time + r.phase) % r.duration) / r.duration;
      const spread = 0.16 + t * 1.07;
      r.mesh.scale.set(r.p.rx * spread, r.p.rz * spread, 1);
      r.mat.opacity = Math.sin(t * Math.PI) * r.strength * (1 - t * 0.35);
    }
  }

  return { object: group, update };
}

function createMist() {
  const tex = makeMistTexture();
  const group = new THREE.Group();
  group.name = 'night-mist';
  const sprites = [];

  const banks = [
    [-6.8, 1.2, 8.8, 14.0, 3.0, 0.055],
    [2.5, 1.0, 11.4, 12.5, 2.5, 0.045],
    [8.8, 1.4, 2.2, 10.5, 2.8, 0.04],
    [-11.6, 1.8, 5.5, 9.0, 2.4, 0.045],
    [10.5, 1.1, 11.0, 9.0, 2.1, 0.035],
    [-2.3, 1.6, -1.0, 10.0, 2.6, 0.03],
  ];

  banks.forEach(([x, y, z, w, h, opacity], idx) => {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xb6cfdd,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(w, h, 1);
    sprite.renderOrder = 4;
    sprite.userData = {
      baseX: x,
      baseZ: z,
      phase: Math.random() * Math.PI * 2,
      speed: 0.035 + Math.random() * 0.045,
      baseOpacity: opacity,
      index: idx,
    };
    group.add(sprite);
    sprites.push(sprite);
  });

  function update(time) {
    for (const s of sprites) {
      const u = s.userData;
      s.position.x = u.baseX + Math.sin(time * u.speed + u.phase) * 1.5;
      s.position.z = u.baseZ + Math.cos(time * u.speed * 0.7 + u.phase) * 0.55;
      s.material.opacity = u.baseOpacity * (0.78 + Math.sin(time * 0.14 + u.phase) * 0.22);
    }
  }

  return { object: group, update };
}

function animateWetSurfaces(world) {
  const glints = [];
  for (const p of world.puddles) {
    if (!p.glint) continue;
    glints.push({
      mesh: p.glint,
      base: p.glint.material.opacity,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.55,
    });
  }

  const waterMat = world.waterMat;
  const baseEnv = waterMat?.envMapIntensity ?? 1.9;

  function update(time) {
    for (let i = 0; i < glints.length; i++) {
      const g = glints[i];
      const wave = 0.5 + 0.5 * Math.sin(time * g.speed + g.phase);
      g.mesh.material.opacity = g.base * (0.68 + wave * 0.58);
      const s = 0.97 + wave * 0.07;
      g.mesh.scale.x = s;
      g.mesh.scale.y = s;
    }
    if (waterMat) {
      waterMat.envMapIntensity = baseEnv + Math.sin(time * 0.33) * 0.12 + Math.sin(time * 0.91 + 1.3) * 0.04;
    }
  }

  return { update };
}

export function createRainEffects(scene, world) {
  const root = new THREE.Group();
  root.name = 'rain-effects';
  scene.add(root);

  const rain = createRain();
  const drips = createCanopyDrips();
  const splashes = createSplashes();
  const ripples = createPuddleRipples(world);
  const mist = createMist();
  const wet = animateWetSurfaces(world);

  root.add(rain.object, drips.object, splashes.object, ripples.object, mist.object);

  let splashBudget = 0;
  let dripSplashBudget = 0;

  function update(time, dt) {
    rain.update(time, dt);
    drips.update(time);
    splashes.update(dt);
    ripples.update(time);
    mist.update(time);
    wet.update(time);

    // impacts on the open street and pavements
    splashBudget += dt * 46;
    while (splashBudget >= 1) {
      splashBudget -= 1;
      const p = randomGroundPoint();
      splashes.spawn(p.x, p.z);
    }

    // small crowns of water where the eaves unload
    dripSplashBudget += dt * 13;
    while (dripSplashBudget >= 1) {
      dripSplashBudget -= 1;
      if (Math.random() < 0.64) {
        splashes.spawn(
          -7.3 + Math.random() * 9.7,
          3.98 + Math.random() * 0.12,
          0.055 + Math.random() * 0.075,
          true,
        );
      } else {
        splashes.spawn(
          4.06 + Math.random() * 0.11,
          -10.25 + Math.random() * 11.8,
          0.055 + Math.random() * 0.075,
          true,
        );
      }
    }
  }

  return { root, update };
}
