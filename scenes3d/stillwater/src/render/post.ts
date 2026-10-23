import * as THREE from 'three';
import { POOL, WATER_Y } from '../scene/constants';
import type { BakeVolume } from './bake-data';
import type { MaterialLibrary } from './materials';
import {
  ATMO_FRAG, BLUR_FRAG, BRIGHT_FRAG, DEBUG_FRAG, FINAL_FRAG, FULLSCREEN_VERT, WATER_FRAG,
} from '../shaders/post';

function makeQuad(): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0,
  ], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 1, 1, 0, 1,
  ], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.frustumCulled = false;
  return mesh;
}

class Pass {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mesh = makeQuad();
  material: THREE.ShaderMaterial;

  constructor(fragmentShader: string, uniforms: Record<string, THREE.IUniform>) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh.material = this.material;
    this.scene.add(this.mesh);
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

export interface PostPipelineOptions {
  width: number;
  height: number;
  pixelRatio: number;
  world: THREE.Object3D;
  materials: MaterialLibrary;
  camera: THREE.PerspectiveCamera;
  foamCenters: Array<[number, number, number]>;
}

export class PostPipeline {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  world: THREE.Object3D;
  materials: MaterialLibrary;
  width = 1;
  height = 1;
  pixelRatio = 1;

  sceneRT!: THREE.WebGLRenderTarget;
  waterRT!: THREE.WebGLRenderTarget;
  atmoRT!: THREE.WebGLRenderTarget;
  bloomA!: THREE.WebGLRenderTarget;
  bloomB!: THREE.WebGLRenderTarget;
  bloomC!: THREE.WebGLRenderTarget;

  reflectionRT!: THREE.WebGLRenderTarget;
  reflectionCamera = new THREE.PerspectiveCamera();
  reflectionVP = new THREE.Matrix4();

  waterPass: Pass;
  atmoPass: Pass;
  brightPass: Pass;
  blurPass: Pass;
  finalPass: Pass;
  debugPass: Pass;
  debugView: 'reflection' | 'scene' | 'water' | 'atmo' | 'mask' | '' = '';

  fog: BakeVolume | null = null;
  atmoStrength = 1.0;
  exposure = 1.0;
  fade = 0;
  grain = 0.007;
  vignette = 0.24;
  chroma = 0.0015;
  bloomStrength = 0.18;
  reflectionEnabled = true;
  time = 0;

  constructor(options: PostPipelineOptions) {
    this.world = options.world;
    this.materials = options.materials;
    this.camera = options.camera;

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('scene') as HTMLCanvasElement,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x050807, 1);

    const gl = this.renderer.getContext();
    if (!gl.getExtension('EXT_color_buffer_float')) {
      console.warn('Float render targets unavailable; falling back to LDR.');
    }

    const foam = Array.from({ length: 12 }, () => new THREE.Vector3());
    options.foamCenters.slice(0, 12).forEach((c, i) => foam[i].set(c[0], c[1], c[2]));

    this.waterPass = new Pass(WATER_FRAG, {
      tScene: { value: null },
      tDepth: { value: null },
      tReflection: { value: null },
      uInvProjection: { value: new THREE.Matrix4() },
      uCameraWorld: { value: new THREE.Matrix4() },
      uReflVP: { value: new THREE.Matrix4() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uReflectionReady: { value: 0 },
      uWaterY: { value: WATER_Y },
      uDebugMask: { value: 0 },
      uPool: { value: new THREE.Vector4(POOL.xMin, POOL.zMin, POOL.xMax, POOL.zMax) },
      uFoamCenters: { value: foam },
      uFoamCount: { value: Math.min(12, options.foamCenters.length) },
    });

    this.atmoPass = new Pass(ATMO_FRAG, {
      tScene: { value: null },
      tDepth: { value: null },
      uInvProjection: { value: new THREE.Matrix4() },
      uCameraWorld: { value: new THREE.Matrix4() },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uAtmoStrength: { value: 1.0 },
      uAtmoFade: { value: 1.0 },
      uFog: { value: null },
      uFogReady: { value: 0 },
      uFogMin: { value: new THREE.Vector3() },
      uFogInvRange: { value: new THREE.Vector3(1, 1, 1) },
    });

    this.brightPass = new Pass(BRIGHT_FRAG, {
      tSource: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0.85 },
    });
    this.blurPass = new Pass(BLUR_FRAG, {
      tSource: { value: null },
      uDirection: { value: new THREE.Vector2() },
    });
    this.debugPass = new Pass(DEBUG_FRAG, {
      tSource: { value: null },
      uGamma: { value: 1.0 },
    });
    this.finalPass = new Pass(FINAL_FRAG, {
      tScene: { value: null },
      tBloom: { value: null },
      tDepth: { value: null },
      uResolution: { value: new THREE.Vector2() },
      uTime: { value: 0 },
      uExposure: { value: 1.0 },
      uBloomStrength: { value: 0.18 },
      uGrain: { value: 0.007 },
      uFade: { value: 0 },
      uVignette: { value: 0.24 },
      uChroma: { value: 0.0015 },
    });

