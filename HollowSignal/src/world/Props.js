import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/BufferGeometryUtils.js';
import { cylinderGeometry, pipeGeometryBetween, torusGeometry } from '../engine/Geometry.js';
import {
  addBolt, addFlange, addTorus, addPipe, addGauge, addValveAssembly,
  addWrenchSet, addToolbox, addBottle, addCan, addMug, addBucket, addPallet,
  localOffset
} from './Detail.js';

const HALF_PI = Math.PI / 2;

function box(level, material, w, h, d, x, y, z, opts = {}) {
  // Local-space calls pass [x, z] as the fifth argument and the Y height next.
  // Keeping that compact form makes the furniture builders readable.
  if (Array.isArray(x)) {
    const [wx, wz] = x;
    opts = z || {};
    x = wx;
    z = wz;
  }
  return level.addStaticBox(material, w, h, d, x, y, z, opts);
}

function addCylinder(level, material, radius, height, x, y, z, opts = {}) {
  if (Array.isArray(x)) {
    const [wx, wz] = x;
    opts = z || {};
    x = wx;
    z = wz;
  }
  const geo = cylinderGeometry(radius, radius, height, { radial: opts.radial || 12, scale: opts.scale || 1.5 });
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0)),
    new THREE.Vector3(1, 1, 1)
  );
  level.staticBatch.addGeometry(geo, material, matrix);
}

function ring(level, material, radius, tube, x, y, z, opts = {}) {
  if (Array.isArray(x)) {
    const [wx, wz] = x;
    opts = z || {};
    x = wx;
    z = wz;
  }
  addTorus(level, material, radius, tube, x, y, z, opts);
}

function offset(x, z, lx, lz, rotation) {
  return localOffset(x, z, lx, lz, rotation);
}

function warnPlate(level, x, y, z, { w = .28, h = .08, ry = 0 } = {}) {
  box(level, 'warningYellow', w, h, .012, x, y, z, { ry, scale: .4 });
  for (let i = 0; i < 3; i++) {
    box(level, 'blackMetal', w * .62, .009, .004, x, y + h * .22 - i * h * .22, z + .008, { ry, scale: .3 });
  }
}

/* -------------------------------------------------------------------------- */
/* Room furniture                                                             */
/* -------------------------------------------------------------------------- */

export function addDesk(level, x, z, {
  width = 1.7, depth = .75, height = .76, rotation = 0, material = 'woodPale',
  clutter = true, collider = true
} = {}) {
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  // Layered top: a dark under-edge, a pale working surface, and a thin front lip.
  box(level, 'woodDark', width, .035, depth - .025, L(0, 0), height - .035, {
    ry: rotation, scale: 1.1
  });
  box(level, material, width, .055, depth, x, height, z, { ry: rotation, scale: 1.35 });
  box(level, material, width + .035, .022, .06, L(0, depth / 2 - .01), height + .012, {
    ry: rotation, scale: .8
  });
  box(level, 'darkMetal', width - .08, .018, .012, L(0, depth / 2 + .005), height - .013, {
    ry: rotation, scale: .5
  });
  // Rear apron and cable gutter.
  box(level, 'darkMetal', width - .14, .12, .035, L(0, -depth / 2 + .065), height - .115, {
    ry: rotation, scale: .7
  });
  box(level, 'rubber', width * .52, .022, .03, L(0, -depth / 2 + .025), height - .18, {
    ry: rotation, scale: .4
  });

  // Square steel legs with feet and a side stretcher.
  const legH = height - .085;
  for (const lx of [-width / 2 + .075, width / 2 - .075]) {
    for (const lz of [-depth / 2 + .07, depth / 2 - .07]) {
      const [wx, wz] = L(lx, lz);
      box(level, 'darkMetal', .052, legH, .052, wx, legH / 2, wz, { scale: .6 });
      box(level, 'steelDull', .069, .022, .069, wx, .011, wz, { scale: .5 });
    }
  }
  for (const lz of [-depth / 2 + .07, depth / 2 - .07]) {
    box(level, 'darkMetal', width - .15, .035, .035, L(0, lz), .16, { ry: rotation, scale: .5 });
  }

  // A shallow drawer pedestal on the right, with actual fronts and pulls.
  const px = width * .29;
  box(level, material, width * .29, .43, depth * .78, L(px, .01), height - .3, {
    ry: rotation, scale: .8
  });
  for (let i = 0; i < 3; i++) {
    const dy = height - .16 - i * .125;
    box(level, 'woodDark', width * .255, .105, .018, L(px, depth * .395), dy, {
      ry: rotation, scale: .5
    });
    box(level, 'steelDull', .12, .018, .022, L(px, depth * .408), dy + .022, {
      ry: rotation, scale: .3
    });
    box(level, 'blackMetal', .06, .012, .012, L(px, depth * .415), dy - .02, {
      ry: rotation, scale: .25
    });
  }

  if (clutter) {
    // Keep the left forequarter clear for the key card and Wren's notes.
    box(level, 'paper', .24, .012, .32, L(width * .03, -.17), height + .042, {
      ry: rotation + .08, scale: .4
    });
    box(level, 'paper', .2, .008, .27, L(width * .09, -.08), height + .05, {
      ry: rotation - .17, scale: .4
    });
    box(level, 'cardboard', .32, .035, .22, L(-width * .25, -.23), height + .038, {
      ry: rotation + .02, scale: .45
    });
    addMug(level, ...(() => { const [wx, wz] = L(width * .17, .19); return [wx, height, wz]; })());
    box(level, 'steelDull', .12, .035, .05, L(width * .11, .12), height + .043, {
      ry: rotation + .18, scale: .3
    });
    addBottle(level, ...(() => { const [wx, wz] = L(-width * .44, .06); return [wx, height + .01, wz]; })(), {
      height: .19, radius: .028, ry: rotation
    });
    // Cable coiled behind the pedestal and a small waste bin.
    ring(level, 'rubber', .11, .009, L(width * .19, -.42), .06, {
      rx: HALF_PI, radial: 4, tubular: 14
    });
    const [binX, binZ] = L(width * .34, .03);
    addBucket(level, binX, binZ, { radius: .13, material: 'paintedMetalDark' });
  }

  if (collider) {
    level.addCollider(x - width / 2, x + width / 2, 0, height, z - depth / 2, z + depth / 2, {
      occluder: false, bakeOccluder: false
    });
  }
  return { x, z, width, depth, height };
}

