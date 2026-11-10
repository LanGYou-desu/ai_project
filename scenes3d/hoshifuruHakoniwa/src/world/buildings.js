import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  addMesh,
  addBox,
  addCylinder,
  addSphere,
  addWire,
  lineBetween,
  randRange,
  mulberry32,
  clamp,
  TAU
} from '../utils.js';
import { makeSignTexture, makeBannerTexture } from '../textures.js';

function makeRounded(w, h, d, r = 0.08) {
  return new RoundedBoxGeometry(w, h, d, 3, r);
}

function addGlowSprite(parent, lib, x, y, z, scale = 1) {
  const sprite = new THREE.Sprite(lib.glowMaterial);
  sprite.position.set(x, y, z);
  sprite.scale.setScalar(scale);
  parent.add(sprite);
  return sprite;
}

function addWindow(parent, lib, x, y, z, options = {}) {
  const width = options.width || 0.58;
  const height = options.height || 0.86;
  const rotationY = options.rotationY || 0;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  parent.add(group);

  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), lib.windowMaterial);
  pane.position.z = 0.025;
  group.add(pane);

  const frameMat = lib.woodDark;
  addBox(group, width + 0.15, 0.07, 0.08, frameMat, 0, height / 2 + 0.025, 0.055, 0.02);
  addBox(group, width + 0.15, 0.07, 0.08, frameMat, 0, -height / 2 - 0.025, 0.055, 0.02);
  addBox(group, 0.07, height + 0.14, 0.08, frameMat, -width / 2 - 0.03, 0, 0.055, 0.02);
  addBox(group, 0.07, height + 0.14, 0.08, frameMat, width / 2 + 0.03, 0, 0.055, 0.02);
  addBox(group, width + 0.28, 0.08, 0.26, lib.woodLight, 0, -height / 2 - 0.11, 0.1, 0.025);

  if (options.shutters !== false) {
    const shutterH = height * 0.98;
    const shutterW = width * 0.3;
    for (const side of [-1, 1]) {
      const shutter = new THREE.Group();
      shutter.position.set(side * (width / 2 + shutterW / 2 + 0.08), 0, 0.055);
      group.add(shutter);
      const board = addBox(shutter, shutterW, shutterH, 0.045, lib.woodMid, 0, 0, 0, 0.015);
      board.rotation.y = 0;
      for (let i = 0; i < 3; i++) {
        addBox(shutter, shutterW * 0.82, 0.035, 0.06, lib.woodDark, 0, -shutterH * 0.28 + i * shutterH * 0.28, 0.04, 0.01);
      }
      const hinge = addBox(shutter, 0.07, 0.1, 0.07, lib.blackIron, side * -shutterW * 0.18, shutterH * 0.25, 0.045, 0.01);
    }
    addBox(group, width + 0.16, 0.085, 0.11, lib.woodLight, 0, height / 2 + 0.08, 0.05, 0.02);
  }

  if (options.flowerBox !== false) {
    const planter = addBox(group, width + 0.2, 0.18, 0.2, lib.woodMid, 0, -height / 2 - 0.19, 0.17, 0.03);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 + (i % 2) * 0.03, 0), lib.leafMaterials[1 + (i % 3)]);
      leaf.position.set(-width * 0.32 + i * width * 0.21, -height / 2 - 0.08, 0.22 + (i % 2) * 0.04);
      group.add(leaf);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), lib.flowerMaterials[i % lib.flowerMaterials.length]);
      flower.position.set(leaf.position.x + 0.03, leaf.position.y + 0.11, leaf.position.z + 0.05);
      group.add(flower);
    }
  }
  return group;
}

function addDoor(parent, lib, x, y, z, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = options.rotationY || 0;
  parent.add(group);
  const width = options.width || 0.82;
  const height = options.height || 1.45;
  addBox(group, width + 0.18, height + 0.22, 0.12, lib.woodDark, 0, height / 2, 0, 0.03);
  addBox(group, width, height, 0.08, lib.doorWood, 0, height / 2 + 0.02, 0.075, 0.04);
  const panelMat = lib.woodMid;
  addBox(group, width * 0.64, height * 0.3, 0.045, panelMat, 0, height * 0.32, 0.13, 0.02);
  addBox(group, width * 0.64, height * 0.28, 0.045, panelMat, 0, height * 0.64, 0.13, 0.02);
  addSphere(group, 0.045, lib.brass, width * 0.32, height * 0.48, 0.15, 8, 6, false);
  addBox(group, width + 0.32, 0.09, 0.3, lib.stoneLight, 0, 0.045, 0.12, 0.025);
  addBox(group, 0.1, 0.38, 0.1, lib.blackIron, -width / 2 - 0.16, height * 0.85, 0.04, 0.01);
  addBox(group, 0.28, 0.07, 0.26, lib.blackIron, -width / 2 - 0.12, height * 1.02, 0.04, 0.01);
  const lamp = addBox(group, 0.22, 0.3, 0.22, lib.lampMaterial, -width / 2 - 0.12, height * 0.78, 0.04, 0.03);
  addBox(group, 0.28, 0.08, 0.28, lib.blackIron, lamp.position.x, lamp.position.y + 0.18, lamp.position.z, 0.01);
  addGlowSprite(group, lib, lamp.position.x, lamp.position.y, lamp.position.z + 0.13, 0.72);
  return group;
}

function addBalcony(parent, lib, width, y, z) {
  const group = new THREE.Group();
  group.position.set(0, y, z);
  parent.add(group);
  addBox(group, width, 0.13, 0.82, lib.woodMid, 0, 0, 0.28, 0.03);
  addBox(group, width + 0.16, 0.09, 0.9, lib.woodDark, 0, -0.09, 0.28, 0.02);
  const railZ = 0.67;
  addBox(group, width, 0.07, 0.07, lib.woodDark, 0, 0.58, railZ, 0.01);
  addBox(group, width, 0.05, 0.06, lib.woodDark, 0, 0.28, railZ, 0.01);
  const count = Math.max(5, Math.floor(width / 0.22));
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + 0.1 + (i / (count - 1)) * (width - 0.2);
    addBox(group, 0.055, 0.58, 0.055, lib.woodDark, x, 0.29, railZ, 0.01);
  }
  for (const side of [-1, 1]) {
    addBox(group, 0.08, 0.62, 0.75, lib.woodDark, side * width / 2, 0.29, 0.29, 0.01);
  }
  for (const side of [-1, 1]) {
    const pot = addCylinder(group, 0.14, 0.1, 0.2, 8, lib.terracotta || lib.walls.clay, side * width * 0.31, 0.15, 0.53);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), lib.leafMaterials[2]);
    bush.position.set(side * width * 0.31, 0.31, 0.53);
    group.add(bush);
    for (let f = 0; f < 2; f++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), lib.flowerMaterials[(f + 1) % lib.flowerMaterials.length]);
      flower.position.set(bush.position.x + (f ? 0.08 : -0.06), 0.36 + f * 0.03, 0.58);
      group.add(flower);
    }
  }
  return group;
}

