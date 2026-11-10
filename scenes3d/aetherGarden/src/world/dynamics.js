import * as THREE from 'three';
import {
  addBox, addMesh, addTube, mulberry32, TAU, clamp, lerp
} from '../core/utils.js';

function createAirship(materials) {
  const g = new THREE.Group();
  g.name = 'sky-airship';
  // A slender lacquered envelope built as a lathe along its long axis.
  const profile = [
    [0.03, -2.55], [0.28, -2.3], [0.55, -1.9], [0.82, -1.15], [0.96, -0.2],
    [1.0, 0.55], [0.9, 1.3], [0.65, 1.9], [0.3, 2.35], [0.04, 2.55]
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const envelopeGeo = new THREE.LatheGeometry(profile, 24);
  envelopeGeo.rotateZ(-Math.PI / 2);
  const envelopeMat = new THREE.MeshStandardMaterial({
    color: '#efe3c9', roughness: 0.9, metalness: 0.02
  });
  const envelope = new THREE.Mesh(envelopeGeo, envelopeMat);
  envelope.castShadow = true;
  envelope.receiveShadow = true;
  g.add(envelope);
  // Ribbons binding the envelope.
  for (const x of [-0.85, 0.35, 1.3]) {
    const r = x < 0 ? 0.75 : 0.95;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 5, 30), materials.clothTeal);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    g.add(ring);
  }
  // A teal belly and a gold nose cap.
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, TAU, Math.PI * 0.48, Math.PI * 0.42), materials.clothTeal);
  belly.scale.set(1.5, 0.45, 0.72);
  belly.position.y = -0.36;
  g.add(belly);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), materials.brass);
  nose.position.x = 2.55;
  g.add(nose);
  // Tail fins.
  const finGeo = new THREE.BufferGeometry();
  finGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -1.4, 0, 0, -0.55, 0.75, 0,
    0, 0, 0, -1.4, 0, 0, -0.55, -0.75, 0,
    0, 0, 0, -1.4, 0, 0, -0.55, 0, 0.75
  ], 3));
  finGeo.computeVertexNormals();
  const finMat = new THREE.MeshStandardMaterial({ color: '#437a71', roughness: 0.85, side: THREE.DoubleSide });
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.position.set(-1.55, 0, 0);
  fin.castShadow = true;
  g.add(fin);
  const fin2 = fin.clone();
  fin2.rotation.x = Math.PI;
  g.add(fin2);
  // Gondola.
  const gondola = new THREE.Group();
  gondola.position.y = -1.12;
  g.add(gondola);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 0.55), materials.wood);
  hull.castShadow = true;
  gondola.add(hull);
  const hullBow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 4), materials.woodDark);
  hullBow.rotation.z = -Math.PI / 2;
  hullBow.rotation.y = Math.PI / 4;
  hullBow.scale.z = 0.5;
  hullBow.position.set(1.03, 0, 0);
  gondola.add(hullBow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.48), materials.woodLight);
  deck.position.y = 0.22;
  gondola.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.45), materials.woodDark);
  cabin.position.set(-0.22, 0.38, 0);
  gondola.add(cabin);
  const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.46), materials.windowGlass);
  cabinGlass.position.set(-0.22, 0.43, 0);
  gondola.add(cabinGlass);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.7, 5), materials.woodDark);
  mast.position.set(0.45, 0.55, 0);
  gondola.add(mast);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0); sailShape.lineTo(0.48, 0.1); sailShape.lineTo(0.08, 0.62); sailShape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), materials.clothCream);
  sail.position.set(0.45, 0.32, 0.04);
  sail.rotation.y = -0.1;
  sail.material.side = THREE.DoubleSide;
  gondola.add(sail);
  // Suspension ropes.
  for (const x of [-0.65, 0.65]) {
    for (const z of [-0.33, 0.33]) {
      addTube(g, [new THREE.Vector3(x, -0.9, z), new THREE.Vector3(x * 0.75, -0.38, z * 0.3)], 0.012, materials.rope, false, 1, 4);
    }
  }
  const prop = new THREE.Group();
  prop.position.set(-1.72, -1.02, 0);
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.35, 0.09), materials.brassDark);
    blade.rotation.z = i * Math.PI / 2;
    prop.add(blade);
  }
  g.add(prop);
  // Lanterns at the gondola's front and stern.
  const lanternMat = materials.lampMaterial;
  const lanternGlow = [];
  for (const x of [-0.95, 0.9]) {
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.2, 8), lanternMat);
    lantern.position.set(x, -0.88, 0.3);
    g.add(lantern);
    const glow = new THREE.Sprite(materials.glow.clone());
    glow.material.opacity = 0;
    glow.scale.setScalar(1.2);
    glow.position.copy(lantern.position);
    g.add(glow);
    lanternGlow.push(glow);
  }
  g.scale.setScalar(0.6);
  g.userData.prop = prop;
  g.userData.glows = lanternGlow;
  g.userData.noMerge = true;
  return g;
}