export function addChair(level, x, z, { rotation = 0, material = 'fabricDark' } = {}) {
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  // Swivel task chair: five-star base, gas cylinder, shaped seat and slatted back.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + .24;
    const [ax, az] = L(Math.cos(a) * .2, Math.sin(a) * .2);
    box(level, 'darkMetal', .28, .035, .045, ax, .055, az, { ry: rotation + a + HALF_PI, scale: .4 });
    const [cx, cz] = L(Math.cos(a) * .31, Math.sin(a) * .31);
    addCylinder(level, 'rubber', .032, .05, cx, .035, cz, { radial: 10 });
  }
  addCylinder(level, 'steelDull', .035, .24, L(0, 0), .23, { radial: 10 });
  addCylinder(level, 'blackMetal', .075, .05, L(0, 0), .36, { radial: 12 });
  box(level, material, .47, .07, .46, L(0, .01), .42, { ry: rotation, scale: .8 });
  box(level, material, .43, .045, .42, L(0, .015), .465, { ry: rotation, scale: .7 });
  // Back frame and three padded slats.
  const backZ = -.2;
  for (const sx of [-.185, .185]) {
    box(level, 'darkMetal', .028, .53, .028, L(sx, backZ), .78, { ry: rotation, scale: .4 });
  }
  box(level, 'darkMetal', .4, .03, .025, L(0, backZ), 1.03, { ry: rotation, scale: .4 });
  for (let i = 0; i < 3; i++) {
    box(level, material, .37, .09, .045, L(0, backZ - .02), .63 + i * .13, { ry: rotation, scale: .5 });
  }
  for (const sx of [-.235, .235]) {
    box(level, 'darkMetal', .035, .22, .04, L(sx, .02), .62, { ry: rotation, scale: .4 });
    box(level, 'darkMetal', .035, .035, .2, L(sx, .04), .52, { ry: rotation, scale: .3 });
    box(level, 'blackMetal', .05, .03, .12, L(sx, .06), .72, { ry: rotation, scale: .3 });
  }
  // A jacket left over the back, sun-bleached and shapeless.
  box(level, 'fabricDark', .36, .4, .035, L(0, backZ + .01), .82, { ry: rotation + .02, scale: .8 });
  box(level, 'fabricDark', .15, .22, .035, L(-.11, backZ - .06), .7, { ry: rotation + .2, scale: .5 });
}

export function addLocker(level, x, z, {
  rotation = 0, width = .68, height = 1.94, depth = .52,
  material = 'paintedMetalDark', open = true, hideable = false
} = {}) {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  const frontZ = depth / 2;

  // Carcass. The dark interior is deliberately visible around the door edges.
  box(level, 'blackMetal', width - .025, height - .06, depth - .035, x, height / 2, z, {
    ry: rotation, scale: .9
  });
  box(level, 'blackMetal', width, .055, depth, x, .045, z, { ry: rotation, scale: .8 });
  box(level, material, width, .055, depth + .035, x, height - .03, z, { ry: rotation, scale: .8 });
  for (const side of [-1, 1]) {
    const [sx, sz] = L(side * width / 2, 0);
    box(level, material, .035, height, depth, sx, height / 2, sz, { ry: rotation, scale: .8 });
    // Side stiffening ribs and a few rivets.
    for (let i = 1; i < 4; i++) {
      box(level, 'darkMetal', .012, .035, depth * .82, L(side * (width / 2 - .018), 0), .42 + i * .36, {
        ry: rotation, scale: .4
      });
    }
    for (let i = 0; i < 4; i++) {
      addBolt(level, sx, .24 + i * .42, sz + side * frontZ * .04, {
        axis: 'x', radius: .012, length: .012, material: 'darkMetal'
      });
    }
  }
  box(level, 'paintedMetalDark', width - .1, .035, depth - .06, L(0, 0), height - .34, {
    ry: rotation, scale: .5
  });
  // Interior rail, hook and a pale scratch of old tape.
  box(level, 'steelDull', width - .12, .025, .025, L(0, -.05), height - .31, { ry: rotation, scale: .4 });
  box(level, 'steelDull', .018, .11, .018, L(0, -.05), height - .38, { ry: rotation, scale: .3 });
  box(level, 'steelDull', .06, .015, .035, L(0, -.05), height - .43, { ry: rotation, scale: .3 });
  box(level, 'paper', .12, .2, .008, L(-.2, depth / 2 - .03), height * .67, {
    ry: rotation, scale: .3
  });
  // Number plate and tiny label holder.
  box(level, 'steelDull', .12, .055, .013, L(0, frontZ + .014), height - .4, {
    ry: rotation, scale: .3
  });
  box(level, 'blackMetal', .085, .006, .004, L(0, frontZ + .022), height - .4, {
    ry: rotation, scale: .2
  });
  // Base feet and a top vent.
  for (const lx of [-width * .36, width * .36]) {
    for (const lz of [-depth * .32, depth * .32]) {
      box(level, 'blackMetal', .045, .035, .045, L(lx, lz), .017, { ry: rotation, scale: .3 });
    }
  }
  for (let i = 0; i < 3; i++) {
    box(level, 'blackMetal', width * .5, .012, .018, L(0, frontZ + .012), height - .12 - i * .032, {
      ry: rotation, scale: .3
    });
  }

  const doorPivot = new THREE.Group();
  const [hingeX, hingeZ] = L(-width / 2 + .012, frontZ + .03);
  doorPivot.position.set(hingeX, 0, hingeZ);
  doorPivot.rotation.y = rotation + (open ? 1.35 : 0);
  const doorGeo = new THREE.BoxGeometry(width * .95, height * .93, .03);
  doorGeo.translate(width * .475, height / 2, 0);
  const doorMat = level.game.materials.get(material);
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.castShadow = true;
  doorPivot.add(door);
  const dg = new THREE.Group();
  // Raised door pan, outer frame, vent louvres, handle and hinges. Merge by
  // material so a detailed locker door costs a handful of draws, not dozens.
  const doorBatches = new Map();
  const addDoorBox = (w, h, d, lx, ly, lz, mat) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(lx, ly, lz);
    if (!doorBatches.has(mat)) doorBatches.set(mat, []);
    doorBatches.get(mat).push(geo);
  };
  addDoorBox(width * .78, height * .82, .012, width * .475, height / 2, .022, 'paintedMetalDark');
  addDoorBox(width * .72, height * .74, .008, width * .475, height / 2, .03, material);
  for (let i = 0; i < 5; i++) {
    addDoorBox(width * .42, .013, .01, width * .475, height * .73 - i * .034, .037, 'blackMetal');
  }
  for (let i = 0; i < 4; i++) {
    addDoorBox(width * .42, .013, .01, width * .475, height * .38 - i * .03, .037, 'blackMetal');
  }
  addDoorBox(.026, .14, .032, width * .84, height * .54, .048, 'steelDull');
  addDoorBox(.075, .032, .038, width * .84, height * .54, .054, 'steelDull');
  addDoorBox(.12, .045, .008, width * .475, height * .84, .038, 'warningYellow');
  for (const hy of [height * .23, height * .5, height * .77]) {
    addDoorBox(.025, .11, .02, .025, hy, .03, 'darkMetal');
  }
  for (const [mat, geometries] of doorBatches) {
    const merged = mergeGeometries(geometries, false);
    for (const geo of geometries) geo.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, level.game.materials.get(mat));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    dg.add(mesh);
  }
  doorPivot.add(dg);
  level.scene.add(doorPivot);

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
    const frontX = Math.sin(rotation);
    const frontZ2 = Math.cos(rotation);
    const spot = {
      x, z,
      hide: { x: insideX - frontX * .1, z: insideZ - frontZ2 * .1, yaw: rotation + Math.PI },
      exit: { x: x + frontX * (depth / 2 + .38), z: z + frontZ2 * (depth / 2 + .38) },
      collider
    };
    const it = level.addInteractable({
      position: new THREE.Vector3(x, 1.15, z),
      size: new THREE.Vector3(width + .24, height * .9, Math.max(.8, depth + .3)),
      label: '躲进储物柜',
      sub: '保持安静',
      range: 2.0,
      onInteract: () => level.game.enterHiding(spot, it)
    });
    spot.interactable = it;
    return spot;
  }
  return collider;
}

