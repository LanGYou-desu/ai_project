import * as THREE from 'three';
import type { Color3, Vec3 } from './constants';

export type MaterialKind = 'tile' | 'paint' | 'metal' | 'plastic' | 'slide' | 'emissive' | 'decal' | 'water';

export interface SurfaceMeta {
  kind: MaterialKind;
  color: Color3;
  albedo: Color3;
  roughness?: number;
  clearcoat?: number;
  emissiveIntensity?: number;
  decal?: string;
  seam?: number;
}

/** Accumulates non-indexed triangles with the attributes our shaders expect. */
export class SurfaceBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  tile: number[] = [];

  get vertexCount() {
    return this.pos.length / 3;
  }

  push(p: Vec3, n: Vec3, c: Color3, u: number, v: number, tileSize: number) {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
    this.uv.push(u, v);
    this.tile.push(tileSize);
  }

  /** A planar quad, defined by an origin and two edge vectors. Normal = u x v. */
  rect(origin: Vec3, u: Vec3, v: Vec3, color: Color3, tileSize = 0, uvScale = 1): this {
    const ux = new THREE.Vector3(...u);
    const vx = new THREE.Vector3(...v);
    const n = new THREE.Vector3().crossVectors(ux, vx).normalize();
    const nn: Vec3 = [n.x, n.y, n.z];
    const p0 = new THREE.Vector3(...origin);
    const p1 = p0.clone().add(ux);
    const p2 = p1.clone().add(vx);
    const p3 = p0.clone().add(vx);
    const ul = ux.length() / uvScale;
    const vl = vx.length() / uvScale;
    const O = p0;
    const A = p1;
    const B = p2;
    const C = p3;
    this.push([O.x, O.y, O.z], nn, color, 0, 0, tileSize);
    this.push([A.x, A.y, A.z], nn, color, ul, 0, tileSize);
    this.push([B.x, B.y, B.z], nn, color, ul, vl, tileSize);
    this.push([O.x, O.y, O.z], nn, color, 0, 0, tileSize);
    this.push([B.x, B.y, B.z], nn, color, ul, vl, tileSize);
    this.push([C.x, C.y, C.z], nn, color, 0, vl, tileSize);
    return this;
  }

  /** Add a smooth parametric quad with explicit normals and uv. */
  smoothQuad(
    p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3,
    n0: Vec3, n1: Vec3, n2: Vec3, n3: Vec3,
    color: Color3, tileSize: number,
    uv0: [number, number], uv1: [number, number], uv2: [number, number], uv3: [number, number],
  ): this {
    this.push(p0, n0, color, uv0[0], uv0[1], tileSize);
    this.push(p1, n1, color, uv1[0], uv1[1], tileSize);
    this.push(p2, n2, color, uv2[0], uv2[1], tileSize);
    this.push(p0, n0, color, uv0[0], uv0[1], tileSize);
    this.push(p2, n2, color, uv2[0], uv2[1], tileSize);
    this.push(p3, n3, color, uv3[0], uv3[1], tileSize);
    return this;
  }

  triangle(
    p0: Vec3, p1: Vec3, p2: Vec3,
    n0: Vec3, n1: Vec3, n2: Vec3,
    color: Color3, tileSize = 0,
    uv0: [number, number] = [0, 0], uv1: [number, number] = [1, 0], uv2: [number, number] = [0, 1],
  ): this {
    this.push(p0, n0, color, uv0[0], uv0[1], tileSize);
    this.push(p1, n1, color, uv1[0], uv1[1], tileSize);
    this.push(p2, n2, color, uv2[0], uv2[1], tileSize);
    return this;
  }

  box(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    color: Color3, tileSize = 0,
    opts: { bottom?: boolean; top?: boolean; side?: boolean } = {},
  ): this {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const bottom = opts.bottom !== false;
    const top = opts.top !== false;
    const sides = opts.side !== false;
    if (sides) {
      this.rect([x1, y0, z0], [0, dy, 0], [0, 0, dz], color, tileSize); // +X
      this.rect([x0, y0, z1], [0, dy, 0], [0, 0, -dz], color, tileSize); // -X
      this.rect([x0, y0, z1], [dx, 0, 0], [0, dy, 0], color, tileSize); // +Z
      this.rect([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], color, tileSize); // -Z
    }
    if (top) this.rect([x1, y1, z0], [0, 0, dz], [-(x1 - x0), 0, 0], color, tileSize); // +Y
    if (bottom) this.rect([x0, y0, z0], [dx, 0, 0], [0, 0, dz], color, tileSize); // -Y
    return this;
  }

  /** Merge an existing geometry (expanding indices) into this builder. */
  append(geo: THREE.BufferGeometry, colorOverride?: Color3, tileSizeOverride?: number): this {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const tile = g.getAttribute('aTileSize') as THREE.BufferAttribute | undefined;
    const c: Color3 = colorOverride ?? [1, 1, 1];
    for (let i = 0; i < pos.count; i++) {
      this.pos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      this.nor.push(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0);
      if (col && !colorOverride) this.col.push(col.getX(i), col.getY(i), col.getZ(i));
      else this.col.push(c[0], c[1], c[2]);
      this.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      this.tile.push(tileSizeOverride ?? (tile ? tile.getX(i) : 0));
    }
    if (g !== geo) g.dispose();
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aTileSize', new THREE.Float32BufferAttribute(this.tile, 1));
    g.computeBoundingSphere();
    return g;
  }
}

export function makeSurface(geo: THREE.BufferGeometry, meta: SurfaceMeta, name = ''): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mesh.name = name;
  mesh.userData.surface = meta;
  mesh.userData.bake = true;
  return mesh;
}

