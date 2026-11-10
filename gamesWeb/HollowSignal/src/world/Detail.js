import * as THREE from 'three';
import { pipeGeometryBetween } from '../engine/Geometry.js';

/*
 * Small industrial detail kit.
 *
 * Everything here is merged into the level's static batches, so the cost of a
 * rivet, a vent louvre or a chain link is geometry only, not another draw call.
 * The helpers deliberately avoid adding colliders: dressing should deepen the
 * silhouette without changing the route through a room.
 */

const HALF_PI = Math.PI / 2;

function cosSin(angle) {
  return [Math.cos(angle), Math.sin(angle)];
}

export function localOffset(x, z, lx, lz, ry = 0) {
  const [c, s] = cosSin(ry);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

export function addBox(level, material, w, h, d, x, y, z, opts = {}) {
  return level.addStaticBox(material, w, h, d, x, y, z, opts);
}

export function addCylinder(level, material, rTop, rBot, height, x, y, z, opts = {}) {
  return level.addStaticCylinder(material, rTop, rBot, height, x, y, z, {
    segments: opts.segments || 12,
    ...opts
  });
}

export function addTorus(level, material, radius, tube, x, y, z, {
  rx = 0, ry = 0, rz = 0, radial = 6, tubular = 18, arc = Math.PI * 2
} = {}) {
  const geo = new THREE.TorusGeometry(radius, tube, radial, tubular, arc);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1)
  );
  level.staticBatch.addGeometry(geo, material, matrix);
}

export function addPipe(level, a, b, radius, material, radial = 10) {
  const geo = pipeGeometryBetween(
    new THREE.Vector3(...a),
    new THREE.Vector3(...b),
    radius,
    { radial, scale: 1.4 }
  );
  if (geo) level.staticBatch.addGeometry(geo, material);
  return geo;
}

function axisEuler(axis) {
  if (axis === 'x') return [0, 0, HALF_PI];
  if (axis === 'z') return [HALF_PI, 0, 0];
  return [0, 0, 0];
}

function boltPosition(x, y, z, axis, angle, distance) {
  const c = Math.cos(angle) * distance;
  const s = Math.sin(angle) * distance;
  if (axis === 'x') return [x, y + c, z + s];
  if (axis === 'z') return [x + c, y + s, z];
  return [x + c, y, z + s];
}

/** A hex-head fastener. Ten of these read as a machined edge at arm's length. */
export function addBolt(level, x, y, z, {
  axis = 'y', radius = .018, length = .014, material = 'steelDull', rotation = 0
} = {}) {
  const [rx, ry, rz] = axisEuler(axis);
  addCylinder(level, material, radius, radius, length, x, y, z, {
    segments: 6, rx, ry: ry + rotation, rz
  });
}

/** A pipe flange with a raised face and a ring of bolts. */
export function addFlange(level, x, y, z, {
  axis = 'x', radius = .15, thickness = .035, bolts = 6, material = 'steelDull', boltMaterial = 'darkMetal'
} = {}) {
  const [rx, ry, rz] = axisEuler(axis);
  addCylinder(level, material, radius, radius, thickness, x, y, z, {
    segments: 20, rx, ry, rz
  });
  // Small central step makes the joint catch the flashlight instead of reading
  // as one flat pancake.
  addCylinder(level, material, radius * .7, radius * .7, thickness + .014, x, y, z, {
    segments: 18, rx, ry, rz
  });
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2 + .18;
    const [bx, by, bz] = boltPosition(x, y, z, axis, a, radius * .76);
    addBolt(level, bx, by, bz, { axis, radius: .012, length: .022, material: boltMaterial });
  }
}

/** Half-round clamp around a pipe. `axis` is the direction the pipe runs. */
export function addPipeClamp(level, x, y, z, {
  axis = 'x', radius = .1, material = 'darkMetal', tube = .014
} = {}) {
  if (axis === 'x') {
    addTorus(level, material, radius * 1.05, tube, x, y, z, { ry: HALF_PI, radial: 5, tubular: 16 });
  } else if (axis === 'z') {
    addTorus(level, material, radius * 1.05, tube, x, y, z, { radial: 5, tubular: 16 });
  } else {
    addTorus(level, material, radius * 1.05, tube, x, y, z, { rx: HALF_PI, radial: 5, tubular: 16 });
  }
}