export function addShelf(level, x, z, {
  width = 1.4, height = 1.9, depth = .38, rotation = 0, material = 'rustPaint', books = true
} = {}) {
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  // Frame: four uprights, a top cap and shelf beams with a small front lip.
  for (const sx of [-width / 2 + .025, width / 2 - .025]) {
    for (const sz of [-depth / 2 + .025, depth / 2 - .025]) {
      box(level, material, .045, height, .045, L(sx, sz), height / 2, { ry: rotation, scale: .7 });
    }
  }
  box(level, material, width, .055, depth, x, height - .015, z, { ry: rotation, scale: 1.1 });
  box(level, material, width, .05, depth, x, .05, z, { ry: rotation, scale: 1.1 });
  const shelfHeights = [.05, height * .27, height * .5, height * .73, height - .05];
  for (const y of shelfHeights.slice(1, -1)) {
    box(level, 'darkMetal', width - .06, .04, depth - .02, x, y, z, { ry: rotation, scale: .9 });
    box(level, material, width - .02, .055, .025, L(0, depth / 2 - .015), y + .005, {
      ry: rotation, scale: .5
    });
    for (const sx of [-width / 2 + .06, width / 2 - .06]) {
      box(level, 'darkMetal', .035, .13, .035, L(sx, -depth / 2 + .04), y - .07, {
        ry: rotation, scale: .3
      });
    }
  }
  // Cross braces and shelf label holders.
  for (const lx of [-width / 2 + .06, width / 2 - .06]) {
    box(level, material, .025, Math.hypot(height - .1, depth - .04), .025,
      L(lx, 0), height / 2, { ry: rotation, scale: .3, rz: .16 });
  }
  for (let i = 0; i < 3; i++) {
    box(level, 'paper', .12, .035, .006, L(-width * .28 + i * .19, depth / 2 + .005), height * .6, {
      ry: rotation, scale: .2
    });
  }

  if (books) {
    const palette = ['rustPaint', 'paintedMetalPale', 'concreteDark', 'warningYellow', 'darkMetal', 'bluePaint'];
    for (let row = 0; row < 3; row++) {
      const shelfY = shelfHeights[row + 1];
      let cursor = -width * .39;
      for (let i = 0; i < 5; i++) {
        const w = .065 + Math.random() * .075;
        const h = .16 + Math.random() * .13;
        if (cursor + w > width * .41) break;
        box(level, palette[(row * 5 + i) % palette.length], w, h, depth * .65,
          L(cursor + w / 2, -.01), shelfY + .03 + h / 2, { ry: rotation, scale: .5 });
        cursor += w + .012;
      }
      // Binder files and a small parts box interrupt the row of books.
      box(level, 'cardboard', .26, .14, depth * .78, L(width * .2, 0), shelfY + .1, {
        ry: rotation + .03, scale: .5
      });
      box(level, 'paper', .18, .018, .03, L(width * .2, depth * .34), shelfY + .18, {
        ry: rotation, scale: .3
      });
      for (let i = 0; i < 3; i++) {
        box(level, i % 2 ? 'paper' : 'cardboard', .24, .03, .27,
          L(-width * .24 + i * .04, .02), shelfY + .5 + i * .035,
          { ry: rotation + .05 * i, scale: .4 });
      }
    }
    // Folded tarps and a pair of cans on the top shelf.
    box(level, 'fabricDark', .38, .08, depth * .8, L(-width * .22, 0), height + .06, {
      ry: rotation + .07, scale: .5
    });
    addCan(level, ...(() => { const [wx, wz] = L(width * .27, .03); return [wx, height + .03, wz]; })(), { height: .1, radius: .04 });
    addCan(level, ...(() => { const [wx, wz] = L(width * .34, -.04); return [wx, height + .03, wz]; })(), {
      height: .12, radius: .045, material: 'rustPaint'
    });
  }
  level.addCollider(x - width / 2, x + width / 2, 0, height, z - depth / 2, z + depth / 2, {
    occluder: false, bakeOccluder: false
  });
}

export function addBunk(level, x, z, { rotation = 0, width = 1.85, length = .92, top = true } = {}) {
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  for (const sx of [-width / 2, width / 2]) {
    for (const sz of [-length / 2, length / 2]) {
      box(level, 'steelDull', .055, 1.95, .055, L(sx, sz), .975, { ry: rotation, scale: .5 });
      box(level, 'darkMetal', .09, .025, .09, L(sx, sz), .72, { ry: rotation, scale: .3 });
    }
  }
  for (const y of [.38, 1.55]) {
    if (y > .5 && !top) continue;
    box(level, 'steelDull', width, .07, length, x, y, z, { ry: rotation, scale: 1 });
    box(level, 'darkMetal', width - .12, .06, length - .12, x, y + .065, z, { ry: rotation, scale: .8 });
    box(level, 'mattress', width - .16, .12, length - .16, x, y + .15, z, { ry: rotation, scale: .8 });
    if (y < .5) {
      box(level, 'fabricDark', width * .55, .045, length * .72, L(width * .14, 0), y + .23, {
        ry: rotation + .05, scale: .6
      });
      box(level, 'paper', .34, .08, .5, L(-width * .18, -.05), y + .24, {
        ry: rotation - .06, scale: .5
      });
    }
  }
  // Ladder rungs between the bunks and a small storage crate underneath.
  for (let i = 0; i < 4; i++) {
    box(level, 'steelDull', .48, .035, .04, L(-width / 2 + .12, length / 2 - .03), .65 + i * .22, {
      ry: rotation, scale: .3
    });
  }
  box(level, 'cardboard', .5, .3, .4, L(width * .22, 0), .15, { ry: rotation + .08, scale: .6 });
  level.addCollider(
    x - Math.abs(Math.cos(rotation)) * width / 2 - Math.abs(Math.sin(rotation)) * length / 2,
    x + Math.abs(Math.cos(rotation)) * width / 2 + Math.abs(Math.sin(rotation)) * length / 2,
    0, top ? 1.8 : .7,
    z - Math.abs(Math.cos(rotation)) * length / 2 - Math.abs(Math.sin(rotation)) * width / 2,
    z + Math.abs(Math.cos(rotation)) * length / 2 + Math.abs(Math.sin(rotation)) * width / 2,
    { occluder: false, bakeOccluder: false }
  );
}

export function addCrate(level, x, z, { size = .62, rotation = 0, material = 'cardboard', y = 0 } = {}) {
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  const s = size;
  if (material === 'cardboard') {
    box(level, 'cardboard', s, s, s, x, y + s / 2, z, { ry: rotation, scale: .8 });
    // Tape seam, flaps, label and a little crushed corner.
    box(level, 'paper', s * .18, s * .018, s + .008, x, y + s + .002, z, { ry: rotation, scale: .5 });
    box(level, 'darkMetal', s * .8, .012, .03, L(0, s / 2 + .006), y + s * .7, {
      ry: rotation, scale: .4
    });
    box(level, 'paper', s * .38, s * .26, .006, L(-s * .14, s / 2 + .005), y + s * .58, {
      ry: rotation + .04, scale: .4
    });
    for (let i = 0; i < 3; i++) {
      box(level, 'rustPaint', s * .2, .012, .006, L(-s * .14, s / 2 + .009), y + s * .62 - i * .025, {
        ry: rotation + .04, scale: .3
      });
    }
    box(level, 'darkMetal', s * .08, .01, s * .08, L(0, 0), y + s + .006, { ry: rotation, scale: .25 });
  } else {
    // A proper slatted wooden shipping crate.
    for (const sx of [-s / 2, s / 2]) {
      for (const sz of [-s / 2, s / 2]) {
        box(level, 'woodDark', .055, s, .055, L(sx, sz), y + s / 2, { ry: rotation, scale: .5 });
      }
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        box(level, material, s - .04, s * .18, .028,
          L(0, side * s / 2), y + .09 + i * s * .22, { ry: rotation, scale: .5 });
      }
      box(level, 'woodDark', s, .04, .04, L(0, side * s / 2), y + s * .5, { ry: rotation, scale: .4 });
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        box(level, material, .028, s * .18, s - .04,
          L(side * s / 2, 0), y + .09 + i * s * .22, { ry: rotation, scale: .5 });
      }
    }
    for (let i = 0; i < 5; i++) {
      box(level, material, s * .18, .035, s, L(-s * .36 + i * s * .18, 0), y + s, {
        ry: rotation, scale: .5
      });
    }
    box(level, 'paper', s * .36, s * .24, .008, L(-s * .12, s / 2 + .012), y + s * .56, {
      ry: rotation, scale: .4
    });
  }
  level.addCollider(x - s / 2, x + s / 2, y, y + s, z - s / 2, z + s / 2, {
    occluder: false, bakeOccluder: false
  });
}

