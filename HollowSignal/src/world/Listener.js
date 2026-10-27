import * as THREE from 'three';

export const LISTENER_STATE = {
  PATROL: 'patrol',
  INVESTIGATE: 'investigate',
  CHASE: 'chase',
  DORMANT: 'dormant'
};

function createLimb(material, length, radius, side = 1) {
  const group = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(radius * .82, radius, length, 7), material);
  upper.position.y = -length / 2;
  group.add(upper);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 7, 5), material);
  joint.position.y = -length;
  group.add(joint);
  return group;
}

function buildLeg(material, length, radius) {
  const group = new THREE.Group();
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.05, radius * .8, length, 7), material);
  thigh.position.y = -length / 2;
  group.add(thigh);
  const shinGroup = new THREE.Group();
  shinGroup.position.y = -length;
  const shin = new THREE.Mesh(new THREE.CylinderGeometry(radius * .72, radius * .48, length * .92, 7), material);
  shin.position.y = -length * .46;
  shinGroup.add(shin);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.2, radius * .75, radius * 4.2), material);
  foot.position.set(0, -length * .92, radius * 1.2);
  shinGroup.add(foot);
  group.add(shinGroup);
  return { group, shinGroup };
}

/**
 * A tall, eyeless silhouette assembled from simple deforming primitives.
 * It is deliberately under-detailed: the flashlight does most of the design work.
 */
export function createHollowFigure(materials, { scale = 1 } = {}) {
  const root = new THREE.Group();
  root.name = 'hollow-figure';

  const black = new THREE.MeshStandardMaterial({
    color: 0x070908,
    roughness: .94,
    metalness: .03,
    emissive: 0x0c1411,
    emissiveIntensity: .24,
    side: THREE.DoubleSide
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0x0b0d0a,
    roughness: .8,
    metalness: .02,
    emissive: 0x121a15,
    emissiveIntensity: .18
  });
  black.userData.disposeWithObject = true;
  skin.userData.disposeWithObject = true;

  const body = new THREE.Group();
  body.position.y = 0;
  root.add(body);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(.27, .2, .18), black);
  hips.position.y = .93;
  body.add(hips);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.165, .115, .84, 7), black);
  torso.position.y = 1.44;
  torso.rotation.x = .08;
  body.add(torso);

  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(.46, .09, .15), black);
  shoulders.position.y = 1.82;
  shoulders.rotation.z = .015;
  body.add(shoulders);

  // A long, split coat. The front hangs open to keep the silhouette narrow.
  const coat = new THREE.Mesh(new THREE.ConeGeometry(.31, .96, 8, 1, true), black);
  coat.position.y = 1.02;
  coat.rotation.y = Math.PI / 8;
  body.add(coat);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.052, .072, .2, 7), skin);
  neck.position.y = 1.93;
  neck.rotation.x = -.08;
  body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(.135, 13, 10), skin);
  head.position.set(0, 2.065, -.012);
  head.scale.set(.86, 1.25, .9);
  head.rotation.x = -.08;
  body.add(head);

  // A blind face: a shallow vertical indentation where a face would be.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.055, .19), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .8 }));
  face.position.set(0, 2.06, -.128);
  face.rotation.y = Math.PI;
  face.material.userData.disposeWithObject = true;
  body.add(face);

  const arms = [];
  for (const side of [-1, 1]) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * .225, 1.79, 0);
    const upper = createLimb(black, .52, .035);
    upper.rotation.z = side * .12;
    shoulderPivot.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -.52;
    const lower = createLimb(black, .58, .027);
    lower.rotation.x = -.12;
    elbow.add(lower);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.055, .21, .03), skin);
    hand.position.set(0, -.71, 0);
    elbow.add(hand);
    upper.add(elbow);
    body.add(shoulderPivot);
    arms.push({ pivot: shoulderPivot, elbow, side });
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = buildLeg(black, .49, .048);
    leg.group.position.set(side * .105, .93, 0);
    body.add(leg.group);
    legs.push(leg);
  }

  root.scale.setScalar(scale);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { root, body, head, arms, legs, materials: [black, skin, face.material] };
}