function addFlowerBoxToRail(parent, lib, x, y, z) {
  addBox(parent, 0.8, 0.16, 0.2, lib.woodMid, x, y, z, 0.025);
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), lib.leafMaterials[i % 3]);
    leaf.position.set(x - 0.27 + i * 0.18, y + 0.12, z + 0.02);
    parent.add(leaf);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), lib.flowerMaterials[i % lib.flowerMaterials.length]);
    fl.position.set(leaf.position.x, y + 0.23, z + 0.05);
    parent.add(fl);
  }
}

function addChimney(parent, lib, x, z, baseY, height, smokeAnchors) {
  const group = new THREE.Group();
  group.position.set(x, baseY, z);
  parent.add(group);
  addBox(group, 0.48, height, 0.5, lib.stone, 0, height / 2, 0, 0.04);
  addBox(group, 0.64, 0.12, 0.66, lib.stoneDark, 0, height + 0.04, 0, 0.02);
  addBox(group, 0.24, 0.22, 0.24, lib.blackIron, 0, height + 0.17, 0, 0.02);
  const anchor = new THREE.Object3D();
  anchor.position.set(0, height + 0.35, 0);
  group.add(anchor);
  if (smokeAnchors) smokeAnchors.push(anchor);
  return group;
}

function buildRoofRidgeZ(lib, width, depth, rise, roofMat, gableMat) {
  const group = new THREE.Group();
  const overhang = 0.46;
  const half = width / 2 + overhang;
  const angle = Math.atan2(rise, width / 2);
  const slopeLen = Math.sqrt(half * half + rise * rise) + 0.08;
  const zLen = depth + overhang * 2;
  const left = addBox(group, slopeLen, 0.12, zLen, roofMat, -half / 2, rise / 2 + 0.03, 0, 0.02);
  left.rotation.z = angle;
  const right = addBox(group, slopeLen, 0.12, zLen, roofMat, half / 2, rise / 2 + 0.03, 0, 0.02);
  right.rotation.z = -angle;
  const ridge = addCylinder(group, 0.1, 0.1, zLen + 0.05, 8, lib.roofs.rust || roofMat, 0, rise + 0.07, 0);
  ridge.rotation.x = Math.PI / 2;
  addBox(group, width + 0.55, 0.07, 0.12, lib.woodDark, 0, 0.01, depth / 2 + overhang - 0.02, 0.015);
  addBox(group, width + 0.55, 0.07, 0.12, lib.woodDark, 0, 0.01, -depth / 2 - overhang + 0.02, 0.015);
  const gableGeo = new THREE.BufferGeometry();
  const zFront = depth / 2 + 0.006;
  const zBack = -depth / 2 - 0.006;
  const verts = new Float32Array([
    -width / 2, 0, zFront, width / 2, 0, zFront, 0, rise, zFront,
    width / 2, 0, zBack, -width / 2, 0, zBack, 0, rise, zBack
  ]);
  gableGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  gableGeo.setIndex([0, 1, 2, 3, 4, 5]);
  gableGeo.computeVertexNormals();
  const gableMaterial = gableMat.clone();
  gableMaterial.side = THREE.DoubleSide;
  const gables = new THREE.Mesh(gableGeo, gableMaterial);
  gables.castShadow = true;
  gables.receiveShadow = true;
  group.add(gables);
  // slim bargeboards framing the gables
  for (const z of [zFront + 0.02, zBack - 0.02]) {
    const leftBoard = addBox(group, Math.sqrt(Math.pow(width / 2, 2) + rise * rise) + 0.14, 0.09, 0.1, lib.woodDark, -width / 4, rise / 2, z, 0.012);
    leftBoard.rotation.z = Math.atan2(rise, width / 2);
    const rightBoard = addBox(group, Math.sqrt(Math.pow(width / 2, 2) + rise * rise) + 0.14, 0.09, 0.1, lib.woodDark, width / 4, rise / 2, z, 0.012);
    rightBoard.rotation.z = -Math.atan2(rise, width / 2);
  }
  return { group, topY: rise + 0.07 };
}

function addGableRoof(parent, lib, width, depth, rise, roofMat, gableMat, ridgeAxis = 'x') {
  let roof;
  if (ridgeAxis === 'x') {
    roof = buildRoofRidgeZ(lib, depth, width, rise, roofMat, gableMat);
    roof.group.rotation.y = Math.PI / 2;
  } else {
    roof = buildRoofRidgeZ(lib, width, depth, rise, roofMat, gableMat);
  }
  parent.add(roof.group);
  return roof;
}

function addWeatherVane(parent, lib, x, y, z) {
  addCylinder(parent, 0.025, 0.035, 0.8, 6, lib.blackIron, x, y + 0.4, z);
  const arrow = new THREE.Group();
  arrow.position.set(x, y + 0.8, z);
  addBox(arrow, 0.55, 0.025, 0.025, lib.brass, 0, 0, 0, 0.01);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), lib.brass);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.3;
  arrow.add(tip);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), lib.brass);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.3;
  arrow.add(tail);
  parent.add(arrow);
}

function addHangingSign(parent, lib, x, y, z, text, options = {}) {
  const width = options.width || 1.22;
  const height = options.height || 0.42;
  const texture = makeSignTexture(text, options.background || '#304136', options.foreground || '#f1e3c7', options.border || '#c8a76a');
  addBox(parent, 0.07, 0.08, 0.08, lib.blackIron, x - width * 0.4, y + 0.2, z, 0.015);
  addBox(parent, 0.07, 0.08, 0.6, lib.blackIron, x - width * 0.4, y + 0.2, z + 0.25, 0.015);
  addBox(parent, 0.04, 0.45, 0.04, lib.blackIron, x - width * 0.4, y, z + 0.48, 0.01);
  const boardMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82 });
  const board = addBox(parent, width, height, 0.075, boardMat, x, y - 0.1, z + 0.48, 0.025);
  const frame = addBox(parent, width + 0.08, height + 0.08, 0.045, lib.woodDark, x, y - 0.1, z + 0.44, 0.02);
  frame.renderOrder = 0;
  return board;
}

