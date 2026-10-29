import {
  addCableTray, addVent, addJunctionBox, addGauge, addValveAssembly, addIBeam,
  addChain, addFloorGrate, addHazardBand, addLadder, addLadderCage,
  addFireExtinguisher, addFirstAidBox, addWallClock, addSecurityCamera,
  addWallLamp, addHoseReel, addBoots, addHardHat, addToolbox, addBottle,
  addCan, addMug, addPallet, addBucket, addDetailedPipe
} from './Detail.js';

/*
 * Chapter-specific set dressing.
 *
 * All of this is non-colliding, static detail. It is deliberately assembled
 * from the shared Detail kit so the silhouette gains pipes, trays, vents,
 * fasteners and clutter without adding interactive geometry or new lights.
 */

function pipeRun(level, points, radius = .04, material = 'steelDull') {
  addDetailedPipe(level, points, {
    radius,
    material,
    radial: 9,
    flangeEvery: 0,
    hangers: 0,
    hangerTop: 0
  });
}

export function dressChapter1(level) {
  // Ceiling services over the flooded approach corridor.
  addCableTray(level, .55, 4.35, .55, 21.5, 2.3, { width: .32 });
  addValveAssembly(level, 1.28, 2.36, 12.1, { axis: 'z', radius: .085, wheelRadius: .2, material: 'pipeGreen' });
  addValveAssembly(level, -1.2, 2.28, 17.2, { axis: 'z', radius: .045, wheelRadius: .15, material: 'steelDull', wheelMaterial: 'pipeRed' });

  // Wall services and ventilation.
  addVent(level, 1.4, 1.86, 7.7, { ry: -Math.PI / 2, width: .52, height: .34 });
  addVent(level, 1.4, 1.92, 17.1, { ry: -Math.PI / 2, width: .48, height: .3 });
  addVent(level, -4.88, 2.2, .2, { ry: Math.PI / 2, width: .62, height: .4 });
  addJunctionBox(level, -1.39, 1.55, 8.8, { ry: Math.PI / 2, width: .3, height: .36 });
  addJunctionBox(level, 1.39, 1.62, 18.6, { ry: -Math.PI / 2, width: .28, height: .34 });
  addJunctionBox(level, -4.86, 1.7, -3.05, { ry: Math.PI / 2, width: .34, height: .42 });
  pipeRun(level, [[-1.38, 2.46, 8.8], [-1.38, 2.46, 5.0]], .022, 'copper');
  pipeRun(level, [[1.38, 2.4, 18.6], [1.38, 2.4, 21.0]], .022, 'copper');

  // Thresholds, drainage and worn hazard paint.
  addHazardBand(level, -1.28, 4.2, 1.28, 4.2, { width: .1, block: .26 });
  addHazardBand(level, -1.3, -3.78, 1.3, -3.78, { width: .1, block: .26 });
  addFloorGrate(level, .95, 7.2, .5, .78, { bars: 6 });
  addFloorGrate(level, .95, 14.8, .5, .78, { bars: 6 });
  addFloorGrate(level, 3.9, -3.1, .52, .8, { bars: 6 });

  // Office fittings.
  addFireExtinguisher(level, -4.82, 1.02, -3.3, { ry: Math.PI / 2 });
  addFirstAidBox(level, 4.92, 1.52, 1.7, { ry: -Math.PI / 2 });
  addWallClock(level, -4.88, 2.27, -1.4, { ry: Math.PI / 2 });
  addLadder(level, 4.88, -2.85, .02, 2.52, { ry: -Math.PI / 2, width: .42 });
  addWallLamp(level, 4.9, 2.18, 3.25, { ry: -Math.PI / 2 });
  addToolbox(level, 2.15, .9, 1.5, { ry: .08 });
  addHardHat(level, -4.58, 1.27, -3.18, { material: 'warningYellow' });
  addBoots(level, -4.33, 2.3, { ry: .35 });
  addCan(level, 1.72, .012, 2.0, { material: 'steelDull' });
  addBottle(level, -3.55, .86, -1.12, { height: .18, radius: .026, ry: .3 });
  addPallet(level, 3.85, .85, { rotation: .14 });
  addChain(level, -.72, 2.48, 10.9, .78, { links: 7 });
}