    this.resize(options.width, options.height, options.pixelRatio);
  }

  setFog(fog: BakeVolume | null) {
    this.fog = fog;
    const u = this.atmoPass.material.uniforms;
    u.uFogReady.value = fog ? 1 : 0;
    u.uFog.value = fog?.texture ?? null;
    if (fog) {
      u.uFogMin.value.fromArray(fog.info.min);
      const range = new THREE.Vector3().fromArray(fog.info.max).sub(u.uFogMin.value);
      u.uFogInvRange.value.set(1 / range.x, 1 / range.y, 1 / range.z);
    }
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.width = Math.max(2, Math.floor(width));
    this.height = Math.max(2, Math.floor(height));
    this.pixelRatio = Math.min(pixelRatio, 1.75);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);

    const w = this.width;
    const h = this.height;
    const halfW = Math.max(2, Math.floor(w / 2));
    const halfH = Math.max(2, Math.floor(h / 2));
    const quarterW = Math.max(2, Math.floor(w / 4));
    const quarterH = Math.max(2, Math.floor(h / 4));
    const reflectW = Math.max(2, Math.floor(w * 0.7));
    const reflectH = Math.max(2, Math.floor(h * 0.7));

    const dispose = (rt?: THREE.WebGLRenderTarget) => rt?.dispose();

    dispose(this.sceneRT);
    dispose(this.waterRT);
    dispose(this.atmoRT);
    dispose(this.bloomA);
    dispose(this.bloomB);
    dispose(this.bloomC);
    dispose(this.reflectionRT);

