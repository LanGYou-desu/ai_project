import * as THREE from 'three';
import { QUALITY_PRESETS } from './Settings.js';

const POST_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAGMENT = /* glsl */`
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float grain;
  uniform float danger;
  uniform float exposure;
  uniform float aberration;
  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec3 acesFilm(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec3 linearToSRGB(vec3 value) {
    return mix(value * 12.92, 1.055 * pow(value, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), value));
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float radius = length(centered);
    vec2 dir = radius > 0.0001 ? normalize(centered) : vec2(0.0);

    // A very restrained lens smear, strongest at the edges and during danger.
    float edge = smoothstep(0.18, 0.72, radius);
    float pulse = 0.0007 + danger * 0.0023;
    float ca = aberration * (edge * edge + danger * 0.45) * pulse;
    vec2 uvR = vUv + dir * ca;
    vec2 uvG = vUv;
    vec2 uvB = vUv - dir * ca;
    vec3 color;
    color.r = texture2D(tDiffuse, uvR).r;
    color.g = texture2D(tDiffuse, uvG).g;
    color.b = texture2D(tDiffuse, uvB).b;

    // Gentle breathing warp when the signal is close.
    vec2 warped = vUv - 0.5;
    float ripple = sin(warped.y * 18.0 + time * 1.9) * cos(warped.x * 12.0 - time * 1.2);
    color.rgb += ripple * danger * 0.004;

    color *= exposure;

    // Cool shadows, warm sickly highlights. Values stay close to neutral.
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadowTint = vec3(0.865, 0.965, 1.035);
    vec3 highTint = vec3(1.055, 1.015, 0.91);
    vec3 tint = mix(shadowTint, highTint, smoothstep(0.02, 0.75, luma));
    color *= tint;
    color = mix(vec3(luma), color, 0.925);
    color = acesFilm(color * 1.18);
    color = pow(color, vec3(0.96, 1.005, 1.04));

    // Vignette and a thin darkness at the lower edge of the frame.
    float vignette = smoothstep(0.92, 0.34, radius);
    vignette *= 1.0 - smoothstep(0.62, 0.99, vUv.y * 0.16 + radius * 0.84);
    color *= mix(0.42, 1.0, vignette);
    color *= 1.0 - smoothstep(0.72, 1.0, vUv.y) * 0.06;

    // Fine animated grain, concentrated in the mids. No heavy CRT styling.
    float noise = rand(gl_FragCoord.xy + floor(time * 24.0) * vec2(13.0, 7.0)) - 0.5;
    color += noise * grain * (0.042 + (1.0 - luma) * 0.017);
    float scan = sin(gl_FragCoord.y * 1.3) * 0.0016;
    color += scan;

    // Very slight horizontal jitter on the silhouette during danger.
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(linearToSRGB(color), 1.0);
  }
`;

