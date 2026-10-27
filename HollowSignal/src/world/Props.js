import * as THREE from 'three';
import { cylinderGeometry, pipeGeometryBetween, torusGeometry } from '../engine/Geometry.js';

function box(level, material, w, h, d, x, y, z, opts = {}) {
  return level.addStaticBox(material, w, h, d, x, y, z, opts);
}

function addCylinder(level, material, radius, height, x, y, z, opts = {}) {
  const geo = cylinderGeometry(radius, radius, height, { radial: opts.radial || 12, scale: opts.scale || 1.5 });
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0)),
    new THREE.Vector3(1, 1, 1)
  );
  level.staticBatch.addGeometry(geo, material, matrix);
}

export function addDesk(level, x, z, {
  width = 1.7, depth = .75, height = .76, rotation = 0, material = 'woodPale',
  clutter = true, collider = true
} = {}) {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  // Simple axis-aligned presentation keeps the collision footprint honest.
  box(level, material, width, .075, depth, x, height, z, { ry: rotation, scale: 1.4 });
  const legOffsets = [[-width / 2 + .08, -depth / 2 + .08], [width / 2 - .08, -depth / 2 + .08], [-width / 2 + .08, depth / 2 - .08], [width / 2 - .08, depth / 2 - .08]];
  for (const [lx, lz] of legOffsets) {
    const wx = x + lx * c - lz * s;
    const wz = z + lx * s + lz * c;
    box(level, 'darkMetal', .055, height - .06, .055, wx, (height - .06) / 2, wz, { scale: 1 });
  }
  box(level, material, width - .16, .38, .035, x - s * (depth / 2 - .14), height - .26, z + c * (depth / 2 - .14), { ry: rotation, scale: 1.4 });
  if (clutter) {
    box(level, 'paper', .32, .012, .42, x - width * .18 + s * .1, height + .044, z + depth * .1, { ry: rotation + .12, scale: .5 });
    box(level, 'paper', .24, .007, .32, x + width * .22, height + .042, z - .08, { ry: rotation - .2, scale: .5 });
    addCylinder(level, 'ceramic', .055, .11, x + width * .31, height + .09, z + depth * .2, { radial: 12 });
    box(level, 'darkMetal', .18, .04, .11, x + width * .1, height + .055, z - .14, { ry: rotation });
  }
  if (collider) {
    level.addCollider(x - width / 2, x + width / 2, 0, height, z - depth / 2, z + depth / 2, { occluder: false, bakeOccluder: false });
  }
  return { x, z, width, depth, height };
}

export function addChair(level, x, z, { rotation = 0, material = 'fabricDark' } = {}) {
  box(level, material, .47, .08, .46, x, .45, z, { ry: rotation });
  box(level, material, .47, .52, .07, x + Math.sin(rotation) * .2, .76, z + Math.cos(rotation) * .2, { ry: rotation });
  for (const [ox, oz] of [[-.18, -.17], [.18, -.17], [-.18, .17], [.18, .17]]) {
    box(level, 'steelDull', .032, .45, .032, x + ox, .225, z + oz, { scale: 1 });
  }
  // A jacket left over the back, sun-bleached and shapeless.
  box(level, 'darkMetal', .43, .35, .04, x + Math.sin(rotation) * .25, .7, z + Math.cos(rotation) * .25, { ry: rotation, scale: 1.4 });
}