export function addColorAttribute(geo: THREE.BufferGeometry, color: Color3, tileSize = 0) {
  const n = geo.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color[0];
    arr[i * 3 + 1] = color[1];
    arr[i * 3 + 2] = color[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!geo.getAttribute('aTileSize')) {
    geo.setAttribute('aTileSize', new THREE.BufferAttribute(new Float32Array(n).fill(tileSize), 1));
  }
  if (!geo.getAttribute('uv')) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
}

export function chromeTube(points: Vec3[], radius: number, meta: SurfaceMeta, tension = 0.35, tubular = 64): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension);
  const geo = new THREE.TubeGeometry(curve, tubular, radius, 12, false);
  addColorAttribute(geo, meta.color);
  return makeSurface(geo, meta);
}

/** A wall built from a 2D shape with rectangular or arched holes. */
export function wallWithOpenings(
  width: number,
  height: number,
  holes: Array<{ x0: number; x1: number; y0: number; y1: number; arch?: boolean }>,
  color: Color3,
  tileSize: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width, 0);
  shape.lineTo(width, height);
  shape.lineTo(0, height);
  shape.closePath();

  for (const h of holes) {
    const path = new THREE.Path();
    const w = h.x1 - h.x0;
    const r = w / 2;
    const spring = h.arch ? Math.max(h.y0, h.y1 - r) : h.y1;
    path.moveTo(h.x0, h.y0);
    path.lineTo(h.x0, spring);
    if (h.arch) {
      path.absarc(h.x0 + r, spring, r, Math.PI, 0, true);
    } else {
      path.lineTo(h.x1, spring);
    }
    path.lineTo(h.x1, h.y0);
    path.closePath();
    shape.holes.push(path);
  }

  const geo = new THREE.ShapeGeometry(shape, 24);
  addColorAttribute(geo, color, tileSize);
  return geo;
}

/** Map a wall shape built in XY onto a world plane (origin + xAxis*u + yAxis*v). */
export function placeWallGeometry(
  geo: THREE.BufferGeometry,
  origin: Vec3,
  xAxis: Vec3,
  yAxis: Vec3,
): THREE.BufferGeometry {
  const ox = new THREE.Vector3(...origin);
  const ax = new THREE.Vector3(...xAxis);
  const ay = new THREE.Vector3(...yAxis);
  const normal = new THREE.Vector3().crossVectors(ax, ay).normalize();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getY(i);
    const world = ox.clone().addScaledVector(ax, u).addScaledVector(ay, v);
    pos.setXYZ(i, world.x, world.y, world.z);
  }
  pos.needsUpdate = true;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < nor.count; i++) nor.setXYZ(i, normal.x, normal.y, normal.z);
  nor.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

/** Tiled arcade arch: an extruded semicircular band in the YZ plane. */
export function archBand(
  builder: SurfaceBuilder,
  centerZ: number, springY: number, radius: number, thickness: number,
  x0: number, x1: number, color: Color3, tileSize: number, segments = 22,
) {
  const pt = (a: number, r: number, x: number): Vec3 => [
    x,
    springY + Math.sin(a) * r,
    centerZ + Math.cos(a) * r,
  ];
  const nIntra = (a: number): Vec3 => [0, -Math.sin(a), -Math.cos(a)];
  const nExtra = (a: number): Vec3 => [0, Math.sin(a), Math.cos(a)];
  for (let i = 0; i < segments; i++) {
    const a0 = Math.PI * (1 - i / segments);
    const a1 = Math.PI * (1 - (i + 1) / segments);
    const i0 = radius, i1 = radius + thickness;
    // intrados
    builder.smoothQuad(
      pt(a0, i0, x0), pt(a0, i0, x1), pt(a1, i0, x1), pt(a1, i0, x0),
      nIntra(a0), nIntra(a0), nIntra(a1), nIntra(a1),
      color, tileSize, [0, 0], [0, 0], [0, 0], [0, 0],
    );
    // extrados
    builder.smoothQuad(
      pt(a0, i1, x0), pt(a1, i1, x0), pt(a1, i1, x1), pt(a0, i1, x1),
      nExtra(a0), nExtra(a1), nExtra(a1), nExtra(a0),
      color, tileSize, [0, 0], [0, 0], [0, 0], [0, 0],
    );
    // front/back faces
    builder.smoothQuad(
      pt(a0, i0, x0), pt(a1, i0, x0), pt(a1, i1, x0), pt(a0, i1, x0),
      [-1, 0, 0], [-1, 0, 0], [-1, 0, 0], [-1, 0, 0],
      color, tileSize, [0, 0], [0, 0], [0, 0], [0, 0],
    );
    builder.smoothQuad(
      pt(a0, i0, x1), pt(a0, i1, x1), pt(a1, i1, x1), pt(a1, i0, x1),
      [1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0],
      color, tileSize, [0, 0], [0, 0], [0, 0], [0, 0],
    );
  }
  // end caps
  builder.smoothQuad(
    pt(Math.PI, radius, x0), pt(Math.PI, radius, x1), pt(Math.PI, radius + thickness, x1), pt(Math.PI, radius + thickness, x0),
    [0, 0, -1], [0, 0, -1], [0, 0, -1], [0, 0, -1],
    color, tileSize, [0, 0], [0, 0], [0, 0], [0, 0],
  );
  builder.smoothQuad(
    pt(0, radius, x0), pt(0, radius + thickness, x0), pt(0, radius + thickness, x1), pt(0, radius, x1),
    [0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1],
    color, tileSize, [0, 0], [0, 0], [0, 0], [0, 0],
  );
}
