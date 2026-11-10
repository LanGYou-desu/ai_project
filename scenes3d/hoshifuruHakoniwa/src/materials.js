import * as THREE from 'three';

export function createMaterials(textures) {
  const mk = (color, options = {}) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0,
    map: options.map || null,
    flatShading: options.flatShading || false,
    transparent: options.transparent || false,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
    emissive: options.emissive ? new THREE.Color(options.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: options.emissiveIntensity || 0,
    envMapIntensity: options.envMapIntensity ?? 0.6
  });

  const wallDefs = [
    ['cream', '#f0dab3'],
    ['peach', '#dd9c74'],
    ['butter', '#e7c56f'],
    ['sage', '#94ae87'],
    ['blue', '#83acb5'],
    ['rose', '#cd8b82'],
    ['ivory', '#f1e5cf'],
    ['clay', '#c47d61']
  ];
  const walls = {};
  for (const [name, color] of wallDefs) {
    walls[name] = mk(color, { map: textures.plaster, roughness: 0.93 });
    walls[name].name = 'wall-' + name;
  }

  const roofDefs = [
    ['terracotta', '#c45d3e'],
    ['rust', '#ad4d34'],
    ['teal', '#32746d'],
    ['slate', '#4f6572'],
    ['plum', '#71414d'],
    ['ochre', '#b17b3d'],
    ['moss', '#586b48']
  ];
  const roofs = {};
  for (const [name, color] of roofDefs) {
    roofs[name] = mk(color, { map: textures.roof, roughness: 0.9 });
    roofs[name].name = 'roof-' + name;
  }

  const stone = mk('#afa18d', { map: textures.stone, roughness: 0.96 });
  stone.name = 'stone';
  const stoneLight = mk('#c6b69c', { map: textures.stone, roughness: 0.93 });
  stoneLight.name = 'stone-light';
  const stoneDark = mk('#786f63', { map: textures.stone, roughness: 0.98 });
  stoneDark.name = 'stone-dark';
  const cobble = mk('#d2b895', { map: textures.cobble, roughness: 0.94 });
  cobble.name = 'cobble';

  const woodDark = mk('#4e392b', { roughness: 0.9 });
  woodDark.name = 'wood-dark';
  const woodMid = mk('#80593e', { map: textures.wood, roughness: 0.88 });
  woodMid.name = 'wood-mid';
  const woodLight = mk('#bd9563', { map: textures.wood, roughness: 0.9 });
  woodLight.name = 'wood-light';
  const woodPale = mk('#d1b285', { roughness: 0.94 });
  woodPale.name = 'wood-pale';

  const soil = mk('#765a43', { map: textures.soil, roughness: 1 });
  soil.name = 'soil';

  const blackIron = mk('#313833', { roughness: 0.5, metalness: 0.55 });
  blackIron.name = 'black-iron';
  const brass = mk('#b28b4f', { roughness: 0.3, metalness: 0.78 });
  brass.name = 'brass';
  const copper = mk('#74917f', { roughness: 0.6, metalness: 0.35 });
  copper.name = 'copper';
  const whiteLighthouse = mk('#e9e1cd', { roughness: 0.8 });
  whiteLighthouse.name = 'lighthouse-white';
  const redLighthouse = mk('#b64f42', { roughness: 0.75 });
  redLighthouse.name = 'lighthouse-red';

  const windowMaterial = mk('#ffffff', {
    map: textures.windowDay,
    roughness: 0.22,
    metalness: 0.24,
    emissive: '#ffb767',
    emissiveIntensity: 0.04
  });
  windowMaterial.emissiveMap = textures.windowGlow;
  windowMaterial.name = 'window';
  windowMaterial.emissiveMap.colorSpace = THREE.SRGBColorSpace;

  const doorWood = mk('#664733', { roughness: 0.82 });
  doorWood.name = 'door-wood';

  const lampMaterial = mk('#ffe6ad', {
    roughness: 0.3,
    emissive: '#ffc467',
    emissiveIntensity: 0.08
  });
  lampMaterial.name = 'lamp-glow';

  const stringLightMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8d745a'), toneMapped: false });
  stringLightMaterial.name = 'string-lights';

  const glowMaterial = new THREE.SpriteMaterial({
    map: textures.glow,
    color: '#ffca7c',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  glowMaterial.name = 'warm-glow';

  const waterGlowMaterial = new THREE.SpriteMaterial({
    map: textures.glow,
    color: '#a7e3df',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });

  const smokeMaterial = new THREE.SpriteMaterial({
    map: textures.smoke,
    color: '#ebe6da',
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  });

  const cloudMaterial = new THREE.SpriteMaterial({
    map: textures.cloud,
    color: '#fff7e8',
    transparent: true,
    opacity: 0.52,
    depthWrite: false
  });

  const leafMaterials = [
    mk('#547642', { roughness: 0.96, flatShading: true }),
    mk('#67894e', { roughness: 0.96, flatShading: true }),
    mk('#7f995d', { roughness: 0.96, flatShading: true }),
    mk('#496a4b', { roughness: 0.96, flatShading: true }),
    mk('#8b9e60', { roughness: 0.96, flatShading: true }),
    mk('#a08448', { roughness: 0.96, flatShading: true }),
    mk('#a96a50', { roughness: 0.96, flatShading: true })
  ];
  leafMaterials.forEach((m, i) => m.name = 'leaf-' + i);

  const woodSiding = mk('#8f6a4c', { map: textures.wood, roughness: 0.9 });
  woodSiding.name = 'wood-siding';

  const flowerMaterials = [
    mk('#d88575', { roughness: 0.7 }),
    mk('#e6c56f', { roughness: 0.7 }),
    mk('#e2e0d1', { roughness: 0.7 }),
    mk('#bc8caf', { roughness: 0.7 }),
    mk('#c85d4f', { roughness: 0.7 })
  ];

  const clothRed = mk('#a75543', { roughness: 0.9, side: THREE.DoubleSide });
  const clothCream = mk('#eadbc1', { roughness: 0.9, side: THREE.DoubleSide });
  const clothTeal = mk('#4f7e7b', { roughness: 0.9, side: THREE.DoubleSide });

  const awningMaterials = {
    cream: mk('#ffffff', { map: textures.awningCream, roughness: 0.8, side: THREE.DoubleSide }),
    teal: mk('#ffffff', { map: textures.awningTeal, roughness: 0.8, side: THREE.DoubleSide }),
    gold: mk('#ffffff', { map: textures.awningGold, roughness: 0.8, side: THREE.DoubleSide })
  };

  return {
    walls,
    wallList: Object.values(walls),
    roofs,
    roofList: Object.values(roofs),
    stone,
    stoneLight,
    stoneDark,
    cobble,
    woodDark,
    woodMid,
    woodLight,
    woodPale,
    woodSiding,
    soil,
    blackIron,
    brass,
    copper,
    whiteLighthouse,
    redLighthouse,
    windowMaterial,
    doorWood,
    lampMaterial,
    stringLightMaterial,
    glowMaterial,
    waterGlowMaterial,
    smokeMaterial,
    cloudMaterial,
    leafMaterials,
    flowerMaterials,
    clothRed,
    clothCream,
    clothTeal,
    awningMaterials,
    textures
  };
}
