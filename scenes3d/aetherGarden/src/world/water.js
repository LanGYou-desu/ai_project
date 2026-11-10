import * as THREE from 'three';

const poolVertex = [
  'uniform float uTime;',
  'varying vec2 vUv;',
  'varying vec3 vWorld;',
  'void main() {',
  '  vUv = uv;',
  '  vec3 p = position;',
  '  p.z += sin((p.x + uTime * 0.22) * 2.4) * 0.015 + cos((p.y - uTime * 0.15) * 3.1) * 0.012;',
  '  vec4 world = modelMatrix * vec4(p, 1.0);',
  '  vWorld = world.xyz;',
  '  gl_Position = projectionMatrix * viewMatrix * world;',
  '}'
].join('\n');

const poolFragment = [
  'uniform float uTime;',
  'uniform vec3 uDeep;',
  'uniform vec3 uShallow;',
  'uniform vec3 uSky;',
  'uniform vec3 uSunColor;',
  'uniform vec3 uSunDir;',
  'uniform float uOpacity;',
  'uniform float uNight;',
  'varying vec2 vUv;',
  'varying vec3 vWorld;',
  'void main() {',
  '  vec2 uv = vUv;',
  '  float r = length(uv - 0.5) * 2.0;',
  '  float ripple = sin(r * 38.0 - uTime * 1.25) * 0.5 + 0.5;',
  '  float ripple2 = sin(uv.x * 29.0 + uv.y * 17.0 + uTime * 0.38) * 0.5 + 0.5;',
  '  float fine = sin(uv.x * 120.0 + uTime * 0.2) * sin(uv.y * 83.0 - uTime * 0.15) * 0.5 + 0.5;',
  '  vec3 normal = normalize(vec3((ripple2 - 0.5) * 0.12, 1.0, (ripple - 0.5) * 0.12));',
  '  vec3 viewDir = normalize(cameraPosition - vWorld);',
  '  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.4);',
  '  vec3 color = mix(uDeep, uShallow, 0.22 + ripple * 0.22 + r * 0.1);',
  '  color = mix(color, uSky, fresnel * 0.68);',
  '  vec3 lightDir = normalize(uSunDir);',
  '  float spec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 70.0);',
  '  color += uSunColor * spec * (2.3 + uNight * 0.4);',
  '  color += vec3(0.58, 0.86, 0.77) * fine * 0.055;',
  '  float edgeFoam = smoothstep(0.82, 0.98, r) * (0.32 + 0.18 * sin(uTime * 0.8 + r * 24.0));',
  '  color = mix(color, vec3(0.8, 0.93, 0.87), edgeFoam * 0.2);',
  '  gl_FragColor = vec4(color, uOpacity + fresnel * 0.08);',
  '}'
].join('\n');

export function createPoolMaterial(options = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(options.deep || '#245c60') },
      uShallow: { value: new THREE.Color(options.shallow || '#72b9a9') },
      uSky: { value: new THREE.Color(options.sky || '#d9ebe1') },
      uSunColor: { value: new THREE.Color('#fff0cc') },
      uSunDir: { value: new THREE.Vector3(0.3, 0.7, 0.2).normalize() },
      uOpacity: { value: options.opacity ?? 0.88 },
      uNight: { value: 0 }
    },
    vertexShader: poolVertex,
    fragmentShader: poolFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
}

const fallVertex = [
  'varying vec2 vUv;',
  'varying float vWorldY;',
  'uniform float uTime;',
  'void main() {',
  '  vUv = uv;',
  '  vec3 p = position;',
  '  p.x += sin(uv.y * 18.0 + uTime * 1.5) * 0.055 * (0.35 + uv.y);',
  '  vWorldY = p.y;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
  '}'
].join('\n');

const fallFragment = [
  'uniform sampler2D uMap;',
  'uniform float uTime;',
  'uniform float uOpacity;',
  'uniform vec3 uTint;',
  'varying vec2 vUv;',
  'varying float vWorldY;',
  'void main() {',
  '  vec2 uv = vUv;',
  '  uv.y = fract(uv.y * 1.25 - uTime * 0.42);',
  '  float streak = texture2D(uMap, uv).a;',
  '  float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);',
  '  float mist = sin(vUv.x * 27.0 + uTime * 1.7 + vUv.y * 12.0) * 0.5 + 0.5;',
  '  float alpha = (0.18 + streak * 0.62 + mist * 0.04) * edge * uOpacity;',
  '  float bottomFade = smoothstep(0.0, 0.17, vUv.y) * (1.0 - smoothstep(0.84, 1.0, vUv.y));',
  '  alpha *= bottomFade;',
  '  vec3 color = mix(uTint, vec3(0.97, 1.0, 0.95), streak * 0.65);',
  '  gl_FragColor = vec4(color, alpha);',
  '}'
].join('\n');

export function createWaterfallMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uTime: { value: 0 },
      uOpacity: { value: 0.9 },
      uTint: { value: new THREE.Color('#bce8dd') }
    },
    vertexShader: fallVertex,
    fragmentShader: fallFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

export function buildRibbonGeometry(points, widths, options = {}) {
  const pos = [];
  const uvs = [];
  const indices = [];
  const count = points.length;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const current = points[i];
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(count - 1, i + 1)];
    const tangent = new THREE.Vector3().subVectors(next, previous).normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
    const w = (widths?.[i] ?? options.width ?? 1) * 0.5;
    pos.push(current.x + side.x * w, current.y, current.z + side.z * w);
    pos.push(current.x - side.x * w, current.y, current.z - side.z * w);
    const v = i / (count - 1);
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < count - 1; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createWaterfallCurtain(points, widths, material) {
  const geo = buildRibbonGeometry(points, widths, { width: 1 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 3;
  return mesh;
}

export function createStillWaterDisc(radius, material, options = {}) {
  const geo = new THREE.CircleGeometry(radius, options.segments || 96);
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  if (options.position) mesh.position.set(...options.position);
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  return mesh;
}