export class RenderPipeline {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.dynamicScale = 1.0;
    this.minDynamic = 0.72;
    this.maxDynamic = 1.0;
    this.lastResize = [0, 0];
    this.avgFps = 60;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.perfScaleCooldown = 0;
    this.useAdaptive = true;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x030504, 1);

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1280, 720) },
        time: { value: 0 },
        grain: { value: 0.055 },
        danger: { value: 0 },
        exposure: { value: 1.0 },
        aberration: { value: 1.0 }
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    quad.frustumCulled = false;
    this.postScene.add(quad);

    this.rt = null;
    this._createRenderTarget();
    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  _createRenderTarget() {
    if (this.rt) this.rt.dispose();
    const q = this.settings.quality;
    this.rt = new THREE.WebGLRenderTarget(1280, 720, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: q.msaaSamples || 0
    });
    this.rt.texture.colorSpace = THREE.NoColorSpace;
    this.rt.texture.generateMipmaps = false;
    this._resizeRenderTarget();
  }

  applyQuality(rebuild = true) {
    const q = this.settings.quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.maxPixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.dynamicScale = q.renderScale;
    this.minDynamic = this.settings.qualityName === 'low' ? 0.62 : this.settings.qualityName === 'medium' ? 0.7 : 0.78;
    if (rebuild) this._createRenderTarget();
    this.resize();
    this.resize(); // Some browsers report drawing buffer one frame late.
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    if (width === this.lastResize[0] && height === this.lastResize[1]) {
      this._resizeRenderTarget();
      return;
    }
    this.lastResize = [width, height];
    this.renderer.setSize(width, height, false);
    this._resizeRenderTarget();
  }

  _resizeRenderTarget() {
    if (!this.rt) return;
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const q = this.settings.quality;
    const scale = Math.max(0.5, this.dynamicScale);
    const w = Math.max(2, Math.floor(size.x * scale));
    const h = Math.max(2, Math.floor(size.y * scale));
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.setSize(w, h);
      this.postMaterial.uniforms.resolution.value.set(w, h);
    }
    this.postMaterial.uniforms.grain.value = this.settings.values.grain * 0.062;
  }

  setQualityChanged() {
    this.dynamicScale = this.settings.quality.renderScale;
    this._createRenderTarget();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.quality.maxPixelRatio));
    this.resize();
  }

  render(scene, camera, elapsed, effects = {}) {
    const q = this.settings.quality;
    const danger = effects.danger || 0;
    this.postMaterial.uniforms.time.value = elapsed;
    this.postMaterial.uniforms.danger.value = danger;
    this.postMaterial.uniforms.grain.value = this.settings.values.grain * 0.062;
    this.postMaterial.uniforms.aberration.value = this.settings.values.reducedMotion ? 0.25 : 1.0;
    this.postMaterial.uniforms.exposure.value = effects.exposure ?? 0.96;

    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    // Three resets renderer.info for every render() call, so the fullscreen
    // post pass would otherwise report 1 call / 2 triangles for the whole game.
    this.sceneInfo = {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles
    };

    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.postMaterial.uniforms.tDiffuse.value = this.rt.texture;
    this.renderer.render(this.postScene, this.postCamera);
  }

  updatePerformance(dt) {
    if (dt <= 0) return;
    this.sampleTime += dt;
    this.sampleFrames++;
    this.perfScaleCooldown = Math.max(0, this.perfScaleCooldown - dt);
    if (this.sampleTime >= 1.25) {
      const fps = this.sampleFrames / this.sampleTime;
      this.avgFps = this.avgFps * 0.6 + fps * 0.4;
      this.sampleTime = 0;
      this.sampleFrames = 0;
      if (!this.useAdaptive || this.perfScaleCooldown > 0) return;
      if (this.avgFps < 52 && this.dynamicScale > this.minDynamic) {
        const next = Math.max(this.minDynamic, this.dynamicScale - 0.08);
        if (Math.abs(next - this.dynamicScale) > 0.01) {
          this.dynamicScale = next;
          this.perfScaleCooldown = 2.2;
          this._resizeRenderTarget();
        }
      } else if (this.avgFps > 58 && this.dynamicScale < this.settings.quality.renderScale) {
        const next = Math.min(this.settings.quality.renderScale, this.dynamicScale + 0.04);
        if (Math.abs(next - this.dynamicScale) > 0.01) {
          this.dynamicScale = next;
          this.perfScaleCooldown = 4.0;
          this._resizeRenderTarget();
        }
      }
    }
  }

  getInfo() {
    const sceneInfo = this.sceneInfo || { calls: 0, triangles: 0 };
    return {
      fps: this.avgFps,
      calls: sceneInfo.calls,
      triangles: sceneInfo.triangles,
      dynamicScale: this.dynamicScale,
      rtWidth: this.rt.width,
      rtHeight: this.rt.height
    };
  }

  dispose() {
    if (this.rt) this.rt.dispose();
    this.postMaterial.dispose();
    this.renderer.dispose();
  }
}