function addShopFront(parent, lib, width, depth, wallStart, doorX, shopName, awningName = 'cream') {
  const z = depth / 2;
  const y = wallStart + 0.91;
  const pane = addBox(parent, width * 0.64, 1.08, 0.055, lib.windowMaterial, -width * 0.08, y, z + 0.07, 0.03);
  addBox(parent, width * 0.7, 0.08, 0.12, lib.woodDark, -width * 0.08, y + 0.61, z + 0.1, 0.02);
  addBox(parent, width * 0.7, 0.08, 0.12, lib.woodDark, -width * 0.08, y - 0.6, z + 0.1, 0.02);
  addBox(parent, 0.08, 1.16, 0.1, lib.woodDark, -width * 0.4, y, z + 0.1, 0.02);
  addBox(parent, 0.08, 1.16, 0.1, lib.woodDark, width * 0.24, y, z + 0.1, 0.02);
  // display shelves and a few tiny wares
  for (let i = 0; i < 3; i++) {
    addBox(parent, width * 0.15, 0.035, 0.12, lib.woodLight, -width * 0.29 + i * width * 0.21, y - 0.24, z + 0.17, 0.008);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.15, 7), lib.flowerMaterials[i % lib.flowerMaterials.length]);
    jar.position.set(-width * 0.29 + i * width * 0.21, y - 0.15, z + 0.2);
    parent.add(jar);
  }
  const awningMat = lib.awningMaterials[awningName] || lib.awningMaterials.cream;
  const awning = addBox(parent, width * 0.9, 0.055, 1.14, awningMat, -width * 0.08, y + 1.2, z + 0.53, 0.03);
  awning.rotation.x = -0.16;
  addBox(parent, width * 0.9, 0.22, 0.045, awningMat, -width * 0.08, y + 1.04, z + 1.06, 0.02);
  for (const side of [-1, 1]) {
    addBox(parent, 0.05, 1.0, 1.02, lib.woodDark, -width * 0.08 + side * width * 0.45, y + 0.55, z + 0.55, 0.01);
  }
  // shop sign above the awning
  const texture = makeSignTexture(shopName || '小铺', '#35423a', '#f5e8d0', '#cbaa6d');
  const signMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
  addBox(parent, width * 0.55, 0.42, 0.07, signMat, -width * 0.08, y + 1.6, z + 0.13, 0.025);
  addHangingSign(parent, lib, width * 0.36, y + 1.24, z + 0.1, '', { width: 0.45, height: 0.35 });
  return pane;
}

function addCrate(parent, lib, x, y, z, scale = 1, rotation = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotation;
  parent.add(g);
  addBox(g, 0.45 * scale, 0.35 * scale, 0.45 * scale, lib.woodLight, 0, 0.175 * scale, 0, 0.025);
  for (const side of [-1, 1]) {
    addBox(g, 0.47 * scale, 0.06 * scale, 0.06 * scale, lib.woodDark, 0, 0.23 * scale, side * 0.21 * scale, 0.005);
  }
  return g;
}

