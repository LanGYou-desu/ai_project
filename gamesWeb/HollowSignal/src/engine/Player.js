import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function colliderApplies(collider, crouched) {
  if (collider.enabled === false) return false;
  if (collider.playerCollide === false) return false;
  // A low-clearance blocker is solid while standing and ignored while crouched.
  if (collider.requiresCrouch) return !crouched;
  return true;
}

export function circleIntersectsAABB(x, z, radius, minX, maxX, minZ, maxZ) {
  const nx = Math.max(minX, Math.min(x, maxX));
  const nz = Math.max(minZ, Math.min(z, maxZ));
  const dx = x - nx;
  const dz = z - nz;
  return dx * dx + dz * dz < radius * radius;
}

export function resolveAxisMovement(position, dx, dz, radius, colliders, crouched, bounds = null) {
  // X axis first.
  if (dx !== 0) {
    const oldX = position.x;
    position.x += dx;
    for (const collider of colliders) {
      if (!colliderApplies(collider, crouched)) continue;
      if (position.z < collider.minZ - radius || position.z > collider.maxZ + radius) continue;
      if (dx > 0 && oldX <= collider.minX - radius + 0.0001 && position.x > collider.minX - radius) {
        position.x = collider.minX - radius;
      } else if (dx < 0 && oldX >= collider.maxX + radius - 0.0001 && position.x < collider.maxX + radius) {
        position.x = collider.maxX + radius;
      } else if (position.x > collider.minX - radius && position.x < collider.maxX + radius &&
                 position.z > collider.minZ && position.z < collider.maxZ) {
        // Already inside: choose the nearest exit along X.
        const left = Math.abs(position.x - (collider.minX - radius));
        const right = Math.abs((collider.maxX + radius) - position.x);
        position.x += left < right ? -left : right;
      }
    }
  }
  // Z axis.
  if (dz !== 0) {
    const oldZ = position.z;
    position.z += dz;
    for (const collider of colliders) {
      if (!colliderApplies(collider, crouched)) continue;
      if (position.x < collider.minX - radius || position.x > collider.maxX + radius) continue;
      if (dz > 0 && oldZ <= collider.minZ - radius + 0.0001 && position.z > collider.minZ - radius) {
        position.z = collider.minZ - radius;
      } else if (dz < 0 && oldZ >= collider.maxZ + radius - 0.0001 && position.z < collider.maxZ + radius) {
        position.z = collider.maxZ + radius;
      } else if (position.z > collider.minZ - radius && position.z < collider.maxZ + radius &&
                 position.x > collider.minX && position.x < collider.maxX) {
        const near = Math.abs(position.z - (collider.minZ - radius));
        const far = Math.abs((collider.maxZ + radius) - position.z);
        position.z += near < far ? -near : far;
      }
    }
  }
  // Final safety: get out of any overlapping boxes.
  for (const collider of colliders) {
    if (!colliderApplies(collider, crouched)) continue;
    if (!circleIntersectsAABB(position.x, position.z, radius, collider.minX, collider.maxX, collider.minZ, collider.maxZ)) continue;
    const dxL = Math.abs(position.x - (collider.minX - radius));
    const dxR = Math.abs((collider.maxX + radius) - position.x);
    const dzL = Math.abs(position.z - (collider.minZ - radius));
    const dzR = Math.abs((collider.maxZ + radius) - position.z);
    const min = Math.min(dxL, dxR, dzL, dzR);
    if (min === dxL) position.x = collider.minX - radius;
    else if (min === dxR) position.x = collider.maxX + radius;
    else if (min === dzL) position.z = collider.minZ - radius;
    else position.z = collider.maxZ + radius;
  }
  if (bounds) {
    position.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, position.x));
    position.z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, position.z));
  }
}

