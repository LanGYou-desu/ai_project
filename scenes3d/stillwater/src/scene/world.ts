import * as THREE from 'three';
import {
  COLORS, COLONNADE, HALL, POOL, WATER_LEVELS, WATER_Y, WINDOW_Y, WINDOW_Z,
  type Color3, type Vec3,
} from './constants';
import {
  SurfaceBuilder, addColorAttribute, archBand, chromeTube, makeSurface,
  placeWallGeometry, wallWithOpenings, type SurfaceMeta,
} from './geometry';
import { buildEmitters } from './lights';

const TILE_FLOOR = 0.1;
const TILE_WALL = 0.115;
const TILE_POOL = 0.075;
const TILE_COLUMN = 0.1;
const TILE_VAULT = 0.155;

function mul(c: Color3, m: number): Color3 {
  return [c[0] * m, c[1] * m, c[2] * m];
}
function mix(a: Color3, b: Color3, t: number): Color3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const tileMeta: SurfaceMeta = { kind: 'tile', color: COLORS.tile, albedo: COLORS.tile, roughness: 0.16 };
const paintMeta: SurfaceMeta = { kind: 'paint', color: COLORS.paint, albedo: COLORS.paint, roughness: 0.5 };
const metalMeta: SurfaceMeta = { kind: 'metal', color: COLORS.chrome, albedo: [0.16, 0.165, 0.16], roughness: 0.22 };
const redMeta: SurfaceMeta = { kind: 'plastic', color: COLORS.red, albedo: COLORS.red, roughness: 0.26, clearcoat: 0.8 };
const yellowMeta: SurfaceMeta = { kind: 'plastic', color: COLORS.yellow, albedo: COLORS.yellow, roughness: 0.28, clearcoat: 0.7 };
const orangeMeta: SurfaceMeta = { kind: 'plastic', color: COLORS.orange, albedo: COLORS.orange, roughness: 0.28, clearcoat: 0.7 };
const blueMeta: SurfaceMeta = { kind: 'plastic', color: COLORS.blue, albedo: COLORS.blue, roughness: 0.28, clearcoat: 0.7 };
const creamMeta: SurfaceMeta = { kind: 'plastic', color: [0.82, 0.79, 0.68], albedo: [0.82, 0.79, 0.68], roughness: 0.3, clearcoat: 0.6 };
const slideMeta: SurfaceMeta = { kind: 'slide', color: COLORS.slide, albedo: COLORS.slide, roughness: 0.18, clearcoat: 1.0 };
const slideInnerMeta: SurfaceMeta = { kind: 'slide', color: COLORS.slideInside, albedo: COLORS.slideInside, roughness: 0.3, clearcoat: 0.7 };
const emissiveMeta: SurfaceMeta = { kind: 'emissive', color: [1, 1, 1], albedo: [0, 0, 0], emissiveIntensity: 1 };
const decalMeta: SurfaceMeta = { kind: 'decal', color: [1, 1, 1], albedo: [0, 0, 0] };

function flush(group: THREE.Group, name: string, builder: SurfaceBuilder, meta: SurfaceMeta) {
  if (builder.vertexCount === 0) return null;
  const mesh = makeSurface(builder.build(), meta, name);
  group.add(mesh);
  return mesh;
}

function addPipe(builder: SurfaceBuilder, points: Vec3[], radius: number, color: Color3, tileSize = 0, tubular = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.25);
  const geo = new THREE.TubeGeometry(curve, tubular, radius, 8, false);
  addColorAttribute(geo, color);
  const tile = new Float32Array(geo.getAttribute('position').count).fill(tileSize);
  geo.setAttribute('aTileSize', new THREE.BufferAttribute(tile, 1));
  builder.append(geo);
}

function addBox(builder: SurfaceBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Color3, tileSize = 0, opts?: { top?: boolean; bottom?: boolean; side?: boolean }) {
  builder.box(x0, y0, z0, x1, y1, z1, color, tileSize, opts);
  return builder;
}

/** Add a chrome railing with posts along a path, height relative to floor or given y. */
function addRailing(metal: SurfaceBuilder, points: Vec3[], railY: (p: Vec3) => number, height = 1.02, postEvery = 1.1) {
  const top: Vec3[] = points.map((p) => [p[0], railY(p) + height, p[2]]);
  addPipe(metal, top, 0.028, COLORS.chrome, 0, 80);
  // posts
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(2, Math.ceil(len / postEvery));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[2] + (b[2] - a[2]) * t;
      const y = railY([x, 0, z]);
      const post: Vec3[] = [[x, y, z], [x, y + height, z]];
      addPipe(metal, post, 0.019, COLORS.chrome, 0, 10);
    }
  }
}

function addWindowAssembly(
  tileB: SurfaceBuilder, paintB: SurfaceBuilder, emissiveB: SurfaceBuilder,
  side: -1 | 1, z: number,
) {
  const xWall = side * 12.0;
  const xIn = side * 11.96;
  const xBack = side * 12.225;
  const zHalf = 0.58;
  const y0 = WINDOW_Y[0], y1 = WINDOW_Y[1];
  const n = -side; // normal pointing into the room

  // Emissive pane, facing the room.
  const ec = side === -1 ? [2.05, 1.9, 1.62] : [1.55, 1.78, 2.0];
  if (side === -1) {
    emissiveB.rect([xBack, y0, z - zHalf - 0.02], [0, y1 - y0 + 0.04, 0], [0, 0, zHalf * 2 + 0.04], ec as Color3, 0);
  } else {
    emissiveB.rect([xBack, y0, z - zHalf - 0.02], [0, 0, zHalf * 2 + 0.04], [0, y1 - y0 + 0.04, 0], ec as Color3, 0);
  }

  // Recess / reveal box.
  const reveal = 0.24;
  const outward = side; // away from the room
  const x0 = xWall, x1 = xWall + outward * reveal;
  addBox(paintB, Math.min(x0, x1), y1, z - zHalf - 0.035, Math.max(x0, x1), y1 + 0.035, z + zHalf + 0.035, COLORS.paint);
  addBox(paintB, Math.min(x0, x1), y0 - 0.035, z - zHalf - 0.035, Math.max(x0, x1), y0, z + zHalf + 0.035, COLORS.paint);
  addBox(paintB, Math.min(x0, x1), y0, z - zHalf - 0.035, Math.max(x0, x1), y1, z - zHalf, COLORS.paint);
  addBox(paintB, Math.min(x0, x1), y0, z + zHalf, Math.max(x0, x1), y1, z + zHalf + 0.035, COLORS.paint);

  // Front architrave.
  const fw = 0.075;
  const fx0 = side * 11.925, fx1 = side * 11.985;
  addBox(paintB, Math.min(fx0, fx1), y0 - 0.06, z - zHalf - fw, Math.max(fx0, fx1), y0, z + zHalf + fw, COLORS.paint);
  addBox(paintB, Math.min(fx0, fx1), y1, z - zHalf - fw, Math.max(fx0, fx1), y1 + 0.06, z + zHalf + fw, COLORS.paint);
  addBox(paintB, Math.min(fx0, fx1), y0, z - zHalf - fw, Math.max(fx0, fx1), y1, z - zHalf, COLORS.paint);
  addBox(paintB, Math.min(fx0, fx1), y0, z + zHalf, Math.max(fx0, fx1), y1, z + zHalf + fw, COLORS.paint);

  // Sill
  addBox(paintB, Math.min(side * 11.8, side * 11.93), y0 - 0.12, z - zHalf - 0.16, Math.max(side * 11.8, side * 11.93), y0 - 0.05, z + zHalf + 0.16, COLORS.paint);

  // Mullions (against the glowing pane, slightly in front)
  const mx0 = side * 12.19, mx1 = side * 12.155;
  addBox(paintB, Math.min(mx0, mx1), y0, z - 0.026, Math.max(mx0, mx1), y1, z + 0.026, COLORS.paint);
  for (const yy of [y0 + (y1 - y0) * 0.34, y0 + (y1 - y0) * 0.68]) {
    addBox(paintB, Math.min(mx0, mx1), yy - 0.022, z - zHalf, Math.max(mx0, mx1), yy + 0.022, z + zHalf, COLORS.paint);
  }
}

