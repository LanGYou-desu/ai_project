import * as THREE from 'three';
import {
  addBox, addMesh, group, mulberry32, TAU, clamp, lerp
} from '../core/utils.js';
import {
  createPoolMaterial, createWaterfallMaterial, createStillWaterDisc,
  createWaterfallCurtain, buildRibbonGeometry
} from './water.js';
import {
  createStoneLantern, createMoonGate, createOrrery,
  createPavilion, createBellShrine, createRopeBridge, createHangingLantern, createMiniTorii
} from './architecture.js';

function samplePath(points2D, island, lift = 0.045, samples = 56) {
  const control = points2D.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(control, false, 'catmullrom', 0.24);
  const result = [];
  for (let i = 0; i < samples; i++) {
    const p = curve.getPoint(i / (samples - 1));
    p.y = island.heightAtLocal(p.x, p.z) + lift;
    result.push(p);
  }
  return result;
}

function addPath(island, points2D, width, material, options = {}) {
  const points = samplePath(points2D, island, options.lift ?? 0.045);
  const geometry = buildRibbonGeometry(points, null, { width });
  const uv = geometry.attributes.uv;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * Math.max(1, length / 1.5));
  uv.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  island.group.add(mesh);
  return mesh;
}

function addLantern(parent, materials, x, y, z, scale = 1, glow = true) {
  const lantern = createStoneLantern(materials, { scale, glow });
  lantern.position.set(x, y, z);
  parent.add(lantern);
  return lantern;
}

function addPointLight(parent, color, intensity, distance, x, y, z) {
  const light = new THREE.PointLight(color, 0, distance, 2);
  light.position.set(x, y, z);
  light.castShadow = false;
  parent.add(light);
  return { light, baseIntensity: intensity };
}

function createLily(materials, x, z, scale, rotation, withFlower) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.28 * scale, 14, 0.2, Math.PI * 1.82), materials.leafJade);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.004;
  g.add(pad);
  if (withFlower) {
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 6, 4), materials.blossomPale);
      const a = (i / 5) * TAU;
      petal.scale.set(0.55, 1, 0.3);
      petal.position.set(Math.cos(a) * 0.09 * scale, 0.025 * scale, Math.sin(a) * 0.09 * scale);
      petal.rotation.z = Math.cos(a) * 0.5;
      petal.rotation.x = -Math.sin(a) * 0.5;
      g.add(petal);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  return g;
}