/** Threaded rods and a clamp, for pipes suspended below a slab. */
export function addPipeHanger(level, x, y, z, {
  axis = 'x', radius = .1, top = y + .55, material = 'steelDull'
} = {}) {
  const spread = radius * .92;
  if (axis === 'x') {
    for (const oz of [-spread, spread]) {
      addCylinder(level, material, .009, .009, Math.max(.08, top - y), x, y + (top - y) / 2, z + oz, { segments: 5 });
      addBolt(level, x, top, z + oz, { material: 'darkMetal', radius: .015, length: .012 });
    }
    addBox(level, material, .05, .022, spread * 2 + .06, x, y + .02, z, { scale: .5 });
  } else if (axis === 'z') {
    for (const ox of [-spread, spread]) {
      addCylinder(level, material, .009, .009, Math.max(.08, top - y), x + ox, y + (top - y) / 2, z, { segments: 5 });
      addBolt(level, x + ox, top, z, { material: 'darkMetal', radius: .015, length: .012 });
    }
    addBox(level, material, spread * 2 + .06, .022, .05, x, y + .02, z, { scale: .5 });
  }
  addPipeClamp(level, x, y, z, { axis, radius, material: 'darkMetal' });
}

/**
 * A long pipe run with optional flanges and hangers. Kept separate from the
 * simpler player-facing addPipeRun so set dressing can be as rich as the room
 * needs without every cable growing a bolt ring.
 */
export function addDetailedPipe(level, points, {
  radius = .09, material = 'pipeGreen', flangeEvery = 0, hangers = 0, hangerTop = 0, radial = 10
} = {}) {
  for (let i = 0; i < points.length - 1; i++) {
    addPipe(level, points[i], points[i + 1], radius, material, radial);
  }
  for (const p of points) {
    const geo = new THREE.SphereGeometry(radius * 1.12, 12, 8);
    geo.translate(p[0], p[1], p[2]);
    level.staticBatch.addGeometry(geo, material);
  }
  if (flangeEvery > 0) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      if (!len) continue;
      const axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
      const horizontal = Math.abs(dy) < Math.max(Math.abs(dx), Math.abs(dz));
      if (!horizontal) continue;
      const count = Math.max(1, Math.floor(len / flangeEvery));
      for (let k = 1; k <= count; k++) {
        if (k === count && i === points.length - 2) continue;
        const t = k / (count + .5);
        addFlange(level, a[0] + dx * t, a[1] + dy * t, a[2] + dz * t, {
          axis, radius: radius * 1.55, material: 'steelDull', bolts: 6
        });
      }
    }
  }
  if (hangers > 0 && hangerTop > 0) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const len = Math.hypot(dx, dz);
      if (len < 1.2 || Math.abs(a[1] - b[1]) > .06) continue;
      const axis = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
      const count = Math.max(1, Math.floor(len / hangers));
      for (let k = 0; k <= count; k++) {
        const t = count === 0 ? 0 : k / count;
        addPipeHanger(level, a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t, {
          axis, radius, top: hangerTop
        });
      }
    }
  }
}

/** A ladder flat against a wall. Built in local XY, then rotated by `ry`. */
export function addLadder(level, x, z, y0, y1, {
  ry = 0, width = .46, material = 'steelDull', rungSpacing = .3, standoff = .16
} = {}) {
  const height = y1 - y0;
  const yc = y0 + height / 2;
  for (const lx of [-width / 2, width / 2]) {
    const [wx, wz] = localOffset(x, z, lx, 0, ry);
    addBox(level, material, .045, height, .055, wx, yc, wz, { ry, scale: .6 });
  }
  const rungs = Math.max(2, Math.floor(height / rungSpacing));
  for (let i = 0; i <= rungs; i++) {
    const y = y0 + .12 + (height - .24) * (i / rungs);
    addBox(level, material, width - .02, .026, .035, x, y, z, { ry, scale: .5 });
  }
  if (standoff > 0) {
    for (let i = 0; i <= Math.floor(height / .85); i++) {
      const y = y0 + .35 + i * .85;
      if (y > y1 - .1) break;
      const [wx, wz] = localOffset(x, z, 0, standoff, ry);
      addBox(level, 'darkMetal', width + .08, .035, standoff, wx, y, wz, { ry, scale: .5 });
    }
  }
}