export function addBarrel(level, x, z, { height = .9, radius = .28, material = 'rustPaint' } = {}) {
  addCylinder(level, material, radius, radius, height, x, height / 2, z, { radial: 18 });
  addCylinder(level, 'steelDull', radius * .93, radius * .97, .035, x, .025, z, { radial: 18 });
  addCylinder(level, 'steelDull', radius * .97, radius * .93, .035, x, height - .02, z, { radial: 18 });
  for (const y of [height * .23, height * .5, height * .77]) {
    ring(level, 'darkMetal', radius + .006, .015, x, y, z, { rx: HALF_PI, radial: 5, tubular: 18 });
  }
  ring(level, 'steelDull', radius * .78, .012, x, height + .018, z, { rx: HALF_PI, radial: 4, tubular: 14 });
  box(level, 'blackMetal', .085, .018, .085, x + radius * .3, height + .02, z - radius * .25, { scale: .3 });
  box(level, 'paper', .18, .1, .006, x + radius * .03, height * .62, z + radius + .005, { scale: .4 });
  for (let i = 0; i < 3; i++) {
    box(level, 'blackMetal', .12, .009, .004, x + radius * .03, height * .65 - i * .02, z + radius + .01, { scale: .3 });
  }
  level.addCollider(x - radius, x + radius, 0, height, z - radius, z + radius, {
    occluder: false, bakeOccluder: false
  });
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
    const geo = new THREE.SphereGeometry(radius * 1.22, 10, 7);
    geo.translate(p[0], p[1], p[2]);
    level.staticBatch.addGeometry(geo, material);
  }
  if (radius >= .032) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const len = Math.hypot(dx, dz);
      if (len > 2.4) {
        const axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
        addFlange(level, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, {
          axis, radius: radius * 1.55, material: 'steelDull', bolts: 5
        });
      }
    }
    for (const p of [points[0], points[points.length - 1]]) {
      const next = p === points[0] ? points[1] : points[points.length - 2];
      const axis = Math.abs(next[2] - p[2]) > Math.abs(next[0] - p[0]) ? 'z' : 'x';
      addFlange(level, p[0], p[1], p[2], { axis, radius: radius * 1.55, material: 'pipeRed', bolts: 5 });
    }
  }
}

export function addCagedLamp(level, x, z, y = 2.55, { light = true } = {}) {
  // Cast ceiling plate, conduit, cast body and a caged glass globe.
  addCylinder(level, 'darkMetal', .1, .1, .025, x, y, z, { radial: 14 });
  addCylinder(level, 'steelDull', .017, .017, .32, x, y - .16, z, { radial: 7 });
  addCylinder(level, 'paintedMetalDark', .055, .075, .12, x, y - .34, z, { radial: 12 });
  box(level, 'darkMetal', .3, .055, .3, x, y - .4, z, { scale: .6 });
  ring(level, 'steelDull', .15, .015, x, y - .43, z, { rx: HALF_PI, radial: 5, tubular: 18 });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(.115, 14, 9), level.game.materials.get('emissiveWarm'));
  glass.position.set(x, y - .48, z);
  glass.scale.y = 1.15;
  level.scene.add(glass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box(level, 'darkMetal', .011, .2, .011, x + Math.cos(a) * .12, y - .48, z + Math.sin(a) * .12, {
      scale: .4
    });
  }
  ring(level, 'darkMetal', .12, .012, x, y - .39, z, { rx: HALF_PI, radial: 4, tubular: 16 });
  ring(level, 'darkMetal', .08, .01, x, y - .59, z, { rx: HALF_PI, radial: 4, tubular: 14 });
  if (light) {
    level.addBakeLight(x, y - .52, z, { color: 0xffbb7d, intensity: .32, range: 3.4 });
  }
}

export function addValveWheel(level, x, y, z, { rotation = 0, radius = .3, material = 'pipeRed' } = {}) {
  const mat = level.game.materials.get(material);
  const group = new THREE.Group();
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(radius, .028, 7, 24), mat);
  ringMesh.rotation.y = rotation;
  group.add(ringMesh);
  for (let i = 0; i < 6; i++) {
    const spokes = new THREE.Mesh(new THREE.BoxGeometry(radius * 2, .02, .022), level.game.materials.get('steelDull'));
    spokes.rotation.y = rotation;
    spokes.rotation.z = (i / 6) * Math.PI;
    group.add(spokes);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .09, 10), level.game.materials.get('steelDull'));
  hub.rotation.z = HALF_PI;
  group.add(hub);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .2, 8), level.game.materials.get('steelDull'));
  stem.rotation.x = HALF_PI;
  stem.position.z = -.1;
  group.add(stem);
  group.position.set(x, y, z);
  level.scene.add(group);
  return group;
}

