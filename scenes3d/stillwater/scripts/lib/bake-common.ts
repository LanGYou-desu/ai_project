import * as THREE from 'three';
import { buildWorld } from '../../src/scene/world';

export interface TriangleScene {
  count: number;
  p0: Float64Array;
  p1: Float64Array;
  p2: Float64Array;
  n: Float64Array;
  albedo: Float64Array;
  emission: Float64Array;
  emissiveLuminance: Float64Array;
  emitterIds: number[];
  emitterArea: Float64Array;
  emitterCumulative: Float64Array;
  emitterTotalWeight: number;
  emitterTotalArea: number;
  bvh: BVH;
}

interface HitScratch {
  t: number;
  tri: number;
}

/* ------------------------------------------------------------------ BVH */

interface BvhNode {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  start: number;
  count: number;
  left: number;
  right: number;
}

export class BVH {
  nodes: BvhNode[] = [];
  order: Uint32Array;
  scene: TriangleScene;

  constructor(scene: TriangleScene) {
    this.scene = scene;
    const n = scene.count;
    this.order = new Uint32Array(n);
    const centers = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.order[i] = i;
      centers[i * 3] = (scene.p0[i * 3] + scene.p1[i * 3] + scene.p2[i * 3]) / 3;
      centers[i * 3 + 1] = (scene.p0[i * 3 + 1] + scene.p1[i * 3 + 1] + scene.p2[i * 3 + 1]) / 3;
      centers[i * 3 + 2] = (scene.p0[i * 3 + 2] + scene.p1[i * 3 + 2] + scene.p2[i * 3 + 2]) / 3;
    }
    this.centers = centers;
    this.build(0, n, 0);
  }

  private centers: Float64Array;

  private build(start: number, count: number, depth: number): number {
    const node: BvhNode = {
      minX: Infinity, minY: Infinity, minZ: Infinity,
      maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
      start, count, left: -1, right: -1,
    };
    const { p0, p1, p2 } = this.scene;
    for (let k = 0; k < count; k++) {
      const i = this.order[start + k] * 3;
      for (const p of [p0, p1, p2]) {
        const x = p[i], y = p[i + 1], z = p[i + 2];
        if (x < node.minX) node.minX = x;
        if (y < node.minY) node.minY = y;
        if (z < node.minZ) node.minZ = z;
        if (x > node.maxX) node.maxX = x;
        if (y > node.maxY) node.maxY = y;
        if (z > node.maxZ) node.maxZ = z;
      }
    }
    const index = this.nodes.length;
    this.nodes.push(node);

    if (count <= 5 || depth > 36) return index;

    const ex = node.maxX - node.minX;
    const ey = node.maxY - node.minY;
    const ez = node.maxZ - node.minZ;
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const slice = Array.from(this.order.subarray(start, start + count));
    const c = this.centers;
    slice.sort((a, b) => c[a * 3 + axis] - c[b * 3 + axis]);
    this.order.set(slice, start);
    const mid = count >> 1;
    node.left = this.build(start, mid, depth + 1);
    node.right = this.build(start + mid, count - mid, depth + 1);
    return index;
  }

  /** Intersect nearest hit. Mutates and returns a reusable scratch object. */
  intersect(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    tMax: number,
    scratch: HitScratch,
  ): boolean {
    let ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    if (!Number.isFinite(ix)) ix = dx >= 0 ? 1e30 : -1e30;
    if (!Number.isFinite(iy)) iy = dy >= 0 ? 1e30 : -1e30;
    if (!Number.isFinite(iz)) iz = dz >= 0 ? 1e30 : -1e30;

    const stack = this.stack;
    let sp = 0;
    stack[sp++] = 0;
    let best = tMax;
    let bestTri = -1;
    const nodes = this.nodes;
    const p0 = this.scene.p0, p1 = this.scene.p1, p2 = this.scene.p2;
    const order = this.order;

    while (sp > 0) {
      const node = nodes[stack[--sp]];
      let tmin = (node.minX - ox) * ix;
      let tmax = (node.maxX - ox) * ix;
      if (tmin > tmax) { const tmp = tmin; tmin = tmax; tmax = tmp; }
      let ty0 = (node.minY - oy) * iy;
      let ty1 = (node.maxY - oy) * iy;
      if (ty0 > ty1) { const tmp = ty0; ty0 = ty1; ty1 = tmp; }
      if (ty0 > tmin) tmin = ty0;
      if (ty1 < tmax) tmax = ty1;
      let tz0 = (node.minZ - oz) * iz;
      let tz1 = (node.maxZ - oz) * iz;
      if (tz0 > tz1) { const tmp = tz0; tz0 = tz1; tz1 = tmp; }
      if (tz0 > tmin) tmin = tz0;
      if (tz1 < tmax) tmax = tz1;
      if (tmax < Math.max(tmin, 0) || tmin > best) continue;

      if (node.count <= 5) {
        for (let k = 0; k < node.count; k++) {
          const tri = order[node.start + k];
          const i = tri * 3;
          const ax = p0[i], ay = p0[i + 1], az = p0[i + 2];
          const bx = p1[i], by = p1[i + 1], bz = p1[i + 2];
          const cx = p2[i], cy = p2[i + 1], cz = p2[i + 2];
          const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
          const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
          const px = dy * e2z - dz * e2y;
          const py = dz * e2x - dx * e2z;
          const pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-12) continue;
          const invDet = 1 / det;
          const tx = ox - ax, ty = oy - ay, tz = oz - az;
          const u = (tx * px + ty * py + tz * pz) * invDet;
          if (u < -1e-7 || u > 1.0000001) continue;
          const qx = ty * e1z - tz * e1y;
          const qy = tz * e1x - tx * e1z;
          const qz = tx * e1y - ty * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * invDet;
          if (v < -1e-7 || u + v > 1.0000001) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
          if (t > 1e-5 && t < best) {
            best = t;
            bestTri = tri;
          }
        }
      } else {
        stack[sp++] = node.left;
        stack[sp++] = node.right;
      }
    }

    if (bestTri >= 0) {
      scratch.t = best;
      scratch.tri = bestTri;
      return true;
    }
    return false;
  }

  /** Any-hit shadow test. Does not mutate the supplied scratch. */
  occluded(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxDist: number,
  ): boolean {
    let ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    if (!Number.isFinite(ix)) ix = dx >= 0 ? 1e30 : -1e30;
    if (!Number.isFinite(iy)) iy = dy >= 0 ? 1e30 : -1e30;
    if (!Number.isFinite(iz)) iz = dz >= 0 ? 1e30 : -1e30;

    const stack = this.stack;
    let sp = 0;
    stack[sp++] = 0;
    const nodes = this.nodes;
    const p0 = this.scene.p0, p1 = this.scene.p1, p2 = this.scene.p2;
    const order = this.order;

    while (sp > 0) {
      const node = nodes[stack[--sp]];
      let tmin = (node.minX - ox) * ix;
      let tmax = (node.maxX - ox) * ix;
      if (tmin > tmax) { const tmp = tmin; tmin = tmax; tmax = tmp; }
      let ty0 = (node.minY - oy) * iy;
      let ty1 = (node.maxY - oy) * iy;
      if (ty0 > ty1) { const tmp = ty0; ty0 = ty1; ty1 = tmp; }
      if (ty0 > tmin) tmin = ty0;
      if (ty1 < tmax) tmax = ty1;
      let tz0 = (node.minZ - oz) * iz;
      let tz1 = (node.maxZ - oz) * iz;
      if (tz0 > tz1) { const tmp = tz0; tz0 = tz1; tz1 = tmp; }
      if (tz0 > tmin) tmin = tz0;
      if (tz1 < tmax) tmax = tz1;
      if (tmax < Math.max(tmin, 0) || tmin > maxDist) continue;

      if (node.count <= 5) {
        for (let k = 0; k < node.count; k++) {
          const tri = order[node.start + k];
          const i = tri * 3;
          const ax = p0[i], ay = p0[i + 1], az = p0[i + 2];
          const bx = p1[i], by = p1[i + 1], bz = p1[i + 2];
          const cx = p2[i], cy = p2[i + 1], cz = p2[i + 2];
          const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
          const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
          const px = dy * e2z - dz * e2y;
          const py = dz * e2x - dx * e2z;
          const pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (Math.abs(det) < 1e-12) continue;
          const invDet = 1 / det;
          const tx = ox - ax, ty = oy - ay, tz = oz - az;
          const u = (tx * px + ty * py + tz * pz) * invDet;
          if (u < -1e-7 || u > 1.0000001) continue;
          const qx = ty * e1z - tz * e1y;
          const qy = tz * e1x - tx * e1z;
          const qz = tx * e1y - ty * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * invDet;
          if (v < -1e-7 || u + v > 1.0000001) continue;
          const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
          if (t > 1e-5 && t < maxDist) return true;
        }
      } else {
        stack[sp++] = node.left;
        stack[sp++] = node.right;
      }
    }
    return false;
  }

  private stack = new Int32Array(96);
}

