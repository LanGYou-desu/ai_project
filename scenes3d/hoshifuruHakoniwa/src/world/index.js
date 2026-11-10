import * as THREE from 'three';
import { createTextures } from '../textures.js';
import { createMaterials } from '../materials.js';
import { createTerrain } from './terrain.js';
import { createNature } from './nature.js';
import {
  createHouse,
  createClockTower,
  createWindmill,
  createWatermill,
  createObservatory,
  createLighthouse,
  createFountain
} from './buildings.js';
import { createProps } from './props.js';
import { createEffects } from './effects.js';
import { optimizeStaticWorld } from './optimize.js';
import { addBox, mulberry32, clamp } from '../utils.js';

export function createWorld() {
  const textures = createTextures();
  const materials = createMaterials(textures);
  const root = new THREE.Group();
  root.name = 'hoshifuru-hakoniwa';
  const terrain = createTerrain(materials);
  root.add(terrain.group);

  const avoid = [];
  const smokeAnchors = [];
  const chimneyBag = { smokeAnchors };

  function place(group, x, z, rotation = 0, footprint = 4.2, options = {}) {
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const half = footprint * 0.5;
    const corners = [
      [0, 0], [half, half], [-half, half], [half, -half], [-half, -half]
    ].map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
    let maxH = -Infinity;
    let minH = Infinity;
    corners.forEach(([px, pz]) => {
      const h = terrain.heightAt(px, pz);
      maxH = Math.max(maxH, h);
      minH = Math.min(minH, h);
    });
    const centerY = options.flat ? terrain.heightAt(x, z) : maxH - 0.03;
    if (!options.noTerrace && maxH - minH > 0.55) {
      const base = addBox(
        root,
        options.baseW || footprint + 0.6,
        maxH - minH + 0.85,
        options.baseD || footprint + 0.6,
        materials.stone,
        x,
        centerY - (maxH - minH + 0.85) / 2 + 0.02,
        z,
        0.08
      );
      base.rotation.y = rotation;
      base.castShadow = true;
      base.receiveShadow = true;
      const trim = addBox(
        root,
        (options.baseW || footprint + 0.6) + 0.1,
        0.12,
        (options.baseD || footprint + 0.6) + 0.1,
        materials.stoneLight,
        x,
        centerY + 0.065,
        z,
        0.03
      );
      trim.rotation.y = rotation;
    }
    group.position.set(x, centerY, z);
    group.rotation.y = rotation;
    root.add(group);
    avoid.push({ x, z, r: footprint * 0.62 + 0.55 });
    return centerY;
  }

  const landmarkPositions = {};

  // The clock tower anchors the main square.
  const clockTower = createClockTower(materials);
  const clockY = place(clockTower, -5.3, 0.1, 0, 3.3, { flat: true, noTerrace: true });
  landmarkPositions.clock = new THREE.Vector3(-5.3, clockY + 10.4, 0.1);

  const fountain = createFountain(materials);
  const fountainY = terrain.heightAt(-3.45, 2.8) + 0.03;
  fountain.group.userData.noMerge = true;
  fountain.group.position.set(-3.45, fountainY, 2.8);
  root.add(fountain.group);

  // A row of varied shophouses and homes frames the square.
  const inn = createHouse(materials, {
    width: 4.2,
    depth: 3.5,
    floors: 3,
    floorHeight: 1.32,
    wallMat: materials.walls.cream,
    roofMat: materials.roofs.teal,
    ridgeAxis: 'x',
    roofRise: 1.85,
    balcony: true,
    timber: true,
    hangingSign: '旅店',
    seed: 11
  }, chimneyBag);
  place(inn, -10.45, 1.8, Math.PI / 2, 5.1);

  const flowerShop = createHouse(materials, {
    width: 3.15,
    depth: 2.7,
    floors: 2,
    wallMat: materials.walls.rose,
    roofMat: materials.roofs.moss,
    ridgeAxis: 'x',
    roofRise: 1.25,
    shop: true,
    shopName: '花间',
    awning: 'teal',
    timber: true,
    hangingSign: '花屋',
    seed: 12
  }, chimneyBag);
  place(flowerShop, 2.55, 1.2, -Math.PI / 2, 4.0);

  const guildhall = createHouse(materials, {
    width: 4.55,
    depth: 3.35,
    floors: 2,
    floorHeight: 1.45,
    wallMat: materials.walls.ivory,
    roofMat: materials.roofs.slate,
    ridgeAxis: 'x',
    roofRise: 1.6,
    balcony: true,
    turret: true,
    timber: true,
    hangingSign: '港町公会堂',
    seed: 13
  }, chimneyBag);
  place(guildhall, 6.35, 1.55, -Math.PI / 2, 5.4);

  const harborHouse = createHouse(materials, {
    width: 3.65,
    depth: 2.55,
    floors: 2,
    wallMat: materials.walls.blue,
    roofMat: materials.roofs.terracotta,
    ridgeAxis: 'x',
    roofRise: 1.2,
    shop: true,
    shopName: '海风杂货',
    awning: 'gold',
    timber: true,
    weatherVane: true,
    seed: 14
  }, chimneyBag);
  place(harborHouse, 10.8, 1.9, 0, 4.2);

  const upperCottage = createHouse(materials, {
    width: 3.6,
    depth: 2.85,
    floors: 2,
    floorHeight: 1.34,
    wallMat: materials.walls.peach,
    roofMat: materials.roofs.plum,
    ridgeAxis: 'x',
    roofRise: 1.35,
    turret: true,
    balcony: true,
    timber: true,
    seed: 15
  }, chimneyBag);
  place(upperCottage, 4.8, -3.2, 0, 4.4);

  const hillBakery = createHouse(materials, {
    width: 3.75,
    depth: 2.55,
    floors: 2,
    wallMat: materials.walls.butter,
    roofMat: materials.roofs.rust,
    ridgeAxis: 'x',
    roofRise: 1.25,
    shop: true,
    shopName: '麦香面包',
    awning: 'cream',
    timber: true,
    weatherVane: true,
    seed: 16
  }, chimneyBag);
  place(hillBakery, -3.65, -6.15, 0.08, 4.5);

  const forestCabin = createHouse(materials, {
    width: 3.0,
    depth: 2.35,
    floors: 1,
    floorHeight: 1.38,
    wallMat: materials.walls.clay,
    roofMat: materials.roofs.ochre,
    ridgeAxis: 'x',
    roofRise: 1.25,
    balcony: false,
    timber: true,
    chimney: true,
    hangingSign: '林间茶室',
    seed: 17
  }, chimneyBag);
  place(forestCabin, 1.2, -5.8, -0.15, 3.8);

  const westCottage = createHouse(materials, {
    width: 3.35,
    depth: 2.7,
    floors: 2,
    floorHeight: 1.24,
    wallMat: materials.walls.sage,
    roofMat: materials.roofs.moss,
    ridgeAxis: 'z',
    roofRise: 1.3,
    balcony: true,
    timber: true,
    seed: 18
  }, chimneyBag);
  place(westCottage, -13.3, -2.2, Math.PI / 2, 4.2);

  const teaHouse = createHouse(materials, {
    width: 3.45,
    depth: 2.35,
    floors: 1,
    floorHeight: 1.45,
    wallMat: materials.walls.ivory,
    roofMat: materials.roofs.teal,
    ridgeAxis: 'x',
    roofRise: 1.35,
    shop: true,
    shopName: '潮见茶屋',
    awning: 'cream',
    balcony: false,
    weatherVane: true,
    seed: 19
  }, chimneyBag);
  place(teaHouse, -12.45, 5.65, Math.PI, 4.2, { flat: false });

  const watermill = createWatermill(materials, chimneyBag);
  place(watermill, -1.2, -1.8, 0, 3.7, { flat: false, noTerrace: true });
  watermill.userData.wheelRoot = watermill.userData.wheel ? watermill.userData.wheel.parent : null;

  const windmill = createWindmill(materials);
  const windmillY = place(windmill, -11.45, -4.8, 0.35, 4.3, { flat: true, noTerrace: true });
  landmarkPositions.windmill = new THREE.Vector3(-11.45, windmillY + 6.3, -4.8);

  const observatory = createObservatory(materials);
  const observatoryY = place(observatory, 9.55, -5.75, 0.15, 4.4, { flat: true, noTerrace: true });
  landmarkPositions.observatory = new THREE.Vector3(9.55, observatoryY + 4.9, -5.75);

  const lighthouse = createLighthouse(materials);
  lighthouse.position.set(14.15, 0.22, 8.2);
  lighthouse.rotation.y = -0.25;
  root.add(lighthouse);
  landmarkPositions.lighthouse = new THREE.Vector3(14.15, 6.8, 8.2);
  avoid.push({ x: 14.15, z: 8.2, r: 2.4 });

  // A few carefully placed display trees frame the composition.
  // Additional vegetation is generated around the buildings.
  const occupied = avoid.concat([
    { x: -3.45, z: 2.8, r: 2.0 },
    { x: 0.8, z: 3.85, r: 2.4 },
    { x: 9.0, z: 6.78, r: 2.2 },
    { x: 13.15, z: 4.25, r: 1.4 },
    { x: 7.45, z: -6.55, r: 1.4 },
    { x: 11.2, z: 3.25, r: 1.2 },
    { x: -6.0, z: 3.45, r: 1.2 },
    { x: 13.1, z: -3.9, r: 2.4 }
  ]);
  const nature = createNature(materials, terrain, occupied);
  root.add(nature.group);

  const props = createProps(materials, terrain);
  root.add(props.group);

  // Collect smoke emitter positions after all buildings exist in world space.
  root.updateMatrixWorld(true);
  const worldSmokeAnchors = smokeAnchors.map((anchor) => {
    const v = new THREE.Vector3();
    anchor.getWorldPosition(v);
    return v;
  });
  const effects = createEffects(materials, worldSmokeAnchors);
  effects.group.userData.noMerge = true;
  root.add(effects.group);

  const optimization = optimizeStaticWorld(root);

  const cameraViews = {
    overview: { position: new THREE.Vector3(35, 32.5, 45), target: new THREE.Vector3(-0.4, 0.7, 0.2) },
    plaza: { position: new THREE.Vector3(-2.4, 9.1, 17.0), target: new THREE.Vector3(-4.4, 3.2, 1.4) },
    harbor: { position: new THREE.Vector3(21.5, 10.6, 22.0), target: new THREE.Vector3(10.0, 2.5, 6.2) },
    hill: { position: new THREE.Vector3(-21.5, 15.2, 13.6), target: new THREE.Vector3(-8.2, 4.5, -2.7) }
  };

  function update(dt, elapsed, state) {
    terrain.update(dt, elapsed, state);
    nature.update(dt, elapsed);
    props.update(dt, elapsed, state);
    effects.update(dt, elapsed, state);
    fountain.update(dt, elapsed, state.nightFactor);
    // windmill
    if (windmill.userData.rotor) windmill.userData.rotor.rotation.z -= dt * 0.42;
    // water wheel
    if (watermill.userData.wheel) watermill.userData.wheel.rotation.x += dt * 0.85;
    // lighthouse
    const beam = lighthouse.userData.beam;
    if (beam) beam.rotation.y += dt * 0.45;
    if (lighthouse.userData.beamMaterial) lighthouse.userData.beamMaterial.uniforms.uOpacity.value = state.nightFactor * 0.11;
    if (lighthouse.userData.light) lighthouse.userData.light.intensity = state.nightFactor * 9;
    // clock hands
    const hours = state.timeHours || 0;
    const minute = (hours % 1) * 60;
    const hourAngle = -((hours % 12) + minute / 60) / 12 * Math.PI * 2;
    const minuteAngle = -(minute / 60) * Math.PI * 2;
    clockTower.userData.clockHands.forEach((hands) => {
      hands.hour.rotation.z = hourAngle;
      hands.minute.rotation.z = minuteAngle;
    });
  }

  return {
    root,
    materials,
    textures,
    terrain,
    props,
    nature,
    effects,
    watermill,
    windmill,
    lighthouse,
    observatory,
    fountain,
    clockTower,
    landmarks: landmarkPositions,
    cameraViews,
    optimization,
    update
  };
}