/** A cage around a vertical ladder, readable even in silhouette. */
export function addLadderCage(level, x, z, y0, y1, { ry = 0, width = .72 } = {}) {
  const hoops = Math.max(2, Math.floor((y1 - y0) / .75));
  for (let i = 0; i < hoops; i++) {
    const y = y0 + .6 + i * .75;
    if (y > y1) break;
    addTorus(level, 'steelDull', width / 2, .018, x, y, z, {
      rx: HALF_PI, ry: 0, rz: 0, radial: 4, tubular: 18
    });
  }
  for (const side of [-1, 1]) {
    const [wx, wz] = localOffset(x, z, side * width / 2, 0, ry);
    addBox(level, 'steelDull', .018, y1 - y0, .02, wx, (y0 + y1) / 2, wz, { ry, scale: .5 });
  }
}

/** Tray with side rails, rungs and three sagging cables. Axis-aligned. */
export function addCableTray(level, x0, z0, x1, z1, y, {
  width = .36, material = 'steelDull', cableMaterials = ['rubber', 'pipeRed', 'rubber']
} = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const a = alongX ? x0 : z0;
  const b = alongX ? x1 : z1;
  const fixed = alongX ? z0 : x0;
  const len = Math.abs(b - a);
  const mid = (a + b) / 2;
  if (len < .05) return;

  for (const side of [-1, 1]) {
    if (alongX) {
      addBox(level, material, len, .085, .035, mid, y, fixed + side * width / 2, { scale: .7 });
    } else {
      addBox(level, material, .035, .085, len, fixed + side * width / 2, y, mid, { scale: .7 });
    }
  }
  const rungs = Math.max(2, Math.floor(len / .3));
  for (let i = 0; i <= rungs; i++) {
    const p = a + (b - a) * (i / rungs);
    if (alongX) addBox(level, material, .035, .018, width, p, y - .035, fixed, { scale: .5 });
    else addBox(level, material, width, .018, .035, fixed, y - .035, p, { scale: .5 });
  }
  for (let c = 0; c < cableMaterials.length; c++) {
    const off = (c - (cableMaterials.length - 1) / 2) * .085;
    const radius = c === 1 ? .017 : .012;
    if (alongX) {
      addCylinder(level, cableMaterials[c], radius, radius, len, mid, y + .032, fixed + off, {
        segments: 8, rz: HALF_PI
      });
      addPipeClamp(level, a + len * .23, y + .032, fixed + off, { axis: 'x', radius: radius * 1.3, tube: .008 });
      addPipeClamp(level, b - len * .27, y + .032, fixed + off, { axis: 'x', radius: radius * 1.3, tube: .008 });
    } else {
      addCylinder(level, cableMaterials[c], radius, radius, len, fixed + off, y + .032, mid, {
        segments: 8, rx: HALF_PI
      });
      addPipeClamp(level, fixed + off, y + .032, a + len * .23, { axis: 'z', radius: radius * 1.3, tube: .008 });
      addPipeClamp(level, fixed + off, y + .032, b - len * .27, { axis: 'z', radius: radius * 1.3, tube: .008 });
    }
  }
  // Short brackets under the tray; their spacing lets the eye read the run.
  const brackets = Math.max(1, Math.floor(len / 2.2));
  for (let i = 0; i <= brackets; i++) {
    const p = a + (b - a) * (i / brackets);
    if (alongX) {
      addBox(level, 'darkMetal', .06, .22, .06, p, y - .16, fixed, { scale: .5 });
      addBolt(level, p, y - .27, fixed, { axis: 'x', radius: .014, length: .02 });
    } else {
      addBox(level, 'darkMetal', .06, .22, .06, fixed, y - .16, p, { scale: .5 });
      addBolt(level, fixed, y - .27, p, { axis: 'z', radius: .014, length: .02 });
    }
  }
}

