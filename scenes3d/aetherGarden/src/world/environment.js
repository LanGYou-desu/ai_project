import * as THREE from 'three';
import { canvasTexture, clamp, lerp, smoothstep, damp, mulberry32 } from '../core/utils.js';

function createSunTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,246,1)');
    g.addColorStop(0.12, 'rgba(255,247,209,1)');
    g.addColorStop(0.24, 'rgba(255,220,151,0.9)');
    g.addColorStop(0.5, 'rgba(255,190,106,0.25)');
    g.addColorStop(1, 'rgba(255,184,95,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true });
}

function createMoonTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const halo = ctx.createRadialGradient(w / 2, h / 2, 42, w / 2, h / 2, w / 2);
    halo.addColorStop(0, 'rgba(228,242,241,0.055)');
    halo.addColorStop(0.45, 'rgba(201,223,230,0.025)');
    halo.addColorStop(1, 'rgba(190,215,225,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    // Full disc, then cut away the shadowed side to reveal a slender crescent.
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#f1f3df';
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(w / 2 + 26, h / 2 - 8, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A faint inner glow hugs the crescent's lit edge.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const inner = ctx.createRadialGradient(w / 2 - 12, h / 2, 10, w / 2 - 12, h / 2, 75);
    inner.addColorStop(0, 'rgba(255,255,242,0.35)');
    inner.addColorStop(1, 'rgba(188,207,195,0)');
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }, { clamp: true });
}

