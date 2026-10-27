import * as THREE from 'three';
import { BaseLevel } from './BaseLevel.js';
import {
  addDesk, addChair, addLocker, addShelf, addWorkbench, addPipeRun,
  addCagedLamp, addCrate, addBarrel, addCabinet, addRubble
} from './Props.js';
import {
  placeNote, addKeycardPickup, addLiftRecess, addCeilingLamp, addWaterSheen
} from './ChapterKit.js';

/**
 * CHAPTER I — LOW WATER
 * Flooded service tunnel, abandoned maintenance office, and the first locked
 * door between Iris and the station she helped drown.
 */
export class Chapter1 extends BaseLevel {
  constructor(game, meta) {
    super(game, meta);
    this.id = 'low-water';
    this.ambientTrack = 'lowWater';
    this.spawn = { x: 0, z: 19.4, yaw: 0, pitch: -.02 };
    this.showNoise = false;
    this.enteredOffice = false;
    this.cardUsed = false;
    this.phoneRang = false;
    this._leaving = false;
  }

  async build() {
    this.setAtmosphere({
      color: 0x030504,
      fogColor: 0x040807,
      fogDensity: .052
    });

    /* ---------------- Service tunnel ---------------- */
    this.addFloor(-1.5, 1.5, 4, 22, 'metalFloorDark', 0, .22, { surface: 'metal' });
    this.addCeiling(-1.5, 1.5, 4, 22, 'ceiling', 2.55);
    this.addWallZ(4, 22, -1.5, 2.55, 'concreteDark', {
      openings: [{ z0: 10.2, z1: 13.2, height: 2.05 }]
    });
    this.addWallZ(4, 22, 1.5, 2.55, 'concreteDark');
    this.addWallX(-1.5, 1.5, 22, 2.55, 'concreteDark');
    this.addWallX(-1.5, 1.5, 4, 2.55, 'concreteDark', {
      openings: [{ x0: -1.3, x1: 1.3, height: 2.35 }]
    });
    for (let z = 5.2; z < 21; z += 3.4) {
      this.addBaseboard('x', -1.5, -1.5, z, 2.55);
    }
    // Cable trays and a fat service pipe give the corridor a readable ceiling.
    addPipeRun(this, [[1.28, 2.36, 4.2], [1.28, 2.36, 21.5]], { radius: .085, material: 'pipeGreen' });
    addPipeRun(this, [[-1.2, 2.28, 4.2], [-1.2, 2.28, 21.5]], { radius: .045, material: 'steelDull' });
    this.addStaticBox('rustPaint', .22, .12, 17.2, 1.38, 2.22, 12.7, { scale: .8 });
    for (let z = 6; z < 21; z += 4.6) {
      this.addStaticBox('steelDull', 2.55, .06, .09, 0, 2.49, z, { scale: .8 });
    }

    /* ---------------- Newspaper alcove ---------------- */
    this.addFloor(-3, -1.5, 10.2, 13.2, 'concreteFloorDark', 0, .22);
    this.addCeiling(-3, -1.5, 10.2, 13.2, 'ceiling', 2.3);
    this.addWallZ(10.2, 13.2, -3, 2.5, 'concrete');
    this.addWallX(-3, -1.5, 10.2, 2.5, 'concreteDark');
    this.addWallX(-3, -1.5, 13.2, 2.5, 'concreteDark');
    this.addStaticBox('rustPaint', .22, 1.1, 2.4, -2.72, .9, 11.7, { scale: 1 });
    placeNote(this, 'incident-clipping', -2.92, 1.42, 11.7, {
      ry: Math.PI / 2,
      width: .36,
      height: .5,
      label: 'Read the water-stained clipping'
    });
    this.addSign({
      x: -2.9, y: 2.02, z: 11.7, ry: Math.PI / 2, width: .62, height: .22,
      key: 'tunnel-news', title: 'INCIDENT ARCHIVE', lines: ['17 MARCH 1996'], titleSize: 34
    });
    this.addBakeLight(-2.5, 1.85, 11.7, { color: 0xffc98c, intensity: .55, range: 4.2 });

    /* ---------------- Maintenance office ---------------- */
    this.addFloor(-5, 5, -4, 4, 'concreteFloor', 0, .22, { surface: 'concrete' });
    this.addCeiling(-5, 5, -4, 4, 'ceiling', 2.9);
    this.addWallX(-5, 5, 4, 2.95, 'concrete', {
      openings: [{ x0: -1.3, x1: 1.3, height: 2.4 }]
    });
    this.addWallZ(-4, 4, -5, 2.95, 'concreteDark');
    this.addWallZ(-4, 4, 5, 2.95, 'concreteDark');
    this.addWallX(-5, 5, -4, 2.95, 'concreteDark', {
      openings: [{ x0: .3, x1: 1.7, height: 2.2 }]
    });
    this.addDoorFrame('x', 1.0, -4, 1.4, 2.14, 'paintedMetalDark');
    this.addSign({
      x: -2.4, y: 2.22, z: 3.86, width: 1.45, height: .32,
      key: 'office-sign', title: 'MAINTENANCE', lines: ['SERVICE ACCESS · AUTHORISED PERSONNEL'], titleSize: 38
    });
    this.addSign({
      x: 1.0, y: 2.36, z: -3.86, width: .78, height: .24,
      key: 'security-sign', title: 'SECURITY', lines: ['LIFT LOBBY'], titleSize: 36
    });

    // Furniture.
    addDesk(this, -2.8, -1.35, { width: 2.1, depth: .88, rotation: 0 });
    addChair(this, -2.75, -.35, { rotation: Math.PI });
    addWorkbench(this, 2.55, 1.72, { width: 2.35, depth: .82 });
    addShelf(this, 3.62, -3.4, { width: 1.75, height: 1.9, depth: .4 });
    addLocker(this, -4.5, 2.55, { rotation: Math.PI / 2, open: false });
    addLocker(this, -4.5, 1.72, { rotation: Math.PI / 2, open: true });
    addCabinet(this, -4.55, -3.4, { rotation: 0 });
    addCrate(this, 3.85, 3.1, { size: .62, rotation: .2 });
    addCrate(this, 4.15, 2.35, { size: .48, rotation: -.14, y: 0 });
    addBarrel(this, -4.1, 3.2, { height: .88, radius: .28 });
    addRubble(this, 2.1, -2.7, .7, 5);
    this.addDeskLamp(-2.8, .81, -1.05);

    // Wren's service note, left on the bench beside a half-dismantled radio.
    placeNote(this, 'wren-maintenance', 3.25, .985, 1.72, {
      rx: -Math.PI / 2,
      ry: .08,
      width: .3,
      height: .38,
      label: 'Read the service note'
    });
    const radio = this.addStaticBox('darkMetal', .38, .22, .22, 2.0, 1.04, 1.9, { scale: .6 });
    this.addStaticBox('blackGloss', .16, .08, .012, 2.0, 1.09, 2.02, { scale: .4 });

    // The access card, deliberately small and easy to miss.
    addKeycardPickup(this, -3.2, .82, -1.5, {
      label: 'Take Wren’s service access card',
      onPickup: () => {
        this.game.giveItem('keycard', 'SERVICE CARD');
        this.game.ui.showHint('WREN VALE — SERVICE ACCESS. The photograph has been scratched out.', 4.4);
        this._refreshObjective();
        this.game.makeNoise(new THREE.Vector3(-3.2, .2, -1.5), .25);
      }
    });
    this.addStaticBox('paper', .3, .006, .4, -3.2, .795, -1.5, { scale: .4 });

    // A coat on a hook, dry despite the lake.
    this.addStaticBox('fabricDark', .42, .78, .1, 4.75, 1.44, -.2, { scale: 1 });
    this.addStaticBox('steelDull', .03, .04, .1, 4.75, 1.86, -.2, { scale: .4 });

    /* ---------------- Security door & lift lobby ---------------- */
    this.addFloor(-2.2, 2.2, -10, -4, 'metalFloor', 0, .22, { surface: 'metal' });
    this.addCeiling(-2.2, 2.2, -10, -4, 'ceiling', 2.65);
    this.addWallZ(-10, -4, -2.2, 2.7, 'paintedMetalDark');
    this.addWallZ(-10, -4, 2.2, 2.7, 'paintedMetalDark');
    this.addWallX(-2.2, 2.2, -10, 2.7, 'paintedMetalDark');

    const door = this.addDoor({
      x: 1.0, z: -4,
      width: 1.4,
      height: 2.14,
      axis: 'x',
      style: 'swing',
      material: 'paintedMetal',
      locked: true,
      lockedText: 'The frame reader blinks red. A service card is required.',
      name: 'Security door',
      openAngle: 1.5
    });
    this.securityDoor = door;

    // Card reader built from a unique material so the accept state can turn green.
    const plateMat = this.game.materials.clone('paintedMetalDark', { roughness: .5 });
    plateMat.userData.disposeWithObject = true;
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x321b18, emissive: 0xc24a3b, emissiveIntensity: 1.2, roughness: .4
    });
    lampMat.userData.disposeWithObject = true;
    const reader = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.14, .24, .035), plateMat);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, .018), lampMat);
    lamp.position.set(0, .065, .026);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(.085, .012, .014), this.game.materials.get('blackGloss'));
    slot.position.set(0, -.025, .026);
    reader.add(plate, lamp, slot);
    reader.position.set(2.0, 1.26, -3.88);
    this.scene.add(reader);

    const readerItem = this.addInteractable({
      position: new THREE.Vector3(1.98, 1.24, -3.72),
      size: new THREE.Vector3(.5, .55, .45),
      range: 2.1,
      label: () => (this.cardUsed ? 'Card reader — accepted' : 'Use the card reader'),
      sub: () => (this.cardUsed ? '' : 'E — present access card'),
      onInteract: () => {
        if (this.cardUsed) return;
        if (!this.game.hasItem('keycard')) {
          this.game.audio.play('locked', { volume: .3 });
          this.game.ui.showHint('The slot is dark. It wants a service card.', 3.2);
          return;
        }
        this.cardUsed = true;
        lampMat.emissive.set(0x62b78f);
        lampMat.emissiveIntensity = 1.7;
        readerItem.setEnabled(false);
        door.unlock();
        door.open();
        this.game.audio.play('keyGrant', { volume: .3 });
        this.game.ui.showHint('The lock withdraws. Beyond it, the lift lobby breathes cold air.', 4.5);
        this.setCheckpoint(1.0, -5.1, Math.PI);
        this._refreshObjective();
      }
    });

    // Lift recess and call panel.
    addLiftRecess(this, {
      x: 0, z: -9.78, axis: 'x', width: 1.8, height: 2.28,
      label: 'Call the service lift',
      sub: 'E — descend to the pump floor',
      onCall: () => this._takeLift()
    });
    this.addSign({
      x: 0, y: 2.4, z: -9.85, width: .9, height: .24,
      key: 'lift-pump', title: 'PUMP FLOOR', lines: ['SERVICE LIFT 02'], titleSize: 36, glowing: true
    });
    this.addDynamicPointLight(0, 2.2, -8.4, { color: 0x9db6a4, intensity: 1.3, distance: 5, decay: 1.7 });
    this.addBakeLight(0, 2.2, -8.5, { color: 0x8fa89a, intensity: .55, range: 5.5 });

    /* ---------------- Dressing ---------------- */
    this.addPuddle(.4, 16.2, 1.8, 2.7, { opacity: .42 });
    this.addPuddle(-.6, 9.1, 1.5, 1.9, { opacity: .38 });
    this.addPuddle(-1.2, -.8, 2.2, 1.6, { opacity: .3 });
    addWaterSheen(this, 1.2, 1.45, 4.05, 21.8, { y: .006, opacity: .22 });
    this.addDecal('grime', -1.49, 1.45, 18.5, 2.4, 2.2, { ry: Math.PI / 2 });
    this.addDecal('water', 1.0, 2.3, 8.2, 2.6, 1.4, { rx: 0, ry: 0 });
    this.addDecal('mold', -4.98, 1.2, 1.6, 2.1, 1.8, { ry: Math.PI / 2 });
    this.addDecal('foot', .3, .012, 6.8, .7, 1.1, { rx: -Math.PI / 2, ry: .2 });
    this.addDecal('foot', .43, .012, 6.15, .7, 1.1, { rx: -Math.PI / 2, ry: .26 });

    addCagedLamp(this, 1.2, 11.6, 2.42);
    addCagedLamp(this, -4.7, -3.3, 2.76);
    addCeilingLamp(this, 0, 16.6, { y: 2.47, length: 1.5, intensity: 1.05, range: 7.5, flicker: true });
    addCeilingLamp(this, -1.6, -.2, { y: 2.8, length: 1.35, intensity: 1.12, range: 8 });
    addCeilingLamp(this, 2.4, 1.8, { y: 2.8, length: 1.1, intensity: .75, range: 6.5, lit: false });
    this.addBakeLight(-4.2, 2.35, 3.2, { color: 0x8fae9e, intensity: .3, range: 4.5 });

    this.addSoundEmitter(.8, 1.9, 14.4, { sound: 'drip', min: 4, max: 9, volume: .15, maxDistance: 16 });
    this.addSoundEmitter(-2.7, 1.2, 11.8, { sound: 'drip', min: 7, max: 15, volume: .1, maxDistance: 12 });
    this.addSoundEmitter(-1.2, 1.1, -2.2, { sound: 'metalGroan', min: 17, max: 35, volume: .075, rateMin: .38, rateMax: .55, maxDistance: 18 });

    /* ---------------- Objectives & story triggers ---------------- */
    this.objective = { text: 'Follow the service tunnel to the maintenance office.', sub: 'The lift to the pump floor is beyond the security door.' };

    this.addTrigger({
      x0: -5, x1: 5, z0: -4, z1: 4.35, once: true,
      onEnter: () => {
        this.enteredOffice = true;
        this.setCheckpoint(0, 2.4, 0);
        this._refreshObjective();
        this.game.audio.setTension(.12);
      }
    });
    this.addTrigger({
      x0: -2, x1: 2, z0: 6.4, z1: 8.3, once: true,
      onEnter: () => {
        if (this.phoneRang) return;
        this.phoneRang = true;
        this.game.audio.playAt('phoneRing', new THREE.Vector3(-2.7, 1.05, -1.4), { volume: .18, rate: .92 });
        this.game.ui.showHint('A telephone is ringing in the maintenance office. The line has been dead for eight years.', 4.6);
        this.after(1.35, () => {
          if (this.game.state === 'playing') this.game.ui.say('INTERCOM', 'You took your time, Iris.', 3.4);
        });
      }
    });
    this.addTrigger({
      x0: -3, x1: -1.4, z0: 10.1, z1: 13.3, once: true,
      onEnter: () => {
        this.game.audio.play('pickup', { volume: .08, rate: .7 });
        this.game.ui.showHint('Someone has been keeping this article dry.', 2.6);
      }
    });
  }

  addDeskLamp(x, y, z) {
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0x63644f, emissive: 0xffd8a0, emissiveIntensity: 1.35, roughness: .48, side: THREE.DoubleSide
    });
    shadeMat.userData.disposeWithObject = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .34, 7), this.game.materials.get('steelDull'));
    neck.position.set(x + .28, y + .16, z);
    neck.rotation.z = -.35;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(.13, .18, 16, 1, true), shadeMat);
    shade.position.set(x + .36, y + .35, z);
    shade.rotation.z = -.45;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .025, 14), this.game.materials.get('darkMetal'));
    base.position.set(x + .2, y + .012, z);
    this.scene.add(neck, shade, base);
    this.addBakeLight(x + .34, y + .32, z, { color: 0xffca8e, intensity: .8, range: 3.8 });
  }

  enter() {
    super.enter();
    this.setCheckpoint(this.spawn.x, this.spawn.z, this.spawn.yaw);
    this._refreshObjective();
    this.game.audio.setTension(.06);
    this.game.ui.showHint('The flashlight is your only reliable light. F toggles it.', 5.5);
  }

  _refreshObjective() {
    if (this._leaving) return;
    if (this.cardUsed) {
      this.setObjective('Take the service lift to the pump floor.', 'The lobby is open. The station is listening.');
    } else if (this.game.hasItem('keycard')) {
      this.setObjective('Use Wren’s card on the security door reader.', 'The reader is mounted beside the lift lobby door.');
    } else if (this.enteredOffice) {
      this.setObjective('Find Wren’s service access card.', 'Search the maintenance office. The desk lamp is still warm.');
    } else {
      this.setObjective('Follow the service tunnel to the maintenance office.', 'The lift to the pump floor is beyond the security door.');
    }
  }

  _takeLift() {
    if (this._leaving) return;
    this._leaving = true;
    this.game.audio.play('doorClose', { volume: .3, rate: .72 });
    this.game.audio.play('metalGroan', { volume: .18, rate: .5 });
    this.game.ui.showHint('The lift takes your weight without complaint. Somewhere below, water is moving.', 4);
    this.setCheckpoint(0, -7.6, Math.PI);
    this.game.completeChapter(1);
  }
}