/** Louvred wall or ceiling vent. Face points along local +Z, rotated by ry. */
export function addVent(level, x, y, z, {
  width = .58, height = .4, ry = 0, frame = 'paintedMetalDark', slat = 'steelDull', depth = .035, slats = 7
} = {}) {
  addBox(level, 'blackHole', width - .035, height - .035, .008, x, y, z, { ry, scale: .5 });
  addBox(level, frame, width, .035, depth, x, y + height / 2, z, { ry, scale: .6 });
  addBox(level, frame, width, .035, depth, x, y - height / 2, z, { ry, scale: .6 });
  addBox(level, frame, .035, height, depth, x - width / 2, y, z, { ry, scale: .6 });
  addBox(level, frame, .035, height, depth, x + width / 2, y, z, { ry, scale: .6 });
  for (let i = 0; i < slats; i++) {
    const sy = y - height * .33 + (i / (slats - 1)) * height * .66;
    addBox(level, slat, width - .075, .012, .026, x, sy, z + .012, {
      ry, rx: -.42, scale: .5
    });
  }
  for (const ox of [-width / 2 + .035, width / 2 - .035]) {
    for (const oy of [-height / 2 + .035, height / 2 - .035]) {
      const [wx, wz] = localOffset(x, z, ox, .023, ry);
      addBolt(level, wx, y + oy, wz, { axis: 'z', radius: .012, length: .012, rotation: ry });
    }
  }
}

/** A labelled electrical box with a hinged door, latch and conduit stubs. */
export function addJunctionBox(level, x, y, z, {
  ry = 0, width = .34, height = .4, depth = .17, material = 'paintedMetalDark', label = true, conduit = true
} = {}) {
  addBox(level, material, width, height, depth, x, y, z, { ry, scale: .8 });
  addBox(level, 'darkMetal', width * .88, height * .88, .012, x, y, z + depth / 2 + .006, { ry, scale: .6 });
  // Hinges on one side, a small latch opposite.
  for (const oy of [-height * .28, height * .28]) {
    const [hx, hz] = localOffset(x, z, -width / 2 + .012, depth / 2 + .013, ry);
    addBox(level, 'steelDull', .028, height * .16, .018, hx, y + oy, hz, { ry, scale: .4 });
  }
  const [lx, lz] = localOffset(x, z, width * .31, depth / 2 + .016, ry);
  addBox(level, 'steelDull', .06, .025, .02, lx, y, lz, { ry, scale: .4 });
  for (const ox of [-width * .38, width * .38]) {
    for (const oy of [-height * .4, height * .4]) {
      const [bx, bz] = localOffset(x, z, ox, depth / 2 + .014, ry);
      addBolt(level, bx, y + oy, bz, { axis: 'z', radius: .012, length: .012, rotation: ry });
    }
  }
  if (label) {
    const [sx, sz] = localOffset(x, z, 0, depth / 2 + .017, ry);
    addBox(level, 'warningYellow', width * .38, height * .1, .006, sx, y + height * .2, sz, { ry, scale: .4 });
  }
  if (conduit) {
    addCylinder(level, 'steelDull', .024, .024, .34, x, y + height / 2 + .17, z, { segments: 8 });
    addCylinder(level, 'steelDull', .024, .024, .24, x, y - height / 2 - .12, z, { segments: 8 });
    addPipeClamp(level, x, y + height / 2 + .1, z, { axis: 'y', radius: .026, tube: .006 });
  }
}

/** Analog pressure gauge, face pointing along local +Z. */
export function addGauge(level, x, y, z, { ry = 0, radius = .065, face = 'paper', brass = 'brass' } = {}) {
  addCylinder(level, 'darkMetal', radius * 1.18, radius * 1.18, .048, x, y, z, {
    segments: 18, rx: HALF_PI
  });
  addTorus(level, brass, radius, .008, x, y, z + .028, { radial: 5, tubular: 18 });
  addCylinder(level, face, radius * .88, radius * .88, .008, x, y, z + .03, {
    segments: 20, rx: HALF_PI
  });
  // Needle and a tiny center pin.
  addBox(level, 'darkMetal', .009, radius * .72, .004, x, y + radius * .18, z + .039, { ry, rz: -.35, scale: .3 });
  addCylinder(level, brass, .009, .009, .01, x, y, z + .043, { segments: 8, rx: HALF_PI });
  addBox(level, 'steelDull', .03, .03, .065, x, y - radius - .02, z, { scale: .4 });
}