const skyVertex = [
  'varying vec3 vDir;',
  'void main() {',
  '  vDir = normalize(position);',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

const skyFragment = [
  'uniform vec3 uTop;',
  'uniform vec3 uHorizon;',
  'uniform vec3 uSunColor;',
  'uniform vec3 uSunDir;',
  'uniform vec3 uAuroraA;',
  'uniform vec3 uAuroraB;',
  'uniform float uSunGlow;',
  'uniform float uGolden;',
  'uniform float uNight;',
  'uniform float uAurora;',
  'uniform float uTime;',
  'varying vec3 vDir;',
  'float hash21(vec2 p) {',
  '  p = fract(p * vec2(123.34, 456.21));',
  '  p += dot(p, p + 45.32);',
  '  return fract(p.x * p.y);',
  '}',
  'void main() {',
  '  vec3 dir = normalize(vDir);',
  '  float h = clamp(dir.y, 0.0, 1.0);',
  '  vec3 col = mix(uHorizon, uTop, pow(h, 0.4));',
  '  float sd = max(dot(dir, normalize(uSunDir)), 0.0);',
  '  col += uSunColor * pow(sd, 160.0) * 1.25 * uSunGlow;',
  '  col += uSunColor * pow(sd, 10.0) * 0.1 * uSunGlow;',
  '  vec2 flatDir = normalize(vec2(dir.x, dir.z) + vec2(0.0001));',
  '  vec2 flatSun = normalize(vec2(uSunDir.x, uSunDir.z) + vec2(0.0001));',
  '  float lowGlow = pow(max(dot(flatDir, flatSun), 0.0), 5.0) * pow(1.0 - h, 2.5);',
  '  col += uSunColor * lowGlow * uGolden * 0.44;',
  '  vec2 starUv = vec2(atan(dir.z, dir.x) / 6.2831853 + 0.5, asin(clamp(dir.y, -1.0, 1.0)) / 3.1415926 + 0.5);',
  '  vec2 starGrid = starUv * vec2(330.0, 190.0);',
  '  vec2 starCell = floor(starGrid);',
  '  vec2 starLocal = fract(starGrid) - 0.5;',
  '  float starRand = hash21(starCell);',
  '  float starShape = smoothstep(0.075, 0.009, length(starLocal));',
  '  float starLayer = step(0.973, starRand) * starShape;',
  '  float twinkle = 0.6 + 0.4 * sin(uTime * 1.15 + starRand * 57.0);',
  '  col += vec3(0.82, 0.92, 1.0) * starLayer * twinkle * uNight * 0.92;',
  '  vec2 starGrid2 = starUv * vec2(610.0, 350.0);',
  '  float starRand2 = hash21(floor(starGrid2));',
  '  float smallStar = smoothstep(0.05, 0.004, length(fract(starGrid2) - 0.5));',
  '  col += vec3(1.0, 0.88, 0.68) * step(0.989, starRand2) * smallStar * uNight * 0.62;',
  '  float az = atan(dir.z, dir.x) / 6.2831853 + 0.5;',
  '  float bandCenter = 0.115 + 0.055 * sin(az * 9.0 + uTime * 0.025) + 0.026 * sin(az * 23.0 - uTime * 0.018);',
  '  float auroraBand = exp(-pow((h - bandCenter) / 0.115, 2.0));',
  '  float curtains = 0.5 + 0.5 * sin(az * 49.0 + h * 8.0 + uTime * 0.085);',
  '  curtains = pow(curtains, 4.0);',
  '  float broad = 0.55 + 0.45 * sin(az * 15.0 - h * 6.0 + uTime * 0.038);',
  '  float auroraMask = auroraBand * (0.38 + curtains * 0.85) * smoothstep(0.0, 0.2, h) * (1.0 - smoothstep(0.32, 0.62, h));',
  '  vec3 auroraColor = mix(uAuroraA, uAuroraB, broad);',
  '  col += auroraColor * auroraMask * uAurora * uNight * 0.82;',
  '  col += uAuroraA * 0.03 * uNight * smoothstep(0.4, 0.75, h);',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function makeStarGeometry(count, radius, seed) {
  const rng = mulberry32(seed);
  const positions = [];
  const colors = [];
  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = rng();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(0.01 + v * 0.99);
    const r = radius * (0.86 + rng() * 0.14);
    positions.push(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(theta) * r);
    const c = new THREE.Color(rng() > 0.8 ? '#ffdfb0' : (rng() > 0.6 ? '#c7ddff' : '#f4f6e9'));
    colors.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export function createEnvironment(scene, renderer, materials) {
  const group = new THREE.Group();
  group.name = 'environment';
  scene.add(group);

  scene.fog = new THREE.FogExp2('#c9dcda', 0.00135);

  const skyUniforms = {
    uTop: { value: new THREE.Color('#4c87a6') },
    uHorizon: { value: new THREE.Color('#c7dcda') },
    uSunColor: { value: new THREE.Color('#ffe5b0') },
    uSunDir: { value: new THREE.Vector3(0.3, 0.7, 0.2).normalize() },
    uAuroraA: { value: new THREE.Color('#48d7ad') },
    uAuroraB: { value: new THREE.Color('#8b6cd8') },
    uSunGlow: { value: 1 },
    uGolden: { value: 0 },
    uNight: { value: 0 },
    uAurora: { value: 0.8 },
    uTime: { value: 0 }
  };
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: skyVertex,
    fragmentShader: skyFragment
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 28), skyMaterial);
  sky.renderOrder = -20;
  group.add(sky);

  const starMaterial = new THREE.PointsMaterial({
    size: 0.9,
    map: materials.textures.spark,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
    fog: false
  });
  const stars = new THREE.Points(makeStarGeometry(700, 150, 0x51ab3d), starMaterial);
  stars.renderOrder = -19;
  group.add(stars);
  const starMaterial2 = starMaterial.clone();
  starMaterial2.size = 1.8;
  const stars2 = new THREE.Points(makeStarGeometry(110, 144, 0x99ca11), starMaterial2);
  stars2.renderOrder = -19;
  group.add(stars2);

  const sunMaterial = new THREE.SpriteMaterial({
    map: createSunTexture(),
    color: '#fff9db',
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false
  });
  const sunSprite = new THREE.Sprite(sunMaterial);
  sunSprite.scale.setScalar(20);
  group.add(sunSprite);

  const moonMaterial = new THREE.SpriteMaterial({
    map: createMoonTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    fog: false
  });
  const moonSprite = new THREE.Sprite(moonMaterial);
  moonSprite.scale.setScalar(10);
  group.add(moonSprite);

  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: materials.textures.glow,
    color: '#b7dce1',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false
  }));
  moonHalo.scale.setScalar(34);
  group.add(moonHalo);

  const keyLight = new THREE.DirectionalLight('#fff1d3', 2.1);
  keyLight.position.set(22, 32, 20);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -27;
  keyLight.shadow.camera.right = 27;
  keyLight.shadow.camera.top = 27;
  keyLight.shadow.camera.bottom = -27;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 95;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.045;
  keyLight.target.position.set(0, 0, 0);
  group.add(keyLight, keyLight.target);

  const hemisphere = new THREE.HemisphereLight('#d8eef2', '#27605e', 0.62);
  group.add(hemisphere);
  const ambient = new THREE.AmbientLight('#819ca3', 0.22);
  group.add(ambient);
  const underLight = new THREE.DirectionalLight('#8bd0c6', 0.9);
  underLight.position.set(-5, -18, -9);
  underLight.target.position.set(0, -2, 0);
  group.add(underLight, underLight.target);
  const cliffFill = new THREE.DirectionalLight('#a8d8cf', 0.62);
  cliffFill.position.set(10, -7, 24);
  cliffFill.target.position.set(0, -2.2, 0);
  group.add(cliffFill, cliffFill.target);

  const clouds = [];
  const cloudRoot = new THREE.Group();
  cloudRoot.name = 'cloud-sea';
  group.add(cloudRoot);
  const cloudRng = mulberry32(0xc10d55);
  for (let i = 0; i < 15; i++) {
    const mat = new THREE.SpriteMaterial({
      map: materials.textures.cloud,
      color: '#fffdf4',
      transparent: true,
      opacity: 0.17 + cloudRng() * 0.18,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 7 + cloudRng() * 13;
    sprite.scale.set(scale * 1.6, scale * 0.55, 1);
    const angle = cloudRng() * Math.PI * 2;
    const radius = 8 + cloudRng() * 21;
    sprite.position.set(Math.cos(angle) * radius, -4.6 - cloudRng() * 2.6, Math.sin(angle) * radius);
    sprite.userData = {
      angle,
      radius,
      speed: 0.0009 + cloudRng() * 0.0022,
      baseY: sprite.position.y,
      phase: cloudRng() * 10,
      baseOpacity: mat.opacity
    };
    cloudRoot.add(sprite);
    clouds.push(sprite);
  }
  // A low skirt of cloud brushing the underside of the main island.
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({
      map: materials.textures.cloud,
      color: '#f4f7ef',
      transparent: true,
      opacity: 0.16 + cloudRng() * 0.14,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 6.5 + cloudRng() * 5.5;
    sprite.scale.set(scale * 1.7, scale * 0.44, 1);
    const angle = cloudRng() * Math.PI * 2;
    const radius = 7 + cloudRng() * 11;
    sprite.position.set(Math.cos(angle) * radius, -3.1 - cloudRng() * 1.3, Math.sin(angle) * radius);
    sprite.userData = { angle, radius, speed: 0.0005 + cloudRng() * 0.001, baseY: sprite.position.y, phase: cloudRng() * 10, baseOpacity: mat.opacity, high: true };
    cloudRoot.add(sprite);
    clouds.push(sprite);
  }
  // A few distant high wisps add breath without becoming a wall of white.
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({
      map: materials.textures.cloud,
      color: '#fff9eb',
      transparent: true,
      opacity: 0.09 + cloudRng() * 0.1,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 23 + cloudRng() * 16;
    sprite.scale.set(scale * 1.8, scale * 0.45, 1);
    const angle = cloudRng() * Math.PI * 2;
    const radius = 50 + cloudRng() * 28;
    sprite.position.set(Math.cos(angle) * radius, 2.5 + cloudRng() * 8, Math.sin(angle) * radius);
    sprite.userData = { angle, radius, speed: 0.0003 + cloudRng() * 0.0007, baseY: sprite.position.y, phase: cloudRng() * 10, baseOpacity: mat.opacity, high: true };
    cloudRoot.add(sprite);
    clouds.push(sprite);
  }
  // Thin cloud breath drifting around the island shelf.
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.SpriteMaterial({
      map: materials.textures.cloud,
      color: '#eaf4ee',
      transparent: true,
      opacity: 0.11 + cloudRng() * 0.09,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 9 + cloudRng() * 7;
    sprite.scale.set(scale * 1.5, scale * 0.38, 1);
    const angle = cloudRng() * Math.PI * 2;
    const radius = 16 + cloudRng() * 13;
    sprite.position.set(Math.cos(angle) * radius, -2.2 + cloudRng() * 1.1, Math.sin(angle) * radius);
    sprite.userData = { angle, radius, speed: 0.0004 + cloudRng() * 0.0008, baseY: sprite.position.y, phase: cloudRng() * 10, baseOpacity: mat.opacity, high: true };
    cloudRoot.add(sprite);
    clouds.push(sprite);
  }

  const day = {
    top: new THREE.Color('#3f83a7'),
    horizon: new THREE.Color('#aacbd2'),
    fog: new THREE.Color('#b3cfd2'),
    sun: new THREE.Color('#ffe4b0'),
    hemiSky: new THREE.Color('#d1e9ec'),
    hemiGround: new THREE.Color('#628b7b'),
    ambient: new THREE.Color('#7f9ba2')
  };
  const night = {
    top: new THREE.Color('#01040d'),
    horizon: new THREE.Color('#091a2b'),
    fog: new THREE.Color('#06111c'),
    sun: new THREE.Color('#8aa8d9'),
    hemiSky: new THREE.Color('#4c6c94'),
    hemiGround: new THREE.Color('#173336'),
    ambient: new THREE.Color('#273c51')
  };
  const warm = new THREE.Color('#ffad66');
  const twilightTop = new THREE.Color('#4e4c7d');

  // Carefully composed cloud wisps around the open sides of the archipelago.
  const wisps = [];
  const wispDefs = [
    { p: [-18.5, 1.4, 5.5], s: [14, 4.2], o: 0.22 },
    { p: [-22.0, 3.8, -7.0], s: [18, 5.0], o: 0.16 },
    { p: [19.5, 1.1, 4.8], s: [13, 4.0], o: 0.2 },
    { p: [22.0, 4.1, -8.0], s: [19, 5.2], o: 0.15 },
    { p: [4.5, -3.7, 14.5], s: [11, 3.2], o: 0.17 }
  ];
  wispDefs.forEach((def, index) => {
    const mat = new THREE.SpriteMaterial({
      map: materials.textures.cloud,
      color: '#fbfcf6',
      transparent: true,
      opacity: def.o,
      depthWrite: false,
      toneMapped: false,
      fog: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(...def.p);
    sprite.scale.set(def.s[0], def.s[1], 1);
    sprite.userData = { base: new THREE.Vector3(...def.p), baseOpacity: def.o, phase: index * 1.37, index };
    cloudRoot.add(sprite);
    wisps.push(sprite);
  });

  // Layered cloud banks: a cool underside below a sunlit cap reads as volume against the sky.
  const cloudBanks = [];
  const bankDefs = [
    { p: [-22.0, 2.4, 2.0], s: [22, 7], o: 0.26 },
    { p: [22.0, 2.0, 1.0], s: [21, 6.5], o: 0.24 },
    { p: [-2.0, 5.2, -20.0], s: [24, 7], o: 0.18 },
    { p: [1.0, -4.2, 18.0], s: [22, 6.5], o: 0.2 }
  ];
  bankDefs.forEach((def, index) => {
    const topMat = new THREE.SpriteMaterial({
      map: materials.textures.cloud, color: '#fdfcf4', transparent: true, opacity: def.o,
      depthWrite: false, toneMapped: false, fog: false
    });
    const bottomMat = new THREE.SpriteMaterial({
      map: materials.textures.cloud, color: '#aebfc2', transparent: true, opacity: def.o * 0.78,
      depthWrite: false, toneMapped: false, fog: false
    });
    const top = new THREE.Sprite(topMat);
    const bottom = new THREE.Sprite(bottomMat);
    top.scale.set(def.s[0], def.s[1], 1);
    bottom.scale.set(def.s[0] * 1.04, def.s[1] * 0.82, 1);
    bottom.position.set(def.p[0], def.p[1] - def.s[1] * 0.14, def.p[2]);
    top.position.set(...def.p);
    top.userData = { base: new THREE.Vector3(...def.p), phase: index * 1.71, baseOpacity: def.o };
    bottom.userData = { ...top.userData, bottom: true };
    cloudRoot.add(bottom, top);
    cloudBanks.push({ top, bottom, baseOpacity: def.o, phase: index * 1.71 });
  });

  const state = {
    nightFactor: 0,
    daylight: 1,
    sunDirection: new THREE.Vector3(),
    sunColor: new THREE.Color(),
    horizonColor: new THREE.Color(),
    skyColor: new THREE.Color(),
    golden: 0
  };
  let smoothNight = 0;

  function update(timeHours, elapsed, dt) {
    const theta = ((timeHours - 6) / 24) * Math.PI * 2;
    // The sun path is gently art-directed toward the open side of the garden so
    // late-afternoon light grazes the visible lawn and facade instead of backlighting it.
    const sunDir = new THREE.Vector3(Math.cos(theta) * 0.48 - 0.18, Math.sin(theta), 0.86).normalize();
    const alt = sunDir.y;
    const daylight = smoothstep(-0.04, 0.22, alt);
    const nightFactor = 1 - smoothstep(-0.24, 0.02, alt);
    const golden = Math.exp(-Math.pow(alt / 0.24, 2)) * smoothstep(-0.3, 0.08, alt);
    smoothNight = damp(smoothNight, nightFactor, 4.2, dt);
    state.nightFactor = smoothNight;
    state.daylight = daylight;
    state.golden = golden;
    state.sunDirection.copy(sunDir);

    const horizon = day.horizon.clone().lerp(night.horizon, smoothNight);
    horizon.lerp(warm, golden * 0.55);
    const top = day.top.clone().lerp(night.top, smoothNight);
    top.lerp(twilightTop, golden * 0.24);
    const fog = day.fog.clone().lerp(night.fog, smoothNight);
    fog.lerp(warm, golden * 0.22);
    const sunColor = day.sun.clone().lerp(night.sun, smoothNight);
    sunColor.lerp(warm, golden * 0.85);
    state.horizonColor.copy(horizon);
    state.skyColor.copy(top);
    state.sunColor.copy(sunColor);

    skyUniforms.uTop.value.copy(top);
    skyUniforms.uHorizon.value.copy(horizon);
    skyUniforms.uSunDir.value.copy(sunDir);
    skyUniforms.uSunColor.value.copy(sunColor);
    skyUniforms.uSunGlow.value = 0.08 + daylight * 0.52;
    skyUniforms.uGolden.value = golden;
    skyUniforms.uNight.value = smoothNight;
    skyUniforms.uAurora.value = 0.72 + 0.18 * Math.sin(elapsed * 0.09);
    skyUniforms.uTime.value = elapsed;
    scene.fog.color.copy(fog);
    scene.fog.density = lerp(0.0012, 0.0021, smoothNight);
    renderer.toneMappingExposure = 0.94 + smoothNight * 0.04;

    // A low show-moon hangs over the garden at night. The key light keeps its own calculated path.
    const moonDir = new THREE.Vector3(-sunDir.x * 0.85, Math.max(0.06, -sunDir.y), -sunDir.z * 0.6).normalize();
    const moonDisplayDir = new THREE.Vector3(-0.7, 0.105, -1).normalize();
    sunSprite.position.copy(sunDir).multiplyScalar(142);
    sunSprite.visible = sunDir.y > -0.08;
    sunSprite.material.opacity = (1 - smoothNight) * (0.28 + daylight * 0.34);
    sunSprite.scale.setScalar(9 + golden * 4);
    moonSprite.position.copy(moonDisplayDir).multiplyScalar(145);
    moonHalo.position.copy(moonSprite.position);
    moonSprite.visible = smoothNight > 0.12;
    moonHalo.visible = moonSprite.visible;
    moonSprite.material.opacity = smoothNight * 0.95;
    moonSprite.scale.setScalar(10.5);
    moonHalo.scale.setScalar(25);
    moonHalo.material.opacity = smoothNight * 0.1;

    starMaterial.opacity = smoothNight * 0.9;
    starMaterial2.opacity = smoothNight * 0.95;
    stars.rotation.y = elapsed * 0.0025;
    stars2.rotation.y = elapsed * 0.0018;

    const sunStrength = daylight * (2.75 + Math.max(0, alt) * 0.7);
    const moonStrength = smoothNight * 0.95;
    if (sunStrength > 0.1) {
      keyLight.position.copy(sunDir).multiplyScalar(45);
      keyLight.color.copy(day.sun).lerp(warm, golden * 0.72);
      keyLight.intensity = sunStrength;
    } else {
      keyLight.position.copy(moonDir).multiplyScalar(42);
      keyLight.color.copy(night.sun);
      keyLight.intensity = Math.max(0.18, moonStrength);
    }
    hemisphere.color.copy(day.hemiSky).lerp(night.hemiSky, smoothNight).lerp(warm, golden * 0.1);
    hemisphere.groundColor.copy(day.hemiGround).lerp(night.hemiGround, smoothNight);
    hemisphere.intensity = lerp(0.42, 0.28, smoothNight);
    ambient.color.copy(day.ambient).lerp(night.ambient, smoothNight);
    ambient.intensity = lerp(0.1, 0.18, smoothNight);
    underLight.color.copy(new THREE.Color('#91d5ca')).lerp(new THREE.Color('#658dbb'), smoothNight);
    underLight.intensity = lerp(0.88, 0.52, smoothNight);
    cliffFill.color.copy(new THREE.Color('#b1ded6')).lerp(new THREE.Color('#6f91bb'), smoothNight);
    cliffFill.intensity = lerp(0.62, 0.38, smoothNight);

    materials.lampMaterial.emissiveIntensity = 0.18 + smoothNight * 3.2;
    materials.glow.opacity = smoothNight * 0.74;
    materials.coolGlow.opacity = smoothNight * 0.5;
    materials.seamGlow.opacity = smoothNight * 0.34;
    materials.crystalMaterial.emissiveIntensity = 0.2 + smoothNight * 1.7;
    if (materials.windowGlass) materials.windowGlass.emissiveIntensity = 0.03 + smoothNight * 1.1;

    cloudBanks.forEach((bank, index) => {
      const drift = elapsed * 0.012 + bank.phase;
      const dx = Math.sin(drift) * 1.4;
      const dy = Math.sin(elapsed * 0.035 + bank.phase) * 0.22;
      bank.top.position.x = bank.top.userData.base.x + dx;
      bank.top.position.z = bank.top.userData.base.z + Math.cos(drift * 0.8) * 0.6;
      bank.top.position.y = bank.top.userData.base.y + dy;
      bank.bottom.position.set(bank.top.position.x, bank.top.position.y - (bank.top.scale.y * 0.14), bank.top.position.z);
      const topColor = new THREE.Color('#fdfcf4').lerp(new THREE.Color('#8da2b2'), smoothNight);
      const bottomColor = new THREE.Color('#aebfc2').lerp(new THREE.Color('#41566e'), smoothNight);
      bank.top.material.color.copy(topColor);
      bank.bottom.material.color.copy(bottomColor);
      bank.top.material.opacity = bank.baseOpacity * lerp(1, 0.58, smoothNight);
      bank.bottom.material.opacity = bank.baseOpacity * 0.6 * lerp(1, 0.55, smoothNight);
    });
    wisps.forEach((wisp, index) => {
      const u = wisp.userData;
      const drift = elapsed * (0.025 + index * 0.003);
      wisp.position.x = u.base.x + Math.sin(drift + u.phase) * 1.0;
      wisp.position.z = u.base.z + Math.cos(drift * 0.7 + u.phase) * 0.45;
      wisp.position.y = u.base.y + Math.sin(elapsed * 0.05 + u.phase) * 0.25;
      wisp.material.color.copy(new THREE.Color('#fbfcf6')).lerp(new THREE.Color('#7f94a9'), smoothNight);
      wisp.material.opacity = u.baseOpacity * lerp(1, 0.6, smoothNight);
    });
    clouds.forEach((cloud, i) => {
      const u = cloud.userData;
      u.angle += u.speed * dt;
      cloud.position.x = Math.cos(u.angle) * u.radius;
      cloud.position.z = Math.sin(u.angle) * u.radius;
      if (u.high) {
        cloud.position.y = u.baseY + Math.sin(elapsed * 0.06 + u.phase) * 0.8;
      } else {
        cloud.position.y = u.baseY + Math.sin(elapsed * 0.14 + u.phase) * 0.28;
        cloud.material.opacity = u.baseOpacity * (0.85 + 0.15 * Math.sin(elapsed * 0.22 + u.phase)) * lerp(1, 0.55, smoothNight);
      }
      const nightColor = new THREE.Color('#435a72');
      const dayColor = new THREE.Color('#f6f8f1');
      cloud.material.color.copy(dayColor).lerp(nightColor, smoothNight);
      if (u.high) cloud.material.opacity = u.baseOpacity * lerp(1, 0.35, smoothNight);
    });

    return state;
  }

  return { group, update, state, keyLight, skyUniforms, clouds, sunSprite, moonSprite };
}