function addSideWall(
  group: THREE.Group, tileB: SurfaceBuilder, paintB: SurfaceBuilder, emissiveB: SurfaceBuilder,
  side: -1 | 1,
) {
  const length = HALL.zMax - HALL.zMin;
  const height = HALL.vaultSpringY;
  const holes: Array<{ x0: number; x1: number; y0: number; y1: number; arch?: boolean }> = [];

  // Windows
  for (const z of WINDOW_Z) {
    const u = side === -1 ? HALL.zMax - z : z - HALL.zMin;
    holes.push({ x0: u - 0.58, x1: u + 0.58, y0: WINDOW_Y[0], y1: WINDOW_Y[1] });
  }
  // Doors in the lower wall.
  const doorZs = side === -1 ? [-12.0, 14.35] : [-12.0];
  for (const z of doorZs) {
    const u = side === -1 ? HALL.zMax - z : z - HALL.zMin;
    const y0 = z === 14.35 ? 3.2 : 0;
    const y1 = z === 14.35 ? 6.2 : 3.15;
    holes.push({ x0: u - 0.95, x1: u + 0.95, y0, y1, arch: z === 14.35 });
  }

  const geo = wallWithOpenings(length, height, holes, COLORS.tile, TILE_WALL);
  if (side === -1) {
    placeWallGeometry(geo, [-12, 0, HALL.zMax], [0, 0, -1], [0, 1, 0]);
  } else {
    placeWallGeometry(geo, [12, 0, HALL.zMin], [0, 0, 1], [0, 1, 0]);
  }
  tileB.append(geo);
  geo.dispose();

  for (const z of WINDOW_Z) addWindowAssembly(tileB, paintB, emissiveB, side, z);

  // Doors
  for (const z of doorZs) {
    const y0 = z === 14.35 ? 3.2 : 0;
    const y1 = z === 14.35 ? 6.2 : 3.15;
    const sideX = side * 12.03;
    // recessed dark door leaves
    addBox(paintB, Math.min(sideX, sideX + side * 0.04), y0 + 0.03, z - 0.94, Math.max(sideX, sideX + side * 0.04), y1 - 0.03, z + 0.94, COLORS.door);
    // door gap
    addBox(paintB, Math.min(sideX, sideX + side * 0.05), y0 + 0.03, z - 0.012, Math.max(sideX, sideX + side * 0.05), y1 - 0.03, z + 0.012, [0.02, 0.04, 0.038]);
    // frame
    const fx = side * 11.97;
    addBox(paintB, Math.min(fx, fx + side * 0.03), y0, z - 1.05, Math.max(fx, fx + side * 0.03), y1 + 0.06, z - 0.95, COLORS.paint);
    addBox(paintB, Math.min(fx, fx + side * 0.03), y0, z + 0.95, Math.max(fx, fx + side * 0.03), y1 + 0.06, z + 1.05, COLORS.paint);
    addBox(paintB, Math.min(fx, fx + side * 0.03), y1, z - 1.05, Math.max(fx, fx + side * 0.03), y1 + 0.08, z + 1.05, COLORS.paint);
    // handles
    const hx = side * 11.9;
    addBox(paintB, Math.min(hx, hx + side * 0.03), y0 + 1.0, z - 0.14, Math.max(hx, hx + side * 0.03), y0 + 1.1, z - 0.1, COLORS.chrome);
    addBox(paintB, Math.min(hx, hx + side * 0.03), y0 + 1.0, z + 0.1, Math.max(hx, hx + side * 0.03), y0 + 1.1, z + 0.14, COLORS.chrome);
  }

  // Sconces
  const sconceZ = [-24.0, -16.5, -9.0, -1.5, 6.0, 13.5];
  for (const z of sconceZ) {
    const xPlate = side * 11.99;
    const plate = new THREE.CylinderGeometry(0.155, 0.155, 0.035, 24);
    plate.rotateZ(Math.PI / 2);
    plate.translate(side * 11.955, 4.75, z);
    addColorAttribute(plate, COLORS.chrome);
    tileB.append(plate);
    plate.dispose();

    const stem = new THREE.CylinderGeometry(0.032, 0.032, 0.18, 12);
    stem.rotateZ(Math.PI / 2);
    stem.translate(side * 11.84, 4.75, z);
    addColorAttribute(stem, COLORS.chrome);
    tileB.append(stem);
    stem.dispose();

    const globe = new THREE.SphereGeometry(0.175, 24, 16);
    globe.translate(side * 11.68, 4.75, z);
    addColorAttribute(globe, [3.0, 1.72, 0.72]);
    emissiveB.append(globe);
    globe.dispose();
  }
}