export function createGarden(materials, islands) {
  const main = islands.main;
  const left = islands.left;
  const right = islands.right;
  const shrine = islands.shrine;
  const rng = mulberry32(0x51a7d);

  const dynamic = {
    waterMaterials: [],
    waterfallMaterials: [],
    mistSprites: [],
    orrery: null,
    pointLights: [],
    bridgeChimes: [],
    pavilionChime: null,
    shrineChime: null
  };

  const courtY = main.heightAtLocal(0, 0);
  const terraceY = courtY + 0.012;

  // Circular paved observatory court.
  const courtyard = new THREE.Mesh(new THREE.CircleGeometry(3.9, 96), materials.paving);
  courtyard.rotation.x = -Math.PI / 2;
  courtyard.position.y = terraceY;
  courtyard.receiveShadow = true;
  main.group.add(courtyard);
  const inlay = new THREE.Mesh(new THREE.TorusGeometry(3.56, 0.022, 4, 120), materials.brassDark);
  inlay.rotation.x = Math.PI / 2;
  inlay.position.y = terraceY + 0.014;
  main.group.add(inlay);
  // A handful of stone plates break the perfect circle at the edge.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + rng() * 0.08;
    const rr = 3.9 + rng() * 0.25;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.45 + rng() * 0.35, 0.08, 0.3 + rng() * 0.3), i % 3 ? materials.paving : materials.stoneMoss);
    plate.position.set(Math.cos(a) * rr, terraceY - 0.03, Math.sin(a) * rr);
    plate.rotation.y = a + (rng() - 0.5) * 0.5;
    plate.receiveShadow = true;
    main.group.add(plate);
  }

  // Pool basin and reflective water.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.64, 0.2, 72), materials.stoneMoss);
  basin.position.y = courtY + 0.04;
  basin.receiveShadow = true;
  main.group.add(basin);
  const innerBasin = new THREE.Mesh(new THREE.CylinderGeometry(2.36, 2.36, 0.18, 72), materials.stoneDark);
  innerBasin.position.y = courtY + 0.12;
  main.group.add(innerBasin);
  const poolMaterial = createPoolMaterial({ deep: '#1f5460', shallow: '#65aa9c', sky: '#d9e9df', opacity: 0.9 });
  dynamic.waterMaterials.push(poolMaterial);
  const pool = createStillWaterDisc(2.4, poolMaterial, { position: [0, courtY + 0.235, 0], segments: 96 });
  main.group.add(pool);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.51, 0.13, 8, 96), materials.stonePale);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = courtY + 0.24;
  rim.castShadow = true;
  rim.receiveShadow = true;
  main.group.add(rim);
  // A brass waterline detail.
  const waterLine = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.022, 4, 96), materials.brassDark);
  waterLine.rotation.x = Math.PI / 2;
  waterLine.position.y = courtY + 0.245;
  main.group.add(waterLine);

  // Observatory dais and golden orrery at the exact center.
  dynamic.orrery = createOrrery(materials, { position: [0, courtY + 0.25, 0] });
  main.group.add(dynamic.orrery.group);

  // Stepping stones crossing the pool's southern rim to the orrery.
  for (let i = 0; i < 4; i++) {
    const z = 2.15 - i * 0.32;
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.018, 0.25, 0.055, 7), materials.stoneWarm);
    stone.position.set(Math.sin(i * 0.65) * 0.05, courtY + 0.27, z);
    main.group.add(stone);
  }

  // Lily pads and three small lotus blooms.
  for (let i = 0; i < 8; i++) {
    const a = rng() * TAU;
    const rad = 1.0 + rng() * 1.15;
    const lily = createLily(materials, Math.cos(a) * rad, Math.sin(a) * rad, 0.8 + rng() * 0.5, rng() * TAU, i < 3);
    lily.position.y = courtY + 0.26;
    main.group.add(lily);
  }

  // Main paths.
  const southPath = addPath(main, [[0, 3.0], [0, 3.8], [0, 4.65], [0, 5.25]], 1.06, materials.paving);
  const westPath = addPath(main, [[-2.7, 1.55], [-4.5, 1.8], [-6.1, 1.9], [-7.6, 2.1]], 0.92, materials.paving);
  const eastPath = addPath(main, [[2.8, 0.45], [4.7, 0.2], [6.1, -0.05], [7.35, -0.22]], 0.92, materials.paving);
  const northPath = addPath(main, [[0, -2.8], [0.4, -4.2], [0.9, -5.4]], 0.8, materials.paving);

  // Moon Gate sits across the west approach, framing the bridge and the pavilion.
  const gateX = -4.15;
  const gateZ = 1.78;
  const gateGround = main.heightAtLocal(gateX, gateZ);
  const gate = createMoonGate(materials, { radius: 1.68, position: [gateX, gateGround + 0.02, gateZ] });
  gate.rotation.y = Math.PI / 2;
  main.group.add(gate);
  // The south path ends in a small crescent overlook above the clouds.
  const overlookY = main.heightAtLocal(0, 5.62);
  const overlook = new THREE.Mesh(new THREE.CircleGeometry(1.28, 48, Math.PI * 0.05, Math.PI * 0.9), materials.paving);
  overlook.rotation.x = -Math.PI / 2;
  overlook.rotation.z = Math.PI;
  overlook.position.set(0, overlookY + 0.025, 5.62);
  overlook.receiveShadow = true;
  main.group.add(overlook);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (0.15 + i * 0.28);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.82, 0.16), materials.stonePale);
    post.position.set(Math.cos(a) * 1.34, overlookY + 0.38, 5.62 + Math.sin(a) * 0.7);
    post.castShadow = true;
    main.group.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), materials.brassDark);
    cap.position.set(post.position.x, overlookY + 0.84, post.position.z);
    main.group.add(cap);
  }

  // A side rill leaves the pool and becomes the Cloudfall at the island lip.
  const rillPoints2D = [[2.15, 1.28], [2.72, 2.05], [3.05, 3.05], [3.38, 4.2], [3.65, 5.33], [3.87, 6.25], [3.94, 6.82]];
  const rillPoints = samplePath(rillPoints2D, main, 0.055, 64);
  // Lift the first section to meet the pool waterline.
  for (let i = 0; i < 12; i++) rillPoints[i].y = Math.max(rillPoints[i].y, courtY + 0.235 - i * 0.008);
  const rillMat = createPoolMaterial({ deep: '#2f6b68', shallow: '#8ec6b4', sky: '#dce9dc', opacity: 0.82 });
  dynamic.waterMaterials.push(rillMat);
  const rillGeo = buildRibbonGeometry(rillPoints, null, { width: 0.56 });
  const rill = new THREE.Mesh(rillGeo, rillMat);
  rill.renderOrder = 2;
  main.group.add(rill);
  // Wet stone banks around the rill.
  for (let i = 2; i < rillPoints.length - 3; i += 2) {
    const p = rillPoints[i];
    const prev = rillPoints[i - 1];
    const next = rillPoints[i + 1];
    const tan = new THREE.Vector3().subVectors(next, prev).normalize();
    for (const side of [-1, 1]) {
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11 + rng() * 0.08, 0), i % 4 ? materials.stoneMoss : materials.stoneWarm);
      stone.position.set(p.x + tan.z * 0.3 * side, p.y + 0.015, p.z - tan.x * 0.3 * side);
      stone.scale.set(1.4, 0.55, 0.8);
      stone.rotation.set(rng(), rng() * TAU, rng());
      stone.receiveShadow = true;
      main.group.add(stone);
    }
  }
  // A stone spout at the lip.
  const spout = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.85), materials.stoneWarm);
  spout.position.set(3.92, rillPoints[rillPoints.length - 1].y - 0.1, 6.82);
  spout.rotation.x = -0.08;
  main.group.add(spout);

  // The waterfall is a curved, animated water curtain falling into cloud.
  const fallStart = new THREE.Vector3(3.92, rillPoints[rillPoints.length - 1].y + 0.01, 6.82);
  const fallPoints = [
    fallStart,
    new THREE.Vector3(4.05, fallStart.y - 0.7, 7.08),
    new THREE.Vector3(4.0, fallStart.y - 2.0, 7.26),
    new THREE.Vector3(4.3, fallStart.y - 3.5, 7.38),
    new THREE.Vector3(4.05, fallStart.y - 5.4, 7.22),
    new THREE.Vector3(4.0, fallStart.y - 6.6, 7.0)
  ];
  const fallMat = createWaterfallMaterial(materials.textures.waterfall);
  fallMat.uniforms.uOpacity.value = 1.0;
  dynamic.waterfallMaterials.push(fallMat);
  const fall = createWaterfallCurtain(fallPoints, [1.3, 1.55, 1.95, 2.35, 2.95, 3.5], fallMat);
  main.group.add(fall);

  // Waterfall mist and spray.
  for (let i = 0; i < 7; i++) {
    const mat = materials.mist.clone();
    mat.opacity = 0.12 + i * 0.027;
    mat.color = new THREE.Color('#e5f4ed');
    const sprite = new THREE.Sprite(mat);
    const s = 2.4 + i * 1.05;
    sprite.scale.set(s * 1.8, s, 1);
    sprite.position.set(4.0 + (rng() - 0.5) * 1.2, fallStart.y - 4.7 - i * 0.5, 7.3 + (rng() - 0.5) * 0.8);
    sprite.userData = { baseX: sprite.position.x, baseY: sprite.position.y, baseZ: sprite.position.z, phase: rng() * TAU, speed: 0.2 + rng() * 0.2 };
    main.group.add(sprite);
    dynamic.mistSprites.push(sprite);
  }

  // Stone lanterns and warm garden lights.
  const lanternPositions = [
    [-3.55, 2.5, 1.0], [3.75, 3.4, 0.9], [-3.65, -2.8, 0.9], [2.2, 5.0, 0.82], [-2.6, 5.0, 0.82]
  ];
  lanternPositions.forEach(([x, z, s]) => {
    const y = main.heightAtLocal(x, z);
    addLantern(main.group, materials, x, y + 0.02, z, s, true);
  });
  const gateY = gateGround + 0.02;
  const gateLight = addPointLight(main.group, '#ffd18b', 28, 10, gateX, gateY + 1.05, gateZ);
  dynamic.pointLights.push(gateLight);
  const courtLight = addPointLight(main.group, '#ffdc9f', 36, 13, 0, courtY + 2.2, 0);
  dynamic.pointLights.push(courtLight);

  // Bench on the north path.
  const benchY = main.heightAtLocal(0.7, -4.6);
  const bench = new THREE.Group();
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.11, 0.46), materials.woodLight);
  benchTop.position.y = 0.52;
  bench.add(benchTop);
  const benchBack = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.34, 0.09), materials.wood);
  benchBack.position.set(0, 0.78, 0.2);
  bench.add(benchBack);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.4), materials.stoneMoss);
    leg.position.set(s * 0.55, 0.25, 0);
    bench.add(leg);
  }
  bench.position.set(0.7, benchY, -4.6);
  bench.rotation.y = 0.5;
  main.group.add(bench);

  // Bridge landings and paths on the main island.
  const westLandingX = -7.55, westLandingZ = 2.12;
  const eastLandingX = 7.35, eastLandingZ = -0.2;
  const westY = main.heightAtWorld(westLandingX, westLandingZ);
  const eastY = main.heightAtWorld(eastLandingX, eastLandingZ);
  for (const [x, z, y] of [[westLandingX, westLandingZ, westY], [eastLandingX, eastLandingZ, eastY]]) {
    const landing = new THREE.Group();
    const circle = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.04, 0.16, 16), materials.stoneMoss);
    circle.position.y = 0.08;
    circle.receiveShadow = true;
    landing.add(circle);
    landing.position.set(x, y - 0.04, z);
    main.group.add(landing);
  }

  // Left island: wind pavilion and small stone path.
  const pavilion = createPavilion(materials, { radius: 1.95 });
  const pavilionLocal = new THREE.Vector3(0.1, 0.42, 0.3);
  pavilion.position.copy(pavilionLocal);
  left.group.add(pavilion);
  dynamic.pavilionChime = pavilion.userData.windChime;
  const pavilionLight = addPointLight(left.group, '#ffd59a', 10, 9, 0.0, 1.45, 0.2);
  dynamic.pointLights.push(pavilionLight);
  addPath(left, [[3.3, -0.9], [2.2, -0.4], [1.2, 0.05]], 0.8, materials.paving, { lift: 0.035 });
  addLantern(left.group, materials, 2.55, left.heightAtLocal(2.55, -0.55) + 0.02, -0.55, 0.8, true);
  // A small maple sapling and rock cluster are handled by flora; a small tea stool here.
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.42, 8), materials.stonePale);
  stool.position.set(-1.6, left.heightAtLocal(-1.6, 1.2) + 0.21, 1.2);
  stool.castShadow = true;
  left.group.add(stool);

  // Right island: bell shrine and steps.
  const shrineGroup = createBellShrine(materials);
  shrineGroup.position.set(0.0, 0.35, 0.0);
  right.group.add(shrineGroup);
  dynamic.shrineChime = shrineGroup.userData.windChime;
  addPath(right, [[3.4, -1.4], [2.1, -0.7], [0.9, -0.15]], 0.76, materials.paving, { lift: 0.04 });
  addLantern(right.group, materials, 2.0, right.heightAtLocal(2.0, 1.1) + 0.02, 1.1, 0.82, true);
  const shrineLight = addPointLight(right.group, '#ffcd8c', 8, 8, 0, 1.6, 0);
  dynamic.pointLights.push(shrineLight);

  // Lonely shrine islet with a tiny lacquered gate and a stone marker.
  const shrineY = shrine.heightAtLocal(0, 0);
  addLantern(shrine.group, materials, 0.65, shrine.heightAtLocal(0.65, 0.65) + 0.02, 0.65, 0.8, true);
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.22), materials.stoneMoss);
  marker.position.set(-1.0, shrine.heightAtLocal(-1.0, -0.35) + 0.58, -0.35);
  marker.rotation.y = 0.4;
  marker.castShadow = true;
  shrine.group.add(marker);
  const torii = createMiniTorii(materials, { scale: 1.0 });
  torii.position.set(0.1, shrine.heightAtLocal(0.1, 1.05) + 0.02, 1.05);
  shrine.group.add(torii);

  // Rope bridges between main and satellites.
  const leftEnd = new THREE.Vector3(-10.7, left.heightAtWorld(-10.7, 3.55) + 0.17, 3.55);
  const mainWestEnd = new THREE.Vector3(westLandingX, westY + 0.17, westLandingZ);
  const westBridge = createRopeBridge(materials, mainWestEnd, leftEnd, { sag: 0.5, planks: 20, width: 1.05 });
  main.group.parent.add(westBridge);
  dynamic.bridgeChimes.push(westBridge.userData.chime);

  const rightEnd = new THREE.Vector3(11.0, right.heightAtWorld(11.0, -1.45) + 0.17, -1.45);
  const mainEastEnd = new THREE.Vector3(eastLandingX, eastY + 0.17, eastLandingZ);
  const eastBridge = createRopeBridge(materials, mainEastEnd, rightEnd, { sag: 0.42, planks: 18, width: 1.02 });
  main.group.parent.add(eastBridge);
  dynamic.bridgeChimes.push(eastBridge.userData.chime);

  // A handful of hanging lanterns on the gate already exist; add one at the bridge landing.
  const bridgeLantern = createHangingLantern(materials, { drop: 0.5, scale: 0.85 });
  bridgeLantern.position.set(westLandingX - 0.6, westY + 1.45, westLandingZ + 0.35);
  main.group.add(bridgeLantern);

  // Exposed data for world/update and camera framing.
  const waterfallWorld = fallStart.clone().add(main.group.position);
  const pavilionWorld = pavilionLocal.clone().add(left.group.position);
  return {
    dynamic,
    points: {
      waterfall: waterfallWorld,
      orrery: new THREE.Vector3(0, courtY + 3.4, 0),
      pavilion: pavilionWorld.clone().add(new THREE.Vector3(0, 3.4, 0)),
      westBridge: mainWestEnd.clone().lerp(leftEnd, 0.5),
      eastBridge: mainEastEnd.clone().lerp(rightEnd, 0.5)
    },
    pavedPaths: [southPath, westPath, eastPath, northPath]
  };
}
