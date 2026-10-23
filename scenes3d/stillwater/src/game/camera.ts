import * as THREE from 'three';
import { COLONNADE, HALL, WATER_Y } from '../scene/constants';

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/* ------------------------------------------------------------------ cinematic */

const POSITIONS: Vec3Like[] = [
  [0.45, 1.55, 17.4],
  [-0.25, 1.18, 11.9],
  [-2.7, 0.98, 7.0],
  [-5.25, 1.05, 0.7],
  [-5.0, 1.35, -5.6],
  [-2.5, 1.72, -10.3],
  [2.1, 2.15, -13.9],
  [5.1, 2.9, -18.8],
  [4.4, 4.0, -24.8],
  [0.8, 5.1, -27.2],
  [-3.9, 4.1, -24.1],
  [-4.9, 2.3, -14.1],
  [-2.2, 1.62, -6.5],
  [0.7, 1.42, 2.2],
  [0.25, 1.45, 8.6],
];

type Vec3Like = [number, number, number];

const TARGETS: Vec3Like[] = [
  [0.0, 2.0, -10.0],
  [0.8, 2.05, -6.2],
  [1.15, 2.35, -5.4],
  [1.15, 2.6, -5.4],
  [1.15, 2.45, -5.7],
  [0.0, 3.3, -14.0],
  [0.0, 3.9, -22.0],
  [0.0, 4.8, -29.0],
  [-1.0, 5.0, -32.0],
  [0.0, 4.2, -20.0],
  [1.0, 2.8, -6.0],
  [1.15, 2.35, -5.4],
  [1.15, 2.2, -5.4],
  [0.2, 2.6, -15.0],
  [0.7, 2.2, -8.0],
];

export class CinematicCamera {
  duration = 35.5;
  private posCurve: THREE.CatmullRomCurve3;
  private targetCurve: THREE.CatmullRomCurve3;
  private shakePhase = 0;

  constructor() {
    this.posCurve = new THREE.CatmullRomCurve3(
      POSITIONS.map((p) => new THREE.Vector3(...p)), false, 'centripetal',
    );
    this.targetCurve = new THREE.CatmullRomCurve3(
      TARGETS.map((p) => new THREE.Vector3(...p)), false, 'centripetal',
    );
  }

  sample(progress: number, camera: THREE.PerspectiveCamera, dt: number) {
    const t = easeInOutCubic(THREE.MathUtils.clamp(progress, 0, 1));
    const p = this.posCurve.getPointAt(t);
    const target = this.targetCurve.getPointAt(t);
    this.shakePhase += dt;
    const hand = 0.0032;
    p.x += Math.sin(this.shakePhase * 0.63) * hand + Math.sin(this.shakePhase * 1.37) * hand * 0.35;
    p.y += Math.sin(this.shakePhase * 0.81 + 1.7) * hand * 0.8 + Math.sin(this.shakePhase * 1.71) * hand * 0.2;
    p.z += Math.cos(this.shakePhase * 0.58) * hand * 0.7;

    camera.position.copy(p);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.fov = 43 + Math.sin(t * Math.PI) * 3.2;
    camera.updateProjectionMatrix();
  }

  applyEndState(camera: THREE.PerspectiveCamera) {
    const p = this.posCurve.getPointAt(1);
    const target = this.targetCurve.getPointAt(1);
    camera.position.copy(p);
    camera.lookAt(target);
    camera.fov = 45;
    camera.updateProjectionMatrix();
  }
}

/* ------------------------------------------------------------------ drift */

const COLUMN_Z = (() => {
  const count = Math.round((COLONNADE.zEnd - COLONNADE.zStart) / COLONNADE.spacing);
  const zs: number[] = [];
  for (let i = 0; i <= count; i++) zs.push(COLONNADE.zStart + i * COLONNADE.spacing);
  return zs;
})();

export interface DriftState {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  velocity: THREE.Vector3;
}

