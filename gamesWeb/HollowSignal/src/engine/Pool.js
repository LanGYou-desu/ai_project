import * as THREE from 'three';

export class ObjectPool {
  constructor(factory, size) {
    this._factory = factory;
    this._items = [];
    this._free = [];
    for (let i = 0; i < size; i++) {
      const item = factory(i);
      item.__poolIndex = i;
      item.__inUse = false;
      this._items.push(item);
      this._free.push(item);
    }
  }
  acquire(setup = null) {
    const item = this._free.pop() || null;
    if (!item) return null;
    item.__inUse = true;
    setup?.(item);
    return item;
  }
  release(item) {
    if (!item || !item.__inUse) return;
    item.__inUse = false;
    this._free.push(item);
  }
  forEachInUse(fn) {
    for (const item of this._items) if (item.__inUse) fn(item);
  }
  get inUse() {
    let n = 0;
    for (const item of this._items) if (item.__inUse) n++;
    return n;
  }
  get size() { return this._items.length; }
}

const DUST_VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uPixelRatio;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (240.0 / max(0.7, -mv.z));
  }
`;

const DUST_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vAlpha * uOpacity;
    if (a < 0.006) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class DustField {
  constructor(scene, volumes, quality, map) {
    this.volumes = volumes;
    this.quality = quality;
    this.count = quality.particleScale > .8 ? 340 : quality.particleScale > .5 ? 230 : 110;
    this.slots = new ObjectPool((i) => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      phase: Math.random() * Math.PI * 2,
      speed: .018 + Math.random() * .055,
      size: .012 + Math.random() * .04,
      alpha: .15 + Math.random() * .35,
      volume: null,
      active: false
    }), this.count);
    for (let i = 0; i < this.count; i++) {
      const slot = this.slots.acquire();
      if (slot) {
        this._respawn(slot);
        slot.active = true;
      }
    }
    const positions = new Float32Array(this.count * 3);
    const sizes = new Float32Array(this.count);
    const alphas = new Float32Array(this.count);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 100);
    this.material = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      uniforms: {
        uMap: { value: map },
        uColor: { value: new THREE.Color(0xd0cfb6) },
        uOpacity: { value: .42 },
        uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this._time = 0;
    // Prime the GPU buffers so the first rendered frame already has dust placed.
    this.update(0, { position: new THREE.Vector3(0, 1.7, 0) });
  }

  _respawn(slot) {
    if (!this.volumes.length) {
      slot.position.set(0, 2, 0);
      return;
    }
    // Choose a volume weighted by its area, so large rooms receive more dust.
    const vol = this.volumes[Math.floor(Math.random() * this.volumes.length)];
    slot.volume = vol;
    slot.position.set(
      vol.minX + Math.random() * (vol.maxX - vol.minX),
      (vol.minY ?? .15) + Math.random() * ((vol.maxY ?? 2.8) - (vol.minY ?? .15)),
      vol.minZ + Math.random() * (vol.maxZ - vol.minZ)
    );
    slot.velocity.set((Math.random() - .5) * slot.speed, (Math.random() * .5 + .15) * slot.speed, (Math.random() - .5) * slot.speed);
  }

  update(dt, camera) {
    this._time += dt;
    const cam = camera.position;
    let i = 0;
    this.slots.forEachInUse((slot) => {
      if (!slot.active) return;
      slot.position.addScaledVector(slot.velocity, dt);
      slot.position.x += Math.sin(this._time * .32 + slot.phase) * dt * .03;
      slot.position.z += Math.cos(this._time * .27 + slot.phase * 1.7) * dt * .024;
      const vol = slot.volume;
      if (!vol || slot.position.y > (vol.maxY ?? 3) || slot.position.x < vol.minX - 1 || slot.position.x > vol.maxX + 1 ||
          slot.position.z < vol.minZ - 1 || slot.position.z > vol.maxZ + 1) {
        this._respawn(slot);
      }
      // Particles far from the player need not be simulated every frame.
      const dx = slot.position.x - cam.x;
      const dz = slot.position.z - cam.z;
      if (dx * dx + dz * dz > 28 * 28) {
        if (!vol) this._respawn(slot);
        const positions = this.geometry.attributes.position.array;
        positions[i * 3] = slot.position.x;
        positions[i * 3 + 1] = -100;
        positions[i * 3 + 2] = slot.position.z;
        const alphas = this.geometry.attributes.aAlpha.array;
        alphas[i] = 0;
        i++;
        return;
      }
      const positions = this.geometry.attributes.position.array;
      const sizes = this.geometry.attributes.aSize.array;
      const alphas = this.geometry.attributes.aAlpha.array;
      positions[i * 3] = slot.position.x;
      positions[i * 3 + 1] = slot.position.y;
      positions[i * 3 + 2] = slot.position.z;
      sizes[i] = slot.size;
      const twinkle = .7 + Math.sin(this._time * .8 + slot.phase) * .3;
      alphas[i] = slot.alpha * twinkle * (1 - Math.max(0, Math.min(1, (dx * dx + dz * dz) / (24 * 24))) * .35);
      i++;
    });
    // Unused slots are parked below the world.
    for (; i < this.count; i++) {
      const positions = this.geometry.attributes.position.array;
      const alphas = this.geometry.attributes.aAlpha.array;
      positions[i * 3 + 1] = -100;
      alphas[i] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
    this.material.uniforms.uPixelRatio.value = Math.min(2, window.devicePixelRatio || 1);
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

export class DetailOccluder {
  constructor(level) {
    this.level = level;
    this.entries = [];
    this.timer = 0;
    this.stats = { total: 0, visible: 0 };
  }

  register(object, position, { radius = 2, maxDistance = 45 } = {}) {
    if (!object) return;
    this.entries.push({ object, position: position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z), radius, maxDistance });
    object.userData.occludable = true;
  }

  update(dt, camera, colliders) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.12;
    const cam = camera.position;
    let visible = 0;
    for (const entry of this.entries) {
      const dx = entry.position.x - cam.x;
      const dz = entry.position.z - cam.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > entry.maxDistance * entry.maxDistance) {
        entry.object.visible = false;
        continue;
      }
      if (distSq < 16) {
        entry.object.visible = true;
        visible++;
        continue;
      }
      let blocked = false;
      // Quick 2D segment vs wall AABB test. Door colliders disable themselves as they open.
      for (const col of colliders) {
        if (!col.occluder || col.enabled === false) continue;
        if (col.maxY !== undefined && col.maxY < 1.4) continue;
        if (this._segmentIntersectsRect(cam.x, cam.z, entry.position.x, entry.position.z, col, entry.radius)) {
          blocked = true;
          break;
        }
      }
      entry.object.visible = !blocked;
      if (!blocked) visible++;
    }
    this.stats.total = this.entries.length;
    this.stats.visible = visible;
  }

  _segmentIntersectsRect(x1, z1, x2, z2, rect, radius = 0) {
    const minX = rect.minX - radius;
    const maxX = rect.maxX + radius;
    const minZ = rect.minZ - radius;
    const maxZ = rect.maxZ + radius;
    // Liang-Barsky.
    let t0 = 0.02;
    let t1 = 0.98;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const p = [-dx, dx, -dz, dz];
    const q = [x1 - minX, maxX - x1, z1 - minZ, maxZ - z1];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-8) {
        if (q[i] < 0) return false;
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) {
          if (t > t1) return false;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return false;
          if (t < t1) t1 = t;
        }
      }
    }
    return true;
  }
}
