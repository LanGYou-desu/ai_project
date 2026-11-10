import * as THREE from 'three';

function standard(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    map: opts.map || null,
    flatShading: opts.flatShading || false,
    transparent: opts.transparent || false,
    opacity: opts.opacity ?? 1,
    side: opts.side || THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity || 0,
    envMapIntensity: opts.envMapIntensity ?? 0.4
  });
}

export function createMaterials(textures) {
  const grass = standard('#b9d0a0', { map: textures.grass, roughness: 0.98 });
  const stonePale = standard('#f0e3cc', { map: textures.stone, roughness: 0.94 });
  const stoneWarm = standard('#e1ceb0', { map: textures.stone, roughness: 0.93 });
  const stoneMoss = standard('#b5c0a3', { map: textures.stone, roughness: 0.97 });
  const stoneDark = standard('#898c7d', { map: textures.stone, roughness: 0.98 });
  const paving = standard('#f0e2c6', { map: textures.paving, roughness: 0.93 });
  const rock = standard('#91937e', { map: textures.rock, roughness: 1 });
  const rockDark = standard('#6b7267', { map: textures.rock, roughness: 1 });
  const woodDark = standard('#6a5039', { roughness: 0.88 });
  const wood = standard('#987453', { map: textures.wood, roughness: 0.86 });
  const woodLight = standard('#cba675', { map: textures.wood, roughness: 0.9 });
  const bamboo = standard('#8caa6b', { roughness: 0.83, flatShading: true });
  const lacquer = standard('#9d5342', { roughness: 0.7, metalness: 0.02 });
  const brass = standard('#d9b66b', { roughness: 0.32, metalness: 0.34, emissive: '#4a3513', emissiveIntensity: 0.08 });
  const brassDark = standard('#a08049', { roughness: 0.39, metalness: 0.28 });
  const copper = standard('#7dac9b', { roughness: 0.5, metalness: 0.22 });
  const iron = standard('#46504a', { roughness: 0.58, metalness: 0.28 });
  const rope = standard('#c3a97d', { roughness: 0.96, flatShading: true });

  const roofTeal = standard('#4f8b80', { map: textures.tiles, roughness: 0.8 });
  const roofBlue = standard('#56737b', { map: textures.tiles, roughness: 0.78 });
  const roofOchre = standard('#ac8655', { map: textures.tiles, roughness: 0.84 });

  const leafDeep = standard('#376a51', { roughness: 0.94, flatShading: true });
  const leafJade = standard('#65946b', { roughness: 0.94, flatShading: true });
  const leafPale = standard('#9fba82', { roughness: 0.94, flatShading: true });
  const leafOlive = standard('#a9a45f', { roughness: 0.94, flatShading: true });
  const leafGolden = standard('#c09a53', { roughness: 0.94, flatShading: true });
  const blossomPink = standard('#eeadb8', { roughness: 0.88, flatShading: true });
  const blossomPale = standard('#f4cec9', { roughness: 0.88, flatShading: true });
  const blossomWhite = standard('#f5ead9', { roughness: 0.88, flatShading: true });
  const leafAutumn = standard('#c57b55', { roughness: 0.94, flatShading: true });

  const flowerMaterials = [
    standard('#e7b4ad', { roughness: 0.7 }),
    standard('#e7cf86', { roughness: 0.7 }),
    standard('#d7ded2', { roughness: 0.7 }),
    standard('#ba8aa7', { roughness: 0.7 }),
    standard('#c98160', { roughness: 0.7 })
  ];

  const clothTeal = standard('#3f6f66', { roughness: 0.87, side: THREE.DoubleSide });
  const clothCream = standard('#e9ddc6', { roughness: 0.9, side: THREE.DoubleSide });
  const clothGold = standard('#b78f4a', { roughness: 0.88, side: THREE.DoubleSide });
  const clothBlue = standard('#607d8f', { roughness: 0.9, side: THREE.DoubleSide });

  const windowGlass = standard('#8ebfba', {
    roughness: 0.18,
    metalness: 0.12,
    transparent: true,
    opacity: 0.6,
    emissive: '#ffd889',
    emissiveIntensity: 0.02
  });

  const lampMaterial = standard('#ffe6ac', {
    roughness: 0.3,
    emissive: '#ffc56e',
    emissiveIntensity: 0.15
  });

  const crystalMaterial = new THREE.MeshPhysicalMaterial({
    color: '#d8fff2',
    roughness: 0.18,
    metalness: 0,
    transmission: 0.22,
    thickness: 0.7,
    emissive: new THREE.Color('#7ee8d2'),
    emissiveIntensity: 0.5,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
    transparent: true,
    opacity: 0.96
  });

  const orbMaterial = standard('#d8efe5', {
    roughness: 0.15,
    metalness: 0.1,
    emissive: '#a3e3cb',
    emissiveIntensity: 0.4
  });

  const glow = new THREE.SpriteMaterial({
    map: textures.glow,
    color: '#ffd28b',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  const coolGlow = new THREE.SpriteMaterial({
    map: textures.spark,
    color: '#a5f2d1',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  const mist = new THREE.SpriteMaterial({
    map: textures.mist,
    color: '#effcf9',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false
  });

  const seamGlow = new THREE.SpriteMaterial({
    map: textures.spark,
    color: '#92efd0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  const starGold = standard('#d5b56e', { roughness: 0.3, metalness: 0.6, emissive: '#b68b3b', emissiveIntensity: 0.1 });

  const materials = {
    grass,
    stonePale,
    stoneWarm,
    stoneMoss,
    stoneDark,
    paving,
    rock,
    rockDark,
    wood,
    woodDark,
    woodLight,
    bamboo,
    lacquer,
    brass,
    brassDark,
    copper,
    iron,
    rope,
    roofTeal,
    roofBlue,
    roofOchre,
    leafDeep,
    leafJade,
    leafPale,
    leafOlive,
    leafGolden,
    leafAutumn,
    blossomPink,
    blossomPale,
    blossomWhite,
    flowerMaterials,
    clothTeal,
    clothCream,
    clothGold,
    clothBlue,
    windowGlass,
    lampMaterial,
    crystalMaterial,
    orbMaterial,
    glow,
    coolGlow,
    mist,
    seamGlow,
    starGold,
    textures
  };

  // Named references help scene code stay readable.
  materials.leaves = [leafDeep, leafJade, leafPale, leafOlive, leafGolden, leafAutumn];
  materials.blossoms = [blossomPink, blossomPale, blossomWhite];

  return materials;
}