function addVault(group: THREE.Group, tileB: SurfaceBuilder, paintB: SurfaceBuilder, emissiveB: SurfaceBuilder) {
  const { vaultSpringY: s, vaultCrownY: c, vaultRadiusX: rx, slotHalf: sh } = HALL;
  const rise = c - s;

  function surfaceY(x: number) {
    const t = Math.max(0, 1 - (x / rx) * (x / rx));
    return s + rise * Math.sqrt(t);
  }
  function normalAt(x: number): Vec3 {
    // inward normal of y = s + rise*sqrt(1-(x/rx)^2)
    const t = Math.max(0.0001, 1 - (x / rx) * (x / rx));
    const dy = -rise * x / (rx * rx) / Math.sqrt(t);
    const n = new THREE.Vector3(dy, -1, 0).normalize();
    return [n.x, n.y, n.z];
  }

  const xSpans = [[-rx, -sh], [sh, rx]];
  const segX = 54;
  const segZ = 64;
  for (const [xa, xb] of xSpans) {
    for (let i = 0; i < segX; i++) {
      const x0 = xa + (xb - xa) * (i / segX);
      const x1 = xa + (xb - xa) * ((i + 1) / segX);
      const y0 = surfaceY(x0), y1 = surfaceY(x1);
      const n0 = normalAt(x0), n1 = normalAt(x1);
      const z0 = HALL.zMin, z1 = HALL.zMax;
      tileB.smoothQuad(
        [x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1],
        n0, n1, n1, n0,
        COLORS.tileWarm, TILE_VAULT,
        [0, 0], [0, 0], [0, 0], [0, 0],
      );
    }
  }

  // Ribs aligned with the arcade columns.
  const ribZ = [-27.5, -22, -16.5, -11, -5.5, 0, 5.5, 11, 16.5];
  for (const z of ribZ) {
    const half = 0.17, depth = 0.105;
    for (const [xa, xb] of xSpans) {
      for (let i = 0; i < segX; i++) {
        const x0 = xa + (xb - xa) * (i / segX);
        const x1 = xa + (xb - xa) * ((i + 1) / segX);
        const y0 = surfaceY(x0) - depth, y1 = surfaceY(x1) - depth;
        const n0 = normalAt(x0), n1 = normalAt(x1);
        const zb0 = z - half, zb1 = z + half;
        // underside
        tileB.smoothQuad(
          [x0, y0, zb0], [x1, y1, zb0], [x1, y1, zb1], [x0, y0, zb1],
          n0, n1, n1, n0, COLORS.tile, TILE_VAULT,
          [0, 0], [0, 0], [0, 0], [0, 0],
        );
        // side walls of the rib
        const sy0 = surfaceY(x0), sy1 = surfaceY(x1);
        tileB.smoothQuad(
          [x0, sy0, zb0], [x1, sy1, zb0], [x1, y1, zb0], [x0, y0, zb0],
          [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
          COLORS.tile, TILE_VAULT, [0, 0], [0, 0], [0, 0], [0, 0],
        );
        tileB.smoothQuad(
          [x0, sy0, zb1], [x0, y0, zb1], [x1, y1, zb1], [x1, sy1, zb1],
          [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
          COLORS.tile, TILE_VAULT, [0, 0], [0, 0], [0, 0], [0, 0],
        );
      }
    }
  }

  // Skylight well walls.
  const slotBaseY = surfaceY(sh);
  for (const side of [-1, 1]) {
    const x = side * sh;
    // vertical face facing toward the slot centre
    addBox(paintB, Math.min(x, x - side * 0.06), slotBaseY, HALL.zMin, Math.max(x, x - side * 0.06), HALL.skylightY, HALL.zMax, COLORS.paint);
  }
  // Slot cornice
  addBox(paintB, -sh - 0.12, slotBaseY - 0.12, HALL.zMin, sh + 0.12, slotBaseY, HALL.zMax, COLORS.paint);

  // Skylight emissive plane
  emissiveB.rect([-sh + 0.02, HALL.skylightY - 0.01, HALL.zMin], [sh * 2 - 0.04, 0, 0], [0, 0, HALL.zMax - HALL.zMin], [2.45, 2.72, 2.82], 0);

  // Skylight mullions
  for (let z = HALL.zMin + 1.2; z < HALL.zMax; z += 2.2) {
    addBox(paintB, -sh, HALL.skylightY - 0.16, z - 0.045, sh, HALL.skylightY - 0.035, z + 0.045, COLORS.paint);
  }
  for (const x of [-0.72, 0, 0.72]) {
    addBox(paintB, x - 0.026, HALL.skylightY - 0.12, HALL.zMin, x + 0.026, HALL.skylightY - 0.04, HALL.zMax, COLORS.paint);
  }

  // Warm cove at the springline. A shallow cornice conceals the strip; its
  // light grazes the barrel and gives the upper volume a soft cream glow.
  for (const side of [-1, 1] as const) {
    const xOuter = side * 11.98;
    const xInner = side * 11.46;
    addBox(tileB, Math.min(xOuter, xInner), 12.72, HALL.zMin, Math.max(xOuter, xInner), 12.84, HALL.zMax, COLORS.tileWarm, 0.2);
    addBox(paintB, side * 11.4, 12.84, HALL.zMin, side * 11.47, 12.91, HALL.zMax, COLORS.paint);
    const x0 = side < 0 ? -11.7 : 11.58;
    emissiveB.rect(
      [x0, 12.852, HALL.zMin + 2.0],
      [0, 0, HALL.zMax - HALL.zMin - 4.0],
      [0.12, 0, 0],
      [2.0, 1.25, 0.64], 0,
    );
  }

  // Tympanum walls closing the vault at both ends, from the wall head to the crown.
  for (const end of [-1, 1] as const) {
    const z = end === -1 ? HALL.zMin : HALL.zMax;
    for (let i = 0; i < 72; i++) {
      const x0 = -rx + (2 * rx) * (i / 72);
      const x1 = -rx + (2 * rx) * ((i + 1) / 72);
      const t0 = surfaceY(x0), t1 = surfaceY(x1);
      const b = 12.8;
      if (end === -1) {
        tileB.smoothQuad(
          [x0, b, z], [x1, b, z], [x1, t1, z], [x0, t0, z],
          [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
          COLORS.tileWarm, TILE_VAULT,
          [0, 0], [0, 0], [0, 0], [0, 0],
        );
      } else {
        tileB.smoothQuad(
          [x1, b, z], [x0, b, z], [x0, t0, z], [x1, t1, z],
          [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
          COLORS.tileWarm, TILE_VAULT,
          [0, 0], [0, 0], [0, 0], [0, 0],
        );
      }
    }
  }

  // Cove ledge + warm strip at the springline.
  for (const side of [-1, 1]) {
    const xIn = side * 11.52, xOut = side * 12.0;
    addBox(paintB, Math.min(xIn, xOut), 12.55, HALL.zMin + 0.4, Math.max(xIn, xOut), 12.72, HALL.zMax - 0.4, COLORS.paint);
    addBox(paintB, Math.min(side * 11.32, xIn), 12.72, HALL.zMin + 0.4, Math.max(side * 11.32, xIn), 12.82, HALL.zMax - 0.4, COLORS.paint);
    addBox(emissiveB, Math.min(side * 11.72, side * 11.86), 12.83, HALL.zMin + 0.6, Math.max(side * 11.72, side * 11.86), 12.89, HALL.zMax - 0.6, [2.2, 1.03, 0.43]);
  }
}

function addColonnade(group: THREE.Group, tileB: SurfaceBuilder, paintB: SurfaceBuilder) {
  const { x: cx, columnHalf: ch, zStart, zEnd, spacing } = COLONNADE;
  const count = Math.round((zEnd - zStart) / spacing);
  for (const side of [-1, 1]) {
    const x = side * cx;
    for (let i = 0; i <= count; i++) {
      const z = zStart + i * spacing;
      // plinth
      addBox(tileB, x - ch - 0.13, 0, z - ch - 0.13, x + ch + 0.13, 0.24, z + ch + 0.13, COLORS.teal, 0.055);
      addBox(tileB, x - ch - 0.08, 0.24, z - ch - 0.08, x + ch + 0.08, 0.37, z + ch + 0.08, COLORS.tile, TILE_COLUMN);
      // shaft
      addBox(tileB, x - ch, 0.37, z - ch, x + ch, 5.0, z + ch, COLORS.tile, TILE_COLUMN);
      // teal bands
      addBox(tileB, x - ch - 0.012, 1.02, z - ch - 0.012, x + ch + 0.012, 1.38, z + ch + 0.012, COLORS.teal, 0.05, { top: false, bottom: false });
      addBox(tileB, x - ch - 0.012, 4.72, z - ch - 0.012, x + ch + 0.012, 4.84, z + ch + 0.012, COLORS.teal, 0.05, { top: false, bottom: false });
      // capital
      addBox(tileB, x - ch - 0.035, 5.0, z - ch - 0.035, x + ch + 0.035, 5.16, z + ch + 0.035, COLORS.tile, 0.09);
      addBox(tileB, x - ch - 0.09, 5.16, z - ch - 0.09, x + ch + 0.09, 5.3, z + ch + 0.09, COLORS.tile, 0.09);
      addBox(tileB, x - ch - 0.15, 5.3, z - ch - 0.15, x + ch + 0.15, 5.44, z + ch + 0.15, COLORS.tile, 0.09);
      addBox(tileB, x - ch - 0.19, 5.44, z - ch - 0.19, x + ch + 0.19, 5.58, z + ch + 0.19, COLORS.tile, 0.09);
      // abacus
      addBox(tileB, x - ch - 0.23, 5.58, z - ch - 0.23, x + ch + 0.23, 5.7, z + ch + 0.23, COLORS.tile, 0.09);
    }

    // arches
    for (let i = 0; i < count; i++) {
      const z = zStart + i * spacing + spacing / 2;
      archBand(tileB, z, COLONNADE.archSpringY, COLONNADE.archRadius, 0.34,
        x - 0.27, x + 0.27, COLORS.tile, TILE_COLUMN, 22);
      // teal keystone
      addBox(tileB, x - 0.3, 7.55, z - 0.09, x + 0.3, 7.85, z + 0.09, COLORS.teal, 0.06);
    }

    // entablature
    const ex0 = x - 0.65, ex1 = x + 0.65;
    addBox(tileB, Math.min(ex0, ex1), 7.85, HALL.zMin + 0.1, Math.max(ex0, ex1), 8.0, HALL.zMax - 0.1, COLORS.teal, 0.06, { top: false });
    addBox(tileB, Math.min(x - 0.55, x + 0.55), 8.0, HALL.zMin + 0.1, Math.max(x - 0.55, x + 0.55), 8.46, HALL.zMax - 0.1, COLORS.tile, 0.1);
    addBox(tileB, Math.min(x - 0.62, x + 0.62), 8.46, HALL.zMin + 0.1, Math.max(x - 0.62, x + 0.62), 8.58, HALL.zMax - 0.1, COLORS.tile, 0.1);
    addBox(tileB, Math.min(x - 0.74, x + 0.74), 8.58, HALL.zMin + 0.1, Math.max(x - 0.74, x + 0.74), 8.7, HALL.zMax - 0.1, COLORS.tile, 0.1);
    // dentils
    for (let z = HALL.zMin + 0.6; z < HALL.zMax - 0.6; z += 0.55) {
      addBox(tileB, Math.min(x - 0.72, x + 0.72), 7.94, z - 0.08, Math.max(x - 0.72, x + 0.72), 8.0, z + 0.08, COLORS.paint, 0);
    }
  }
}

function addFarWall(group: THREE.Group, tileB: SurfaceBuilder, paintB: SurfaceBuilder, emissiveB: SurfaceBuilder) {
  const W = 24, H = 12.8;
  const holes = [
    { x0: 8.6, x1: 15.4, y0: 0, y1: 8.6, arch: true },
    { x0: 2.3, x1: 5.7, y0: 0, y1: 5.6, arch: true },
    { x0: 18.3, x1: 21.7, y0: 0, y1: 5.6, arch: true },
  ];
  const geo = wallWithOpenings(W, H, holes, COLORS.tile, TILE_WALL);
  placeWallGeometry(geo, [-12, 0, -32], [1, 0, 0], [0, 1, 0]);
  tileB.append(geo);
  geo.dispose();

  // Vestibule behind the far wall.
  const z0 = -36.2, z1 = -32.05;
  addBox(tileB, -12, -0.1, z0, 12, 0.02, z1, [0.12, 0.13, 0.12], TILE_FLOOR);
  addBox(tileB, -12, 10.8, z0, 12, 10.92, z1, [0.18, 0.17, 0.15], TILE_FLOOR);
  addBox(tileB, -12.0, 0, z0, -11.8, 10.9, z1, [0.2, 0.2, 0.17], TILE_WALL);
  addBox(tileB, 11.8, 0, z0, 12.0, 10.9, z1, [0.2, 0.2, 0.17], TILE_WALL);

  // Luminous glazing set just behind the wall openings. The wall masks the
  // rectangular panes into the three arched shapes, so the windows read as
  // deep sheets of daylight rather than flat glowing posters.
  emissiveB.rect([-3.42, 0.86, -32.34], [6.84, 0, 0], [0, 8.4, 0], [1.32, 1.11, 0.82], 0);
  emissiveB.rect([-9.72, 0.86, -32.34], [3.44, 0, 0], [0, 5.3, 0], [1.02, 1.06, 1.0], 0);
  emissiveB.rect([6.28, 0.86, -32.34], [3.44, 0, 0], [0, 5.3, 0], [1.02, 1.06, 1.0], 0);

  // Window joinery: low parapets, dark mullions and transoms give the huge
  // luminous openings a believable scale and break up the flat glow.
  const frameZ = -31.9;
  const frame = COLORS.teal;
  addBox(tileB, -3.4, 0.0, -31.96, 3.4, 0.82, -31.87, frame, 0.09, { top: false });
  addBox(tileB, -9.7, 0.0, -31.96, -6.3, 0.82, -31.87, frame, 0.09, { top: false });
  addBox(tileB, 6.3, 0.0, -31.96, 9.7, 0.82, -31.87, frame, 0.09, { top: false });
  // Thin stone coping on each sill.
  addBox(tileB, -3.46, 0.82, -31.97, 3.46, 0.9, -31.85, COLORS.tileWarm, 0.2);
  addBox(tileB, -9.76, 0.82, -31.97, -6.24, 0.9, -31.85, COLORS.tileWarm, 0.2);
  addBox(tileB, 6.24, 0.82, -31.97, 9.76, 0.9, -31.85, COLORS.tileWarm, 0.2);

  for (const x of [-1.15, -0.38, 0.38, 1.15]) {
    addBox(paintB, x - 0.035, 0.9, frameZ - 0.02, x + 0.035, 8.3, frameZ + 0.02, frame);
  }
  addBox(paintB, -3.32, 2.35, frameZ - 0.02, 3.32, 2.43, frameZ + 0.02, frame);
  addBox(paintB, -3.32, 4.95, frameZ - 0.02, 3.32, 5.03, frameZ + 0.02, frame);
  for (const side of [-1, 1]) {
    const cx = side * 8.0;
    addBox(paintB, cx - 0.035, 0.9, frameZ - 0.02, cx + 0.035, 5.45, frameZ + 0.02, frame);
    addBox(paintB, cx - 1.62, 2.55, frameZ - 0.02, cx + 1.62, 2.63, frameZ + 0.02, frame);
    addBox(paintB, cx - 1.62, 3.95, frameZ - 0.02, cx + 1.62, 4.03, frameZ + 0.02, frame);
  }

  // Arch trim tubes on the hall side.
  const trims: Array<{ x0: number; x1: number; r: number; spring: number }> = [
    { x0: -3.4, x1: 3.4, r: 3.4, spring: 5.2 },
    { x0: -9.7, x1: -6.3, r: 1.7, spring: 3.9 },
    { x0: 6.3, x1: 9.7, r: 1.7, spring: 3.9 },
  ];
  for (const t of trims) {
    const pts: Vec3[] = [[t.x0, 0, -31.95], [t.x0, t.spring, -31.95]];
    for (let i = 1; i <= 18; i++) {
      const a = Math.PI - (Math.PI * i) / 18;
      pts.push([t.x0 + t.r + Math.cos(a) * t.r, t.spring + Math.sin(a) * t.r, -31.95]);
    }
    pts.push([t.x1, t.spring, -31.95], [t.x1, 0, -31.95]);
    addPipe(paintB, pts, 0.075, COLORS.teal, 0, 80);
  }

  // Deep skirting / dado on the far wall.
  addBox(tileB, -11.98, 0, -31.98, 11.98, 1.1, -31.93, COLORS.teal, 0.055, { top: false, bottom: false });
}

function addNearWall(group: THREE.Group, tileB: SurfaceBuilder, paintB: SurfaceBuilder, emissiveB: SurfaceBuilder) {
  const W = 24, H = 12.8;
  const holes = [
    { x0: 9.8, x1: 14.2, y0: 0, y1: 5.5, arch: true },
  ];
  const geo = wallWithOpenings(W, H, holes, COLORS.tile, TILE_WALL);
  placeWallGeometry(geo, [12, 0, 20], [-1, 0, 0], [0, 1, 0]);
  tileB.append(geo);
  geo.dispose();

  // Vestibule and doors.
  addBox(tileB, -4.0, -0.05, 19.5, 4.0, 0.05, 21.4, [0.13, 0.13, 0.12], TILE_FLOOR);
  addBox(paintB, -2.14, 0.02, 19.78, -0.02, 3.38, 19.84, COLORS.door);
  addBox(paintB, 0.02, 0.02, 19.78, 2.14, 3.38, 19.84, COLORS.door);
  addBox(paintB, -0.03, 0.02, 19.76, 0.03, 3.38, 19.86, [0.02, 0.04, 0.035]);
  // chrome push bars
  addBox(paintB, -0.86, 1.05, 19.75, 0.86, 1.11, 19.79, COLORS.chrome);
  // door frame
  addBox(paintB, -2.3, 0, 19.72, 2.3, 0.16, 19.86, COLORS.paint);
  addBox(paintB, -2.3, 3.4, 19.72, 2.3, 3.56, 19.86, COLORS.paint);
  addBox(paintB, -2.3, 0, 19.72, -2.14, 3.56, 19.86, COLORS.paint);
  addBox(paintB, 2.14, 0, 19.72, 2.3, 3.56, 19.86, COLORS.paint);
  // Transom glass sits just behind the wall so the arch masks its rectangle.
  emissiveB.rect([2.0, 3.4, 20.06], [-4.0, 0, 0], [0, 2.3, 0], [0.4, 0.47, 0.44], 0);
  addBox(paintB, -0.035, 3.5, 19.86, 0.035, 5.45, 19.93, COLORS.teal);
  addBox(paintB, -2.0, 4.48, 19.86, 2.0, 4.52, 19.93, COLORS.teal);
  // Pair of warm sconces flanking the entrance.
  for (const side of [-1, 1]) {
    const sx = side * 4.85;
    const plate = new THREE.CylinderGeometry(0.16, 0.16, 0.035, 24);
    plate.rotateX(Math.PI / 2);
    plate.translate(sx, 5.25, 19.955);
    addColorAttribute(plate, COLORS.chrome);
    tileB.append(plate);
    plate.dispose();

    const stem = new THREE.CylinderGeometry(0.032, 0.032, 0.18, 12);
    stem.rotateX(Math.PI / 2);
    stem.translate(sx, 5.25, 19.84);
    addColorAttribute(stem, COLORS.chrome);
    tileB.append(stem);
    stem.dispose();

    const globe = new THREE.SphereGeometry(0.175, 24, 16);
    globe.translate(sx, 5.25, 19.68);
    addColorAttribute(globe, [3.0, 1.72, 0.72]);
    emissiveB.append(globe);
    globe.dispose();
  }
  // arch trim
  const pts: Vec3[] = [[-2.2, 0, 19.94], [-2.2, 3.3, 19.94]];
  for (let i = 1; i <= 18; i++) {
    const a = Math.PI - (Math.PI * i) / 18;
    pts.push([Math.cos(a) * 2.2, 3.3 + Math.sin(a) * 2.2, 19.94]);
  }
  pts.push([2.2, 3.3, 19.94], [2.2, 0, 19.94]);
  addPipe(paintB, pts, 0.07, COLORS.teal, 0, 80);
}

function addPool(tileB: SurfaceBuilder, paintB: SurfaceBuilder) {
  const p = POOL;
  // Deck slabs.
  addBox(tileB, HALL.xMin, -0.35, 11.0, HALL.xMax, 0.0, HALL.zMax, COLORS.tile, TILE_FLOOR);
  addBox(tileB, HALL.xMin, -0.35, HALL.zMin, HALL.xMax, 0.0, -25.0, COLORS.tile, TILE_FLOOR);
  addBox(tileB, HALL.xMin, -0.35, -25.0, -8.6, 0.0, 11.0, COLORS.tile, TILE_FLOOR);
  addBox(tileB, 8.6, -0.35, -25.0, HALL.xMax, 0.0, 11.0, COLORS.tile, TILE_FLOOR);

  // Deck border in dark teal around the pool.
  const border = 0.36;
  addBox(tileB, -9.0, 0.001, -25.4, -8.6 - 0.02, 0.008, 11.4, COLORS.teal, 0.07, { side: false, bottom: false });
  addBox(tileB, 8.6 + 0.02, 0.001, -25.4, 9.0, 0.008, 11.4, COLORS.teal, 0.07, { side: false, bottom: false });
  addBox(tileB, -9.0, 0.001, -25.4, 9.0, 0.008, -25.0 + 0.02, COLORS.teal, 0.07, { side: false, bottom: false });
  addBox(tileB, -9.0, 0.001, 11.0 - 0.02, 9.0, 0.008, 11.4, COLORS.teal, 0.07, { side: false, bottom: false });

  // Coping (a slightly raised bullnose edge).
  addBox(tileB, -8.96, 0.0, -25.38, -8.56, 0.045, 11.38, COLORS.tileWarm, 0.18);
  addBox(tileB, 8.56, 0.0, -25.38, 8.96, 0.045, 11.38, COLORS.tileWarm, 0.18);
  addBox(tileB, -8.96, 0.0, -25.38, 8.96, 0.045, -24.98, COLORS.tileWarm, 0.18);
  addBox(tileB, -8.96, 0.0, 10.98, 8.96, 0.045, 11.38, COLORS.tileWarm, 0.18);

  // Pool shell. The basin is open from the waterline down to the floor.
  // bottom (single plane with correct +Y normal)
  tileB.rect([-8.6, -2.35, -25.0], [0, 0, 36.0], [17.2, 0, 0], COLORS.poolTile, TILE_POOL);
  // basin side walls
  addBox(tileB, -8.66, -2.35, -25.0, -8.6, 0.0, 11.0, COLORS.poolTile, TILE_POOL, { top: false, bottom: false });
  addBox(tileB, 8.6, -2.35, -25.0, 8.66, 0.0, 11.0, COLORS.poolTile, TILE_POOL, { top: false, bottom: false });
  addBox(tileB, -8.6, -2.35, -25.06, 8.6, 0.0, -25.0, COLORS.poolTile, TILE_POOL, { top: false, bottom: false });
  addBox(tileB, -8.6, -2.35, 11.0, 8.6, 0.0, 11.06, COLORS.poolTile, TILE_POOL, { top: false, bottom: false });

  // Perimeter submerged ledge.
  const lw = 1.25, ly = -0.62;
  addBox(tileB, -8.6, ly - 0.9, -25.0, -8.6 + lw, ly, 11.0, COLORS.poolTile, TILE_POOL);
  addBox(tileB, 8.6 - lw, ly - 0.9, -25.0, 8.6, ly, 11.0, COLORS.poolTile, TILE_POOL);
  addBox(tileB, -8.6 + lw, ly - 0.9, -25.0, 8.6 - lw, ly, -25.0 + lw, COLORS.poolTile, TILE_POOL);
  addBox(tileB, -8.6 + lw, ly - 0.9, 11.0 - lw, 8.6 - lw, ly, 11.0, COLORS.poolTile, TILE_POOL);
  // Ledge front faces to the deep basin.
  addBox(tileB, -8.6 + lw, -2.35, -25.0 + lw, -8.6 + lw + 0.02, ly, 11.0 - lw, COLORS.poolTile, TILE_POOL, { top: false, bottom: false });
  addBox(tileB, 8.6 - lw - 0.02, -2.35, -25.0 + lw, 8.6 - lw, ly, 11.0 - lw, COLORS.poolTile, TILE_POOL, { top: false, bottom: false });

  // Teal mosaic band just under the waterline.
  for (const side of [-1, 1]) {
    const x = side * 8.595;
    const xo = x - side * 0.03;
    addBox(tileB, Math.min(x, xo), -0.44, -24.98, Math.max(x, xo), -0.06, 10.98, COLORS.teal, 0.05, { top: false, bottom: false });
  }
  addBox(tileB, -8.58, -0.44, -24.985, 8.58, -0.06, -24.955, COLORS.teal, 0.05, { top: false, bottom: false });
  addBox(tileB, -8.58, -0.44, 10.955, 8.58, -0.06, 10.985, COLORS.teal, 0.05, { top: false, bottom: false });

  // Steps at the near end.
  const stepCount = 5;
  const stepTopY = [-0.75, -1.13, -1.51, -1.89, -2.27];
  for (let i = 0; i < stepCount; i++) {
    const z0 = 10.72 - (i + 1) * 0.74;
    const z1 = 10.72 - i * 0.74;
    const top = stepTopY[i];
    addBox(tileB, -5.4, -2.35, z0, 5.4, top, z1, COLORS.tile, TILE_POOL);
    // teal nosing strip
    addBox(tileB, -5.4, top - 0.035, z1 - 0.035, 5.4, top + 0.006, z1, COLORS.teal, 0.05, { top: false, bottom: false });
  }

  // Deep end marker ring on the pool floor.
  const ring = new THREE.RingGeometry(2.2, 2.42, 96);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, -2.338, -10.5);
  addColorAttribute(ring, COLORS.teal);
  tileB.append(ring);
  ring.dispose();

  // Underwater niche lights (emissive meshes added by caller, geometry here is the trim).
  const under = [
    [-6.72, -1.55, -11.5, 1],
    [6.72, -1.55, -11.5, -1],
    [-6.72, -1.55, 2.5, 1],
    [6.72, -1.55, 2.5, -1],
  ] as const;
  for (const [x, y, z, n] of under) {
    addBox(tileB, x - 0.03, y - 0.42, z - 0.52, x + 0.03 * n, y + 0.42, z + 0.52, COLORS.teal, 0.05);
  }

  // Steps handrails are added by addMetal().
  // Deck drains (dark strips).
  for (const z of [-28.5, -16, -4, 8, 16.5]) {
    addBox(tileB, -9.1, 0.009, z - 0.1, -8.72, 0.016, z + 0.1, [0.08, 0.09, 0.085], 0);
    addBox(tileB, 8.72, 0.009, z - 0.1, 9.1, 0.016, z + 0.1, [0.08, 0.09, 0.085], 0);
  }
}

function addLanding(group: THREE.Group, tileB: SurfaceBuilder, metalB: SurfaceBuilder, paintB: SurfaceBuilder) {
  // A small balcony tucked between two columns, with the slide launch.
  const x0 = -11.98, x1 = -9.42;
  const z0 = 13.55, z1 = 16.25;
  const top = 3.42;
  addBox(tileB, x0, top - 0.22, z0, x1, top, z1, COLORS.tile, TILE_FLOOR);
  addBox(tileB, x1 - 0.28, top - 0.26, z0, x1, top + 0.02, z1, COLORS.tileWarm, 0.12);
  addBox(tileB, x0, top - 0.5, z0, x1, top - 0.22, z1, COLORS.tile, TILE_WALL);
  // corbels
  for (const z of [14.0, 15.9]) {
    addBox(tileB, x0, 2.55, z - 0.18, x1 - 0.3, top - 0.22, z + 0.18, COLORS.tile, TILE_WALL);
  }
  // inset steps
  const steps = 11;
  const run = (HALL.zMax - z1) / steps;
  for (let i = 0; i < steps; i++) {
    const zz0 = z1 + i * run;
    const zz1 = z1 + (i + 1) * run;
    const y = top - (i + 1) * (top / steps);
    addBox(tileB, -11.98, 0, zz0, -10.58, y, zz1, COLORS.tile, TILE_FLOOR);
    addBox(tileB, -11.98, y - 0.035, zz1 - 0.03, -10.58, y + 0.004, zz1, COLORS.teal, 0.05, { top: false, bottom: false });
  }
  // chrome balustrade around the landing and stair.
  addRailing(metalB, [
    [-9.45, 0, 13.52], [-9.45, 0, 14.9],
  ], () => top, 1.05, 0.95);
  addRailing(metalB, [
    [-9.45, 0, 16.28], [-10.55, 0, 16.28],
  ], () => top, 1.05, 0.95);
  const stairPts: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const z = z1 + i * run;
    const y = top - (i / steps) * top;
    stairPts.push([-10.54, y, z]);
  }
  addRailing(metalB, stairPts, (p) => p[1], 1.02, 0.9);

  // Slide: outer and inner tubes.
  const slidePts: Vec3[] = [
    [-10.5, 3.62, 15.1],
    [-9.28, 3.52, 13.4],
    [-7.64, 3.02, 11.65],
    [-6.38, 2.25, 9.55],
    [-5.94, 1.4, 7.5],
    [-6.62, 0.72, 5.92],
    [-7.72, 0.26, 6.7],
    [-7.85, -0.1, 8.65],
  ];
  const curve = new THREE.CatmullRomCurve3(slidePts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.4);
  const outer = new THREE.TubeGeometry(curve, 220, 0.82, 28, false);
  addColorAttribute(outer, COLORS.slide);
  const outerMesh = makeSurface(outer, slideMeta, 'slide-outer');
  group.add(outerMesh);
  const inner = new THREE.TubeGeometry(curve, 220, 0.76, 24, false);
  addColorAttribute(inner, COLORS.slideInside);
  const innerMesh = makeSurface(inner, slideInnerMeta, 'slide-inner');
  (innerMesh.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  group.add(innerMesh);

  // Collars and rims.
  const collarT = [0.0, 0.27, 0.55, 0.8, 1.0];
  for (const t of collarT) {
    const pos = curve.getPointAt(Math.min(0.999, Math.max(0.001, t)));
    const tan = curve.getTangentAt(Math.min(0.999, Math.max(0.001, t)));
    const ring = new THREE.TorusGeometry(0.84, t === 0 || t === 1 ? 0.045 : 0.028, 10, 40);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan));
    ring.translate(pos.x, pos.y, pos.z);
    addColorAttribute(ring, COLORS.slide);
    const rm = makeSurface(ring, slideMeta);
    group.add(rm);
  }

  // Support post + cradle.
  addPipe(metalB, [[-6.85, 0, 6.4], [-6.85, 1.85, 6.4], [-6.8, 2.15, 6.55]], 0.095, COLORS.chrome, 0, 24);
  addBox(tileB, -7.15, 0, 6.1, -6.55, 0.22, 6.7, COLORS.teal, 0.06);

  return { slideExit: [-7.85, 8.65] as [number, number] };
}

function addMetal(metalB: SurfaceBuilder) {
  // Pool ladders.
  for (const side of [-1, 1]) {
    const x = side * 7.3;
    const z = 9.8;
    for (const dx of [-0.38, 0.38]) {
      const pts: Vec3[] = [
        [x + dx, -1.5, z - 0.35],
        [x + dx, -0.9, z - 0.35],
        [x + dx, -0.35, z - 0.2],
        [x + dx, 0.55, z - 0.15],
        [x + dx, 0.95, z + 0.1],
        [x + dx, 0.98, z + 0.42],
      ];
      addPipe(metalB, pts, 0.032, COLORS.chrome, 0, 40);
    }
    // steps below the water
    for (let i = 0; i < 3; i++) {
      const y = -0.55 - i * 0.38;
      const s = new THREE.CylinderGeometry(0.028, 0.028, 0.76, 10);
      s.rotateZ(Math.PI / 2);
      s.translate(x, y, z - 0.35 + i * 0.02);
      addColorAttribute(s, COLORS.chrome);
      metalB.append(s);
      s.dispose();
    }
  }

  // Handrail along the submerged steps.
  for (const side of [-1, 1]) {
    const x = side * 5.7;
    const pts: Vec3[] = [
      [x, 0.1, 11.2],
      [x, 0.85, 10.95],
      [x, 0.85, 8.6],
      [x, 0.55, 7.4],
    ];
    addPipe(metalB, pts, 0.028, COLORS.chrome, 0, 60);
    addPipe(metalB, [[x, 0, 10.8], [x, 0.82, 10.85]], 0.02, COLORS.chrome, 0, 12);
    addPipe(metalB, [[x, 0, 8.7], [x, 0.8, 8.7]], 0.02, COLORS.chrome, 0, 12);
  }

  // Chrome towel rail near the far left.
  addPipe(metalB, [[-11.9, 1.1, -20.6], [-11.9, 1.1, -18.9]], 0.035, COLORS.chrome, 0, 24);
  addPipe(metalB, [[-11.92, 1.1, -20.55], [-11.8, 1.1, -20.55]], 0.02, COLORS.chrome, 0, 10);
  addPipe(metalB, [[-11.92, 1.1, -18.95], [-11.8, 1.1, -18.95]], 0.02, COLORS.chrome, 0, 10);
}

function addBenches(tileB: SurfaceBuilder, paintB: SurfaceBuilder) {
  // simple tiled benches in the side aisles, one with a folded towel
  for (const [x, z, side] of [[-11.2, -21.4, -1], [11.2, -17.8, 1], [11.2, 4.5, 1]] as const) {
    addBox(tileB, x - 0.35, 0, z - 1.35, x + 0.35, 0.42, z - 1.15, COLORS.tile, 0.1);
    addBox(tileB, x - 0.35, 0, z + 1.15, x + 0.35, 0.42, z + 1.35, COLORS.tile, 0.1);
    addBox(tileB, x - 0.45, 0.42, z - 1.55, x + 0.45, 0.52, z + 1.55, COLORS.tile, 0.12);
    // towel
    if (z === -17.8) {
      addBox(paintB, x - 0.36, 0.52, z - 0.2, x + 0.28, 0.61, z + 0.45, [0.88, 0.86, 0.78]);
      addBox(paintB, x + 0.1, 0.52, z - 0.2, x + 0.28, 0.72, z + 0.45, [0.8, 0.78, 0.7]);
    }
  }
}

function addEmissiveFixtures(group: THREE.Group, emissiveB: SurfaceBuilder, tileB: SurfaceBuilder, metalB: SurfaceBuilder) {
  // underwater lights
  const under = [
    [-6.71, -1.55, -11.5, 1],
    [6.71, -1.55, -11.5, -1],
    [-6.71, -1.55, 2.5, 1],
    [6.71, -1.55, 2.5, -1],
  ] as const;
  for (const [x, y, z, n] of under) {
    if (n > 0) {
      emissiveB.rect([x + 0.02, y - 0.24, z - 0.3], [0, 0.48, 0], [0, 0, 0.6], [0.35, 2.2, 2.0], 0);
    } else {
      emissiveB.rect([x - 0.02, y - 0.24, z - 0.3], [0, 0, 0.6], [0, 0.48, 0], [0.35, 2.2, 2.0], 0);
    }
  }

  // wall sconce glow is added in addSideWall; cove/skylight in addVault.
}

function addRings(group: THREE.Group): { hero: THREE.Group; floaters: THREE.Object3D[] } {
  const hero = new THREE.Group();
  hero.name = 'hero-rings';
  hero.position.set(1.15, 0, -5.4);
  group.add(hero);

  const levels = [0.46, 1.58, 2.7, 3.82];
  const tilts = [0.025, -0.04, 0.035, -0.025];
  const radii = [1.48, 1.43, 1.46, 1.4];
  levels.forEach((y, i) => {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(radii[i], 0.34, 24, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    addColorAttribute(r.geometry, COLORS.red);
    r.userData.surface = redMeta;
    r.userData.bake = true;
    r.rotation.order = 'YXZ';
    r.rotation.x = Math.PI / 2;
    r.rotation.z = tilts[i];
    r.rotation.y = i * 0.39;
    r.position.set(i % 2 === 0 ? 0.03 : -0.03, y, i === 1 ? 0.03 : i === 2 ? -0.02 : 0);
    r.name = `hero-ring-${i}`;
    hero.add(r);
    // valve
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    addColorAttribute(valve.geometry, [0.7, 0.6, 0.54]);
    valve.userData.surface = { ...redMeta, color: [0.7, 0.6, 0.54], albedo: [0.5, 0.42, 0.38] };
    valve.userData.bake = false;
    valve.position.set(1.12, y + 0.3, 0.28);
    valve.rotation.z = 0.12;
    hero.add(valve);
  });

  const floaters: THREE.Object3D[] = [];
  const defs: Array<{ p: Vec3; meta: SurfaceMeta; r: number; tilt: number }> = [
    { p: [-3.6, WATER_Y + 0.12, 4.1], meta: yellowMeta, r: 1.02, tilt: 0.02 },
    { p: [4.7, WATER_Y + 0.14, -11.2], meta: orangeMeta, r: 0.94, tilt: -0.03 },
    { p: [5.3, WATER_Y + 0.11, -18.4], meta: blueMeta, r: 1.12, tilt: 0.04 },
    { p: [-1.7, WATER_Y + 0.1, -20.1], meta: creamMeta, r: 0.86, tilt: -0.01 },
  ];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const g = new THREE.Group();
    g.name = `floater-${i}`;
    g.position.set(d.p[0], d.p[1], d.p[2]);
    const r = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.285, 18, 96), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    addColorAttribute(r.geometry, d.meta.color);
    r.userData.surface = d.meta;
    r.userData.bake = true;
    r.rotation.order = 'YXZ';
    r.rotation.x = Math.PI / 2;
    r.rotation.z = d.tilt;
    g.add(r);
    group.add(g);
    floaters.push(g);
  }
  return { hero, floaters };
}