export class Listener {
  constructor(level, {
    waypoints = [[0, -15], [0, -4]],
    startIndex = 0,
    patrolSpeed = 0.68,
    chaseSpeed = 3.0,
    alertDistance = 6.5,
    scale = 1.04
  } = {}) {
    this.level = level;
    this.game = level.game;
    this.waypoints = waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.waypointIndex = Math.max(0, startIndex % this.waypoints.length);
    this.patrolSpeed = patrolSpeed;
    this.chaseSpeed = chaseSpeed;
    this.alertDistance = alertDistance;
    this.state = LISTENER_STATE.PATROL;
    this.active = true;
    this.scriptedChase = false;
    this.stepInterval = .58;
    this._stepTimer = 0;
    this._walkPhase = 0;
    this._animTime = 0;
    this._lostTimer = 0;
    this._searchTimer = 0;
    this._dangerShown = false;
    this._lastDangerUpdate = 0;
    this._reactionCooldown = 0;
    this._deathArmed = true;
    this.lastKnown = new THREE.Vector3(0, 0, -15);
    this.hasLastKnown = false;

    const figure = createHollowFigure(this.game.materials, { scale });
    this.figure = figure;
    this.root = figure.root;
    this.root.position.copy(this.waypoints[this.waypointIndex]);
    this.root.rotation.y = Math.PI;
    this.level.scene.add(this.root);
    // A faint signal halo makes it legible in unlit rooms without turning it into a ghost.
    this.halo = new THREE.PointLight(0x789b86, .55, 3.2, 2.1);
    this.halo.position.set(0, 1.9, 0);
    this.root.add(this.halo);
  }

  get position() {
    return this.root.position;
  }

  setActive(active) {
    this.active = !!active;
    this.root.visible = !!active;
    if (!active) {
      this._setDanger(false);
      this.game.audio?.setTension?.(0);
    }
  }

  setVisible(visible) {
    this.root.visible = !!visible;
  }

  hearNoise(position, intensity = .5) {
    if (!this.active || this.scriptedChase) return;
    const player = this.game.player;
    if (player.hidden) return;
    const dx = position.x - this.root.position.x;
    const dz = position.z - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    const radius = intensity >= .8 ? 17 : intensity >= .3 ? 10 : 3.2;
    if (dist > radius) return;

    this.lastKnown.set(position.x, 0, position.z);
    this.hasLastKnown = true;

    if (this.state === LISTENER_STATE.PATROL || this.state === LISTENER_STATE.DORMANT) {
      this.state = LISTENER_STATE.INVESTIGATE;
      this._searchTimer = 0;
      this._lostTimer = 5.0;
      this._alertSound(false);
      this._setDanger(dist < 12);
      this.game.audio?.setTension?.(Math.min(.62, .25 + intensity * .35));
      if (dist < 13) {
        this.game.ui?.showHint?.('Something in the corridor changes direction.', 2.4);
      }
    } else if (this.state === LISTENER_STATE.INVESTIGATE) {
      this._lostTimer = 4.0;
    }

    if (dist < this.alertDistance && intensity > .28) {
      this._beginChase();
    }
  }

  makeNoise(position, intensity = .8) {
    this.hearNoise(position, intensity);
  }

  _beginChase() {
    if (this.state === LISTENER_STATE.CHASE) return;
    this.state = LISTENER_STATE.CHASE;
    this._lostTimer = 5.5;
    this._alertSound(true);
    this._setDanger(true);
    this.game.audio?.setTension?.(.86);
    this.game.player?.addShake?.(.32);
    this.game.ui?.showHint?.('It heard you. Do not be where the sound was.', 3.4);
  }

  startChase() {
    if (!this.active) this.setActive(true);
    this.scriptedChase = true;
    this.state = LISTENER_STATE.CHASE;
    this._lostTimer = 99;
    this._alertSound(true);
    this._setDanger(true);
    this.game.audio?.setTension?.(1);
  }

  stopChase() {
    this.scriptedChase = false;
    this.state = LISTENER_STATE.PATROL;
    this._setDanger(false);
    this.game.audio?.setTension?.(.2);
  }

  resetTo(position, waypointIndex = 0) {
    this.state = LISTENER_STATE.PATROL;
    this.scriptedChase = false;
    this.waypointIndex = waypointIndex % this.waypoints.length;
    if (position) this.root.position.set(position.x, 0, position.z);
    else this.root.position.copy(this.waypoints[this.waypointIndex]);
    this.root.rotation.y = Math.PI;
    this.root.visible = true;
    this.active = true;
    this.hasLastKnown = false;
    this._lostTimer = 0;
    this._searchTimer = 0;
    this._setDanger(false);
    this.game.audio?.setTension?.(0);
  }