/** Gate valve with flanged body, stem and spoked handwheel. */
export function addValveAssembly(level, x, y, z, {
  axis = 'x', radius = .15, wheelRadius = .24, material = 'pipeGreen', wheelMaterial = 'pipeRed', ry = 0
} = {}) {
  const [rx, ryE, rz] = axisEuler(axis);
  addCylinder(level, material, radius, radius, radius * 1.55, x, y, z, { segments: 16, rx, ry: ryE, rz });
  addFlange(level, x, y, z, { axis, radius: radius * 1.48, material: 'steelDull', bolts: 6 });
  // The flange in the centre doubles as the valve bonnet for the silhouette.
  addCylinder(level, material, radius * .52, radius * .7, .18, x, y + .1, z, { segments: 12 });
  addCylinder(level, 'steelDull', .028, .028, .27, x, y + .3, z, { segments: 8 });
  addTorus(level, wheelMaterial, wheelRadius, .026, x, y + .44, z, {
    rx: HALF_PI, radial: 6, tubular: 22
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI;
    addBox(level, wheelMaterial, wheelRadius * 2, .022, .03, x, y + .44, z, { ry, rz: a, scale: .5 });
  }
  addCylinder(level, 'steelDull', .055, .055, .06, x, y + .44, z, { segments: 10 });
  addBolt(level, x, y + .44, z + .07, { axis: 'z', radius: .017, length: .012 });
}

/** Vertical wide-flange column with base plate and anchor bolts. */
export function addIBeam(level, x, z, height, {
  material = 'steelDull', flange = .2, width = .26, base = true
} = {}) {
  addBox(level, material, .065, height, flange * .85, x, height / 2, z, { scale: .9 });
  for (const oz of [-flange * .38, flange * .38]) {
    addBox(level, material, width, height, .035, x, height / 2, z + oz, { scale: .8 });
  }
  if (base) {
    addBox(level, 'darkMetal', width + .16, .035, flange + .16, x, .018, z, { scale: .7 });
    for (const ox of [-width * .36, width * .36]) {
      for (const oz of [-flange * .36, flange * .36]) {
        addBolt(level, x + ox, .05, z + oz, { radius: .022, length: .05, material: 'steelDull' });
      }
    }
  }
  addBox(level, 'darkMetal', width + .04, .025, flange + .04, x, height - .015, z, { scale: .6 });
}

/** Horizontal overhead crane girder / structural beam. */
export function addIBeamX(level, x0, x1, y, z, {
  material = 'steelDull', depth = .24, web = .055, flange = .035
} = {}) {
  const len = Math.abs(x1 - x0);
  const cx = (x0 + x1) / 2;
  addBox(level, material, len, .045, depth, cx, y + .11, z, { scale: 1.2 });
  addBox(level, material, len, .045, depth, cx, y - .11, z, { scale: 1.2 });
  addBox(level, material, len, .18, web, cx, y, z, { scale: 1.2 });
  for (const x of [x0, x1]) {
    addBox(level, 'darkMetal', .045, .3, depth + .03, x, y, z, { scale: .6 });
  }
}

export function addIBeamZ(level, z0, z1, y, x, {
  material = 'steelDull', depth = .24
} = {}) {
  const len = Math.abs(z1 - z0);
  const cz = (z0 + z1) / 2;
  addBox(level, material, .24, .045, len, x, y + .11, cz, { scale: 1.2 });
  addBox(level, material, .24, .045, len, x, y - .11, cz, { scale: 1.2 });
  addBox(level, material, .055, .18, len, x, y, cz, { scale: 1.2 });
  for (const z of [z0, z1]) {
    addBox(level, 'darkMetal', .27, .3, .045, x, y, z, { scale: .6 });
  }
}

/** Hanging chain, with alternating link planes, ending in a simple hook. */
export function addChain(level, x, y, z, length, { links = Math.max(3, Math.floor(length / .13)), material = 'steelDull' } = {}) {
  for (let i = 0; i < links; i++) {
    const ly = y - i * (length / links);
    addTorus(level, material, .032, .009, x, ly, z, {
      rx: i % 2 ? HALF_PI : 0, radial: 4, tubular: 10
    });
  }
  addTorus(level, material, .05, .012, x, y - length - .04, z, {
    rx: HALF_PI, rz: .4, radial: 4, tubular: 12, arc: Math.PI * 1.45
  });
}

/** Floor drain with a cast frame and parallel grate bars. */
export function addFloorGrate(level, x, z, width = .6, depth = .8, { y = .008, bars = 7 } = {}) {
  addBox(level, 'blackHole', width - .03, .008, depth - .03, x, y - .004, z, { scale: .5 });
  addBox(level, 'steelDull', width, .028, .035, x, y, z - depth / 2, { scale: .5 });
  addBox(level, 'steelDull', width, .028, .035, x, y, z + depth / 2, { scale: .5 });
  addBox(level, 'steelDull', .035, .028, depth, x - width / 2, y, z, { scale: .5 });
  addBox(level, 'steelDull', .035, .028, depth, x + width / 2, y, z, { scale: .5 });
  for (let i = 1; i < bars; i++) {
    addBox(level, 'darkMetal', .018, .022, depth - .06, x - width / 2 + (width * i / bars), y, z, { scale: .4 });
  }
}

/** Alternating yellow/black blocks along a floor edge or threshold. */
export function addHazardBand(level, x0, z0, x1, z1, {
  y = .012, width = .1, block = .22, materialA = 'warningYellow', materialB = 'blackMetal'
} = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < .1) return;
  const dx = (x1 - x0) / len;
  const dz = (z1 - z0) / len;
  const count = Math.max(1, Math.floor(len / block));
  const ry = Math.atan2(dx, dz);
  for (let i = 0; i < count; i++) {
    const t = (i + .5) / count;
    addBox(level, i % 2 ? materialB : materialA, width, .012, block * .92, x0 + dx * len * t, y, z0 + dz * len * t, {
      ry, scale: .5
    });
  }
}