function createBird(materials, scale = 1) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#e8e4d2', roughness: 0.9 });
  const tipMat = new THREE.MeshStandardMaterial({ color: '#53686b', roughness: 0.9, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.38, 4, 6), bodyMat);
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), bodyMat);
  head.position.set(0.31, 0.08, 0);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), materials.brassDark);
  beak.rotation.z = Math.PI / 2;
  beak.position.set(0.44, 0.08, 0);
  g.add(beak);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 0.26, 0, 0.95, -0.14, 0, 0.38,
    0, 0, 0, -0.14, 0, 0.38, -0.15, 0, 0.08
  ], 3));
  wingGeo.computeVertexNormals();
  const left = new THREE.Mesh(wingGeo, tipMat);
  left.rotation.y = Math.PI;
  left.position.set(0, 0, 0.04);
  g.add(left);
  const right = new THREE.Mesh(wingGeo, tipMat);
  right.position.set(0, 0, -0.04);
  g.add(right);
  g.scale.setScalar(scale);
  g.userData.left = left;
  g.userData.right = right;
  return g;
}

function createFlock(materials, options = {}) {
  const rng = mulberry32(options.seed || 0xb17d);
  const g = new THREE.Group();
  g.name = 'crane-flock';
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const bird = createBird(materials, 0.65 + rng() * 0.28);
    const row = Math.floor(i / 2);
    const side = i % 2 ? 1 : -1;
    bird.userData.offset = new THREE.Vector3(-row * 1.2 + (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.3, side * row * 0.65);
    bird.userData.phase = rng() * TAU;
    bird.userData.flap = 5 + rng() * 2.5;
    g.add(bird);
    birds.push(bird);
  }
  g.userData.birds = birds;
  g.userData.noMerge = true;
  return g;
}

function makeFireflies(materials, islands) {
  const rng = mulberry32(0xf1f1);
  const count = 130;
  const positions = new Float32Array(count * 3);
  const base = [];
  const phase = [];
  const speed = [];
  const islandList = [islands.main, islands.left, islands.right, islands.shrine];
  for (let i = 0; i < count; i++) {
    const island = islandList[i % islandList.length];
    const a = rng() * TAU;
    const rr = 0.25 + rng() * 0.7;
    const lx = Math.cos(a) * island.radiusX * rr;
    const lz = Math.sin(a) * island.radiusZ * rr;
    const y = island.heightAtLocal(lx, lz) + 0.5 + rng() * 2.4;
    const pos = new THREE.Vector3(lx + island.group.position.x, y + island.group.position.y, lz + island.group.position.z);
    base.push(pos);
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    phase.push(rng() * TAU);
    speed.push(0.35 + rng() * 0.85);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.32,
    map: materials.textures.spark,
    color: '#ffe6a8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'fireflies';
  return { points, base, phase, speed };
}

function makePetals(materials, sources) {
  const rng = mulberry32(0x9e7a);
  const count = sources.length * 44;
  const positions = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    const source = sources[i % sources.length];
    const angle = rng() * TAU;
    const radius = Math.sqrt(rng()) * 1.6;
    const offset = new THREE.Vector3(Math.cos(angle) * radius, (rng() - 0.5) * 1.6, Math.sin(angle) * radius);
    const p = source.clone().add(offset);
    const fall = 0.12 + rng() * 0.22;
    const sway = 0.3 + rng() * 0.8;
    const phase = rng() * TAU;
    data.push({ base: p.clone(), fall, sway, phase, radius });
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.27,
    map: materials.textures.petal,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    alphaTest: 0.08,
    sizeAttenuation: true,
    toneMapped: false,
    color: '#fff1ed'
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'petal-drift';
  return { points, data, positions };
}

function makeSkyLanterns(materials) {
  const rng = mulberry32(0xa17e);
  const group = new THREE.Group();
  group.name = 'sky-lanterns';
  const lanterns = [];
  for (let i = 0; i < 6; i++) {
    const mat = materials.glow.clone();
    mat.color = new THREE.Color(i % 2 ? '#ffd38b' : '#ffc07a');
    mat.opacity = 0;
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.55 + rng() * 0.4);
    const a = rng() * TAU;
    const r = 6.5 + rng() * 5.2;
    const base = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    sprite.userData = { base, phase: rng() * TAU, speed: 0.06 + rng() * 0.055, offset: rng() * 5.2, scale: sprite.scale.x };
    group.add(sprite);
    lanterns.push(sprite);
  }
  return { group, lanterns };
}