function addDecal(
  group: THREE.Group, name: string, w: number, h: number,
  pos: Vec3, rotY: number, texture: string, emissive = 0, rotX = 0,
) {
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  addColorAttribute(geo, [1, 1, 1], 0);
  const mesh = makeSurface(geo, { ...decalMeta, decal: texture }, name);
  mesh.position.set(...pos);
  mesh.rotation.set(rotX, rotY, 0, 'YXZ');
  mesh.userData.bake = false;
  mesh.userData.decal = { texture, emissive };
  mesh.renderOrder = 2;
  group.add(mesh);
}

function addSignage(group: THREE.Group, metalB: SurfaceBuilder) {
  // A low sun beyond the central arch, and foliage silhouetted against it.
  addDecal(group, 'sun-central', 4.8, 4.8, [0.0, 5.9, -32.3], 0, 'sun', 1.7);
  addDecal(group, 'plant-central', 2.1, 2.8, [-2.45, 2.25, -32.12], 0, 'plant');
  // Foliage silhouettes in the far windows. Two overlapping cards per opening
  // give the flat glass a sense of depth without any extra geometry cost.
  addDecal(group, 'plant-far-left-a', 3.5, 3.7, [-8.9, 2.78, -32.06], 0, 'plant');
  addDecal(group, 'plant-far-left-b', 2.7, 3.1, [-7.15, 2.28, -32.12], 0, 'plant2');
  addDecal(group, 'plant-far-right-a', 3.5, 3.7, [8.9, 2.78, -32.06], 0, 'plant2');
  addDecal(group, 'plant-far-right-b', 2.7, 3.1, [7.15, 2.28, -32.12], 0, 'plant');
  // far wall warning
  addDecal(group, 'sign-no-diving', 0.62, 0.74, [4.55, 2.7, -31.93], 0, 'no-diving');
  // pool rules in the right aisle
  addDecal(group, 'sign-rules', 1.12, 0.82, [11.93, 2.9, -6.2], -Math.PI / 2, 'rules');
  // depth marker underwater
  addDecal(group, 'depth-marker', 0.78, 0.28, [4.4, -0.75, 10.955], Math.PI, 'depth', 0.12);
  // balcony / private sign
  addDecal(group, 'sign-private', 0.6, 0.28, [-11.94, 4.65, 14.35], Math.PI / 2, 'private');
  // exit sign above the entrance
  addDecal(group, 'sign-exit', 0.52, 0.2, [0.0, 4.68, 19.86], Math.PI, 'exit', 1.7);
  // maker's plaque
  addDecal(group, 'plaque', 2.6, 0.48, [0.0, 5.85, 19.93], Math.PI, 'plaque');
  // enamel medallions flanking the entrance frieze
  addDecal(group, 'medallion-left', 2.1, 2.1, [-5.75, 9.55, 19.93], Math.PI, 'medallion', 0.55);
  addDecal(group, 'medallion-right', 2.1, 2.1, [5.75, 9.55, 19.93], Math.PI, 'medallion', 0.55);
  // wall motto on the entrance tympanum
  addDecal(group, 'motto', 7.4, 1.28, [0.0, 10.35, 19.93], Math.PI, 'motto', 0.62);
  // clock face
  addDecal(group, 'clock-face', 1.55, 1.55, [0.0, 7.75, 19.91], Math.PI, 'clock', 0.55);
  const rim = new THREE.TorusGeometry(0.755, 0.042, 12, 80);
  rim.translate(0.0, 7.75, 19.88);
  addColorAttribute(rim, COLORS.chrome);
  metalB.append(rim);
  rim.dispose();
  // "1931" on the pool floor
  addDecal(group, 'floor-1931', 1.65, 0.52, [0, -2.328, -11.0], 0, '1931', 0.1, -Math.PI / 2);
}

