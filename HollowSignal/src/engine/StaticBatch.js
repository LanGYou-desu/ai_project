import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/BufferGeometryUtils.js';

const _color = new THREE.Color();
const _lightPos = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _toLight = new THREE.Vector3();

function rayAABB(ox, oy, oz, dx, dy, dz, maxDist, box) {
  // Slab intersection. Returns true if the segment hits the box before maxDist.
  let tmin = 0;
  let tmax = maxDist;
  const axes = [
    [ox, dx, box.minX, box.maxX],
    [oy, dy, box.minY, box.maxY],
    [oz, dz, box.minZ, box.maxZ]
  ];
  for (const [o, d, min, max] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return false;
      continue;
    }
    const inv = 1 / d;
    let t1 = (min - o) * inv;
    let t2 = (max - o) * inv;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return false;
  }
  return tmax >= 0.06 && tmin <= maxDist;
}

function isBlocked(origin, dir, dist, colliders) {
  for (const col of colliders) {
    if (col.bakeOccluder === false || col.enabled === false) continue;
    if (!col.threeD) {
      // 2D colliders used for doors and low-overhead blockers are not light blockers.
      continue;
    }
    // Skip the surface's own box.
    if (origin.x > col.minX - 0.06 && origin.x < col.maxX + 0.06 &&
        origin.y > col.minY - 0.06 && origin.y < col.maxY + 0.06 &&
        origin.z > col.minZ - 0.06 && origin.z < col.maxZ + 0.06) {
      continue;
    }
    if (rayAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, dist, col)) return true;
  }
  return false;
}

export class StaticBatch {
  constructor(scene, materialLibrary) {
    this.scene = scene;
    this.materials = materialLibrary;
    this.batches = new Map();
    this.meshes = [];
    this.bakeLights = [];
    this.bakeStats = { vertices: 0, lights: 0, ms: 0 };
  }

