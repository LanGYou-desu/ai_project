import type { TriangleScene } from './bake-common';
import { emitterSample } from './bake-common';

export interface VolumeBounds {
  min: [number, number, number];
  max: [number, number, number];
}

export interface BakeJob {
  dims: [number, number, number];
  bounds: VolumeBounds;
  spp: number;
  bounces: number;
  seed: number;
  zStart: number;
  zEnd: number;
}

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function radicalInverse(i: number): number {
  let bits = i;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits / 4294967296;
}

function basis(nx: number, ny: number, nz: number): [number, number, number, number, number, number, number, number, number] {
  let tx: number, ty: number, tz: number;
  if (Math.abs(nx) > Math.abs(ny)) {
    const inv = 1 / Math.hypot(nx, ny);
    tx = -ny * inv; ty = nx * inv; tz = 0;
  } else {
    const inv = 1 / Math.hypot(ny, nz);
    tx = 0; ty = -nz * inv; tz = ny * inv;
  }
  // bx = normalized cross / bitangent
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;
  return [tx, ty, tz, bx, by, bz, nx, ny, nz];
}

interface Hit {
  t: number;
  tri: number;
}

export function bakeGI(scene: TriangleScene, job: BakeJob, onProgress?: (p: number) => void): Float32Array {
  const [nx, ny, nzTotal] = job.dims;
  const { zStart, zEnd } = job;
  const [minX, minY, minZ] = job.bounds.min;
  const [maxX, maxY, maxZ] = job.bounds.max;
  const invX = nx / (maxX - minX);
  const invY = ny / (maxY - minY);
  const invZ = nzTotal / (maxZ - minZ);
  const zCount = zEnd - zStart;
  const out = new Float32Array(nx * ny * zCount * 3);
  const scratch: Hit = { t: 0, tri: -1 };
  const n = scene.n;
  const p0 = scene.p0, p1 = scene.p1, p2 = scene.p2;
  const albedo = scene.albedo, emission = scene.emission;
  const ids = scene.emitterIds;
  const areas = scene.emitterArea;
  const cumulative = scene.emitterCumulative;
  const totalWeight = scene.emitterTotalWeight;
  const spp = Math.max(1, job.spp);
  const bounces = Math.max(1, job.bounces);

  // Hammersley sphere points.
  const sphereX = new Float64Array(spp);
  const sphereY = new Float64Array(spp);
  const sphereZ = new Float64Array(spp);
  for (let s = 0; s < spp; s++) {
    const u = (s + 0.5) / spp;
    const phi = 2 * Math.PI * radicalInverse(s + 1);
    const cosTheta = 1 - 2 * u;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    sphereX[s] = Math.cos(phi) * sinTheta;
    sphereY[s] = cosTheta;
    sphereZ[s] = Math.sin(phi) * sinTheta;
  }

  let row = 0;
  for (let z = zStart; z < zEnd; z++) {
    const pz = minZ + (z + 0.5) / invZ;
    for (let y = 0; y < ny; y++) {
      const py = minY + (y + 0.5) / invY;
      for (let x = 0; x < nx; x++) {
        const px = minX + (x + 0.5) / invX;
        const voxelIndex = x + nx * (y + ny * (z - zStart));
        let r = 0, g = 0, b = 0;
        const seed = hash(x * 1973 + y * 9277 + z * 26699 + job.seed);

        for (let s = 0; s < spp; s++) {
          // Rotate the sample pattern per voxel to hide banding.
          const rot = seed * Math.PI * 2;
          const cosR = Math.cos(rot), sinR = Math.sin(rot);
          let dx = sphereX[s] * cosR - sphereZ[s] * sinR;
          let dz = sphereX[s] * sinR + sphereZ[s] * cosR;
          let dy = sphereY[s];
          let ox = px + (hash(voxelIndex * 31 + s * 7 + 1) - 0.5) * 0.05;
          let oy = py + (hash(voxelIndex * 37 + s * 11 + 2) - 0.5) * 0.05;
          let oz = pz + (hash(voxelIndex * 41 + s * 13 + 3) - 0.5) * 0.05;

          let tr = 1, tg = 1, tb = 1;
          let sr = 0, sg = 0, sb = 0;

          for (let depth = 0; depth < bounces; depth++) {
            const hit = scene.bvh.intersect(ox, oy, oz, dx, dy, dz, 90, scratch);
            if (!hit) {
              // A dim, cool luminous exterior seen through gaps and doorway mouths.
              if (depth === 0) {
                sr += tr * 0.11;
                sg += tg * 0.145;
                sb += tb * 0.14;
              }
              break;
            }

            const tri = scratch.tri;
            const i = tri * 3;
            const hx = ox + dx * scratch.t;
            const hy = oy + dy * scratch.t;
            const hz = oz + dz * scratch.t;
            let hnx = n[i], hny = n[i + 1], hnz = n[i + 2];

            // Flip the normal toward the incoming ray for single-sided architectural shells.
            if (hnx * dx + hny * dy + hnz * dz > 0) {
              hnx = -hnx; hny = -hny; hnz = -hnz;
            }

            const er = emission[i], eg = emission[i + 1], eb = emission[i + 2];
            if (er + eg + eb > 1e-4) {
              if (depth === 0) {
                sr += tr * er;
                sg += tg * eg;
                sb += tb * eb;
              }
              break;
            }

            if (depth >= bounces - 1) break;

            // Direct lighting at the hit surface (next-event estimation).
            const pick = hash(voxelIndex * 1451 + s * 311 + depth * 29 + job.seed);
            const target = pick * totalWeight;
            let lo = 0, hi = ids.length - 1;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (cumulative[mid] < target) lo = mid + 1;
              else hi = mid;
            }
            const emitterSlot = lo;
            const etri = ids[emitterSlot];
            const ei = etri * 3;
            const r1 = hash(voxelIndex * 2371 + s * 97 + depth * 61 + 17);
            const r2 = hash(voxelIndex * 389 + s * 53 + depth * 71 + 29);
            const su = Math.sqrt(r1);
            const a = p0[ei], ay = p0[ei + 1], az = p0[ei + 2];
            const bx = p1[ei], by = p1[ei + 1], bz = p1[ei + 2];
            const cx = p2[ei], cy = p2[ei + 1], cz = p2[ei + 2];
            const lx = a * (1 - su) + bx * su * (1 - r2) + cx * su * r2;
            const ly = ay * (1 - su) + by * su * (1 - r2) + cy * su * r2;
            const lz = az * (1 - su) + bz * su * (1 - r2) + cz * su * r2;
            let ldx = lx - hx, ldy = ly - hy, ldz = lz - hz;
            const dist2 = ldx * ldx + ldy * ldy + ldz * ldz;
            if (dist2 < 1e-6) continue;
            const invDist = 1 / Math.sqrt(dist2);
            ldx *= invDist; ldy *= invDist; ldz *= invDist;
            const cosL = -(ldx * n[ei] + ldy * n[ei + 1] + ldz * n[ei + 2]);
            const cosS = hnx * ldx + hny * ldy + hnz * ldz;
            if (cosL <= 0 || cosS <= 0) continue;
            if (scene.bvh.occluded(hx + hnx * 0.002, hy + hny * 0.002, hz + hnz * 0.002, ldx, ldy, ldz, Math.sqrt(dist2) - 0.003)) continue;

            const lum = emission[ei] * 0.2126 + emission[ei + 1] * 0.7152 + emission[ei + 2] * 0.0722;
            const weightFactor = totalWeight / Math.max(lum, 1e-5);
            const solid = cosS * cosL / dist2 * weightFactor;
            const invPi = 0.318309886;
            sr += tr * albedo[i] * invPi * emission[ei] * solid;
            sg += tg * albedo[i + 1] * invPi * emission[ei + 1] * solid;
            sb += tb * albedo[i + 2] * invPi * emission[ei + 2] * solid;

            // Cosine-weighted diffuse bounce.
            const rr1 = hash(voxelIndex * 2137 + s * 131 + depth * 17 + 101);
            const rr2 = hash(voxelIndex * 3217 + s * 151 + depth * 23 + 211);
            const phi = rr1 * Math.PI * 2;
            const sinTheta = Math.sqrt(rr2);
            const cosTheta = Math.sqrt(Math.max(0, 1 - rr2));
            const [tx, ty, tz, btx, bty, btz] = basis(hnx, hny, hnz);
            dx = tx * Math.cos(phi) * sinTheta + btx * Math.sin(phi) * sinTheta + hnx * cosTheta;
            dy = ty * Math.cos(phi) * sinTheta + bty * Math.sin(phi) * sinTheta + hny * cosTheta;
            dz = tz * Math.cos(phi) * sinTheta + btz * Math.sin(phi) * sinTheta + hnz * cosTheta;
            ox = hx + hnx * 0.006;
            oy = hy + hny * 0.006;
            oz = hz + hnz * 0.006;

            tr *= albedo[ei] * 0.92;
            tg *= albedo[ei + 1] * 0.92;
            tb *= albedo[ei + 2] * 0.92;
            if (tr + tg + tb < 0.03) break;
          }

          r += sr;
          g += sg;
          b += sb;
        }

        const inv = 1 / spp;
        out[voxelIndex * 3] = r * inv;
        out[voxelIndex * 3 + 1] = g * inv;
        out[voxelIndex * 3 + 2] = b * inv;
      }
    }
    row++;
    if (onProgress && (row & 1) === 0) onProgress(row / zCount);
  }

  return out;
}