  _alertSound(sharp = false) {
    if (this._reactionCooldown > 0) return;
    this._reactionCooldown = sharp ? 2.4 : 4.0;
    const p = this.root.position;
    this.game.audio?.playAt?.('staticBurst', { x: p.x, y: 1.5, z: p.z }, { volume: sharp ? .24 : .12, rate: sharp ? .65 : .45 });
    this.game.audio?.playAt?.('metalGroan', { x: p.x, y: 1.1, z: p.z }, { volume: sharp ? .18 : .08, rate: .42 });
  }

  _setDanger(on) {
    if (this._dangerShown === on) return;
    this._dangerShown = on;
    this.game.ui?.setDanger?.(on);
    if (on) this.game.ui?.setTension?.();
  }

  update(dt) {
    if (!this.active) return;
    this._animTime += dt;
    this._reactionCooldown = Math.max(0, this._reactionCooldown - dt);

    const player = this.game.player;
    const dx = player.position.x - this.root.position.x;
    const dz = player.position.z - this.root.position.z;
    const distance = Math.hypot(dx, dz);
    const hidden = !!player.hidden;

    if (this.scriptedChase) {
      if (!hidden) {
        this.lastKnown.set(player.position.x, 0, player.position.z);
        this.hasLastKnown = true;
      }
      this._moveToward(this.lastKnown, this.chaseSpeed, dt);
      this._updateDangerDistance(distance, hidden);
      if (!hidden && distance < 1.0) this._catchPlayer();
      this._animate(dt, true);
      return;
    }

    if (hidden) {
      this.hasLastKnown = false;
      this._lostTimer = Math.max(0, this._lostTimer - dt);
      if (this.state === LISTENER_STATE.CHASE && this._lostTimer <= 0) {
        this.state = LISTENER_STATE.INVESTIGATE;
        this._searchTimer = 4.5;
        this._setDanger(false);
        this.game.audio?.setTension?.(.25);
      }
    }

    switch (this.state) {
      case LISTENER_STATE.PATROL: {
        const target = this.waypoints[this.waypointIndex];
        const arrived = this._moveToward(target, this.patrolSpeed, dt);
        if (arrived) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
          this._searchTimer = .5 + Math.random() * 1.1;
          this.state = LISTENER_STATE.INVESTIGATE;
        }
        this._setDanger(false);
        break;
      }
      case LISTENER_STATE.INVESTIGATE: {
        if (this.hasLastKnown) {
          const arrived = this._moveToward(this.lastKnown, this.patrolSpeed * 1.35, dt);
          if (arrived) {
            this.hasLastKnown = false;
            this._searchTimer = 3.2;
          }
          this._lostTimer = Math.max(0, this._lostTimer - dt);
          if (this._lostTimer <= 0) {
            this.hasLastKnown = false;
            this._searchTimer = Math.min(this._searchTimer, 1.2);
          }
        } else {
          this._searchTimer -= dt;
          // Slow scanning turn, like it is tasting the room.
          this.root.rotation.y += Math.sin(this._animTime * .55) * dt * .16;
          if (this._searchTimer <= 0) {
            this.state = LISTENER_STATE.PATROL;
            this._setDanger(false);
            this.game.audio?.setTension?.(0);
          }
        }
        this._updateDangerDistance(distance, hidden);
        break;
      }
      case LISTENER_STATE.CHASE: {
        if (hidden) {
          this._updateDangerDistance(distance, hidden);
          this._lostTimer = Math.max(0, this._lostTimer - dt);
          if (this._lostTimer <= 0) {
            this.state = LISTENER_STATE.INVESTIGATE;
            this.hasLastKnown = false;
            this._searchTimer = 3.5;
            this._setDanger(false);
            this.game.audio?.setTension?.(.2);
          }
        } else {
          const target = this.hasLastKnown ? this.lastKnown : player.position;
          const arrived = this._moveToward(target, this.chaseSpeed, dt);
          this._lostTimer = Math.max(0, this._lostTimer - dt);
          if (arrived && this.hasLastKnown) {
            this.hasLastKnown = false;
            if (this._lostTimer > 3) this._lostTimer = 3;
          }
          if (this._lostTimer <= 0) {
            this.state = LISTENER_STATE.INVESTIGATE;
            this._searchTimer = 4.0;
            this._setDanger(false);
            this.game.audio?.setTension?.(.25);
          }
          this._updateDangerDistance(distance, hidden);
          if (distance < .95) this._catchPlayer();
        }
        break;
      }
      default:
        break;
    }