export function addLocker(level, x, z, {
  rotation = 0, width = .68, height = 1.94, depth = .52,
  material = 'paintedMetalDark', open = true, hideable = false
} = {}) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  // Bank of metal panels with a dark interior.
  box(level, 'blackMetal', width, height, depth, x, height / 2, z, { ry: rotation, scale: 1.2 });
  box(level, material, width + .035, height + .025, .035, x - s * (depth / 2 + .022), height / 2, z + c * (depth / 2 + .022), { ry: rotation, scale: 1.1 });
  box(level, material, width + .035, .08, depth + .035, x, height - .02, z, { ry: rotation, scale: 1.1 });
  for (let i = 0; i < 4; i++) {
    box(level, 'blackMetal', width * .62, .012, .02, x - s * (depth / 2 + .043), height * .76 - i * .055, z + c * (depth / 2 + .043), { ry: rotation, scale: 1 });
  }
  box(level, 'steelDull', .026, .13, .032, x + c * (width * .36) - s * (depth / 2 + .05), height * .55, z + s * (width * .36) + c * (depth / 2 + .05), { ry: rotation, scale: 1 });
  if (!open) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(width * .97, height * .95, .025), level.game.materials.get(material));
    door.position.set(x + c * (width * .49) - s * (depth / 2 + .04), height / 2, z + s * (width * .49) + c * (depth / 2 + .04));
    door.rotation.y = rotation;
    level.scene.add(door);
  } else {
    // One door left hanging open, so the hiding locker reads as usable.
    const doorPivot = new THREE.Group();
    doorPivot.position.set(x + c * (-width / 2) - s * (depth / 2 + .04), 0, z + s * (-width / 2) + c * (depth / 2 + .04));
    doorPivot.rotation.y = rotation + 1.35;
    const doorGeo = new THREE.BoxGeometry(width * .95, height * .94, .025);
    doorGeo.translate(width * .475, height / 2, 0);
    const door = new THREE.Mesh(doorGeo, level.game.materials.get(material));
    door.castShadow = true;
    doorPivot.add(door);
    level.scene.add(doorPivot);
  }
  const collider = level.addCollider(
    x - Math.abs(c) * width / 2 - Math.abs(s) * depth / 2,
    x + Math.abs(c) * width / 2 + Math.abs(s) * depth / 2,
    0, height,
    z - Math.abs(c) * depth / 2 - Math.abs(s) * width / 2,
    z + Math.abs(c) * depth / 2 + Math.abs(s) * width / 2,
    { occluder: false, bakeOccluder: false }
  );
  if (hideable) {
    const insideX = x + s * .02;
    const insideZ = z + c * .02;
    // The locker's door faces +Z rotated by `rotation`; the player must look out
    // of that opening and step out in front of it, never through the back panel.
    const frontX = Math.sin(rotation);
    const frontZ = Math.cos(rotation);
    const spot = {
      x, z,
      hide: { x: insideX - frontX * .1, z: insideZ - frontZ * .1, yaw: rotation + Math.PI },
      exit: { x: x + frontX * (depth / 2 + .38), z: z + frontZ * (depth / 2 + .38) },
      collider
    };
    const it = level.addInteractable({
      position: new THREE.Vector3(x, 1.15, z),
      size: new THREE.Vector3(width + .24, height * .9, Math.max(.8, depth + .3)),
      label: 'Hide in the locker',
      sub: 'Stay quiet',
      range: 2.0,
      onInteract: () => level.game.enterHiding(spot, it)
    });
    spot.interactable = it;
    return spot;
  }
  return collider;
}

