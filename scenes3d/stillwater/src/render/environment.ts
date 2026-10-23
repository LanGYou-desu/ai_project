import * as THREE from 'three';
import type { MaterialLibrary } from './materials';

export function captureEnvironment(
  renderer: THREE.WebGLRenderer,
  world: THREE.Object3D,
  materials: MaterialLibrary,
  position: THREE.Vector3,
  size = 128,
): THREE.CubeTexture {
  const scene = new THREE.Scene();
  scene.add(world);
  const target = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.NoColorSpace,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  const camera = new THREE.CubeCamera(0.12, 90, target);
  camera.position.copy(position);

  const prevTarget = renderer.getRenderTarget();
  materials.setClipWater(false);
  camera.update(renderer, scene);
  // A second pass now contains the room's reflected bounce.
  camera.update(renderer, scene);
  renderer.setRenderTarget(prevTarget);

  return target.texture;
}