    // If the player is silent and very close, the thing can still stumble into them.
    if (!hidden && distance < .72 && this.state !== LISTENER_STATE.DORMANT) {
      this._catchPlayer();
    }

    this._animate(dt, this.state === LISTENER_STATE.CHASE);
  }

  _updateDangerDistance(distance, hidden) {
    if (hidden) {
      this._setDanger(this.state === LISTENER_STATE.CHASE && distance < 8);
      return;
    }
    this._setDanger(this.state === LISTENER_STATE.CHASE && distance < 13 || this.state === LISTENER_STATE.INVESTIGATE && distance < 6);
  }

  _catchPlayer() {
    if (!this._deathArmed) return;
    this._deathArmed = false;
    this.game.player.addShake?.(.8);
    this.game.killPlayer?.('listener');
    setTimeout(() => { this._deathArmed = true; }, 3000);
  }

  _moveToward(target, speed, dt) {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    const length = Math.hypot(dx, dz);
    if (length < .055) return true;
    const step = Math.min(length, speed * dt);
    const nx = dx / length;
    const nz = dz / length;
    this.root.position.x += nx * step;
    this.root.position.z += nz * step;
    const targetYaw = Math.atan2(nx, nz);
    let delta = targetYaw - this.root.rotation.y;
    delta = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.root.rotation.y += delta * Math.min(1, dt * 5.5);
    this._walkPhase += step * 8.2;
    this._stepTimer -= dt;
    if (this._stepTimer <= 0) {
      this._stepTimer = this.stepInterval + (this.state === LISTENER_STATE.CHASE ? .05 : .28) * Math.random();
      const p = this.root.position;
      const distance = Math.hypot(this.game.player.position.x - p.x, this.game.player.position.z - p.z);
      if (distance < 18) {
        this.game.audio?.playAt?.('thud', { x: p.x, y: .14, z: p.z }, {
          volume: this.state === LISTENER_STATE.CHASE ? .21 : .11,
          rate: 1.9 + Math.random() * .45
        });
      }
    }
    return false;
  }

  _animate(dt, fast) {
    const fig = this.figure;
    const swing = Math.sin(this._walkPhase) * (fast ? .55 : .3);
    const swing2 = Math.sin(this._walkPhase + Math.PI) * (fast ? .52 : .28);
    if (fig.legs[0]) {
      fig.legs[0].group.rotation.x = swing;
      fig.legs[0].shinGroup.rotation.x = Math.max(0, -swing) * .75;
    }
    if (fig.legs[1]) {
      fig.legs[1].group.rotation.x = swing2;
      fig.legs[1].shinGroup.rotation.x = Math.max(0, -swing2) * .75;
    }
    if (fig.arms[0]) {
      fig.arms[0].pivot.rotation.x = -swing * .72;
      fig.arms[0].elbow.rotation.x = -.15 - Math.max(0, swing) * .45;
    }
    if (fig.arms[1]) {
      fig.arms[1].pivot.rotation.x = -swing2 * .72;
      fig.arms[1].elbow.rotation.x = -.15 - Math.max(0, -swing2) * .45;
    }
    fig.body.position.y = Math.sin(this._walkPhase * 2) * .018;
    fig.body.rotation.z = Math.sin(this._walkPhase) * .015;
    fig.head.rotation.z = Math.sin(this._animTime * .43) * .045;
    fig.head.rotation.x = -.08 + Math.sin(this._animTime * .31) * .03;
    this.halo.intensity = .38 + Math.sin(this._animTime * 1.7) * .11;
  }

  getDebugInfo() {
    return {
      state: this.state,
      position: { x: +this.root.position.x.toFixed(2), z: +this.root.position.z.toFixed(2) },
      scriptedChase: this.scriptedChase,
      danger: this._dangerShown
    };
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material?.userData?.disposeWithObject) o.material.dispose();
    });
    this.halo?.dispose();
  }
}
