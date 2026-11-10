import * as THREE from 'three';
import { canvasTexture, clamp, lerp, smoothstep, mulberry32 } from './utils.js';

function createSunTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,253,233,1)');
    g.addColorStop(0.1, 'rgba(255,246,200,1)');
    g.addColorStop(0.18, 'rgba(255,222,144,0.95)');
    g.addColorStop(0.32, 'rgba(255,193,104,0.32)');
    g.addColorStop(0.7, 'rgba(255,175,90,0.06)');
    g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function createMoonTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, 46, w / 2, h / 2, w / 2);
    glow.addColorStop(0, 'rgba(227,238,243,0.32)');
    glow.addColorStop(0.44, 'rgba(200,220,235,0.12)');
    glow.addColorStop(1, 'rgba(200,220,235,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 58, 0, Math.PI * 2);
    ctx.fillStyle = '#f0e9cf';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2 - 15, h / 2 - 10, 49, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(201,208,195,0.24)';
    ctx.fill();
    const craters = [[-17, 13, 12], [11, -13, 8], [22, 22, 6], [-5, -30, 5], [-27, -13, 7], [6, 30, 4]];
    craters.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(w / 2 + x, h / 2 + y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(149,159,151,0.28)';
      ctx.fill();
    });
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 58, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,240,0.38)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function makeStars(count, radius, size) {
  const rng = mulberry32(0x57a12c);
  const positions = [];
  const colors = [];
  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = rng();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(0.02 + v * 0.98);
    const r = radius * (0.85 + rng() * 0.15);
    const x = Math.sin(phi) * Math.cos(theta) * r;
    const y = Math.cos(phi) * r;
    const z = Math.sin(phi) * Math.sin(theta) * r;
    positions.push(x, y, z);
    const tint = rng();
    const c = new THREE.Color();
    if (tint > 0.8) c.set('#ffdfba');
    else if (tint > 0.6) c.set('#cddfff');
    else c.set('#fffbea');
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

  scene.fog = new THREE.FogExp2('#d8d6c2', 0.0022);

  // Gradient sky dome with a sun halo.
  const skyUniforms = {
    uTop: { value: new THREE.Color('#4c93c1') },
    uHorizon: { value: new THREE.Color('#eddcc0') },
    uSunDir: { value: new THREE.Vector3(0.2, 0.8, 0.2).normalize() },
    uSunColor: { value: new THREE.Color('#ffeac0') },
    uSunGlow: { value: 1 },
    uGolden: { value: 0 },
    uNight: { value: 0 },
    uTime: { value: 0 }
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: [
      'varying vec3 vDir;',
      'void main() {',
      '  vDir = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uTop;',
      'uniform vec3 uHorizon;',
      'uniform vec3 uSunColor;',
      'uniform vec3 uSunDir;',
      'uniform float uSunGlow;',
      'uniform float uGolden;',
      'uniform float uNight;',
      'uniform float uTime;',
      'varying vec3 vDir;',
      'float hash21(vec2 p) {',
      '  p = fract(p * vec2(123.34, 456.21));',
      '  p += dot(p, p + 45.32);',
      '  return fract(p.x * p.y);',
      '}',
      'void main() {',
      '  float h = clamp(vDir.y, 0.0, 1.0);',
      '  vec3 col = mix(uHorizon, uTop, pow(h, 0.58));',
      '  float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);',
      '  col += uSunColor * pow(sd, 160.0) * 1.5 * uSunGlow;',
      '  col += uSunColor * pow(sd, 10.0) * 0.12 * uSunGlow;',
      '  vec2 flatDir = normalize(vec2(vDir.x, vDir.z) + vec2(0.0001));',
      '  vec2 flatSun = normalize(vec2(uSunDir.x, uSunDir.z) + vec2(0.0001));',
      '  float horizonGlow = pow(max(dot(flatDir, flatSun), 0.0), 5.0) * pow(1.0 - h, 3.0);',
      '  col += uSunColor * horizonGlow * uGolden * 0.32;',
      '  float band = sin(vDir.y * 18.0 + uSunDir.x * 5.0) * 0.004;',
      '  col += band;',
      '  vec2 starUv = vec2(atan(vDir.z, vDir.x) / 6.2831853 + 0.5, asin(clamp(vDir.y, -1.0, 1.0)) / 3.1415926 + 0.5);',
      '  vec2 starGrid = starUv * vec2(290.0, 170.0);',
      '  vec2 starCell = floor(starGrid);',
      '  vec2 starLocal = fract(starGrid) - 0.5;',
      '  float starRand = hash21(starCell);',
      '  float starShape = smoothstep(0.09, 0.012, length(starLocal));',
      '  float starLayer = step(0.972, starRand) * starShape;',
      '  float starTwinkle = 0.55 + 0.45 * sin(uTime * 1.35 + starRand * 63.0);',
      '  col += vec3(0.86, 0.92, 1.0) * starLayer * starTwinkle * uNight * 0.8;',
      '  vec2 starGrid2 = starUv * vec2(520.0, 310.0);',
      '  float starRand2 = hash21(floor(starGrid2));',
      '  float starShape2 = smoothstep(0.06, 0.004, length(fract(starGrid2) - 0.5));',
      '  col += vec3(1.0, 0.87, 0.64) * step(0.986, starRand2) * starShape2 * uNight * 0.42;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 40, 24), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  const starGeo = makeStars(620, 100, 1.2);
  const starMat = new THREE.PointsMaterial({
    size: 0.72,
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
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9;
  group.add(stars);
  const starGeo2 = makeStars(90, 98, 2.3);
  const starMat2 = starMat.clone();
  starMat2.size = 1.9;
  const stars2 = new THREE.Points(starGeo2, starMat2);
  stars2.renderOrder = -9;
  group.add(stars2);

  const sunMat = new THREE.SpriteMaterial({
    map: createSunTexture(),
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.set(18, 18, 18);
  group.add(sunSprite);

  const moonMat = new THREE.SpriteMaterial({
    map: createMoonTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const moonSprite = new THREE.Sprite(moonMat);
  moonSprite.scale.set(9.5, 9.5, 9.5);
  group.add(moonSprite);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: materials.textures.glow,
    color: '#a8c4de',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  }));
  moonHalo.scale.set(28, 28, 28);
  group.add(moonHalo);

  // Key light doubles as sun and moon to keep only one shadow map.
  const keyLight = new THREE.DirectionalLight('#fff0d2', 2.0);
  keyLight.position.set(24, 38, 20);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -25;
  keyLight.shadow.camera.right = 25;
  keyLight.shadow.camera.top = 22;
  keyLight.shadow.camera.bottom = -22;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 100;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.04;
  keyLight.target.position.set(0, 1.2, 0);
  group.add(keyLight, keyLight.target);

  const hemi = new THREE.HemisphereLight('#d7ecf2', '#4f5842', 0.62);
  group.add(hemi);
  const ambient = new THREE.AmbientLight('#8499a4', 0.2);
  group.add(ambient);
  const bounce = new THREE.DirectionalLight('#d9c8a4', 0.25);
  bounce.position.set(-22, 15, -20);
  group.add(bounce);

  // Cloud billboards drifting slowly around the miniature world.
  const cloudMats = [];
  const clouds = [];
  const cloudRng = mulberry32(0xc10d);
  const cloudRoot = new THREE.Group();
  group.add(cloudRoot);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.SpriteMaterial({
      map: materials.textures.cloud,
      color: '#fff8ea',
      transparent: true,
      opacity: 0.18 + Math.random() * 0.24,
      depthWrite: false,
      fog: false,
      toneMapped: false
    });
    cloudMats.push(mat);
    const sprite = new THREE.Sprite(mat);
    const scale = 22 + Math.random() * 16;
    sprite.scale.set(scale * 1.6, scale * 0.65, 1);
    const angle = Math.random() * Math.PI * 2;
    const radius = 68 + Math.random() * 20;
    sprite.position.set(Math.cos(angle) * radius, 38 + Math.random() * 13, Math.sin(angle) * radius - 4);
    sprite.userData = { angle, radius, speed: 0.001 + Math.random() * 0.003, height: sprite.position.y };
    cloudRoot.add(sprite);
    clouds.push(sprite);
  }

  const day = {
    top: new THREE.Color('#4b94c4'),
    horizon: new THREE.Color('#f1dfc1'),
    fog: new THREE.Color('#dbd7c0'),
    sun: new THREE.Color('#fff8e8'),
    hemiSky: new THREE.Color('#d5eaf1'),
    hemiGround: new THREE.Color('#536048'),
    ambient: new THREE.Color('#8fa4ac')
  };
  const night = {
    top: new THREE.Color('#030b1a'),
    horizon: new THREE.Color('#1d3152'),
    fog: new THREE.Color('#0c1829'),
    sun: new THREE.Color('#99b4df'),
    hemiSky: new THREE.Color('#6988b4'),
    hemiGround: new THREE.Color('#16202a'),
    ambient: new THREE.Color('#31445f')
  };
  const warm = new THREE.Color('#ffb16c');
  const twilightTop = new THREE.Color('#5b5f94');

  const state = {
    nightFactor: 0,
    daylight: 1,
    sunDirection: new THREE.Vector3(0.5, 0.7, 0.3).normalize(),
    sunColor: new THREE.Color('#fff0ce'),
    horizonColor: new THREE.Color('#f1dfc1'),
    skyColor: new THREE.Color('#4b94c4'),
    golden: 0
  };

  let smoothNight = 0;

  function update(timeHours, elapsed, dt) {
    const theta = ((timeHours - 6) / 24) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0.42).normalize();
    const sunAltitude = sunDir.y;
    const daylight = smoothstep(-0.055, 0.24, sunAltitude);
    const nightFactor = 1 - smoothstep(-0.26, 0.02, sunAltitude);
    const golden = Math.exp(-Math.pow(sunAltitude / 0.24, 2)) * smoothstep(-0.28, 0.08, sunAltitude);
    smoothNight = lerp(smoothNight, nightFactor, 1 - Math.exp(-6 * dt));
    state.nightFactor = smoothNight;
    state.daylight = daylight;
    state.golden = golden;
    state.sunDirection.copy(sunDir);
    const horizon = day.horizon.clone().lerp(night.horizon, smoothNight);
    horizon.lerp(warm, golden * 0.34);
    const top = day.top.clone().lerp(night.top, smoothNight);
    top.lerp(twilightTop, golden * 0.2);
    const fog = day.fog.clone().lerp(night.fog, smoothNight);
    fog.lerp(warm, golden * 0.12);
    const sunCol = day.sun.clone().lerp(night.sun, smoothNight);
    sunCol.lerp(warm, golden * 0.7);
    state.horizonColor.copy(horizon);
    state.skyColor.copy(top);
    state.sunColor.copy(sunCol);

    skyUniforms.uTop.value.copy(top);
    skyUniforms.uHorizon.value.copy(horizon);
    skyUniforms.uSunDir.value.copy(sunDir);
    skyUniforms.uSunColor.value.copy(sunCol);
    skyUniforms.uSunGlow.value = 0.18 + daylight * 0.9;
    skyUniforms.uGolden.value = golden;
    skyUniforms.uNight.value = smoothNight;
    skyUniforms.uTime.value = elapsed;
    scene.fog.color.copy(fog);
    scene.fog.density = lerp(0.0018, 0.0028, smoothNight);
    renderer.toneMappingExposure = 0.96 + smoothNight * 0.08;

    const moonDir = new THREE.Vector3(-sunDir.x, -sunDir.y, sunDir.z * 0.5).normalize();
    sunSprite.position.copy(sunDir).multiplyScalar(96);
    sunSprite.visible = sunDir.y > -0.16;
    sunSprite.material.opacity = (1 - smoothNight) * (0.55 + daylight * 0.45);
    sunSprite.scale.setScalar(14 + golden * 7);
    moonSprite.position.copy(moonDir).multiplyScalar(92);
    moonHalo.position.copy(moonSprite.position);
    moonSprite.visible = moonDir.y > -0.1;
    moonHalo.visible = moonSprite.visible;
    moonSprite.material.opacity = smoothNight * (0.4 + 0.6 * clamp(moonDir.y * 3, 0, 1));
    moonHalo.material.opacity = smoothNight * 0.18;
    const moonGlow = smoothNight;
    starMat.opacity = smoothNight * 1.0;
    starMat2.opacity = smoothNight * 1.0;
    stars.rotation.y = elapsed * 0.004;
    stars2.rotation.y = elapsed * 0.003;
    starMat.size = 0.65 + Math.sin(elapsed * 0.7) * 0.04;

    // Light transitions: warm sun, cool moon, soft blue-grey ambient.
    keyLight.position.copy(sunDir).multiplyScalar(48);
    const sunStrength = daylight * (1.65 + Math.max(0, sunAltitude) * 0.65);
    const moonStrength = smoothNight * 0.72;
    if (sunStrength > 0.06) {
      keyLight.color.copy(day.sun).lerp(warm, golden * 0.8);
      keyLight.intensity = sunStrength;
    } else {
      keyLight.color.copy(night.sun);
      keyLight.intensity = moonStrength;
      keyLight.position.copy(moonDir).multiplyScalar(45);
    }
    if (keyLight.intensity < 0.05) {
      keyLight.color.copy(night.sun);
      keyLight.intensity = 0.16;
      keyLight.position.copy(moonDir).multiplyScalar(45);
    }
    hemi.color.copy(day.hemiSky).lerp(night.hemiSky, smoothNight);
    hemi.groundColor.copy(day.hemiGround).lerp(night.hemiGround, smoothNight);
    hemi.intensity = lerp(0.52, 0.46, smoothNight);
    ambient.color.copy(day.ambient).lerp(night.ambient, smoothNight);
    ambient.intensity = lerp(0.16, 0.42, smoothNight);
    bounce.color.copy(warm).lerp(night.sun, smoothNight);
    bounce.intensity = lerp(0.13, 0.22, smoothNight);

    // Material response for windows, lanterns and string lights.
    materials.windowMaterial.emissiveIntensity = 0.025 + smoothNight * 1.55 + golden * 0.08;
    materials.lampMaterial.emissiveIntensity = 0.12 + smoothNight * 3.6;
    materials.glowMaterial.opacity = smoothNight * 0.8;
    materials.waterGlowMaterial.opacity = smoothNight * 0.45;
    const stringNight = smoothNight;
    if (stringNight > 0.01) {
      materials.stringLightMaterial.color.setRGB(0.8 + stringNight * 2.2, 0.52 + stringNight * 1.2, 0.25 + stringNight * 0.55);
    } else {
      materials.stringLightMaterial.color.setRGB(0.42, 0.33, 0.24);
    }
    materials.smokeMaterial.opacity = 0.22 + golden * 0.08;

    clouds.forEach((cloud, i) => {
      cloud.userData.angle += cloud.userData.speed * dt;
      cloud.position.x = Math.cos(cloud.userData.angle) * cloud.userData.radius;
      cloud.position.z = Math.sin(cloud.userData.angle) * cloud.userData.radius - 4;
      cloud.material.color.set('#fff7e9').lerp(new THREE.Color('#7d8aa2'), smoothNight);
      cloud.material.opacity = lerp(0.24, 0.055, smoothNight) * (0.7 + (i % 3) * 0.12);
      cloud.position.y = cloud.userData.height + Math.sin(elapsed * 0.08 + i) * 0.5;
    });
    return state;
  }

  return {
    group,
    update,
    state,
    keyLight,
    hemi,
    moonSprite,
    sunSprite,
    fog: scene.fog
  };
}