export function addPallet(level, x, z, { rotation = 0, width = .95, depth = 1.1, material = 'woodPale' } = {}) {
  for (const oz of [-depth * .34, 0, depth * .34]) {
    for (const ox of [-width * .34, width * .34]) {
      const [wx, wz] = localOffset(x, z, ox, oz, rotation);
      addBox(level, 'woodDark', .12, .09, .16, wx, .045, wz, { ry: rotation, scale: .5 });
    }
  }
  for (let i = 0; i < 5; i++) {
    const ox = -width / 2 + .1 + (i / 4) * (width - .2);
    const [wx, wz] = localOffset(x, z, ox, 0, rotation);
    addBox(level, material, .14, .026, depth, wx, .105, wz, { ry: rotation, scale: .5 });
  }
  // A couple of loose boards make it read as used, not showroom stock.
  const [bx, bz] = localOffset(x, z, width * .2, depth * .05, rotation);
  addBox(level, 'cardboard', width * .72, .04, depth * .8, bx, .15, bz, { ry: rotation + .035, scale: .5 });
}

export function addToolbox(level, x, y, z, { ry = 0, material = 'safetyRed' } = {}) {
  addBox(level, material, .46, .18, .22, x, y + .09, z, { ry, scale: .6 });
  addBox(level, material, .46, .035, .22, x, y + .195, z, { ry, scale: .5 });
  const [hx, hz] = localOffset(x, z, 0, 0, ry);
  addBox(level, 'steelDull', .2, .026, .025, hx, y + .235, hz, { ry, scale: .4 });
  for (const lx of [-.15, .15]) {
    const [wx, wz] = localOffset(x, z, lx, -.112, ry);
    addBox(level, 'steelDull', .035, .05, .012, wx, y + .17, wz, { ry, scale: .3 });
  }
}

export function addBucket(level, x, z, { y = 0, radius = .14, material = 'steelDull' } = {}) {
  addCylinder(level, material, radius * .82, radius, .26, x, y + .13, z, { segments: 14 });
  addTorus(level, 'darkMetal', radius * .84, .009, x, y + .265, z, { rx: HALF_PI, radial: 4, tubular: 12 });
  addTorus(level, 'darkMetal', radius * .96, .009, x, y + .05, z, { rx: HALF_PI, radial: 4, tubular: 12 });
  addTorus(level, 'steelDull', radius * 1.02, .008, x, y + .27, z, {
    rz: .4, rx: 0, radial: 4, tubular: 12, arc: Math.PI * 1.2
  });
}

