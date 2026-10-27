import * as THREE from 'three';

const textureScales = {
  concrete: 2.6,
  concreteFloor: 2.8,
  ceilingTiles: 2.4,
  paintedMetal: 1.9,
  rustMetal: 1.7,
  metalFloor: 1.25,
  wallpaper: 2.2,
  tileWall: 1.8,
  wood: 1.8,
  woodPale: 1.8,
  fabric: 1.25,
  mattress: 1.0,
  paper: 0.5,
  dirt: 1.5,
  water: 2.4
};

const standard = (tex, { color = 0xffffff, roughness = 0.8, metalness = 0.02, bumpScale = 0.012, envIntensity = 0.32, side = THREE.FrontSide } = {}) => {
  const material = new THREE.MeshStandardMaterial({
    map: tex?.map || null,
    bumpMap: tex?.bumpMap || null,
    bumpScale,
    color,
    roughness,
    metalness,
    side,
    envMapIntensity: envIntensity
  });
  material.name = tex?.name || '';
  return material;
};

export class MaterialLibrary {
  constructor(textures) {
    this.textures = textures;
    this.cache = new Map();
    this.signMaterials = new Map();
    this.environment = null;
    this._build();
  }

  _build() {
    const t = this.textures;
    this.set('concrete', standard(t.get('concrete'), { roughness: .92, bumpScale: .035, color: 0xb8b9ab }));
    this.set('concreteDark', standard(t.get('concrete'), { roughness: .9, bumpScale: .03, color: 0x747a6f }));
    this.set('concreteWet', standard(t.get('concrete'), { roughness: .55, metalness: .08, bumpScale: .03, color: 0x8f9a8c, envIntensity: .65 }));
    this.set('concreteFloor', standard(t.get('concreteFloor'), { roughness: .78, metalness: .03, bumpScale: .026, color: 0x9b9f92, envIntensity: .5 }));
    this.set('concreteFloorDark', standard(t.get('concreteFloor'), { color: 0x61675d, roughness: .72, metalness: .05, bumpScale: .028, envIntensity: .65 }));
    this.set('ceiling', standard(t.get('ceilingTiles'), { roughness: .95, bumpScale: .018, color: 0x9a9a89 }));
    this.set('paintedMetal', standard(t.get('paintedMetal'), { roughness: .67, metalness: .26, bumpScale: .018, color: 0xa7b6a7, envIntensity: .42 }));
    this.set('paintedMetalDark', standard(t.get('paintedMetal'), { roughness: .6, metalness: .33, bumpScale: .02, color: 0x5d6d61 }));
    this.set('paintedMetalPale', standard(t.get('paintedMetal'), { roughness: .7, metalness: .22, bumpScale: .02, color: 0xc0c5b0 }));
    this.set('rust', standard(t.get('rustMetal'), { roughness: .82, metalness: .22, bumpScale: .03, color: 0x9b896e }));
    this.set('rustDark', standard(t.get('rustMetal'), { roughness: .84, metalness: .18, bumpScale: .03, color: 0x736553 }));
    this.set('metalFloor', standard(t.get('metalFloor'), { roughness: .6, metalness: .42, bumpScale: .024, color: 0x9aa7a0, envIntensity: .55 }));
    this.set('metalFloorDark', standard(t.get('metalFloor'), { roughness: .55, metalness: .44, bumpScale: .02, color: 0x656f68, envIntensity: .55 }));
    this.set('wallpaper', standard(t.get('wallpaper'), { roughness: .94, bumpScale: .008, color: 0xa7ab8d }));
    this.set('tile', standard(t.get('tileWall'), { roughness: .43, metalness: .06, bumpScale: .02, color: 0xbfc4ad, envIntensity: .5 }));
    this.set('wood', standard(t.get('wood'), { roughness: .8, metalness: .01, bumpScale: .017, color: 0x9b8569 }));
    this.set('woodPale', standard(t.get('woodPale'), { roughness: .82, metalness: .01, bumpScale: .012, color: 0xb6a483 }));
    this.set('woodDark', standard(t.get('wood'), { roughness: .82, metalness: .01, bumpScale: .015, color: 0x5a4a38 }));
    this.set('fabric', standard(t.get('fabric'), { roughness: .98, metalness: 0, bumpScale: .012, color: 0x818674 }));
    this.set('fabricDark', standard(t.get('fabric'), { roughness: .98, bumpScale: .008, color: 0x4f5349 }));
    this.set('mattress', standard(t.get('mattress'), { roughness: .96, bumpScale: .01, color: 0xa6a284 }));
    this.set('paper', standard(t.get('paper'), { roughness: .9, bumpScale: .004, color: 0xd5cdb4 }));
    this.set('dirt', standard(t.get('dirt'), { roughness: .98, bumpScale: .025, color: 0x8c816a }));

    this.set('rubber', new THREE.MeshStandardMaterial({ color: 0x151816, roughness: .88, metalness: .02 }));
    this.set('blackMetal', new THREE.MeshStandardMaterial({ color: 0x202521, roughness: .45, metalness: .62, envMapIntensity: .65 }));
    this.set('darkMetal', new THREE.MeshStandardMaterial({ color: 0x343a35, roughness: .56, metalness: .48, envMapIntensity: .4 }));
    this.set('brass', new THREE.MeshStandardMaterial({ color: 0x796b49, roughness: .36, metalness: .78, envMapIntensity: .8 }));
    this.set('steel', new THREE.MeshStandardMaterial({ color: 0x777d75, roughness: .35, metalness: .72, envMapIntensity: .65 }));
    this.set('steelDull', new THREE.MeshStandardMaterial({ color: 0x5f655f, roughness: .58, metalness: .5, envMapIntensity: .45 }));
    this.set('whitePaint', new THREE.MeshStandardMaterial({ color: 0xa9aa9b, roughness: .72, metalness: .03 }));
    this.set('pipeGreen', new THREE.MeshStandardMaterial({ color: 0x3f5749, roughness: .6, metalness: .3 }));
    this.set('pipeRust', new THREE.MeshStandardMaterial({ color: 0x6f4f36, roughness: .72, metalness: .24 }));
    this.set('pipeRed', new THREE.MeshStandardMaterial({ color: 0x6c352e, roughness: .58, metalness: .34 }));
    this.set('plastic', new THREE.MeshStandardMaterial({ color: 0x2a2e2a, roughness: .48, metalness: .02 }));
    this.set('ceramic', new THREE.MeshStandardMaterial({ color: 0xb8b6a3, roughness: .24, metalness: .04, envMapIntensity: .6 }));
    this.set('cardboard', new THREE.MeshStandardMaterial({ color: 0x827258, roughness: .94, metalness: 0 }));
    this.set('blackFabric', new THREE.MeshStandardMaterial({ color: 0x111412, roughness: 1, metalness: 0 }));
    this.set('rustPaint', new THREE.MeshStandardMaterial({ color: 0x6b4632, roughness: .83, metalness: .1 }));
    this.set('warningYellow', new THREE.MeshStandardMaterial({ color: 0x9c8950, roughness: .68, metalness: .1 }));
    this.set('emissiveWarm', new THREE.MeshStandardMaterial({ color: 0x8a8268, emissive: 0xffcf96, emissiveIntensity: 1.45, roughness: .35 }));
    this.set('emissiveWhite', new THREE.MeshStandardMaterial({ color: 0xa5a899, emissive: 0xcfe1d2, emissiveIntensity: 1.25, roughness: .4 }));
    this.set('emissiveRed', new THREE.MeshStandardMaterial({ color: 0x4c211f, emissive: 0xc24a3b, emissiveIntensity: 1.15, roughness: .5 }));
    this.set('emissiveGreen', new THREE.MeshStandardMaterial({ color: 0x244136, emissive: 0x6dc7a1, emissiveIntensity: 1.2, roughness: .4 }));
    this.set('lampOff', new THREE.MeshStandardMaterial({ color: 0x495148, roughness: .32, metalness: .25 }));
    this.set('blackGloss', new THREE.MeshStandardMaterial({ color: 0x0b0e0c, roughness: .1, metalness: .25, envMapIntensity: .9 }));

    this.black = new THREE.MeshBasicMaterial({ color: 0x020302 });
    this.blackHole = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
    this.lightShaft = new THREE.MeshBasicMaterial({
      color: 0xa8b9a0, transparent: true, opacity: 0.018, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });

    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x6e827b, metalness: 0, roughness: .12, transmission: .22,
      transparent: true, opacity: .32, thickness: .04, side: THREE.DoubleSide,
      depthWrite: false, envMapIntensity: .9
    });
    this.set('glass', glass);

    const water = new THREE.MeshPhysicalMaterial({
      map: t.get('water')?.map || null,
      color: 0x61746d, roughness: .13, metalness: .16,
      transparent: true, opacity: .79, depthWrite: false,
      bumpMap: t.get('water')?.bumpMap || null, bumpScale: .022,
      clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.0
    });
    this.set('water', water);
    this.set('puddle', new THREE.MeshPhysicalMaterial({
      map: t.get('water')?.map || null,
      color: 0x34443f, roughness: .08, metalness: .24,
      transparent: true, opacity: .58, depthWrite: false,
      bumpMap: t.get('water')?.bumpMap || null, bumpScale: .01,
      clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1
    }));

    this._buildDecals();
  }

  _buildDecals() {
    const make = (name, opacity = .58) => {
      const mat = new THREE.MeshStandardMaterial({
        map: this.textures.getDecal(name),
        transparent: true,
        opacity,
        depthWrite: false,
        roughness: .8,
        metalness: .02,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        side: THREE.FrontSide
      });
      return mat;
    };
    this.set('decalGrime', make('grime', .66));
    this.set('decalMold', make('mold', .6));
    this.set('decalWater', make('waterstain', .5));
    this.set('decalHand', make('handprint', .7));
    this.set('decalFoot', make('footprint', .5));
  }

  set(key, material) {
    material.name = key;
    this.cache.set(key, material);
    return material;
  }

  get(key) {
    return this.cache.get(key);
  }

  getTextureScale(name) {
    return textureScales[name] || 2.0;
  }

  clone(key, { color, roughness, metalness, emissive, emissiveIntensity, opacity, transparent } = {}) {
    const source = this.get(key);
    if (!source) throw new Error(`Unknown material: ${key}`);
    const material = source.clone();
    if (color !== undefined) material.color.set(color);
    if (roughness !== undefined) material.roughness = roughness;
    if (metalness !== undefined) material.metalness = metalness;
    if (emissive !== undefined) material.emissive.set(emissive);
    if (emissiveIntensity !== undefined) material.emissiveIntensity = emissiveIntensity;
    if (opacity !== undefined) material.opacity = opacity;
    if (transparent !== undefined) material.transparent = transparent;
    return material;
  }

  signMaterial(key, options) {
    if (this.signMaterials.has(key)) return this.signMaterials.get(key);
    const tex = this.textures.getSign(key, options);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xdfe0d4,
      roughness: .64,
      metalness: .05,
      emissive: 0xaeb197,
      emissiveMap: tex,
      emissiveIntensity: .055
    });
    this.signMaterials.set(key, mat);
    return mat;
  }

  labelMaterial(key, title, sub, options) {
    if (this.signMaterials.has(key)) return this.signMaterials.get(key);
    const tex = this.textures.getLabel(key, title, sub, options);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: .7,
      metalness: .05,
      emissive: 0x858b74,
      emissiveMap: tex,
      emissiveIntensity: .06
    });
    this.signMaterials.set(key, mat);
    return mat;
  }

  glowingSignMaterial(key, options) {
    if (this.signMaterials.has(key)) return this.signMaterials.get(key);
    const tex = this.textures.getSign(key, options);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: .52,
      metalness: .02,
      emissive: 0xd8c599,
      emissiveMap: tex,
      emissiveIntensity: .55
    });
    this.signMaterials.set(key, mat);
    return mat;
  }

  createEnvironment(renderer) {
    if (this.environment) return this.environment;
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x040706);
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(20, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0x080d0b, side: THREE.BackSide })
    );
    envScene.add(room);
    const warm = new THREE.Mesh(
      new THREE.PlaneGeometry(8, .7),
      new THREE.MeshBasicMaterial({ color: 0xb7a178 })
    );
    warm.position.set(0, 3.7, -7);
    warm.rotation.x = Math.PI / 2;
    envScene.add(warm);
    const cool = new THREE.Mesh(
      new THREE.PlaneGeometry(.8, 5),
      new THREE.MeshBasicMaterial({ color: 0x557a6b })
    );
    cool.position.set(-8, 1.4, 0);
    cool.rotation.y = Math.PI / 2;
    envScene.add(cool);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ color: 0x0e1511 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.6;
    envScene.add(floor);
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const target = pmrem.fromScene(envScene, 0.02);
    this.environment = target.texture;
    room.geometry.dispose();
    room.material.dispose();
    warm.geometry.dispose();
    warm.material.dispose();
    cool.geometry.dispose();
    cool.material.dispose();
    floor.geometry.dispose();
    floor.material.dispose();
    pmrem.dispose();
    return this.environment;
  }

  dispose() {
    for (const material of this.cache.values()) material.dispose?.();
    for (const material of this.signMaterials.values()) material.dispose?.();
    this.signMaterials.clear();
    if (this.environment) this.environment.dispose();
  }
}
