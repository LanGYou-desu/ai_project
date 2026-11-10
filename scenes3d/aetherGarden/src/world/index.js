import * as THREE from 'three';
import { createFloatingIsland } from './islands.js';
import { createGarden } from './garden.js';
import { createFlora } from './flora.js';
import { createDynamics } from './dynamics.js';
import { optimizeStaticWorld, optimizeGroupChildren } from './optimize.js';

export function createWorld(scene, materials) {
  const root = new THREE.Group();
  root.name = 'aether-garden-world';
  scene.add(root);

  const islands = {};

  islands.main = createFloatingIsland(materials, {
    name: 'island-main',
    seed: 0x31a7,
    center: [0, 0, 0],
    radius: [9.15, 7.55],
    baseHeight: 0.26,
    rimDrop: 0.2,
    undersideDepth: 8.5,
    segments: 128,
    rings: 30,
    boulders: 22,
    vines: 17,
    spires: 6,
    crystals: 4,
    flats: [
      { x: 0, z: 0, rx: 4.15, rz: 4.05, y: 0.48 },
      { x: 0, z: 4.25, rx: 1.75, rz: 1.55, y: 0.34 },
      { x: -6.35, z: 1.9, rx: 1.38, rz: 1.2, y: 0.4 },
      { x: 6.45, z: 0.15, rx: 1.3, rz: 1.2, y: 0.38 }
    ],
    bumps: [
      { x: -4.8, z: -2.7, r: 2.5, amp: 0.54 },
      { x: 4.7, z: -3.6, r: 2.4, amp: 0.36 },
      { x: -2.6, z: 3.6, r: 1.6, amp: 0.16 }
    ]
  });
  root.add(islands.main.group);

  islands.left = createFloatingIsland(materials, {
    name: 'island-left',
    seed: 0x71c2,
    center: [-13.8, 0.72, 4.45],
    radius: [4.15, 3.35],
    baseHeight: 0.22,
    rimDrop: 0.16,
    undersideDepth: 5.4,
    segments: 88,
    rings: 22,
    boulders: 10,
    vines: 9,
    spires: 3,
    crystals: 3,
    flats: [{ x: 0.15, z: 0.3, rx: 2.35, rz: 2.0, y: 0.4 }],
    bumps: [{ x: -1.3, z: -1.1, r: 1.5, amp: 0.24 }]
  });
  root.add(islands.left.group);

  islands.right = createFloatingIsland(materials, {
    name: 'island-right',
    seed: 0x42e9,
    center: [14.0, 0.44, -2.7],
    radius: [3.75, 3.1],
    baseHeight: 0.22,
    rimDrop: 0.14,
    undersideDepth: 4.9,
    segments: 80,
    rings: 20,
    boulders: 9,
    vines: 8,
    spires: 3,
    crystals: 2,
    flats: [{ x: 0, z: 0, rx: 2.05, rz: 1.8, y: 0.35 }],
    bumps: [{ x: -1.0, z: 1.0, r: 1.25, amp: 0.2 }]
  });
  root.add(islands.right.group);

  islands.shrine = createFloatingIsland(materials, {
    name: 'island-shrine',
    seed: 0x9c1e,
    center: [-5.2, 5.2, -13.8],
    radius: [2.55, 2.05],
    baseHeight: 0.22,
    rimDrop: 0.13,
    undersideDepth: 4.2,
    segments: 64,
    rings: 16,
    boulders: 7,
    vines: 6,
    spires: 2,
    crystals: 2
  });
  root.add(islands.shrine.group);

  const garden = createGarden(materials, islands);
  const flora = createFlora(materials, islands);
  const dynamics = createDynamics(scene, materials, islands, flora);

  // Free-floating rock shards add vertical rhythm and life around the archipelago.
  const shardDefs = [
    { center: [-8.4, 4.9, -6.3], radius: [1.35, 1.1], depth: 2.1, seed: 0x81a1, phase: 0.2, amp: 0.14 },
    { center: [-12.1, 3.4, 9.2], radius: [1.25, 1.0], depth: 2.2, seed: 0x81a4, phase: 3.7, amp: 0.16 },
    { center: [10.8, 6.2, -10.2], radius: [0.8, 0.65], depth: 1.4, seed: 0x81a2, phase: 1.7, amp: 0.16 }
  ];
  const shards = [];
  shardDefs.forEach((def) => {
    const shard = createFloatingIsland(materials, {
      name: 'floating-shard',
      seed: def.seed,
      center: def.center,
      radius: def.radius,
      baseHeight: 0.2,
      rimDrop: 0.08,
      undersideDepth: def.depth,
      segments: 34,
      rings: 9,
      boulders: 1,
      vines: 3,
      spires: 1,
      crystals: 1
    });
    shard.group.userData.noMerge = true;
    shard.group.userData.baseY = def.center[1];
    shard.group.userData.phase = def.phase;
    shard.group.userData.amp = def.amp;
    shard.group.updateMatrixWorld(true);
    shard.optimization = optimizeGroupChildren(shard.group);
    root.add(shard.group);
    shards.push(shard);
  });

  const points = {
    orrery: new THREE.Vector3(0, 4.25, 0),
    falls: garden.points.waterfall.clone().add(new THREE.Vector3(0, -1.2, 0)),
    pavilion: garden.points.pavilion.clone()
  };

  const cameraViews = {
    overview: {
      position: new THREE.Vector3(23.0, 10.8, 32.0),
      target: new THREE.Vector3(-0.3, 2.6, 0.2)
    },
    orrery: {
      position: new THREE.Vector3(9.5, 8.6, 17.5),
      target: new THREE.Vector3(0.0, 2.2, 0.0)
    },
    falls: {
      position: new THREE.Vector3(17.0, 5.2, 22.5),
      target: new THREE.Vector3(2.6, -2.0, 4.2)
    },
    bridge: {
      position: new THREE.Vector3(3.0, 10.0, 14.0),
      target: new THREE.Vector3(10.0, 1.4, 0.0)
    },
    pavilion: {
      position: new THREE.Vector3(-3.0, 14.0, 18.0),
      target: new THREE.Vector3(-9.4, 2.0, 3.5)
    }
  };

  const landmarks = {
    orrery: points.orrery.clone(),
    falls: points.falls.clone(),
    pavilion: points.pavilion.clone()
  };

  const optimization = optimizeStaticWorld(root);

  let waterTime = 0;
  function update(timeHours, elapsed, dt, state) {
    waterTime += dt;
    // Armillary rings turn at subtly different rates.
    garden.dynamic.orrery.rings.forEach((ring, index) => {
      ring.rotation.y += ring.userData.speed * dt;
    });
    const orb = garden.dynamic.orrery.orb;
    orb.rotation.y += dt * 0.24;
    orb.rotation.x = Math.sin(elapsed * 0.32) * 0.12;
    const pulse = 1 + Math.sin(elapsed * 1.6) * 0.08;
    orb.scale.setScalar(pulse);
    garden.dynamic.orrery.orbGlow.material.opacity = 0.035 + state.nightFactor * 0.76;
    garden.dynamic.orrery.light.intensity = state.nightFactor * 16 + Math.sin(elapsed * 1.8) * state.nightFactor * 2;

    // Water shader colors follow the sky.
    for (const mat of garden.dynamic.waterMaterials) {
      mat.uniforms.uTime.value = waterTime;
      mat.uniforms.uNight.value = state.nightFactor;
      mat.uniforms.uSky.value.copy(state.horizonColor);
      mat.uniforms.uSunDir.value.copy(state.sunDirection);
      mat.uniforms.uSunColor.value.copy(state.sunColor);
    }
    for (const mat of garden.dynamic.waterfallMaterials) {
      mat.uniforms.uTime.value = waterTime;
    }
    // Mist drifts and breathes.
    garden.dynamic.mistSprites.forEach((sprite, index) => {
      const u = sprite.userData;
      sprite.position.x = u.baseX + Math.sin(elapsed * u.speed + u.phase) * 0.38;
      sprite.position.y = u.baseY + Math.sin(elapsed * 0.34 + u.phase) * 0.22;
      sprite.material.opacity = (0.13 + index * 0.026) * (0.76 + 0.24 * Math.sin(elapsed * 0.3 + index));
    });
    // Lamps and lanterns.
    garden.dynamic.pointLights.forEach(({ light, baseIntensity }) => {
      light.intensity = baseIntensity * state.nightFactor;
    });
    garden.dynamic.bridgeChimes.forEach((chime, i) => {
      if (!chime) return;
      chime.rotation.z = Math.sin(elapsed * 0.9 + i * 1.7) * 0.1;
      chime.rotation.x = Math.cos(elapsed * 0.7 + i) * 0.06;
    });
    if (garden.dynamic.pavilionChime) garden.dynamic.pavilionChime.rotation.y = Math.sin(elapsed * 0.5) * 0.35;
    if (garden.dynamic.shrineChime) {
      garden.dynamic.shrineChime.rotation.z = Math.sin(elapsed * 0.8 + 2) * 0.11;
      garden.dynamic.shrineChime.rotation.x = Math.cos(elapsed * 0.63) * 0.07;
    }

    shards.forEach((shard, index) => {
      const u = shard.group.userData;
      shard.group.position.y = u.baseY + Math.sin(elapsed * 0.28 + u.phase) * u.amp;
      shard.group.rotation.y = Math.sin(elapsed * 0.07 + u.phase) * 0.035;
    });
    dynamics.update(timeHours, elapsed, dt, state);
  }

  return {
    root, islands, garden, flora, dynamics, shards, points, optimization,
    cameraViews, landmarks, update
  };
}