export function dressChapter2(level) {
  // Overhead cable trays and valves make the tall pump hall legible.
  addCableTray(level, -8.68, -8.75, -8.68, 8.75, 3.36, { width: .4 });
  addCableTray(level, 8.68, -8.75, 8.68, 8.75, 3.28, { width: .34 });
  addValveAssembly(level, -8.6, 3.5, -1.4, { axis: 'z', radius: .17, wheelRadius: .26, material: 'pipeRust', wheelMaterial: 'pipeRed' });
  addValveAssembly(level, 8.5, 3.1, 3.2, { axis: 'z', radius: .11, wheelRadius: .2, material: 'pipeGreen' });
  addValveAssembly(level, -.1, 3.95, -4.5, { axis: 'x', radius: .23, wheelRadius: .3, material: 'rust' });

  // Ventilation, electrical cabinets and wall services.
  addVent(level, -4.2, 2.55, -8.93, { width: .7, height: .46, ry: 0 });
  addVent(level, 4.1, 2.5, 8.93, { width: .62, height: .4, ry: Math.PI });
  addVent(level, -8.93, 2.2, 3.1, { width: .6, height: .38, ry: Math.PI / 2 });
  addJunctionBox(level, -8.9, 1.62, -1.0, { ry: Math.PI / 2, width: .4, height: .5 });
  addJunctionBox(level, 8.9, 1.58, -4.0, { ry: -Math.PI / 2, width: .36, height: .45 });
  addJunctionBox(level, -4.7, 1.68, -14.86, { width: .3, height: .38, ry: 0 });

  // Structure.
  addIBeam(level, -8.72, 6.8, 4.35);
  addIBeam(level, 8.72, -6.7, 4.35);
  addLadder(level, -8.74, -7.35, .02, 4.05, { ry: Math.PI / 2, width: .46 });
  addLadderCage(level, -8.74, -7.35, .02, 4.05, { ry: Math.PI / 2, width: .7 });

  // Floor plate, drains and painted bay boundaries.
  addHazardBand(level, -7.7, 8.4, 7.7, 8.4, { width: .12, block: .3 });
  addHazardBand(level, -7.7, -8.4, 7.7, -8.4, { width: .12, block: .3 });
  addFloorGrate(level, 0, -7.2, .85, 1.1, { bars: 9 });
  addFloorGrate(level, 0, 5.8, .85, 1.1, { bars: 9 });
  addFloorGrate(level, 6.4, 3.1, .55, .8, { bars: 6 });

  // Work and safety clutter.
  addFireExtinguisher(level, -3.3, 1.08, -8.8, { ry: 0 });
  addFirstAidBox(level, -8.88, 1.58, -4.35, { ry: Math.PI / 2 });
  addHoseReel(level, 8.88, 1.45, 3.4, { ry: -Math.PI / 2 });
  addSecurityCamera(level, 8.63, 3.22, -8.55, { ry: 2.35, facing: 1 });
  addWallClock(level, -4.92, 2.27, -12.1, { ry: Math.PI / 2 });
  addToolbox(level, -7.9, .91, 4.75, { ry: -.12 });
  addHardHat(level, -7.25, .965, 4.95, { material: 'warningYellow' });
  addBoots(level, -3.78, -8.2, { ry: .2 });
  addPallet(level, 7.55, -2.0, { rotation: Math.PI / 2 });
  addBucket(level, 6.9, 5.2, { material: 'steelDull' });
  addBottle(level, -2.2, .86, -13.45, { height: .2, radius: .03, ry: -.2 });
  addMug(level, -4.05, .92, -14.48);
  addChain(level, 5.8, 4.2, -7.7, 1.25, { links: 10 });
}

export function dressChapter3(level) {
  // Corridor conduit, tray, vents and service boxes.
  addCableTray(level, -1.12, 6.5, -1.12, -14.6, 2.3, { width: .28 });
  addDetailedPipe(level, [[1.34, 1.56, -6.15], [1.34, 2.68, -6.15]], {
    radius: .024, material: 'steelDull', radial: 8, flangeEvery: 0, hangers: 0, hangerTop: 0
  });
  addVent(level, 1.39, 1.8, .6, { ry: -Math.PI / 2, width: .5, height: .32 });
  addVent(level, 1.39, 1.75, -11.9, { ry: -Math.PI / 2, width: .54, height: .34 });
  addVent(level, -1.39, 1.82, 4.1, { ry: Math.PI / 2, width: .46, height: .3 });
  addVent(level, 3.2, 2.36, -8.43, { ry: 0, width: .62, height: .38 });
  addJunctionBox(level, 1.4, 1.55, 2.9, { ry: -Math.PI / 2, width: .3, height: .36 });
  addJunctionBox(level, -1.4, 1.62, -7.35, { ry: Math.PI / 2, width: .32, height: .4 });
  addJunctionBox(level, 6.9, 1.65, -8.37, { ry: 0, width: .34, height: .42 });

  addHazardBand(level, -1.3, -4.9, 1.3, -4.9, { width: .1, block: .26 });
  addHazardBand(level, -1.3, 6.65, 1.3, 6.65, { width: .1, block: .26 });
  addHazardBand(level, -1.45, -15.12, 1.45, -15.12, { width: .1, block: .28 });
  addFloorGrate(level, .92, 5.4, .46, .72, { bars: 6 });
  addFloorGrate(level, .92, -3.2, .46, .72, { bars: 6 });
  addFloorGrate(level, -3.1, -19.4, .55, .8, { bars: 6 });

  // Office and substation fittings.
  addFireExtinguisher(level, 1.31, 1.06, -7.4, { ry: -Math.PI / 2 });
  addFirstAidBox(level, 7.4, 1.52, -4.35, { ry: -Math.PI / 2 });
  addWallClock(level, 5.9, 2.27, -8.38, { ry: 0 });
  addSecurityCamera(level, 1.28, 2.48, -13.1, { ry: -.15, facing: 1 });
  addLadder(level, -1.31, -13.9, .02, 2.55, { ry: Math.PI / 2, width: .42 });
  addWallLamp(level, -1.33, 2.16, 1.4, { ry: Math.PI / 2 });
  addToolbox(level, 5.55, .9, -6.75, { ry: .12 });
  addHardHat(level, 4.27, 1.05, -2.42, { material: 'warningYellow' });
  addBoots(level, -1.0, 2.28, { ry: .3 });
  addPallet(level, 2.75, -3.0, { rotation: Math.PI / 2 });
  addBucket(level, 6.85, -2.9, { material: 'steelDull' });
  addBottle(level, 4.55, .91, -6.6, { height: .2, radius: .03, ry: -.25 });
  addCan(level, 1.1, .012, -8.9, { material: 'steelDull' });
  addGauge(level, -.7, 1.82, -21.53, { ry: 0, radius: .06 });
  addGauge(level, .72, 1.82, -21.53, { ry: 0, radius: .06 });
  addChain(level, -1.22, 2.3, -10.6, 1.1, { links: 9 });
}

