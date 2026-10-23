import * as THREE from 'three';

export interface BakeInfo {
  dims: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  spp?: number;
  bounces?: number;
}

export interface BakeVolume {
  texture: THREE.Data3DTexture;
  info: BakeInfo;
}

async function loadVolume(url: string, type: 'gi' | 'fog'): Promise<BakeVolume | null> {
  try {
    const jsonRes = await fetch(`${url}.json`, { cache: 'no-cache' });
    if (!jsonRes.ok) return null;
    const jsonText = await jsonRes.text();
    let info: BakeInfo;
    try {
      info = JSON.parse(jsonText) as BakeInfo;
    } catch {
      // Vite's SPA fallback answers missing bake files with index.html.
      return null;
    }
    const binRes = await fetch(`${url}.bin`, { cache: 'no-cache' });
    if (!binRes.ok) return null;
    const buffer = await binRes.arrayBuffer();
    const [nx, ny, nz] = info.dims;
    const expected = nx * ny * nz * 4 * (type === 'gi' ? 2 : 1);
    if (buffer.byteLength < expected) {
      console.warn(`bake volume ${url} size mismatch`, buffer.byteLength, expected);
      return null;
    }
    let texture: THREE.Data3DTexture;
    if (type === 'gi') {
      texture = new THREE.Data3DTexture(new Uint16Array(buffer, 0, nx * ny * nz * 4), nx, ny, nz);
      texture.format = THREE.RGBAFormat;
      texture.type = THREE.HalfFloatType;
      texture.internalFormat = 'RGBA16F';
    } else {
      texture = new THREE.Data3DTexture(new Uint8Array(buffer, 0, nx * ny * nz * 4), nx, ny, nz);
      texture.format = THREE.RGBAFormat;
      texture.type = THREE.UnsignedByteType;
      texture.internalFormat = 'RGBA8';
    }
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return { texture, info };
  } catch (err) {
    console.warn(`bake volume ${url} unavailable`, err);
    return null;
  }
}

export async function loadBakeVolumes(onProgress?: (p: number, label: string) => void): Promise<{
  gi: BakeVolume | null;
  fog: BakeVolume | null;
}> {
  onProgress?.(0.15, 'READING THE LIGHT');
  const gi = await loadVolume('/bake/gi', 'gi');
  onProgress?.(0.82, 'THINNING THE AIR');
  // The atmosphere is analytic; the fog slot stays available for a future bake.
  const fog: BakeVolume | null = null;
  onProgress?.(1.0, 'READY');
  return { gi, fog };
}

/** 1x1 black cube used before the real environment probe is captured. */
export function makeEmptyCubeTexture(): THREE.CubeTexture {
  const tex = new THREE.CubeTexture();
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