/** Denoise a full volume in-place with a small separable Gaussian. */
export function denoiseVolume(data: Float32Array, dims: [number, number, number], passes = 2) {
  const [nx, ny, nz] = dims;
  const tmp = new Float32Array(data.length);
  const kernel = [0.25, 0.5, 0.25];
  for (let p = 0; p < passes; p++) {
    // X
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = (x + nx * (y + ny * z)) * 3;
      for (let c = 0; c < 3; c++) {
        const xm = Math.max(0, x - 1), xp = Math.min(nx - 1, x + 1);
        tmp[i + c] =
          data[(xm + nx * (y + ny * z)) * 3 + c] * kernel[0] +
          data[i + c] * kernel[1] +
          data[(xp + nx * (y + ny * z)) * 3 + c] * kernel[2];
      }
    }
    data.set(tmp);
    // Y
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = (x + nx * (y + ny * z)) * 3;
      const ym = Math.max(0, y - 1), yp = Math.min(ny - 1, y + 1);
      for (let c = 0; c < 3; c++) {
        tmp[i + c] =
          data[(x + nx * (ym + ny * z)) * 3 + c] * kernel[0] +
          data[i + c] * kernel[1] +
          data[(x + nx * (yp + ny * z)) * 3 + c] * kernel[2];
      }
    }
    data.set(tmp);
    // Z
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = (x + nx * (y + ny * z)) * 3;
      const zm = Math.max(0, z - 1), zp = Math.min(nz - 1, z + 1);
      for (let c = 0; c < 3; c++) {
        tmp[i + c] =
          data[(x + nx * (y + ny * zm)) * 3 + c] * kernel[0] +
          data[i + c] * kernel[1] +
          data[(x + nx * (y + ny * zp)) * 3 + c] * kernel[2];
      }
    }
    data.set(tmp);
  }
}

export function floatToHalf(value: number): number {
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = value;
  const x = u32[0];
  const sign = (x >> 16) & 0x8000;
  let exp = (x >> 23) & 0xff;
  let mant = x & 0x7fffff;
  if (exp === 0xff) {
    return sign | 0x7c00 | (mant ? 0x200 : 0);
  }
  exp = exp - 127 + 15;
  if (exp <= 0) {
    if (exp < -10) return sign;
    mant = (mant | 0x800000) >> (1 - exp);
    return sign | ((mant + 0x1000) >> 13);
  }
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | ((mant + 0x1000) >> 13);
}

export function encodeHalfVolume(data: Float32Array): Uint16Array {
  const out = new Uint16Array(data.length / 3 * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    out[j] = floatToHalf(data[i]);
    out[j + 1] = floatToHalf(data[i + 1]);
    out[j + 2] = floatToHalf(data[i + 2]);
    out[j + 3] = floatToHalf(1);
  }
  return out;
}