/* ------------------------------------------------------------------ scene extraction */

function colorAt(geo: THREE.BufferGeometry, index: number, fallback: number[]): [number, number, number] {
  const attr = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!attr) return [fallback[0], fallback[1], fallback[2]];
  return [attr.getX(index), attr.getY(index), attr.getZ(index)];
}

export function buildTriangleScene(): TriangleScene {
  const world = buildWorld();
  world.group.updateMatrixWorld(true);

  const p0: number[] = [];
  const p1: number[] = [];
  const p2: number[] = [];
  const nrm: number[] = [];
  const alb: number[] = [];
  const emi: number[] = [];

  const meshes: THREE.Mesh[] = [];
  world.group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.userData.surface && o.userData.bake !== false) meshes.push(o);
  });

  for (const mesh of meshes) {
    const meta = mesh.userData.surface as { kind: string; albedo: number[]; color: number[] };
    if (meta.kind === 'decal') continue;
    const geo = mesh.geometry;
    const position = geo.getAttribute('position') as THREE.BufferAttribute;
    const index = geo.getIndex();
    const matrix = mesh.matrixWorld;
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tris = index ? index.count / 3 : position.count / 3;

    for (let t = 0; t < tris; t++) {
      let a: number, b: number, c: number;
      if (index) {
        a = index.getX(t * 3);
        b = index.getX(t * 3 + 1);
        c = index.getX(t * 3 + 2);
      } else {
        a = t * 3;
        b = t * 3 + 1;
        c = t * 3 + 2;
      }
      v0.fromBufferAttribute(position, a).applyMatrix4(matrix);
      v1.fromBufferAttribute(position, b).applyMatrix4(matrix);
      v2.fromBufferAttribute(position, c).applyMatrix4(matrix);
      e1.subVectors(v1, v0);
      e2.subVectors(v2, v0);
      normal.crossVectors(e1, e2);
      const len = normal.length();
      if (len < 1e-9) continue;
      normal.multiplyScalar(1 / len);

      const ca = colorAt(geo, a, meta.color);
      const cb = colorAt(geo, b, meta.color);
      const cc = colorAt(geo, c, meta.color);
      const ar = (ca[0] + cb[0] + cc[0]) / 3;
      const ag = (ca[1] + cb[1] + cc[1]) / 3;
      const ab = (ca[2] + cb[2] + cc[2]) / 3;

      p0.push(v0.x, v0.y, v0.z);
      p1.push(v1.x, v1.y, v1.z);
      p2.push(v2.x, v2.y, v2.z);
      nrm.push(normal.x, normal.y, normal.z);
      if (meta.kind === 'emissive') {
        alb.push(0, 0, 0);
        emi.push(ar, ag, ab);
      } else {
        alb.push(ar, ag, ab);
        emi.push(0, 0, 0);
      }
    }
  }

  const count = p0.length / 3;
  const scene: TriangleScene = {
    count,
    p0: new Float64Array(p0),
    p1: new Float64Array(p1),
    p2: new Float64Array(p2),
    n: new Float64Array(nrm),
    albedo: new Float64Array(alb),
    emission: new Float64Array(emi),
    emissiveLuminance: new Float64Array(count),
    emitterIds: [],
    emitterArea: new Float64Array(0),
    emitterCumulative: new Float64Array(0),
    emitterTotalWeight: 0,
    emitterTotalArea: 0,
    bvh: undefined as unknown as BVH,
  };

  // Build the emissive light list, weighted by emitted power.
  const weights: number[] = [];
  const areas: number[] = [];
  let totalArea = 0;
  for (let i = 0; i < count; i++) {
    const er = scene.emission[i * 3], eg = scene.emission[i * 3 + 1], eb = scene.emission[i * 3 + 2];
    const lum = er * 0.2126 + eg * 0.7152 + eb * 0.0722;
    scene.emissiveLuminance[i] = lum;
    if (lum < 0.001) continue;
    const i3 = i * 3;
    const ax = scene.p0[i3], ay = scene.p0[i3 + 1], az = scene.p0[i3 + 2];
    const bx = scene.p1[i3], by = scene.p1[i3 + 1], bz = scene.p1[i3 + 2];
    const cx = scene.p2[i3], cy = scene.p2[i3 + 1], cz = scene.p2[i3 + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const area = 0.5 * Math.hypot(nx, ny, nz);
    if (area < 1e-7) continue;
    scene.emitterIds.push(i);
    areas.push(area);
    weights.push(area * lum);
    totalArea += area;
  }
  scene.emitterArea = new Float64Array(areas);
  scene.emitterTotalArea = totalArea;
  const cumulative = new Float64Array(weights.length);
  let totalWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    totalWeight += weights[i];
    cumulative[i] = totalWeight;
  }
  scene.emitterCumulative = cumulative;
  scene.emitterTotalWeight = totalWeight;

  scene.bvh = new BVH(scene);
  return scene;
}

export function emitterSample(scene: TriangleScene, u: number): number {
  const target = u * scene.emitterTotalWeight;
  const ids = scene.emitterIds;
  let lo = 0, hi = ids.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (scene.emitterCumulative[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