export function addShelf(level, x, z, { width = 1.4, height = 1.9, depth = .38, rotation = 0, material = 'rustPaint', books = true } = {}) {
  box(level, material, width, .06, depth, x, height - .02, z, { ry: rotation, scale: 1.3 });
  box(level, material, width, .06, depth, x, .06, z, { ry: rotation, scale: 1.3 });
  box(level, material, .06, height, depth, x - width / 2 * Math.cos(rotation), height / 2, z - width / 2 * Math.sin(rotation), { ry: rotation, scale: 1.3 });
  box(level, material, .06, height, depth, x + width / 2 * Math.cos(rotation), height / 2, z + width / 2 * Math.sin(rotation), { ry: rotation, scale: 1.3 });
  for (let i = 1; i < 4; i++) {
    box(level, material, width - .1, .045, depth - .03, x, i * height / 4, z, { ry: rotation, scale: 1.3 });
  }
  if (books) {
    const palette = ['rustPaint', 'paintedMetalPale', 'concreteDark', 'warningYellow', 'darkMetal'];
    for (let i = 0; i < 13; i++) {
      const row = Math.floor(i / 5);
      const off = (i % 5 - 2) * .18 + (Math.random() - .5) * .06;
      const w = .06 + Math.random() * .08;
      const h = .18 + Math.random() * .15;
      box(level, palette[i % palette.length], w, h, depth * .6, x + off * Math.cos(rotation), (row + 1) * height / 4 + .06 + h / 2, z + off * Math.sin(rotation), { ry: rotation, scale: .7 });
    }
    // Binder files, decayed and unreadable.
    for (let i = 0; i < 6; i++) {
      box(level, i % 2 ? 'paper' : 'cardboard', .24, .035, .28, x - .35 + i * .09, height * .75 + i * .04, z + .02, { ry: rotation + .04 * i, scale: .6 });
    }
  }
  level.addCollider(x - width / 2, x + width / 2, 0, height, z - depth / 2, z + depth / 2, { occluder: false, bakeOccluder: false });
}

export function addBunk(level, x, z, { rotation = 0, width = 1.85, length = .92, top = true } = {}) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  for (const [ox, oz] of [[-width / 2, -length / 2], [width / 2, -length / 2], [-width / 2, length / 2], [width / 2, length / 2]]) {
    const wx = x + ox * c - oz * s;
    const wz = z + ox * s + oz * c;
    box(level, 'steelDull', .06, 1.95, .06, wx, .975, wz, { scale: 1 });
  }
  box(level, 'steelDull', width, .08, length, x, .38, z, { ry: rotation, scale: 1.2 });
  box(level, 'mattress', width - .1, .16, length - .12, x, .49, z, { ry: rotation, scale: 1.0 });
  box(level, 'fabricDark', width - .2, .04, length * .42, x + s * length * .22, .58, z + c * length * .22, { ry: rotation, scale: 1 });
  if (top) {
    box(level, 'steelDull', width, .08, length, x, 1.55, z, { ry: rotation, scale: 1.2 });
    box(level, 'mattress', width - .1, .14, length - .12, x, 1.67, z, { ry: rotation, scale: 1.0 });
  }
  level.addCollider(
    x - Math.abs(c) * width / 2 - Math.abs(s) * length / 2,
    x + Math.abs(c) * width / 2 + Math.abs(s) * length / 2,
    0, top ? 1.8 : .7,
    z - Math.abs(c) * length / 2 - Math.abs(s) * width / 2,
    z + Math.abs(c) * length / 2 + Math.abs(s) * width / 2,
    { occluder: false, bakeOccluder: false }
  );
}

export function addCrate(level, x, z, { size = .62, rotation = 0, material = 'cardboard', y = 0 } = {}) {
  box(level, material, size, size, size, x, y + size / 2, z, { ry: rotation, scale: .7 });
  box(level, 'darkMetal', size + .015, .018, .05, x, y + size * .78, z - Math.cos(rotation) * size * .5, { ry: rotation, scale: .5 });
  box(level, 'darkMetal', size + .015, .018, .05, x, y + size * .32, z - Math.cos(rotation) * size * .5, { ry: rotation, scale: .5 });
  level.addCollider(x - size / 2, x + size / 2, y, y + size, z - size / 2, z + size / 2, { occluder: false, bakeOccluder: false });
}

export function addBarrel(level, x, z, { height = .9, radius = .28, material = 'rustPaint' } = {}) {
  addCylinder(level, material, radius, height, x, height / 2, z, { radial: 16 });
  const ringGeo = torusGeometry(radius + .006, .014, 5, 16);
  ringGeo.rotateX(Math.PI / 2);
  ringGeo.translate(x, height * .23, z);
  level.staticBatch.addGeometry(ringGeo, 'darkMetal');
  const ring2 = ringGeo.clone().translate(0, height * .5, 0);
  level.staticBatch.addGeometry(ring2, 'darkMetal');
  level.addCollider(x - radius, x + radius, 0, height, z - radius, z + radius, { occluder: false, bakeOccluder: false });
}