  addGeometry(geometry, materialKey, matrix = null, options = {}) {
    if (!geometry) return null;
    if (!this.batches.has(materialKey)) this.batches.set(materialKey, []);
    const geo = geometry.clone();
    if (matrix) geo.applyMatrix4(matrix);
    geo.clearGroups();
    if (!geo.attributes.uv) {
      const count = geo.attributes.position.count;
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    this.batches.get(materialKey).push(geo);
    return geo;
  }

  addBox(materialKey, w, h, d, x, y, z, {
    rotation = null,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0,
    scale = 2,
    offset = null,
    segments = 1
  } = {}) {
    const uvOffset = offset || [(x * 0.137 + z * 0.071) % 1, (y * 0.219) % 1];
    // Large surfaces need subdivision or per-vertex baked light only samples the
    // corners and reads as a flat, almost-black wash. Subdivide the two long axes
    // at roughly 1.5 m intervals; thickness stays at one segment.
    const auto = (v) => Math.min(18, Math.max(1, Math.ceil(v / .95)));
    let sx, sy, sz;
    if (segments > 1) {
      sx = sy = sz = segments;
    } else {
      // Subdivide along the two largest axes only. This keeps a 14 m floor
      // open in both width and depth while leaving its thin slab undivided.
      const axes = [
        ['x', w],
        ['y', h],
        ['z', d]
      ].sort((a, b) => b[1] - a[1]);
      sx = sy = sz = 1;
      sx = axes[0][0] === 'x' ? auto(w) : axes[1][0] === 'x' ? auto(w) : 1;
      sy = axes[0][0] === 'y' ? auto(h) : axes[1][0] === 'y' ? auto(h) : 1;
      sz = axes[0][0] === 'z' ? auto(d) : axes[1][0] === 'z' ? auto(d) : 1;
    }
    const geo = new THREE.BoxGeometry(w, h, d, sx, sy, sz);
    this._applyBoxUV(geo, scale, uvOffset);
    const m = new THREE.Matrix4();
    const q = rotation || new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationX, rotationY, rotationZ));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    return this.addGeometry(geo, materialKey, m);
  }

  _applyBoxUV(geometry, scale, offset) {
    const pos = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(normal.getX(i));
      const ny = Math.abs(normal.getY(i));
      const nz = Math.abs(normal.getZ(i));
      if (nx >= ny && nx >= nz) uv.setXY(i, pos.getZ(i) / scale + offset[0], pos.getY(i) / scale + offset[1]);
      else if (ny >= nx && ny >= nz) uv.setXY(i, pos.getX(i) / scale + offset[0], pos.getZ(i) / scale + offset[1]);
      else uv.setXY(i, pos.getX(i) / scale + offset[0], pos.getY(i) / scale + offset[1]);
    }
    uv.needsUpdate = true;
  }

  addCylinder(materialKey, radiusTop, radiusBottom, height, segments, matrix) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (Math.PI * 2 * radiusTop) / 1.6, uv.getY(i) * height / 1.6);
    }
    return this.addGeometry(geo, materialKey, matrix);
  }

  addPipe(materialKey, a, b, radius, segments = 12, uvOffset = 0) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) return null;
    const geo = new THREE.CylinderGeometry(radius, radius, len, segments, 1, false);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * radius) / 1.4 + uvOffset, uv.getY(i) * len / 1.4);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(.5);
    const m = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
    return this.addGeometry(geo, materialKey, m);
  }

  addPlane(materialKey, w, h, x, y, z, rx = 0, ry = 0, rz = 0) {
    const geo = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    return this.addGeometry(geo, materialKey, m);
  }

  finalize(lights = [], colliders = []) {
    this.bakeLights = lights;
    for (const [key, geometries] of this.batches.entries()) {
      if (!geometries.length) continue;
      let merged;
      try {
        merged = mergeGeometries(geometries, false);
      } catch (err) {
        console.error('Geometry merge failed for', key, err);
        continue;
      }
      if (!merged) continue;
      merged.computeBoundingSphere();
      const source = this.materials.get(key) || (key === 'blackHole' ? this.materials.blackHole : null);
      if (!source) {
        console.warn(`StaticBatch: unknown material "${key}", falling back to concreteDark.`);
      }
      const material = (source || this.materials.get('concreteDark')).clone();
      material.vertexColors = !material.isMeshBasicMaterial;
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `static:${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.staticBatchKey = key;
      this.scene.add(mesh);
      this.meshes.push(mesh);
      for (const geo of geometries) geo.dispose();
      this.bakeStats.vertices += merged.attributes.position.count;
    }
    this.batches.clear();
    this.bake(lights, colliders);
    return this.meshes;
  }

  bake(lights, colliders) {
    const start = performance.now();
    this.bakeLights = lights;
    const activeLights = lights.slice(0, 48); // Bake budget; levels use far fewer.
    for (const mesh of this.meshes) {
      const geo = mesh.geometry;
      const pos = geo.attributes.position;
      const normal = geo.attributes.normal;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
        _normal.set(nx, ny, nz).normalize();
        // A low, cool ambient base keeps silhouette information in the dark.
        let r = 0.044 + Math.max(0, ny) * 0.018;
        let g = 0.052 + Math.max(0, ny) * 0.021;
        let b = 0.047 + Math.max(0, ny) * 0.017;
        for (const light of activeLights) {
          const dx = light.position.x - px;
          const dy = light.position.y - py;
          const dz = light.position.z - pz;
          const distSq = dx * dx + dy * dy + dz * dz;
          const range = light.range || 9;
          if (distSq > range * range) continue;
          const dist = Math.sqrt(distSq);
          _toLight.set(dx / dist, dy / dist, dz / dist);
          let ndl = _normal.dot(_toLight);
          ndl = Math.max(0, ndl * .88 + .12);
          if (ndl <= 0) continue;
          const attenuation = 1 / (1 + dist * .24 + distSq * .065);
          let energy = attenuation * (light.intensity ?? 1) * ndl;
          if (light.castShadow !== false) {
            if (isBlocked(new THREE.Vector3(px + nx * .035, py + ny * .035, pz + nz * .035), _toLight, dist, colliders)) {
              continue;
            }
          }
          const color = light.color;
          r += color.r * energy;
          g += color.g * energy;
          b += color.b * energy;
        }
        const warmth = 1.0;
        colors[i * 3] = Math.min(2.2, r * warmth);
        colors[i * 3 + 1] = Math.min(2.2, g);
        colors[i * 3 + 2] = Math.min(2.2, b);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      mesh.material.needsUpdate = true;
    }
    this.bakeStats.lights = activeLights.length;
    this.bakeStats.ms = Math.round(performance.now() - start);
  }

  dispose() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes.length = 0;
  }
}