export function addWorkbench(level, x, z, { width = 2.4, depth = .8, rotation = 0 } = {}) {
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  // Steel bench with a replaceable timber top, lower shelf and a bolted vice.
  box(level, 'steelDull', width, .055, depth, x, .91, z, { ry: rotation, scale: 1.1 });
  for (let i = 0; i < 3; i++) {
    box(level, 'woodDark', width - .12, .025, (depth - .13) / 3, L(0, -.28 + i * .26), .947, {
      ry: rotation, scale: .6
    });
  }
  for (const sx of [-width / 2 + .075, width / 2 - .075]) {
    for (const sz of [-depth / 2 + .065, depth / 2 - .065]) {
      box(level, 'darkMetal', .065, .87, .065, L(sx, sz), .45, { ry: rotation, scale: .5 });
      box(level, 'steelDull', .085, .025, .085, L(sx, sz), .035, { ry: rotation, scale: .4 });
    }
  }
  for (const sz of [-depth / 2 + .065, depth / 2 - .065]) {
    box(level, 'darkMetal', width - .14, .04, .04, L(0, sz), .42, { ry: rotation, scale: .5 });
    box(level, 'darkMetal', width - .14, .04, .04, L(0, sz), .77, { ry: rotation, scale: .5 });
  }
  box(level, 'darkMetal', width - .15, .04, depth - .14, x, .28, z, { ry: rotation, scale: .8 });
  box(level, 'darkMetal', width - .2, .34, .035, L(0, -depth / 2 + .06), .74, { ry: rotation, scale: .6 });
  // Lower shelf contents.
  addToolbox(level, ...(() => { const [wx, wz] = L(-width * .28, .02); return [wx, .31, wz]; })(), { ry: rotation });
  box(level, 'cardboard', .42, .18, .3, L(width * .22, .02), .375, { ry: rotation + .03, scale: .5 });
  addBucket(level, ...(() => { const [wx, wz] = L(width * .38, .02); return [wx, wz]; })(), { y: .25, radius: .12 });

  // A bench-mounted backboard and tool rail, so nothing floats in mid-air.
  box(level, 'concreteDark', width - .2, .58, .025, L(0, depth / 2 - .06), 1.31, {
    ry: rotation, scale: .6
  });
  for (let i = 0; i < 3; i++) {
    box(level, 'darkMetal', width - .24, .025, .04, L(0, depth / 2 - .06), 1.05 + i * .19, {
      ry: rotation, scale: .5
    });
  }
  addWrenchSet(level, ...(() => { const [wx, wz] = L(-width * .31, depth / 2 - .045); return [wx, 1.28, wz]; })(), {
    ry: rotation, count: 4
  });
  for (let i = 0; i < 3; i++) {
    box(level, 'steelDull', .025, .12, .025, L(-width * .08 + i * .08, depth / 2 - .045), 1.3, {
      ry: rotation, scale: .3
    });
    box(level, 'warningYellow', .035, .035, .03, L(-width * .08 + i * .08, depth / 2 - .045), 1.23, {
      ry: rotation, scale: .25
    });
  }
  // Vice.
  const [vx, vz] = L(-width * .41, .02);
  addCylinder(level, 'steelDull', .07, .09, .12, vx, 1.03, vz, { radial: 10 });
  box(level, 'steelDull', .22, .055, .095, vx, 1.11, vz, { ry: rotation, scale: .5 });
  box(level, 'steelDull', .18, .045, .07, vx, 1.17, vz, { ry: rotation, scale: .4 });
  addCylinder(level, 'darkMetal', .018, .018, .24, vx, 1.11, vz, { radial: 6, rz: HALF_PI });
  addCylinder(level, 'rustPaint', .028, .028, .09, vx, 1.11, vz - .14, { radial: 8, rz: HALF_PI });
  // Bench clamp and a rag.
  box(level, 'steelDull', .1, .035, .18, L(width * .42, .02), 1.0, { ry: rotation + .1, scale: .3 });
  box(level, 'fabricDark', .24, .012, .18, L(width * .16, .16), .962, { ry: rotation + .3, scale: .4 });
  level.addCollider(x - width / 2, x + width / 2, 0, .95, z - depth / 2, z + depth / 2, {
    occluder: false, bakeOccluder: false
  });
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
  const L = (lx, lz) => offset(x, z, lx, lz, rotation);
  box(level, 'darkMetal', .68, 1.48, .4, x, .76, z, { ry: rotation, scale: .9 });
  box(level, material, .035, 1.44, .42, L(-.337, 0), .76, { ry: rotation, scale: .7 });
  box(level, material, .035, 1.44, .42, L(.337, 0), .76, { ry: rotation, scale: .7 });
  box(level, material, .7, .035, .44, x, 1.48, z, { ry: rotation, scale: .7 });
  box(level, material, .7, .07, .44, x, .045, z, { ry: rotation, scale: .7 });
  // Door, frame and louvres.
  box(level, material, .61, 1.3, .028, L(0, .215), .78, { ry: rotation, scale: .6 });
  box(level, 'darkMetal', .54, 1.2, .012, L(0, .237), .78, { ry: rotation, scale: .5 });
  for (let i = 0; i < 4; i++) {
    box(level, 'blackMetal', .4, .012, .012, L(0, .246), 1.28 - i * .03, { ry: rotation, scale: .3 });
    box(level, 'blackMetal', .4, .012, .012, L(0, .246), .35 + i * .03, { ry: rotation, scale: .3 });
  }
  box(level, 'steelDull', .025, .15, .04, L(.22, .255), .84, { ry: rotation, scale: .3 });
  box(level, 'steelDull', .07, .03, .05, L(.22, .27), .84, { ry: rotation, scale: .25 });
  for (const hy of [.24, .78, 1.32]) {
    box(level, 'steelDull', .035, .1, .02, L(-.28, .24), hy, { ry: rotation, scale: .25 });
  }
  box(level, 'paper', .16, .08, .006, L(0, .255), 1.29, { ry: rotation, scale: .3 });
  warnPlate(level, ...(() => { const [wx, wz] = L(-.17, .258); return [wx, 1.12, wz]; })(), {
    w: .16, h: .05, ry: rotation
  });
  for (const lx of [-.3, .3]) {
    for (const lz of [-.16, .16]) {
      box(level, 'blackMetal', .05, .04, .05, L(lx, lz), .02, { ry: rotation, scale: .25 });
    }
  }
  level.addCollider(x - .35, x + .35, 0, 1.5, z - .21, z + .21, {
    occluder: false, bakeOccluder: false
  });
}

export function addRubble(level, x, z, radius = 1.2, count = 9) {
  const palette = ['concreteDark', 'concrete', 'rustPaint', 'blackMetal', 'steelDull'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    const w = .08 + Math.random() * .36;
    const h = .03 + Math.random() * .12;
    const d = .1 + Math.random() * .34;
    box(level, palette[i % palette.length], w, h, d, x + Math.cos(a) * r, h / 2, z + Math.sin(a) * r, {
      ry: Math.random() * Math.PI, scale: .8
    });
    if (i % 3 === 0) {
      const geo = new THREE.CylinderGeometry(.012, .012, .3 + Math.random() * .4, 6);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x + Math.cos(a + .4) * r, .09, z + Math.sin(a + .4) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(.2 + Math.random(), Math.random() * 3, 1.1 + Math.random())),
        new THREE.Vector3(1, 1, 1)
      );
      level.staticBatch.addGeometry(geo, 'rustPaint', m);
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * .9;
    box(level, i % 2 ? 'concreteDark' : 'concrete', .035 + Math.random() * .08, .015 + Math.random() * .03,
      .03 + Math.random() * .08, x + Math.cos(a) * r, .012, z + Math.sin(a) * r,
      { ry: Math.random() * Math.PI, scale: .4 });
  }
}

export function addOverheadDuct(level, x0, x1, z, y, { radius = .28, material = 'steelDull' } = {}) {
  const center = (x0 + x1) / 2;
  const length = Math.abs(x1 - x0);
  const geo = new THREE.CylinderGeometry(radius, radius, length, 16, 1);
  geo.rotateZ(HALF_PI);
  geo.translate(center, y, z);
  level.staticBatch.addGeometry(geo, material);
  // Longitudinal seam, end collars, bolted flanges and hanger rods.
  box(level, 'darkMetal', length, .022, .022, center, y + radius * .82, z + radius * .6, { scale: .8 });
  for (let x = Math.min(x0, x1) + .3; x < Math.max(x0, x1); x += 2.7) {
    ring(level, material, radius * 1.04, .022, x, y, z, { ry: HALF_PI, radial: 5, tubular: 18 });
    addCylinder(level, 'steelDull', .011, .011, .42, x, y + radius + .21, z, { radial: 5 });
    box(level, 'darkMetal', .2, .025, .2, x, y + radius + .42, z, { scale: .4 });
  }
  for (const x of [Math.min(x0, x1) + .1, Math.max(x0, x1) - .1]) {
    ring(level, 'darkMetal', radius * 1.08, .025, x, y, z, { ry: HALF_PI, radial: 5, tubular: 18 });
  }
  box(level, 'paintedMetalDark', .3, .18, .18, center, y + radius * .95, z + .1, { scale: .4 });
}