export function addPipeRun(level, points, { radius = .07, material = 'pipeGreen', collider = false } = {}) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]);
    const b = new THREE.Vector3(...points[i + 1]);
    const geo = pipeGeometryBetween(a, b, radius, { radial: 10, scale: 1.3 });
    if (geo) level.staticBatch.addGeometry(geo, material);
    if (collider) {
      const minX = Math.min(a.x, b.x) - radius, maxX = Math.max(a.x, b.x) + radius;
      const minY = Math.min(a.y, b.y) - radius, maxY = Math.max(a.y, b.y) + radius;
      const minZ = Math.min(a.z, b.z) - radius, maxZ = Math.max(a.z, b.z) + radius;
      level.addCollider(minX, maxX, 0, maxY, minZ, maxZ, { occluder: false, bakeOccluder: false });
    }
  }
  for (const p of points) {
    const geo = new THREE.SphereGeometry(radius * 1.26, 8, 6);
    geo.translate(p[0], p[1], p[2]);
    level.staticBatch.addGeometry(geo, 'darkMetal');
  }
}

export function addCagedLamp(level, x, z, y = 2.55) {
  addCylinder(level, 'steelDull', .018, .35, x, y - .16, z, { radial: 6 });
  box(level, 'darkMetal', .25, .11, .25, x, y - .37, z);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), level.game.materials.get('emissiveWarm'));
  glass.position.set(x, y - .41, z);
  level.scene.add(glass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box(level, 'darkMetal', .012, .22, .012, x + Math.cos(a) * .12, y - .43, z + Math.sin(a) * .12, { scale: .5 });
  }
}

export function addValveWheel(level, x, y, z, { rotation = 0, radius = .3, material = 'pipeRed' } = {}) {
  const mat = level.game.materials.get(material);
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .03, 8, 24), mat);
  ring.rotation.y = rotation;
  group.add(ring);
  for (let i = 0; i < 5; i++) {
    const spokes = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, .024, .026), level.game.materials.get('steelDull'));
    spokes.rotation.y = rotation;
    spokes.rotation.z = (i / 5) * Math.PI;
    group.add(spokes);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .1, 10), level.game.materials.get('steelDull'));
  hub.rotation.z = Math.PI / 2;
  group.add(hub);
  group.position.set(x, y, z);
  level.scene.add(group);
  return group;
}

export function addWorkbench(level, x, z, { width = 2.4, depth = .8, rotation = 0 } = {}) {
  box(level, 'steelDull', width, .07, depth, x, .92, z, { ry: rotation, scale: 1.3 });
  box(level, 'darkMetal', width, .5, depth - .05, x, .63, z, { ry: rotation, scale: 1.0 });
  for (const ox of [-width / 2 + .08, width / 2 - .08]) {
    for (const oz of [-depth / 2 + .06, depth / 2 - .06]) {
      box(level, 'darkMetal', .07, .9, .07, x + ox, .45, z + oz, { scale: 1 });
    }
  }
  // Pegboard tools.
  box(level, 'concreteDark', width - .2, .55, .03, x, 1.35, z + depth / 2 - .02, { ry: rotation, scale: 1 });
  for (let i = 0; i < 4; i++) {
    box(level, 'steelDull', .035, .2 + i * .025, .02, x - width * .36 + i * .21, 1.35, z + depth / 2 + .002, { ry: rotation, scale: .5 });
  }
  level.addCollider(x - width / 2, x + width / 2, 0, .95, z - depth / 2, z + depth / 2, { occluder: false, bakeOccluder: false });
}

export function addFluorescentFixtureRow(level, x0, x1, z, y = 2.7, spacing = 3.1, options = {}) {
  let i = 0;
  for (let x = x0; x <= x1; x += spacing) {
    level.addFluorescent(x, z, { ...options, y });
    i++;
  }
  return i;
}