export function createHouse(lib, options = {}, anchors = null) {
  const group = new THREE.Group();
  const rng = mulberry32(options.seed || 7);
  const width = options.width || 4.0;
  const depth = options.depth || 3.2;
  const floors = options.floors || 2;
  const floorHeight = options.floorHeight || 1.38;
  const ridgeAxis = options.ridgeAxis || 'x';
  const wallMat = options.wallMat || lib.walls.cream;
  const roofMat = options.roofMat || lib.roofs.terracotta;
  const roofRise = options.roofRise || Math.min(2.4, Math.max(1.25, (ridgeAxis === 'x' ? depth : width) * 0.55));
  const wallStart = 0.38;

  const foundation = addBox(group, width + 0.24, 1.08, depth + 0.24, lib.stone, 0, -0.18, 0, 0.06);
  foundation.castShadow = true;
  const step = addBox(group, width * 0.5, 0.13, 0.7, lib.stoneLight, 0, 0.19, depth / 2 + 0.23, 0.03);
  step.receiveShadow = true;

  for (let f = 0; f < floors; f++) {
    const overhang = f > 0 ? 0.16 : 0;
    const fw = width + overhang;
    const fd = depth + overhang;
    const y = wallStart + f * floorHeight + floorHeight / 2;
    addBox(group, fw, floorHeight, fd, wallMat, 0, y, 0, 0.065);
    addBox(group, fw + 0.09, 0.08, fd + 0.09, lib.woodDark, 0, wallStart + f * floorHeight + 0.02, 0, 0.02);
    // horizontal plaster seam
    if (f > 0) {
      addBox(group, fw + 0.08, 0.04, fd + 0.08, lib.woodMid, 0, wallStart + f * floorHeight + floorHeight - 0.03, 0, 0.01);
    }
  }
  const wallTop = wallStart + floors * floorHeight;

  // Timber-frame accents.
  if (options.timber !== false) {
    const beam = lib.woodDark;
    for (const side of [-1, 1]) {
      addBox(group, 0.1, wallTop - wallStart + 0.04, 0.12, beam, side * (width / 2 - 0.06), wallStart + (wallTop - wallStart) / 2, depth / 2 + 0.045, 0.01);
      addBox(group, 0.1, wallTop - wallStart + 0.04, 0.12, beam, side * (width / 2 - 0.06), wallStart + (wallTop - wallStart) / 2, -depth / 2 - 0.045, 0.01);
      addBox(group, 0.12, wallTop - wallStart + 0.04, 0.1, beam, width / 2 + 0.045, wallStart + (wallTop - wallStart) / 2, side * (depth / 2 - 0.06), 0.01);
      addBox(group, 0.12, wallTop - wallStart + 0.04, 0.1, beam, -width / 2 - 0.045, wallStart + (wallTop - wallStart) / 2, side * (depth / 2 - 0.06), 0.01);
    }
    addBox(group, width + 0.16, 0.11, 0.1, beam, 0, wallStart + 0.14, depth / 2 + 0.05, 0.01);
    addBox(group, width + 0.16, 0.1, 0.1, beam, 0, wallTop - 0.04, depth / 2 + 0.05, 0.01);
    const braceLen = 0.75;
    for (const side of [-1, 1]) {
      const brace = addBox(group, braceLen, 0.07, 0.075, beam, side * (width / 2 - 0.3), wallTop - floorHeight * 0.55, depth / 2 + 0.055, 0.012);
      brace.rotation.z = side * 0.7;
    }
    if (floors > 1) {
      const leftBrace = addBox(group, braceLen, 0.07, 0.07, beam, -width / 2 + 0.6, wallStart + floorHeight + 0.55, depth / 2 + 0.06, 0.012);
      leftBrace.rotation.z = -0.65;
    }
  }

  // Windows across front and side; shop windows replace the lower front.
  const upperShift = floors > 1 ? floorHeight : 0;
  const windowY = wallStart + floorHeight * (floors - 1) + floorHeight * 0.58;
  const positions = floors > 1 ? [-width * 0.27, width * 0.27] : [0];
  positions.forEach((wx, i) => {
    addWindow(group, lib, wx, windowY, depth / 2 + 0.062, {
      width: 0.58,
      height: 0.88,
      flowerBox: i % 2 === 0,
      rotationY: 0
    });
  });
  if (floors > 2) {
    addWindow(group, lib, -width * 0.26, wallStart + floorHeight * 0.58, depth / 2 + 0.062, { width: 0.54, height: 0.76, flowerBox: false });
    addWindow(group, lib, width * 0.26, wallStart + floorHeight * 0.58, depth / 2 + 0.062, { width: 0.54, height: 0.76, flowerBox: false });
  }
  for (const side of [-1, 1]) {
    for (let f = 0; f < floors; f++) {
      const zOff = f % 2 === 0 ? depth * 0.18 : -depth * 0.16;
      addWindow(group, lib, side * (width / 2 + 0.07 + (f > 0 ? 0.08 : 0)), wallStart + f * floorHeight + floorHeight * 0.58, zOff, {
        width: 0.46,
        height: 0.72,
        rotationY: side > 0 ? Math.PI / 2 : -Math.PI / 2,
        flowerBox: f === floors - 1,
        shutters: true
      });
    }
  }
  // Side-wall braces and a small wall lantern help break up broad plaster surfaces.
  for (const side of [-1, 1]) {
    const brace = addBox(group, 0.07, 0.66, 0.07, lib.woodDark, side * (width / 2 + 0.045), wallStart + floorHeight * 0.52, depth * 0.31, 0.012);
    brace.rotation.x = side * 0.55;
    addBox(group, 0.11, 0.2, 0.11, lib.blackIron, side * (width / 2 + 0.12), wallStart + 1.55, -depth * 0.36, 0.01);
    addBox(group, 0.15, 0.22, 0.15, lib.lampMaterial, side * (width / 2 + 0.18), wallStart + 1.44, -depth * 0.36, 0.02);
    const glow = new THREE.Sprite(lib.glowMaterial);
    glow.position.set(side * (width / 2 + 0.22), wallStart + 1.44, -depth * 0.36);
    glow.scale.setScalar(0.62);
    group.add(glow);
  }

  if (options.shop) {
    addShopFront(group, lib, width, depth, wallStart, 0, options.shopName, options.awning || 'cream');
    addDoor(group, lib, width * 0.35, wallStart, depth / 2 + 0.075, { rotationY: 0 });
  } else {
    addDoor(group, lib, options.doorOffset !== undefined ? options.doorOffset : -width * 0.24, wallStart, depth / 2 + 0.075, { rotationY: 0 });
    if (floors > 1) {
      addBox(group, width * 0.58, 0.16, 0.85, lib.woodMid, 0, wallStart + floorHeight + 0.04, depth / 2 + 0.38, 0.025);
    }
  }

  if (options.balcony && floors > 1) {
    addBalcony(group, lib, width * 0.72, wallStart + floorHeight * (floors - 1) + 0.12, depth / 2 + 0.16);
    addFlowerBoxToRail(group, lib, 0, wallStart + floorHeight * (floors - 1) + 0.73, depth / 2 + 0.85);
  }

  if (options.turret) {
    const tx = width / 2 - 0.1;
    const tz = depth * 0.26;
    addCylinder(group, 0.58, 0.7, wallTop - 0.2, 10, wallMat, tx, wallTop / 2 + 0.2, tz);
    for (let i = 0; i < 3; i++) {
      addBox(group, 0.08, 0.18, 0.1, lib.woodDark, tx, wallTop - 0.3 - i * 0.42, tz + 0.63, 0.01);
    }
    addWindow(group, lib, tx + 0.55, wallTop - 0.4, tz, { width: 0.36, height: 0.6, rotationY: -Math.PI / 2, shutters: false, flowerBox: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.65, 10), roofMat);
    cone.position.set(tx, wallTop + 0.68, tz);
    cone.castShadow = true;
    group.add(cone);
    addSphere(group, 0.08, lib.brass, tx, wallTop + 1.55, tz, 8, 6, false);
  }

  const roof = addGableRoof(group, lib, width + (floors > 1 ? 0.3 : 0), depth + (floors > 1 ? 0.3 : 0), roofRise, roofMat, wallMat, ridgeAxis);
  const roofTopLocal = wallTop + roof.topY;

  if (options.chimney !== false) {
    const chimneyX = width * (0.16 + rng() * 0.18);
    const chimneyZ = -depth * (0.1 + rng() * 0.3);
    addChimney(group, lib, chimneyX, chimneyZ, wallTop + 0.32, 1.25, anchors ? anchors.smokeAnchors : null);
  }

  if (options.weatherVane) {
    addWeatherVane(group, lib, 0, roofTopLocal - 0.04, -depth * 0.2);
  }

  if (options.hangingSign) {
    addHangingSign(group, lib, -width * 0.34, wallStart + 1.92, depth / 2 + 0.1, options.hangingSign, {
      background: options.signBackground || '#344538',
      foreground: '#f2e7ce'
    });
  }

  // Climbing vines and pots at ground level.
  for (let i = 0; i < 9; i++) {
    const vine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11 + rng() * 0.08, 0), lib.leafMaterials[1 + (i % 3)]);
    vine.position.set(-width * 0.46 + rng() * 0.18, wallStart + 0.3 + i * 0.28, depth / 2 + 0.1);
    group.add(vine);
    if (rng() > 0.55) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(0.034, 5, 4), lib.flowerMaterials[i % lib.flowerMaterials.length]);
      berry.position.copy(vine.position).add(new THREE.Vector3(0.06, 0.05, 0.08));
      group.add(berry);
    }
  }
  addCrate(group, lib, width / 2 + 0.25, 0.38, depth / 2 + 0.6, 0.8, 0.2);
  addCrate(group, lib, -width / 2 - 0.2, 0.38, depth / 2 + 0.7, 0.6, -0.4);

  group.userData.height = roofTopLocal;
  group.userData.roofTop = roofTopLocal;
  return group;
}