export function addCabinetBundle(level, x, z) {
  // Electrical conduit running down a wall.
  addPipeRun(level, [[x, 2.6, z], [x, 1.8, z], [x, 1.4, z + .08], [x, .5, z + .08]], {
    radius: .035, material: 'steelDull'
  });
  box(level, 'paintedMetalDark', .46, .65, .16, x, 1.65, z, { scale: .9 });
  box(level, 'darkMetal', .39, .58, .012, x, 1.65, z + .087, { scale: .6 });
  box(level, 'warningYellow', .3, .045, .008, x, 1.68, z + .096, { scale: .4 });
  for (const lx of [-.16, .16]) {
    for (const ly of [-.23, .23]) {
      addBolt(level, x + lx, 1.65 + ly, z + .097, { axis: 'z', radius: .012, length: .012, material: 'darkMetal' });
    }
  }
  box(level, 'steelDull', .035, .12, .025, x + .18, 1.63, z + .1, { scale: .25 });
}

/* -------------------------------------------------------------------------- */
/* Pickups and small hero props                                               */
/* -------------------------------------------------------------------------- */

export function makeKeycardMesh(level, x, y, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8b49d, roughness: .6, metalness: .04 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x3e4c42, roughness: .5, emissive: 0x18231b, emissiveIntensity: .2 });
  const ink = new THREE.MeshStandardMaterial({ color: 0x343b32, roughness: .7 });
  const card = new THREE.Mesh(new THREE.BoxGeometry(.115, .006, .18), mat);
  group.add(card);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(.116, .008, .04), stripe);
  strip.position.z = .035;
  group.add(strip);
  // A scratched-out portrait, a punched clip hole and two lines of print.
  const portrait = new THREE.Mesh(new THREE.BoxGeometry(.038, .004, .05), ink);
  portrait.position.set(-.026, .004, -.035);
  group.add(portrait);
  const scratch = new THREE.Mesh(new THREE.BoxGeometry(.045, .002, .008), mat);
  scratch.position.set(-.026, .007, -.035);
  scratch.rotation.y = .2;
  group.add(scratch);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .01, 10), ink);
  hole.position.set(0, .004, -.073);
  group.add(hole);
  for (let i = 0; i < 2; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(.06 - i * .012, .002, .005), ink);
    line.position.set(.018, .006, -.005 + i * .015);
    group.add(line);
  }
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
  body.rotation.z = HALF_PI;
  const capA = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, .03, 12), brass);
  capA.rotation.z = HALF_PI;
  capA.position.x = -.095;
  const capB = capA.clone();
  capB.position.x = .095;
  const band = new THREE.Mesh(new THREE.TorusGeometry(.036, .005, 5, 12), brass);
  band.rotation.y = HALF_PI;
  group.add(body, capA, capB, band);
  group.position.set(x, y, z);
  group.rotation.y = -.3;
  group.traverse((o) => { if (o.isMesh) { o.material.userData.disposeWithObject = true; } });
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
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(.09 - i * .014, .0015, .004), dark);
    line.position.set(-.015, .014, -.022 + i * .018);
    group.add(line);
  }
  for (const xo of [-.035, .035]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .004, 12), reel);
    r.position.set(xo, .016, .015);
    group.add(r);
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(.025, .003, 4, 12), dark);
    ringMesh.position.set(xo, .012, .015);
    ringMesh.rotation.x = HALF_PI;
    group.add(ringMesh);
    for (let j = 0; j < 3; j++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(.004, .003, .01), dark);
      tooth.position.set(xo + Math.cos(j / 3 * Math.PI * 2) * .011, .013, .015 + Math.sin(j / 3 * Math.PI * 2) * .011);
      group.add(tooth);
    }
  }
  for (const sx of [-.072, .072]) {
    for (const sz of [-.044, .044]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .003, 6), reel);
      screw.position.set(sx, .014, sz);
      group.add(screw);
    }
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
  // Ribbed grip, feet, a carry handle and a pair of meter needles.
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(.32, .008, .012), level.game.materials.get('blackMetal'));
    rib.position.set(0, .018 + i * .007, -.115);
    group.add(rib);
  }
  for (const sx of [-.13, .13]) {
    for (const sz of [-.08, .08]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(.014, .018, .022, 8), level.game.materials.get('rubber'));
      foot.position.set(sx, -.011, sz);
      group.add(foot);
    }
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.07, .009, 5, 12, Math.PI), level.game.materials.get('steelDull'));
  handle.position.set(0, .115, -.02);
  handle.rotation.x = HALF_PI;
  group.add(handle);
  for (let i = 0; i < 2; i++) {
    const meter = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .005, 12), level.game.materials.get('paper'));
    meter.rotation.x = HALF_PI;
    meter.position.set(-.07 + i * .06, .075, .121);
    group.add(meter);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(.002, .018, .003), level.game.materials.get('darkMetal'));
    needle.position.set(-.07 + i * .06, .078, .125);
    group.add(needle);
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

