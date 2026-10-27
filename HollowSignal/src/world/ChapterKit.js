import * as THREE from 'three';
import { getRecord } from '../story/content.js';
import { makeFuseMesh, makeKeycardMesh } from './Props.js';

/* Shared, small building blocks used by the four chapters. */

export function placeNote(level, recordId, x, y, z, {
  ry = 0,
  rx = 0,
  width = .24,
  height = .32,
  range = 2.3,
  label = null,
  pin = true
} = {}) {
  const record = getRecord(recordId);
  if (!record) throw new Error(`Unknown record: ${recordId}`);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.set(rx, ry, 0);
  const page = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, .006),
    level.game.materials.get('paper')
  );
  page.castShadow = false;
  page.receiveShadow = true;
  group.add(page);
  if (pin) {
    const pinMesh = new THREE.Mesh(
      new THREE.SphereGeometry(.011, 7, 5),
      level.game.materials.get('emissiveRed')
    );
    pinMesh.position.set(0, height * .44, .009);
    group.add(pinMesh);
  }
  level.scene.add(group);

  const item = level.addInteractable({
    position: new THREE.Vector3(x, y, z),
    size: new THREE.Vector3(Math.max(.54, width * 2), Math.max(.48, height * 1.5), .46),
    range,
    label: () => label || `Read ${record.title}`,
    sub: 'E — add to case notes',
    onInteract: () => level.openNote(record)
  });
  return { group, item, record };
}

export function placePickup(level, {
  x, y, z,
  width = .6,
  height = .55,
  depth = .6,
  range = 2.1,
  label,
  sub = 'E — take',
  mesh = null,
  onPickup = null,
  once = true
}) {
  let item = null;
  item = level.addInteractable({
    position: new THREE.Vector3(x, y, z),
    size: new THREE.Vector3(width, height, depth),
    range,
    label: () => (typeof label === 'function' ? label() : label),
    sub: () => (typeof sub === 'function' ? sub() : sub),
    onInteract: () => {
      if (once && !item.enabled) return;
      if (once) item.setEnabled(false);
      if (mesh) mesh.visible = false;
      level.game.audio.play('pickup', { volume: .2, rate: .94 });
      onPickup?.(item);
    }
  });
  return item;
}

export function addFusePickup(level, x, y, z, {
  label = 'Take ceramic fuse',
  onPickup
} = {}) {
  const mesh = makeFuseMesh(level, x, y, z);
  const item = placePickup(level, {
    x, y, z,
    width: .55, height: .4, depth: .55,
    label,
    mesh,
    onPickup
  });
  return { mesh, item };
}

export function addKeycardPickup(level, x, y, z, { label = 'Take service access card', onPickup } = {}) {
  const mesh = makeKeycardMesh(level, x, y, z);
  const item = placePickup(level, {
    x, y, z,
    width: .48, height: .28, depth: .48,
    label,
    mesh,
    onPickup
  });
  return { mesh, item };
}

export function addCeilingLamp(level, x, z, {
  y = 2.62,
  length = 1.35,
  color = 0xffd2a0,
  intensity = 1.15,
  range = 8,
  lit = true,
  flicker = false,
  dynamic = false
} = {}) {
  return level.addFluorescent(x, z, { y, length, color, intensity, range, lit, flicker, dynamic });
}

export function addRailing(level, x0, x1, z, {
  material = 'steelDull',
  height = 1.05,
  posts = 5
} = {}) {
  for (let i = 0; i < posts; i++) {
    const x = x0 + (x1 - x0) * (i / (posts - 1));
    level.addStaticBox(material, .045, height, .045, x, height / 2, z, { scale: 1 });
  }
  level.addStaticBox(material, Math.abs(x1 - x0), .045, .045, (x0 + x1) / 2, height, z, { scale: 1 });
  level.addStaticBox(material, Math.abs(x1 - x0), .035, .035, (x0 + x1) / 2, height * .52, z, { scale: 1 });
}

export function addWaterSheen(level, x0, x1, z0, z1, {
  y = .012,
  opacity = .62,
  color = 0x2d3e38
} = {}) {
  const mat = level.game.materials.get('water').clone();
  mat.color.set(color);
  mat.opacity = opacity;
  mat.userData.disposeWithObject = true;
  const geo = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  level.scene.add(mesh);
  return mesh;
}

export function addLiftRecess(level, {
  x, z, axis = 'x', facing = 1, width = 1.8, height = 2.3,
  label = 'Call the lift', sub = 'E — descend', onCall
} = {}) {
  // A dark recess, brushed frame and a single call panel. `facing` is the
  // direction the lift opens towards (+Z for x-axis lifts, +X for z-axis).
  const alongX = axis === 'x';
  const depth = .18;
  const sign = facing < 0 ? -1 : 1;
  const front = .09;
  if (alongX) {
    level.addStaticBox('blackHole', width, height, depth, x, height / 2, z - sign * .02, { scale: 1 });
    level.addStaticBox('steelDull', .1, height + .12, .26, x - width / 2 - .06, height / 2, z + sign * .02, { scale: 1 });
    level.addStaticBox('steelDull', .1, height + .12, .26, x + width / 2 + .06, height / 2, z + sign * .02, { scale: 1 });
    level.addStaticBox('steelDull', width + .22, .1, .26, x, height + .06, z + sign * .02, { scale: 1 });
    level.addStaticBox('warningYellow', width * .8, .035, .03, x, .035, z + sign * front, { scale: .5 });
  } else {
    level.addStaticBox('blackHole', depth, height, width, x - sign * .02, height / 2, z, { scale: 1 });
    level.addStaticBox('steelDull', .26, height + .12, .1, x + sign * .02, height / 2, z - width / 2 - .06, { scale: 1 });
    level.addStaticBox('steelDull', .26, height + .12, .1, x + sign * .02, height / 2, z + width / 2 + .06, { scale: 1 });
    level.addStaticBox('steelDull', .26, .1, width + .22, x + sign * .02, height + .06, z, { scale: 1 });
  }
  const px = alongX ? x + sign * width * .38 : x + sign * front;
  const pz = alongX ? z + sign * front : z + sign * width * .38;
  if (alongX) {
    level.addStaticBox('blackGloss', .16, .27, .035, px, 1.22, pz, { scale: .5 });
    level.addStaticBox('emissiveGreen', .04, .045, .012, px, 1.31, pz + sign * .02, { scale: .3 });
  } else {
    level.addStaticBox('blackGloss', .035, .27, .16, px, 1.22, pz, { scale: .5 });
    level.addStaticBox('emissiveGreen', .012, .045, .04, px + sign * .02, 1.31, pz, { scale: .3 });
  }
  const item = level.addInteractable({
    position: new THREE.Vector3(x + (alongX ? 0 : sign * .32), 1.15, z + (alongX ? sign * .32 : 0)),
    size: alongX ? new THREE.Vector3(width * .9, height * .8, .5) : new THREE.Vector3(.5, height * .8, width * .9),
    range: 2.5,
    label: () => (typeof label === 'function' ? label() : label),
    sub: () => (typeof sub === 'function' ? sub() : sub),
    onInteract: onCall
  });
  return item;
}