export function createDynamics(scene, materials, islands, flora) {
  const root = new THREE.Group();
  root.name = 'aether-dynamics';
  scene.add(root);

  const airship = createAirship(materials);
  root.add(airship);
  const flock = createFlock(materials, { seed: 0xb17d });
  root.add(flock);
  const fireflyData = makeFireflies(materials, islands);
  root.add(fireflyData.points);
  const petals = makePetals(materials, flora.petalSources);
  root.add(petals.points);
  const skyLanterns = makeSkyLanterns(materials);
  root.add(skyLanterns.group);

  const airshipState = {
    angle: 0.66,
    radius: 24.5,
    height: 10.2,
    speed: 0.034
  };

  function update(timeHours, elapsed, dt, state) {
    // Airship circles the archipelago, leaning gently into its turn.
    airshipState.angle += dt * airshipState.speed;
    const a = airshipState.angle;
    const x = Math.cos(a) * airshipState.radius;
    const z = Math.sin(a) * airshipState.radius * 0.78;
    airship.position.set(x, airshipState.height + Math.sin(elapsed * 0.22) * 0.45, z);
    const tangent = new THREE.Vector3(-Math.sin(a) * airshipState.radius, 0, Math.cos(a) * airshipState.radius * 0.78).normalize();
    airship.rotation.y = Math.atan2(tangent.x, tangent.z) - Math.PI / 2;
    airship.rotation.z = Math.sin(elapsed * 0.3 + 1) * 0.045;
    airship.rotation.x = Math.cos(elapsed * 0.18) * 0.02;
    airship.userData.prop.rotation.x += dt * 8.5;
    airship.userData.glows.forEach((glow, i) => {
      glow.material.opacity = state.nightFactor * (0.38 + 0.1 * Math.sin(elapsed * 1.8 + i));
    });
    airship.visible = true;

    // Cranes fly in a loose V toward the west.
    const flockAngle = elapsed * 0.035 + 0.4;
    const center = new THREE.Vector3(Math.cos(flockAngle) * 16.5, 11.5 + Math.sin(elapsed * 0.2) * 0.8, Math.sin(flockAngle) * 14.5);
    flock.position.copy(center);
    flock.rotation.y = -flockAngle + Math.PI * 0.2;
    flock.visible = state.nightFactor < 0.56;
    flock.userData.birds.forEach((bird, i) => {
      bird.position.copy(bird.userData.offset);
      bird.position.y += Math.sin(elapsed * 1.3 + bird.userData.phase) * 0.08;
      const flap = Math.sin(elapsed * bird.userData.flap + bird.userData.phase) * 0.55;
      bird.children.forEach((child) => {
        if (child === bird.userData.left) child.rotation.x = flap;
        if (child === bird.userData.right) child.rotation.x = -flap;
      });
    });

    // Fireflies drift around the garden and only appear after dusk.
    const flyPositions = fireflyData.points.geometry.attributes.position;
    const n = flyPositions.count;
    for (let i = 0; i < n; i++) {
      const p = fireflyData.base[i];
      const t = elapsed * fireflyData.speed[i] + fireflyData.phase[i];
      flyPositions.setXYZ(
        i,
        p.x + Math.sin(t) * 0.38 + Math.sin(t * 0.37) * 0.3,
        p.y + Math.sin(t * 0.58 + 1.4) * 0.28,
        p.z + Math.cos(t * 0.83) * 0.38
      );
    }
    flyPositions.needsUpdate = true;
    fireflyData.points.material.opacity = state.nightFactor * 0.9;
    fireflyData.points.visible = state.nightFactor > 0.03;

    // Small wish lanterns rise slowly out of the garden after dusk.
    skyLanterns.lanterns.forEach((lantern, i) => {
      const u = lantern.userData;
      const rise = (elapsed * u.speed + u.offset) % 6.2;
      lantern.position.set(
        u.base.x + Math.sin(elapsed * 0.25 + u.phase) * 0.75,
        1.2 + rise,
        u.base.z + Math.cos(elapsed * 0.2 + u.phase) * 0.55
      );
      const fade = clamp(Math.min(rise / 0.7, (6.2 - rise) / 1.1), 0, 1);
      lantern.material.opacity = state.nightFactor * fade * 0.78;
    });

    // Cherry petals flutter and loop through the garden air.
    const pp = petals.positions;
    petals.data.forEach((p, i) => {
      const y = p.base.y - 0.15 - ((elapsed * p.fall + p.phase) % 2.9);
      pp[i * 3] = p.base.x + Math.sin(elapsed * p.sway + p.phase) * 0.5;
      pp[i * 3 + 1] = y;
      pp[i * 3 + 2] = p.base.z + Math.cos(elapsed * p.sway * 0.8 + p.phase) * 0.4;
    });
    petals.points.geometry.attributes.position.needsUpdate = true;
    petals.points.material.opacity = 0.45 + state.nightFactor * 0.15;
  }

  return { root, airship, flock, fireflies: fireflyData.points, petals: petals.points, skyLanterns: skyLanterns.group, update };
}