export function dressChapter4(level) {
  // A corridor that is half service tunnel, half memory.
  addCableTray(level, -1.3, 14.6, -1.3, 2.2, 2.72, { width: .28 });
  addDetailedPipe(level, [[1.35, 1.5, 13.2], [1.35, 2.72, 13.2]], {
    radius: .023, material: 'steelDull', radial: 8, flangeEvery: 0, hangers: 0, hangerTop: 0
  });
  addVent(level, 1.55, 1.85, 10.5, { ry: -Math.PI / 2, width: .44, height: .3 });
  addVent(level, -1.55, 1.8, 5.0, { ry: Math.PI / 2, width: .44, height: .3 });
  addJunctionBox(level, 1.56, 1.62, 6.6, { ry: -Math.PI / 2, width: .3, height: .36 });
  addJunctionBox(level, -1.56, 1.6, 12.1, { ry: Math.PI / 2, width: .3, height: .36 });
  addWallLamp(level, 1.56, 2.25, 8.1, { ry: -Math.PI / 2 });
  addWallLamp(level, -1.56, 2.25, 4.2, { ry: Math.PI / 2 });

  // Gallery-scale services and structure.
  addCableTray(level, -8.7, 1.2, -8.7, -10.6, 4.15, { width: .42 });
  addCableTray(level, 8.7, 1.2, 8.7, -10.6, 4.08, { width: .36 });
  addIBeam(level, -8.72, 0.2, 5.35);
  addIBeam(level, 8.72, -0.2, 5.35);
  addIBeam(level, -8.72, -9.4, 5.35);
  addIBeam(level, 8.72, -9.4, 5.35);
  addVent(level, -8.92, 2.8, -4.4, { ry: Math.PI / 2, width: .76, height: .5 });
  addVent(level, 8.92, 2.8, -6.2, { ry: -Math.PI / 2, width: .76, height: .5 });
  addJunctionBox(level, -8.9, 1.72, -7.4, { ry: Math.PI / 2, width: .44, height: .55 });
  addJunctionBox(level, 8.9, 1.72, 1.1, { ry: -Math.PI / 2, width: .44, height: .55 });
  addFloorGrate(level, -3.05, -1.7, .6, .9, { bars: 7 });
  addFloorGrate(level, 3.05, -7.0, .6, .9, { bars: 7 });
  addHazardBand(level, -2.35, 1.9, 2.35, 1.9, { width: .1, block: .27 });
  addHazardBand(level, -3.9, -8.8, 3.9, -8.8, { width: .1, block: .3 });

  // Hanging chains and service clutter around the array.
  for (const [x, z, len] of [[-3.7, -5.2, 2.1], [3.8, -6.0, 2.7], [-5.2, -8.4, 1.5], [5.4, -3.4, 1.8]]) {
    addChain(level, x, 5.28, z, len, { links: Math.max(5, Math.floor(len / .13)) });
  }
  addFireExtinguisher(level, 8.86, 1.06, -2.7, { ry: -Math.PI / 2 });
  addFirstAidBox(level, -8.86, 1.52, -2.2, { ry: Math.PI / 2 });
  addHoseReel(level, -8.86, 1.45, -9.0, { ry: Math.PI / 2 });
  addSecurityCamera(level, 8.55, 4.3, -10.4, { ry: 2.55, facing: 1 });
  addWallClock(level, 8.87, 2.28, -7.8, { ry: -Math.PI / 2 });
  addPallet(level, -7.55, -.2, { rotation: Math.PI / 2 });
  addToolbox(level, -4.2, .012, -6.3, { ry: -.05 });
  addHardHat(level, 4.55, .012, -4.0, { material: 'warningYellow' });
  addBoots(level, 5.1, -2.6, { ry: .22 });
  addBottle(level, 5.35, 1.15, -2.7, { height: .22, radius: .032, ry: .1 });
  addCan(level, -6.8, .012, -7.8, { material: 'steelDull' });
  addBucket(level, 6.3, 1.0, { material: 'steelDull' });
}