export class DriftController {
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  enabled = false;
  photo = false;
  locked = false;
  state: DriftState;
  private keys = new Set<string>();
  private targetFov = 48;
  private bob = 0;
  private sway = 0;
  private pointerDown = false;
  private lastPointer = { x: 0, y: 0 };
  onLockChange?: (locked: boolean) => void;
  onToast?: (message: string) => void;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    this.state = {
      position: new THREE.Vector3(0.2, 1.48, 8.4),
      yaw: 0.01,
      pitch: -0.06,
      velocity: new THREE.Vector3(),
    };
    this.bind();
  }

  private bind() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      document.body.classList.toggle('locked', this.locked);
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (this.photo) return;
      if (this.locked || this.pointerDown) {
        const dx = this.locked ? e.movementX : e.clientX - this.lastPointer.x;
        const dy = this.locked ? e.movementY : e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.look(dx, dy);
      }
    });
    this.dom.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.enabled || this.photo) return;
      if (!this.locked) {
        this.pointerDown = true;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.dom.requestPointerLock();
      }
    });
    document.addEventListener('mouseup', () => { this.pointerDown = false; });
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape') this.keys.clear();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  look(dx: number, dy: number) {
    const sensitivity = 0.00185;
    this.state.yaw -= dx * sensitivity;
    this.state.pitch = THREE.MathUtils.clamp(this.state.pitch - dy * sensitivity, -1.16, 1.02);
  }

  setPose(position: THREE.Vector3, target: THREE.Vector3, fov = 45) {
    this.state.position.copy(position);
    this.state.velocity.set(0, 0, 0);
    const dir = target.clone().sub(position).normalize();
    this.state.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    this.state.yaw = Math.atan2(-dir.x, -dir.z);
    this.targetFov = fov;
  }

  setPhoto(on: boolean) {
    this.photo = on;
    if (on && this.locked) document.exitPointerLock();
    this.camera.fov = on ? 45 : this.targetFov;
    if (on) document.body.classList.add('photo');
    else document.body.classList.remove('photo');
  }

  setFov(fov: number) {
    this.targetFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  update(dt: number) {
    const camera = this.camera;
    const fovTarget = this.photo ? camera.fov : 48;
    if (!this.photo) {
      const fov = THREE.MathUtils.damp(camera.fov, this.targetFov, 2.2, dt);
      if (Math.abs(fov - camera.fov) > 0.001) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }

    if (!this.enabled || this.photo) {
      this.applyCamera();
      return;
    }

    const forward = new THREE.Vector3(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
    const right = new THREE.Vector3(Math.cos(this.state.yaw), 0, -Math.sin(this.state.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) wish.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) wish.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) wish.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();

    const slow = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = slow ? 5.2 : 2.25;
    const targetVel = wish.multiplyScalar(speed);
    const accel = wish.lengthSq() > 0 ? 5.0 : 2.4;
    this.state.velocity.x = THREE.MathUtils.damp(this.state.velocity.x, targetVel.x, accel, dt);
    this.state.velocity.z = THREE.MathUtils.damp(this.state.velocity.z, targetVel.z, accel, dt);

    const pos = this.state.position;
    pos.addScaledVector(this.state.velocity, dt);

    // Walk gently around the massive columns.
    for (const side of [-1, 1]) {
      for (const z of COLUMN_Z) {
        const dx = pos.x - side * COLONNADE.x;
        const dz = pos.z - z;
        const dist = Math.hypot(dx, dz);
        const radius = 0.72;
        if (dist < radius && dist > 0.0001) {
          pos.x += (dx / dist) * (radius - dist);
          pos.z += (dz / dist) * (radius - dist);
        }
      }
    }

    pos.x = THREE.MathUtils.clamp(pos.x, HALL.xMin + 0.55, HALL.xMax - 0.55);
    pos.z = THREE.MathUtils.clamp(pos.z, HALL.zMin + 0.9, HALL.zMax - 0.7);
    pos.y = 1.48;

    const moving = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    this.sway += dt * (0.7 + moving * 0.5);
    this.bob += dt * (2.8 + moving * 1.6);
    const bobAmount = Math.min(moving / 3.5, 1) * 0.017;
    pos.y += Math.sin(this.bob) * bobAmount;
    this.applyCamera();
    camera.position.x += Math.sin(this.sway * 0.83) * 0.0025;
    camera.position.y += Math.cos(this.sway * 1.13) * 0.0018;
  }

  private applyCamera() {
    const camera = this.camera;
    camera.position.copy(this.state.position);
    const dir = new THREE.Vector3(
      -Math.sin(this.state.yaw) * Math.cos(this.state.pitch),
      Math.sin(this.state.pitch),
      -Math.cos(this.state.yaw) * Math.cos(this.state.pitch),
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(this.state.position.clone().add(dir));
  }
}