export function makeRadio(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.38, .24, .19), level.game.materials.get('darkMetal'));
  const face = new THREE.Mesh(new THREE.BoxGeometry(.34, .19, .008), level.game.materials.get('paintedMetalDark'));
  face.position.z = .098;
  const speaker = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .012, 18), level.game.materials.get('blackFabric'));
  speaker.rotation.x = HALF_PI;
  speaker.position.set(-.1, .02, .108);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .024, 14), level.game.materials.get('brass'));
  dial.rotation.x = HALF_PI;
  dial.position.set(.1, .02, .108);
  const led = new THREE.Mesh(new THREE.SphereGeometry(.008, 8, 6), level.game.materials.get('emissiveRed'));
  led.position.set(.13, .075, .105);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .4, 5), level.game.materials.get('steelDull'));
  antenna.position.set(.12, .3, -.02);
  antenna.rotation.z = -.2;
  group.add(body, face, speaker, dial, led, antenna);
  // Speaker slots, rotary knobs, carry handle and rubber feet.
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(.1, .008, .006), level.game.materials.get('blackMetal'));
    slot.position.set(-.1, .05 - i * .017, .115);
    group.add(slot);
  }
  for (let i = 0; i < 2; i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .018, 10), level.game.materials.get('blackMetal'));
    knob.rotation.x = HALF_PI;
    knob.position.set(.065 + i * .055, -.065, .115);
    group.add(knob);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.12, .01, 5, 14, Math.PI), level.game.materials.get('steelDull'));
  handle.position.set(0, .135, -.02);
  handle.rotation.x = HALF_PI;
  group.add(handle);
  for (const sx of [-.14, .14]) {
    for (const sz of [-.06, .06]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(.014, .016, .018, 8), level.game.materials.get('rubber'));
      foot.position.set(sx, -.128, sz);
      group.add(foot);
    }
  }
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
  // Cabinet rim, corner bolts and a label strip.
  for (const sx of [-.29, .29]) {
    for (const sy of [-.39, .39]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .015, 6), level.game.materials.get('steelDull'));
      bolt.rotation.x = HALF_PI;
      bolt.position.set(sx, sy, .086);
      group.add(bolt);
    }
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(.4, .045, .006), level.game.materials.get('warningYellow'));
  strip.position.set(0, .33, .092);
  group.add(strip);
  for (let i = 0; i < 3; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(.06, .007, .003), level.game.materials.get('blackMetal'));
    mark.position.set(-.1 + i * .1, .33, .096);
    group.add(mark);
  }
  // Three fuse holders behind the face.
  for (let i = 0; i < 3; i++) {
    const holder = new THREE.Mesh(new THREE.BoxGeometry(.08, .16, .035), level.game.materials.get('blackMetal'));
    holder.position.set(-.14 + i * .14, -.02, .105);
    group.add(holder);
    for (const sy of [-.055, .055]) {
      const clip = new THREE.Mesh(new THREE.BoxGeometry(.065, .014, .045), level.game.materials.get('copper'));
      clip.position.set(-.14 + i * .14, sy, .125);
      group.add(clip);
    }
  }
  const switches = [];
  for (let i = 0; i < states.length; i++) {
    const lever = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(.06, .12, .035), level.game.materials.get('blackMetal'));
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(.03, .075, .02), level.game.materials.get('warningYellow'));
    toggle.position.y = .035;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(.045, .02, .03), level.game.materials.get('steelDull'));
    grip.position.y = .073;
    lever.add(base, toggle, grip);
    lever.position.set(-.14 + i * .14, .2, .11);
    toggle.rotation.x = states[i] ? .55 : -.55;
    grip.position.z = states[i] ? .02 : -.02;
    group.add(lever);
    switches.push({ lever, toggle, on: states[i] });
  }
  // A small analog meter at the top.
  const meter = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .018, 16), level.game.materials.get('paper'));
  meter.rotation.x = HALF_PI;
  meter.position.set(0, .245, .105);
  group.add(meter);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(.004, .04, .004), level.game.materials.get('safetyRed'));
  needle.position.set(.01, .25, .116);
  needle.rotation.z = -.5;
  group.add(needle);
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
  for (let i = 0; i < 12; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(.032, .024, .012), level.game.materials.get('steelDull'));
    key.position.set(-.055 + (i % 3) * .055, .025 - Math.floor(i / 3) * .038, .047);
    group.add(key);
    // A tiny dark legend mark keeps the keypad from reading as blank buttons.
    const legend = new THREE.Mesh(new THREE.BoxGeometry(.014, .003, .002), level.game.materials.get('blackMetal'));
    legend.position.copy(key.position);
    legend.position.z += .007;
    group.add(legend);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(.006, 6, 5), level.game.materials.get('emissiveRed'));
  led.position.set(.07, .125, .048);
  group.add(led);
  // Steel backing plate, screws, label and a short conduit drop.
  const backing = new THREE.Mesh(new THREE.BoxGeometry(.3, .42, .018), level.game.materials.get('steelDull'));
  backing.position.z = -.042;
  group.add(backing);
  for (const sx of [-.125, .125]) {
    for (const sy of [-.17, .17]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .012, 6), level.game.materials.get('darkMetal'));
      screw.rotation.x = HALF_PI;
      screw.position.set(sx, sy, -.027);
      group.add(screw);
    }
  }
  const label = new THREE.Mesh(new THREE.BoxGeometry(.16, .028, .004), level.game.materials.get('paper'));
  label.position.set(0, -.125, .047);
  group.add(label);
  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .5, 8), level.game.materials.get('steelDull'));
  conduit.position.set(.09, -.45, -.03);
  group.add(conduit);
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
  button.rotation.x = HALF_PI;
  button.position.set(0, .035, .03);
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(.06, .035), level.game.materials.get('emissiveGreen'));
  arrow.position.set(0, -.06, .032);
  group.add(plate, edge, button, arrow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.044, .007, 5, 16), level.game.materials.get('brass'));
  ring.position.set(0, .035, .032);
  group.add(ring);
  for (const sx of [-.07, .07]) {
    for (const sy of [-.12, .12]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .01, 6), level.game.materials.get('steelDull'));
      screw.rotation.x = HALF_PI;
      screw.position.set(sx, sy, .014);
      group.add(screw);
    }
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

export function makeBulkheadLever(level, x, y, z, { rotation = 0 } = {}) {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .06, 16), level.game.materials.get('paintedMetalDark'));
  plate.rotation.x = HALF_PI;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .1, 12), level.game.materials.get('steelDull'));
  hub.rotation.x = HALF_PI;
  hub.position.z = .05;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.045, .28, .045), level.game.materials.get('warningYellow'));
  handle.position.set(0, -.15, .1);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, .1, 10), level.game.materials.get('rubber'));
  grip.position.set(0, -.29, .1);
  const plateRing = new THREE.Mesh(new THREE.TorusGeometry(.115, .009, 5, 20), level.game.materials.get('steelDull'));
  plateRing.position.z = .035;
  group.add(plate, hub, handle, grip, plateRing);
  for (const a of [0, Math.PI]) {
    const stop = new THREE.Mesh(new THREE.BoxGeometry(.06, .02, .02), level.game.materials.get('steelDull'));
    stop.position.set(Math.cos(a) * .09, Math.sin(a) * .09, .075);
    stop.rotation.z = a;
    group.add(stop);
  }
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
  cord.rotation.x = HALF_PI;
  cord.position.set(.06, .06, .1);
  group.add(base, handset, cord);
  const keypad = new THREE.Mesh(new THREE.BoxGeometry(.12, .065, .006), level.game.materials.get('darkMetal'));
  keypad.position.set(0, .015, .098);
  group.add(keypad);
  for (let i = 0; i < 9; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(.026, .016, .004), level.game.materials.get('steelDull'));
    key.position.set(-.04 + (i % 3) * .04, .038 - Math.floor(i / 3) * .022, .102);
    group.add(key);
  }
  for (const sx of [-.065, .065]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(.055, .035, .067), level.game.materials.get('blackMetal'));
    ear.position.set(sx, .13, 0);
    group.add(ear);
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  level.scene.add(group);
  return group;
}

/* -------------------------------------------------------------------------- */
/* LOD pump                                                                   */
/* -------------------------------------------------------------------------- */

function createBuilder(level) {
  const batches = new Map();
  const add = (geo, key, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    geo.applyMatrix4(m);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geo);
  };
  return {
    box(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
      add(new THREE.BoxGeometry(w, h, d), key, x, y, z, rx, ry, rz);
    },
    cyl(key, rt, rb, h, x, y, z, { rx = 0, ry = 0, rz = 0, segments = 14 } = {}) {
      add(new THREE.CylinderGeometry(rt, rb, h, segments), key, x, y, z, rx, ry, rz);
    },
    sphere(key, r, x, y, z, { sx = 1, sy = 1, sz = 1 } = {}) {
      const geo = new THREE.SphereGeometry(r, 12, 8);
      geo.scale(sx, sy, sz);
      add(geo, key, x, y, z);
    },
    torus(key, r, tube, x, y, z, { rx = 0, ry = 0, rz = 0, segments = 20, radial = 6 } = {}) {
      add(new THREE.TorusGeometry(r, tube, radial, segments), key, x, y, z, rx, ry, rz);
    },
    pipe(key, r, a, b, radial = 10) {
      const geo = pipeGeometryBetween(new THREE.Vector3(...a), new THREE.Vector3(...b), r, { radial, scale: 1.4 });
      if (geo) {
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(geo);
      }
    },
    finish(group) {
      for (const [key, geos] of batches.entries()) {
        const merged = mergeGeometries(geos, false);
        for (const geo of geos) geo.dispose();
        if (!merged) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, level.game.materials.get(key));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
  };
}