export class Player {
  constructor(game, camera) {
    this.game = game;
    this.camera = camera;
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector2(0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.3;
    this.eyeHeight = 1.68;
    this.crouchHeight = 1.08;
    this.currentEyeHeight = this.eyeHeight;
    this.crouched = false;
    this.sprinting = false;
    this.stamina = 1;
    this.staminaDrain = 5.8;
    this.staminaLocked = false;
    this.enabled = true;
    this.hidden = false;
    this.moveSpeed = 2.15;
    this.sprintSpeed = 4.45;
    this.crouchSpeed = 1.1;
    this.acceleration = 12;
    this.stepDistance = 0;
    this.bobTime = 0;
    this.bobOffset = 0;
    this.bobRoll = 0;
    this.fovBase = 72;
    this.fovOffset = 0;
    this.shake = 0;
    this.shakeDecay = 2.2;
    this.noiseLevel = 0;
    this.effectiveSpeed = 0;
    this.surface = 'concrete';
    this.lastPosition = this.position.clone();
    this.onFootstep = null;
    this.onExhale = null;
    this.staminaWarningPlayed = false;
    this._stepSide = 1;
    this.flashlightOn = true;
    this.flashlightFlicker = 1;
    this._flashlightFlickerTimer = 2.6;
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._tempQuat = new THREE.Quaternion();
    this._bobRollTarget = 0;
    this._crouchBlockedNotice = 0;
    this._setupCamera();
    this._setupFlashlight();
  }

  _setupCamera() {
    const camera = this.camera;
    camera.rotation.order = 'YXZ';
    camera.near = 0.04;
    camera.far = 110;
    camera.fov = this.fovBase;
    camera.updateProjectionMatrix();
  }

  _setupFlashlight() {
    const body = new THREE.Group();
    body.name = 'held-flashlight';
    // The view model is unlit so the camera-mounted spotlight cannot blow it
    // out. A cheap per-vertex shade pass keeps the barrel from reading as a
    // flat silhouette against the dark.
    const shade = (geometry, hex) => {
      const color = new THREE.Color(hex);
      const normals = geometry.attributes.normal;
      const colors = new Float32Array(normals.count * 3);
      const n = new THREE.Vector3();
      const light = new THREE.Vector3(-.45, .8, .5).normalize();
      for (let i = 0; i < normals.count; i++) {
        n.fromBufferAttribute(normals, i);
        const lum = .55 + Math.max(0, n.dot(light)) * .55;
        colors[i * 3] = color.r * lum;
        colors[i * 3 + 1] = color.g * lum;
        colors[i * 3 + 2] = color.b * lum;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return new THREE.MeshBasicMaterial({ vertexColors: true });
    };
    const dark = (geo) => new THREE.Mesh(geo, shade(geo, 0x2f362d));
    const steel = (geo) => new THREE.Mesh(geo, shade(geo, 0x6c7566));
    const rubber = (geo) => new THREE.Mesh(geo, shade(geo, 0x161b15));
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xd8c08b });

    // Barrel runs along local -Z. Everything is modelled around that axis.
    const tube = dark(new THREE.CylinderGeometry(.038, .046, .3, 16));
    tube.rotation.x = Math.PI / 2;
    tube.position.z = .0;
    const tail = steel(new THREE.CylinderGeometry(.045, .041, .045, 16));
    tail.rotation.x = Math.PI / 2;
    tail.position.z = .155;
    const tailCap = rubber(new THREE.CircleGeometry(.038, 16));
    tailCap.rotation.y = Math.PI;
    tailCap.position.z = .177;
    const head = dark(new THREE.CylinderGeometry(.064, .045, .13, 18));
    head.rotation.x = Math.PI / 2;
    head.position.z = -.215;
    const rim = steel(new THREE.TorusGeometry(.061, .0075, 7, 24));
    rim.position.z = -.282;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.057, 24), lensMat);
    lens.rotation.y = Math.PI;
    lens.position.z = -.283;
    const switchMesh = steel(new THREE.BoxGeometry(.03, .018, .06));
    switchMesh.position.set(0, .048, -.06);
    const lanyard = rubber(new THREE.TorusGeometry(.023, .005, 5, 14));
    lanyard.position.set(0, .02, .178);
    lanyard.rotation.x = Math.PI / 2;

    // Knurled rings and a gloved grip. The glove is mostly silhouette, but it
    // anchors the torch in a hand and hides the otherwise floating tail cap.
    const rings = [];
    for (const z of [.055, .085, .115]) {
      const ring = steel(new THREE.TorusGeometry(.043, .0045, 5, 18));
      ring.position.z = z;
      rings.push(ring);
    }
    const palmGeo = new THREE.BoxGeometry(.08, .034, .105);
    const palm = new THREE.Mesh(palmGeo, shade(palmGeo, 0x20231d));
    palm.position.set(.035, -.038, .075);
    palm.rotation.z = -.18;
    const fingers = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(.038, .028, .032);
      const finger = new THREE.Mesh(geo, shade(geo, 0x282c24));
      finger.position.set(.052, -.006, .028 + i * .034);
      finger.rotation.z = -.5;
      fingers.push(finger);
    }
    const thumbGeo = new THREE.BoxGeometry(.027, .024, .052);
    const thumb = new THREE.Mesh(thumbGeo, shade(thumbGeo, 0x1b1e19));
    thumb.position.set(-.028, -.028, .095);
    thumb.rotation.set(.15, .25, .45);
    const cuffGeo = new THREE.CylinderGeometry(.055, .061, .09, 12);
    const cuff = new THREE.Mesh(cuffGeo, shade(cuffGeo, 0x151814));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = .17;

    body.add(tube, tail, tailCap, head, rim, lens, switchMesh, lanyard, palm, thumb, cuff, ...rings, ...fingers);
    body.position.set(.3, -.315, -.58);
    body.rotation.set(.1, .5, -.075);
    body.scale.setScalar(.62);
    body.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    body.layers.set(0);
    this.flashlightModel = body;
    this.camera.add(body);

    const spot = new THREE.SpotLight(0xffd6a3, 92, 23, .54, .68, 1.25);
    spot.position.set(.16, -.13, -.3);
    spot.target.position.set(.01, -.01, -8);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = .18;
    spot.shadow.camera.far = 22;
    spot.shadow.bias = -.0007;
    spot.shadow.normalBias = .025;
    spot.shadow.radius = 2;
    this.flashlight = spot;
    this.flashlightTarget = spot.target;
    this.camera.add(spot, spot.target);
    } 
  setQuality(quality) {
    if (!this.flashlight) return;
    this.flashlight.castShadow = !!quality.shadows;
    this.flashlight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    if (this.flashlight.shadow.map) {
      this.flashlight.shadow.map.dispose();
      this.flashlight.shadow.map = null;
    }
  }

  setFov(value) {
    this.fovBase = value;
    if (!this.sprinting) this.camera.fov = value;
    this.camera.updateProjectionMatrix();
  }

  setPosition(x, z, yaw = this.yaw, pitch = 0, crouched = false) {
    this.position.set(x, 0, z);
    this.lastPosition.copy(this.position);
    this.yaw = yaw;
    this.pitch = pitch;
    this.crouched = crouched;
    this.currentEyeHeight = crouched ? this.crouchHeight : this.eyeHeight;
    this.velocity.set(0, 0);
    this.stamina = 1;
    this.staminaLocked = false;
    this.stepDistance = 0;
    this._updateCamera(0, 0);
  }

  setCrouched(value, force = false) {
    if (value === this.crouched) return;
    if (!value && !force && this.game.level?.isLowCeiling?.(this.position.x, this.position.z)) {
      this.game.ui.showHint('头顶没有足够空间站起来。', 2.4);
      return;
    }
    this.crouched = value;
    if (this.crouched) this.sprinting = false;
    this.game.ui.showToast(this.crouched ? '蹲伏——脚步更轻' : '站立');
  }

  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.visible = this.flashlightOn;
    this.flashlightModel.visible = this.flashlightOn;
    this.game.ui.setFlashlightState(this.flashlightOn);
    this.game.audio.play('switch', { volume: .18 });
    this.game.audio.play('click', { volume: .07, rate: 1.6 });
  }

  setVisibleHeld(visible) {
    this.flashlightModel.visible = visible && this.flashlightOn;
    this.flashlight.visible = visible && this.flashlightOn;
  }

  setFlashlight(on) {
    this.flashlightOn = !!on;
    this.flashlight.visible = this.flashlightOn;
    this.flashlightModel.visible = this.flashlightOn;
    this.game.ui?.setFlashlightState?.(this.flashlightOn);
  }

  toggleHidden() {
    // Implemented by Game because it involves lockers and door state.
  }

  addShake(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt, input, level) {
    const settings = this.game.settings.values;
    const mouse = input.consumeMouse();
    const sensitivity = settings.sensitivity * 0.0021;
    this.yaw -= mouse.x * sensitivity;
    this.pitch -= mouse.y * sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

    if (!this.enabled || this.hidden) {
      this.velocity.set(0, 0);
      this.effectiveSpeed = 0;
      this._updateCamera(dt, 0);
      return;
    }

    if (input.wasPressed('KeyC')) this.setCrouched(!this.crouched);
    if (input.wasPressed('KeyF')) this.toggleFlashlight();

    let ix = 0;
    let iz = 0;
    if (input.isDown('KeyW')) iz -= 1;
    if (input.isDown('KeyS')) iz += 1;
    if (input.isDown('KeyA')) ix -= 1;
    if (input.isDown('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }
    const wantsSprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const canSprint = !this.crouched && this.stamina > 0.03 && !this.staminaLocked && len > 0;
    this.sprinting = wantsSprint && canSprint;

    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt / this.staminaDrain);
      if (this.stamina <= 0) {
        this.staminaLocked = true;
        this.sprinting = false;
      }
    } else {
      const regen = this.crouched ? 0.13 : 0.1;
      this.stamina = Math.min(1, this.stamina + dt * regen);
      if (this.stamina > 0.24) this.staminaLocked = false;
    }
    if (this.stamina < 0.25) {
      if (!this.staminaWarningPlayed) {
        this.staminaWarningPlayed = true;
        this.game.audio.play('breath', { volume: .2 });
        this.game.ui.showHint('你的肺在燃烧。慢下来。', 2.7);
      }
    } else if (this.stamina > .55) {
      this.staminaWarningPlayed = false;
    }

    const targetSpeed = this.sprinting ? this.sprintSpeed : this.crouched ? this.crouchSpeed : this.moveSpeed;
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._wish.set(0, 0, 0);
    this._wish.addScaledVector(this._forward, -iz);
    this._wish.addScaledVector(this._right, ix);
    if (this._wish.lengthSq() > 0) this._wish.normalize();
    const accel = (this.sprinting ? 9.5 : this.crouched ? 6.5 : 8.5) * dt;
    this.velocity.x += (this._wish.x * targetSpeed - this.velocity.x) * Math.min(1, accel);
    this.velocity.y += (this._wish.z * targetSpeed - this.velocity.y) * Math.min(1, accel);
    if (len === 0) {
      const damping = Math.exp(-dt * 9);
      this.velocity.multiplyScalar(damping);
    }

    const moveDx = this.velocity.x * dt;
    const moveDz = this.velocity.y * dt;
    const oldX = this.position.x;
    const oldZ = this.position.z;
    resolveAxisMovement(this.position, moveDx, moveDz, this.radius, level.colliders, this.crouched, level.bounds);
    const actualDist = Math.hypot(this.position.x - oldX, this.position.z - oldZ);
    this.effectiveSpeed = actualDist / Math.max(0.0001, dt);

    // Surface-dependent footsteps and noise signature.
    this.surface = level.getSurface?.(this.position.x, this.position.z) || 'concrete';
    const stride = this.sprinting ? 1.78 : this.crouched ? 1.9 : 1.58;
    this.stepDistance += actualDist;
    if (this.stepDistance >= stride && this.effectiveSpeed > .25) {
      this.stepDistance = 0;
      this._stepSide *= -1;
      const intensity = this.sprinting ? 1 : this.crouched ? .22 : .5;
      this.noiseLevel = this.sprinting ? 1 : this.crouched ? .1 : .42;
      this.game.audio.footstep(this.surface, (this.crouched ? .11 : this.sprinting ? .33 : .2));
      this.addShake(this.sprinting ? .025 : .012);
      this.onFootstep?.({
        position: this.position.clone(),
        noise: this.noiseLevel,
        surface: this.surface,
        sprinting: this.sprinting,
        crouched: this.crouched
      });
      this.game.level?.onPlayerFootstep?.(this);
      if (this.surface === 'water') this.game.audio.playAt('drip', { x: this.position.x, y: .1, z: this.position.z }, { volume: .17, rate: .7 });
    } else if (this.effectiveSpeed < .1) {
      this.noiseLevel += (0 - this.noiseLevel) * Math.min(1, dt * 6);
    }

    this._updateCamera(dt, actualDist);

    // Flashlight subtle organic flicker and sway.
    this._flashlightFlickerTimer -= dt;
    if (this._flashlightFlickerTimer <= 0) {
      this._flashlightFlickerTimer = 1.8 + Math.random() * 6.0;
      if (Math.random() < .18) {
        this.flashlightFlicker = .25;
        setTimeout(() => { this.flashlightFlicker = 1; }, 35 + Math.random() * 90);
      }
    }
    const flicker = this.flashlightFlicker;
    this.flashlight.intensity = (this.sprinting ? 72 : 92) * flicker;
    this.flashlightModel.position.x = .3 + Math.sin(this.bobTime * .5) * .006 * (this.effectiveSpeed * .15);
    this.flashlightModel.rotation.z = -.075 + this._bobRollTarget * .12;
  }

  _updateCamera(dt, distanceMoved) {
    const reduced = this.game?.settings?.values?.reducedMotion;
    const targetEye = this.crouched ? this.crouchHeight : this.eyeHeight;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1, dt * 9);
    const speedFactor = Math.min(1, this.effectiveSpeed / 4.45);
    if (distanceMoved > .0001 && !reduced) {
      this.bobTime += dt * (this.sprinting ? 12.5 : this.crouched ? 7.2 : 9.4) * Math.max(.35, speedFactor);
    } else {
      this.bobTime += dt * 1.5;
    }
    const bobAmplitude = reduced ? .004 : this.sprinting ? .055 : this.crouched ? .017 : .03;
    this.bobOffset = Math.sin(this.bobTime) * bobAmplitude * (this.effectiveSpeed > .2 ? 1 : .18);
    this._bobRollTarget = Math.sin(this.bobTime * .5) * (this.sprinting ? .012 : .004) * (this.effectiveSpeed > .2 ? 1 : .1);
    const breath = reduced ? 0 : Math.sin(performance.now() * .0012) * .004;
    const shakeX = this.shake > 0 ? (Math.random() - .5) * this.shake * .04 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - .5) * this.shake * .04 : 0;
    this.camera.position.set(
      this.position.x + shakeX * .2,
      this.position.y + this.currentEyeHeight + this.bobOffset + breath,
      this.position.z + shakeY * .2
    );
    this.camera.rotation.set(this.pitch + shakeY, this.yaw + shakeX, this._bobRollTarget);
    const targetFov = this.fovBase + (this.sprinting ? 4.2 : 0) + (this.crouched ? -2.0 : 0);
    this.fovOffset += (targetFov - (this.fovBase + this.fovOffset)) * Math.min(1, dt * 5);
    this.camera.fov = this.fovBase + this.fovOffset;
    this.camera.updateProjectionMatrix();
    this.shake = Math.max(0, this.shake - dt * this.shakeDecay);
  }

  getForward(out = this._forward) {
    out.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return out;
  }

  getEyePosition(out = new THREE.Vector3()) {
    return out.copy(this.camera.position);
  }

  applySettings(settings) {
    this.setFov(settings.values.fov);
  }
}