export function addCabinet(level, x, z, { material = 'rustPaint', rotation = 0 } = {}) {
  box(level, material, .7, 1.5, .42, x, .75, z, { ry: rotation, scale: 1.1 });
  box(level, 'darkMetal', .03, .04, .44, x, 1.15, z, { ry: rotation, scale: .5 });
  box(level, 'darkMetal', .03, .04, .44, x, .7, z, { ry: rotation, scale: .5 });
  level.addCollider(x - .35, x + .35, 0, 1.5, z - .21, z + .21, { occluder: false, bakeOccluder: false });
}

export function addRubble(level, x, z, radius = 1.2, count = 9) {
  const palette = ['concreteDark', 'concrete', 'rustPaint', 'blackMetal'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const w = .08 + Math.random() * .35;
    const h = .03 + Math.random() * .12;
    box(level, palette[i % palette.length], w, h, .1 + Math.random() * .3, x + Math.cos(a) * r, h / 2, z + Math.sin(a) * r, { ry: Math.random() * Math.PI, scale: .8 });
  }
}

export function addOverheadDuct(level, x0, x1, z, y, { radius = .28, material = 'steelDull' } = {}) {
  const center = (x0 + x1) / 2;
  const length = Math.abs(x1 - x0);
  const geo = new THREE.CylinderGeometry(radius, radius, length, 14, 1);
  geo.rotateZ(Math.PI / 2);
  geo.translate(center, y, z);
  const uv = geo.attributes.uv;
  level.staticBatch.addGeometry(geo, material);
  for (let x = Math.min(x0, x1) + .3; x < Math.max(x0, x1); x += 2.7) {
    const ring = new THREE.TorusGeometry(radius * 1.04, .02, 5, 16);
    ring.rotateY(Math.PI / 2);
    ring.translate(x, y, z);
    level.staticBatch.addGeometry(ring, 'darkMetal');
  }
}

export function addCabinetBundle(level, x, z) {
  // Electrical conduit running down a wall.
  addPipeRun(level, [[x, 2.6, z], [x, 1.8, z], [x, 1.4, z + .08], [x, .5, z + .08]], { radius: .035, material: 'steelDull' });
  box(level, 'paintedMetalDark', .46, .65, .16, x, 1.65, z, { scale: .9 });
  box(level, 'warningYellow', .28, .05, .01, x, 1.68, z + .086, { scale: .4 });
}

export function makeKeycardMesh(level, x, y, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8b49d, roughness: .6, metalness: .04 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x3e4c42, roughness: .5, emissive: 0x18231b, emissiveIntensity: .2 });
  const card = new THREE.Mesh(new THREE.BoxGeometry(.115, .006, .18), mat);
  group.add(card);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(.116, .008, .04), stripe);
  strip.position.z = .035;
  group.add(strip);
  group.position.set(x, y, z);
  group.rotation.y = .35;
  group.rotation.x = -.08;
  group.traverse((o) => { if (o.isMesh) { o.material.userData.disposeWithObject = true; } });
  level.scene.add(group);
  return group;
}

export function makeFuseMesh(level, x, y, z, { color = 0x9b8b61 } = {}) {
  const group = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color, roughness: .58, metalness: .08 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x8c774a, roughness: .33, metalness: .76 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .16, 12), ceramic);
  body.rotation.z = Math.PI / 2;
  const capA = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, .03, 12), brass);
  capA.rotation.z = Math.PI / 2;
  capA.position.x = -.095;
  const capB = capA.clone();
  capB.position.x = .095;
  group.add(body, capA, capB);
  group.position.set(x, y, z);
  group.rotation.y = -.3;
  group.traverse((o) => { if (o.isMesh) o.material.userData.disposeWithObject = true; });
  level.scene.add(group);
  return group;
}