export function addBottle(level, x, y, z, { material = 'glass', height = .22, radius = .035, ry = 0 } = {}) {
  addCylinder(level, material, radius, radius, height, x, y + height / 2, z, { segments: 10 });
  addCylinder(level, material, radius * .45, radius * .75, .075, x, y + height + .035, z, { segments: 10 });
  addBox(level, 'paper', radius * 1.1, height * .34, .004, x, y + height * .45, z + radius, { ry, scale: .3 });
}

export function addCan(level, x, y, z, { material = 'steelDull', height = .11, radius = .045 } = {}) {
  addCylinder(level, material, radius, radius, height, x, y + height / 2, z, { segments: 10 });
  addCylinder(level, 'darkMetal', radius * .9, radius * .9, .006, x, y + height + .002, z, { segments: 10 });
}

export function addMug(level, x, y, z, { material = 'ceramic' } = {}) {
  addCylinder(level, material, .043, .038, .085, x, y + .043, z, { segments: 10 });
  addTorus(level, material, .028, .008, x + .044, y + .047, z, {
    rx: HALF_PI, rz: HALF_PI, radial: 4, tubular: 10
  });
}

export function addBoots(level, x, z, { ry = 0, y = 0 } = {}) {
  for (const side of [-.1, .1]) {
    const [bx, bz] = localOffset(x, z, side, 0, ry);
    addBox(level, 'rubber', .12, .24, .26, bx, y + .12, bz, { ry, scale: .5 });
    addBox(level, 'rubber', .13, .065, .3, bx, y + .032, bz + .08, { ry, scale: .5 });
  }
}

export function addHardHat(level, x, y, z, { material = 'warningYellow' } = {}) {
  addCylinder(level, material, .11, .14, .035, x, y + .018, z, { segments: 16 });
  const geo = new THREE.SphereGeometry(.14, 16, 8, 0, Math.PI * 2, 0, Math.PI * .5);
  geo.scale(1, .55, 1);
  const m = new THREE.Matrix4().makeTranslation(x, y + .04, z);
  level.staticBatch.addGeometry(geo, material, m);
}

export function addFireExtinguisher(level, x, y, z, { ry = 0, material = 'safetyRed' } = {}) {
  const [wx, wz] = localOffset(x, z, 0, 0, ry);
  addCylinder(level, material, .085, .075, .4, wx, y + .3, wz, { segments: 14 });
  addCylinder(level, 'darkMetal', .045, .05, .07, wx, y + .53, wz, { segments: 10 });
  addBox(level, 'blackMetal', .045, .035, .02, wx, y + .575, wz, { ry, scale: .3 });
  addBox(level, 'steelDull', .2, .025, .025, wx, y + .47, wz, { ry, scale: .3 });
  addTorus(level, 'rubber', .045, .008, wx, y + .7, wz, { rx: HALF_PI, radial: 4, tubular: 12 });
  addBox(level, 'paper', .1, .13, .005, wx, y + .34, wz + .085, { ry, scale: .4 });
  addBox(level, 'blackMetal', .17, .04, .08, wx, y + .19, wz, { ry, scale: .4 });
  // Wall bracket.
  addBox(level, 'steelDull', .22, .035, .02, wx, y + .47, wz - .095, { ry, scale: .4 });
  addBox(level, 'steelDull', .03, .3, .03, wx, y + .3, wz - .1, { ry, scale: .3 });
}