export interface WorldBuild {
  group: THREE.Group;
  heroRings: THREE.Group;
  floaters: THREE.Object3D[];
  foamCenters: Array<[number, number, number]>;
}

export const FOAM_CENTERS: Array<[number, number, number]> = [
  [1.15, -5.4, 2.45],
  [-3.6, 4.1, 1.45],
  [4.7, -11.2, 1.35],
  [5.3, -18.4, 1.55],
  [-1.7, -20.1, 1.3],
  [-7.85, 8.65, 1.55],
  [7.3, 9.8, 1.05],
  [-7.3, 9.8, 1.05],
  [5.7, 10.95, 0.6],
  [-5.7, 10.95, 0.6],
];

export function buildWorld(): WorldBuild {
  const group = new THREE.Group();
  group.name = 'world';

  const tileB = new SurfaceBuilder();
  const paintB = new SurfaceBuilder();
  const metalB = new SurfaceBuilder();
  const emissiveB = new SurfaceBuilder();

  addPool(tileB, paintB);
  addSideWall(group, tileB, paintB, emissiveB, -1);
  addSideWall(group, tileB, paintB, emissiveB, 1);
  addFarWall(group, tileB, paintB, emissiveB);
  addNearWall(group, tileB, paintB, emissiveB);
  addColonnade(group, tileB, paintB);
  addVault(group, tileB, paintB, emissiveB);
  addLanding(group, tileB, metalB, paintB);
  addMetal(metalB);
  addBenches(tileB, paintB);
  addEmissiveFixtures(group, emissiveB, tileB, metalB);
  const rings = addRings(group);
  addSignage(group, metalB);

  flush(group, 'tilework', tileB, tileMeta);
  flush(group, 'joinery', paintB, paintMeta);
  flush(group, 'chrome', metalB, metalMeta);
  flush(group, 'light-panels', emissiveB, emissiveMeta);

  return {
    group,
    heroRings: rings.hero,
    floaters: rings.floaters,
    foamCenters: FOAM_CENTERS,
  };
}