export function makeCassetteMesh(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x171915, roughness: .55, metalness: .05 });
  const paper = new THREE.MeshStandardMaterial({ color: 0x9d9171, roughness: .9 });
  const reel = new THREE.MeshStandardMaterial({ color: 0x5e5745, roughness: .7 });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(.19, .022, .12), dark);
  group.add(shell);
  const label = new THREE.Mesh(new THREE.BoxGeometry(.145, .003, .085), paper);
  label.position.y = .012;
  group.add(label);
  for (const xo of [-.035, .035]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .004, 12), reel);
    r.position.set(xo, .016, .015);
    group.add(r);
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  group.traverse((o) => { if (o.isMesh) { o.material.userData.disposeWithObject = true; o.castShadow = true; } });
  level.scene.add(group);
  return group;
}

export function makeTapePlayer(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.34, .11, .23), level.game.materials.get('darkMetal'));
  body.position.y = .055;
  const face = new THREE.Mesh(new THREE.BoxGeometry(.28, .05, .005), level.game.materials.get('blackGloss'));
  face.position.set(0, .07, .118);
  const window = new THREE.Mesh(new THREE.BoxGeometry(.12, .03, .006), level.game.materials.get('emissiveGreen'));
  window.position.set(.02, .04, .121);
  group.add(body, face, window);
  for (let i = 0; i < 4; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(.03, .012, .022), level.game.materials.get('steelDull'));
    key.position.set(-.1 + i * .045, .118, .07);
    group.add(key);
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

export function makeRadio(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.38, .24, .19), level.game.materials.get('darkMetal'));
  const speaker = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .012, 18), level.game.materials.get('blackFabric'));
  speaker.rotation.x = Math.PI / 2;
  speaker.position.set(-.1, .02, .1);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .024, 14), level.game.materials.get('brass'));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(.1, .02, .1);
  const led = new THREE.Mesh(new THREE.SphereGeometry(.008, 8, 6), level.game.materials.get('emissiveRed'));
  led.position.set(.13, .075, .097);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .4, 5), level.game.materials.get('steelDull'));
  antenna.position.set(.12, .3, -.02);
  antenna.rotation.z = -.2;
  group.add(body, speaker, dial, led, antenna);
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

export function makeBreakerPanel(level, x, y, z, { rotation = 0, states = [false, false, false] } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .16), level.game.materials.get('paintedMetalDark'));
  const face = new THREE.Mesh(new THREE.BoxGeometry(.48, .68, .01), level.game.materials.get('darkMetal'));
  face.position.z = .085;
  group.add(body, face);
  const switches = [];
  for (let i = 0; i < states.length; i++) {
    const lever = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(.06, .12, .035), level.game.materials.get('blackMetal'));
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(.03, .075, .02), level.game.materials.get('warningYellow'));
    toggle.position.y = .035;
    lever.add(base, toggle);
    lever.position.set(-.14 + i * .14, .2, .11);
    toggle.rotation.x = states[i] ? .55 : -.55;
    group.add(lever);
    switches.push({ lever, toggle, on: states[i] });
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return { group, switches };
}

export function makeKeypad(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.24, .34, .07), level.game.materials.get('paintedMetalDark'));
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.18, .26, .01), level.game.materials.get('blackGloss'));
  plate.position.z = .04;
  group.add(body, plate);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.12, .035), level.game.materials.get('emissiveGreen'));
  screen.position.set(0, .075, .047);
  group.add(screen);
  for (let i = 0; i < 9; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(.032, .024, .012), level.game.materials.get('steelDull'));
    key.position.set(-.055 + (i % 3) * .055, .025 - Math.floor(i / 3) * .038, .047);
    group.add(key);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(.006, 6, 5), level.game.materials.get('emissiveRed'));
  led.position.set(.07, .125, .048);
  group.add(led);
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return { group, screen, led };
}