function createClockFace(parent, lib, x, y, z, rotationY, radius, hands) {
  const face = new THREE.Group();
  face.position.set(x, y, z);
  face.rotation.y = rotationY;
  parent.add(face);
  const backing = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, 0.1, 32), lib.stoneLight);
  backing.rotation.x = Math.PI / 2;
  backing.position.z = 0.01;
  face.add(backing);
  const dialMat = new THREE.MeshStandardMaterial({
    map: lib.textures.clock,
    transparent: true,
    roughness: 0.62,
    metalness: 0.05,
    emissive: new THREE.Color('#c7a667'),
    emissiveIntensity: 0.04
  });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), dialMat);
  dial.position.z = 0.08;
  face.add(dial);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.97, 0.055, 8, 48), lib.brass);
  rim.position.z = 0.1;
  face.add(rim);
  const hourPivot = new THREE.Group();
  hourPivot.userData.noMerge = true;
  hourPivot.position.z = 0.13;
  face.add(hourPivot);
  const hourHand = addBox(hourPivot, 0.065, radius * 0.48, 0.035, lib.blackIron, 0, radius * 0.24, 0, 0.012, false, false);
  const minutePivot = new THREE.Group();
  minutePivot.userData.noMerge = true;
  minutePivot.position.z = 0.16;
  face.add(minutePivot);
  const minuteHand = addBox(minutePivot, 0.045, radius * 0.72, 0.03, lib.blackIron, 0, radius * 0.36, 0, 0.01, false, false);
  addSphere(face, radius * 0.08, lib.brass, 0, 0, 0.18, 10, 8, false);
  hands.push({ hour: hourPivot, minute: minutePivot });
  return face;
}

export function createClockTower(lib) {
  const group = new THREE.Group();
  group.name = 'clock-tower';
  const stone = lib.stoneLight;
  const wall = lib.walls.cream;
  // stepped base
  addBox(group, 3.35, 0.24, 3.35, lib.stoneDark, 0, 0.12, 0, 0.06);
  addBox(group, 3.0, 0.22, 3.0, lib.stoneLight, 0, 0.34, 0, 0.05);
  addBox(group, 2.75, 0.32, 2.75, lib.stone, 0, 0.56, 0, 0.05);
  // tower shaft
  addBox(group, 2.28, 5.35, 2.28, wall, 0, 3.38, 0, 0.08);
  for (const x of [-1.08, 1.08]) {
    for (const z of [-1.08, 1.08]) {
      addBox(group, 0.23, 5.42, 0.23, stone, x, 3.34, z, 0.025);
    }
  }
  for (const y of [1.16, 2.7, 4.1, 5.75]) {
    addBox(group, 2.52, 0.12, 2.52, stone, 0, y, 0, 0.025);
  }
  // tall narrow windows
  for (const side of [-1, 1]) {
    for (const y of [1.9, 3.25, 4.68]) {
      addWindow(group, lib, side * 1.16, y, 0.3, {
        width: 0.36,
        height: 0.62,
        rotationY: side * Math.PI / 2,
        shutters: false,
        flowerBox: false
      });
    }
  }
  for (const side of [-1, 1]) {
    addWindow(group, lib, 0.32, 3.15, side * 1.16, {
      width: 0.4,
      height: 0.72,
      rotationY: side > 0 ? 0 : Math.PI,
      shutters: false,
      flowerBox: false
    });
  }
  addDoor(group, lib, 0.45, 0.72, 1.16, { width: 0.84, height: 1.44 });
  addBox(group, 0.58, 0.26, 0.16, lib.stoneLight, -0.52, 1.78, 1.2, 0.02);
  const plaqueTex = makeSignTexture('星落町', '#4a4034', '#e9d8b5', '#b9975d');
  const plaqueMat = new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.82 });
  addBox(group, 1.12, 0.4, 0.08, plaqueMat, -0.18, 1.78, 1.24, 0.025);
  // clock stage
  addBox(group, 2.9, 0.18, 2.9, lib.stone, 0, 6.18, 0, 0.04);
  addBox(group, 2.52, 1.66, 2.52, lib.stoneLight, 0, 7.0, 0, 0.06);
  const hands = [];
  const clockY = 7.11;
  createClockFace(group, lib, 0, clockY, 1.28, 0, 0.84, hands);
  createClockFace(group, lib, 1.28, clockY, 0, Math.PI / 2, 0.84, hands);
  createClockFace(group, lib, 0, clockY, -1.28, Math.PI, 0.84, hands);
  createClockFace(group, lib, -1.28, clockY, 0, -Math.PI / 2, 0.84, hands);
  addBox(group, 3.0, 0.16, 3.0, lib.stone, 0, 7.94, 0, 0.03);
  // belfry
  addBox(group, 2.3, 0.22, 2.3, lib.stoneLight, 0, 8.1, 0, 0.04);
  for (const x of [-0.82, 0.82]) {
    for (const z of [-0.82, 0.82]) {
      addBox(group, 0.17, 1.12, 0.17, lib.stoneLight, x, 8.76, z, 0.02);
    }
  }
  const belfryDark = new THREE.MeshStandardMaterial({ color: '#2f302a', roughness: 0.85 });
  addBox(group, 1.56, 0.82, 1.56, belfryDark, 0, 8.6, 0, 0.02);
  for (const [x, z, rot] of [[0, 0.8, 0], [0.8, 0, Math.PI / 2], [0, -0.8, Math.PI], [-0.8, 0, -Math.PI / 2]]) {
    addBox(group, 1.2, 0.7, 0.06, lib.stoneLight, x, 8.64, z, 0.02).rotation.y = rot;
  }
  addBox(group, 2.2, 0.14, 2.2, lib.stone, 0, 9.36, 0, 0.04);
  const roofMat = lib.roofs.teal;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.2, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 10.48;
  roof.castShadow = true;
  group.add(roof);
  addCylinder(group, 0.035, 0.035, 0.65, 5, lib.brass, 0, 11.78, 0);
  addSphere(group, 0.13, lib.brass, 0, 11.9, 0, 10, 8, false);
  addWeatherVane(group, lib, 0, 11.76, 0);
  // pennant on a slender pole
  addCylinder(group, 0.025, 0.025, 1.8, 5, lib.blackIron, 1.45, 9.85, -0.9);
  const bannerMat = new THREE.MeshStandardMaterial({ map: makeBannerTexture('星', '#a15343', '#f4e6cc'), side: THREE.DoubleSide, roughness: 0.9 });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0, 4, 8), bannerMat);
  banner.position.set(1.72, 10.2, -0.9);
  banner.castShadow = true;
  group.add(banner);
  // small evening lamps
  for (const side of [-1, 1]) {
    const lamp = addBox(group, 0.2, 0.28, 0.2, lib.lampMaterial, side * 1.25, 6.35, 1.18, 0.03);
    addGlowSprite(group, lib, side * 1.25, 6.35, 1.34, 0.78);
  }
  group.userData.height = 12.2;
  group.userData.clockHands = hands;
  return group;
}

