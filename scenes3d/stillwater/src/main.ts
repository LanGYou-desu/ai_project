import * as THREE from 'three';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/ibm-plex-mono/300.css';
import '@fontsource/ibm-plex-mono/400.css';
import './style.css';

import { buildWorld } from './scene/world';
import { loadBakeVolumes } from './render/bake-data';
import { applyWorldMaterials, createMaterialLibrary, type MaterialLibrary } from './render/materials';
import { captureEnvironment } from './render/environment';
import { PostPipeline } from './render/post';
import { CinematicCamera, DriftController } from './game/camera';
import { WaterAudio } from './game/audio';

type Vec3 = [number, number, number];

interface AppOptions {
  shot: boolean;
  cam: Vec3 | null;
  look: Vec3 | null;
  fov: number;
  frozenTime: number | null;
}

function readOptions(): AppOptions {
  const p = new URLSearchParams(window.location.search);
  const vec = (key: string): Vec3 | null => {
    const raw = p.get(key);
    if (!raw) return null;
    const nums = raw.split(',').map(Number);
    return nums.length === 3 && nums.every(Number.isFinite) ? nums as Vec3 : null;
  };
  const time = Number(p.get('time'));
  return {
    shot: p.get('shot') === '1',
    cam: vec('cam'),
    look: vec('look'),
    fov: Number.isFinite(Number(p.get('fov'))) ? Number(p.get('fov')) : 46,
    frozenTime: Number.isFinite(time) && p.has('time') ? time : null,
  };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class Stillwater {
  opts = readOptions();
  canvas = $<HTMLCanvasElement>('scene');
  camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.06, 120);
  post!: PostPipeline;
  materials!: MaterialLibrary;
  world = buildWorld();
  encoder = new CinematicCamera();
  drift!: DriftController;
  audio = new WaterAudio();

  mode: 'title' | 'cinematic' | 'drift' | 'photo' = 'title';
  startTime = performance.now();
  timer = new THREE.Timer();
  elapsed = 0;
  cinematicStart = 0;
  cinematicOverlayPhase = 0;
  freezeAt: number | null = null;
  introPlaying = false;
  ready = false;
  toastTimer = 0;
  frameHandle = 0;
  uiVisible = true;

  async init() {
    const loading = $('loading');
    loading.classList.add('visible');
    const bar = document.querySelector<HTMLElement>('.load-bar i');
    const pct = $('load-pct');
    const status = $('load-status');
    let progress = 0;
    const setProgress = (p: number, label?: string) => {
      progress = Math.max(progress, Math.min(1, p));
      if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
      if (pct) pct.textContent = `${Math.round(progress * 100)}%`;
      if (label && status) status.textContent = label;
    };

    setProgress(0.03, 'RAISING THE CEILING');
    await delay(120);

    // Bake volumes are optional so the scene still opens while the light is being baked.
    const bake = await loadBakeVolumes((p, label) => setProgress(0.08 + p * 0.56, label));
    setProgress(0.7, 'FILLING THE BASIN');
    await delay(100);

    this.materials = createMaterialLibrary({ gi: bake.gi, renderer: undefined });
    applyWorldMaterials(this.world.group, this.materials);

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    setProgress(0.8, 'POLISHING THE TILES');
    this.post = new PostPipeline({
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      world: this.world.group,
      materials: this.materials,
      camera: this.camera,
      foamCenters: this.world.foamCenters,
    });
    this.post.setFog(bake.fog);

    setProgress(0.9, 'CATCHING THE LIGHT');
    await delay(80);
    const env = captureEnvironment(this.post.renderer, this.world.group, this.materials, new THREE.Vector3(0, 4.1, -3.0), 128);
    this.materials.setEnvironment(env);

    this.drift = new DriftController(this.camera, this.canvas);
    this.drift.onToast = (m) => this.toast(m);
    this.drift.onLockChange = (locked) => {
      if (this.mode === 'drift') $('hud-mode').textContent = locked ? 'DRIFT' : 'CLICK TO LOOK';
    };

    this.bindUI();
    this.bootCamera();

    if (this.opts.shot) {
      document.getElementById('ui')!.style.display = 'none';
      document.body.classList.add('shot');
      this.post.fade = 1;
      this.encoder.applyEndState(this.camera);
      this.applyDebugCamera();
      const debug = new URLSearchParams(window.location.search).get('debug');
      if (debug) this.post.debugView = debug as 'reflection' | 'scene' | 'water' | 'atmo' | 'mask';
    } else {
      this.post.fade = 1;
    }

    setProgress(1, 'READY');
    await delay(420);
    loading.classList.remove('visible');
    loading.style.display = 'none';

    if (!this.opts.shot) {
      $('title-screen').classList.add('visible');
    }

    this.ready = true;
    window.dispatchEvent(new CustomEvent('stillwater-ready'));
    (window as unknown as { __stillwater: unknown }).__stillwater = this;
    this.timer.connect(document);
    this.timer.update();
    this.loop();
  }

  private bootCamera() {
    this.camera.position.set(0.5, 1.5, 14.2);
    this.camera.lookAt(new THREE.Vector3(0.2, 2.0, -9.0));
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
  }

  private applyDebugCamera() {
    if (!this.opts.cam) return;
    const pos = new THREE.Vector3(...this.opts.cam);
    const look = new THREE.Vector3(...(this.opts.look ?? [0, 2, -8]));
    this.camera.position.copy(pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(look);
    this.camera.fov = this.opts.fov;
    this.camera.updateProjectionMatrix();
  }

  private bindUI() {
    $('enter-btn').addEventListener('click', () => this.beginFilm());
    $('skip-btn').addEventListener('click', () => this.endFilm());
    $('explore-btn').addEventListener('click', () => this.beginDrift());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.resize(w, h, window.devicePixelRatio);
  }

  beginFilm() {
    if (this.mode !== 'title') return;
    this.audio.start();
    $('title-screen').classList.remove('visible');
    setTimeout(() => { $('title-screen').style.display = 'none'; }, 1200);
    document.body.classList.add('cinema');
    $('cinematic').classList.add('visible');
    $('hud').classList.remove('visible');
    this.mode = 'cinematic';
    this.introPlaying = true;
    this.cinematicStart = this.elapsed;
    this.cinematicOverlayPhase = 0;
    this.drift.enabled = false;
    setTimeout(() => $('cine-title').classList.add('show'), 2400);
    setTimeout(() => $('cine-title').classList.remove('show'), 9200);
    this.toast('ESC TO SKIP THE FILM');
  }

  endFilm() {
    if (this.mode !== 'cinematic') return;
    this.introPlaying = false;
    this.encoder.applyEndState(this.camera);
    $('cinematic').classList.remove('visible');
    document.body.classList.remove('cinema');
    $('cine-end')?.classList.remove('show');
    $('hud').classList.add('visible');
    this.showEndCard();
  }

  private showEndCard() {
    $('end-card').classList.add('visible');
    this.mode = 'drift';
    this.drift.enabled = false;
  }

  beginDrift() {
    $('end-card').classList.remove('visible');
    $('cinematic').classList.remove('visible');
    document.body.classList.remove('cinema');
    $('hud').classList.add('visible');
    this.mode = 'drift';
    this.drift.enabled = true;
    this.drift.setPose(this.camera.position.clone(), this.camera.position.clone().add(
      new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion),
    ), 48);
    this.toast('CLICK TO LOOK · WASD TO DRIFT');
  }

  private onKey(e: KeyboardEvent) {
    if (this.mode === 'cinematic' && (e.code === 'Escape' || e.code === 'Space')) {
      e.preventDefault();
      this.endFilm();
      return;
    }
    if (e.code === 'KeyR' && this.mode !== 'title' && this.mode !== 'cinematic') {
      this.replayFilm();
      return;
    }
    if (e.code === 'KeyM') {
      const muted = this.audio.toggle();
      this.toast(muted ? 'SOUND OFF' : 'SOUND ON');
      return;
    }
    if (e.code === 'KeyP' && (this.mode === 'drift' || this.mode === 'photo')) {
      this.togglePhoto();
      return;
    }
    if (this.mode === 'photo') {
      if (e.code === 'ArrowUp') {
        this.post.exposure = Math.min(3, this.post.exposure + 0.08);
        $('photo-exp').textContent = (this.post.exposure - 0.95).toFixed(1);
      } else if (e.code === 'ArrowDown') {
        this.post.exposure = Math.max(0.2, this.post.exposure - 0.08);
        $('photo-exp').textContent = (this.post.exposure - 0.95).toFixed(1);
      } else if (e.code === 'BracketLeft') {
        this.adjustLens(-5);
      } else if (e.code === 'BracketRight') {
        this.adjustLens(5);
      } else if (e.code === 'KeyS') {
        this.saveFrame();
      }
    }
  }

  replayFilm() {
    if (this.mode === 'photo') this.togglePhoto(false);
    this.introPlaying = true;
    this.mode = 'cinematic';
    this.drift.enabled = false;
    this.encoder = new CinematicCamera();
    this.cinematicStart = this.elapsed;
    this.cinematicOverlayPhase = 0;
    $('end-card').classList.remove('visible');
    $('hud').classList.remove('visible');
    $('cinematic').classList.add('visible');
    document.body.classList.add('cinema');
    $('cine-title').classList.add('show');
    setTimeout(() => $('cine-title').classList.remove('show'), 5200);
    this.toast('ESC TO SKIP THE FILM');
  }

  togglePhoto(force?: boolean) {
    const next = force ?? this.mode !== 'photo';
    if (next) {
      this.mode = 'photo';
      this.drift.enabled = false;
      this.drift.setPhoto(true);
      $('photo-ui').classList.add('visible');
      $('hud').classList.remove('visible');
      document.body.classList.add('photo');
      this.post.chroma = 0.0035;
      this.toast('PHOTO MODE');
    } else {
      this.mode = 'drift';
      this.drift.setPhoto(false);
      this.drift.enabled = true;
      $('photo-ui').classList.remove('visible');
      $('hud').classList.add('visible');
      document.body.classList.remove('photo');
      this.post.chroma = 0.0022;
      this.post.exposure = 0.95;
      this.drift.setFov(48);
      $('photo-exp').textContent = '0.0';
      $('photo-fov').textContent = '45mm';
      $('photo-lens').textContent = '45mm · f/2.8';
    }
  }

  private adjustLens(delta: number) {
    const current = this.camera.fov;
    const next = THREE.MathUtils.clamp(current + delta * 0.5, 22, 60);
    this.drift.setFov(next);
    const mm = Math.round(43.27 / (2 * Math.tan(THREE.MathUtils.degToRad(next) / 2)));
    $('photo-fov').textContent = `${mm}mm`;
    $('photo-lens').textContent = `${mm}mm · f/2.8`;
  }

  private saveFrame() {
    const flash = $('flash');
    flash.classList.remove('fire');
    void flash.offsetWidth;
    flash.classList.add('fire');
    this.toast('FRAME SAVED');
    this.post.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `stillwater-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  }

  toast(message: string) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
  }

  private loop = () => {
    this.frameHandle = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.elapsed += dt;

    if (!this.ready) return;

    if (this.opts.shot) {
      // The screenshot harness owns the camera.
    } else if (this.mode === 'title') {
      const t = Math.min(this.elapsed * 0.018, 0.55);
      this.camera.position.set(0.5 + Math.sin(t * 1.3) * 0.09, 1.49 + Math.sin(t * 2.1) * 0.015, 14.2 - t * 1.8);
      this.camera.lookAt(new THREE.Vector3(0.2 + Math.sin(t) * 0.12, 2.0, -9.0));
      this.camera.fov = 42;
      this.camera.updateProjectionMatrix();
    } else if (this.mode === 'cinematic' && this.introPlaying) {
      const p = (this.elapsed - this.cinematicStart) / this.encoder.duration;
      this.encoder.sample(Math.min(p, 1), this.camera, dt);
      const phase = Math.floor((this.elapsed - this.cinematicStart) / 7.5);
      if (phase !== this.cinematicOverlayPhase) {
        this.cinematicOverlayPhase = phase;
        const chapters = [
          'SCENE 01 / THE LONG POOL',
          'SCENE 02 / THE STILL WATER',
          'SCENE 03 / THE RED TOTEM',
          'SCENE 04 / THE FAR DOORS',
          'SCENE 05 / STILLWATER',
        ];
        $('cine-chapter').textContent = chapters[Math.min(phase, chapters.length - 1)];
      }
      const tm = Math.max(0, this.elapsed - this.cinematicStart);
      const mm = String(Math.floor(tm / 60)).padStart(2, '0');
      const ss = String(Math.floor(tm % 60)).padStart(2, '0');
      const cc = String(Math.floor((tm % 1) * 24)).padStart(2, '0');
      $('cine-time').textContent = `00:${mm}:${ss}:${cc}`;
      if (p >= 1) {
        this.introPlaying = false;
        $('cine-end').classList.add('show');
        setTimeout(() => {
          if (this.mode === 'cinematic') this.endFilm();
        }, 2800);
      }
    } else if (this.mode === 'drift' || this.mode === 'photo') {
      this.drift.update(dt);
    }

    const time = this.opts.frozenTime ?? this.elapsed;
    if (this.opts.shot && this.opts.frozenTime === null) {
      // A stable time keeps stills crisp while preserving ripples.
      this.post.render(7.35);
    } else {
      this.post.render(time);
    }
  };

  setCamera(position: Vec3, target: Vec3, fov = 46) {
    this.camera.position.set(...position);
    this.camera.lookAt(new THREE.Vector3(...target));
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    const ui = document.getElementById('ui')!;
    ui.style.display = 'none';
    this.opts.shot = true;
  }

  renderAt(time: number) {
    this.post.render(time);
  }
}

const app = new Stillwater();
(window as unknown as { __app: Stillwater }).__app = app;
app.init().catch((err) => {
  console.error(err);
  const status = document.getElementById('load-status');
  if (status) status.textContent = 'THE WATER IS COLD — SEE CONSOLE';
});