export function makeLiftPanel(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.18, .3, .025), level.game.materials.get('paintedMetalDark'));
  const edge = new THREE.Mesh(new THREE.BoxGeometry(.13, .24, .01), level.game.materials.get('steelDull'));
  edge.position.z = .016;
  const button = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .018, 16), level.game.materials.get('emissiveRed'));
  button.rotation.x = Math.PI / 2;
  button.position.set(0, .035, .03);
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(.06, .035), level.game.materials.get('emissiveGreen'));
  arrow.position.set(0, -.06, .032);
  group.add(plate, edge, button, arrow);
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

export function makeBulkheadLever(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .06, 16), level.game.materials.get('paintedMetalDark'));
  plate.rotation.x = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .1, 12), level.game.materials.get('steelDull'));
  hub.rotation.x = Math.PI / 2;
  hub.position.z = .05;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.045, .28, .045), level.game.materials.get('warningYellow'));
  handle.position.set(0, -.15, .1);
  group.add(plate, hub, handle);
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return { group, handle };
}

export function makeTelephone(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(.24, .09, .19), level.game.materials.get('blackGloss'));
  const handset = new THREE.Mesh(new THREE.BoxGeometry(.26, .055, .06), level.game.materials.get('blackGloss'));
  handset.position.y = .11;
  const cord = new THREE.Mesh(new THREE.TorusGeometry(.055, .005, 4, 12, Math.PI * 1.5), level.game.materials.get('rubber'));
  cord.rotation.x = Math.PI / 2;
  cord.position.set(.06, .06, .1);
  group.add(base, handset, cord);
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

export function addLODProp(level, x, z, { high, medium, low }, { x: px, y = 0, z: pz, distances = [0, 9, 22] } = {}) {
  const lod = new THREE.LOD();
  const levels = [high, medium, low].filter(Boolean);
  levels.forEach((builder, i) => {
    const group = new THREE.Group();
    builder(group);
    lod.addLevel(group, distances[i] || i * 10);
  });
  lod.position.set(x, y, z);
  level.scene.add(lod);
  return lod;
}

export function makePumpLOD(level, x, z) {
  const high = new THREE.Group();
  const medium = new THREE.Group();
  const low = new THREE.Group();
  const mat = level.game.materials;
  const makeCore = (group, detail) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, .32, 1.0), mat.get('darkMetal'));
    base.position.y = .16;
    group.add(base);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1.1, 18), mat.get('paintedMetalDark'));
    motor.rotation.z = Math.PI / 2;
    motor.position.set(.15, .84, 0);
    group.add(motor);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .82), mat.get('rustPaint'));
    housing.position.set(-.62, .72, 0);
    group.add(housing);
    if (detail > 0) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 2.4, 12), mat.get('pipeGreen'));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 1.34, .35);
      group.add(pipe);
      const valve = new THREE.Mesh(new THREE.TorusGeometry(.22, .06, 7, 18), mat.get('pipeRed'));
      valve.position.set(.4, 1.55, .35);
      valve.rotation.x = Math.PI / 2;
      group.add(valve);
    }
    if (detail > 1) {
      for (let i = 0; i < 5; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(.43, .018, 5, 17), mat.get('steelDull'));
        rib.position.set(.15, .84, -.15 + i * .2);
        rib.rotation.y = Math.PI / 2;
        group.add(rib);
      }
      const gauge = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .035, 16), mat.get('brass'));
      gauge.rotation.x = Math.PI / 2;
      gauge.position.set(-.4, 1.08, .46);
      group.add(gauge);
    }
    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  };
  makeCore(high, 2);
  makeCore(medium, 1);
  makeCore(low, 0);
  const lod = new THREE.LOD();
  lod.addLevel(high, 0);
  lod.addLevel(medium, 8);
  lod.addLevel(low, 18);
  lod.position.set(x, 0, z);
  level.scene.add(lod);
  level.addCollider(x - 1.0, x + 1.0, 0, 1.4, z - .6, z + .6, { occluder: false, bakeOccluder: false });
  level.addStaticGroupForCull(lod, x, .8, z, { radius: 1.1 });
  return lod;
}