function createWindmillBlades(lib, radius = 2.75) {
  const rotor = new THREE.Group();
  const hub = addCylinder(rotor, 0.22, 0.28, 0.46, 10, lib.woodDark, 0, 0, 0);
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Group();
    blade.rotation.z = (i / 4) * Math.PI * 2;
    rotor.add(blade);
    const spar = addBox(blade, 0.1, radius * 0.92, 0.08, lib.woodDark, 0, radius * 0.46, 0.04, 0.015);
    const cross = addBox(blade, 0.65, 0.055, 0.06, lib.woodDark, 0.32, radius * 0.46, 0.05, 0.01);
    const sailMat = new THREE.MeshStandardMaterial({ color: '#e9dfc2', roughness: 0.92, side: THREE.DoubleSide });
    const sail = addBox(blade, 0.48, radius * 0.58, 0.03, sailMat, 0.3, radius * 0.42, 0.06, 0.008, false, false);
    for (let s = 0; s < 6; s++) {
      addBox(blade, 0.54, 0.025, 0.035, lib.woodLight, 0.3, radius * 0.2 + s * radius * 0.09, 0.085, 0.004, false, false);
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 5), lib.woodDark);
    tip.position.set(0, radius * 0.94, 0.04);
    blade.add(tip);
  }
  return rotor;
}

export function createWindmill(lib) {
  const group = new THREE.Group();
  group.name = 'windmill';
  addCylinder(group, 1.62, 2.0, 0.38, 12, lib.stoneDark, 0, 0.19, 0);
  addCylinder(group, 1.28, 1.62, 4.05, 12, lib.woodSiding, 0, 2.2, 0);
  addCylinder(group, 1.2, 1.3, 0.18, 12, lib.woodDark, 0, 4.28, 0);
  // stone foot and door
  addBox(group, 1.2, 1.35, 0.65, lib.stone, 0, 0.82, 1.55, 0.05);
  addDoor(group, lib, 0, 0.25, 1.89, { width: 0.72, height: 1.32 });
  addWindow(group, lib, -0.95, 2.34, 1.1, { width: 0.37, height: 0.55, rotationY: -0.48, shutters: false, flowerBox: false });
  addWindow(group, lib, 0.9, 3.28, 1.08, { width: 0.32, height: 0.5, rotationY: 0.5, shutters: false, flowerBox: false });
  // balcony ring
  addCylinder(group, 1.63, 1.63, 0.1, 16, lib.woodDark, 0, 3.35, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    addBox(group, 0.07, 0.55, 0.07, lib.woodDark, Math.cos(a) * 1.55, 3.65, Math.sin(a) * 1.55, 0.01);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.035, 6, 32), lib.woodDark);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 3.92;
  group.add(rail);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.25, 12), lib.roofs.rust);
  cap.position.y = 4.93;
  cap.castShadow = true;
  group.add(cap);
  const rotorPivot = new THREE.Group();
  rotorPivot.position.set(0, 4.0, 1.42);
  group.add(rotorPivot);
  const rotor = createWindmillBlades(lib, 2.65);
  rotor.userData.noMerge = true;
  rotorPivot.add(rotor);
  addCylinder(rotorPivot, 0.11, 0.11, 0.85, 8, lib.woodDark, 0, 0, -0.2).rotation.x = Math.PI / 2;
  // small attached shed
  addBox(group, 1.45, 1.2, 1.1, lib.walls.cream, -1.6, 0.72, 0.55, 0.05).rotation.y = 0.2;
  const shedRoof = addBox(group, 1.65, 0.14, 1.3, lib.roofs.moss, -1.62, 1.36, 0.55, 0.03);
  shedRoof.rotation.z = 0.12;
  addCrate(group, lib, -1.6, 0.36, 1.2, 0.9, 0.4);
  addCrate(group, lib, -1.0, 0.34, 1.25, 0.75, -0.2);
  group.userData.height = 5.9;
  group.userData.rotor = rotor;
  return group;
}

function createWaterWheel(lib, radius = 0.95) {
  const wheel = new THREE.Group();
  const wheelGeo = new THREE.TorusGeometry(radius, 0.085, 8, 32);
  const ring1 = new THREE.Mesh(wheelGeo, lib.woodDark);
  const ring2 = ring1.clone();
  ring1.position.x = -0.16;
  ring2.position.x = 0.16;
  ring1.rotation.y = Math.PI / 2;
  ring2.rotation.y = Math.PI / 2;
  wheel.add(ring1, ring2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const spoke = addBox(wheel, 0.07, radius * 1.8, 0.06, lib.woodDark, 0, 0, 0, 0.01);
    spoke.rotation.x = a;
    for (const x of [-0.16, 0.16]) {
      const paddle = addBox(wheel, 0.34, 0.06, 0.38, lib.woodLight, x, Math.cos(a) * radius, Math.sin(a) * radius, 0.01);
      paddle.rotation.x = a;
    }
  }
  addCylinder(wheel, 0.08, 0.08, 0.6, 8, lib.blackIron, 0, 0, 0).rotation.z = Math.PI / 2;
  return wheel;
}

export function createWatermill(lib, anchors) {
  const group = new THREE.Group();
  group.name = 'watermill';
  const house = createHouse(lib, {
    width: 3.3,
    depth: 2.75,
    floors: 2,
    wallMat: lib.walls.butter,
    roofMat: lib.roofs.teal,
    ridgeAxis: 'z',
    roofRise: 1.55,
    timber: true,
    balcony: false,
    hangingSign: '水车',
    seed: 23
  }, anchors);
  group.add(house);
  // stone tailrace bridge below the wheel
  const wheelRoot = new THREE.Group();
  wheelRoot.position.set(-1.9, 0.15, 0.2);
  wheelRoot.rotation.y = 0.12;
  group.add(wheelRoot);
  const wheel = createWaterWheel(lib, 0.95);
  wheel.userData.noMerge = true;
  wheel.position.set(0, 0.86, 0);
  wheelRoot.add(wheel);
  const housing = new THREE.Group();
  housing.position.set(-0.94, 1.15, 0.2);
  group.add(housing);
  addBox(housing, 0.6, 0.55, 1.5, lib.woodDark, 0, 0, 0, 0.03);
  addBox(group, 1.15, 0.23, 1.0, lib.stoneDark, -1.95, 0.16, 0.2, 0.025);
  addCylinder(group, 0.22, 0.26, 0.5, 8, lib.woodMid, -2.55, 0.33, 0.05);
  for (let i = 0; i < 3; i++) {
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshStandardMaterial({ color: '#bda77c', roughness: 0.95 }));
    sack.scale.set(0.8, 1.05, 0.65);
    sack.position.set(-1.3 + i * 0.42, 0.5, 1.1 + (i % 2) * 0.1);
    sack.castShadow = true;
    group.add(sack);
  }
  group.userData.height = house.userData.height;
  group.userData.wheel = wheel;
  return group;
}