    const colorOpts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.NoColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    };

    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { ...colorOpts, depthBuffer: true });
    this.sceneRT.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.sceneRT.depthTexture.format = THREE.DepthFormat;
    this.sceneRT.depthTexture.minFilter = THREE.NearestFilter;
    this.sceneRT.depthTexture.magFilter = THREE.NearestFilter;

    this.waterRT = new THREE.WebGLRenderTarget(w, h, colorOpts);
    this.atmoRT = new THREE.WebGLRenderTarget(w, h, colorOpts);
    this.bloomA = new THREE.WebGLRenderTarget(halfW, halfH, colorOpts);
    this.bloomB = new THREE.WebGLRenderTarget(halfW, halfH, colorOpts);
    this.bloomC = new THREE.WebGLRenderTarget(quarterW, quarterH, colorOpts);
    this.reflectionRT = new THREE.WebGLRenderTarget(reflectW, reflectH, { ...colorOpts, depthBuffer: true });
    this.reflectionRT.depthTexture = new THREE.DepthTexture(reflectW, reflectH, THREE.UnsignedIntType);
    this.reflectionRT.depthTexture.format = THREE.DepthFormat;

    this.reflectionCamera.aspect = w / h;
    this.reflectionCamera.fov = this.camera.fov;
    this.reflectionCamera.near = this.camera.near;
    this.reflectionCamera.far = this.camera.far;
    this.reflectionCamera.updateProjectionMatrix();

    (this.waterPass.material.uniforms.uResolution.value as THREE.Vector2).set(w, h);
    (this.atmoPass.material.uniforms.uResolution.value as THREE.Vector2).set(w, h);
    (this.finalPass.material.uniforms.uResolution.value as THREE.Vector2).set(w, h);
  }

  renderReflection() {
    if (!this.reflectionEnabled) {
      (this.waterPass.material.uniforms.uReflectionReady.value as number) = 0;
      return;
    }

    const cam = this.camera;
    cam.updateMatrixWorld();
    const pos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

    const virtualPos = new THREE.Vector3(pos.x, 2 * WATER_Y - pos.y, pos.z);
    const virtualForward = new THREE.Vector3(forward.x, -forward.y, forward.z);
    const virtualUp = new THREE.Vector3(up.x, -up.y, up.z);

    const rcam = this.reflectionCamera;
    rcam.position.copy(virtualPos);
    rcam.up.copy(virtualUp);
    rcam.lookAt(virtualPos.clone().add(virtualForward));
    rcam.near = cam.near;
    rcam.far = cam.far;
    rcam.fov = cam.fov;
    rcam.aspect = cam.aspect;
    rcam.updateProjectionMatrix();
    rcam.updateMatrixWorld(true);
    this.reflectionVP.multiplyMatrices(rcam.projectionMatrix, rcam.matrixWorldInverse);

    this.materials.setClipWater(true);
    this.renderer.setRenderTarget(this.reflectionRT);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.world, rcam);
    this.materials.setClipWater(false);

    const u = this.waterPass.material.uniforms;
    u.tReflection.value = this.reflectionRT.texture;
    (u.uReflVP.value as THREE.Matrix4).copy(this.reflectionVP);
    u.uReflectionReady.value = 1;
  }

  render(time: number) {
    this.time = time;
    this.camera.updateMatrixWorld();
    this.materials.update(0, time);

    this.renderReflection();

    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.world, this.camera);

    const wu = this.waterPass.material.uniforms;
    wu.tScene.value = this.sceneRT.texture;
    wu.tDepth.value = this.sceneRT.depthTexture;
    wu.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
    wu.uCameraWorld.value.copy(this.camera.matrixWorld);
    wu.uTime.value = time;
    wu.uDebugMask.value = this.debugView === 'mask' ? 1 : 0;
    this.waterPass.render(this.renderer, this.waterRT);

    const au = this.atmoPass.material.uniforms;
    au.tScene.value = this.waterRT.texture;
    au.tDepth.value = this.sceneRT.depthTexture;
    au.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
    au.uCameraWorld.value.copy(this.camera.matrixWorld);
    au.uTime.value = time;
    au.uAtmoStrength.value = this.atmoStrength;
    this.atmoPass.render(this.renderer, this.atmoRT);

    // Bloom: half-res threshold and two blur passes at 1/2 and 1/4.
    const bu = this.brightPass.material.uniforms;
    bu.tSource.value = this.atmoRT.texture;
    (bu.uTexel.value as THREE.Vector2).set(1 / this.width, 1 / this.height);
    this.brightPass.render(this.renderer, this.bloomA);

    const blu = this.blurPass.material.uniforms;
    const halfW = this.bloomA.width;
    const halfH = this.bloomA.height;

    blu.tSource.value = this.bloomA.texture;
    (blu.uDirection.value as THREE.Vector2).set(1 / halfW, 0);
    this.blurPass.render(this.renderer, this.bloomB);

    blu.tSource.value = this.bloomB.texture;
    (blu.uDirection.value as THREE.Vector2).set(0, 1 / halfH);
    this.blurPass.render(this.renderer, this.bloomC);

    blu.tSource.value = this.bloomC.texture;
    (blu.uDirection.value as THREE.Vector2).set(1.7 / halfW, 0);
    this.blurPass.render(this.renderer, this.bloomB);

    blu.tSource.value = this.bloomB.texture;
    (blu.uDirection.value as THREE.Vector2).set(0, 1.7 / halfH);
    this.blurPass.render(this.renderer, this.bloomA);

    if (this.debugView) {
      const du = this.debugPass.material.uniforms;
      du.tSource.value = this.debugView === 'reflection'
        ? this.reflectionRT.texture
        : this.debugView === 'scene'
          ? this.sceneRT.texture
          : this.debugView === 'water' || this.debugView === 'mask'
            ? this.waterRT.texture
            : this.atmoRT.texture;
      this.debugPass.render(this.renderer, null);
      return;
    }

    const fu = this.finalPass.material.uniforms;
    fu.tScene.value = this.atmoRT.texture;
    fu.tBloom.value = this.bloomA.texture;
    fu.tDepth.value = this.sceneRT.depthTexture;
    fu.uTime.value = time;
    fu.uExposure.value = this.exposure;
    fu.uBloomStrength.value = this.bloomStrength;
    fu.uGrain.value = this.grain;
    fu.uFade.value = this.fade;
    fu.uVignette.value = this.vignette;
    fu.uChroma.value = this.chroma;
    this.finalPass.render(this.renderer, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.waterRT.dispose();
    this.atmoRT.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.bloomC.dispose();
    this.reflectionRT.dispose();
    this.waterPass.dispose();
    this.atmoPass.dispose();
    this.brightPass.dispose();
    this.blurPass.dispose();
    this.debugPass.dispose();
    this.finalPass.dispose();
    this.renderer.dispose();
  }
}