export function makePumpLOD(level, x, z) {
  const high = new THREE.Group();
  const medium = new THREE.Group();
  const low = new THREE.Group();

  const buildCore = (b, detail) => {
    // Common skid and drip tray.
    b.box('darkMetal', 1.9, .13, 1.05, 0, .075, 0);
    b.box('blackMetal', 1.7, .035, .9, 0, .015, 0);
    for (const sz of [-.39, .39]) b.box('steelDull', 1.95, .11, .11, 0, .17, sz);
    for (const sx of [-.75, 0, .75]) b.box('darkMetal', .11, .11, 1.02, sx, .17, 0);
    for (const sx of [-.82, .82]) {
      for (const sz of [-.36, .36]) {
        b.cyl('steelDull', .024, .03, .04, sx, .225, sz, { segments: 6 });
      }
    }
    // Pump casing on the left, motor on the right, common axis X.
    b.cyl('rustPaint', .38, .38, .4, -.56, .72, 0, { rz: HALF_PI, segments: 20 });
    b.cyl('rustPaint', .3, .34, .06, -.8, .72, 0, { rz: HALF_PI, segments: 18 });
    b.cyl('rustPaint', .3, .34, .06, .32, .72, 0, { rz: HALF_PI, segments: 18 });
    b.cyl('paintedMetalDark', .36, .36, .07, -.79, .72, 0, { rz: HALF_PI, segments: 20 });
    b.cyl('paintedMetalDark', .36, .36, .07, -.33, .72, 0, { rz: HALF_PI, segments: 20 });
    // Volute discharge throat and suction eye.
    b.pipe('rustPaint', .14, [-.55, 1.02, 0], [-.55, 1.46, 0], 12);
    b.pipe('rustPaint', .13, [-.94, .72, 0], [-1.25, .72, 0], 12);
    b.pipe('rustPaint', .12, [-.56, .4, 0], [-.56, .25, 0], 10);
    b.torus('steelDull', .18, .022, -.55, .72, .22, { rx: HALF_PI, segments: 24 });
    b.torus('steelDull', .18, .022, -.55, .72, -.22, { rx: HALF_PI, segments: 24 });
    // Motor with cooling ribs, terminal box, fan cover and feet.
    b.cyl('bluePaint', .26, .26, .78, .3, .72, 0, { rz: HALF_PI, segments: 20 });
    for (let i = 0; i < 5; i++) {
      b.torus('paintedMetalDark', .275, .018, .06 + i * .12, .72, 0, { ry: HALF_PI, segments: 18 });
    }
    b.cyl('paintedMetalDark', .255, .255, .11, .72, .72, 0, { rz: HALF_PI, segments: 20 });
    b.cyl('blackMetal', .21, .21, .03, .78, .72, 0, { rz: HALF_PI, segments: 18 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box('steelDull', .028, .02, .16, .795, .72 + Math.sin(a) * .14, Math.cos(a) * .14, 0, 0, a);
    }
    b.box('paintedMetalDark', .23, .13, .2, .3, 1.0, 0);
    b.box('warningYellow', .1, .04, .006, .3, 1.0, .104);
    b.cyl('steelDull', .09, .09, .04, -.03, .72, 0, { rz: HALF_PI, segments: 12 });
    // Coupling guard.
    b.box('warningYellow', .36, .13, .22, -.02, .88, .12);
    b.box('warningYellow', .36, .13, .22, -.02, .56, .12);
    b.box('warningYellow', .36, .13, .22, -.02, .72, -.12);
    for (const sx of [-.17, .15]) {
      b.box('blackMetal', .035, .48, .03, sx, .72, .225);
    }
    b.box('darkMetal', .5, .45, .35, -.04, .32, 0);
    // Mounting feet and anchor bolts.
    for (const sx of [-.78, .05, .64]) {
      b.box('paintedMetalDark', .18, .12, .8, sx, .27, 0);
      b.box('steelDull', .2, .04, .86, sx, .21, 0);
    }
    // Suction and discharge flanges.
    b.torus('steelDull', .16, .025, -1.26, .72, 0, { rx: HALF_PI, segments: 20 });
    b.torus('steelDull', .16, .025, -.55, 1.47, 0, { rx: HALF_PI, segments: 20 });
    if (detail > 0) {
      // Bolted flange faces.
      for (const [fx, fy, fz, axis] of [[-1.27, .72, 0, 'x'], [-.55, 1.48, 0, 'y']]) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const ox = axis === 'x' ? 0 : Math.cos(a) * .21;
          const oy = axis === 'x' ? Math.cos(a) * .21 : 0;
          const oz = axis === 'x' ? Math.sin(a) * .21 : Math.sin(a) * .21;
          b.cyl('steelDull', .014, .014, .03, fx + ox, fy + oy, fz + oz, {
            rx: axis === 'x' ? 0 : HALF_PI, rz: axis === 'x' ? HALF_PI : 0, segments: 6
          });
        }
      }
      // Discharge valve and gauge.
      b.cyl('pipeGreen', .15, .15, .17, -.55, 1.27, 0, { segments: 16 });
      b.torus('pipeRed', .21, .022, -.55, 1.44, 0, { rx: HALF_PI, segments: 20 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI;
        b.box('pipeRed', .04, .02, .38, -.55, 1.44, 0, 0, a);
      }
      b.cyl('steelDull', .028, .028, .2, -.55, 1.35, 0, { segments: 8 });
      b.cyl('brass', .085, .085, .04, -.32, 1.2, .1, { rx: HALF_PI, segments: 16 });
      b.cyl('paper', .07, .07, .008, -.32, 1.2, .128, { rx: HALF_PI, segments: 16 });
      b.box('darkMetal', .006, .05, .006, -.32, 1.2, .135, 0, 0, -.4);
      // Gauge and lubrication lines.
      b.pipe('steelDull', .015, [.03, 1.02, .1], [.3, 1.14, .12]);
      b.pipe('brass', .009, [-.02, .9, .18], [.25, .78, .2]);
      b.cyl('blackMetal', .025, .025, .05, .03, 1.03, .1, { segments: 8 });
      // Motor nameplate and warning label.
      b.box('brass', .2, .1, .008, .28, .9, .262);
      b.box('steelDull', .16, .05, .006, -.28, .88, .24);
    }
    if (detail > 1) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.cyl('steelDull', .012, .012, .025, -.55, .72 + Math.cos(a) * .31, Math.sin(a) * .21, {
          rx: HALF_PI, segments: 6
        });
      }
      // Lube oil sight glass, drain valve, cable and terminal box bolts.
      b.cyl('brass', .03, .03, .02, .04, .45, .22, { rx: HALF_PI, segments: 10 });
      b.pipe('rubber', .018, [.38, .98, -.12], [.72, .98, -.12], 8);
      b.pipe('rubber', .018, [.72, .98, -.12], [.72, .3, -.2], 8);
      b.cyl('steelDull', .022, .022, .1, .72, .26, -.2, { segments: 8, rx: HALF_PI });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        b.cyl('steelDull', .01, .01, .014, .3 + Math.cos(a) * .06, 1.07, Math.sin(a) * .06, { segments: 6 });
      }
      b.box('warningYellow', .16, .05, .006, .84, .9, .02);
      b.box('blackMetal', .12, .007, .004, .84, .9, .025);
    }
  };

  const hb = createBuilder(level);
  buildCore(hb, 2);
  hb.finish(high);
  const mb = createBuilder(level);
  buildCore(mb, 1);
  mb.finish(medium);
  const lb = createBuilder(level);
  buildCore(lb, 0);
  lb.finish(low);

  const lod = new THREE.LOD();
  lod.addLevel(high, 0);
  lod.addLevel(medium, 10);
  lod.addLevel(low, 22);
  lod.position.set(x, 0, z);
  level.scene.add(lod);
  level.addCollider(x - 1.0, x + 1.0, 0, 1.55, z - .62, z + .62, {
    occluder: false, bakeOccluder: false
  });
  level.addStaticGroupForCull(lod, x, .8, z, { radius: 1.2 });
  return lod;
}

export { addPallet, addToolbox, addBottle, addCan, addMug, addBucket };