export function createObservatory(lib) {
  const group = new THREE.Group();
  group.name = 'observatory';
  addCylinder(group, 1.95, 2.2, 0.32, 16, lib.stoneDark, 0, 0.16, 0);
  addCylinder(group, 1.5, 1.82, 2.25, 16, lib.stone, 0, 1.36, 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    addBox(group, 0.38, 0.18, 0.52, lib.stoneLight, Math.cos(a) * 1.65, 0.45 + (i % 3) * 0.55, Math.sin(a) * 1.65, 0.02).rotation.y = -a;
  }
  addDoor(group, lib, 0, 1.1, 1.47, { width: 0.75, height: 1.5 });
  addBox(group, 0.54, 0.52, 0.14, lib.stoneLight, 0.7, 2.55, 1.4, 0.02);
  addBox(group, 1.75, 0.18, 1.75, lib.woodDark, 0, 2.68, 0, 0.03);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.045, 6, 28), lib.blackIron);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 3.17;
  group.add(rail);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    addBox(group, 0.04, 0.5, 0.04, lib.blackIron, Math.cos(a) * 1.27, 2.92, Math.sin(a) * 1.27, 0.005);
  }
  addCylinder(group, 1.42, 1.42, 0.35, 16, lib.walls.ivory, 0, 2.9, 0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.42, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), lib.copper);
  dome.scale.y = 0.78;
  dome.position.y = 3.1;
  dome.castShadow = true;
  group.add(dome);
  // observation slit and telescope
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.72, 0.12), lib.blackIron);
  slit.position.set(0.27, 3.82, 1.0);
  slit.rotation.x = -0.55;
  group.add(slit);
  const telescope = new THREE.Group();
  telescope.position.set(0.46, 3.98, 1.26);
  telescope.rotation.set(-0.86, 0.25, -0.22);
  group.add(telescope);
  addCylinder(telescope, 0.11, 0.15, 1.05, 10, lib.blackIron, 0, 0.4, 0);
  addCylinder(telescope, 0.14, 0.18, 0.48, 10, lib.brass, 0, 0.92, 0);
  addWindow(group, lib, 0, 2.0, 1.36, { width: 0.4, height: 0.7, shutters: false, flowerBox: false });
  for (const a of [1.1, 2.1, 4.1, 5.2]) {
    addBox(group, 0.35, 0.13, 0.5, lib.stoneLight, Math.cos(a) * 1.92, 0.36, Math.sin(a) * 1.92, 0.02).rotation.y = -a;
  }
  addWindow(group, lib, 1.47, 1.7, 0.1, { width: 0.34, height: 0.58, rotationY: Math.PI / 2, shutters: false, flowerBox: false });
  group.userData.height = 5.1;
  return group;
}

export function createLighthouse(lib) {
  const group = new THREE.Group();
  group.name = 'lighthouse';
  const rng = mulberry32(0xabc991);
  // rocks emerging from the water
  for (let i = 0; i < 17; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + rng() * 0.7, 0), i % 3 ? lib.stoneDark : lib.stone);
    const a = rng() * TAU;
    const r = 1.0 + rng() * 1.7;
    rock.position.set(Math.cos(a) * r, 0.05 + rng() * 0.25, Math.sin(a) * r);
    rock.scale.set(0.8 + rng() * 0.8, 0.45 + rng() * 0.55, 0.7 + rng() * 0.8);
    rock.rotation.set(rng() * 2, rng() * 3, rng() * 2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  addCylinder(group, 1.05, 1.3, 0.3, 14, lib.stoneLight, 0, 0.48, 0);
  const sections = 5;
  const towerH = 4.9;
  let y = 0.63;
  for (let i = 0; i < sections; i++) {
    const t0 = i / sections;
    const t1 = (i + 1) / sections;
    const r0 = 0.83 - t0 * 0.34;
    const r1 = 0.83 - t1 * 0.34;
    addCylinder(group, r1, r0, towerH / sections + 0.01, 16, i % 2 ? lib.redLighthouse : lib.whiteLighthouse, 0, y + towerH / sections / 2, 0);
    y += towerH / sections;
  }
  addCylinder(group, 0.64, 0.63, 0.22, 16, lib.blackIron, 0, y + 0.08, 0);
  const gallery = addCylinder(group, 0.9, 0.9, 0.12, 16, lib.stoneLight, 0, y + 0.26, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    addBox(group, 0.04, 0.42, 0.04, lib.blackIron, Math.cos(a) * 0.82, y + 0.52, Math.sin(a) * 0.82, 0.005);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.03, 6, 28), lib.blackIron);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = y + 0.73;
  group.add(rail);
  const lantern = addCylinder(group, 0.54, 0.58, 0.75, 12, lib.lampMaterial, 0, y + 0.84, 0);
  addCylinder(group, 0.7, 0.7, 0.11, 12, lib.blackIron, 0, y + 1.23, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.95, 12), lib.redLighthouse);
  roof.position.y = y + 1.74;
  roof.castShadow = true;
  group.add(roof);
  addSphere(group, 0.1, lib.brass, 0, y + 2.22, 0, 8, 6, false);
  // revolving beam
  const beamRoot = new THREE.Group();
  beamRoot.userData.noMerge = true;
  beamRoot.position.y = y + 0.85;
  group.add(beamRoot);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffd58f') },
      uOpacity: { value: 0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: [
      'varying float vAlong;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'void main() {',
      '  vAlong = position.y / 20.0 + 0.5;',
      '  vec4 world = modelMatrix * vec4(position, 1.0);',
      '  vWorldPos = world.xyz;',
      '  vWorldNormal = normalize(mat3(modelMatrix) * normal);',
      '  gl_Position = projectionMatrix * viewMatrix * world;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor;',
      'uniform float uOpacity;',
      'varying float vAlong;',
      'varying vec3 vWorldPos;',
      'varying vec3 vWorldNormal;',
      'void main() {',
      '  float endFade = smoothstep(0.0, 0.5, vAlong);',
      '  float lengthFade = 0.35 + 0.65 * vAlong;',
      '  vec3 viewDir = normalize(cameraPosition - vWorldPos);',
      '  float facing = abs(dot(normalize(vWorldNormal), viewDir));',
      '  float edgeFade = mix(0.16, 1.0, smoothstep(0.0, 0.7, facing));',
      '  float alpha = uOpacity * endFade * lengthFade * edgeFade;',
      '  gl_FragColor = vec4(uColor, alpha);',
      '}'
    ].join('\n')
  });
  const beamGeo = new THREE.ConeGeometry(3.2, 20, 24, 1, true);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 10;
  beam.position.z = 0;
  beamRoot.add(beam);
  const glow = new THREE.Sprite(lib.glowMaterial);
  glow.position.y = y + 0.85;
  glow.scale.setScalar(2.4);
  group.add(glow);
  const light = new THREE.PointLight('#ffd49a', 0, 8, 2);
  light.position.set(0, y + 0.9, 0);
  group.add(light);
  // little keeper cottage
  addBox(group, 2.05, 0.22, 1.7, lib.stoneDark, -1.15, 0.36, 0.1, 0.04);
  addBox(group, 1.8, 1.15, 1.4, lib.walls.ivory, -1.15, 0.94, 0.1, 0.06);
  const cottageRoof = new THREE.Mesh(new THREE.ConeGeometry(1.22, 0.58, 4), lib.roofs.slate);
  cottageRoof.rotation.y = Math.PI / 4;
  cottageRoof.position.set(-1.15, 1.78, 0.1);
  cottageRoof.castShadow = true;
  group.add(cottageRoof);
  addBox(group, 0.22, 0.42, 0.22, lib.stoneDark, -1.72, 1.85, -0.28, 0.02);
  addWindow(group, lib, -1.15, 0.98, 0.83, { width: 0.34, height: 0.55, shutters: false, flowerBox: true });
  addDoor(group, lib, -0.6, 0.3, 0.9, { width: 0.42, height: 0.78 });
  addBox(group, 0.16, 0.2, 0.16, lib.lampMaterial, -1.78, 0.86, 0.8, 0.02);
  addGlowSprite(group, lib, -1.78, 0.9, 0.92, 0.55);
  group.userData.height = y + 2.3;
  group.userData.beam = beamRoot;
  group.userData.beamMaterial = beamMat;
  group.userData.light = light;
  return group;
}