export function addWallClock(level, x, y, z, { ry = 0, radius = .16 } = {}) {
  addCylinder(level, 'darkMetal', radius, radius, .045, x, y, z, { segments: 24, rx: HALF_PI, ry });
  addTorus(level, 'steelDull', radius, .012, x, y, z + .027, { radial: 5, tubular: 22 });
  addCylinder(level, 'paper', radius * .88, radius * .88, .006, x, y, z + .028, {
    segments: 24, rx: HALF_PI
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    addBox(level, 'darkMetal', .012, i % 3 === 0 ? .035 : .022, .003,
      x + Math.sin(a) * radius * .72, y + Math.cos(a) * radius * .72, z + .034, { ry, scale: .3 });
  }
  addBox(level, 'darkMetal', .012, radius * .56, .004, x, y + radius * .22, z + .038, { ry, rz: .55, scale: .3 });
  addBox(level, 'darkMetal', .01, radius * .42, .004, x, y + radius * .11, z + .041, { ry, rz: -1.6, scale: .3 });
}

export function addFirstAidBox(level, x, y, z, { ry = 0 } = {}) {
  addBox(level, 'whitePaint', .42, .32, .12, x, y, z, { ry, scale: .6 });
  addBox(level, 'safetyRed', .18, .055, .01, x, y + .02, z + .065, { ry, scale: .3 });
  addBox(level, 'safetyRed', .055, .18, .01, x, y + .02, z + .065, { ry, scale: .3 });
  addBox(level, 'darkMetal', .025, .07, .012, x + .18, y + .04, z + .065, { ry, scale: .3 });
}

export function addSecurityCamera(level, x, y, z, { ry = 0, facing = 1 } = {}) {
  addBox(level, 'paintedMetalDark', .08, .08, .16, x, y, z - facing * .08, { ry, scale: .4 });
  addBox(level, 'steelDull', .16, .14, .26, x, y + .02, z - facing * .2, { ry, rx: -.12, scale: .5 });
  addCylinder(level, 'blackGloss', .055, .06, .055, x, y + .02, z - facing * .34, { segments: 12, rx: HALF_PI });
  addTorus(level, 'steelDull', .055, .008, x, y + .02, z - facing * .37, { radial: 4, tubular: 14 });
  addBox(level, 'emissiveRed', .012, .012, .006, x + .05, y + .055, z - facing * .33, { ry, scale: .2 });
}

export function addWallLamp(level, x, y, z, {
  ry = 0, material = 'emissiveWarm', cage = true, color = 'paintedMetalDark'
} = {}) {
  addBox(level, color, .16, .1, .1, x, y, z, { ry, scale: .5 });
  addBox(level, color, .08, .04, .2, x, y + .04, z, { ry, scale: .4 });
  addBox(level, material, .1, .12, .07, x, y - .02, z, { ry, scale: .3 });
  if (cage) {
    for (const lx of [-.045, .045]) {
      for (const lz of [-.03, .03]) {
        addBox(level, 'darkMetal', .008, .14, .008, x + lx, y - .03, z + lz, { ry, scale: .3 });
      }
    }
    addBox(level, 'darkMetal', .11, .008, .075, x, y + .045, z, { ry, scale: .3 });
    addBox(level, 'darkMetal', .11, .008, .075, x, y - .1, z, { ry, scale: .3 });
  }
}

export function addHoseReel(level, x, y, z, { ry = 0 } = {}) {
  addBox(level, 'paintedMetalDark', .08, .42, .38, x, y, z, { ry, scale: .6 });
  addCylinder(level, 'steelDull', .19, .19, .2, x + .08, y, z, { segments: 18, rx: HALF_PI, ry });
  addTorus(level, 'rubber', .15, .024, x + .2, y, z, { rx: HALF_PI, radial: 5, tubular: 18 });
  addTorus(level, 'rubber', .1, .024, x + .2, y, z, { rx: HALF_PI, radial: 5, tubular: 18 });
  addBox(level, 'brass', .06, .08, .16, x + .22, y - .18, z, { ry, scale: .4 });
  addBox(level, 'safetyRed', .03, .02, .06, x + .24, y - .23, z, { ry, scale: .3 });
}

export function addKeg(level, x, z, { y = 0, radius = .18, height = .45 } = {}) {
  addCylinder(level, 'steelDull', radius, radius, height, x, y + height / 2, z, { segments: 16 });
  addTorus(level, 'steelDull', radius + .008, .012, x, y + height * .2, z, { rx: HALF_PI, radial: 4, tubular: 14 });
  addTorus(level, 'steelDull', radius + .008, .012, x, y + height * .8, z, { rx: HALF_PI, radial: 4, tubular: 14 });
  addCylinder(level, 'darkMetal', .05, .05, .06, x, y + height + .02, z, { segments: 8 });
}

export function addWrenchSet(level, x, y, z, { ry = 0, count = 4, material = 'steelDull' } = {}) {
  for (let i = 0; i < count; i++) {
    const ox = (i - (count - 1) / 2) * .075;
    const [wx, wz] = localOffset(x, z, ox, 0, ry);
    addBox(level, material, .022, .2 - i * .015, .012, wx, y, wz, { ry, scale: .3 });
    addTorus(level, material, .025, .006, wx, y + (.1 - i * .007), wz, {
      rx: HALF_PI, radial: 4, tubular: 8
    });
  }
}
