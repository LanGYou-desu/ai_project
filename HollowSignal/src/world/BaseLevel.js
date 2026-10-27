import * as THREE from 'three';
import { StaticBatch } from '../engine/StaticBatch.js';
import { DustField, DetailOccluder } from '../engine/Pool.js';
import { boxGeometry, planeGeometry, cylinderGeometry } from '../engine/Geometry.js';

const INVISIBLE_HIT_LAYER = 2;

export const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export class BaseLevel {
  constructor(game, meta = {}) {
    this.game = game;
    this.meta = meta;
    this.id = meta.id || 'unknown';
    this.title = meta.title || '';
    this.chapterNumber = meta.number || 1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030504);
    this.scene.environment = null;
    this.staticBatch = new StaticBatch(this.scene, game.materials);
    this.colliders = [];
    this.interactables = [];
    this.triggers = [];
    this.updatables = [];
    this.timers = [];
    this.doors = [];
    this.bakeLights = [];
    this.dynamicLights = [];
    this.flickerLights = [];
    this.soundEmitters = [];
    this.surfacePads = [];
    this.waterPads = [];
    this.lowCeilings = [];
    this.dustVolumes = [];
    this.occludables = [];
    this.storyRecords = [];
    this.spawn = { x: 0, z: 0, yaw: 0, pitch: 0 };
    this.bounds = null;
    this.dust = null;
    this.occluder = new DetailOccluder(this);
    this.invisibleMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.uuid = 0;
    this._interactTimer = 0;
    this._elapsed = 0;
    this._disposed = false;
    this._staticFinalized = false;
    this.ambientTrack = null;
    this._checkpoint = null;
    this._eventHandlers = new Map();

    this.scene.add(new THREE.HemisphereLight(0x617168, 0x111713, 0.3));
  }

  async build() {
    // Implemented by chapters.
  }

  async finalize(onProgress = null) {
    onProgress?.(0.6, 'Baking static illumination');
    await waitFrame();
    if (this.groundless !== true) {
      if (!this.bounds) this.computeBoundsFromColliders();
    }
    this.staticBatch.finalize(this.bakeLights, this.colliders);
    onProgress?.(0.8, 'Seeding acoustic field');
    await waitFrame();
    if (this.dustVolumes.length) {
      this.dust = new DustField(this.scene, this.dustVolumes, this.game.settings.quality, this.game.textures.makeDustSprite());
    }
    for (const entry of this.occludables) {
      this.occluder.register(entry.object, entry.position, entry.options);
    }
    this.scene.environment = this.game.materials.environment;
    this._staticFinalized = true;
    this.applyQuality(this.game.settings.quality);
    onProgress?.(1, 'Archive ready');
    await waitFrame();
  }

  /* ------------------------------------------------------------------ */
  /* Environment                                                         */
  /* ------------------------------------------------------------------ */

  setAtmosphere({ color = 0x040606, fogColor = 0x050807, fogDensity = 0.035, fogNear = 1, fogFar = 45, useExp2 = true } = {}) {
    this.scene.background = new THREE.Color(color);
    this.scene.fog = useExp2
      ? new THREE.FogExp2(fogColor, fogDensity)
      : new THREE.Fog(fogColor, fogNear, fogFar);
  }

  computeBoundsFromColliders() {
    if (!this.colliders.length) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of this.colliders) {
      if (c.playerCollide === false) continue;
      minX = Math.min(minX, c.minX);
      maxX = Math.max(maxX, c.maxX);
      minZ = Math.min(minZ, c.minZ);
      maxZ = Math.max(maxZ, c.maxZ);
    }
    this.bounds = { minX: minX - .5, maxX: maxX + .5, minZ: minZ - .5, maxZ: maxZ + .5 };
  }

  /* ------------------------------------------------------------------ */
  /* Geometry & colliders                                                */
  /* ------------------------------------------------------------------ */

  addCollider(minX, maxX, minY, maxY, minZ, maxZ, options = {}) {
    const collider = {
      minX, maxX, minY, maxY, minZ, maxZ,
      enabled: options.enabled !== false,
      playerCollide: options.playerCollide !== false,
      occluder: options.occluder !== false,
      bakeOccluder: options.bakeOccluder !== false,
      lowClearance: !!options.lowClearance,
      requiresCrouch: !!options.requiresCrouch,
      tag: options.tag || '',
      dynamic: !!options.dynamic,
      threeD: options.threeD !== false
    };
    this.colliders.push(collider);
    return collider;
  }

  addStaticBox(materialKey, w, h, d, x, y, z, options = {}) {
    return this.staticBatch.addBox(materialKey, w, h, d, x, y, z, {
      rotationX: options.rx || 0,
      rotationY: options.ry || 0,
      rotationZ: options.rz || 0,
      scale: options.scale || 2,
      offset: options.offset,
      segments: options.segments || 1
    });
  }

  addStaticCylinder(materialKey, rTop, rBot, height, x, y, z, {
    segments = 14,
    rx = 0, ry = 0, rz = 0,
    collider = false,
    colliderScale = 1
  } = {}) {
    const geo = cylinderGeometry(rTop, rBot, height, { radial: segments, scale: 1.6 });
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    this.staticBatch.addGeometry(geo, materialKey, matrix);
    if (collider) {
      const r = Math.max(rTop, rBot) * colliderScale;
      this.addCollider(x - r, x + r, y - height / 2, y + height / 2, z - r, z + r, { occluder: false, bakeOccluder: false });
    }
  }

  addWallBox(materialKey, w, h, d, x, y, z, options = {}) {
    this.addStaticBox(materialKey, w, h, d, x, y, z, options);
    if (options.collider !== false) {
      this.addCollider(
        x - w / 2, x + w / 2,
        Math.max(0, y - h / 2), y + h / 2,
        z - d / 2, z + d / 2,
        {
          occluder: options.occluder !== false,
          bakeOccluder: options.bakeOccluder !== false,
          playerCollide: options.playerCollide !== false,
          requiresCrouch: options.requiresCrouch
        }
      );
    }
  }

  addWallX(x0, x1, z, height, material = 'concrete', { thickness = .2, openings = [] } = {}) {
    const sorted = [...openings].sort((a, b) => a.x0 - b.x0);
    let cursor = x0;
    for (const opening of sorted) {
      if (opening.x0 > cursor) {
        const w = opening.x0 - cursor;
        this.addWallBox(material, w, height, thickness, cursor + w / 2, height / 2, z);
      }
      const ow = opening.x1 - opening.x0;
      const top = opening.height ?? 2.15;
      if (top < height) {
        // Lintels are visible light blockers but must not collide or occlude line of sight at waist height.
        this.addStaticBox(material, ow, height - top, thickness, opening.x0 + ow / 2, top + (height - top) / 2, z);
        this.addCollider(opening.x0, opening.x1, top, height, z - thickness / 2, z + thickness / 2, {
          playerCollide: false, occluder: false, bakeOccluder: true
        });
      }
      cursor = Math.max(cursor, opening.x1);
    }
    if (cursor < x1) {
      const w = x1 - cursor;
      this.addWallBox(material, w, height, thickness, cursor + w / 2, height / 2, z);
    }
  }

  addWallZ(z0, z1, x, height, material = 'concrete', { thickness = .2, openings = [] } = {}) {
    const sorted = [...openings].sort((a, b) => a.z0 - b.z0);
    let cursor = z0;
    for (const opening of sorted) {
      if (opening.z0 > cursor) {
        const d = opening.z0 - cursor;
        this.addWallBox(material, thickness, height, d, x, height / 2, cursor + d / 2);
      }
      const od = opening.z1 - opening.z0;
      const top = opening.height ?? 2.15;
      if (top < height) {
        this.addStaticBox(material, thickness, height - top, od, x, top + (height - top) / 2, opening.z0 + od / 2);
        this.addCollider(x - thickness / 2, x + thickness / 2, top, height, opening.z0, opening.z1, {
          playerCollide: false, occluder: false, bakeOccluder: true
        });
      }
      cursor = Math.max(cursor, opening.z1);
    }
    if (cursor < z1) {
      const d = z1 - cursor;
      this.addWallBox(material, thickness, height, d, x, height / 2, cursor + d / 2);
    }
  }

  addFloor(x0, x1, z0, z1, material = 'concreteFloor', y = 0, thickness = .22, options = {}) {
    const w = x1 - x0;
    const d = z1 - z0;
    this.addStaticBox(material, w, thickness, d, (x0 + x1) / 2, y - thickness / 2, (z0 + z1) / 2, options);
    this.addCollider(x0, x1, y - thickness, y, z0, z1, {
      playerCollide: false, occluder: false, bakeOccluder: true
    });
    if (options.surface) this.surfacePads.push({ x0, x1, z0, z1, type: options.surface });
    if (options.water) this.waterPads.push({ x0, x1, z0, z1 });
  }

  addCeiling(x0, x1, z0, z1, material = 'ceiling', y = 2.8, options = {}) {
    this.addStaticBox(material, x1 - x0, .18, z1 - z0, (x0 + x1) / 2, y + .09, (z0 + z1) / 2, options);
    this.addCollider(x0, x1, y, y + .18, z0, z1, {
      playerCollide: false, occluder: false, bakeOccluder: true
    });
  }

  addDoorFrame(axis, x, z, width, height, material = 'paintedMetalDark', { trim = true } = {}) {
    const t = .16;
    if (axis === 'x') {
      this.addStaticBox(material, .12, height + .11, .26, x - width / 2 - .04, (height + .11) / 2, z);
      this.addStaticBox(material, .12, height + .11, .26, x + width / 2 + .04, (height + .11) / 2, z);
      this.addStaticBox(material, width + .2, .12, .26, x, height + .06, z);
      if (trim) this.addStaticBox('warningYellow', width, .035, .02, x, .035, z + .115);
    } else {
      this.addStaticBox(material, .26, height + .11, .12, x, (height + .11) / 2, z - width / 2 - .04);
      this.addStaticBox(material, .26, height + .11, .12, x, (height + .11) / 2, z + width / 2 + .04);
      this.addStaticBox(material, .26, .12, width + .2, x, height + .06, z);
      if (trim) this.addStaticBox('warningYellow', .02, .035, width, x + .115, .035, z);
    }
  }

  addBaseboard(axis, x0, x1, z, height = 2.8, material = 'blackMetal') {
    this.addStaticBox(material, x1 - x0, .09, .05, (x0 + x1) / 2, .045, z, { scale: 1 });
  }

  /* ------------------------------------------------------------------ */
  /* Lighting                                                            */
  /* ------------------------------------------------------------------ */

  addBakeLight(x, y, z, {
    color = 0xffc98c,
    intensity = 1.25,
    range = 9,
    castShadow = true
  } = {}) {
    this.bakeLights.push({
      position: new THREE.Vector3(x, y, z),
      color: new THREE.Color(color),
      intensity,
      range,
      castShadow
    });
    return this.bakeLights[this.bakeLights.length - 1];
  }

  addFluorescent(x, z, {
    y = 2.65,
    length = 1.45,
    color = 0xffd2a0,
    intensity = 1.25,
    range = 8.5,
    lit = true,
    flicker = false,
    dynamic = false,
    castShadow = true,
    cone = false
  } = {}) {
    const material = lit ? 'emissiveWarm' : 'lampOff';
    const housingMat = 'paintedMetalDark';
    this.addStaticBox(housingMat, length + .13, .1, .25, x, y, z, { scale: 1 });
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(length, .035, .055),
      new THREE.MeshStandardMaterial({
        color: lit ? 0xb6ad91 : 0x3c423b,
        emissive: color,
        emissiveIntensity: lit ? 1.7 : 0,
        roughness: .3,
        metalness: .1
      })
    );
    tube.material.userData.disposeWithObject = true;
    tube.position.set(x, y - .065, z);
    this.scene.add(tube);
    if (lit) this.addBakeLight(x, y - .1, z, { color, intensity, range, castShadow });
    let light = null;
    let baseIntensity = 0;
    if (lit && dynamic) {
      light = new THREE.PointLight(color, 3.2, range, 1.55);
      light.position.set(x, y - .12, z);
      this.scene.add(light);
      this.dynamicLights.push(light);
      baseIntensity = light.intensity;
    }
    if (flicker) {
      this.flickerLights.push({ light, mesh: tube, baseIntensity, baseEmissive: 1.7, next: Math.random() * 4, state: 1 });
    }
    if (cone) this.addLightCone(x, y, z, { color, radius: .42, length: range * .65 });
    return tube;
  }

  addLightCone(x, y, z, { color = 0xd8c49d, radius = .3, length = 4.5, opacity = .016 } = {}) {
    const geo = new THREE.ConeGeometry(radius, length, 24, 1, true);
    geo.translate(0, -length / 2, 0);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false
    });
    const cone = new THREE.Mesh(geo, material);
    cone.position.set(x, y - .08, z);
    cone.userData.disposeWithObject = true;
    this.scene.add(cone);
    return cone;
  }

  addDynamicPointLight(x, y, z, { color = 0xffb877, intensity = 3, distance = 8, decay = 1.6 } = {}) {
    const light = new THREE.PointLight(color, intensity, distance, decay);
    light.position.set(x, y, z);
    this.scene.add(light);
    this.dynamicLights.push(light);
    return light;
  }

  addFlicker(light, mesh, { baseIntensity = 3, baseEmissive = 1.7 } = {}) {
    this.flickerLights.push({ light, mesh, baseIntensity, baseEmissive, next: Math.random() * 3, state: 1 });
  }

  rebakeLighting(lights = this.bakeLights) {
    if (!this._staticFinalized) return;
    this.staticBatch.bake(lights, this.colliders);
  }

  /* ------------------------------------------------------------------ */
  /* Interaction                                                         */
  /* ------------------------------------------------------------------ */

  addInteractable({
    position,
    size = { x: 1, y: 1, z: 1 },
    label,
    sub = '',
    range = 2.5,
    onInteract = null,
    enabled = true,
    object = null,
    highlight = null
  }) {
    const id = ++this.uuid;
    const material = this.invisibleMaterial;
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    hitbox.position.copy(position);
    hitbox.layers.set(INVISIBLE_HIT_LAYER);
    hitbox.name = `interact:${id}`;
    hitbox.userData.interactionId = id;
    hitbox.frustumCulled = false;
    const isVisible = enabled && object !== null ? object.visible : enabled;
    hitbox.visible = isVisible;
    this.scene.add(hitbox);
    const item = {
      id,
      hitbox,
      object,
      range,
      getLabel: typeof label === 'function' ? label : () => label,
      getSub: typeof sub === 'function' ? sub : () => sub,
      onInteract,
      enabled,
      highlight,
      setEnabled(value) {
        this.enabled = value;
        this.hitbox.visible = value;
      },
      setPosition(x, y, z) { this.hitbox.position.set(x, y, z); },
      dispose: () => {
        this.scene.remove(hitbox);
        hitbox.geometry.dispose();
        const index = this.interactables.indexOf(item);
        if (index >= 0) this.interactables.splice(index, 1);
      }
    };
    this.interactables.push(item);
    return item;
  }

  addTrigger({ x0, x1, z0, z1, once = true, onEnter = null, enabled = true }) {
    const trigger = { x0, x1, z0, z1, once, onEnter, enabled, fired: false };
    this.triggers.push(trigger);
    return trigger;
  }

  after(seconds, callback) {
    const timer = { time: seconds, callback, cancelled: false };
    this.timers.push(timer);
    return timer;
  }

  every(seconds, callback) {
    const timer = { time: seconds, every: seconds, callback };
    this.timers.push(timer);
    return timer;
  }

  /* ------------------------------------------------------------------ */
  /* Doors                                                               */
  /* ------------------------------------------------------------------ */

  addDoor({
    x, z,
    width = 1.05,
    height = 2.14,
    axis = 'x',
    style = 'swing',
    material = 'paintedMetal',
    locked = false,
    lockedText = 'Locked.',
    name = 'Door',
    sign = null,
    openAngle = 1.65,
    hinge = 1,
    onInteract = null,
    onOpened = null,
    open = false
  }) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const panelGroup = new THREE.Group();
    group.add(panelGroup);
    const thickness = .075;
    let panelGeo;
    if (axis === 'x') {
      panelGeo = new THREE.BoxGeometry(width, height, thickness);
      panelGeo.translate(width / 2, height / 2, 0);
      panelGroup.position.x = -width / 2;
    } else {
      panelGeo = new THREE.BoxGeometry(thickness, height, width);
      panelGeo.translate(0, height / 2, width / 2);
      panelGroup.position.z = -width / 2;
    }
    const panelMaterial = this.game.materials.clone(material, { roughness: .72 });
    panelMaterial.userData.disposeWithObject = true;
    const panel = new THREE.Mesh(panelGeo, panelMaterial);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panelGroup.add(panel);
    // Worn edge strip and handle.
    const trimMat = this.game.materials.get('steelDull');
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .18, 8), trimMat);
    handle.rotation.x = Math.PI / 2;
    if (axis === 'x') {
      handle.position.set(width * .82, 1.02, .06);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.045, .17, .016), trimMat);
      plate.position.set(width * .82, 1.05, .05);
      panelGroup.add(plate);
    } else {
      handle.rotation.z = Math.PI / 2;
      handle.position.set(.06, 1.02, width * .82);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.016, .17, .045), trimMat);
      plate.position.set(.05, 1.05, width * .82);
      panelGroup.add(plate);
    }
    panelGroup.add(handle);
    if (sign) {
      const signMat = this.game.materials.glowingSignMaterial(sign.key, {
        title: sign.title, lines: sign.lines || [], titleSize: 38, lineSize: 18,
        bg: '#283028', fg: '#d3ccb1', accent: '#a89060', width: 512, height: 220
      });
      const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(.5, .2), signMat);
      if (axis === 'x') {
        signMesh.position.set(width * .5, height * .76, thickness / 2 + .004);
      } else {
        signMesh.rotation.y = Math.PI / 2;
        signMesh.position.set(thickness / 2 + .004, height * .76, width * .5);
      }
      panelGroup.add(signMesh);
    }
    this.scene.add(group);
    const collider = this.addCollider(
      axis === 'x' ? x - width / 2 : x - .1,
      axis === 'x' ? x + width / 2 : x + .1,
      0, height,
      axis === 'z' ? z - width / 2 : z - .1,
      axis === 'z' ? z + width / 2 : z + .1,
      { occluder: true, tag: 'door' }
    );
    const door = {
      type: 'door',
      x, z, axis, width, height, style, locked, name, lockedText, onInteract, onOpened,
      game: this.game,
      group, panelGroup, collider, openState: open ? 1 : 0, target: open ? 1 : 0, moving: false,
      hitbox: null, level: this,
      isOpen() { return this.openState > .92; },
      getLabel() {
        if (this.locked) return `${this.name} — Locked`;
        return `Open ${this.name}`;
      },
      getSub() { return this.locked ? this.lockedText : 'E'; },
      unlock() {
        this.locked = false;
      },
      open(instant = false) {
        if (this.openState > 0.99) return;
        if (this.locked) return;
        this.target = 1;
        this.moving = true;
        this.collider.enabled = false;
        if (this.hitbox) this.hitbox.setEnabled(false);
        this.game.audio.playAt('doorOpen', new THREE.Vector3(this.x, 1, this.z), { volume: .38, rate: .9 + Math.random() * .1 });
        if (instant) {
          this.openState = 1;
          this._applyOpenState();
          this.moving = false;
          this.onOpened?.();
        }
      },
      close() {
        if (this.openState < .01) return;
        this.target = 0;
        this.moving = true;
        this.collider.enabled = false;
        this.game.audio.playAt('doorClose', new THREE.Vector3(this.x, 1, this.z), { volume: .32 });
      },
      _applyOpenState() {
        if (this.style === 'slide') {
          if (this.axis === 'x') group.position.x = x + this.openState * width * .98;
          else group.position.z = z + this.openState * width * .98;
        } else {
          panelGroup.rotation.y = this.openState * openAngle * hinge;
        }
        if (this.openState >= .98) this.collider.enabled = false;
      },
      update(dt) {
        if (!this.moving) return;
        const speed = style === 'slide' ? 1.35 : 1.5;
        const dir = this.target > this.openState ? 1 : -1;
        this.openState = Math.max(0, Math.min(1, this.openState + dir * dt * speed));
        this._applyOpenState();
        if ((dir > 0 && this.openState >= 1) || (dir < 0 && this.openState <= 0)) {
          this.moving = false;
          this.collider.enabled = this.openState < .1;
          if (this.openState >= 1) this.onOpened?.();
        }
      }
    };
    if (open) {
      door.hitbox = null;
      door._applyOpenState();
      door.collider.enabled = false;
    } else {
      door.hitbox = this.addInteractable({
        position: new THREE.Vector3(x, 1.08, z),
        size: axis === 'x' ? new THREE.Vector3(width * .9, height * .9, .38) : new THREE.Vector3(.38, height * .9, width * .9),
        range: 2.35,
        label: () => door.getLabel(),
        sub: () => door.locked ? door.lockedText : 'E — open',
        onInteract: () => {
          if (door.onInteract) {
            door.onInteract(door);
            return;
          }
          if (door.locked) {
            this.game.audio.play('locked', { volume: .32 });
            this.game.ui.showHint(door.lockedText, 3);
            return;
          }
          door.open();
        }
      });
    }
    this.updatables.push((dt) => door.update(dt));
    this.doors.push(door);
    return door;
  }

  /* ------------------------------------------------------------------ */
  /* Props and signs                                                     */
  /* ------------------------------------------------------------------ */

  addSign({ x, y, z, width = .8, height = .4, ry = 0, key, title, lines = [], bg, fg, accent, glowing = false, titleSize = 46 }) {
    const options = {
      title, lines, titleSize, lineSize: 18, width: 512, height: 240,
      bg: bg || '#29302a', fg: fg || '#d3ccb1', accent: accent || '#b29862'
    };
    const mat = glowing
      ? this.game.materials.glowingSignMaterial(key, options)
      : this.game.materials.signMaterial(key, options);
    const geo = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  addDecal(type, x, y, z, w, h, { rx = -Math.PI / 2, ry = 0, rz = 0, opacity = null } = {}) {
    const mat = this.game.materials.get(`decal${type.charAt(0).toUpperCase() + type.slice(1)}`) || this.game.materials.get('decalGrime');
    const geo = new THREE.PlaneGeometry(w, h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    return mesh;
  }

  addPuddle(x, z, w, d, { y = .008, rotation = 0, opacity = null } = {}) {
    const segments = 20;
    const shape = new THREE.Shape();
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const wobble = .78 + Math.sin(a * 3 + x) * .08 + Math.cos(a * 5 + z) * .06 + Math.sin(a * 7) * .035;
      const px = Math.cos(a) * w * .5 * wobble;
      const py = Math.sin(a) * d * .5 * wobble;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);
    }
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mat = this.game.materials.get('puddle').clone();
    mat.userData.disposeWithObject = true;
    if (opacity !== null) mat.opacity = opacity;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    mesh.renderOrder = 1;
    this.scene.add(mesh);
    return mesh;
  }

  addSoundEmitter(x, y, z, {
    sound = 'drip',
    min = 4, max = 12,
    volume = .22,
    rateMin = .7,
    rateMax = 1.1,
    maxDistance = 22
  } = {}) {
    const emitter = {
      position: new THREE.Vector3(x, y, z),
      sound, min, max, volume, rateMin, rateMax, maxDistance,
      timer: min + Math.random() * (max - min)
    };
    this.soundEmitters.push(emitter);
    return emitter;
  }

  /* ------------------------------------------------------------------ */
  /* Abstract helpers                                                    */
  /* ------------------------------------------------------------------ */

  addStaticGroupForCull(object, x, y, z, options = {}) {
    const entry = { object, position: new THREE.Vector3(x, y, z), options };
    this.occludables.push(entry);
    return object;
  }

  addDustVolume(minX, maxX, minZ, maxZ, minY = .3, maxY = 2.7) {
    this.dustVolumes.push({ minX, maxX, minZ, maxZ, minY, maxY });
  }

  getSurface(x, z) {
    for (const pad of this.surfacePads) {
      if (x >= pad.x0 && x <= pad.x1 && z >= pad.z0 && z <= pad.z1) return pad.type;
    }
    for (const pad of this.waterPads) {
      if (x >= pad.x0 && x <= pad.x1 && z >= pad.z0 && z <= pad.z1) return 'water';
    }
    return 'concrete';
  }

  isLowCeiling(x, z) {
    return this.lowCeilings.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  }

  setObjective(text, sub = '') {
    this.objective = { text, sub };
    this.game.setObjective(text, sub);
  }

  setCheckpoint(x, z, yaw = null) {
    this._checkpoint = { x, z, yaw: yaw ?? this.game.player?.yaw ?? this.spawn.yaw };
  }

  getCheckpoint() {
    return this._checkpoint || { x: this.spawn.x, z: this.spawn.z, yaw: this.spawn.yaw };
  }

  /* ------------------------------------------------------------------ */
  /* Story / records                                                     */
  /* ------------------------------------------------------------------ */

  collectRecord(record) {
    this.game.collectRecord(record);
  }

  openNote(record, { collect = true } = {}) {
    if (collect) this.collectRecord(record);
    this.game.openNote(record);
  }

  async enter() {
    for (const door of this.doors) {
      if (door.openState > 0) door._applyOpenState();
    }
    if (this.ambientTrack) {
      this.game.audio.setAmbient(this.ambientTrack, { volume: .55 });
    }
    this.game.ui.setNoiseVisible(false);
    this.onEnter?.();
  }

  exit() {
    this.game.audio.setTension(0);
    this._disposed = true;
  }

  /* ------------------------------------------------------------------ */
  /* Frame                                                               */
  /* ------------------------------------------------------------------ */

  update(dt, camera) {
    this._elapsed += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      if (timer.cancelled) {
        this.timers.splice(i, 1);
        continue;
      }
      timer.time -= dt;
      if (timer.time <= 0) {
        if (timer.every) {
          timer.time += timer.every;
          timer.callback();
        } else {
          timer.callback();
          this.timers.splice(i, 1);
        }
      }
    }
    for (const update of this.updatables) update(dt, this._elapsed);
    if (this.dust) this.dust.update(dt, camera);
    this.occluder.update(dt, camera, this.colliders);
    this._updateTriggers();
    this._updateLights(dt);
    this._updateSounds(dt);
    this.onUpdate?.(dt, this._elapsed);
  }

  _updateTriggers() {
    const p = this.game.player.position;
    for (const trigger of this.triggers) {
      if (!trigger.enabled || trigger.fired) continue;
      if (p.x >= trigger.x0 && p.x <= trigger.x1 && p.z >= trigger.z0 && p.z <= trigger.z1) {
        trigger.fired = true;
        if (trigger.once) trigger.enabled = false;
        trigger.onEnter?.();
      }
    }
  }

  _updateLights(dt) {
    for (const flicker of this.flickerLights) {
      flicker.next -= dt;
      if (flicker.next <= 0) {
        if (flicker.state === 1) {
          flicker.state = Math.random() < .7 ? 0 : .35;
          flicker.next = .035 + Math.random() * .18;
        } else {
          flicker.state = 1;
          flicker.next = .4 + Math.random() * 6.5;
          if (Math.random() < .14) flicker.next = .06;
        }
        const target = flicker.baseIntensity * flicker.state;
        if (flicker.light) flicker.light.intensity = target;
        if (flicker.mesh?.material) flicker.mesh.material.emissiveIntensity = flicker.baseEmissive * (flicker.state || .25);
      }
    }
  }

  _updateSounds(dt) {
    const p = this.game.player.position;
    for (const emitter of this.soundEmitters) {
      emitter.timer -= dt;
      if (emitter.timer > 0) continue;
      const distSq = (emitter.position.x - p.x) ** 2 + (emitter.position.z - p.z) ** 2;
      if (distSq < emitter.maxDistance * emitter.maxDistance) {
        this.game.audio.playAt(emitter.sound, emitter.position, {
          volume: emitter.volume * (.75 + Math.random() * .4),
          rate: emitter.rateMin + Math.random() * (emitter.rateMax - emitter.rateMin)
        });
      }
      emitter.timer = emitter.min + Math.random() * (emitter.max - emitter.min);
    }
  }

  applyQuality(quality) {
    if (this.dust) {
      this.dust.points.visible = true;
    }
    for (const light of this.dynamicLights) {
      if (light.isPointLight) {
        light.castShadow = false;
      }
    }
    if (this.occluder) this.occluder.timer = 0;
  }

  getDebugInfo() {
    return {
      level: this.id,
      colliders: this.colliders.length,
      interactables: this.interactables.length,
      bakedLights: this.bakeLights.length,
      drawCalls: this.game.renderPipeline.getInfo().calls,
      triangles: this.game.renderPipeline.getInfo().triangles,
      occludables: this.occluder.stats,
      bakeMs: this.staticBatch.bakeStats.ms
    };
  }

  respawn() {
    const cp = this.getCheckpoint();
    this.game.player.setPosition(cp.x, cp.z, cp.yaw);
    this.game.player.hidden = false;
    this.game.player.enabled = true;
    this.game.ui.setHiding(false);
    this.onRespawn?.();
  }

  dispose() {
    this.exit();
    this.staticBatch.dispose();
    if (this.dust) {
      this.dust.dispose();
      this.dust = null;
    }
    // Remove all remaining objects and dispose owned geometry/material.
    const disposedMaterials = new Set();
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (disposedMaterials.has(mat)) continue;
          if (mat.userData?.disposeWithObject) {
            disposedMaterials.add(mat);
            mat.dispose();
          }
        }
      }
    });
    this.invisibleMaterial.dispose();
    this.scene.clear();
    this.interactables.length = 0;
    this.updatables.length = 0;
    this.timers.length = 0;
  }
}