export function createFountain(lib) {
  const group = new THREE.Group();
  group.name = 'fountain';
  addCylinder(group, 1.55, 1.72, 0.16, 12, lib.stoneDark, 0, 0.08, 0);
  addCylinder(group, 1.34, 1.49, 0.55, 16, lib.stoneLight, 0, 0.35, 0);
  addCylinder(group, 1.22, 1.22, 0.08, 16, lib.stone, 0, 0.64, 0);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: '#6fb7b2',
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.02,
    clearcoat: 0.85
  });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.19, 1.19, 0.05, 32), waterMat);
  water.position.y = 0.69;
  group.add(water);
  addCylinder(group, 0.26, 0.38, 1.05, 10, lib.stoneLight, 0, 1.05, 0);
  addCylinder(group, 0.72, 0.43, 0.2, 12, lib.stoneLight, 0, 1.48, 0);
  addCylinder(group, 0.85, 0.7, 0.12, 12, lib.stone, 0, 1.52, 0);
  addCylinder(group, 0.9, 0.9, 0.05, 12, waterMat, 0, 1.6, 0);
  addCylinder(group, 0.11, 0.14, 0.65, 8, lib.stoneLight, 0, 1.85, 0);
  addSphere(group, 0.18, lib.stoneLight, 0, 2.2, 0, 10, 8, true);
  const fishColors = [lib.brass, lib.brass, lib.brass];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3;
    const fish = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 6), fishColors[i]);
    fish.rotation.z = Math.PI / 2;
    fish.rotation.y = -a;
    fish.position.set(Math.cos(a) * 1.18, 0.8, Math.sin(a) * 1.18);
    group.add(fish);
  }
  const dropCount = 85;
  const dropPositions = new Float32Array(dropCount * 3);
  const drops = [];
  for (let i = 0; i < dropCount; i++) {
    drops.push({ angle: Math.random() * TAU, speed: 0.4 + Math.random() * 0.3, vy: 0.4 + Math.random() * 1.1, life: Math.random() });
    dropPositions[i * 3] = 0;
    dropPositions[i * 3 + 1] = 2.2;
    dropPositions[i * 3 + 2] = 0;
  }
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPositions, 3));
  const dropMat = new THREE.PointsMaterial({
    size: 0.07,
    map: lib.textures.spark,
    color: '#c9f5f0',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false
  });
  const dropPoints = new THREE.Points(dropGeo, dropMat);
  group.add(dropPoints);
  let acc = 0;
  function update(dt, elapsed, night) {
    waterMat.opacity = 0.62 + night * 0.12;
    dropMat.opacity = 0.55 + night * 0.25;
    const pos = dropGeo.attributes.position.array;
    acc += dt;
    for (let i = 0; i < dropCount; i++) {
      const d = drops[i];
      d.life += dt * 0.55;
      if (d.life > 1) d.life -= 1;
      const t = d.life;
      const radial = t * 0.52;
      pos[i * 3] = Math.cos(d.angle) * (0.02 + radial) * d.speed * 2.6;
      pos[i * 3 + 1] = 2.15 + Math.sin(t * Math.PI) * d.vy * 0.75 - t * 0.48;
      pos[i * 3 + 2] = Math.sin(d.angle) * (0.02 + radial) * d.speed * 2.6;
    }
    dropGeo.attributes.position.needsUpdate = true;
  }
  return { group, update };
}

export function createMarketStall(lib, options = {}) {
  const group = new THREE.Group();
  const width = options.width || 2.1;
  const depth = options.depth || 1.4;
  const counterMat = lib.woodMid;
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      addBox(group, 0.1, 2.2, 0.1, lib.woodDark, x, 1.1, z, 0.02);
    }
  }
  addBox(group, width, 0.13, depth, counterMat, 0, 0.9, 0, 0.03);
  addBox(group, width - 0.1, 0.08, depth - 0.08, lib.woodPale, 0, 1.0, 0, 0.02);
  const awningMat = lib.awningMaterials[options.awning || 'cream'] || lib.awningMaterials.cream;
  const canopy = addBox(group, width + 0.4, 0.06, depth + 0.4, awningMat, 0, 2.17, 0, 0.025);
  canopy.rotation.x = 0.06;
  const valance = addBox(group, width + 0.4, 0.18, 0.04, awningMat, 0, 2.06, depth / 2 + 0.2, 0.01);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.075 + (i % 2) * 0.02, 7, 5), lib.flowerMaterials[i % 4]);
    fruit.position.set(-width * 0.35 + (i % 4) * width * 0.22, 1.08 + (i % 2) * 0.08, -0.12 + Math.floor(i / 4) * 0.2);
    group.add(fruit);
  }
  for (let i = 0; i < 3; i++) {
    addBox(group, 0.38, 0.25, 0.32, lib.woodLight, -width * 0.35 + i * width * 0.3, 0.55, depth / 2 + 0.42, 0.02);
  }
  addCylinder(group, 0.13, 0.16, 0.3, 8, lib.woodLight, width * 0.52, 0.45, depth * 0.52);
  const bannerTex = makeBannerTexture(options.banner || '市', options.bannerColor || '#a75644', '#f2e3c6');
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 0.88 });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.85, 4, 7), bannerMat);
  banner.position.set(width / 2 + 0.06, 1.58, -depth / 2 - 0.02);
  banner.rotation.y = 0.2;
  group.add(banner);
  return group;
}
